/**
 * PHASE ADMIN DASHBOARD — Administrator Dashboard Backend Unit & Integration Tests
 */

const {
  resolveDateRange,
  getDashboardStats,
} = require("../src/services/admin-dashboard.service");
const mongoose = require("mongoose");
const Order = require("../src/models/Order");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");

jest.setTimeout(30000);

describe("ADMINISTRATOR DASHBOARD — Backend Service & Metrics Aggregation Tests", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI, { autoIndex: true });
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe("1. Date Range Resolution & Timezone Boundaries", () => {
    it("resolves 'today' range correctly with 00:00:00 to 23:59:59 boundaries", () => {
      const res = resolveDateRange("today");
      expect(res.range).toBe("today");
      expect(res.startDate.getHours()).toBe(0);
      expect(res.startDate.getMinutes()).toBe(0);
      expect(res.endDate.getHours()).toBe(23);
      expect(res.endDate.getMinutes()).toBe(59);
      expect(res.startDate <= res.endDate).toBe(true);
    });

    it("resolves '7d' range spanning 7 calendar days", () => {
      const res = resolveDateRange("7d");
      expect(res.range).toBe("7d");
      const diffDays = Math.round((res.endDate - res.startDate) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(7);
    });

    it("resolves '30d' default range spanning 30 calendar days", () => {
      const res = resolveDateRange("30d");
      expect(res.range).toBe("30d");
      const diffDays = Math.round((res.endDate - res.startDate) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(30);
    });

    it("resolves '90d' range spanning 90 calendar days", () => {
      const res = resolveDateRange("90d");
      expect(res.range).toBe("90d");
      const diffDays = Math.round((res.endDate - res.startDate) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(90);
    });

    it("falls back safely to 30d when given invalid custom dates", () => {
      const res = resolveDateRange("custom", "invalid-start", "invalid-end");
      expect(res.range).toBe("30d");
      const diffDays = Math.round((res.endDate - res.startDate) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(30);
    });

    it("accepts valid custom date boundaries", () => {
      const customStart = "2026-01-01T00:00:00.000Z";
      const customEnd = "2026-01-15T23:59:59.999Z";
      const res = resolveDateRange("custom", customStart, customEnd);
      expect(res.range).toBe("custom");
      expect(res.startDate.toISOString()).toBe(new Date(customStart).toISOString());
      expect(res.endDate.toISOString()).toBe(new Date(customEnd).toISOString());
    });
  });

  describe("2. RBAC & Permission Boundaries", () => {
    it("grants full access to all sections for super_admin role", async () => {
      const superAdminUser = {
        _id: new mongoose.Types.ObjectId(),
        role: "super_admin",
      };

      const result = await getDashboardStats(superAdminUser, { range: "7d" });
      expect(result).toBeDefined();
      expect(result.authorizedSections).toBeDefined();
      expect(result.authorizedSections.customers).toBe(true);
      expect(result.authorizedSections.vendors).toBe(true);
      expect(result.authorizedSections.products).toBe(true);
      expect(result.authorizedSections.orders).toBe(true);
      expect(result.authorizedSections.finance).toBe(true);
      expect(result.authorizedSections.inventory).toBe(true);
      expect(result.authorizedSections.returns).toBe(true);
      expect(result.authorizedSections.support).toBe(true);
      expect(result.authorizedSections.tasks).toBe(true);
      expect(result.authorizedSections.activity).toBe(true);
    });

    it("restricts sections for unauthorized users without permissions", async () => {
      const unauthorizedUser = {
        _id: new mongoose.Types.ObjectId(),
        role: "unauthorized_role",
      };

      const result = await getDashboardStats(unauthorizedUser, { range: "7d" });
      expect(result).toBeDefined();
      expect(result.authorizedSections.finance).toBe(false);
      expect(result.authorizedSections.orders).toBe(false);
      expect(result.authorizedSections.customers).toBe(false);

      // Financial and order metrics should be null or 0
      expect(result.periodMetrics.revenue).toBeNull();
      expect(result.periodMetrics.orders).toBeNull();
      expect(result.periodMetrics.gmv).toBeNull();
      expect(result.recentOrders).toHaveLength(0);
      expect(result.recentVendors).toHaveLength(0);
      expect(result.recentActivity).toHaveLength(0);
    });
  });

  describe("3. Data Contract & Trend Aggregation Integrity", () => {
    it("returns continuous daily trend buckets matching date range length", async () => {
      const mockSuperAdmin = {
        _id: new mongoose.Types.ObjectId(),
        role: "super_admin",
      };

      const result7d = await getDashboardStats(mockSuperAdmin, { range: "7d" });
      expect(result7d.trends).toBeDefined();
      expect(Array.isArray(result7d.trends)).toBe(true);
      expect(result7d.trends.length).toBe(7);

      // Each point must have date, sales, gmv, orders, and newCustomers numbers
      for (const pt of result7d.trends) {
        expect(typeof pt.date).toBe("string");
        expect(typeof pt.sales).toBe("number");
        expect(typeof pt.orders).toBe("number");
        expect(typeof pt.newCustomers).toBe("number");
        expect(pt.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    it("maintains backward compatibility with kpis and stats objects", async () => {
      const mockSuperAdmin = {
        _id: new mongoose.Types.ObjectId(),
        role: "super_admin",
      };

      const result = await getDashboardStats(mockSuperAdmin, { range: "30d" });
      expect(result.kpis).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.stats).toBe(result.kpis); // Same reference for backward compatibility

      // Standard KPI fields must be present
      expect(result.kpis).toHaveProperty("totalCustomers");
      expect(result.kpis).toHaveProperty("totalVendors");
      expect(result.kpis).toHaveProperty("totalProducts");
      expect(result.kpis).toHaveProperty("totalOrders");
      expect(result.kpis).toHaveProperty("pendingOrders");
      expect(result.kpis).toHaveProperty("revenue");
      expect(result.kpis).toHaveProperty("gmv");
      expect(result.kpis).toHaveProperty("commission");
      expect(result.kpis).toHaveProperty("refunds");
      expect(result.kpis).toHaveProperty("lowStock");
      expect(result.kpis).toHaveProperty("pendingReturns");
      expect(result.kpis).toHaveProperty("openSupportTickets");
    });

    it("returns periodMetrics with explicit range and non-null values for super_admin", async () => {
      const mockSuperAdmin = {
        _id: new mongoose.Types.ObjectId(),
        role: "super_admin",
      };

      const result = await getDashboardStats(mockSuperAdmin, { range: "30d" });
      expect(result.periodMetrics).toBeDefined();
      expect(result.periodMetrics.range).toBe("30d");
      expect(result.periodMetrics.startDate).toBeDefined();
      expect(result.periodMetrics.endDate).toBeDefined();
      expect(typeof result.periodMetrics.orders).toBe("number");
      expect(typeof result.periodMetrics.revenue).toBe("number");
      expect(typeof result.periodMetrics.gmv).toBe("number");
      expect(typeof result.periodMetrics.refunds).toBe("number");
      expect(typeof result.periodMetrics.commission).toBe("number");
    });
  });
});
