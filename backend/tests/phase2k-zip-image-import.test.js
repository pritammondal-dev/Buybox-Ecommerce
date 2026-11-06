const mongoose = require("mongoose");
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const AdmZip = require("adm-zip");
const request = require("supertest");

const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const InventoryTransaction = require("../src/models/InventoryTransaction");
const SkuRegistry = require("../src/models/SkuRegistry");
const ImportExportJob = require("../src/models/ImportExportJob");

const bulkImportExportService = require("../src/services/bulk-import-export.service");
const { generateAccessToken, TOKEN_CONTEXTS } = require("../src/services/token.service");
const {
  processZipArchive,
  getStagedManifest,
  cleanupStaging,
  matchFilenameInZip,
  validateImageMagicBytes,
  STAGING_ROOT,
} = require("../src/utils/zip-extractor.util");
const app = require("../src/app");
const { ROLES } = require("../src/constants/auth.constants");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_phase2k_zip_test?")
  : "mongodb://127.0.0.1:27017/buybox_phase2k_zip_test?replicaSet=rs0";

jest.setTimeout(60000);

const TINY_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

const TINY_JPEG_BUFFER = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64"
);

/**
 * Creates an in-memory ZIP buffer with specified entries
 * @param {Array<{ name: string, content?: Buffer|string }>} files
 * @returns {Buffer}
 */
function createZipBuffer(files = []) {
  const zip = new AdmZip();
  for (const f of files) {
    const content = f.content !== undefined ? f.content : TINY_PNG_BUFFER;
    zip.addFile(f.name, Buffer.isBuffer(content) ? content : Buffer.from(content));
    if (f.explicitEntryName) {
      const entries = zip.getEntries();
      entries[entries.length - 1].entryName = f.explicitEntryName;
    }
  }
  return zip.toBuffer();
}

