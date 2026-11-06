const mongoose = require("mongoose");
const xlsx = require("xlsx");
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
const { validateImageReference } = require("../src/utils/image-validator.util");
const { ROLES } = require("../src/constants/auth.constants");
const request = require("supertest");
const app = require("../src/app");
const fs = require("fs");
const path = require("path");
const { generateAccessToken } = require("../src/services/token.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_phase2i_img_test?")
  : "mongodb://127.0.0.1:27017/buybox_phase2i_img_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Buybox Phase 2I — Product Image & Bulk-Import/Export Remediation Contract Suite", () => {
  let adminUser, vendorUserA, vendorUserB;
  let adminActor, vendorActorA, vendorActorB;
  let vendorA, vendorB;
  let category, brand, warehouse;

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
      lastName: "Phase2I",
      email: "admin.phase2i@buybox.test",
      password: "HashedPassword123!",
      role: ROLES.ADMIN,
      isEmailVerified: true,
      isActive: true,
    });
    adminActor = { id: adminUser._id.toString(), role: ROLES.ADMIN, email: adminUser.email };

    vendorUserA = await User.create({
      firstName: "VendorA",
      lastName: "Phase2I",
      email: "vendora.phase2i@buybox.test",
      password: "HashedPassword123!",
      role: ROLES.VENDOR,
      isEmailVerified: true,
      isActive: true,
    });
    vendorA = await Vendor.create({
      userId: vendorUserA._id,
      businessName: "Vendor A Store",
      businessSlug: "vendor-a-store",
      isActive: true,
    });
    vendorActorA = { id: vendorUserA._id.toString(), role: ROLES.VENDOR, email: vendorUserA.email };

    vendorUserB = await User.create({
      firstName: "VendorB",
      lastName: "Phase2I",
      email: "vendorb.phase2i@buybox.test",
      password: "HashedPassword123!",
      role: ROLES.VENDOR,
      isEmailVerified: true,
      isActive: true,
    });
    vendorB = await Vendor.create({
      userId: vendorUserB._id,
      businessName: "Vendor B Store",
      businessSlug: "vendor-b-store",
      isActive: true,
    });
    vendorActorB = { id: vendorUserB._id.toString(), role: ROLES.VENDOR, email: vendorUserB.email };

    category = await Category.create({
      name: "Electronics",
      slug: "electronics",
      isActive: true,
    });

    brand = await Brand.create({
      name: "SoundMaster",
      slug: "soundmaster",
      isActive: true,
    });

    warehouse = await Warehouse.create({
      name: "Central Hub",
      code: "WH-CENTRAL",
      address: {
        addressLine1: "Central Avenue",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400051",
        country: "IN",
      },
      isDefault: true,
      isActive: true,
    });
  });

  afterAll(async () => {
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
    await mongoose.connection.close();
  });

  describe("Fix A: Image Reference Security & Protocol Validation", () => {
    test("Accepts syntactically valid HTTPS URLs and approved /uploads/ relative paths", () => {
      const validCases = [
        "https://images.unsplash.com/photo-1521572267360-ee0c2909d518",
        "https://cdn.example.com/products/img_01.png?v=2",
        "https://sub.domain.co.uk/path/to/image.webp",
        "/uploads/products/2026/test-speaker.jpg",
        "/uploads/sample_image.png",
      ];
      for (const ref of validCases) {
        const res = validateImageReference(ref);
        expect(res.isValid).toBe(true);
      }
    });

    test("Rejects dangerous protocols: javascript, data, file, ftp, and protocol-relative URLs", () => {
      const dangerousCases = [
        "javascript:alert(document.cookie)",
        "JAVASCRIPT:console.log(1)",
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA",
        "file:///etc/passwd",
        "ftp://ftp.example.com/image.jpg",
        "//cdn.example.com/image.jpg",
      ];
      for (const ref of dangerousCases) {
        const res = validateImageReference(ref);
        expect(res.isValid).toBe(false);
        expect(res.reason).toBeDefined();
      }
    });

    test("Rejects insecure plain HTTP URLs by default", () => {
      const res = validateImageReference("http://insecure.example.com/image.png");
      expect(res.isValid).toBe(false);
      expect(res.reason.toLowerCase()).toContain("https");
    });

    test("Rejects embedded credentials in URLs", () => {
      const res = validateImageReference("https://admin:secret@cdn.example.com/image.jpg");
      expect(res.isValid).toBe(false);
      expect(res.reason).toContain("credentials");
    });

    test("Rejects local path traversal, backslashes, outside /uploads/ paths, and dangerous extensions", () => {
      const badPaths = [
        "/uploads/../secrets/keys.txt",
        "/uploads/../../etc/passwd",
        "/uploads/products/image.exe",
        "/uploads/products/script.js",
        "/static/images/logo.png",
        "\\uploads\\products\\img.jpg",
        "/uploads/test\0file.png",
      ];
      for (const ref of badPaths) {
        const res = validateImageReference(ref);
        expect(res.isValid).toBe(false);
      }
    });

    test("Explicitly rejects SVG files in both local paths and remote URLs to eliminate stored-XSS risk", () => {
      const svgCases = [
        "/uploads/malicious.svg",
        "/uploads/products/vector.svg",
        "https://cdn.example.com/exploit.svg",
        "https://images.unsplash.com/payload.svg?token=123",
        "https://attacker.site/image.SVG#anchor",
      ];
      for (const ref of svgCases) {
        const res = validateImageReference(ref);
        expect(res.isValid).toBe(false);
        expect(res.reason.toLowerCase()).toContain("svg");
      }
    });

    test("Accepts approved raster image formats including JPEG, PNG, WEBP, GIF, and AVIF", () => {
      const approvedCases = [
        "/uploads/products/image1.jpg",
        "/uploads/products/image2.jpeg",
        "/uploads/products/image3.png",
        "/uploads/products/image4.webp",
        "/uploads/products/image5.gif",
        "/uploads/products/image6.avif",
        "https://images.unsplash.com/photo-item.avif",
      ];
      for (const ref of approvedCases) {
        const res = validateImageReference(ref);
        expect(res.isValid).toBe(true);
      }
    });

    test("Product image upload endpoint rejects SVG files with 400 INVALID_IMAGE_TYPE", async () => {
      const adminToken = generateAccessToken({
        sub: adminUser._id.toString(),
        role: adminUser.role,
        authVersion: adminUser.authVersion,
        permissionVersion: adminUser.permissionVersion,
      });

      const maliciousSvg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
      const res = await request(app)
        .post("/api/v1/products/images/upload")
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("image", Buffer.from(maliciousSvg), "exploit.svg");

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe("INVALID_IMAGE_TYPE");
      expect(res.body.message).toContain("Allowed formats: JPEG, PNG, WEBP, GIF, AVIF");
    });

    test("Static /uploads/ serving sets X-Content-Type-Options: nosniff and sandboxes SVG files", async () => {
      const uploadsDir = path.resolve(__dirname, "../public/uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const testSvgName = `test_security_${Date.now()}.svg`;
      const testSvgPath = path.join(uploadsDir, testSvgName);
      fs.writeFileSync(testSvgPath, '<svg xmlns="http://www.w3.org/2000/svg"><text>Hello</text></svg>');

      try {
        const res = await request(app).get(`/uploads/${testSvgName}`);
        expect(res.statusCode).toBe(200);
        expect(res.headers["x-content-type-options"]).toBe("nosniff");
        expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
        expect(res.headers["content-security-policy"]).toContain("sandbox");
        expect(res.headers["content-disposition"]).toBe("attachment");
      } finally {
        if (fs.existsSync(testSvgPath)) {
          fs.unlinkSync(testSvgPath);
        }
      }
    });

    test("validateBulkImport produces actionable row-level error for invalid images and marks row ERROR", async () => {
      const row = makeRow({
        sku: "SEC-ERR-001",
        image1: "javascript:evil()",
        image2: "https://images.unsplash.com/photo-valid",
      });
      const buffer = makeBuffer([row]);
      const report = await bulkImportExportService.validateBulkImport({
        buffer,
        vendorId: vendorA._id.toString(),
      });

      expect(report.errorRowsCount).toBe(1);
      expect(report.validRowsCount).toBe(0);
      const imgErr = report.errorDetails.find((e) => e.field === "Image 1");
      expect(imgErr).toBeDefined();
      expect(imgErr.rowNumber).toBe(2);
      expect(imgErr.error).toContain("javascript");
      expect(imgErr.suggestedAction).toBeDefined();
    });
  });

  describe("Fix B & Fix C: Simple Product Image Import, Sequential sortOrder & Explicit Semantics", () => {
    test("Simple-product import with 1, 2, 3, and 4 images assigns sequential persisted sortOrder", async () => {
      // 1-image product
      const row1 = makeRow({
        name: "Speaker 1-Image",
        sku: "SPK-IMG-1",
        image1: "https://images.unsplash.com/photo-img1",
      });
      // 2-image product
      const row2 = makeRow({
        name: "Speaker 2-Images",
        sku: "SPK-IMG-2",
        image1: "https://images.unsplash.com/photo-img1",
        image2: "https://images.unsplash.com/photo-img2",
      });
      // 3-image product
      const row3 = makeRow({
        name: "Speaker 3-Images",
        sku: "SPK-IMG-3",
        image1: "https://images.unsplash.com/photo-img1",
        image2: "https://images.unsplash.com/photo-img2",
        image3: "https://images.unsplash.com/photo-img3",
      });
      // 4-image product
      const row4 = makeRow({
        name: "Speaker 4-Images",
        sku: "SPK-IMG-4",
        image1: "https://images.unsplash.com/photo-img1",
        image2: "https://images.unsplash.com/photo-img2",
        image3: "https://images.unsplash.com/photo-img3",
        image4: "/uploads/products/local-img4.png",
      });

      const buffer = makeBuffer([row1, row2, row3, row4]);
      const report = await bulkImportExportService.validateBulkImport({
        buffer,
        vendorId: vendorA._id.toString(),
      });
      expect(report.validRowsCount).toBe(4);

      await bulkImportExportService.commitBulkImport({
        rows: report.rows,
        vendorId: vendorA._id.toString(),
        actor: vendorActorA,
      });

      const p1 = await Product.findOne({ sku: "SPK-IMG-1" });
      expect(p1.images.length).toBe(1);
      expect(p1.images[0].sortOrder).toBe(0);
      expect(p1.images[0].url).toBe("https://images.unsplash.com/photo-img1");

      const p4 = await Product.findOne({ sku: "SPK-IMG-4" });
      expect(p4.images.length).toBe(4);
      expect(p4.images[0].sortOrder).toBe(0);
      expect(p4.images[1].sortOrder).toBe(1);
      expect(p4.images[2].sortOrder).toBe(2);
      expect(p4.images[3].sortOrder).toBe(3);
      expect(p4.images[3].url).toBe("/uploads/products/local-img4.png");

      // Verify no unsupported order or isPrimary properties on mongoose doc
      const rawP4 = p4.toObject();
      expect(rawP4.images[0].isPrimary).toBeUndefined();
      expect(rawP4.images[0].order).toBeUndefined();
    });

    test("Canonical primary image is images[0] and synchronizes to simple product default variant", async () => {
      const p = await Product.findOne({ sku: "SPK-IMG-4" });
      const variant = await ProductVariant.findOne({ productId: p._id, isDefault: true });

      expect(variant).toBeDefined();
      expect(variant.image).toBeDefined();
      expect(variant.image.url).toBe(p.images[0].url);
    });

    test("Legacy file with image columns absent preserves existing images during update", async () => {
      // Create headers WITHOUT image columns (34 columns)
      const legacyHeaders = bulkImportExportService.TEMPLATE_HEADERS.filter(
        (h) => !["Image 1", "Image 2", "Image 3", "Image 4"].includes(h)
      );
      expect(legacyHeaders.length).toBe(34);

      const legacyRow = [
        "Speaker 4-Images", // name
        "SPK-IMG-4",        // parentSku
        "SPK-IMG-4",        // sku
        "simple",           // type
        category.name,      // category
        brand.name,         // brand
        1299.0,             // price updated from 1499 to 1299
        1999.0,             // compareAtPrice
        800.0,              // costPrice
        50,                 // stock updated from 25 to 50
        warehouse.code,     // warehouse
        5,                  // lowStock
        "", "", "", "", "", "", "", "", // attrs
        "standard", true, 0.8, "15x10x10", "standard",
        "Short desc", "Long desc",
        "tags", "title", "desc", "keywords",
        false, false, "draft",
      ];

      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.aoa_to_sheet([legacyHeaders, legacyRow]);
      xlsx.utils.book_append_sheet(wb, ws, "Products");
      const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      const report = await bulkImportExportService.validateBulkImport({
        buffer,
        vendorId: vendorA._id.toString(),
      });
      expect(report.validRowsCount).toBe(1);

      await bulkImportExportService.commitBulkImport({
        rows: report.rows,
        vendorId: vendorA._id.toString(),
        actor: vendorActorA,
      });

      const updatedP4 = await Product.findOne({ sku: "SPK-IMG-4" });
      expect(Number(updatedP4.price.toString())).toBe(1299.0);
      // Existing 4 images must be completely preserved
      expect(updatedP4.images.length).toBe(4);
      expect(updatedP4.images[0].url).toBe("https://images.unsplash.com/photo-img1");

      const updatedV4 = await ProductVariant.findOne({ productId: updatedP4._id, isDefault: true });
      expect(updatedV4.image.url).toBe("https://images.unsplash.com/photo-img1");
    });

    test("Blank image cells do not silently erase existing images during product update", async () => {
      // Import update with all 4 image columns present but blank
      const row = makeRow({
        name: "Speaker 4-Images",
        sku: "SPK-IMG-4",
        price: 1199.0,
        image1: "",
        image2: "",
        image3: "",
        image4: "",
      });
      const buffer = makeBuffer([row]);
      const report = await bulkImportExportService.validateBulkImport({
        buffer,
        vendorId: vendorA._id.toString(),
      });
      expect(report.validRowsCount).toBe(1);

      await bulkImportExportService.commitBulkImport({
        rows: report.rows,
        vendorId: vendorA._id.toString(),
        actor: vendorActorA,
      });

      const p4 = await Product.findOne({ sku: "SPK-IMG-4" });
      expect(Number(p4.price.toString())).toBe(1199.0);
      // Images must NOT be cleared!
      expect(p4.images.length).toBe(4);
      expect(p4.images[0].url).toBe("https://images.unsplash.com/photo-img1");
    });

    test("Valid image changes update existing products and synchronize default variant", async () => {
      const newUrl1 = "https://images.unsplash.com/photo-new-primary";
      const newUrl2 = "https://images.unsplash.com/photo-new-secondary";

      const row = makeRow({
        name: "Speaker 4-Images",
        sku: "SPK-IMG-4",
        image1: newUrl1,
        image2: newUrl2,
        image3: "",
        image4: "",
      });
      const buffer = makeBuffer([row]);
      const report = await bulkImportExportService.validateBulkImport({
        buffer,
        vendorId: vendorA._id.toString(),
      });
      expect(report.validRowsCount).toBe(1);

      await bulkImportExportService.commitBulkImport({
        rows: report.rows,
        vendorId: vendorA._id.toString(),
        actor: vendorActorA,
      });

      const p4 = await Product.findOne({ sku: "SPK-IMG-4" });
      expect(p4.images.length).toBe(2);
      expect(p4.images[0].url).toBe(newUrl1);
      expect(p4.images[0].sortOrder).toBe(0);
      expect(p4.images[1].url).toBe(newUrl2);
      expect(p4.images[1].sortOrder).toBe(1);

      const v4 = await ProductVariant.findOne({ productId: p4._id, isDefault: true });
      expect(v4.image.url).toBe(newUrl1);
    });

    test("UPDATE_ONLY and CREATE_ONLY modes enforce their contracts on images and SKUs", async () => {
      // 1. UPDATE_ONLY on nonexistent SKU fails
      const nonExistentRow = makeRow({ sku: "NON-EXIST-999" });
      const reportUpdate = await bulkImportExportService.validateBulkImport({
        buffer: makeBuffer([nonExistentRow]),
        mode: "UPDATE_ONLY",
        vendorId: vendorA._id.toString(),
      });
      expect(reportUpdate.errorRowsCount).toBe(1);
      expect(reportUpdate.errorDetails[0].error).toContain("UPDATE_ONLY");

      // 2. CREATE_ONLY on existing SKU fails
      const existingRow = makeRow({ sku: "SPK-IMG-4" });
      const reportCreate = await bulkImportExportService.validateBulkImport({
        buffer: makeBuffer([existingRow]),
        mode: "CREATE_ONLY",
        vendorId: vendorA._id.toString(),
      });
      expect(reportCreate.errorRowsCount).toBe(1);
      expect(reportCreate.errorDetails[0].error).toContain("CREATE_ONLY");
    });

    test("CREATE_AND_UPDATE mode permits simultaneous creation and updating in the same batch", async () => {
      const newRow = makeRow({
        name: "Brand New Subwoofer",
        sku: "SUB-NEW-001",
        image1: "https://images.unsplash.com/photo-subwoofer-new",
      });
      const updateRow = makeRow({
        name: "Speaker 4-Images Renamed",
        sku: "SPK-IMG-4",
        image1: "https://images.unsplash.com/photo-spk4-updated",
      });

      const buffer = makeBuffer([newRow, updateRow]);
      const report = await bulkImportExportService.validateBulkImport({
        buffer,
        mode: "CREATE_AND_UPDATE",
        vendorId: vendorA._id.toString(),
      });

      expect(report.validRowsCount).toBe(2);
      expect(report.newProductsCount).toBe(1);
      expect(report.updateCount).toBe(1);

      await bulkImportExportService.commitBulkImport({
        rows: report.rows,
        vendorId: vendorA._id.toString(),
        actor: vendorActorA,
      });

      const newProduct = await Product.findOne({ sku: "SUB-NEW-001" });
      expect(newProduct).toBeDefined();
      expect(newProduct.images[0].url).toBe("https://images.unsplash.com/photo-subwoofer-new");

      const updatedProduct = await Product.findOne({ sku: "SPK-IMG-4" });
      expect(updatedProduct.name).toBe("Speaker 4-Images Renamed");
      expect(updatedProduct.images[0].url).toBe("https://images.unsplash.com/photo-spk4-updated");
    });

    test("Invalid image references cause no partial image mutation on the target product", async () => {
      const initialProduct = await Product.findOne({ sku: "SPK-IMG-4" });
      const initialImages = initialProduct.images.map((img) => img.url);

      const invalidRow = makeRow({
        name: "Speaker 4-Images Attempted Mutation",
        sku: "SPK-IMG-4",
        price: 2999.0,
        image1: "https://images.unsplash.com/valid-image-1",
        image2: "javascript:corruptGallery()", // Dangerous scheme should abort whole row
      });

      const buffer = makeBuffer([invalidRow]);
      const report = await bulkImportExportService.validateBulkImport({
        buffer,
        vendorId: vendorA._id.toString(),
      });

      expect(report.errorRowsCount).toBe(1);
      expect(report.validRowsCount).toBe(0);

      // Attempting commit with rejected row throws or does not commit
      await expect(
        bulkImportExportService.commitBulkImport({
          rows: report.rows,
          vendorId: vendorA._id.toString(),
          actor: vendorActorA,
        })
      ).rejects.toThrow();

      // Verify product images in database are completely unchanged
      const freshProduct = await Product.findOne({ sku: "SPK-IMG-4" });
      const freshImages = freshProduct.images.map((img) => img.url);
      expect(freshImages).toEqual(initialImages);
    });
  });

  describe("Fix D: Variable-Product Image Separation & Variant Row Validation", () => {
    test("Parent gallery is populated from parent row, while variant rows populate their own singular image", async () => {
      const parentRow = makeRow({
        name: "Wireless Headphone Pro",
        parentSku: "HP-PRO",
        sku: "HP-PRO-BLK",
        productType: "variable",
        color: "Black",
        image1: "https://images.unsplash.com/photo-hp-parent-1",
        image2: "https://images.unsplash.com/photo-hp-parent-2",
        image3: "https://images.unsplash.com/photo-hp-parent-3",
        image4: "",
      });

      const variantRow2 = makeRow({
        name: "Wireless Headphone Pro",
        parentSku: "HP-PRO",
        sku: "HP-PRO-WHT",
        productType: "variable",
        color: "White",
        image1: "https://images.unsplash.com/photo-hp-variant-white",
        image2: "",
        image3: "",
        image4: "",
      });

      const buffer = makeBuffer([parentRow, variantRow2]);
      const report = await bulkImportExportService.validateBulkImport({
        buffer,
        vendorId: vendorA._id.toString(),
      });

      expect(report.validRowsCount).toBe(2);
      expect(report.errorRowsCount).toBe(0);

      await bulkImportExportService.commitBulkImport({
        rows: report.rows,
        vendorId: vendorA._id.toString(),
        actor: vendorActorA,
      });

      const parent = await Product.findOne({ sku: "HP-PRO" });
      expect(parent).toBeDefined();
      expect(parent.images.length).toBe(3);
      expect(parent.images[0].url).toBe("https://images.unsplash.com/photo-hp-parent-1");
      expect(parent.images[1].url).toBe("https://images.unsplash.com/photo-hp-parent-2");
      expect(parent.images[2].url).toBe("https://images.unsplash.com/photo-hp-parent-3");

      const vBlack = await ProductVariant.findOne({ sku: "HP-PRO-BLK" });
      expect(vBlack.image.url).toBe("https://images.unsplash.com/photo-hp-parent-1");

      const vWhite = await ProductVariant.findOne({ sku: "HP-PRO-WHT" });
      expect(vWhite.image.url).toBe("https://images.unsplash.com/photo-hp-variant-white");
    });

    test("Populating Image 2-4 on subsequent variant rows is rejected with clear error details", async () => {
      const parentRow = makeRow({
        name: "Wireless Earbuds",
        parentSku: "EAR-BUD",
        sku: "EAR-BUD-RED",
        productType: "variable",
        color: "Red",
        image1: "https://images.unsplash.com/photo-parent",
      });

      const variantRowBad = makeRow({
        name: "Wireless Earbuds",
        parentSku: "EAR-BUD",
        sku: "EAR-BUD-BLU",
        productType: "variable",
        color: "Blue",
        image1: "https://images.unsplash.com/photo-variant-blue",
        image2: "https://images.unsplash.com/photo-variant-blue-extra", // Disallowed on subsequent variant row
      });

      const buffer = makeBuffer([parentRow, variantRowBad]);
      const report = await bulkImportExportService.validateBulkImport({
        buffer,
        vendorId: vendorA._id.toString(),
      });

      expect(report.validRowsCount).toBe(1);
      expect(report.errorRowsCount).toBe(1);

      const err2 = report.errorDetails.find((e) => e.field === "Image 2");
      expect(err2).toBeDefined();
      expect(err2.rowNumber).toBe(3); // 2nd data row (1-indexed row 3 in sheet)
      expect(err2.error).toContain("Variant rows do not accept secondary gallery images");
      expect(err2.suggestedAction).toBeDefined();
    });

    test("Updating a single variant's image does not alter the parent gallery or other variants", async () => {
      const updateRow = makeRow({
        name: "Wireless Headphone Pro",
        parentSku: "HP-PRO",
        sku: "HP-PRO-WHT",
        color: "White",
        image1: "https://images.unsplash.com/photo-hp-variant-white-v2",
        image2: "",
        image3: "",
        image4: "",
      });

      const buffer = makeBuffer([updateRow]);
      const report = await bulkImportExportService.validateBulkImport({
        buffer,
        vendorId: vendorA._id.toString(),
      });
      expect(report.validRowsCount).toBe(1);

      await bulkImportExportService.commitBulkImport({
        rows: report.rows,
        vendorId: vendorA._id.toString(),
        actor: vendorActorA,
      });

      const vWhite = await ProductVariant.findOne({ sku: "HP-PRO-WHT" });
      expect(vWhite.image.url).toBe("https://images.unsplash.com/photo-hp-variant-white-v2");

      const vBlack = await ProductVariant.findOne({ sku: "HP-PRO-BLK" });
      expect(vBlack.image.url).toBe("https://images.unsplash.com/photo-hp-parent-1");

      const parent = await Product.findOne({ sku: "HP-PRO" });
      expect(parent.images.length).toBe(3);
      expect(parent.images[0].url).toBe("https://images.unsplash.com/photo-hp-parent-1");
    });
  });

  describe("Fix F: Export/Import Fidelity & Template Round-Trip", () => {
    test("exportVendorProducts exports parent gallery on row 0 and singular variant image on subsequent rows", async () => {
      const exportRes = await bulkImportExportService.exportVendorProducts({
        vendorId: vendorA._id.toString(),
        format: "xlsx",
        filters: { templateCompatible: true },
        actor: vendorActorA,
      });

      expect(exportRes.buffer).toBeDefined();
      expect(exportRes.filename).toContain(".xlsx");

      const wb = xlsx.read(exportRes.buffer, { type: "buffer" });
      const sheet = wb.Sheets["Products"];
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

      const headers = rows[0];
      expect(headers.length).toBe(38);
      expect(headers).toEqual(bulkImportExportService.TEMPLATE_HEADERS);

      const idxImg1 = headers.indexOf("Image 1");
      const idxImg2 = headers.indexOf("Image 2");
      const idxImg3 = headers.indexOf("Image 3");
      const idxImg4 = headers.indexOf("Image 4");
      const idxParentSku = headers.indexOf("Parent SKU");
      const idxSku = headers.indexOf("Variant SKU");

      // Find Headphone Pro rows
      const hpRows = rows.slice(1).filter((r) => r[idxParentSku] === "HP-PRO");
      expect(hpRows.length).toBe(2);

      // Row 0 of HP-PRO (first variant row) must have parent gallery images
      const row0 = hpRows[0];
      expect(row0[idxImg1]).toBe("https://images.unsplash.com/photo-hp-parent-1");
      expect(row0[idxImg2]).toBe("https://images.unsplash.com/photo-hp-parent-2");
      expect(row0[idxImg3]).toBe("https://images.unsplash.com/photo-hp-parent-3");
      expect(row0[idxImg4]).toBe("");

      // Row 1 of HP-PRO (second variant row) must have ONLY its own singular image in Image 1, and Image 2-4 empty!
      const row1 = hpRows[1];
      expect(row1[idxImg1]).toBe("https://images.unsplash.com/photo-hp-variant-white-v2");
      expect(row1[idxImg2]).toBe("");
      expect(row1[idxImg3]).toBe("");
      expect(row1[idxImg4]).toBe("");
    });

    test("Exported XLSX file round-trips through validateBulkImport without validation errors", async () => {
      const exportRes = await bulkImportExportService.exportVendorProducts({
        vendorId: vendorA._id.toString(),
        format: "xlsx",
        filters: { templateCompatible: true },
        actor: vendorActorA,
      });

      const report = await bulkImportExportService.validateBulkImport({
        buffer: exportRes.buffer,
        vendorId: vendorA._id.toString(),
      });

      expect(report.errorRowsCount).toBe(0);
      expect(report.validRowsCount).toBeGreaterThan(0);
      expect(report.errorDetails.length).toBe(0);
    });

    test("CSV and XLSX exports produce equivalent headers and image column data", async () => {
      const xlsxRes = await bulkImportExportService.exportVendorProducts({
        vendorId: vendorA._id.toString(),
        format: "xlsx",
        filters: { templateCompatible: true },
        actor: vendorActorA,
      });

      const csvRes = await bulkImportExportService.exportVendorProducts({
        vendorId: vendorA._id.toString(),
        format: "csv",
        filters: { templateCompatible: true },
        actor: vendorActorA,
      });

      const wbXlsx = xlsx.read(xlsxRes.buffer, { type: "buffer" });
      const rowsXlsx = xlsx.utils.sheet_to_json(wbXlsx.Sheets["Products"], { header: 1 });

      const wbCsv = xlsx.read(csvRes.buffer, { type: "buffer" });
      const rowsCsv = xlsx.utils.sheet_to_json(wbCsv.Sheets["Sheet1"] || wbCsv.Sheets[wbCsv.SheetNames[0]], { header: 1 });

      expect(rowsCsv.length).toBe(rowsXlsx.length);
      expect(rowsCsv[0]).toEqual(rowsXlsx[0]);

      const idxImg1 = rowsXlsx[0].indexOf("Image 1");
      const idxImg2 = rowsXlsx[0].indexOf("Image 2");

      for (let i = 1; i < rowsXlsx.length; i++) {
        expect(String(rowsCsv[i][idxImg1] || "")).toBe(String(rowsXlsx[i][idxImg1] || ""));
        expect(String(rowsCsv[i][idxImg2] || "")).toBe(String(rowsXlsx[i][idxImg2] || ""));
      }
    });
  });

  describe("Vendor Tenant Isolation & Cross-Vendor Protection", () => {
    test("Vendor B cannot mutate or overwrite images of Vendor A's products via bulk import", async () => {
      const hijackRow = makeRow({
        name: "Hijacked Speaker",
        sku: "SPK-IMG-4", // Belongs to Vendor A
        image1: "https://images.unsplash.com/photo-vendor-b-hijack",
      });

      const buffer = makeBuffer([hijackRow]);
      const report = await bulkImportExportService.validateBulkImport({
        buffer,
        vendorId: vendorB._id.toString(),
      });

      expect(report.errorRowsCount).toBe(1);
      const skuErr = report.errorDetails.find((e) => e.field === "SKU");
      expect(skuErr).toBeDefined();
      expect(skuErr.error).toContain("Cross-vendor SKU collision");

      // Verify Vendor A's product image was untouched
      const p = await Product.findOne({ sku: "SPK-IMG-4" });
      expect(p.vendorId.toString()).toBe(vendorA._id.toString());
      expect(p.images[0].url).not.toBe("https://images.unsplash.com/photo-vendor-b-hijack");
    });
  });

  describe("Template Structural Contract & Idempotency", () => {
    test("Canonical template retained exactly 38 columns in the exact prescribed order", () => {
      expect(bulkImportExportService.TEMPLATE_HEADERS.length).toBe(38);
      expect(bulkImportExportService.TEMPLATE_HEADERS[27]).toBe("Image 1");
      expect(bulkImportExportService.TEMPLATE_HEADERS[28]).toBe("Image 2");
      expect(bulkImportExportService.TEMPLATE_HEADERS[29]).toBe("Image 3");
      expect(bulkImportExportService.TEMPLATE_HEADERS[30]).toBe("Image 4");
    });

    test("Repeated imports do not create duplicate products or variants or corrupt image state", async () => {
      const initialProductCount = await Product.countDocuments({ deletedAt: null });
      const initialVariantCount = await ProductVariant.countDocuments({ deletedAt: null });

      const row = makeRow({
        name: "Speaker 4-Images",
        sku: "SPK-IMG-4",
      });
      const buffer = makeBuffer([row]);

      // Re-import existing product
      const report = await bulkImportExportService.validateBulkImport({
        buffer,
        vendorId: vendorA._id.toString(),
      });
      expect(report.validRowsCount).toBe(1);

      await bulkImportExportService.commitBulkImport({
        rows: report.rows,
        vendorId: vendorA._id.toString(),
        actor: vendorActorA,
      });

      const finalProductCount = await Product.countDocuments({ deletedAt: null });
      const finalVariantCount = await ProductVariant.countDocuments({ deletedAt: null });

      expect(finalProductCount).toBe(initialProductCount);
      expect(finalVariantCount).toBe(initialVariantCount);
    });
  });
});
