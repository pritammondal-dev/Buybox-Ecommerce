const mongoose = require("mongoose");
const Order = require("../models/Order");
const Refund = require("../models/Refund");

class AnalyticsRepository {
  /**
   * Builds the base order matching filter for realized, non-cancelled orders.
   */
  #buildBaseMatchFilter({ startDate, endDate, vendorId }) {
    const match = {
      status: { $ne: "cancelled" },
      paymentStatus: { $in: ["paid", "partially_refunded", "refunded"] },
      createdAt: { $gte: startDate, $lte: endDate },
    };

    if (vendorId) {
      match["items.vendorId"] =
        vendorId instanceof mongoose.Types.ObjectId
          ? vendorId
          : new mongoose.Types.ObjectId(vendorId);
    }

    return match;
  }

  /**
   * Aggregates sales overview metrics (gross sales, discounts, merchandise sales, tax, units, order count).
   */
  async getSalesOverview({ startDate, endDate, vendorId = null }) {
    const baseMatch = this.#buildBaseMatchFilter({ startDate, endDate, vendorId });
    const targetVendorId = vendorId
      ? vendorId instanceof mongoose.Types.ObjectId
        ? vendorId
        : new mongoose.Types.ObjectId(vendorId)
      : null;

    const pipeline = [
      { $match: baseMatch },
      { $unwind: "$items" },
    ];

    if (targetVendorId) {
      pipeline.push({
        $match: {
          "items.vendorId": targetVendorId,
        },
      });
    }

    pipeline.push(
      {
        $group: {
          _id: "$_id",
          orderGrossSales: {
            $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] },
          },
          orderDiscounts: {
            $sum: { $ifNull: ["$items.discountTotal", 0] },
          },
          orderTax: {
            $sum: { $ifNull: ["$items.taxTotal", 0] },
          },
          orderUnits: {
            $sum: "$items.quantity",
          },
        },
      },
      {
        $group: {
          _id: null,
          grossSales: { $sum: "$orderGrossSales" },
          discounts: { $sum: "$orderDiscounts" },
          tax: { $sum: "$orderTax" },
          unitsSold: { $sum: "$orderUnits" },
          orderCount: { $sum: 1 },
        },
      }
    );

    const [overviewResult] = await Order.aggregate(pipeline, {
      allowDiskUse: true,
    });

    let authoritativeRefunds = null;
    if (!targetVendorId) {
      // Platform-wide authoritative refunds for admin overview
      const refundResult = await Refund.aggregate(
        [
          {
            $match: {
              status: "processed",
              createdAt: { $gte: startDate, $lte: endDate },
            },
          },
          {
            $group: {
              _id: null,
              totalRefunds: { $sum: "$amount" },
            },
          },
        ],
        { allowDiskUse: true }
      );
      authoritativeRefunds =
        refundResult.length > 0 && refundResult[0].totalRefunds !== undefined
          ? refundResult[0].totalRefunds
          : 0;
    }

    return {
      overview: overviewResult || null,
      authoritativeRefunds,
    };
  }

  /**
   * Aggregates top-selling products / variants ranked by units sold or revenue.
   */
  async getTopProducts({
    startDate,
    endDate,
    vendorId = null,
    limit = 10,
    sortBy = "units",
  }) {
    const baseMatch = this.#buildBaseMatchFilter({ startDate, endDate, vendorId });
    const targetVendorId = vendorId
      ? vendorId instanceof mongoose.Types.ObjectId
        ? vendorId
        : new mongoose.Types.ObjectId(vendorId)
      : null;

    const pipeline = [
      { $match: baseMatch },
      { $unwind: "$items" },
    ];

    if (targetVendorId) {
      pipeline.push({
        $match: {
          "items.vendorId": targetVendorId,
        },
      });
    }

    const sortStage =
      sortBy === "revenue"
        ? { revenue: -1, unitsSold: -1 }
        : { unitsSold: -1, revenue: -1 };

    pipeline.push(
      {
        $group: {
          _id: {
            productId: "$items.productId",
            productVariantId: "$items.productVariantId",
          },
          productName: { $first: "$items.productName" },
          variantName: { $first: "$items.variantName" },
          sku: { $first: "$items.sku" },
          unitsSold: { $sum: "$items.quantity" },
          grossRevenue: {
            $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] },
          },
          discounts: {
            $sum: { $ifNull: ["$items.discountTotal", 0] },
          },
          revenue: {
            $sum: {
              $subtract: [
                { $multiply: ["$items.unitPrice", "$items.quantity"] },
                { $ifNull: ["$items.discountTotal", 0] },
              ],
            },
          },
        },
      },
      { $sort: sortStage },
      { $limit: Number(limit) || 10 },
      {
        $project: {
          _id: 0,
          productId: "$_id.productId",
          productVariantId: "$_id.productVariantId",
          productName: 1,
          variantName: 1,
          sku: 1,
          unitsSold: 1,
          grossRevenue: 1,
          discounts: 1,
          revenue: 1,
        },
      }
    );

    return Order.aggregate(pipeline, { allowDiskUse: true });
  }

  /**
   * Aggregates daily sales trend intervals covering the requested date range.
   */
  async getSalesTrend({ startDate, endDate, vendorId = null }) {
    const baseMatch = this.#buildBaseMatchFilter({ startDate, endDate, vendorId });
    const targetVendorId = vendorId
      ? vendorId instanceof mongoose.Types.ObjectId
        ? vendorId
        : new mongoose.Types.ObjectId(vendorId)
      : null;

    const pipeline = [
      { $match: baseMatch },
      { $unwind: "$items" },
    ];

    if (targetVendorId) {
      pipeline.push({
        $match: {
          "items.vendorId": targetVendorId,
        },
      });
    }

    pipeline.push(
      {
        $group: {
          _id: {
            orderId: "$_id",
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: "UTC",
              },
            },
          },
          orderSales: {
            $sum: {
              $subtract: [
                { $multiply: ["$items.unitPrice", "$items.quantity"] },
                { $ifNull: ["$items.discountTotal", 0] },
              ],
            },
          },
          orderUnits: { $sum: "$items.quantity" },
        },
      },
      {
        $group: {
          _id: "$_id.date",
          sales: { $sum: "$orderSales" },
          units: { $sum: "$orderUnits" },
          orders: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      }
    );

    return Order.aggregate(pipeline, { allowDiskUse: true });
  }
}

module.exports = new AnalyticsRepository();
