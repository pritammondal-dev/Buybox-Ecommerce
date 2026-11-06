const mongoose = require("mongoose");
const Order = require("../models/Order");
const Refund = require("../models/Refund");
const ReturnRequest = require("../models/ReturnRequest");

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
   * Aggregates sales overview metrics (gross sales, discounts, merchandise sales, tax, units, order count, commission).
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
          orderCommission: {
            $sum: {
              $ifNull: [
                "$items.commissionSnapshot.commissionAmount",
                { $ifNull: ["$items.commissionAmount", 0] },
              ],
            },
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
          commission: { $sum: "$orderCommission" },
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
   * Aggregates cancelled orders statistics for a specific vendor
   */
  async getVendorCancelledStats({ startDate, endDate, vendorId }) {
    const targetVendorId =
      vendorId instanceof mongoose.Types.ObjectId
        ? vendorId
        : new mongoose.Types.ObjectId(vendorId);

    const [cancelledResult] = await Order.aggregate([
      {
        $match: {
          status: "cancelled",
          createdAt: { $gte: startDate, $lte: endDate },
          "items.vendorId": targetVendorId,
        },
      },
      { $unwind: "$items" },
      { $match: { "items.vendorId": targetVendorId } },
      {
        $group: {
          _id: null,
          orderIds: { $addToSet: "$_id" },
          amount: {
            $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          count: { $size: "$orderIds" },
          amount: 1,
        },
      },
    ]);

    return cancelledResult || { count: 0, amount: 0 };
  }

  /**
   * Aggregates returns & RMA statistics for a specific vendor
   */
  async getVendorReturnsStats({ startDate, endDate, vendorId }) {
    const targetVendorId =
      vendorId instanceof mongoose.Types.ObjectId
        ? vendorId
        : new mongoose.Types.ObjectId(vendorId);

    const [returnResult] = await ReturnRequest.aggregate([
      {
        $match: {
          "items.vendorId": targetVendorId,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      { $unwind: "$items" },
      { $match: { "items.vendorId": targetVendorId } },
      {
        $group: {
          _id: null,
          returnIds: { $addToSet: "$_id" },
          units: { $sum: "$items.quantity" },
          amount: {
            $sum: { $multiply: ["$items.itemPrice", "$items.quantity"] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          count: { $size: "$returnIds" },
          units: 1,
          amount: 1,
        },
      },
    ]);

    return returnResult || { count: 0, units: 0, amount: 0 };
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
          orderGrossSales: {
            $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] },
          },
          orderDiscounts: {
            $sum: { $ifNull: ["$items.discountTotal", 0] },
          },
          orderTax: {
            $sum: { $ifNull: ["$items.taxTotal", 0] },
          },
          orderUnits: { $sum: "$items.quantity" },
        },
      },
      {
        $group: {
          _id: "$_id.date",
          sales: { $sum: "$orderSales" },
          grossSales: { $sum: "$orderGrossSales" },
          discounts: { $sum: "$orderDiscounts" },
          tax: { $sum: "$orderTax" },
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

  /**
   * Aggregates server-side paginated product performance table for an authenticated vendor.
   */
  async getProductPerformance({
    startDate,
    endDate,
    vendorId,
    page = 1,
    limit = 20,
    search = "",
    sortBy = "unitsSold",
    sortOrder = "desc",
  }) {
    const targetVendorId =
      vendorId instanceof mongoose.Types.ObjectId
        ? vendorId
        : new mongoose.Types.ObjectId(vendorId);

    const baseMatch = {
      status: { $ne: "cancelled" },
      paymentStatus: { $in: ["paid", "partially_refunded", "refunded"] },
      createdAt: { $gte: startDate, $lte: endDate },
      "items.vendorId": targetVendorId,
    };

    const pipeline = [
      { $match: baseMatch },
      { $unwind: "$items" },
      { $match: { "items.vendorId": targetVendorId } },
    ];

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      pipeline.push({
        $match: {
          $or: [
            { "items.productName": { $regex: escaped, $options: "i" } },
            { "items.sku": { $regex: escaped, $options: "i" } },
          ],
        },
      });
    }

    pipeline.push(
      {
        $group: {
          _id: {
            productId: "$items.productId",
            sku: "$items.sku",
          },
          productId: { $first: "$items.productId" },
          productVariantId: { $first: "$items.productVariantId" },
          productName: { $first: "$items.productName" },
          variantName: { $first: "$items.variantName" },
          sku: { $first: "$items.sku" },
          unitsSold: { $sum: "$items.quantity" },
          grossSales: {
            $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] },
          },
          discounts: {
            $sum: { $ifNull: ["$items.discountTotal", 0] },
          },
          netSales: {
            $sum: {
              $subtract: [
                { $multiply: ["$items.unitPrice", "$items.quantity"] },
                { $ifNull: ["$items.discountTotal", 0] },
              ],
            },
          },
          orderIds: { $addToSet: "$_id" },
        },
      },
      {
        $addFields: {
          orderCount: { $size: "$orderIds" },
        },
      },
      {
        $lookup: {
          from: "inventories",
          localField: "productVariantId",
          foreignField: "productVariantId",
          as: "inventoryData",
        },
      },
      {
        $addFields: {
          currentStock: {
            $ifNull: [{ $sum: "$inventoryData.onHand" }, 0],
          },
          availableStock: {
            $ifNull: [
              {
                $sum: {
                  $subtract: [
                    "$inventoryData.onHand",
                    { $ifNull: ["$inventoryData.reserved", 0] },
                  ],
                },
              },
              0,
            ],
          },
        },
      }
    );

    // Dynamic sorting
    const dir = sortOrder === "asc" ? 1 : -1;
    let sortStage = { unitsSold: dir, _id: 1 };
    if (sortBy === "grossSales") sortStage = { grossSales: dir, _id: 1 };
    else if (sortBy === "netSales") sortStage = { netSales: dir, _id: 1 };
    else if (sortBy === "productName") sortStage = { productName: dir, _id: 1 };

    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const skip = (safePage - 1) * safeLimit;

    pipeline.push({
      $facet: {
        totalRecords: [{ $count: "count" }],
        items: [
          { $sort: sortStage },
          { $skip: skip },
          { $limit: safeLimit },
          {
            $project: {
              _id: 0,
              orderIds: 0,
              inventoryData: 0,
            },
          },
        ],
      },
    });

    const [facetResult] = await Order.aggregate(pipeline, { allowDiskUse: true });
    const total = facetResult?.totalRecords?.[0]?.count || 0;
    const items = facetResult?.items || [];
    const totalPages = Math.ceil(total / safeLimit) || 1;

    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages,
    };
  }
}

module.exports = new AnalyticsRepository();
