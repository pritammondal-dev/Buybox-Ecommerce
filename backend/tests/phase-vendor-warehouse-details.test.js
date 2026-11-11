const mongoose = require("mongoose");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const warehouseService = require("../src/services/warehouse.service");
const AppError = require("../src/errors/AppError");

const TEST_MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/buybox_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Buybox Phase: VENDOR-WAREHOUSE-DETAILS-UI-DATA-REMEDIATION-01", () => {
  let vendorAUser, vendorA;
  let vendorBUser, vendorB;
  let managerUser;
  let testCategory;
  let warehouse1;
  let warehouseEmpty;
  let productA1, variantA1_1, variantA1_2;
  let productA2, variantA2_1;
  let productB1, variantB1_1;

  async function createTestUser(role, prefix) {
    const rand = Math.random().toString(36).substring(7);
    const randPhone = `+91${Math.floor(6000000000 + Math.random() * 3999999999)}`;
    return User.create({
      firstName: `${prefix}First`,
      lastName: `${prefix}Last`,
      email: `${prefix.toLowerCase()}_${Date.now()}_${rand}@wh-test.com`,
      password: "Password123!",
      role,
      phone: randPhone,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
  }

  async function createTestVendor(name) {
    const user = await createTestUser("vendor", name);
    const rand = Math.random().toString(36).substring(7);
    const vendor = await Vendor.create({
      userId: user._id,
      businessName: `${name} Retail Ltd ${rand}`,
      businessSlug: `${name.toLowerCase()}-retail-${rand}`,
      isActive: true,
      onboardingStatus: "approved",
    });
    return { user, vendor };
  }

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // 1. Create Vendors
    const vA = await createTestVendor("VendorAlpha");
    vendorAUser = vA.user;
    vendorA = vA.vendor;

    const vB = await createTestVendor("VendorBeta");
    vendorBUser = vB.user;
    vendorB = vB.vendor;

    // 2. Create Facility Manager
    managerUser = await createTestUser("manager", "Rajesh");

    // 3. Create Category
    testCategory = await Category.create({
      name: `WH Category ${Date.now()}`,
      slug: `wh-cat-${Date.now()}`,
      isActive: true,
    });

    // 4. Create Warehouses
    warehouse1 = await Warehouse.create({
      name: "Mumbai West Fulfillment Center",
      code: `BOM-FC-${Math.floor(Math.random() * 9000 + 1000)}`,
      type: "Regional Fulfillment Center",
      description: "Primary regional node for western express shipments",
      address: {
        addressLine1: "Plot 42, Logistics Park, Phase 2",
        addressLine2: "Near Cargo Terminal",
        city: "Bhiwandi",
        state: "Maharashtra",
        postalCode: "421302",
        country: "IN",
      },
      managerUserId: managerUser._id,
      contactPerson: "Warehouse Desk",
      contactPhone: "+91 22 8888 9999",
      contactEmail: "bom-fc01@buyboxlogistics.test",
      capacity: 50000,
      operatingHours: "Mon – Sat (8:00 AM – 8:00 PM)",
      isActive: true,
    });

    warehouseEmpty = await Warehouse.create({
      name: "Delhi North Regional Depot",
      code: `DEL-RD-${Math.floor(Math.random() * 9000 + 1000)}`,
      type: "Depot",
      address: {
        addressLine1: "Warehouse 12, Transport Nagar",
        city: "Delhi",
        state: "Delhi",
        postalCode: "110036",
        country: "IN",
      },
      isActive: true,
    });

    // 5. Create Vendor A Products & Variants
    productA1 = await Product.create({
      vendorId: vendorA._id,
      categoryId: testCategory._id,
      name: "Ergonomic Office Chair",
      slug: `ergo-chair-${Date.now()}`,
      sku: "PROD-CHAIR-01",
      description: "Mesh ergonomic desk chair",
      price: 8999,
      status: "active",
      images: [{ url: "https://cdn.test/chair.jpg", isDefault: true }],
    });

    variantA1_1 = await ProductVariant.create({
      productId: productA1._id,
      sku: "CHAIR-BLK-01",
      name: "Black Mesh / High Back",
      attributes: { Color: "Black", Size: "High Back" },
      price: 8999,
      compareAtPrice: 10999,
      stockStatus: "in_stock",
    });

    variantA1_2 = await ProductVariant.create({
      productId: productA1._id,
      sku: "CHAIR-GRY-02",
      name: "Grey Mesh / Mid Back",
      attributes: { Color: "Grey", Size: "Mid Back" },
      price: 7999,
      compareAtPrice: 9999,
      stockStatus: "in_stock",
    });

    productA2 = await Product.create({
      vendorId: vendorA._id,
      categoryId: testCategory._id,
      name: "Wireless Mechanical Keyboard",
      slug: `mech-kb-${Date.now()}`,
      sku: "PROD-KB-02",
      description: "Hot-swappable RGB keyboard",
      price: 4500,
      status: "active",
      images: [{ url: "https://cdn.test/kb.jpg", isDefault: true }],
    });

    variantA2_1 = await ProductVariant.create({
      productId: productA2._id,
      sku: "KB-RGB-RED",
      name: "RGB / Red Linear Switches",
      attributes: { Switch: "Red", Backlight: "RGB" },
      price: 4500,
      stockStatus: "out_of_stock",
    });

    // 6. Create Vendor B Products & Variants (For Tenant Isolation Verification)
    productB1 = await Product.create({
      vendorId: vendorB._id,
      categoryId: testCategory._id,
      name: "Noise-Cancelling Headphones",
      slug: `anc-headphones-${Date.now()}`,
      sku: "PROD-HEADPHONES-B",
      price: 14999,
      status: "active",
      images: [{ url: "https://cdn.test/headphones.jpg" }],
    });

    variantB1_1 = await ProductVariant.create({
      productId: productB1._id,
      sku: "HP-ANC-BLK",
      name: "Matte Black",
      attributes: { Color: "Matte Black" },
      price: 14999,
      stockStatus: "in_stock",
    });

    // 7. Inventory Setup in warehouse1:
    // Variant A1_1: onHand=50, reserved=5, damaged=2, defective=0, expired=0 => available = 50 - 5 - 2 = 43 (in_stock)
    await Inventory.create({
      warehouseId: warehouse1._id,
      productVariantId: variantA1_1._id,
      onHand: 50,
      reserved: 5,
      damaged: 2,
      defective: 0,
      expired: 0,
      lowStockThreshold: 10,
    });

    // Variant A1_2: onHand=8, reserved=2, damaged=0 => available = 6 <= threshold(10) (low_stock)
    await Inventory.create({
      warehouseId: warehouse1._id,
      productVariantId: variantA1_2._id,
      onHand: 8,
      reserved: 2,
      damaged: 0,
      defective: 0,
      expired: 0,
      lowStockThreshold: 10,
    });

    // Variant A2_1: onHand=0, reserved=0 => available = 0 (out_of_stock)
    await Inventory.create({
      warehouseId: warehouse1._id,
      productVariantId: variantA2_1._id,
      onHand: 0,
      reserved: 0,
      damaged: 0,
      defective: 0,
      expired: 0,
      lowStockThreshold: 5,
    });

    // Variant B1_1 (Vendor B stock in SAME warehouse): onHand=100, reserved=10 => available = 90
    await Inventory.create({
      warehouseId: warehouse1._id,
      productVariantId: variantB1_1._id,
      onHand: 100,
      reserved: 10,
      damaged: 0,
      defective: 0,
      expired: 0,
      lowStockThreshold: 15,
    });
  });

  afterAll(async () => {
    // Cleanup created test records
    await Inventory.deleteMany({
      warehouseId: { $in: [warehouse1?._id, warehouseEmpty?._id] },
    });
    await ProductVariant.deleteMany({
      _id: { $in: [variantA1_1?._id, variantA1_2?._id, variantA2_1?._id, variantB1_1?._id] },
    });
    await Product.deleteMany({
      _id: { $in: [productA1?._id, productA2?._id, productB1?._id] },
    });
    await Warehouse.deleteMany({
      _id: { $in: [warehouse1?._id, warehouseEmpty?._id] },
    });
    if (testCategory) await Category.deleteOne({ _id: testCategory._id });
    if (vendorAUser) await User.deleteOne({ _id: vendorAUser._id });
    if (vendorA) await Vendor.deleteOne({ _id: vendorA._id });
    if (vendorBUser) await User.deleteOne({ _id: vendorBUser._id });
    if (vendorB) await Vendor.deleteOne({ _id: vendorB._id });
    if (managerUser) await User.deleteOne({ _id: managerUser._id });
  });

  describe("1. Warehouse Identity & Facility Address Details", () => {
    it("should return complete identity header and resolved facility manager contact", async () => {
      const result = await warehouseService.getMyVendorWarehouseById({
        warehouseId: warehouse1._id.toString(),
        userId: vendorAUser._id,
        query: {},
      });

      expect(result).toBeDefined();
      expect(result._id.toString()).toBe(warehouse1._id.toString());
      expect(result.name).toBe("Mumbai West Fulfillment Center");
      expect(result.code).toBe(warehouse1.code);
      expect(result.type).toBe("Regional Fulfillment Center");
      expect(result.status).toBe("active");
      expect(result.isActive).toBe(true);
      expect(result.secureId).toBeDefined();

      // Facility Address
      expect(result.address).toBeDefined();
      expect(result.address.addressLine1).toBe("Plot 42, Logistics Park, Phase 2");
      expect(result.address.city).toBe("Bhiwandi");
      expect(result.address.state).toBe("Maharashtra");
      expect(result.address.postalCode).toBe("421302");
      expect(result.address.country).toBe("IN");

      // Facility Management & Contact
      expect(result.contactPerson).toBe(`${managerUser.firstName} ${managerUser.lastName}`);
      expect(result.contactPhone).toBe("+91 22 8888 9999");
      expect(result.contactEmail).toBe("bom-fc01@buyboxlogistics.test");
      expect(result.operatingHours).toBe("Mon – Sat (8:00 AM – 8:00 PM)");
      expect(result.capacity).toBe(50000);
    });

    it("should handle empty or optional address/contact fields gracefully without crashing", async () => {
      const result = await warehouseService.getMyVendorWarehouseById({
        warehouseId: warehouseEmpty._id.toString(),
        userId: vendorAUser._id,
        query: {},
      });

      expect(result).toBeDefined();
      expect(result.name).toBe("Delhi North Regional Depot");
      expect(result.contactPerson).toBeNull();
      expect(result.contactPhone).toBeNull();
      expect(result.contactEmail).toBeNull();
      expect(result.address.addressLine2).toBe("");
    });
  });

  describe("2. Authoritative Merchant Overview Aggregations", () => {
    it("should compute accurate merchant-specific KPI metrics excluding other vendors", async () => {
      const result = await warehouseService.getMyVendorWarehouseById({
        warehouseId: warehouse1._id.toString(),
        userId: vendorAUser._id,
        query: {},
      });

      const overview = result.overview;
      expect(overview).toBeDefined();

      // Vendor A has 3 SKUs in this warehouse (A1_1, A1_2, A2_1)
      expect(overview.totalSkus).toBe(3);

      // On-Hand: 50 (A1_1) + 8 (A1_2) + 0 (A2_1) = 58
      // Note: Vendor B has 100 units in the same warehouse, which MUST NOT be counted!
      expect(overview.totalOnHandUnits).toBe(58);
      expect(overview.onHandUnits).toBe(58);

      // Reserved: 5 (A1_1) + 2 (A1_2) + 0 (A2_1) = 7
      expect(overview.reservedStock).toBe(7);

      // Available: (50 - 5 - 2 = 43) + (8 - 2 - 0 = 6) + (0 = 0) = 49
      expect(overview.availableStock).toBe(49);

      // Low Stock SKUs:
      // A1_1: 43 > 10 (Not low)
      // A1_2: 6 <= 10 (Low Stock)
      // A2_1: 0 <= 5 (Out of stock counts as low stock)
      expect(overview.lowStockSkus).toBe(2);
      expect(overview.outOfStockSkus).toBe(1);
    });

    it("should return zero metrics when merchant has no stock stored at warehouse", async () => {
      const result = await warehouseService.getMyVendorWarehouseById({
        warehouseId: warehouseEmpty._id.toString(),
        userId: vendorAUser._id,
        query: {},
      });

      const overview = result.overview;
      expect(overview.totalSkus).toBe(0);
      expect(overview.totalOnHandUnits).toBe(0);
      expect(overview.availableStock).toBe(0);
      expect(overview.reservedStock).toBe(0);
      expect(overview.lowStockSkus).toBe(0);
      expect(overview.outOfStockSkus).toBe(0);
      expect(result.items).toHaveLength(0);
    });
  });

  describe("3. Stored Product Variants Table & Formatted Items", () => {
    it("should return correctly mapped product and variant details with images and stockStatus", async () => {
      const result = await warehouseService.getMyVendorWarehouseById({
        warehouseId: warehouse1._id.toString(),
        userId: vendorAUser._id,
        query: {},
      });

      expect(result.items).toHaveLength(3);

      const chairBlack = result.items.find((i) => i.variantSku === "CHAIR-BLK-01");
      expect(chairBlack).toBeDefined();
      expect(chairBlack.productName).toBe("Ergonomic Office Chair");
      expect(chairBlack.productSku).toBe("PROD-CHAIR-01");
      expect(chairBlack.productImage).toBe("https://cdn.test/chair.jpg");
      expect(chairBlack.variantName).toBe("Black Mesh / High Back");
      expect(chairBlack.onHand).toBe(50);
      expect(chairBlack.reserved).toBe(5);
      expect(chairBlack.available).toBe(43);
      expect(chairBlack.stockStatus).toBe("in_stock");
      expect(chairBlack.lowStockThreshold).toBe(10);

      const chairGrey = result.items.find((i) => i.variantSku === "CHAIR-GRY-02");
      expect(chairGrey).toBeDefined();
      expect(chairGrey.onHand).toBe(8);
      expect(chairGrey.reserved).toBe(2);
      expect(chairGrey.available).toBe(6);
      expect(chairGrey.stockStatus).toBe("low_stock");

      const kbRed = result.items.find((i) => i.variantSku === "KB-RGB-RED");
      expect(kbRed).toBeDefined();
      expect(kbRed.onHand).toBe(0);
      expect(kbRed.available).toBe(0);
      expect(kbRed.stockStatus).toBe("out_of_stock");
    });
  });

  describe("4. Search, Status Filtering, Sorting & Pagination", () => {
    it("should filter items by search query matching product name or SKU", async () => {
      const resultByProduct = await warehouseService.getMyVendorWarehouseById({
        warehouseId: warehouse1._id.toString(),
        userId: vendorAUser._id,
        query: { search: "keyboard" },
      });

      expect(resultByProduct.items).toHaveLength(1);
      expect(resultByProduct.items[0].productName).toBe("Wireless Mechanical Keyboard");

      const resultBySku = await warehouseService.getMyVendorWarehouseById({
        warehouseId: warehouse1._id.toString(),
        userId: vendorAUser._id,
        query: { search: "CHAIR-GRY" },
      });

      expect(resultBySku.items).toHaveLength(1);
      expect(resultBySku.items[0].variantSku).toBe("CHAIR-GRY-02");
    });

    it("should filter items by stockStatus (in_stock, low_stock, out_of_stock)", async () => {
      const inStockResult = await warehouseService.getMyVendorWarehouseById({
        warehouseId: warehouse1._id.toString(),
        userId: vendorAUser._id,
        query: { status: "in_stock" },
      });
      expect(inStockResult.items).toHaveLength(1);
      expect(inStockResult.items[0].stockStatus).toBe("in_stock");

      const lowStockResult = await warehouseService.getMyVendorWarehouseById({
        warehouseId: warehouse1._id.toString(),
        userId: vendorAUser._id,
        query: { status: "low_stock" },
      });
      expect(lowStockResult.items).toHaveLength(1);
      expect(lowStockResult.items[0].stockStatus).toBe("low_stock");

      const outOfStockResult = await warehouseService.getMyVendorWarehouseById({
        warehouseId: warehouse1._id.toString(),
        userId: vendorAUser._id,
        query: { status: "out_of_stock" },
      });
      expect(outOfStockResult.items).toHaveLength(1);
      expect(outOfStockResult.items[0].stockStatus).toBe("out_of_stock");
    });

    it("should sort items by available stock and product name", async () => {
      const sortDesc = await warehouseService.getMyVendorWarehouseById({
        warehouseId: warehouse1._id.toString(),
        userId: vendorAUser._id,
        query: { sortBy: "available", sortOrder: "desc" },
      });
      expect(sortDesc.items[0].available).toBeGreaterThanOrEqual(sortDesc.items[1].available);
      expect(sortDesc.items[1].available).toBeGreaterThanOrEqual(sortDesc.items[2].available);

      const sortAsc = await warehouseService.getMyVendorWarehouseById({
        warehouseId: warehouse1._id.toString(),
        userId: vendorAUser._id,
        query: { sortBy: "available", sortOrder: "asc" },
      });
      expect(sortAsc.items[0].available).toBeLessThanOrEqual(sortAsc.items[1].available);
    });

    it("should paginate items correctly and return accurate metadata", async () => {
      const page1 = await warehouseService.getMyVendorWarehouseById({
        warehouseId: warehouse1._id.toString(),
        userId: vendorAUser._id,
        query: { page: 1, limit: 2 },
      });

      expect(page1.items).toHaveLength(2);
      expect(page1.meta.page).toBe(1);
      expect(page1.meta.limit).toBe(2);
      expect(page1.meta.total).toBe(3);
      expect(page1.meta.totalPages).toBe(2);

      const page2 = await warehouseService.getMyVendorWarehouseById({
        warehouseId: warehouse1._id.toString(),
        userId: vendorAUser._id,
        query: { page: 2, limit: 2 },
      });

      expect(page2.items).toHaveLength(1);
      expect(page2.meta.page).toBe(2);
    });
  });

  describe("5. Multi-Tenant Isolation & Security Boundary", () => {
    it("should never leak Vendor A items to Vendor B and vice versa", async () => {
      // Vendor B queries warehouse1 where both Vendor A and Vendor B have stock
      const vendorBResult = await warehouseService.getMyVendorWarehouseById({
        warehouseId: warehouse1._id.toString(),
        userId: vendorBUser._id,
        query: {},
      });

      // Vendor B has only 1 SKU in this warehouse (Headphones)
      expect(vendorBResult.overview.totalSkus).toBe(1);
      expect(vendorBResult.overview.totalOnHandUnits).toBe(100);
      expect(vendorBResult.overview.availableStock).toBe(90);
      expect(vendorBResult.overview.reservedStock).toBe(10);
      expect(vendorBResult.items).toHaveLength(1);
      expect(vendorBResult.items[0].productName).toBe("Noise-Cancelling Headphones");
      expect(vendorBResult.items[0].variantSku).toBe("HP-ANC-BLK");

      // Verify none of Vendor A's chair or keyboard items exist in Vendor B's response
      const vendorAItemsInB = vendorBResult.items.filter(
        (i) => i.productSku.includes("CHAIR") || i.productSku.includes("KB")
      );
      expect(vendorAItemsInB).toHaveLength(0);
    });
  });

  describe("6. Error Handling & Parameter Edge Cases", () => {
    it("should throw 404 WAREHOUSE_NOT_FOUND if warehouse does not exist", async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      await expect(
        warehouseService.getMyVendorWarehouseById({
          warehouseId: nonExistentId,
          userId: vendorAUser._id,
          query: {},
        })
      ).rejects.toThrow(AppError);

      try {
        await warehouseService.getMyVendorWarehouseById({
          warehouseId: nonExistentId,
          userId: vendorAUser._id,
          query: {},
        });
      } catch (err) {
        expect(err.statusCode).toBe(404);
        expect(err.code).toBe("WAREHOUSE_NOT_FOUND");
      }
    });

    it("should throw 404 WAREHOUSE_NOT_FOUND for invalid non-ObjectId string", async () => {
      await expect(
        warehouseService.getMyVendorWarehouseById({
          warehouseId: "invalid_id_format_xyz",
          userId: vendorAUser._id,
          query: {},
        })
      ).rejects.toThrow(AppError);
    });
  });
});
