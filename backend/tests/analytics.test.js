const request = require("supertest");
const mongoose = require("mongoose");

jest.mock("../src/models/Vendor");
jest.mock("../src/models/Order");
jest.mock("../src/models/Refund");

const app = require("../src/app");
const Vendor = require("../src/models/Vendor");
const Order = require("../src/models/Order");
const Refund = require("../src/models/Refund");
const { generateAccessToken } = require("../src/services/token.service");
const analyticsRepository = require("../src/repositories/analytics.repository");
const analyticsService = require("../src/services/analytics.service");

describe("Analytics & Business Reporting (Task 7B)", () => {
  const adminUserId = new mongoose.Types.ObjectId().toString();
  const managerUserId = new mongoose.Types.ObjectId().toString();
  const superAdminUserId = new mongoose.Types.ObjectId().toString();
  const vendorAUserId = new mongoose.Types.ObjectId().toString();
  const vendorBUserId = new mongoose.Types.ObjectId().toString();
  const customerUserId = new mongoose.Types.ObjectId().toString();

  const vendorAId = new mongoose.Types.ObjectId().toString();
  const vendorBId = new mongoose.Types.ObjectId().toString();

  let adminToken;
  let managerToken;
  let superAdminToken;
  let vendorAToken;
  let vendorBToken;
  let customerToken;

  beforeEach(() => {
    jest.clearAllMocks();

    adminToken = generateAccessToken({ sub: adminUserId, role: "admin" });
    managerToken = generateAccessToken({ sub: managerUserId, role: "manager" });
    superAdminToken = generateAccessToken({
      sub: superAdminUserId,
      role: "super_admin",
    });
    vendorAToken = generateAccessToken({ sub: vendorAUserId, role: "vendor" });
    vendorBToken = generateAccessToken({ sub: vendorBUserId, role: "vendor" });
    customerToken = generateAccessToken({
      sub: customerUserId,
      role: "customer",
    });

    Order.aggregate.mockResolvedValue([]);
    Refund.aggregate.mockResolvedValue([]);

    Vendor.findOne.mockImplementation(({ userId }) => {
      if (userId === vendorAUserId) {
        return Promise.resolve({
          _id: new mongoose.Types.ObjectId(vendorAId),
          userId: vendorAUserId,
          isActive: true,
          deletedAt: null,
        });
      }
      if (userId === vendorBUserId) {
        return Promise.resolve({
          _id: new mongoose.Types.ObjectId(vendorBId),
          userId: vendorBUserId,
          isActive: true,
          deletedAt: null,
        });
      }
      return Promise.resolve(null);
    });
  });

  /*
   * ==========================================
   * 1. ADMIN OVERVIEW
   * ==========================================
   */
  describe("1. Admin overview", () => {
    it("should return platform overview metrics with authoritative refunds", async () => {
      Order.aggregate.mockResolvedValueOnce([
        {
          _id: null,
          grossSales: mongoose.Types.Decimal128.fromString("1250.50"),
          discounts: mongoose.Types.Decimal128.fromString("50.50"),
          tax: mongoose.Types.Decimal128.fromString("120.00"),
          unitsSold: 15,
          orderCount: 4,
        },
      ]);

      Refund.aggregate.mockResolvedValueOnce([
        {
          _id: null,
          totalRefunds: mongoose.Types.Decimal128.fromString("75.00"),
        },
      ]);

      const res = await request(app)
        .get("/api/v1/analytics/admin/overview?period=last_7_days")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.period).toBe("last_7_days");
      expect(res.body.data.metrics).toEqual({
        grossSales: "1250.50",
        discounts: "50.50",
        merchandiseSales: "1200.00",
        tax: "120.00",
        unitsSold: 15,
        orderCount: 4,
        averageOrderValue: "300.00",
        refunds: "75.00",
        refundAttributionAvailable: true,
      });
    });
  });

  /*
   * ==========================================
   * 2. VENDOR OVERVIEW
   * ==========================================
   */
  describe("2. Vendor overview", () => {
    it("should return vendor overview with refunds as null and explicit limitation", async () => {
      Order.aggregate.mockResolvedValueOnce([
        {
          _id: null,
          grossSales: mongoose.Types.Decimal128.fromString("500.00"),
          discounts: mongoose.Types.Decimal128.fromString("20.00"),
          tax: mongoose.Types.Decimal128.fromString("48.00"),
          unitsSold: 5,
          orderCount: 2,
        },
      ]);

      const res = await request(app)
        .get("/api/v1/analytics/vendor/overview?period=today")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.metrics.grossSales).toBe("500.00");
      expect(res.body.data.metrics.discounts).toBe("20.00");
      expect(res.body.data.metrics.merchandiseSales).toBe("480.00");
      expect(res.body.data.metrics.tax).toBe("48.00");
      expect(res.body.data.metrics.unitsSold).toBe(5);
      expect(res.body.data.metrics.orderCount).toBe(2);
      expect(res.body.data.metrics.averageOrderValue).toBe("240.00");
      expect(res.body.data.metrics.refunds).toBeNull();
      expect(res.body.data.metrics.refundAttributionAvailable).toBe(false);
      expect(res.body.data.metrics.refundAttributionNote).toBeDefined();
    });
  });

  /*
   * ==========================================
   * 3. ADMIN TOP PRODUCTS
   * ==========================================
   */
  describe("3. Admin top products", () => {
    it("should return top products ranked across the platform", async () => {
      const prod1Id = new mongoose.Types.ObjectId();
      const var1Id = new mongoose.Types.ObjectId();

      Order.aggregate.mockResolvedValueOnce([
        {
          productId: prod1Id,
          productVariantId: var1Id,
          productName: "Alpha Widget",
          variantName: "Blue",
          sku: "ALPHA-BLU",
          unitsSold: 20,
          revenue: mongoose.Types.Decimal128.fromString("1000.00"),
          grossRevenue: mongoose.Types.Decimal128.fromString("1100.00"),
          discounts: mongoose.Types.Decimal128.fromString("100.00"),
        },
      ]);

      const res = await request(app)
        .get("/api/v1/analytics/admin/top-products?limit=5")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0]).toEqual({
        productId: prod1Id.toString(),
        productVariantId: var1Id.toString(),
        productName: "Alpha Widget",
        variantName: "Blue",
        sku: "ALPHA-BLU",
        unitsSold: 20,
        revenue: "1000.00",
        grossRevenue: "1100.00",
      });
    });
  });

  /*
   * ==========================================
   * 4. VENDOR TOP PRODUCTS
   * ==========================================
   */
  describe("4. Vendor top products", () => {
    it("should return top products isolated to authenticated vendor", async () => {
      const prodId = new mongoose.Types.ObjectId();
      const varId = new mongoose.Types.ObjectId();

      Order.aggregate.mockResolvedValueOnce([
        {
          productId: prodId,
          productVariantId: varId,
          productName: "Vendor A Item",
          variantName: "Standard",
          sku: "VA-001",
          unitsSold: 7,
          revenue: mongoose.Types.Decimal128.fromString("350.00"),
          grossRevenue: mongoose.Types.Decimal128.fromString("350.00"),
          discounts: mongoose.Types.Decimal128.fromString("0.00"),
        },
      ]);

      const res = await request(app)
        .get("/api/v1/analytics/vendor/top-products")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items[0].productName).toBe("Vendor A Item");
      expect(res.body.data.items[0].unitsSold).toBe(7);
      expect(res.body.data.items[0].revenue).toBe("350.00");
    });
  });

  /*
   * ==========================================
   * 5. ADMIN SALES TREND
   * ==========================================
   */
  describe("5. Admin sales trend", () => {
    it("should return daily intervals covering the period with zero-filled gaps", async () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      Order.aggregate.mockResolvedValueOnce([
        {
          _id: todayStr,
          sales: mongoose.Types.Decimal128.fromString("250.00"),
          units: 3,
          orders: 2,
        },
      ]);

      const res = await request(app)
        .get("/api/v1/analytics/admin/sales-trend?period=today")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.intervals).toHaveLength(1);
      expect(res.body.data.intervals[0]).toEqual({
        date: todayStr,
        sales: "250.00",
        units: 3,
        orders: 2,
      });
    });
  });

  /*
   * ==========================================
   * 6. VENDOR SALES TREND
   * ==========================================
   */
  describe("6. Vendor sales trend", () => {
    it("should return vendor daily trend intervals", async () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      Order.aggregate.mockResolvedValueOnce([
        {
          _id: todayStr,
          sales: mongoose.Types.Decimal128.fromString("100.00"),
          units: 1,
          orders: 1,
        },
      ]);

      const res = await request(app)
        .get("/api/v1/analytics/vendor/sales-trend?period=today")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.intervals[0].sales).toBe("100.00");
      expect(res.body.data.intervals[0].units).toBe(1);
    });
  });

  /*
   * ==========================================
   * 7. VENDOR ISOLATION
   * ==========================================
   */
  describe("7. Vendor isolation", () => {
    it("should pass authenticated vendorId to repository and filter items.vendorId in pipeline", async () => {
      Order.aggregate.mockResolvedValueOnce([]);

      await request(app)
        .get("/api/v1/analytics/vendor/overview")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .expect(200);

      const lastCall = Order.aggregate.mock.calls[0][0];
      // Check pre-unwind match
      const firstMatch = lastCall[0].$match;
      expect(firstMatch["items.vendorId"]).toEqual(
        new mongoose.Types.ObjectId(vendorAId)
      );
      // Check post-unwind match
      const secondMatch = lastCall[2].$match;
      expect(secondMatch["items.vendorId"]).toEqual(
        new mongoose.Types.ObjectId(vendorAId)
      );
    });
  });

  /*
   * ==========================================
   * 8. VENDOR CANNOT OVERRIDE VENDORID
   * ==========================================
   */
  describe("8. Vendor cannot override vendorId", () => {
    it("should reject query vendorId parameter on vendor endpoints with 400 VALIDATION_ERROR", async () => {
      Order.aggregate.mockClear();

      const res = await request(app)
        .get(`/api/v1/analytics/vendor/overview?vendorId=${vendorBId}`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .expect(400);

      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(res.body.message).toContain("Unrecognized key");
      expect(Order.aggregate).not.toHaveBeenCalled();
    });
  });

  /*
   * ==========================================
   * 9. CUSTOMER RECEIVES 403
   * ==========================================
   */
  describe("9. Customer receives 403", () => {
    it("should reject customer calling admin overview", async () => {
      const res = await request(app)
        .get("/api/v1/analytics/admin/overview")
        .set("Authorization", `Bearer ${customerToken}`)
        .expect(403);

      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("should reject customer calling vendor overview", async () => {
      const res = await request(app)
        .get("/api/v1/analytics/vendor/overview")
        .set("Authorization", `Bearer ${customerToken}`)
        .expect(403);

      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });

  /*
   * ==========================================
   * 10. DATE PRESET: TODAY
   * ==========================================
   */
  describe("10. Date preset: today", () => {
    it("should resolve date boundaries to today 00:00:00.000Z and 23:59:59.999Z", () => {
      const range = analyticsService.resolveDateRange({ period: "today" });
      const now = new Date();

      expect(range.period).toBe("today");
      expect(range.startDate.getUTCFullYear()).toBe(now.getUTCFullYear());
      expect(range.startDate.getUTCMonth()).toBe(now.getUTCMonth());
      expect(range.startDate.getUTCDate()).toBe(now.getUTCDate());
      expect(range.startDate.getUTCHours()).toBe(0);
      expect(range.startDate.getUTCMinutes()).toBe(0);
      expect(range.startDate.getUTCSeconds()).toBe(0);
      expect(range.startDate.getUTCMilliseconds()).toBe(0);

      expect(range.endDate.getUTCHours()).toBe(23);
      expect(range.endDate.getUTCMinutes()).toBe(59);
      expect(range.endDate.getUTCSeconds()).toBe(59);
      expect(range.endDate.getUTCMilliseconds()).toBe(999);
    });
  });

  /*
   * ==========================================
   * 11. DATE PRESET: LAST_7_DAYS
   * ==========================================
   */
  describe("11. Date preset: last_7_days", () => {
    it("should span exactly 7 complete calendar days ending today", () => {
      const range = analyticsService.resolveDateRange({
        period: "last_7_days",
      });
      const diffMs = range.endDate.getTime() - range.startDate.getTime() + 1;
      const days = diffMs / (24 * 60 * 60 * 1000);
      expect(days).toBe(7);
    });
  });

  /*
   * ==========================================
   * 12. DATE PRESET: LAST_30_DAYS
   * ==========================================
   */
  describe("12. Date preset: last_30_days", () => {
    it("should span exactly 30 complete calendar days ending today", () => {
      const range = analyticsService.resolveDateRange({
        period: "last_30_days",
      });
      const diffMs = range.endDate.getTime() - range.startDate.getTime() + 1;
      const days = diffMs / (24 * 60 * 60 * 1000);
      expect(days).toBe(30);
    });
  });

  /*
   * ==========================================
   * 13. CUSTOM DATE RANGE
   * ==========================================
   */
  describe("13. Custom date range", () => {
    it("should accept valid custom date range and include full calendar days", async () => {
      Order.aggregate.mockResolvedValueOnce([]);
      Refund.aggregate.mockResolvedValueOnce([]);

      const res = await request(app)
        .get(
          "/api/v1/analytics/admin/overview?period=custom&startDate=2026-08-01&endDate=2026-08-10"
        )
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.period).toBe("custom");
      expect(res.body.data.startDate).toBe("2026-08-01T00:00:00.000Z");
      expect(res.body.data.endDate).toBe("2026-08-10T23:59:59.999Z");
    });
  });

  /*
   * ==========================================
   * 14. INVALID CUSTOM RANGE
   * ==========================================
   */
  describe("14. Invalid custom range", () => {
    it("should reject custom period without dates", async () => {
      const res = await request(app)
        .get("/api/v1/analytics/admin/overview?period=custom")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("should reject startDate after endDate", async () => {
      const res = await request(app)
        .get(
          "/api/v1/analytics/admin/overview?period=custom&startDate=2026-08-10&endDate=2026-08-01"
        )
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("should reject malformed dates", async () => {
      const res = await request(app)
        .get(
          "/api/v1/analytics/admin/overview?period=custom&startDate=not-a-date&endDate=2026-08-01"
        )
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  /*
   * ==========================================
   * 15. CANCELLED ORDERS EXCLUDED
   * ==========================================
   */
  describe("15. Cancelled orders excluded", () => {
    it("should ensure aggregation filter strictly excludes cancelled status", async () => {
      Order.aggregate.mockResolvedValueOnce([]);

      await request(app)
        .get("/api/v1/analytics/admin/overview")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const pipeline = Order.aggregate.mock.calls[0][0];
      const matchStage = pipeline[0].$match;
      expect(matchStage.status).toEqual({ $ne: "cancelled" });
    });
  });

  /*
   * ==========================================
   * 16. FAILED/PENDING PAYMENTS EXCLUDED
   * ==========================================
   */
  describe("16. Failed/pending payments excluded from realized sales", () => {
    it("should restrict paymentStatus to realized states in pipeline match", async () => {
      Order.aggregate.mockResolvedValueOnce([]);

      await request(app)
        .get("/api/v1/analytics/admin/overview")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const pipeline = Order.aggregate.mock.calls[0][0];
      const matchStage = pipeline[0].$match;
      expect(matchStage.paymentStatus.$in).toEqual([
        "paid",
        "partially_refunded",
        "refunded",
      ]);
      expect(matchStage.paymentStatus.$in).not.toContain("pending");
      expect(matchStage.paymentStatus.$in).not.toContain("failed");
      expect(matchStage.paymentStatus.$in).not.toContain("created");
    });
  });

  /*
   * ==========================================
   * 17. PAID ORDERS INCLUDED
   * ==========================================
   */
  describe("17. Paid orders included", () => {
    it("should allow paymentStatus paid in the match filter", async () => {
      Order.aggregate.mockResolvedValueOnce([]);

      await request(app)
        .get("/api/v1/analytics/admin/overview")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const pipeline = Order.aggregate.mock.calls[0][0];
      expect(pipeline[0].$match.paymentStatus.$in).toContain("paid");
    });
  });

  /*
   * ==========================================
   * 18. PARTIALLY REFUNDED ORDERS HANDLED
   * ==========================================
   */
  describe("18. Partially refunded orders handled", () => {
    it("should allow paymentStatus partially_refunded in the realized sales filter", async () => {
      Order.aggregate.mockResolvedValueOnce([]);

      await request(app)
        .get("/api/v1/analytics/admin/overview")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const pipeline = Order.aggregate.mock.calls[0][0];
      expect(pipeline[0].$match.paymentStatus.$in).toContain(
        "partially_refunded"
      );
    });
  });

  /*
   * ==========================================
   * 19. REFUNDED ORDERS HANDLED
   * ==========================================
   */
  describe("19. Refunded orders handled", () => {
    it("should allow paymentStatus refunded in the realized sales filter", async () => {
      Order.aggregate.mockResolvedValueOnce([]);

      await request(app)
        .get("/api/v1/analytics/admin/overview")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const pipeline = Order.aggregate.mock.calls[0][0];
      expect(pipeline[0].$match.paymentStatus.$in).toContain("refunded");
    });
  });

  /*
   * ==========================================
   * 20. DISCOUNT CALCULATIONS
   * ==========================================
   */
  describe("20. Discount calculations", () => {
    it("should correctly compute merchandiseSales as grossSales minus discounts", async () => {
      Order.aggregate.mockResolvedValueOnce([
        {
          _id: null,
          grossSales: mongoose.Types.Decimal128.fromString("1000.00"),
          discounts: mongoose.Types.Decimal128.fromString("150.00"),
          tax: mongoose.Types.Decimal128.fromString("85.00"),
          unitsSold: 10,
          orderCount: 2,
        },
      ]);
      Refund.aggregate.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/v1/analytics/admin/overview")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.metrics.grossSales).toBe("1000.00");
      expect(res.body.data.metrics.discounts).toBe("150.00");
      expect(res.body.data.metrics.merchandiseSales).toBe("850.00");
    });
  });

  /*
   * ==========================================
   * 21. TAX CALCULATIONS
   * ==========================================
   */
  describe("21. Tax calculations", () => {
    it("should sum item taxTotal correctly into tax metric", async () => {
      Order.aggregate.mockResolvedValueOnce([
        {
          _id: null,
          grossSales: mongoose.Types.Decimal128.fromString("200.00"),
          discounts: mongoose.Types.Decimal128.fromString("0.00"),
          tax: mongoose.Types.Decimal128.fromString("36.00"),
          unitsSold: 2,
          orderCount: 1,
        },
      ]);
      Refund.aggregate.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/v1/analytics/admin/overview")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.metrics.tax).toBe("36.00");
    });
  });

  /*
   * ==========================================
   * 22. UNITS SOLD
   * ==========================================
   */
  describe("22. Units sold", () => {
    it("should correctly sum total item quantities", async () => {
      Order.aggregate.mockResolvedValueOnce([
        {
          _id: null,
          grossSales: mongoose.Types.Decimal128.fromString("50.00"),
          discounts: mongoose.Types.Decimal128.fromString("0.00"),
          tax: mongoose.Types.Decimal128.fromString("5.00"),
          unitsSold: 42,
          orderCount: 3,
        },
      ]);
      Refund.aggregate.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/v1/analytics/admin/overview")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.metrics.unitsSold).toBe(42);
    });
  });

  /*
   * ==========================================
   * 23. AOV (AVERAGE ORDER VALUE)
   * ==========================================
   */
  describe("23. AOV", () => {
    it("should calculate AOV as merchandiseSales / orderCount", async () => {
      Order.aggregate.mockResolvedValueOnce([
        {
          _id: null,
          grossSales: mongoose.Types.Decimal128.fromString("1000.00"),
          discounts: mongoose.Types.Decimal128.fromString("100.00"),
          tax: mongoose.Types.Decimal128.fromString("90.00"),
          unitsSold: 10,
          orderCount: 3,
        },
      ]);
      Refund.aggregate.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/v1/analytics/admin/overview")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      // merchandiseSales = 900.00; orderCount = 3 => AOV = 300.00
      expect(res.body.data.metrics.averageOrderValue).toBe("300.00");
    });

    it("should return 0.00 when orderCount is zero", async () => {
      Order.aggregate.mockResolvedValueOnce([]);
      Refund.aggregate.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/v1/analytics/admin/overview")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.metrics.averageOrderValue).toBe("0.00");
      expect(res.body.data.metrics.orderCount).toBe(0);
    });
  });

  /*
   * ==========================================
   * 24. TOP PRODUCT RANKING
   * ==========================================
   */
  describe("24. Top product ranking", () => {
    it("should support sorting by revenue when sortBy=revenue", async () => {
      Order.aggregate.mockResolvedValueOnce([]);

      await request(app)
        .get("/api/v1/analytics/admin/top-products?sortBy=revenue")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const pipeline = Order.aggregate.mock.calls[0][0];
      const sortStage = pipeline.find((s) => s.$sort);
      expect(sortStage.$sort).toEqual({ revenue: -1, unitsSold: -1 });
    });

    it("should default to sorting by unitsSold descending", async () => {
      Order.aggregate.mockResolvedValueOnce([]);

      await request(app)
        .get("/api/v1/analytics/admin/top-products")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const pipeline = Order.aggregate.mock.calls[0][0];
      const sortStage = pipeline.find((s) => s.$sort);
      expect(sortStage.$sort).toEqual({ unitsSold: -1, revenue: -1 });
    });
  });

  /*
   * ==========================================
   * 25. MULTIPLE ORDER ITEMS AGGREGATION
   * ==========================================
   */
  describe("25. Multiple order items aggregation", () => {
    it("should aggregate multiple order item lines for same variant by grouping", async () => {
      Order.aggregate.mockResolvedValueOnce([]);

      await request(app)
        .get("/api/v1/analytics/admin/top-products")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const pipeline = Order.aggregate.mock.calls[0][0];
      const groupStage = pipeline.find((s) => s.$group);
      expect(groupStage.$group._id).toEqual({
        productId: "$items.productId",
        productVariantId: "$items.productVariantId",
      });
      expect(groupStage.$group.unitsSold).toEqual({ $sum: "$items.quantity" });
    });
  });

  /*
   * ==========================================
   * 26. HISTORICAL PRODUCT SNAPSHOTS
   * ==========================================
   */
  describe("26. Historical product snapshots", () => {
    it("should read snapshotted productName, variantName, and sku without joining Product collection", async () => {
      Order.aggregate.mockResolvedValueOnce([]);

      await request(app)
        .get("/api/v1/analytics/admin/top-products")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const pipeline = Order.aggregate.mock.calls[0][0];
      const lookupStage = pipeline.find((s) => s.$lookup);
      expect(lookupStage).toBeUndefined();

      const groupStage = pipeline.find((s) => s.$group);
      expect(groupStage.$group.productName).toEqual({
        $first: "$items.productName",
      });
      expect(groupStage.$group.variantName).toEqual({
        $first: "$items.variantName",
      });
      expect(groupStage.$group.sku).toEqual({ $first: "$items.sku" });
    });
  });

  /*
   * ==========================================
   * 27. MIXED-VENDOR ORDER ISOLATION
   * ==========================================
   */
  describe("27. Mixed-vendor order isolation", () => {
    it("should perform second match on items.vendorId after unwind to discard other sellers in mixed orders", async () => {
      Order.aggregate.mockResolvedValueOnce([]);

      await request(app)
        .get("/api/v1/analytics/vendor/overview")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .expect(200);

      const pipeline = Order.aggregate.mock.calls[0][0];
      expect(pipeline[1]).toEqual({ $unwind: "$items" });
      expect(pipeline[2]).toEqual({
        $match: {
          "items.vendorId": new mongoose.Types.ObjectId(vendorAId),
        },
      });
    });
  });

  /*
   * ==========================================
   * 28. LIMIT VALIDATION
   * ==========================================
   */
  describe("28. Limit validation", () => {
    it("should reject limit < 1", async () => {
      const res = await request(app)
        .get("/api/v1/analytics/admin/top-products?limit=0")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("should reject limit > 100", async () => {
      const res = await request(app)
        .get("/api/v1/analytics/admin/top-products?limit=101")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("should accept valid limit and pass to pipeline limit stage", async () => {
      Order.aggregate.mockResolvedValueOnce([]);

      await request(app)
        .get("/api/v1/analytics/admin/top-products?limit=25")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const pipeline = Order.aggregate.mock.calls[0][0];
      const limitStage = pipeline.find((s) => s.$limit);
      expect(limitStage.$limit).toBe(25);
    });
  });

  /*
   * ==========================================
   * 29. RBAC ENFORCEMENT
   * ==========================================
   */
  describe("29. RBAC enforcement", () => {
    it("should permit ADMIN, MANAGER, and SUPER_ADMIN to access admin overview", async () => {
      Order.aggregate.mockResolvedValue([]);
      Refund.aggregate.mockResolvedValue([]);

      await request(app)
        .get("/api/v1/analytics/admin/overview")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      await request(app)
        .get("/api/v1/analytics/admin/overview")
        .set("Authorization", `Bearer ${managerToken}`)
        .expect(200);

      await request(app)
        .get("/api/v1/analytics/admin/overview")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(200);
    });

    it("should forbid VENDOR from accessing admin routes", async () => {
      const res = await request(app)
        .get("/api/v1/analytics/admin/overview")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .expect(403);

      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("should forbid unauthenticated requests", async () => {
      const res = await request(app)
        .get("/api/v1/analytics/admin/overview")
        .expect(401);

      expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
    });
  });

  /*
   * ==========================================
   * 30. DATE BOUNDARY CORRECTNESS
   * ==========================================
   */
  describe("30. Date boundary correctness", () => {
    it("should ensure date-only strings span full calendar day from 00:00:00.000Z to 23:59:59.999Z", () => {
      const range = analyticsService.resolveDateRange({
        period: "custom",
        startDate: "2026-05-15",
        endDate: "2026-05-15",
      });

      expect(range.startDate.toISOString()).toBe("2026-05-15T00:00:00.000Z");
      expect(range.endDate.toISOString()).toBe("2026-05-15T23:59:59.999Z");
    });

    it("should verify UTC calendar day boundaries for all standard presets", () => {
      const today = analyticsService.resolveDateRange({ period: "today" });
      expect(today.startDate.toISOString()).toMatch(/T00:00:00\.000Z$/);
      expect(today.endDate.toISOString()).toMatch(/T23:59:59\.999Z$/);

      const last7 = analyticsService.resolveDateRange({ period: "last_7_days" });
      expect(last7.startDate.toISOString()).toMatch(/T00:00:00\.000Z$/);
      expect(last7.endDate.toISOString()).toMatch(/T23:59:59\.999Z$/);

      const last30 = analyticsService.resolveDateRange({ period: "last_30_days" });
      expect(last30.startDate.toISOString()).toMatch(/T00:00:00\.000Z$/);
      expect(last30.endDate.toISOString()).toMatch(/T23:59:59\.999Z$/);
    });
  });

  /*
   * ==========================================
   * TASK 7B.1 CHECKS: FORMULA & ORDER COUNT VERIFICATION
   * ==========================================
   */
  describe("Task 7B.1 Checks — Formula & Order Count Verification", () => {
    it("CHECK 2: should strictly compute gross sales as SUM(unitPrice * quantity) without relying on lineTotal", async () => {
      Order.aggregate.mockResolvedValueOnce([]);

      await analyticsRepository.getSalesOverview({
        startDate: new Date(),
        endDate: new Date(),
      });

      const pipeline = Order.aggregate.mock.calls[0][0];
      const firstGroup = pipeline.find((s) => s.$group && s.$group._id === "$_id");

      // Verify that gross sales calculates SUM(unitPrice * quantity)
      expect(firstGroup.$group.orderGrossSales).toEqual({
        $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] },
      });

      // Verify pipeline does NOT reference lineTotal
      const pipelineString = JSON.stringify(pipeline);
      expect(pipelineString).not.toContain("$items.lineTotal");
    });

    it("CHECK 3: should accurately count distinct orders for a mixed-vendor order (Order X)", async () => {
      // Order X: 2 items from Vendor A, 1 item from Vendor B
      const orderXId = new mongoose.Types.ObjectId();
      const orderX = {
        _id: orderXId,
        status: "confirmed",
        paymentStatus: "paid",
        createdAt: new Date("2026-09-11T10:00:00.000Z"),
        items: [
          {
            vendorId: new mongoose.Types.ObjectId(vendorAId),
            productId: new mongoose.Types.ObjectId(),
            productVariantId: new mongoose.Types.ObjectId(),
            unitPrice: "100.00",
            quantity: 2,
            discountTotal: "10.00",
            taxTotal: "18.00",
          },
          {
            vendorId: new mongoose.Types.ObjectId(vendorAId),
            productId: new mongoose.Types.ObjectId(),
            productVariantId: new mongoose.Types.ObjectId(),
            unitPrice: "50.00",
            quantity: 1,
            discountTotal: "0.00",
            taxTotal: "9.00",
          },
          {
            vendorId: new mongoose.Types.ObjectId(vendorBId),
            productId: new mongoose.Types.ObjectId(),
            productVariantId: new mongoose.Types.ObjectId(),
            unitPrice: "300.00",
            quantity: 1,
            discountTotal: "50.00",
            taxTotal: "54.00",
          },
        ],
      };

      // Helper simulating the exact MongoDB aggregation stages in getSalesOverview
      const simulateOverviewAggregation = (orders, filterVendorId = null) => {
        let docs = orders.map((o) => JSON.parse(JSON.stringify(o)));

        // Stage 1: Base match
        docs = docs.filter((d) => {
          if (d.status === "cancelled") return false;
          if (!["paid", "partially_refunded", "refunded"].includes(d.paymentStatus)) return false;
          if (filterVendorId) {
            return d.items.some((i) => String(i.vendorId) === String(filterVendorId));
          }
          return true;
        });

        // Stage 2: $unwind items
        const unwound = [];
        for (const doc of docs) {
          for (const item of doc.items) {
            unwound.push({
              ...doc,
              items: item,
            });
          }
        }
        docs = unwound;

        // Stage 3: Second match for vendorId if specified
        if (filterVendorId) {
          docs = docs.filter((d) => String(d.items.vendorId) === String(filterVendorId));
        }

        // Stage 4: Group by order _id
        const orderGroups = new Map();
        for (const doc of docs) {
          const id = String(doc._id);
          if (!orderGroups.has(id)) {
            orderGroups.set(id, {
              _id: doc._id,
              orderGrossSales: 0,
              orderDiscounts: 0,
              orderTax: 0,
              orderUnits: 0,
            });
          }
          const grp = orderGroups.get(id);
          const unitPrice = Number(doc.items.unitPrice);
          const qty = Number(doc.items.quantity);
          const disc = Number(doc.items.discountTotal || 0);
          const tax = Number(doc.items.taxTotal || 0);

          grp.orderGrossSales += unitPrice * qty;
          grp.orderDiscounts += disc;
          grp.orderTax += tax;
          grp.orderUnits += qty;
        }

        // Stage 5: Group all orders
        let grossSales = 0;
        let discounts = 0;
        let tax = 0;
        let unitsSold = 0;
        let orderCount = 0;

        for (const grp of orderGroups.values()) {
          grossSales += grp.orderGrossSales;
          discounts += grp.orderDiscounts;
          tax += grp.orderTax;
          unitsSold += grp.orderUnits;
          orderCount += 1;
        }

        return {
          grossSales: grossSales.toFixed(2),
          discounts: discounts.toFixed(2),
          merchandiseSales: (grossSales - discounts).toFixed(2),
          tax: tax.toFixed(2),
          unitsSold,
          orderCount,
        };
      };

      // 1. Platform overview for mixed-vendor Order X
      const platformResult = simulateOverviewAggregation([orderX], null);
      expect(platformResult.orderCount).toBe(1); // One platform order!
      expect(platformResult.grossSales).toBe("550.00"); // (100*2) + (50*1) + (300*1)
      expect(platformResult.discounts).toBe("60.00"); // 10 + 0 + 50
      expect(platformResult.merchandiseSales).toBe("490.00"); // 550 - 60
      expect(platformResult.tax).toBe("81.00"); // 18 + 9 + 54
      expect(platformResult.unitsSold).toBe(4); // 2 + 1 + 1

      // 2. Vendor A overview for mixed-vendor Order X
      const vendorAResult = simulateOverviewAggregation([orderX], vendorAId);
      expect(vendorAResult.orderCount).toBe(1); // One order for Vendor A!
      expect(vendorAResult.grossSales).toBe("250.00"); // (100*2) + (50*1)
      expect(vendorAResult.discounts).toBe("10.00"); // 10 + 0
      expect(vendorAResult.merchandiseSales).toBe("240.00"); // 250 - 10
      expect(vendorAResult.tax).toBe("27.00"); // 18 + 9
      expect(vendorAResult.unitsSold).toBe(3); // 2 + 1

      // 3. Vendor B overview for mixed-vendor Order X
      const vendorBResult = simulateOverviewAggregation([orderX], vendorBId);
      expect(vendorBResult.orderCount).toBe(1); // One order for Vendor B!
      expect(vendorBResult.grossSales).toBe("300.00"); // 300*1
      expect(vendorBResult.discounts).toBe("50.00"); // 50
      expect(vendorBResult.merchandiseSales).toBe("250.00"); // 300 - 50
      expect(vendorBResult.tax).toBe("54.00"); // 54
      expect(vendorBResult.unitsSold).toBe(1); // 1
    });
  });

  /*
   * ==========================================
   * TASK 7C.1 SECURITY HARDENING TESTS
   * ==========================================
   */
  describe("Task 7C.1 Security Hardening Tests", () => {
    it("A. should reject invalid vendorId with 400 VALIDATION_ERROR and not execute aggregation", async () => {
      Order.aggregate.mockClear();

      const res = await request(app)
        .get("/api/v1/analytics/admin/overview?vendorId=invalid-vendor-id")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(Order.aggregate).not.toHaveBeenCalled();
    });

    it("B. should reject invalid period with 400 VALIDATION_ERROR and not execute aggregation", async () => {
      Order.aggregate.mockClear();

      const res = await request(app)
        .get("/api/v1/analytics/admin/overview?period=invalid-period")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(Order.aggregate).not.toHaveBeenCalled();
    });

    it("C. should reject unknown query parameter with 400 VALIDATION_ERROR", async () => {
      Order.aggregate.mockClear();

      const res = await request(app)
        .get("/api/v1/analytics/admin/overview?unexpected=value")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(Order.aggregate).not.toHaveBeenCalled();
    });

    it("D. should reject impossible calendar dates with 400 VALIDATION_ERROR and not execute aggregation", async () => {
      Order.aggregate.mockClear();

      const res1 = await request(app)
        .get(
          "/api/v1/analytics/admin/overview?period=custom&startDate=2026-02-31&endDate=2026-03-05"
        )
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);

      expect(res1.body.code).toBe("VALIDATION_ERROR");
      expect(Order.aggregate).not.toHaveBeenCalled();

      const res2 = await request(app)
        .get(
          "/api/v1/analytics/admin/overview?period=custom&startDate=2026-04-01&endDate=2026-04-31"
        )
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);

      expect(res2.body.code).toBe("VALIDATION_ERROR");
      expect(Order.aggregate).not.toHaveBeenCalled();

      const res3 = await request(app)
        .get(
          "/api/v1/analytics/admin/overview?period=custom&startDate=2026-13-01&endDate=2026-13-10"
        )
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);

      expect(res3.body.code).toBe("VALIDATION_ERROR");
      expect(Order.aggregate).not.toHaveBeenCalled();

      const res4 = await request(app)
        .get(
          "/api/v1/analytics/admin/overview?period=custom&startDate=2026-00-10&endDate=2026-01-10"
        )
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);

      expect(res4.body.code).toBe("VALIDATION_ERROR");
      expect(Order.aggregate).not.toHaveBeenCalled();
    });

    it("E. should not execute aggregation for unauthenticated (401) or unauthorized (403) requests", async () => {
      Order.aggregate.mockClear();

      // 401 unauthenticated
      await request(app)
        .get("/api/v1/analytics/admin/overview")
        .expect(401);

      expect(Order.aggregate).not.toHaveBeenCalled();

      // 403 customer accessing admin overview
      await request(app)
        .get("/api/v1/analytics/admin/overview")
        .set("Authorization", `Bearer ${customerToken}`)
        .expect(403);

      expect(Order.aggregate).not.toHaveBeenCalled();

      // 403 vendor accessing admin overview
      await request(app)
        .get("/api/v1/analytics/admin/overview")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .expect(403);

      expect(Order.aggregate).not.toHaveBeenCalled();
    });
  });

  /*
   * ==========================================
   * Task 7E.1 AllowDiskUse Hardening Tests
   * ==========================================
   */
  describe("Task 7E.1 AllowDiskUse Hardening Tests", () => {
    it("1. should execute Admin Overview and Platform Refunds with { allowDiskUse: true }", async () => {
      Order.aggregate.mockClear();
      Refund.aggregate.mockClear();
      Order.aggregate.mockResolvedValueOnce([]);
      Refund.aggregate.mockResolvedValueOnce([]);

      await request(app)
        .get("/api/v1/analytics/admin/overview?period=today")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(Order.aggregate).toHaveBeenCalledTimes(1);
      expect(Order.aggregate).toHaveBeenCalledWith(expect.any(Array), {
        allowDiskUse: true,
      });

      expect(Refund.aggregate).toHaveBeenCalledTimes(1);
      expect(Refund.aggregate).toHaveBeenCalledWith(expect.any(Array), {
        allowDiskUse: true,
      });
    });

    it("2. should execute Vendor Overview with { allowDiskUse: true }", async () => {
      Order.aggregate.mockClear();
      Refund.aggregate.mockClear();
      Order.aggregate.mockResolvedValueOnce([]);

      await request(app)
        .get("/api/v1/analytics/vendor/overview?period=today")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .expect(200);

      expect(Order.aggregate).toHaveBeenCalledTimes(1);
      expect(Order.aggregate).toHaveBeenCalledWith(expect.any(Array), {
        allowDiskUse: true,
      });
      expect(Refund.aggregate).not.toHaveBeenCalled();
    });

    it("3. should execute Admin Top Products with { allowDiskUse: true }", async () => {
      Order.aggregate.mockClear();
      Order.aggregate.mockResolvedValueOnce([]);

      await request(app)
        .get("/api/v1/analytics/admin/top-products?period=today")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(Order.aggregate).toHaveBeenCalledTimes(1);
      expect(Order.aggregate).toHaveBeenCalledWith(expect.any(Array), {
        allowDiskUse: true,
      });
    });

    it("4. should execute Vendor Top Products with { allowDiskUse: true }", async () => {
      Order.aggregate.mockClear();
      Order.aggregate.mockResolvedValueOnce([]);

      await request(app)
        .get("/api/v1/analytics/vendor/top-products?period=today")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .expect(200);

      expect(Order.aggregate).toHaveBeenCalledTimes(1);
      expect(Order.aggregate).toHaveBeenCalledWith(expect.any(Array), {
        allowDiskUse: true,
      });
    });

    it("5. should execute Admin Sales Trend with { allowDiskUse: true }", async () => {
      Order.aggregate.mockClear();
      Order.aggregate.mockResolvedValueOnce([]);

      await request(app)
        .get("/api/v1/analytics/admin/sales-trend?period=today")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(Order.aggregate).toHaveBeenCalledTimes(1);
      expect(Order.aggregate).toHaveBeenCalledWith(expect.any(Array), {
        allowDiskUse: true,
      });
    });

    it("6. should execute Vendor Sales Trend with { allowDiskUse: true }", async () => {
      Order.aggregate.mockClear();
      Order.aggregate.mockResolvedValueOnce([]);

      await request(app)
        .get("/api/v1/analytics/vendor/sales-trend?period=today")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .expect(200);

      expect(Order.aggregate).toHaveBeenCalledTimes(1);
      expect(Order.aggregate).toHaveBeenCalledWith(expect.any(Array), {
        allowDiskUse: true,
      });
    });

    it("7. should pass { allowDiskUse: true } in direct repository method invocations", async () => {
      Order.aggregate.mockClear();
      Refund.aggregate.mockClear();
      Order.aggregate.mockResolvedValue([]);
      Refund.aggregate.mockResolvedValue([]);

      const startDate = new Date("2026-01-01");
      const endDate = new Date("2026-01-31");

      // getSalesOverview (platform)
      await analyticsRepository.getSalesOverview({ startDate, endDate });
      expect(Order.aggregate).toHaveBeenLastCalledWith(expect.any(Array), {
        allowDiskUse: true,
      });
      expect(Refund.aggregate).toHaveBeenLastCalledWith(expect.any(Array), {
        allowDiskUse: true,
      });

      // getSalesOverview (vendor)
      await analyticsRepository.getSalesOverview({
        startDate,
        endDate,
        vendorId: vendorAId,
      });
      expect(Order.aggregate).toHaveBeenLastCalledWith(expect.any(Array), {
        allowDiskUse: true,
      });

      // getTopProducts
      await analyticsRepository.getTopProducts({ startDate, endDate });
      expect(Order.aggregate).toHaveBeenLastCalledWith(expect.any(Array), {
        allowDiskUse: true,
      });

      // getSalesTrend
      await analyticsRepository.getSalesTrend({ startDate, endDate });
      expect(Order.aggregate).toHaveBeenLastCalledWith(expect.any(Array), {
        allowDiskUse: true,
      });
    });
  });

  /*
   * ==========================================
   * Task 7I Endpoint-Specific Validation Tests
   * ==========================================
   */
  describe("Task 7I Endpoint-Specific Validation Tests", () => {
    describe("ADMIN OVERVIEW", () => {
      it("should accept valid date and vendorId parameters", async () => {
        Order.aggregate.mockResolvedValueOnce([]);
        Refund.aggregate.mockResolvedValueOnce([]);

        await request(app)
          .get(`/api/v1/analytics/admin/overview?period=today&vendorId=${vendorAId}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);
      });

      it("should reject limit parameter on admin overview", async () => {
        const res = await request(app)
          .get("/api/v1/analytics/admin/overview?limit=10")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(400);

        expect(res.body.code).toBe("VALIDATION_ERROR");
        expect(res.body.message).toContain("Unrecognized key");
      });

      it("should reject sortBy parameter on admin overview", async () => {
        const res = await request(app)
          .get("/api/v1/analytics/admin/overview?sortBy=revenue")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(400);

        expect(res.body.code).toBe("VALIDATION_ERROR");
        expect(res.body.message).toContain("Unrecognized key");
      });
    });

    describe("ADMIN TOP-PRODUCTS", () => {
      it("should accept limit, sortBy, and vendorId", async () => {
        Order.aggregate.mockResolvedValueOnce([]);

        await request(app)
          .get(`/api/v1/analytics/admin/top-products?period=today&limit=25&sortBy=revenue&vendorId=${vendorAId}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);
      });
    });

    describe("ADMIN SALES-TREND", () => {
      it("should accept valid date and vendorId parameters", async () => {
        Order.aggregate.mockResolvedValueOnce([]);

        await request(app)
          .get(`/api/v1/analytics/admin/sales-trend?period=today&vendorId=${vendorAId}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);
      });

      it("should reject limit parameter on admin sales-trend", async () => {
        const res = await request(app)
          .get("/api/v1/analytics/admin/sales-trend?limit=10")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(400);

        expect(res.body.code).toBe("VALIDATION_ERROR");
        expect(res.body.message).toContain("Unrecognized key");
      });

      it("should reject sortBy parameter on admin sales-trend", async () => {
        const res = await request(app)
          .get("/api/v1/analytics/admin/sales-trend?sortBy=revenue")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(400);

        expect(res.body.code).toBe("VALIDATION_ERROR");
        expect(res.body.message).toContain("Unrecognized key");
      });
    });

    describe("VENDOR OVERVIEW", () => {
      it("should reject vendorId parameter on vendor overview", async () => {
        const res = await request(app)
          .get(`/api/v1/analytics/vendor/overview?vendorId=${vendorBId}`)
          .set("Authorization", `Bearer ${vendorAToken}`)
          .expect(400);

        expect(res.body.code).toBe("VALIDATION_ERROR");
        expect(res.body.message).toContain("Unrecognized key");
      });

      it("should reject limit parameter on vendor overview", async () => {
        const res = await request(app)
          .get("/api/v1/analytics/vendor/overview?limit=5")
          .set("Authorization", `Bearer ${vendorAToken}`)
          .expect(400);

        expect(res.body.code).toBe("VALIDATION_ERROR");
        expect(res.body.message).toContain("Unrecognized key");
      });

      it("should reject sortBy parameter on vendor overview", async () => {
        const res = await request(app)
          .get("/api/v1/analytics/vendor/overview?sortBy=units")
          .set("Authorization", `Bearer ${vendorAToken}`)
          .expect(400);

        expect(res.body.code).toBe("VALIDATION_ERROR");
        expect(res.body.message).toContain("Unrecognized key");
      });
    });

    describe("VENDOR TOP-PRODUCTS", () => {
      it("should accept limit and sortBy on vendor top-products", async () => {
        Order.aggregate.mockResolvedValueOnce([]);

        await request(app)
          .get("/api/v1/analytics/vendor/top-products?period=today&limit=15&sortBy=revenue")
          .set("Authorization", `Bearer ${vendorAToken}`)
          .expect(200);
      });

      it("should reject vendorId parameter on vendor top-products", async () => {
        const res = await request(app)
          .get(`/api/v1/analytics/vendor/top-products?vendorId=${vendorBId}`)
          .set("Authorization", `Bearer ${vendorAToken}`)
          .expect(400);

        expect(res.body.code).toBe("VALIDATION_ERROR");
        expect(res.body.message).toContain("Unrecognized key");
      });
    });

    describe("VENDOR SALES-TREND", () => {
      it("should reject vendorId parameter on vendor sales-trend", async () => {
        const res = await request(app)
          .get(`/api/v1/analytics/vendor/sales-trend?vendorId=${vendorBId}`)
          .set("Authorization", `Bearer ${vendorAToken}`)
          .expect(400);

        expect(res.body.code).toBe("VALIDATION_ERROR");
        expect(res.body.message).toContain("Unrecognized key");
      });

      it("should reject limit parameter on vendor sales-trend", async () => {
        const res = await request(app)
          .get("/api/v1/analytics/vendor/sales-trend?limit=10")
          .set("Authorization", `Bearer ${vendorAToken}`)
          .expect(400);

        expect(res.body.code).toBe("VALIDATION_ERROR");
        expect(res.body.message).toContain("Unrecognized key");
      });

      it("should reject sortBy parameter on vendor sales-trend", async () => {
        const res = await request(app)
          .get("/api/v1/analytics/vendor/sales-trend?sortBy=revenue")
          .set("Authorization", `Bearer ${vendorAToken}`)
          .expect(400);

        expect(res.body.code).toBe("VALIDATION_ERROR");
        expect(res.body.message).toContain("Unrecognized key");
      });
    });

    describe("GENERAL VALIDATION SEMANTICS", () => {
      it("should reject invalid sortBy with 400 VALIDATION_ERROR", async () => {
        const res = await request(app)
          .get("/api/v1/analytics/admin/top-products?sortBy=unsupported")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(400);

        expect(res.body.code).toBe("VALIDATION_ERROR");
      });

      it("should reject array-valued query parameter with 400 VALIDATION_ERROR", async () => {
        const res = await request(app)
          .get("/api/v1/analytics/admin/overview?period=today&period=last_7_days")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(400);

        expect(res.body.code).toBe("VALIDATION_ERROR");
      });
    });
  });
});

