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
const { ROLES } = require("../src/constants/auth.constants");
const request = require("supertest");
const app = require("../src/app");
const { generateAccessToken } = require("../src/services/token.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_phase2h_align_test?")
  : "mongodb://127.0.0.1:27017/buybox_phase2h_align_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Buybox Phase 2H — Bulk Import Template Alignment & Multi-Warehouse Round-Trip Suite", () => {
  let adminUser, vendorUserA, vendorUserB;
  let adminActor, vendorActorA, vendorActorB;
  let vendorA, vendorB;
  let platformCategory, platformBrand;
  let warehouseMum, warehouseDel;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }
    await SkuRegistry.syncIndexes();
    await Product.syncIndexes();
    await ProductVariant.syncIndexes();

    // Clean previous test state
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

    // Seed test users
    adminUser = await User.create({
      firstName: "Global",
      lastName: "Admin",
      email: "bulk.admin@buybox.test",
      password: "HashedPassword123!",
      role: ROLES.ADMIN,
      isEmailVerified: true,
      isActive: true,
    });
    adminActor = { id: adminUser._id.toString(), role: ROLES.ADMIN, email: adminUser.email };

    vendorUserA = await User.create({
      firstName: "Vendor",
      lastName: "Alpha",
      email: "vendor.alpha@buybox.test",
      password: "HashedPassword123!",
      role: ROLES.VENDOR,
      isEmailVerified: true,
      isActive: true,
    });
    vendorA = await Vendor.create({
      userId: vendorUserA._id,
      businessName: "Alpha Retailers",
      businessSlug: "alpha-retailers",
      isActive: true,
      onboardingStatus: "approved",
    });
    vendorActorA = { id: vendorUserA._id.toString(), role: ROLES.VENDOR, email: vendorUserA.email };

    vendorUserB = await User.create({
      firstName: "Vendor",
      lastName: "Beta",
      email: "vendor.beta@buybox.test",
      password: "HashedPassword123!",
      role: ROLES.VENDOR,
      isEmailVerified: true,
      isActive: true,
    });
    vendorB = await Vendor.create({
      userId: vendorUserB._id,
      businessName: "Beta Solutions",
      businessSlug: "beta-solutions",
      isActive: true,
      onboardingStatus: "approved",
    });
    vendorActorB = { id: vendorUserB._id.toString(), role: ROLES.VENDOR, email: vendorUserB.email };

    // Seed platform taxonomy
    platformCategory = await Category.create({
      name: "Electronics",
      slug: "electronics",
      isActive: true,
    });

    platformBrand = await Brand.create({
      name: "AuraVue",
      slug: "auravue",
      isActive: true,
    });

    // Seed multi-warehouses
    warehouseMum = await Warehouse.create({
      name: "Mumbai Central Hub",
      code: "WH-MUM-01",
      address: {
        addressLine1: "Bandra Kurla Complex",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400051",
        country: "IN",
      },
      isActive: true,
      isDefault: true,
    });

    warehouseDel = await Warehouse.create({
      name: "Delhi North Hub",
      code: "WH-DEL-01",
      address: {
        addressLine1: "Okhla Industrial Area",
        city: "New Delhi",
        state: "Delhi",
        postalCode: "110020",
        country: "IN",
      },
      isActive: true,
      isDefault: false,
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

  // =========================================================================
  // 1. Template Structure & Headers Tests
  // =========================================================================
  describe("A. Template Generation & Contract Alignment", () => {
    test("CSV template generation returns all 38 canonical headers and valid sample rows", () => {
      const { buffer, filename, contentType } = bulkImportExportService.generateImportTemplate("csv");
      expect(filename).toBe("buybox_product_import_template.csv");
      expect(contentType).toContain("text/csv");

      const wb = xlsx.read(buffer, { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

      const headers = rows[0];
      expect(headers.length).toBe(38);
      expect(headers).toEqual(
        expect.arrayContaining([
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
        ])
      );

      // Verify every sample row has 38 elements
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].length).toBe(38);
      }
    });

    test("XLSX template contains Products, Column_Instructions, and Reference_Guide sheets", () => {
      const { buffer, filename, contentType } = bulkImportExportService.generateImportTemplate("xlsx");
      expect(filename).toBe("buybox_product_import_template.xlsx");
      expect(contentType).toContain("openxmlformats");

      const wb = xlsx.read(buffer, { type: "buffer" });
      expect(wb.SheetNames).toEqual(["Products", "Column_Instructions", "Reference_Guide"]);

      const instructions = xlsx.utils.sheet_to_json(wb.Sheets["Column_Instructions"], { header: 1 });
      expect(instructions.length).toBeGreaterThan(35); // All 38 columns documented

      const reference = xlsx.utils.sheet_to_json(wb.Sheets["Reference_Guide"], { header: 1 });
      expect(reference.length).toBeGreaterThan(15);
    });

    test("XLSX binary ZIP archive integrity verifies PK magic bytes and internal OpenXML parts", () => {
      const { buffer } = bulkImportExportService.generateImportTemplate("xlsx");
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(10000);

      // Verify ZIP magic bytes 0x50, 0x4B, 0x03, 0x04 ("PK\x03\x04")
      expect(buffer[0]).toBe(0x50);
      expect(buffer[1]).toBe(0x4b);
      expect(buffer[2]).toBe(0x03);
      expect(buffer[3]).toBe(0x04);

      // Verify required OpenXML package file entries
      const entries = [];
      let offset = 0;
      while (offset < buffer.length - 4) {
        if (buffer.readUInt32LE(offset) === 0x04034b50) {
          const nameLen = buffer.readUInt16LE(offset + 26);
          const extraLen = buffer.readUInt16LE(offset + 28);
          const name = buffer.toString("utf8", offset + 30, offset + 30 + nameLen);
          entries.push(name);
          offset += 30 + nameLen + extraLen;
        } else {
          offset++;
        }
      }

      expect(entries).toContain("[Content_Types].xml");
      expect(entries).toContain("xl/workbook.xml");
      expect(entries).toContain("xl/styles.xml");
      expect(entries).toContain("xl/worksheets/sheet1.xml");
      expect(entries).toContain("xl/worksheets/sheet2.xml");
      expect(entries).toContain("xl/worksheets/sheet3.xml");
    });

    test("GET /api/v1/products/vendor/import/template returns genuine binary XLSX bytes with correct headers", async () => {
      const vendorToken = generateAccessToken({
        sub: vendorUserA._id.toString(),
        role: ROLES.VENDOR,
      });

      const res = await request(app)
        .get("/api/v1/products/vendor/import/template?format=xlsx")
        .set("Authorization", `Bearer ${vendorToken}`)
        .buffer(true)
        .parse((res, callback) => {
          res.setEncoding("binary");
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            callback(null, Buffer.from(data, "binary"));
          });
        });

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(res.headers["content-disposition"]).toBe('attachment; filename="buybox_product_import_template.xlsx"');
      expect(Number(res.headers["content-length"])).toBeGreaterThan(10000);
      expect(res.headers["cache-control"]).toContain("no-cache");

      // Verify binary buffer
      const buffer = res.body;
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer[0]).toBe(0x50);
      expect(buffer[1]).toBe(0x4b);

      // Verify parseability by XLSX
      const wb = xlsx.read(buffer, { type: "buffer" });
      expect(wb.SheetNames).toEqual(["Products", "Column_Instructions", "Reference_Guide"]);
      const prodSheet = xlsx.utils.sheet_to_json(wb.Sheets["Products"], { header: 1 });
      expect(prodSheet[0].length).toBe(38);
    });

    test("GET /api/v1/products/vendor/import/template?format=excel supports excel alias", async () => {
      const vendorToken = generateAccessToken({
        sub: vendorUserA._id.toString(),
        role: ROLES.VENDOR,
      });

      const res = await request(app)
        .get("/api/v1/products/vendor/import/template?format=excel")
        .set("Authorization", `Bearer ${vendorToken}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(res.headers["content-disposition"]).toContain("buybox_product_import_template.xlsx");
    });

    test("GET /api/v1/products/vendor/import/template?format=csv returns valid UTF-8 CSV with all 38 headers", async () => {
      const vendorToken = generateAccessToken({
        sub: vendorUserA._id.toString(),
        role: ROLES.VENDOR,
      });

      const res = await request(app)
        .get("/api/v1/products/vendor/import/template?format=csv")
        .set("Authorization", `Bearer ${vendorToken}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.headers["content-disposition"]).toBe('attachment; filename="buybox_product_import_template.csv"');

      const text = res.text;
      const firstLine = text.split("\n")[0];
      const headers = firstLine.split(",").map((h) => h.replace(/^\uFEFF/, "").trim());
      expect(headers.length).toBe(38);
      expect(headers[0]).toBe("Product Name");
    });

    test("Unauthorized request to template endpoint returns 401 JSON and is NOT sent as workbook", async () => {
      const res = await request(app)
        .get("/api/v1/products/vendor/import/template?format=xlsx");

      expect(res.status).toBe(401);
      expect(res.headers["content-type"]).toContain("application/json");
      expect(res.body.success).toBe(false);
      expect(res.headers["content-disposition"]).toBeUndefined();
    });
  });

  // =========================================================================
  // 2. Simple Product Validation & Canonical Default Variant Persistence
  // =========================================================================
  describe("B. Simple Product Import & Canonical Default Variant Architecture", () => {
    test("Successfully validates and imports a complete simple product with all supported attributes", async () => {
      const wsData = [
        bulkImportExportService.TEMPLATE_HEADERS,
        [
          "Acoustic Pro Wireless Earbuds",
          "EARBUD-PRO-001",
          "EARBUD-PRO-001",
          "simple",
          "Electronics",
          "AuraVue",
          2999.0,
          3999.0,
          1500.0,
          120,
          "WH-MUM-01",
          10,
          "Matte Black",
          "One Size",
          "ABS Plastic",
          "8901234567890",
          "",
          "",
          "",
          "",
          "standard",
          "true",
          0.15,
          "10x8x4",
          "standard",
          "True wireless earbuds with active noise cancelling.",
          "High fidelity sound with 30-hour total battery life and IPX5 water resistance.",
          "https://example.com/earbuds-main.jpg",
          "https://example.com/earbuds-case.jpg",
          "",
          "",
          "audio,earbuds,wireless,anc",
          "Acoustic Pro Wireless ANC Earbuds",
          "Buy Acoustic Pro Wireless Earbuds online at best price.",
          "earbuds,anc,audio",
          "false",
          "false",
          "draft",
        ],
      ];

      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.aoa_to_sheet(wsData);
      xlsx.utils.book_append_sheet(wb, ws, "Products");
      const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      const preview = await bulkImportExportService.validateBulkImport({
        buffer,
        vendorId: vendorA._id.toString(),
        mode: "CREATE_AND_UPDATE",
      });

      expect(preview.validRowsCount).toBe(1);
      expect(preview.errorRowsCount).toBe(0);
      expect(preview.rows[0].status).toBe("VALID");
      expect(preview.rows[0].barcode).toBe("8901234567890");
      expect(preview.rows[0].shortDescription).toBe("True wireless earbuds with active noise cancelling.");

      const commit = await bulkImportExportService.commitBulkImport({
        rows: preview.rows,
        vendorId: vendorA._id.toString(),
        actor: vendorActorA,
      });

      expect(commit.createdProductsCount).toBe(1);
      expect(commit.createdVariantsCount).toBe(1);

      // Verify Product and ProductVariant in MongoDB
      const savedProduct = await Product.findOne({ sku: "EARBUD-PRO-001" });
      expect(savedProduct).not.toBeNull();
      expect(savedProduct.productType).toBe("simple");
      expect(savedProduct.shortDescription).toBe("True wireless earbuds with active noise cancelling.");
      expect(savedProduct.defaultVariantId).not.toBeNull();
      expect(savedProduct.shippingClass).toBe("standard");
      expect(savedProduct.isTaxable).toBe(true);
      expect(savedProduct.images.length).toBe(2);
      expect(savedProduct.seo.title).toBe("Acoustic Pro Wireless ANC Earbuds");

      const savedVariant = await ProductVariant.findById(savedProduct.defaultVariantId);
      expect(savedVariant).not.toBeNull();
      expect(savedVariant.isDefault).toBe(true);
      expect(savedVariant.sku).toBe("EARBUD-PRO-001");
      expect(savedVariant.barcode).toBe("8901234567890");
      expect(savedVariant.attributes.get("color")).toBe("Matte Black");

      // Verify SkuRegistry reservation
      const prdRegistry = await SkuRegistry.findOne({ sku: "EARBUD-PRO-001" });
      expect(prdRegistry).not.toBeNull();
      expect(prdRegistry.productId.toString()).toBe(savedProduct._id.toString());
      expect(prdRegistry.isDefault).toBe(true);
      expect(prdRegistry.variantId.toString()).toBe(savedVariant._id.toString());

      // Verify Authoritative Inventory allocation at WH-MUM-01
      const inv = await Inventory.findOne({
        productVariantId: savedVariant._id,
        warehouseId: warehouseMum._id,
      });
      expect(inv).not.toBeNull();
      expect(inv.onHand).toBe(120);
      expect(inv.lowStockThreshold).toBe(10);

      // Verify Ledger Transaction
      const tx = await InventoryTransaction.findOne({
        productVariantId: savedVariant._id,
        warehouseId: warehouseMum._id,
      });
      expect(tx).not.toBeNull();
      expect(tx.type).toBe("receive");
      expect(tx.quantity).toBe(120);
    });

    test("Rejects invalid compare at price when compareAtPrice < price", async () => {
      const wsData = [
        bulkImportExportService.TEMPLATE_HEADERS,
        [
          "Faulty Price Item",
          "FAULT-001",
          "FAULT-001",
          "simple",
          "Electronics",
          "AuraVue",
          2000.0,
          1500.0, // Invalid: Compare At Price < Selling Price
          1000.0,
          10,
          "WH-MUM-01",
          5,
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "standard",
          "true",
          0.1,
          "10x10x10",
          "standard",
          "",
          "Description",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "false",
          "false",
          "draft",
        ],
      ];

      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.aoa_to_sheet(wsData);
      xlsx.utils.book_append_sheet(wb, ws, "Products");
      const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      const preview = await bulkImportExportService.validateBulkImport({
        buffer,
        vendorId: vendorA._id.toString(),
      });

      expect(preview.validRowsCount).toBe(0);
      expect(preview.errorRowsCount).toBe(1);
      expect(preview.errorDetails[0].field).toBe("Compare At Price");
      expect(preview.errorDetails[0].error).toContain("less than selling Price");
    });
  });

  // =========================================================================
  // 3. Variable Product & Dynamic Variant Attribute Matrix
  // =========================================================================
  describe("C. Variable Products & Dynamic Attribute Matrix", () => {
    test("Successfully imports variable product with dynamic attributes and multi-warehouse stock", async () => {
      const wsData = [
        bulkImportExportService.TEMPLATE_HEADERS,
        [
          "AuraPhone X Smartphone",
          "AURAPHONE-X",
          "AURAPHONE-X-BLK-128",
          "variable",
          "Electronics",
          "AuraVue",
          39999.0,
          44999.0,
          30000.0,
          50,
          "WH-MUM-01",
          5,
          "Cosmic Black",
          "",
          "Glass & Metal",
          "890123456101",
          "Storage",
          "128GB",
          "RAM",
          "8GB",
          "standard",
          "true",
          0.2,
          "15x7x0.8",
          "fragile",
          "Premium 5G Smartphone with AI Quad Camera.",
          "Featuring Super AMOLED 120Hz display and 5000mAh long-lasting battery.",
          "https://example.com/auraphone-black.jpg",
          "",
          "",
          "",
          "mobile,5g,smartphone",
          "AuraPhone X 128GB",
          "Buy AuraPhone X 128GB online.",
          "auraphone,smartphone",
          "false",
          "false",
          "draft",
        ],
        [
          "AuraPhone X Smartphone",
          "AURAPHONE-X",
          "AURAPHONE-X-BLU-256",
          "variable",
          "Electronics",
          "AuraVue",
          45999.0,
          49999.0,
          35000.0,
          30,
          "WH-DEL-01", // Stocked in North Delhi Hub
          8,
          "Ocean Blue",
          "",
          "Glass & Metal",
          "890123456102",
          "Storage",
          "256GB",
          "RAM",
          "12GB",
          "standard",
          "true",
          0.2,
          "15x7x0.8",
          "fragile",
          "Premium 5G Smartphone with AI Quad Camera.",
          "Featuring Super AMOLED 120Hz display and 5000mAh long-lasting battery.",
          "https://example.com/auraphone-blue.jpg",
          "",
          "",
          "",
          "mobile,5g,smartphone",
          "AuraPhone X 256GB",
          "Buy AuraPhone X 256GB online.",
          "auraphone,smartphone",
          "false",
          "false",
          "draft",
        ],
      ];

      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.aoa_to_sheet(wsData);
      xlsx.utils.book_append_sheet(wb, ws, "Products");
      const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      const preview = await bulkImportExportService.validateBulkImport({
        buffer,
        vendorId: vendorA._id.toString(),
      });

      expect(preview.validRowsCount).toBe(2);
      expect(preview.errorRowsCount).toBe(0);

      const commit = await bulkImportExportService.commitBulkImport({
        rows: preview.rows,
        vendorId: vendorA._id.toString(),
        actor: vendorActorA,
      });

      expect(commit.createdProductsCount).toBe(1);
      expect(commit.createdVariantsCount).toBe(2);

      // Verify Parent Product
      const parent = await Product.findOne({ sku: "AURAPHONE-X" });
      expect(parent).not.toBeNull();
      expect(parent.productType).toBe("variable");
      expect(parent.shippingClass).toBe("fragile");

      // Verify Variant 1 (Mumbai Hub, 128GB Storage, 8GB RAM)
      const v1 = await ProductVariant.findOne({ sku: "AURAPHONE-X-BLK-128" });
      expect(v1).not.toBeNull();
      expect(v1.barcode).toBe("890123456101");
      expect(v1.attributes.get("storage")).toBe("128GB");
      expect(v1.attributes.get("ram")).toBe("8GB");
      expect(v1.attributes.get("color")).toBe("Cosmic Black");

      const inv1 = await Inventory.findOne({
        productVariantId: v1._id,
        warehouseId: warehouseMum._id,
      });
      expect(inv1).not.toBeNull();
      expect(inv1.onHand).toBe(50);
      expect(inv1.lowStockThreshold).toBe(5);

      // Verify Variant 2 (Delhi Hub, 256GB Storage, 12GB RAM)
      const v2 = await ProductVariant.findOne({ sku: "AURAPHONE-X-BLU-256" });
      expect(v2).not.toBeNull();
      expect(v2.barcode).toBe("890123456102");
      expect(v2.attributes.get("storage")).toBe("256GB");
      expect(v2.attributes.get("ram")).toBe("12GB");
      expect(v2.attributes.get("color")).toBe("Ocean Blue");

      const inv2 = await Inventory.findOne({
        productVariantId: v2._id,
        warehouseId: warehouseDel._id,
      });
      expect(inv2).not.toBeNull();
      expect(inv2.onHand).toBe(30);
      expect(inv2.lowStockThreshold).toBe(8);
    });

    test("Rejects duplicate attribute combinations for the same parent product", async () => {
      const wsData = [
        bulkImportExportService.TEMPLATE_HEADERS,
        [
          "Duplicate Test Phone",
          "DUP-PHONE",
          "DUP-PHONE-1",
          "variable",
          "Electronics",
          "AuraVue",
          10000.0,
          12000.0,
          8000.0,
          10,
          "WH-MUM-01",
          5,
          "Black",
          "",
          "",
          "",
          "Storage",
          "128GB",
          "",
          "",
          "standard",
          "true",
          0.2,
          "10x5x1",
          "standard",
          "",
          "Desc",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "false",
          "false",
          "draft",
        ],
        [
          "Duplicate Test Phone",
          "DUP-PHONE",
          "DUP-PHONE-2",
          "variable",
          "Electronics",
          "AuraVue",
          10000.0,
          12000.0,
          8000.0,
          10,
          "WH-MUM-01",
          5,
          "Black", // Identical color & storage
          "",
          "",
          "",
          "Storage",
          "128GB",
          "",
          "",
          "standard",
          "true",
          0.2,
          "10x5x1",
          "standard",
          "",
          "Desc",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "false",
          "false",
          "draft",
        ],
      ];

      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.aoa_to_sheet(wsData);
      xlsx.utils.book_append_sheet(wb, ws, "Products");
      const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      const preview = await bulkImportExportService.validateBulkImport({
        buffer,
        vendorId: vendorA._id.toString(),
      });

      expect(preview.errorRowsCount).toBe(1);
      expect(preview.errorDetails.some((e) => e.field === "Attributes")).toBe(true);
    });
  });

  // =========================================================================
  // 4. Cross-Vendor SKU Collision & Admin Safe Vendor Fallback
  // =========================================================================
  describe("D. Security & Vendor Scoping", () => {
    test("Prevents Vendor B from importing or updating an SKU owned by Vendor A", async () => {
      const wsData = [
        bulkImportExportService.TEMPLATE_HEADERS,
        [
          "Hijack Attempt",
          "AURAPHONE-X-BLK-128",
          "AURAPHONE-X-BLK-128", // Already registered by Vendor A
          "simple",
          "Electronics",
          "AuraVue",
          25000.0,
          30000.0,
          20000.0,
          10,
          "WH-MUM-01",
          5,
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "standard",
          "true",
          0.2,
          "10x5x1",
          "standard",
          "",
          "Desc",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "false",
          "false",
          "draft",
        ],
      ];

      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.aoa_to_sheet(wsData);
      xlsx.utils.book_append_sheet(wb, ws, "Products");
      const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      const preview = await bulkImportExportService.validateBulkImport({
        buffer,
        vendorId: vendorB._id.toString(), // Vendor B
      });

      expect(preview.validRowsCount).toBe(0);
      expect(preview.errorRowsCount).toBe(1);
      expect(preview.errorDetails[0].error).toContain("Cross-vendor SKU collision");
    });

    test("Admin import safely resolves an active Vendor document instead of setting User ID", async () => {
      const wsData = [
        bulkImportExportService.TEMPLATE_HEADERS,
        [
          "Admin Sourced Headphones",
          "ADMIN-HP-001",
          "ADMIN-HP-001",
          "simple",
          "Electronics",
          "AuraVue",
          4999.0,
          5999.0,
          3000.0,
          40,
          "WH-MUM-01",
          5,
          "Black",
          "",
          "",
          "890123456999",
          "",
          "",
          "",
          "",
          "standard",
          "true",
          0.3,
          "15x15x8",
          "standard",
          "",
          "Admin seeded description",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "false",
          "false",
          "draft",
        ],
      ];

      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.aoa_to_sheet(wsData);
      xlsx.utils.book_append_sheet(wb, ws, "Products");
      const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      const preview = await bulkImportExportService.validateBulkImport({
        buffer,
        vendorId: null, // Admin importing without vendor query
      });

      expect(preview.validRowsCount).toBe(1);

      const commit = await bulkImportExportService.commitBulkImport({
        rows: preview.rows,
        vendorId: null,
        actor: adminActor,
      });

      expect(commit.createdProductsCount).toBe(1);

      const created = await Product.findOne({ sku: "ADMIN-HP-001" });
      expect(created).not.toBeNull();
      // Verify vendorId references an actual Vendor document, not the Admin User ID!
      const referencedVendor = await Vendor.findById(created.vendorId);
      expect(referencedVendor).not.toBeNull();
      expect(created.vendorId.toString()).not.toBe(adminActor.id);
    });
  });

  // =========================================================================
  // 5. Round-Trip Export -> Re-import Fidelity Verification
  // =========================================================================
  describe("E. Round-Trip Export & Re-Import Fidelity", () => {
    test("Exports products in template-compatible format and re-imports them with zero loss", async () => {
      // 1. Export Vendor A's products
      const exportResult = await bulkImportExportService.exportVendorProducts({
        vendorId: vendorA._id.toString(),
        filters: { templateCompatible: true },
        format: "xlsx",
        actor: vendorActorA,
      });

      expect(exportResult.buffer).toBeDefined();
      expect(exportResult.count).toBeGreaterThanOrEqual(2);

      // 2. Validate the exported file directly through validateBulkImport
      const reimportPreview = await bulkImportExportService.validateBulkImport({
        buffer: exportResult.buffer,
        vendorId: vendorA._id.toString(),
        mode: "CREATE_AND_UPDATE",
      });

      expect(reimportPreview.errorRowsCount).toBe(0);
      expect(reimportPreview.validRowsCount).toBeGreaterThanOrEqual(3); // 1 simple + 2 variants

      // 3. Re-commit the exported data (Update mode)
      const reimportCommit = await bulkImportExportService.commitBulkImport({
        rows: reimportPreview.rows,
        vendorId: vendorA._id.toString(),
        actor: vendorActorA,
      });

      expect(reimportCommit.failedCount).toBe(0);
      expect(reimportCommit.updatedCount).toBeGreaterThanOrEqual(2);

      // Verify that no data was corrupted or duplicated
      const phoneVariants = await ProductVariant.find({
        sku: { $in: ["AURAPHONE-X-BLK-128", "AURAPHONE-X-BLU-256"] },
      });
      expect(phoneVariants.length).toBe(2);

      const v1 = phoneVariants.find((v) => v.sku === "AURAPHONE-X-BLK-128");
      expect(v1.barcode).toBe("890123456101");
      expect(v1.attributes.get("storage")).toBe("128GB");

      const v2 = phoneVariants.find((v) => v.sku === "AURAPHONE-X-BLU-256");
      expect(v2.barcode).toBe("890123456102");
      expect(v2.attributes.get("storage")).toBe("256GB");
    });
  });

  // =========================================================================
  // 6. Template Sample References & Accurate Rejection Diagnostics
  // =========================================================================
  // =========================================================================
  // 6. Template Sample References & Accurate Rejection Diagnostics
  // =========================================================================
  describe("F. Template Sample References & Diagnostics", () => {
    let catFashion, catMobiles, catAudio;

    beforeAll(async () => {
      // Seed categories corresponding to sample rows in isolated test suite
      catFashion = await Category.create({ name: "Fashion", slug: "fashion", isActive: true });
      catMobiles = await Category.create({ name: "Mobiles", slug: "mobiles", isActive: true });
      catAudio = await Category.create({ name: "Audio", slug: "audio", isActive: true });
    });

    afterAll(async () => {
      await Category.deleteMany({ _id: { $in: [catFashion._id, catMobiles._id, catAudio._id] } });
    });

    test("Template contains instructions explaining blank Brand and Warehouse Code defaults and active references", () => {
      const template = bulkImportExportService.generateImportTemplate("xlsx");
      const wb = xlsx.read(template.buffer, { type: "buffer" });

      const instructions = xlsx.utils.sheet_to_json(wb.Sheets["Column_Instructions"], { header: 1 });
      const warehouseRow = instructions.find((r) => r[0] === "Warehouse Code");
      expect(warehouseRow).toBeDefined();
      expect(warehouseRow[3]).toContain("BB-MAIN-01");
      expect(warehouseRow[3]).toContain("primary active warehouse");

      const brandRow = instructions.find((r) => r[0] === "Brand");
      expect(brandRow).toBeDefined();
      expect(brandRow[3]).toContain("unbranded");

      const references = xlsx.utils.sheet_to_json(wb.Sheets["Reference_Guide"], { header: 1 });
      const bbWh = references.find((r) => r[1] === "BB-MAIN-01");
      expect(bbWh).toBeDefined();

      const sampleGuide = references.find((r) => r[1] === "SAMPLE_ROWS_GUIDE");
      expect(sampleGuide).toBeDefined();
    });

    test("Template sample rows validate successfully (7 Valid / 0 Error) in an environment with seeded platform categories and primary warehouse", async () => {
      // Generate standard template
      const template = bulkImportExportService.generateImportTemplate("xlsx");

      // Validate against vendor A
      const report = await bulkImportExportService.validateBulkImport({
        buffer: template.buffer,
        vendorId: vendorA._id.toString(),
        mode: "CREATE_AND_UPDATE",
      });

      expect(report.totalRows).toBe(7);
      expect(report.validRowsCount).toBe(7);
      expect(report.validCount).toBe(7);
      expect(report.errorRowsCount).toBe(0);
      expect(report.errorCount).toBe(0);
      expect(report.errorDetails).toHaveLength(0);
    });

    test("Committing valid sample rows with blank Warehouse Code defaults to primary warehouse and writes audit ledger", async () => {
      const template = bulkImportExportService.generateImportTemplate("xlsx");
      const report = await bulkImportExportService.validateBulkImport({
        buffer: template.buffer,
        vendorId: vendorA._id.toString(),
        mode: "CREATE_AND_UPDATE",
      });

      expect(report.validRowsCount).toBe(7);

      const commitResult = await bulkImportExportService.commitBulkImport({
        rows: report.rows,
        vendorId: vendorA._id.toString(),
        actor: vendorActorA,
      });

      expect(commitResult.failedCount).toBe(0);
      expect(commitResult.createdProductsCount).toBeGreaterThanOrEqual(1);

      // Verify that inventory for variant TS-BLK-S was allocated to primary warehouse (warehouseMum)
      const tShirtVariant = await ProductVariant.findOne({ sku: "TS-BLK-S" });
      expect(tShirtVariant).toBeDefined();

      const inv = await Inventory.findOne({
        productVariantId: tShirtVariant._id,
        warehouseId: warehouseMum._id,
      });
      expect(inv).toBeDefined();
      expect(inv.onHand).toBe(25);

      // Verify immutable inventory ledger transaction
      const tx = await InventoryTransaction.findOne({
        productVariantId: tShirtVariant._id,
        warehouseId: warehouseMum._id,
      });
      expect(tx).toBeDefined();
      expect(tx.quantity).toBe(25);
      expect(tx.referenceType).toBe("bulk_import");
    });

    test("Missing warehouse/brand references are strictly rejected with row-level errorDetails", async () => {
      const template = bulkImportExportService.generateImportTemplate("xlsx");
      const wb = xlsx.read(template.buffer, { type: "buffer" });
      const rawRows = xlsx.utils.sheet_to_json(wb.Sheets["Products"], { header: 1 });

      const headers = rawRows[0];
      const whIdx = headers.indexOf("Warehouse Code");
      const brandIdx = headers.indexOf("Brand");

      // Inject nonexistent warehouse on row 2 (first data row) and nonexistent brand on row 3
      rawRows[1][whIdx] = "WH-NONEXISTENT-99";
      rawRows[2][brandIdx] = "BrandFakeXYZ";

      wb.Sheets["Products"] = xlsx.utils.aoa_to_sheet(rawRows);
      const modBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      const report = await bulkImportExportService.validateBulkImport({
        buffer: modBuffer,
        vendorId: vendorA._id.toString(),
      });

      expect(report.totalRows).toBe(7);
      expect(report.errorRowsCount).toBeGreaterThanOrEqual(2);
      expect(report.errorDetails.length).toBeGreaterThanOrEqual(2);

      const whErr = report.errorDetails.find((e) => e.field === "Warehouse Code");
      expect(whErr).toBeDefined();
      expect(whErr.rowNumber).toBe(2);
      expect(whErr.error).toContain("WH-NONEXISTENT-99");
      expect(whErr.suggestedAction).toBeDefined();

      const brandErr = report.errorDetails.find((e) => e.field === "Brand");
      expect(brandErr).toBeDefined();
      expect(brandErr.rowNumber).toBe(3);
      expect(brandErr.error).toContain("BrandFakeXYZ");
      expect(brandErr.suggestedAction).toBeDefined();
    });
  });
});

