const request = require("supertest");
const mongoose = require("mongoose");

jest.mock("../src/models/Vendor");
jest.mock("../src/models/Order");
jest.mock("../src/models/Refund");

const app = require("../src/app");
const Vendor = require("../src/models/Vendor");
const Order = require("../src/models/Order");
const { generateAccessToken } = require("../src/services/token.service");

describe("Vendor Analytics — Product Performance Sort Contract & Validation Tests", () => {
  const vendorUserId = new mongoose.Types.ObjectId().toString();
  const vendorId = new mongoose.Types.ObjectId().toString();
  let vendorToken;

  beforeEach(() => {
    jest.clearAllMocks();

    vendorToken = generateAccessToken({ sub: vendorUserId, role: "vendor", context: "vendor" });

    Vendor.findOne.mockImplementation(({ userId }) => {
      if (userId === vendorUserId) {
        return Promise.resolve({
          _id: new mongoose.Types.ObjectId(vendorId),
          userId: vendorUserId,
          isActive: true,
          deletedAt: null,
          onboardingStatus: "approved",
        });
      }
      return Promise.resolve(null);
    });

    Order.aggregate.mockResolvedValue([
      {
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productVariantId: new mongoose.Types.ObjectId(),
            productName: "Test Product",
            variantName: "Default",
            sku: "TEST-SKU-001",
            unitsSold: 10,
            grossSales: 5000,
            discounts: 200,
            netSales: 4800,
            orderCount: 5,
            currentStock: 25,
            availableStock: 20,
          },
        ],
        total: [{ total: 1 }],
      },
    ]);
  });

  describe("1. Initial Page Load & Canonical Sort Defaults", () => {
    it("successfully loads with default parameters (unitsSold, desc, page 1, limit 20)", async () => {
      const res = await request(app)
        .get("/api/v1/analytics/vendor/product-performance")
        .set("Authorization", `Bearer ${vendorToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(20);
      expect(res.body.data.products).toHaveLength(1);
    });
  });

  describe("2. The Four Supported Canonical Sort Fields", () => {
    it("accepts sortBy=unitsSold with sortOrder=desc and sortOrder=asc", async () => {
      const resDesc = await request(app)
        .get("/api/v1/analytics/vendor/product-performance?sortBy=unitsSold&sortOrder=desc")
        .set("Authorization", `Bearer ${vendorToken}`)
        .expect(200);
      expect(resDesc.body.success).toBe(true);

      const resAsc = await request(app)
        .get("/api/v1/analytics/vendor/product-performance?sortBy=unitsSold&sortOrder=asc")
        .set("Authorization", `Bearer ${vendorToken}`)
        .expect(200);
      expect(resAsc.body.success).toBe(true);
    });

    it("accepts sortBy=grossSales with sortOrder=desc and sortOrder=asc", async () => {
      const resDesc = await request(app)
        .get("/api/v1/analytics/vendor/product-performance?sortBy=grossSales&sortOrder=desc")
        .set("Authorization", `Bearer ${vendorToken}`)
        .expect(200);
      expect(resDesc.body.success).toBe(true);

      const resAsc = await request(app)
        .get("/api/v1/analytics/vendor/product-performance?sortBy=grossSales&sortOrder=asc")
        .set("Authorization", `Bearer ${vendorToken}`)
        .expect(200);
      expect(resAsc.body.success).toBe(true);
    });

    it("accepts sortBy=netSales with sortOrder=desc and sortOrder=asc", async () => {
      const resDesc = await request(app)
        .get("/api/v1/analytics/vendor/product-performance?sortBy=netSales&sortOrder=desc")
        .set("Authorization", `Bearer ${vendorToken}`)
        .expect(200);
      expect(resDesc.body.success).toBe(true);

      const resAsc = await request(app)
        .get("/api/v1/analytics/vendor/product-performance?sortBy=netSales&sortOrder=asc")
        .set("Authorization", `Bearer ${vendorToken}`)
        .expect(200);
      expect(resAsc.body.success).toBe(true);
    });

    it("accepts sortBy=productName with sortOrder=asc and sortOrder=desc", async () => {
      const resAsc = await request(app)
        .get("/api/v1/analytics/vendor/product-performance?sortBy=productName&sortOrder=asc")
        .set("Authorization", `Bearer ${vendorToken}`)
        .expect(200);
      expect(resAsc.body.success).toBe(true);

      const resDesc = await request(app)
        .get("/api/v1/analytics/vendor/product-performance?sortBy=productName&sortOrder=desc")
        .set("Authorization", `Bearer ${vendorToken}`)
        .expect(200);
      expect(resDesc.body.success).toBe(true);
    });
  });

  describe("3. Strict Backend Rejection of Legacy & Invalid Sort Options", () => {
    it("rejects legacy sortBy=units with HTTP 400 VALIDATION_ERROR", async () => {
      const res = await request(app)
        .get("/api/v1/analytics/vendor/product-performance?sortBy=units")
        .set("Authorization", `Bearer ${vendorToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(res.body.message).toContain("expected one of");
    });

    it("rejects legacy sortBy=orders with HTTP 400 VALIDATION_ERROR", async () => {
      const res = await request(app)
        .get("/api/v1/analytics/vendor/product-performance?sortBy=orders")
        .set("Authorization", `Bearer ${vendorToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("rejects combined format sortBy=unitsSold:desc with HTTP 400 VALIDATION_ERROR", async () => {
      const res = await request(app)
        .get("/api/v1/analytics/vendor/product-performance?sortBy=unitsSold:desc")
        .set("Authorization", `Bearer ${vendorToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("rejects invalid sortOrder direction with HTTP 400 VALIDATION_ERROR", async () => {
      const res = await request(app)
        .get("/api/v1/analytics/vendor/product-performance?sortBy=unitsSold&sortOrder=descending")
        .set("Authorization", `Bearer ${vendorToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("4. Preserves Pagination, Search, and Date Filters", () => {
    it("accepts search, page, limit, and period filters alongside valid sort", async () => {
      const res = await request(app)
        .get("/api/v1/analytics/vendor/product-performance?period=last_30_days&page=2&limit=15&search=Headphones&sortBy=grossSales&sortOrder=desc")
        .set("Authorization", `Bearer ${vendorToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.pagination.page).toBe(2);
      expect(res.body.data.pagination.limit).toBe(15);
    });
  });
});

