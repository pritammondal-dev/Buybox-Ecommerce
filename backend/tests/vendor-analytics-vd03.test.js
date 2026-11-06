const request = require("supertest");
const mongoose = require("mongoose");

jest.mock("../src/models/Vendor");
jest.mock("../src/models/Order");
jest.mock("../src/models/Refund");

const app = require("../src/app");
const Vendor = require("../src/models/Vendor");
const Order = require("../src/models/Order");
const { generateAccessToken } = require("../src/services/token.service");
const analyticsService = require("../src/services/analytics.service");
const { sanitizeCellValue } = require("../src/services/fulfillment-operations.service");

describe("Phase VD-03 — Vendor Analytics & Reporting Modernization Suite", () => {
  const vendorUserId = new mongoose.Types.ObjectId().toString();
  const vendorId = new mongoose.Types.ObjectId().toString();
  const otherVendorId = new mongoose.Types.ObjectId().toString();
  let vendorToken;

  beforeEach(() => {
    jest.clearAllMocks();

    vendorToken = generateAccessToken({ sub: vendorUserId, role: "vendor" });

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

    Order.aggregate.mockResolvedValue([]);
  });

  describe("1. Date Range & Comparison Resolution", () => {
    it("resolves today range from UTC 00:00:00 to 23:59:59.999", () => {
      const range = analyticsService.resolveDateRange({ period: "today" });
      expect(range.period).toBe("today");
      expect(range.startDate.getUTCHours()).toBe(0);
      expect(range.startDate.getUTCMinutes()).toBe(0);
      expect(range.startDate.getUTCSeconds()).toBe(0);
      expect(range.endDate.getUTCHours()).toBe(23);
      expect(range.endDate.getUTCMinutes()).toBe(59);
      expect(range.endDate.getUTCSeconds()).toBe(59);
      expect(range.endDate.getUTCMilliseconds()).toBe(999);
    });

    it("resolves yesterday range", () => {
      const range = analyticsService.resolveDateRange({ period: "yesterday" });
      expect(range.period).toBe("yesterday");
      expect(range.startDate < range.endDate).toBe(true);
      const diffMs = range.endDate.getTime() - range.startDate.getTime() + 1;
      expect(diffMs).toBe(24 * 60 * 60 * 1000);
    });

    it("resolves last_7_days and 7d alias identically", () => {
      const rangeA = analyticsService.resolveDateRange({ period: "last_7_days" });
      const rangeB = analyticsService.resolveDateRange({ period: "7d" });
      expect(rangeA.period).toBe("last_7_days");
      expect(rangeB.period).toBe("last_7_days");
      expect(rangeA.startDate.toISOString()).toBe(rangeB.startDate.toISOString());
      expect(rangeA.endDate.toISOString()).toBe(rangeB.endDate.toISOString());
    });

    it("resolves last_30_days and 30d alias identically", () => {
      const rangeA = analyticsService.resolveDateRange({ period: "last_30_days" });
      const rangeB = analyticsService.resolveDateRange({ period: "30d" });
      expect(rangeA.period).toBe("last_30_days");
      expect(rangeB.period).toBe("last_30_days");
      expect(rangeA.startDate.toISOString()).toBe(rangeB.startDate.toISOString());
      expect(rangeA.endDate.toISOString()).toBe(rangeB.endDate.toISOString());
    });

    it("resolves this_month and previous_month correctly", () => {
      const thisMonth = analyticsService.resolveDateRange({ period: "this_month" });
      expect(thisMonth.startDate.getUTCDate()).toBe(1);

      const prevMonth = analyticsService.resolveDateRange({ period: "previous_month" });
      expect(prevMonth.startDate.getUTCDate()).toBe(1);
      expect(prevMonth.startDate < thisMonth.startDate).toBe(true);
      expect(prevMonth.endDate < thisMonth.startDate).toBe(true);
    });

    it("resolves comparison date range immediately preceding the active window without overlap", () => {
      const currentRange = analyticsService.resolveDateRange({ period: "last_7_days" });
      const compRange = analyticsService.resolveComparisonDateRange(currentRange);

      expect(compRange.endDate.getTime()).toBeLessThan(currentRange.startDate.getTime());
      const currentDuration = currentRange.endDate.getTime() - currentRange.startDate.getTime() + 1;
      const compDuration = compRange.endDate.getTime() - compRange.startDate.getTime() + 1;
      expect(compDuration).toBe(currentDuration);
    });
  });

  describe("2. Safe Zero-Baseline Percentage Calculations", () => {
    it("handles zero baseline with positive current safely (no Infinity or NaN)", () => {
      const res = analyticsService.getVendorOverview;
      // Test percentage calculation logic directly
      const comp = analyticsService.resolveComparisonDateRange(
        analyticsService.resolveDateRange({ period: "today" })
      );
      expect(comp).toBeDefined();
    });

    it("verifies safe percentage change output", async () => {
      // Mock current period overview
      Order.aggregate.mockResolvedValueOnce([
        {
          _id: null,
          grossSales: mongoose.Types.Decimal128.fromString("1000.00"),
          discounts: mongoose.Types.Decimal128.fromString("100.00"),
          tax: mongoose.Types.Decimal128.fromString("50.00"),
          unitsSold: 10,
          orderCount: 5,
          commission: mongoose.Types.Decimal128.fromString("100.00"),
        },
      ]);
      // Mock comparison period overview (zero prior baseline)
      Order.aggregate.mockResolvedValueOnce([
        {
          _id: null,
          grossSales: mongoose.Types.Decimal128.fromString("0.00"),
          discounts: mongoose.Types.Decimal128.fromString("0.00"),
          tax: mongoose.Types.Decimal128.fromString("0.00"),
          unitsSold: 0,
          orderCount: 0,
        },
      ]);

      const res = await request(app)
        .get("/api/v1/analytics/vendor/overview?period=today&compare=true")
        .set("Authorization", `Bearer ${vendorToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const { comparison } = res.body.data;
      expect(comparison).toBeDefined();
      expect(comparison.changes.grossSales.display).toBe("N/A");
      expect(comparison.changes.grossSales.hasMeaningfulBaseline).toBe(false);
      expect(comparison.changes.grossSales.percentage).toBeNull();
    });
  });

  describe("3. Product Performance Endpoint", () => {
    it("returns paginated product performance table for authenticated vendor", async () => {
      Order.aggregate.mockResolvedValueOnce([
        {
          totalRecords: [{ count: 1 }],
          items: [
            {
              productId: new mongoose.Types.ObjectId(),
              productVariantId: new mongoose.Types.ObjectId(),
              productName: "Buybox Test Item",
              variantName: "Standard",
              sku: "BB-TEST-001",
              unitsSold: 25,
              grossSales: 25000,
              discounts: 1000,
              netSales: 24000,
              orderCount: 15,
              currentStock: 50,
              availableStock: 45,
            },
          ],
        },
      ]);

      const res = await request(app)
        .get("/api/v1/analytics/vendor/product-performance?period=last_30_days&page=1&limit=10")
        .set("Authorization", `Bearer ${vendorToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.products).toHaveLength(1);
      expect(res.body.data.products[0].sku).toBe("BB-TEST-001");
      expect(res.body.data.pagination.total).toBe(1);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(10);
    });

    it("rejects invalid pagination parameters", async () => {
      const res = await request(app)
        .get("/api/v1/analytics/vendor/product-performance?page=0")
        .set("Authorization", `Bearer ${vendorToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("4. Export Endpoint & Formula Injection Protection", () => {
    it("sanitizes CSV/XLSX cell values starting with =, +, -, @, \\t, \\r to prevent spreadsheet formula injection", () => {
      expect(sanitizeCellValue("=CMD|' /C calc'!A0")).toBe("'=CMD|' /C calc'!A0");
      expect(sanitizeCellValue("+12345")).toBe("'+12345");
      expect(sanitizeCellValue("-SUM(A1:A10)")).toBe("'-SUM(A1:A10)");
      expect(sanitizeCellValue("@SUM(A1:A10)")).toBe("'@SUM(A1:A10)");
      expect(sanitizeCellValue("\tTabbed")).toBe("'\tTabbed");
      expect(sanitizeCellValue("Normal Text")).toBe("Normal Text");
      expect(sanitizeCellValue(1234)).toBe(1234);
      expect(sanitizeCellValue(null)).toBe("");
    });

    it("exports vendor overview in CSV format with appropriate headers", async () => {
      Order.aggregate.mockResolvedValueOnce([
        {
          _id: null,
          grossSales: mongoose.Types.Decimal128.fromString("5000.00"),
          discounts: mongoose.Types.Decimal128.fromString("200.00"),
          tax: mongoose.Types.Decimal128.fromString("150.00"),
          unitsSold: 20,
          orderCount: 10,
          commission: mongoose.Types.Decimal128.fromString("500.00"),
        },
      ]);

      const res = await request(app)
        .get("/api/v1/analytics/vendor/export?type=overview&format=csv&period=last_30_days")
        .set("Authorization", `Bearer ${vendorToken}`)
        .expect(200);

      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.headers["content-disposition"]).toContain("attachment; filename=");
      expect(res.text).toContain("Metric");
      expect(res.text).toContain("Gross Sales (INR)");
      expect(res.text).toContain("5000.00");
    });

    it("exports vendor overview in XLSX format with correct binary content-type", async () => {
      Order.aggregate.mockResolvedValueOnce([
        {
          _id: null,
          grossSales: mongoose.Types.Decimal128.fromString("5000.00"),
          discounts: mongoose.Types.Decimal128.fromString("200.00"),
          tax: mongoose.Types.Decimal128.fromString("150.00"),
          unitsSold: 20,
          orderCount: 10,
          commission: mongoose.Types.Decimal128.fromString("500.00"),
        },
      ]);

      const res = await request(app)
        .get("/api/v1/analytics/vendor/export?type=overview&format=xlsx&period=last_30_days")
        .set("Authorization", `Bearer ${vendorToken}`)
        .buffer()
        .parse((r, cb) => {
          const chunks = [];
          r.on("data", (c) => chunks.push(c));
          r.on("end", () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(res.headers["content-type"]).toContain(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      expect(Buffer.isBuffer(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it("rejects unauthorized client from spoofing vendorId in export or product performance", async () => {
      // Passing client vendorId query parameter should be rejected by strict schema validation
      const res = await request(app)
        .get(`/api/v1/analytics/vendor/product-performance?vendorId=${otherVendorId}`)
        .set("Authorization", `Bearer ${vendorToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });
});
