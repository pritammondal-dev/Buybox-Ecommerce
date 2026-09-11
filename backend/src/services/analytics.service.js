const mongoose = require("mongoose");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const Vendor = require("../models/Vendor");
const analyticsRepository = require("../repositories/analytics.repository");
const AppError = require("../errors/AppError");

/**
 * Application Reporting Timezone:
 * No specific business, store, or application timezone is configured in project
 * environment variables (env.js) or database settings (StorefrontSettings).
 * Therefore, UTC is retained as the authoritative reporting timezone for all
 * analytics calendar boundaries (today, last_7_days, last_30_days, custom)
 * and daily trend aggregation intervals.
 */
const REPORTING_TIMEZONE = "UTC";

const formatMoney = (val) => {
  if (val === null || val === undefined) {
    return "0.00";
  }
  const str = val.toString ? val.toString() : String(val);
  const num = Number(str);
  return Number.isFinite(num) ? num.toFixed(2) : "0.00";
};

class AnalyticsService {
  /*
   * ==========================================
   * 1. DATE RANGE RESOLUTION
   * ==========================================
   */
  resolveDateRange({ period = "today", startDate, endDate }) {
    const now = new Date();

    if (period === "today") {
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth();
      const date = now.getUTCDate();

      return {
        period,
        startDate: new Date(Date.UTC(year, month, date, 0, 0, 0, 0)),
        endDate: new Date(Date.UTC(year, month, date, 23, 59, 59, 999)),
      };
    }

    if (period === "last_7_days") {
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth();
      const date = now.getUTCDate();

      return {
        period,
        startDate: new Date(Date.UTC(year, month, date - 6, 0, 0, 0, 0)),
        endDate: new Date(Date.UTC(year, month, date, 23, 59, 59, 999)),
      };
    }

    if (period === "last_30_days") {
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth();
      const date = now.getUTCDate();

      return {
        period,
        startDate: new Date(Date.UTC(year, month, date - 29, 0, 0, 0, 0)),
        endDate: new Date(Date.UTC(year, month, date, 23, 59, 59, 999)),
      };
    }

    if (period === "custom") {
      if (!startDate || !endDate) {
        throw new AppError(
          "startDate and endDate are required for custom period",
          400,
          "INVALID_DATE_RANGE"
        );
      }

      const parseDateBoundary = (dateInput, isEnd = false) => {
        if (dateInput instanceof Date) {
          if (isNaN(dateInput.getTime())) {
            throw new AppError("Invalid date format", 400, "INVALID_DATE_RANGE");
          }
          return dateInput;
        }

        if (typeof dateInput !== "string") {
          throw new AppError("Invalid date format", 400, "INVALID_DATE_RANGE");
        }

        const trimmed = dateInput.trim();
        const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
        if (dateOnlyMatch) {
          const year = parseInt(dateOnlyMatch[1], 10);
          const monthNum = parseInt(dateOnlyMatch[2], 10);
          const day = parseInt(dateOnlyMatch[3], 10);

          if (monthNum < 1 || monthNum > 12 || day < 1 || day > 31) {
            throw new AppError("Invalid date format", 400, "INVALID_DATE_RANGE");
          }

          const check = new Date(Date.UTC(year, monthNum - 1, day));
          if (
            check.getUTCFullYear() !== year ||
            check.getUTCMonth() !== monthNum - 1 ||
            check.getUTCDate() !== day
          ) {
            throw new AppError("Invalid date format", 400, "INVALID_DATE_RANGE");
          }

          if (isEnd) {
            return new Date(Date.UTC(year, monthNum - 1, day, 23, 59, 59, 999));
          }
          return new Date(Date.UTC(year, monthNum - 1, day, 0, 0, 0, 0));
        }

        const parsed = new Date(trimmed);
        if (isNaN(parsed.getTime())) {
          throw new AppError("Invalid date format", 400, "INVALID_DATE_RANGE");
        }
        return parsed;
      };

      const start = parseDateBoundary(startDate, false);
      const end = parseDateBoundary(endDate, true);

      if (start.getTime() > end.getTime()) {
        throw new AppError(
          "startDate cannot be after endDate",
          400,
          "INVALID_DATE_RANGE"
        );
      }

      return {
        period,
        startDate: start,
        endDate: end,
      };
    }

    throw new AppError("Invalid period specified", 400, "INVALID_PERIOD");
  }

  /*
   * ==========================================
   * 2. VENDOR IDENTITY RESOLUTION
   * ==========================================
   */
  async resolveAuthenticatedVendor(userId) {
    if (!userId) {
      throw new AppError(
        "Authentication required",
        401,
        "AUTHENTICATION_REQUIRED"
      );
    }

    const vendor = await Vendor.findOne({
      userId,
      isActive: true,
      deletedAt: null,
    });

    if (!vendor) {
      throw new AppError(
        "Vendor profile not found",
        404,
        "VENDOR_NOT_FOUND"
      );
    }

    return vendor;
  }