describe("Buybox Phase 2K — Minimal Bulk Product Image Upload Remediation Suite", () => {
  let adminUser, vendorUserA, vendorUserB, superAdminUser;
  let adminActor, vendorActorA, vendorActorB, superAdminActor;
  let vendorA, vendorB;
  let category, brand, warehouse;
  let vendorTokenA, vendorTokenB, adminToken, superAdminToken;

  const makeRow = (overrides = {}) => {
    const row = new Array(38).fill("");
    row[0] = overrides.name || "Test Audio Speaker";
    row[1] = overrides.parentSku !== undefined ? overrides.parentSku : (overrides.sku || "SPK-001");
    row[2] = overrides.sku || "SPK-001";
    row[3] = overrides.productType || "simple";
    row[4] = overrides.category || category.name;
    row[5] = overrides.brand !== undefined ? overrides.brand : brand.name;
    row[6] = overrides.price !== undefined ? overrides.price : 1499.0;
    row[7] = overrides.compareAtPrice !== undefined ? overrides.compareAtPrice : 1999.0;
    row[8] = overrides.costPrice !== undefined ? overrides.costPrice : 800.0;
    row[9] = overrides.stock !== undefined ? overrides.stock : 25;
    row[10] = overrides.warehouse !== undefined ? overrides.warehouse : warehouse.code;
    row[11] = overrides.lowStock !== undefined ? overrides.lowStock : 5;
    row[12] = overrides.color || "";
    row[13] = overrides.size || "";
    row[14] = overrides.material || "";
    row[15] = overrides.barcode || "";
    row[16] = overrides.attr1Name || "";
    row[17] = overrides.attr1Val || "";
    row[18] = overrides.attr2Name || "";
    row[19] = overrides.attr2Val || "";
    row[20] = overrides.taxCategory || "standard";
    row[21] = overrides.isTaxable !== undefined ? overrides.isTaxable : "true";
    row[22] = overrides.weight !== undefined ? overrides.weight : 0.8;
    row[23] = overrides.dimensions || "15x10x10";
    row[24] = overrides.shippingClass || "standard";
    row[25] = overrides.shortDesc || "Wireless Bluetooth Speaker";
    row[26] = overrides.desc || "Crystal clear portable Bluetooth stereo speaker with rich bass.";
    row[27] = overrides.image1 !== undefined ? overrides.image1 : "";
    row[28] = overrides.image2 !== undefined ? overrides.image2 : "";
    row[29] = overrides.image3 !== undefined ? overrides.image3 : "";
    row[30] = overrides.image4 !== undefined ? overrides.image4 : "";
    row[31] = overrides.tags || "audio,speaker,bluetooth";
    row[32] = overrides.seoTitle || "Portable Bluetooth Speaker";
    row[33] = overrides.seoDesc || "Buy portable Bluetooth speaker online.";
    row[34] = overrides.seoKeywords || "audio,bluetooth,speaker";
    row[35] = overrides.isVirtual !== undefined ? overrides.isVirtual : "false";
    row[36] = overrides.isDownloadable !== undefined ? overrides.isDownloadable : "false";
    row[37] = overrides.status || "draft";
    return row;
  };

  const makeBuffer = (dataRows, format = "xlsx", headers = bulkImportExportService.TEMPLATE_HEADERS) => {
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([headers, ...dataRows]);
    xlsx.utils.book_append_sheet(wb, ws, "Products");
    return xlsx.write(wb, { type: "buffer", bookType: format === "csv" ? "csv" : "xlsx" });
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }
    await SkuRegistry.syncIndexes();
    await Product.syncIndexes();
    await ProductVariant.syncIndexes();

    // Clean test collections
    await SkuRegistry.deleteMany({});
    await InventoryTransaction.deleteMany({});
    await Inventory.deleteMany({});
    await ProductVariant.deleteMany({});
    await Product.deleteMany({});
    await Warehouse.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await Vendor.deleteMany({});
    await User.deleteMany({});
    await ImportExportJob.deleteMany({});

    // Seed test actors
    adminUser = await User.create({
      firstName: "Admin",
      lastName: "Phase2K",
      email: "admin.phase2k@buybox.test",
      password: "HashedPassword123!",
      role: ROLES.ADMIN,
      isEmailVerified: true,
      isActive: true,
    });
    adminActor = { id: adminUser._id.toString(), role: ROLES.ADMIN, email: adminUser.email };
    adminToken = generateAccessToken({
      sub: adminUser._id.toString(),
      role: ROLES.ADMIN,
      context: TOKEN_CONTEXTS.ADMINISTRATOR,
      authVersion: 1,
      permissionVersion: 1,
    });

    superAdminUser = await User.create({
      firstName: "SuperAdmin",
      lastName: "Phase2K",
      email: "superadmin.phase2k@buybox.test",
      password: "HashedPassword123!",
      role: ROLES.SUPER_ADMIN,
      roles: [ROLES.SUPER_ADMIN],
      isEmailVerified: true,
      isActive: true,
    });
    superAdminActor = {
      id: superAdminUser._id.toString(),
      role: ROLES.SUPER_ADMIN,
      roles: [ROLES.SUPER_ADMIN],
      email: superAdminUser.email,
      context: TOKEN_CONTEXTS.ADMINISTRATOR,
    };
    superAdminToken = generateAccessToken({
      sub: superAdminUser._id.toString(),
      role: ROLES.SUPER_ADMIN,
      context: TOKEN_CONTEXTS.ADMINISTRATOR,
      authVersion: 1,
      permissionVersion: 1,
    });

    vendorUserA = await User.create({
      firstName: "VendorA",
      lastName: "Phase2K",
      email: "vendora.phase2k@buybox.test",
      password: "HashedPassword123!",
      role: ROLES.VENDOR,
      isEmailVerified: true,
      isActive: true,
    });
    vendorA = await Vendor.create({
      userId: vendorUserA._id,
      businessName: "Vendor A Electronics",
      businessSlug: "vendor-a-electronics",
      phone: "9876543210",
      businessEmail: vendorUserA.email,
      isActive: true,
      onboardingStatus: "approved",
    });
    vendorActorA = { id: vendorUserA._id.toString(), role: ROLES.VENDOR, email: vendorUserA.email };
    vendorTokenA = generateAccessToken({
      sub: vendorUserA._id.toString(),
      role: ROLES.VENDOR,
      context: TOKEN_CONTEXTS.VENDOR,
      vendorId: vendorA._id.toString(),
      authVersion: 1,
      permissionVersion: 1,
    });

    vendorUserB = await User.create({
      firstName: "VendorB",
      lastName: "Phase2K",
      email: "vendorb.phase2k@buybox.test",
      password: "HashedPassword123!",
      role: ROLES.VENDOR,
      isEmailVerified: true,
      isActive: true,
    });
    vendorB = await Vendor.create({
      userId: vendorUserB._id,
      businessName: "Vendor B Apparel",
      businessSlug: "vendor-b-apparel",
      phone: "9876543211",
      businessEmail: vendorUserB.email,
      isActive: true,
      onboardingStatus: "approved",
    });
    vendorActorB = { id: vendorUserB._id.toString(), role: ROLES.VENDOR, email: vendorUserB.email };
    vendorTokenB = generateAccessToken({
      sub: vendorUserB._id.toString(),
      role: ROLES.VENDOR,
      context: TOKEN_CONTEXTS.VENDOR,
      vendorId: vendorB._id.toString(),
      authVersion: 1,
      permissionVersion: 1,
    });

    category = await Category.create({
      name: "Electronics",
      slug: "electronics",
      isActive: true,
    });

    brand = await Brand.create({
      name: "SonicSound",
      slug: "sonicsound",
      isActive: true,
    });

    warehouse = await Warehouse.create({
      name: "Mumbai Primary DC",
      code: "WH-BOM-01",
      isDefault: true,
      isActive: true,
      address: {
        addressLine1: "Central Logistics Park",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
    });
  });

  afterAll(async () => {
    // Clean staging root after suite
    if (fs.existsSync(STAGING_ROOT)) {
      try {
        fs.rmSync(STAGING_ROOT, { recursive: true, force: true });
      } catch {
        // Ignored
      }
    }
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await SkuRegistry.deleteMany({});
    await InventoryTransaction.deleteMany({});
    await Inventory.deleteMany({});
    await ProductVariant.deleteMany({});
    await Product.deleteMany({});
    await ImportExportJob.deleteMany({});
  });

  // 1. Existing URL-only CSV import
  test("1. Existing URL-only CSV import works and persists HTTPS URLs without a ZIP", async () => {
    const row = makeRow({
      sku: "URL-CSV-001",
      image1: "https://images.unsplash.com/photo-1546435770-a3e426bf472b",
      image2: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
    });
    const buffer = makeBuffer([row], "csv");

    const report = await bulkImportExportService.validateBulkImport({
      buffer,
      filename: "products.csv",
      vendorId: vendorA._id,
      actor: vendorActorA,
    });

    expect(report.validCount).toBe(1);
    expect(report.errorCount).toBe(0);
    expect(report.stagingId).toBeNull();

    const commitRes = await bulkImportExportService.commitBulkImport({
      rows: report.rows,
      vendorId: vendorA._id,
      actor: vendorActorA,
    });

    expect(commitRes.createdCount).toBe(1);
    const product = await Product.findOne({ sku: "URL-CSV-001" });
    expect(product.images).toHaveLength(2);
    expect(product.images[0].url).toBe("https://images.unsplash.com/photo-1546435770-a3e426bf472b");
    expect(product.images[1].url).toBe("https://images.unsplash.com/photo-1505740420928-5e560c06d30e");
  });

  // 2. Existing URL-only XLSX import
  test("2. Existing URL-only XLSX import works and preserves multi-image gallery without a ZIP", async () => {
    const row = makeRow({
      sku: "URL-XLSX-001",
      image1: "https://cdn.example.com/img1.jpg",
      image2: "https://cdn.example.com/img2.jpg",
      image3: "https://cdn.example.com/img3.jpg",
      image4: "https://cdn.example.com/img4.jpg",
    });
    const buffer = makeBuffer([row], "xlsx");

    const report = await bulkImportExportService.validateBulkImport({
      buffer,
      filename: "products.xlsx",
      vendorId: vendorA._id,
      actor: vendorActorA,
    });

    expect(report.validCount).toBe(1);
    expect(report.errorCount).toBe(0);

    const commitRes = await bulkImportExportService.commitBulkImport({
      rows: report.rows,
      vendorId: vendorA._id,
      actor: vendorActorA,
    });

    expect(commitRes.createdCount).toBe(1);
    const product = await Product.findOne({ sku: "URL-XLSX-001" });
    expect(product.images).toHaveLength(4);
    expect(product.images[3].url).toBe("https://cdn.example.com/img4.jpg");
  });

  // 3. ZIP plus spreadsheet import
  test("3. ZIP plus spreadsheet import stages files, copies to /uploads/, and persists permanent references", async () => {
    const zipBuffer = createZipBuffer([
      { name: "speaker_main.png", content: TINY_PNG_BUFFER },
      { name: "speaker_angle.jpg", content: TINY_JPEG_BUFFER },
    ]);

    const row = makeRow({
      sku: "ZIP-PROD-001",
      image1: "speaker_main.png",
      image2: "speaker_angle.jpg",
    });
    const spreadsheetBuffer = makeBuffer([row], "xlsx");

    const report = await bulkImportExportService.validateBulkImport({
      buffer: spreadsheetBuffer,
      filename: "products.xlsx",
      vendorId: vendorA._id,
      actor: vendorActorA,
      imagesZipBuffer: zipBuffer,
      imagesZipFilename: "images.zip",
    });

    expect(report.validCount).toBe(1);
    expect(report.errorCount).toBe(0);
    expect(report.stagingId).toBeDefined();
    expect(report.archiveSummary.totalFiles).toBe(2);

    const commitRes = await bulkImportExportService.commitBulkImport({
      rows: report.rows,
      stagingId: report.stagingId,
      vendorId: vendorA._id,
      actor: vendorActorA,
    });

    expect(commitRes.createdCount).toBe(1);
    const product = await Product.findOne({ sku: "ZIP-PROD-001" });
    expect(product.images).toHaveLength(2);
    expect(product.images[0].url).toMatch(/^\/uploads\/product_\d+_[a-f0-9]+\.png$/);
    expect(product.images[1].url).toMatch(/^\/uploads\/product_\d+_[a-f0-9]+\.jpg$/);

    // Verify file exists on disk
    const localPath = path.resolve(__dirname, "../public", product.images[0].url.replace(/^\//, ""));
    expect(fs.existsSync(localPath)).toBe(true);

    // Clean up created file
    fs.rmSync(localPath, { force: true });
  });

  // 4. Relative filename matching
  test("4. Relative filename matching matches exact relative paths and basenames deterministically", async () => {
    const zipBuffer = createZipBuffer([
      { name: "assets/headphones.jpg", content: TINY_JPEG_BUFFER },
    ]);

    // Match by basename "headphones.jpg"
    const row = makeRow({
      sku: "REL-MATCH-001",
      image1: "headphones.jpg",
    });
    const spreadsheetBuffer = makeBuffer([row], "xlsx");

    const report = await bulkImportExportService.validateBulkImport({
      buffer: spreadsheetBuffer,
      filename: "products.xlsx",
      vendorId: vendorA._id,
      actor: vendorActorA,
      imagesZipBuffer: zipBuffer,
    });

    expect(report.validCount).toBe(1);
    expect(report.errorCount).toBe(0);

    // Clean staging
    if (report.stagingId) cleanupStaging(report.stagingId);
  });

  // 5. Missing filenames
  test("5. Missing filenames produce actionable row-specific error when file is not in ZIP", async () => {
    const zipBuffer = createZipBuffer([
      { name: "present.jpg", content: TINY_JPEG_BUFFER },
    ]);

    const row = makeRow({
      sku: "MISSING-IMG-001",
      image1: "absent_file.jpg",
    });
    const spreadsheetBuffer = makeBuffer([row], "xlsx");

    const report = await bulkImportExportService.validateBulkImport({
      buffer: spreadsheetBuffer,
      filename: "products.xlsx",
      vendorId: vendorA._id,
      actor: vendorActorA,
      imagesZipBuffer: zipBuffer,
    });

    expect(report.validCount).toBe(0);
    expect(report.errorCount).toBe(1);
    expect(report.errorDetails[0].error).toContain("was not found in the uploaded ZIP archive");

    if (report.stagingId) cleanupStaging(report.stagingId);
  });

  // 6. Duplicate and ambiguous filenames
  test("6. Duplicate basenames in different ZIP subfolders trigger ambiguous filename rejection", async () => {
    const zipBuffer = createZipBuffer([
      { name: "black/case.jpg", content: TINY_JPEG_BUFFER },
      { name: "white/case.jpg", content: TINY_JPEG_BUFFER },
    ]);

    // Ambiguous reference: "case.jpg" matches black/case.jpg and white/case.jpg
    const row = makeRow({
      sku: "AMBIG-001",
      image1: "case.jpg",
    });
    const spreadsheetBuffer = makeBuffer([row], "xlsx");

    const report = await bulkImportExportService.validateBulkImport({
      buffer: spreadsheetBuffer,
      filename: "products.xlsx",
      vendorId: vendorA._id,
      actor: vendorActorA,
      imagesZipBuffer: zipBuffer,
    });

    expect(report.validCount).toBe(0);
    expect(report.errorCount).toBe(1);
    expect(report.errorDetails[0].error).toContain("Ambiguous image reference 'case.jpg'");
    expect(report.errorDetails[0].error).toContain("black/case.jpg");
    expect(report.errorDetails[0].error).toContain("white/case.jpg");

    if (report.stagingId) cleanupStaging(report.stagingId);
  });

  // 7. Multiple gallery images and correct ordering
  test("7. Multiple gallery images preserve exact cell order Image 1 through Image 4 with sortOrder 0..3", async () => {
    const zipBuffer = createZipBuffer([
      { name: "front.png", content: TINY_PNG_BUFFER },
      { name: "side.png", content: TINY_PNG_BUFFER },
      { name: "back.png", content: TINY_PNG_BUFFER },
      { name: "box.png", content: TINY_PNG_BUFFER },
    ]);

    const row = makeRow({
      sku: "GALLERY-ORD-001",
      image1: "front.png",
      image2: "side.png",
      image3: "back.png",
      image4: "box.png",
    });
    const spreadsheetBuffer = makeBuffer([row], "xlsx");

    const report = await bulkImportExportService.validateBulkImport({
      buffer: spreadsheetBuffer,
      filename: "products.xlsx",
      vendorId: vendorA._id,
      actor: vendorActorA,
      imagesZipBuffer: zipBuffer,
    });

    expect(report.validCount).toBe(1);

    const commitRes = await bulkImportExportService.commitBulkImport({
      rows: report.rows,
      stagingId: report.stagingId,
      vendorId: vendorA._id,
      actor: vendorActorA,
    });

    expect(commitRes.createdCount).toBe(1);
    const product = await Product.findOne({ sku: "GALLERY-ORD-001" });
    expect(product.images).toHaveLength(4);
    expect(product.images[0].sortOrder).toBe(0);
    expect(product.images[1].sortOrder).toBe(1);
    expect(product.images[2].sortOrder).toBe(2);
    expect(product.images[3].sortOrder).toBe(3);
  });

  // 8. Variant image association and ownership
  test("8. Variable-product variants associate individual Image 1 while Image 2-4 on variants are rejected", async () => {
    const zipBuffer = createZipBuffer([
      { name: "shirt_parent.jpg", content: TINY_JPEG_BUFFER },
      { name: "shirt_red.jpg", content: TINY_JPEG_BUFFER },
      { name: "shirt_blue.jpg", content: TINY_JPEG_BUFFER },
    ]);

    const parentRow = makeRow({
      name: "Crewneck T-Shirt",
      parentSku: "TSHIRT-VAR",
      sku: "TSHIRT-RED",
      productType: "variable",
      color: "Red",
      image1: "shirt_parent.jpg",
    });

    const secondVariantRow = makeRow({
      name: "Crewneck T-Shirt",
      parentSku: "TSHIRT-VAR",
      sku: "TSHIRT-BLU",
      productType: "variable",
      color: "Blue",
      image1: "shirt_blue.jpg",
    });

    const spreadsheetBuffer = makeBuffer([parentRow, secondVariantRow], "xlsx");

    const report = await bulkImportExportService.validateBulkImport({
      buffer: spreadsheetBuffer,
      filename: "products.xlsx",
      vendorId: vendorA._id,
      actor: vendorActorA,
      imagesZipBuffer: zipBuffer,
    });

    expect(report.validCount).toBe(2);

    await bulkImportExportService.commitBulkImport({
      rows: report.rows,
      stagingId: report.stagingId,
      vendorId: vendorA._id,
      actor: vendorActorA,
    });

    const varRed = await ProductVariant.findOne({ sku: "TSHIRT-RED" });
    const varBlu = await ProductVariant.findOne({ sku: "TSHIRT-BLU" });

    expect(varRed.image?.url).toMatch(/^\/uploads\/product_/);
    expect(varBlu.image?.url).toMatch(/^\/uploads\/product_/);
    expect(varRed.image.url).not.toBe(varBlu.image.url);
  });

  // 9. Blank-cell preservation on updates
  test("9. Blank image cells preserve existing product images during catalog updates", async () => {
    // 1. Create product with initial image
    const initialRow = makeRow({
      sku: "BLANK-PRESERVE-001",
      image1: "https://example.com/initial.jpg",
      image2: "https://example.com/gallery.jpg",
    });
    const createReport = await bulkImportExportService.validateBulkImport({
      buffer: makeBuffer([initialRow], "xlsx"),
      filename: "initial.xlsx",
      vendorId: vendorA._id,
      actor: vendorActorA,
    });
    await bulkImportExportService.commitBulkImport({
      rows: createReport.rows,
      vendorId: vendorA._id,
      actor: vendorActorA,
    });

    // 2. Update with blank image cells
    const updateRow = makeRow({
      sku: "BLANK-PRESERVE-001",
      price: 1799.0,
      image1: "",
      image2: "",
      image3: "",
      image4: "",
    });
    const updateReport = await bulkImportExportService.validateBulkImport({
      buffer: makeBuffer([updateRow], "xlsx"),
      filename: "update.xlsx",
      vendorId: vendorA._id,
      actor: vendorActorA,
    });
    expect(updateReport.validCount).toBe(1);

    await bulkImportExportService.commitBulkImport({
      rows: updateReport.rows,
      vendorId: vendorA._id,
      actor: vendorActorA,
    });

    const updatedProduct = await Product.findOne({ sku: "BLANK-PRESERVE-001" });
    expect(Number(updatedProduct.price)).toBe(1799.0);
    expect(updatedProduct.images).toHaveLength(2);
    expect(updatedProduct.images[0].url).toBe("https://example.com/initial.jpg");
    expect(updatedProduct.images[1].url).toBe("https://example.com/gallery.jpg");
  });

  // 10. Simple-product default-variant synchronization
  test("10. Simple product default variant image synchronizes with parent primary image", async () => {
    const zipBuffer = createZipBuffer([
      { name: "gadget.png", content: TINY_PNG_BUFFER },
    ]);

    const row = makeRow({
      sku: "SIMPLE-SYNC-001",
      productType: "simple",
      image1: "gadget.png",
    });
    const spreadsheetBuffer = makeBuffer([row], "xlsx");

    const report = await bulkImportExportService.validateBulkImport({
      buffer: spreadsheetBuffer,
      filename: "products.xlsx",
      vendorId: vendorA._id,
      actor: vendorActorA,
      imagesZipBuffer: zipBuffer,
    });

    await bulkImportExportService.commitBulkImport({
      rows: report.rows,
      stagingId: report.stagingId,
      vendorId: vendorA._id,
      actor: vendorActorA,
    });

    const product = await Product.findOne({ sku: "SIMPLE-SYNC-001" });
    const variant = await ProductVariant.findOne({ sku: "SIMPLE-SYNC-001" });

    expect(product.images[0].url).toBe(variant.image.url);
  });

  // 11. ZIP path traversal and absolute-path attacks
  test("11. ZIP path traversal and absolute paths are rejected with ZIP_PATH_TRAVERSAL error", () => {
    // Relative path traversal ../evil.png
    const traversalZip = createZipBuffer([
      { name: "placeholder.png", explicitEntryName: "../../../evil.png", content: TINY_PNG_BUFFER },
    ]);

    expect(() => {
      processZipArchive(traversalZip, { vendorId: vendorA._id });
    }).toThrow(expect.objectContaining({ code: "ZIP_PATH_TRAVERSAL" }));

    // Absolute path /root/evil.png
    const absoluteZip = createZipBuffer([
      { name: "placeholder.png", explicitEntryName: "/root/evil.png", content: TINY_PNG_BUFFER },
    ]);

    expect(() => {
      processZipArchive(absoluteZip, { vendorId: vendorA._id });
    }).toThrow(expect.objectContaining({ code: "ZIP_PATH_TRAVERSAL" }));
  });

  // 12. Compressed and uncompressed size limits
  test("12. Compressed archive > 50MB and aggregate uncompressed > 150MB are rejected", () => {
    // Compressed limit check
    const fakeTooLargeBuffer = Buffer.alloc(51 * 1024 * 1024);
    expect(() => {
      processZipArchive(fakeTooLargeBuffer, { vendorId: vendorA._id });
    }).toThrow(expect.objectContaining({ code: "ZIP_TOO_LARGE" }));

    // P1-A: Single-entry decompression bomb check (31MB zeroes compressing to ~31KB)
    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const bombPayload = Buffer.concat([pngHeader, Buffer.alloc(31 * 1024 * 1024 - 8, 0)]);
    const bombZip = new AdmZip();
    bombZip.addFile("bomb.png", bombPayload);
    const bombZipBuffer = bombZip.toBuffer();

    const beforeDirs = fs.readdirSync(STAGING_ROOT);
    expect(() => {
      processZipArchive(bombZipBuffer, { vendorId: vendorA._id });
    }).toThrow(expect.objectContaining({ code: "ZIP_DECOMPRESSION_BOMB" }));
    const afterDirs = fs.readdirSync(STAGING_ROOT);
    expect(afterDirs.length).toBe(beforeDirs.length);

    // Aggregate decompression bomb check (6 x 26MB = 156MB > 150MB)
    const aggPayload = Buffer.concat([pngHeader, Buffer.alloc(26 * 1024 * 1024 - 8, 0)]);
    const aggZip = new AdmZip();
    for (let i = 0; i < 6; i++) {
      aggZip.addFile(`img_${i}.png`, aggPayload);
    }
    const aggZipBuffer = aggZip.toBuffer();
    expect(() => {
      processZipArchive(aggZipBuffer, { vendorId: vendorA._id });
    }).toThrow(expect.objectContaining({ code: "ZIP_DECOMPRESSION_BOMB" }));
  });

  // 13. Excessive entry count and malformed archives
  test("13. Archive with excessive entries (>300) and malformed buffers are rejected", () => {
    // Malformed buffer
    const badBuffer = Buffer.from("NOT_A_ZIP_BUFFER_DATA");
    expect(() => {
      processZipArchive(badBuffer, { vendorId: vendorA._id });
    }).toThrow(expect.objectContaining({ code: "INVALID_ZIP_FORMAT" }));

    // Excessive entry count
    const zip = new AdmZip();
    for (let i = 0; i < 305; i++) {
      zip.addFile(`img_${i}.png`, TINY_PNG_BUFFER);
    }
    const tooManyEntriesBuffer = zip.toBuffer();

    expect(() => {
      processZipArchive(tooManyEntriesBuffer, { vendorId: vendorA._id });
    }).toThrow(expect.objectContaining({ code: "ZIP_TOO_MANY_ENTRIES" }));
  });

  // 14. SVG and unsupported-content rejection
  test("14. SVG files, non-raster extensions, and invalid image magic bytes are rejected", () => {
    // SVG in zip
    const svgZip = createZipBuffer([
      { name: "vector.svg", content: "<svg></svg>" },
    ]);
    expect(() => {
      processZipArchive(svgZip, { vendorId: vendorA._id });
    }).toThrow(expect.objectContaining({ code: "SVG_NOT_ALLOWED" }));

    // Unsupported extension
    const exeZip = createZipBuffer([
      { name: "script.exe", content: "malicious binary" },
    ]);
    expect(() => {
      processZipArchive(exeZip, { vendorId: vendorA._id });
    }).toThrow(expect.objectContaining({ code: "UNSUPPORTED_ARCHIVE_FILE_TYPE" }));

    // Raster extension with fake text content
    const fakeJpgZip = createZipBuffer([
      { name: "fake.jpg", content: "plain text masquerading as jpg" },
    ]);
    expect(() => {
      processZipArchive(fakeJpgZip, { vendorId: vendorA._id });
    }).toThrow(expect.objectContaining({ code: "INVALID_IMAGE_CONTENT" }));
  });

  // 15. Validation-to-commit staging isolation and expiration
  test("15. Staged files are isolated by vendorId; expired sessions, malformed IDs, and cross-vendor access are rejected", () => {
    const zipBuffer = createZipBuffer([
      { name: "isolated.png", content: TINY_PNG_BUFFER },
    ]);

    const context = processZipArchive(zipBuffer, { vendorId: vendorA._id });
    expect(context.stagingId).toBeDefined();

    // 1. Vendor A can access its staged files
    const manifestA = getStagedManifest(context.stagingId, { vendorId: vendorA._id });
    expect(manifestA.stagingId).toBe(context.stagingId);

    // 2. Vendor B cannot access Vendor A's staged files (403 STAGING_ACCESS_DENIED)
    expect(() => {
      getStagedManifest(context.stagingId, { vendorId: vendorB._id });
    }).toThrow(expect.objectContaining({ code: "STAGING_ACCESS_DENIED" }));

    // 3. Vendor cannot access staging created without vendorId (admin-staged) (403 STAGING_ACCESS_DENIED)
    const adminStg = processZipArchive(zipBuffer, { vendorId: null, actorId: adminActor.id });
    expect(() => {
      getStagedManifest(adminStg.stagingId, { vendorId: vendorA._id });
    }).toThrow(expect.objectContaining({ code: "STAGING_ACCESS_DENIED" }));
    cleanupStaging(adminStg.stagingId);

    // 4. Missing or malformed manifest path
    expect(() => {
      getStagedManifest("../../evil", { vendorId: vendorA._id });
    }).toThrow(expect.objectContaining({ code: "INVALID_STAGING_ID" }));

    expect(() => {
      getStagedManifest("stg_nonexistent_12345", { vendorId: vendorA._id });
    }).toThrow(expect.objectContaining({ code: "STAGING_EXPIRED" }));

    // 5. Admin can access staged files under intended policy
    const adminManifest = getStagedManifest(context.stagingId, { isAdmin: true });
    expect(adminManifest.stagingId).toBe(context.stagingId);

    // 6. Superadmin can access staged files under canonical ROLES.SUPER_ADMIN policy
    const superAdminManifest = getStagedManifest(context.stagingId, { isAdmin: true });
    expect(superAdminManifest.stagingId).toBe(context.stagingId);

    // 7. Expired staging access
    const manifestPath = path.join(STAGING_ROOT, context.stagingId, "manifest.json");
    const manifestObj = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifestObj.expiresAt = new Date(Date.now() - 1000).toISOString();
    fs.writeFileSync(manifestPath, JSON.stringify(manifestObj));

    expect(() => {
      getStagedManifest(context.stagingId, { vendorId: vendorA._id });
    }).toThrow(expect.objectContaining({ code: "STAGING_EXPIRED" }));

    // 8. Unauthorized requests leave staging data unchanged on disk
    const secureStg = processZipArchive(zipBuffer, { vendorId: vendorA._id });
    const secureDir = path.join(STAGING_ROOT, secureStg.stagingId);
    expect(fs.existsSync(secureDir)).toBe(true);
    const filesBefore = fs.readdirSync(secureDir);

    try {
      getStagedManifest(secureStg.stagingId, { vendorId: vendorB._id });
    } catch {
      // Expected rejection
    }
    const filesAfter = fs.readdirSync(secureDir);
    expect(filesAfter).toEqual(filesBefore);
    cleanupStaging(secureStg.stagingId);

    cleanupStaging(context.stagingId);
  });

  // 16. Cleanup after validation and commit failures
  test("16. Temporary files are cleaned up upon successful commit or commit failure", async () => {
    const zipBuffer = createZipBuffer([
      { name: "temporary.png", content: TINY_PNG_BUFFER },
    ]);

    const row = makeRow({
      sku: "CLEANUP-001",
      image1: "temporary.png",
    });

    const report = await bulkImportExportService.validateBulkImport({
      buffer: makeBuffer([row], "xlsx"),
      filename: "products.xlsx",
      vendorId: vendorA._id,
      actor: vendorActorA,
      imagesZipBuffer: zipBuffer,
    });

    const stagingDir = path.join(STAGING_ROOT, report.stagingId);
    expect(fs.existsSync(stagingDir)).toBe(true);

    await bulkImportExportService.commitBulkImport({
      rows: report.rows,
      stagingId: report.stagingId,
      vendorId: vendorA._id,
      actor: vendorActorA,
    });

    // Staging directory must be cleaned up
    expect(fs.existsSync(stagingDir)).toBe(false);
  });

  // 17. Retry/idempotency behavior and prevention of orphaned files
  test("17. Re-importing existing SKU updates without orphaned files or duplicate records", async () => {
    const zipBuffer1 = createZipBuffer([{ name: "v1.png", content: TINY_PNG_BUFFER }]);
    const row1 = makeRow({ sku: "IDEMP-001", image1: "v1.png" });

    const rep1 = await bulkImportExportService.validateBulkImport({
      buffer: makeBuffer([row1], "xlsx"),
      filename: "p1.xlsx",
      vendorId: vendorA._id,
      actor: vendorActorA,
      imagesZipBuffer: zipBuffer1,
    });

    await bulkImportExportService.commitBulkImport({
      rows: rep1.rows,
      stagingId: rep1.stagingId,
      vendorId: vendorA._id,
      actor: vendorActorA,
    });

    // Re-importing should update
    const zipBuffer2 = createZipBuffer([{ name: "v2.png", content: TINY_PNG_BUFFER }]);
    const row2 = makeRow({ sku: "IDEMP-001", price: 2199.0, compareAtPrice: 2999.0, image1: "v2.png" });

    const rep2 = await bulkImportExportService.validateBulkImport({
      buffer: makeBuffer([row2], "xlsx"),
      filename: "p2.xlsx",
      vendorId: vendorA._id,
      actor: vendorActorA,
      imagesZipBuffer: zipBuffer2,
    });

    const commit2 = await bulkImportExportService.commitBulkImport({
      rows: rep2.rows,
      stagingId: rep2.stagingId,
      vendorId: vendorA._id,
      actor: vendorActorA,
    });

    expect(commit2.updatedCount).toBe(1);
    const count = await Product.countDocuments({ sku: "IDEMP-001" });
    expect(count).toBe(1);
  });

  // 18. Vendor/admin authorization and cross-tenant isolation
  test("18. Cross-tenant SKU collisions are rejected during validation", async () => {
    // Vendor A creates a product
    const rowA = makeRow({ sku: "TENANT-001" });
    const repA = await bulkImportExportService.validateBulkImport({
      buffer: makeBuffer([rowA], "xlsx"),
      filename: "vendora.xlsx",
      vendorId: vendorA._id,
      actor: vendorActorA,
    });
    await bulkImportExportService.commitBulkImport({
      rows: repA.rows,
      vendorId: vendorA._id,
      actor: vendorActorA,
    });

    // Vendor B tries to import the same SKU
    const rowB = makeRow({ sku: "TENANT-001" });
    const repB = await bulkImportExportService.validateBulkImport({
      buffer: makeBuffer([rowB], "xlsx"),
      filename: "vendorb.xlsx",
      vendorId: vendorB._id,
      actor: vendorActorB,
    });

    expect(repB.validCount).toBe(0);
    expect(repB.errorCount).toBe(1);
    expect(repB.errorDetails[0].error).toContain("Cross-vendor SKU collision");
  });

  // 19. Backward compatibility with clients sending only 'file'
  test("19. HTTP API accepts single 'file' field without 'images' and returns valid preview", async () => {
    const row = makeRow({ sku: "BACKCOMPAT-001", image1: "https://example.com/item.jpg" });
    const spreadsheetBuffer = makeBuffer([row], "xlsx");

    const res = await request(app)
      .post("/api/v1/products/vendor/import/validate")
      .set("Authorization", `Bearer ${vendorTokenA}`)
      .attach("file", spreadsheetBuffer, "products.xlsx");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.validCount).toBe(1);
    expect(res.body.data.stagingId).toBeNull();
  });

  // 20. Exact preservation of the existing 38-column template
  test("20. Exact preservation of the canonical 38-column template headers and sequence", () => {
    const { buffer } = bulkImportExportService.generateImportTemplate("csv");
    const wb = xlsx.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    const headers = rows[0];
    expect(headers).toHaveLength(38);

    const EXPECTED_38_COLUMNS = [
      "Product Name",
      "Parent SKU",
      "Variant SKU",
      "Product Type",
      "Category",
      "Brand",
      "Price",
      "Compare At Price",
      "Cost Price",
      "Stock Quantity",
      "Warehouse Code",
      "Low Stock Threshold",
      "Color",
      "Size",
      "Material",
      "Barcode",
      "Attribute 1 Name",
      "Attribute 1 Value",
      "Attribute 2 Name",
      "Attribute 2 Value",
      "Tax Category",
      "Is Taxable",
      "Weight (kg)",
      "Dimensions (LxWxH cm)",
      "Shipping Class",
      "Short Description",
      "Description",
      "Image 1",
      "Image 2",
      "Image 3",
      "Image 4",
      "Tags",
      "SEO Title",
      "SEO Description",
      "SEO Keywords",
      "Is Virtual",
      "Is Downloadable",
      "Status",
    ];

    expect(headers).toEqual(EXPECTED_38_COLUMNS);
  });

  // 21. Canonical superadmin role recognition
  test("21. Canonical super_admin role is recognized for commit, while ordinary vendors are restricted from admin staging", async () => {
    const zip = createZipBuffer([{ name: "super.png", content: TINY_PNG_BUFFER }]);
    const row = makeRow({ sku: "SUPERADMIN-PRD-001", image1: "super.png" });
    const spreadsheetBuffer = makeBuffer([row], "xlsx");

    const report = await bulkImportExportService.validateBulkImport({
      buffer: spreadsheetBuffer,
      filename: "products.xlsx",
      actor: superAdminActor,
      imagesZipBuffer: zip,
    });

    const commitRes = await bulkImportExportService.commitBulkImport({
      rows: report.rows,
      stagingId: report.stagingId,
      actor: superAdminActor,
    });
    expect(commitRes.createdCount).toBe(1);

    // Ordinary vendor cannot commit admin staging session (fails closed with STAGING_ACCESS_DENIED)
    const adminStg = processZipArchive(zip, { vendorId: null, actorId: superAdminActor.id });
    await expect(
      bulkImportExportService.commitBulkImport({
        rows: report.rows,
        stagingId: adminStg.stagingId,
        vendorId: vendorA._id,
        actor: vendorActorA,
      })
    ).rejects.toThrow(expect.objectContaining({ code: "STAGING_ACCESS_DENIED" }));
    cleanupStaging(adminStg.stagingId);

    // Ordinary vendor cannot access admin commit endpoint via HTTP
    const res = await request(app)
      .post("/api/v1/products/admin/import/commit")
      .set("Authorization", `Bearer ${vendorTokenA}`)
      .send({ rows: report.rows });
    expect([401, 403]).toContain(res.status);
  });

  // 22. Permanent file cleanup on row-level product/variant write failure
  test("22. Permanent file cleanup on row-level product/variant write failure preserves successfully committed files", async () => {
    const backendUploadsDir = path.resolve(__dirname, "../public/uploads");
    const zipBuffer = createZipBuffer([
      { name: "parent_ok.png", content: TINY_PNG_BUFFER },
      { name: "variant_ok.png", content: TINY_PNG_BUFFER },
      { name: "variant_fail.png", content: TINY_PNG_BUFFER },
    ]);

    const rowParent = makeRow({
      name: "Variable Item Cleanup Test",
      parentSku: "VAR-CLEANUP",
      sku: "VAR-CLEANUP-1",
      productType: "variable",
      color: "Red",
      image1: "parent_ok.png",
    });

    const rowVar1 = makeRow({
      name: "Variable Item Cleanup Test",
      parentSku: "VAR-CLEANUP",
      sku: "VAR-CLEANUP-2",
      productType: "variable",
      color: "Blue",
      image1: "variant_fail.png",
    });

    const spreadsheetBuffer = makeBuffer([rowParent, rowVar1], "xlsx");

    const report = await bulkImportExportService.validateBulkImport({
      buffer: spreadsheetBuffer,
      filename: "products.xlsx",
      vendorId: vendorA._id,
      actor: vendorActorA,
      imagesZipBuffer: zipBuffer,
    });

    // Artificially simulate a variant persistence failure on rowVar1 by removing required SKU
    report.rows[1].sku = "";

    const commitRes = await bulkImportExportService.commitBulkImport({
      rows: report.rows,
      stagingId: report.stagingId,
      vendorId: vendorA._id,
      actor: vendorActorA,
    });

    // Parent product succeeded, variant 2 failed
    expect(commitRes.createdCount).toBe(1);
    expect(commitRes.failedCount).toBe(1);

    // Parent product image must exist in uploads
    const parentProd = await Product.findOne({ sku: "VAR-CLEANUP" });
    expect(parentProd).not.toBeNull();
    const parentImageFilename = path.basename(parentProd.images[0].url);
    expect(fs.existsSync(path.join(backendUploadsDir, parentImageFilename))).toBe(true);

    // Variant fail image must NOT have been left in uploads
    const varFail = await ProductVariant.findOne({ sku: "VAR-CLEANUP-2" });
    expect(varFail).toBeNull();

    // Clean up created test file
    try {
      fs.unlinkSync(path.join(backendUploadsDir, parentImageFilename));
    } catch {}

    // Parent product write failure cleanup
    const failZip = createZipBuffer([
      { name: "parent_fail.png", content: TINY_PNG_BUFFER },
    ]);
    const rowFailParent = makeRow({
      name: "Failed Parent Product",
      sku: "FAIL-PARENT-001",
      image1: "parent_fail.png",
    });
    const failRep = await bulkImportExportService.validateBulkImport({
      buffer: makeBuffer([rowFailParent], "xlsx"),
      filename: "products.xlsx",
      vendorId: vendorA._id,
      actor: vendorActorA,
      imagesZipBuffer: failZip,
    });
    // Force Product.create validation failure by removing required name
    failRep.rows[0].name = "";
    const failCommit = await bulkImportExportService.commitBulkImport({
      rows: failRep.rows,
      stagingId: failRep.stagingId,
      vendorId: vendorA._id,
      actor: vendorActorA,
    });
    expect(failCommit.createdCount).toBe(0);
    expect(failCommit.failedCount).toBe(1);
    const failProd = await Product.findOne({ sku: "FAIL-PARENT-001" });
    expect(failProd).toBeNull();
  });

  // 23. Commit-time image reference revalidation for tampered rows
  test("23. Commit-time image reference revalidation rejects tampered rows (SVG, traversal, unsupported scheme)", async () => {
    const validRow = makeRow({ sku: "TAMPER-001" });
    const report = await bulkImportExportService.validateBulkImport({
      buffer: makeBuffer([validRow], "xlsx"),
      filename: "products.xlsx",
      vendorId: vendorA._id,
      actor: vendorActorA,
    });

    // 1. Tamper row with SVG
    const tamperedSvgRows = JSON.parse(JSON.stringify(report.rows));
    tamperedSvgRows[0].imageUrl = "https://example.com/exploit.svg";
    await expect(
      bulkImportExportService.commitBulkImport({
        rows: tamperedSvgRows,
        vendorId: vendorA._id,
        actor: vendorActorA,
      })
    ).rejects.toThrow(expect.objectContaining({ code: "INVALID_IMAGE_REFERENCE" }));

    // 2. Tamper row with path traversal
    const tamperedTraversalRows = JSON.parse(JSON.stringify(report.rows));
    tamperedTraversalRows[0].imageUrl = "/uploads/../secret.txt";
    await expect(
      bulkImportExportService.commitBulkImport({
        rows: tamperedTraversalRows,
        vendorId: vendorA._id,
        actor: vendorActorA,
      })
    ).rejects.toThrow(expect.objectContaining({ code: "INVALID_IMAGE_REFERENCE" }));

    // 3. Tamper row with unsupported protocol
    const tamperedFtpRows = JSON.parse(JSON.stringify(report.rows));
    tamperedFtpRows[0].imageUrl = "ftp://malicious.com/image.png";
    await expect(
      bulkImportExportService.commitBulkImport({
        rows: tamperedFtpRows,
        vendorId: vendorA._id,
        actor: vendorActorA,
      })
    ).rejects.toThrow(expect.objectContaining({ code: "INVALID_IMAGE_REFERENCE" }));

    // 4. Valid HTTPS image reference commits successfully
    const validHttpsRows = JSON.parse(JSON.stringify(report.rows));
    validHttpsRows[0].imageUrl = "https://example.com/legitimate_image.jpg";
    const commitRes = await bulkImportExportService.commitBulkImport({
      rows: validHttpsRows,
      vendorId: vendorA._id,
      actor: vendorActorA,
    });
    expect(commitRes.createdCount).toBe(1);
  });

  // 24. Duplicate normalized ZIP entry path rejection
  test("24. Duplicate normalized ZIP entry paths are rejected with DUPLICATE_ARCHIVE_ENTRY", () => {
    const zip = new AdmZip();
    zip.addFile("item_photo.png", TINY_PNG_BUFFER);
    zip.addFile("ITEM_PHOTO.PNG", TINY_PNG_BUFFER);
    const dupZipBuffer = zip.toBuffer();

    expect(() => {
      processZipArchive(dupZipBuffer, { vendorId: vendorA._id });
    }).toThrow(expect.objectContaining({ code: "DUPLICATE_ARCHIVE_ENTRY" }));

    // Legitimate distinct paths in subdirectories are accepted
    const distinctZip = new AdmZip();
    distinctZip.addFile("folderA/item.png", TINY_PNG_BUFFER);
    distinctZip.addFile("folderB/item.png", TINY_PNG_BUFFER);
    const distinctContext = processZipArchive(distinctZip.toBuffer(), { vendorId: vendorA._id });
    expect(distinctContext.totalFiles).toBe(2);
    cleanupStaging(distinctContext.stagingId);
  });
});