  /*
   * ==========================================
   * 3. ADMIN ANALYTICS METHODS
   * ==========================================
   */
  async getAdminOverview({ period = "today", startDate, endDate, vendorId }) {
    const range = this.resolveDateRange({ period, startDate, endDate });

    let targetVendorId = null;
    if (vendorId) {
      if (!mongoose.Types.ObjectId.isValid(vendorId)) {
        throw new AppError("Invalid vendor ID", 400, "INVALID_VENDOR_ID");
      }
      targetVendorId = new mongoose.Types.ObjectId(vendorId);
    }

    const { overview, authoritativeRefunds } =
      await analyticsRepository.getSalesOverview({
        startDate: range.startDate,
        endDate: range.endDate,
        vendorId: targetVendorId,
      });

    const grossSalesNum = overview?.grossSales
      ? Number(overview.grossSales.toString())
      : 0;
    const discountsNum = overview?.discounts
      ? Number(overview.discounts.toString())
      : 0;
    const merchandiseSalesNum = Math.max(0, grossSalesNum - discountsNum);
    const taxNum = overview?.tax ? Number(overview.tax.toString()) : 0;
    const unitsSold = overview?.unitsSold ? Number(overview.unitsSold) : 0;
    const orderCount = overview?.orderCount ? Number(overview.orderCount) : 0;
    const averageOrderValue =
      orderCount > 0 ? (merchandiseSalesNum / orderCount).toFixed(2) : "0.00";

    const isPlatformWide = !targetVendorId;
    const metrics = {
      grossSales: grossSalesNum.toFixed(2),
      discounts: discountsNum.toFixed(2),
      merchandiseSales: merchandiseSalesNum.toFixed(2),
      tax: taxNum.toFixed(2),
      unitsSold,
      orderCount,
      averageOrderValue,
      refunds: isPlatformWide ? formatMoney(authoritativeRefunds) : null,
      refundAttributionAvailable: isPlatformWide,
    };

    if (!isPlatformWide) {
      metrics.refundAttributionNote =
        "Seller-level refund attribution is unavailable because refunds are processed at the order/payment level.";
    }

    return {
      period: range.period,
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString(),
      metrics,
    };
  }

  async getAdminTopProducts({
    period = "today",
    startDate,
    endDate,
    vendorId,
    limit = 10,
    sortBy = "units",
  }) {
    const range = this.resolveDateRange({ period, startDate, endDate });

    let targetVendorId = null;
    if (vendorId) {
      if (!mongoose.Types.ObjectId.isValid(vendorId)) {
        throw new AppError("Invalid vendor ID", 400, "INVALID_VENDOR_ID");
      }
      targetVendorId = new mongoose.Types.ObjectId(vendorId);
    }

    const rawProducts = await analyticsRepository.getTopProducts({
      startDate: range.startDate,
      endDate: range.endDate,
      vendorId: targetVendorId,
      limit,
      sortBy,
    });

    const items = rawProducts.map((p) => ({
      productId: p.productId,
      productVariantId: p.productVariantId,
      productName: p.productName,
      variantName: p.variantName || "",
      sku: p.sku,
      unitsSold: Number(p.unitsSold) || 0,
      revenue: formatMoney(p.revenue),
      grossRevenue: formatMoney(p.grossRevenue),
    }));

    return {
      period: range.period,
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString(),
      items,
    };
  }

  async getAdminSalesTrend({ period = "today", startDate, endDate, vendorId }) {
    const range = this.resolveDateRange({ period, startDate, endDate });

    let targetVendorId = null;
    if (vendorId) {
      if (!mongoose.Types.ObjectId.isValid(vendorId)) {
        throw new AppError("Invalid vendor ID", 400, "INVALID_VENDOR_ID");
      }
      targetVendorId = new mongoose.Types.ObjectId(vendorId);
    }

    const rawTrend = await analyticsRepository.getSalesTrend({
      startDate: range.startDate,
      endDate: range.endDate,
      vendorId: targetVendorId,
    });

    const intervals = this.#generateDailyBuckets(
      range.startDate,
      range.endDate,
      rawTrend
    );

    return {
      period: range.period,
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString(),
      intervals,
    };
  }

  /*
   * ==========================================
   * 4. VENDOR ANALYTICS METHODS
   * ==========================================
   */
  async getVendorOverview({ userId, query = {} }) {
    const vendor = await this.resolveAuthenticatedVendor(userId);
    const range = this.resolveDateRange({
      period: query.period || "today",
      startDate: query.startDate,
      endDate: query.endDate,
    });

    const { overview } = await analyticsRepository.getSalesOverview({
      startDate: range.startDate,
      endDate: range.endDate,
      vendorId: vendor._id,
    });

    const grossSalesNum = overview?.grossSales
      ? Number(overview.grossSales.toString())
      : 0;
    const discountsNum = overview?.discounts
      ? Number(overview.discounts.toString())
      : 0;
    const merchandiseSalesNum = Math.max(0, grossSalesNum - discountsNum);
    const taxNum = overview?.tax ? Number(overview.tax.toString()) : 0;
    const unitsSold = overview?.unitsSold ? Number(overview.unitsSold) : 0;
    const orderCount = overview?.orderCount ? Number(overview.orderCount) : 0;
    const averageOrderValue =
      orderCount > 0 ? (merchandiseSalesNum / orderCount).toFixed(2) : "0.00";

    return {
      period: range.period,
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString(),
      metrics: {
        grossSales: grossSalesNum.toFixed(2),
        discounts: discountsNum.toFixed(2),
        merchandiseSales: merchandiseSalesNum.toFixed(2),
        tax: taxNum.toFixed(2),
        unitsSold,
        orderCount,
        averageOrderValue,
        refunds: null,
        refundAttributionAvailable: false,
        refundAttributionNote:
          "Seller-level refund attribution is unavailable because refunds are processed at the order/payment level.",
      },
    };
  }

  async getVendorTopProducts({ userId, query = {} }) {
    const vendor = await this.resolveAuthenticatedVendor(userId);
    const range = this.resolveDateRange({
      period: query.period || "today",
      startDate: query.startDate,
      endDate: query.endDate,
    });

    const rawProducts = await analyticsRepository.getTopProducts({
      startDate: range.startDate,
      endDate: range.endDate,
      vendorId: vendor._id,
      limit: query.limit || 10,
      sortBy: query.sortBy || "units",
    });

    const items = rawProducts.map((p) => ({
      productId: p.productId,
      productVariantId: p.productVariantId,
      productName: p.productName,
      variantName: p.variantName || "",
      sku: p.sku,
      unitsSold: Number(p.unitsSold) || 0,
      revenue: formatMoney(p.revenue),
      grossRevenue: formatMoney(p.grossRevenue),
    }));

    return {
      period: range.period,
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString(),
      items,
    };
  }

  async getVendorSalesTrend({ userId, query = {} }) {
    const vendor = await this.resolveAuthenticatedVendor(userId);
    const range = this.resolveDateRange({
      period: query.period || "today",
      startDate: query.startDate,
      endDate: query.endDate,
    });

    const rawTrend = await analyticsRepository.getSalesTrend({
      startDate: range.startDate,
      endDate: range.endDate,
      vendorId: vendor._id,
    });

    const intervals = this.#generateDailyBuckets(
      range.startDate,
      range.endDate,
      rawTrend
    );

    return {
      period: range.period,
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString(),
      intervals,
    };
  }

  /*
   * ==========================================
   * 5. HELPER: DAILY BUCKETS GENERATION
   * ==========================================
   */
  #generateDailyBuckets(startDate, endDate, rawTrend) {
    const trendMap = new Map();
    for (const item of rawTrend) {
      trendMap.set(item._id, item);
    }

    const buckets = [];
    const current = new Date(
      Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate()
      )
    );
    const endUTC = new Date(
      Date.UTC(
        endDate.getUTCFullYear(),
        endDate.getUTCMonth(),
        endDate.getUTCDate()
      )
    );

    while (current.getTime() <= endUTC.getTime()) {
      const year = current.getUTCFullYear();
      const month = String(current.getUTCMonth() + 1).padStart(2, "0");
      const day = String(current.getUTCDate()).padStart(2, "0");
      const dateKey = `${year}-${month}-${day}`;

      const existing = trendMap.get(dateKey);
      buckets.push({
        date: dateKey,
        sales: existing ? formatMoney(existing.sales) : "0.00",
        units: existing ? Number(existing.units) || 0 : 0,
        orders: existing ? Number(existing.orders) || 0 : 0,
      });

      current.setUTCDate(current.getUTCDate() + 1);
    }

    return buckets;
  }

  /*
   * ==========================================
   * 6. PRESERVED EVENT TRACKING LOGIC
   * ==========================================
   */
  async track({
    eventName,
    eventType,
    userId = null,
    customerId = null,
    vendorId = null,
    storeId = null,
    entityType = null,
    entityId = null,
    properties = {},
    metadata = {},
    occurredAt = new Date(),
  }) {
    if (!eventName) {
      throw new Error("Analytics event name is required");
    }

    if (!eventType) {
      throw new Error("Analytics event type is required");
    }

    const event = new AnalyticsEvent({
      eventName,
      eventType,
      userId,
      customerId,
      vendorId,
      storeId,
      entityType,
      entityId,
      properties,
      metadata,
      occurredAt,
    });

    return event.save();
  }

  async getEvents({
    eventName,
    eventType,
    customerId,
    vendorId,
    startDate,
    endDate,
    limit = 100,
  } = {}) {
    const filter = {};

    if (eventName) {
      filter.eventName = eventName;
    }

    if (eventType) {
      filter.eventType = eventType;
    }

    if (customerId) {
      filter.customerId = customerId;
    }

    if (vendorId) {
      filter.vendorId = vendorId;
    }

    if (startDate || endDate) {
      filter.occurredAt = {};

      if (startDate) {
        filter.occurredAt.$gte = new Date(startDate);
      }

      if (endDate) {
        filter.occurredAt.$lte = new Date(endDate);
      }
    }

    return AnalyticsEvent.find(filter)
      .sort({ occurredAt: -1 })
      .limit(Math.min(Number(limit) || 100, 500));
  }
}

module.exports = new AnalyticsService();