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
    } else {
      authoritativeRefunds = await this.getVendorAuthoritativeRefunds({
        startDate,
        endDate,
        vendorId: targetVendorId,
      });
    }

    return {
      overview: overviewResult || null,
      authoritativeRefunds,
    };
  }

  /**
   * Aggregates completed and processed refunds attributable to a specific vendor
   * during the specified date range. Correctly attributes multi-vendor order refunds,
   * item-level returns, and prevents double-counting between Refund & ReturnRequest records.
   */
  async getVendorAuthoritativeRefunds({ startDate, endDate, vendorId }) {
    if (mongoose.connection && mongoose.connection.readyState !== 1) {
      return 0;
    }

    const targetVendorId =
      vendorId instanceof mongoose.Types.ObjectId
        ? vendorId
        : new mongoose.Types.ObjectId(vendorId);

    // 1. Processed gateway refunds in date range
    let processedRefunds = [];
    try {
      const refundQuery =
        Refund && typeof Refund.find === "function"
          ? Refund.find({
              status: "processed",
              createdAt: { $gte: startDate, $lte: endDate },
            })
          : null;

      if (refundQuery) {
        if (typeof refundQuery.lean === "function") {
          processedRefunds = (await refundQuery.lean()) || [];
        } else if (Array.isArray(refundQuery)) {
          processedRefunds = refundQuery;
        } else {
          processedRefunds = (await refundQuery) || [];
        }
      }
    } catch {
      processedRefunds = [];
    }

    let totalVendorRefund = 0;
    const handledRefundIds = new Set();
    const handledReturnIds = new Set();
    const handledOrderIds = new Set();

    if (Array.isArray(processedRefunds) && processedRefunds.length > 0) {
      const orderIds = processedRefunds.map((r) => r.orderId).filter(Boolean);
      const refundIds = processedRefunds.map((r) => r._id);

      let orders = [];
      let returnRequests = [];

      try {
        const orderQuery =
          Order && typeof Order.find === "function"
            ? Order.find({
                _id: { $in: orderIds },
                "items.vendorId": targetVendorId,
              })
            : null;
        if (orderQuery) {
          if (typeof orderQuery.lean === "function") {
            orders = (await orderQuery.lean()) || [];
          } else if (Array.isArray(orderQuery)) {
            orders = orderQuery;
          } else {
            orders = (await orderQuery) || [];
          }
        }
      } catch {
        orders = [];
      }

      try {
        const returnQuery =
          ReturnRequest && typeof ReturnRequest.find === "function"
            ? ReturnRequest.find({
                $or: [
                  { refundId: { $in: refundIds } },
                  { orderId: { $in: orderIds }, "items.vendorId": targetVendorId },
                ],
              })
            : null;
        if (returnQuery) {
          if (typeof returnQuery.lean === "function") {
            returnRequests = (await returnQuery.lean()) || [];
          } else if (Array.isArray(returnQuery)) {
            returnRequests = returnQuery;
          } else {
            returnRequests = (await returnQuery) || [];
          }
        }
      } catch {
        returnRequests = [];
      }

      const orderMap = new Map(orders.map((o) => [o._id.toString(), o]));
      const returnByRefundId = new Map();
      const returnByOrderId = new Map();
      for (const ret of returnRequests) {
        if (ret.refundId) {
          returnByRefundId.set(ret.refundId.toString(), ret);
        }
        if (ret.orderId) {
          returnByOrderId.set(ret.orderId.toString(), ret);
        }
      }

      for (const refund of processedRefunds) {
        const refundIdStr = refund._id.toString();
        const orderIdStr = refund.orderId ? refund.orderId.toString() : null;
        const order = orderIdStr ? orderMap.get(orderIdStr) : null;

        if (!order) {
          // Refund belongs to an order without targetVendorId items
          continue;
        }

        handledRefundIds.add(refundIdStr);
        if (orderIdStr) {
          handledOrderIds.add(orderIdStr);
        }
        const refundAmount = Number(refund.amount?.toString() || 0);

        const linkedReturn =
          returnByRefundId.get(refundIdStr) ||
          (orderIdStr ? returnByOrderId.get(orderIdStr) : null);

        if (linkedReturn) {
          handledReturnIds.add(linkedReturn._id.toString());
          let vendorReturnSum = 0;
          for (const item of (linkedReturn.items || [])) {
            const itemVendorId = item.vendorId ? item.vendorId.toString() : null;
            if (itemVendorId === targetVendorId.toString()) {
              if (item.refundAmount !== undefined && item.refundAmount !== null) {
                vendorReturnSum += Number(item.refundAmount.toString());
              } else {
                const price = Number(item.price?.toString() || item.itemPrice?.toString() || 0);
                const qty = Number(item.quantity || 1);
                const tax = Number(item.taxRefund?.toString() || 0);
                const shipping = Number(item.shippingRefund?.toString() || 0);
                vendorReturnSum += (price * qty) + tax + shipping;
              }
            }
          }
          totalVendorRefund += Math.min(vendorReturnSum, refundAmount);
        } else {
          // Direct order refund: attribute vendor proportional share
          let vendorItemsTotal = 0;
          let allItemsTotal = 0;

          for (const item of (order.items || [])) {
            const itemGross = Number(item.unitPrice?.toString() || 0) * Number(item.quantity || 1);
            allItemsTotal += itemGross;
            if (item.vendorId && item.vendorId.toString() === targetVendorId.toString()) {
              vendorItemsTotal += itemGross;
            }
          }

          if (allItemsTotal > 0 && vendorItemsTotal > 0) {
            const vendorShareRatio = vendorItemsTotal / allItemsTotal;
            const vendorRefundAmount = refundAmount * vendorShareRatio;
            totalVendorRefund += Math.min(vendorRefundAmount, vendorItemsTotal);
          }
        }
      }
    }

    // 2. Completed ReturnRequests in date range that were not already counted via Refund doc
    const standaloneReturns = await ReturnRequest.find({
      status: "refunded",
      "items.vendorId": targetVendorId,
      updatedAt: { $gte: startDate, $lte: endDate },
    }).lean();

    for (const ret of standaloneReturns) {
      const retIdStr = ret._id.toString();
      const refundIdStr = ret.refundId ? ret.refundId.toString() : null;
      const orderIdStr = ret.orderId ? ret.orderId.toString() : null;

      if (
        handledReturnIds.has(retIdStr) ||
        (refundIdStr && handledRefundIds.has(refundIdStr)) ||
        (orderIdStr && handledOrderIds.has(orderIdStr))
      ) {
        continue;
      }

      let vendorReturnSum = 0;
      for (const item of (ret.items || [])) {
        const itemVendorId = item.vendorId ? item.vendorId.toString() : null;
        if (itemVendorId === targetVendorId.toString()) {
          if (item.refundAmount !== undefined && item.refundAmount !== null) {
            vendorReturnSum += Number(item.refundAmount.toString());
          } else {
            const price = Number(item.price?.toString() || item.itemPrice?.toString() || 0);
            const qty = Number(item.quantity || 1);
            const tax = Number(item.taxRefund?.toString() || 0);
            const shipping = Number(item.shippingRefund?.toString() || 0);
            vendorReturnSum += (price * qty) + tax + shipping;
          }
        }
      }

      totalVendorRefund += vendorReturnSum;
    }

    return Math.round(totalVendorRefund * 100) / 100;
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
      cancellationStatus: { $ne: "completed" },
      paymentStatus: { $in: ["paid", "partially_refunded", "refunded"] },
      createdAt: { $gte: startDate, $lte: endDate },
      "items.vendorId": targetVendorId,
    };

    const pipeline = [
      { $match: baseMatch },
      { $unwind: "$items" },
      {
        $match: {
          "items.vendorId": targetVendorId,
          "items.fulfillmentStatus": { $ne: "cancelled" },
        },
      },
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
          productVariantId: {
            $first: {
              $ifNull: ["$items.productVariantId", "$items.variantId"],
            },
          },
          productName: { $first: "$items.productName" },
          variantName: { $first: "$items.variantName" },
          sku: { $first: "$items.sku" },
          unitsSold: {
            $sum: {
              $convert: {
                input: "$items.quantity",
                to: "double",
                onError: 0,
                onNull: 0,
              },
            },
          },
          returnedUnits: {
            $sum: {
              $convert: {
                input: "$items.returnedQuantity",
                to: "double",
                onError: 0,
                onNull: 0,
              },
            },
          },
          grossSales: {
            $sum: {
              $multiply: [
                {
                  $convert: {
                    input: "$items.unitPrice",
                    to: "double",
                    onError: 0,
                    onNull: 0,
                  },
                },
                {
                  $convert: {
                    input: "$items.quantity",
                    to: "double",
                    onError: 0,
                    onNull: 0,
                  },
                },
              ],
            },
          },
          discounts: {
            $sum: {
              $convert: {
                input: "$items.discountTotal",
                to: "double",
                onError: 0,
                onNull: 0,
              },
            },
          },
          netSales: {
            $sum: {
              $subtract: [
                {
                  $multiply: [
                    {
                      $convert: {
                        input: "$items.unitPrice",
                        to: "double",
                        onError: 0,
                        onNull: 0,
                      },
                    },
                    {
                      $convert: {
                        input: "$items.quantity",
                        to: "double",
                        onError: 0,
                        onNull: 0,
                      },
                    },
                  ],
                },
                {
                  $convert: {
                    input: "$items.discountTotal",
                    to: "double",
                    onError: 0,
                    onNull: 0,
                  },
                },
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
          let: { pvId: "$productVariantId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ["$$pvId", null] },
                    { $eq: ["$productVariantId", "$$pvId"] },
                  ],
                },
              },
            },
          ],
          as: "inventoryData",
        },
      },
      {
        $addFields: {
          currentStock: {
            $ifNull: [
              {
                $sum: {
                  $map: {
                    input: { $ifNull: ["$inventoryData", []] },
                    as: "inv",
                    in: {
                      $convert: {
                        input: "$$inv.onHand",
                        to: "double",
                        onError: 0,
                        onNull: 0,
                      },
                    },
                  },
                },
              },
              0,
            ],
          },
          availableStock: {
            $ifNull: [
              {
                $sum: {
                  $map: {
                    input: { $ifNull: ["$inventoryData", []] },
                    as: "inv",
                    in: {
                      $max: [
                        0,
                        {
                          $subtract: [
                            {
                              $convert: {
                                input: "$$inv.onHand",
                                to: "double",
                                onError: 0,
                                onNull: 0,
                              },
                            },
                            {
                              $add: [
                                {
                                  $convert: {
                                    input: "$$inv.reserved",
                                    to: "double",
                                    onError: 0,
                                    onNull: 0,
                                  },
                                },
                                {
                                  $convert: {
                                    input: "$$inv.damaged",
                                    to: "double",
                                    onError: 0,
                                    onNull: 0,
                                  },
                                },
                                {
                                  $convert: {
                                    input: "$$inv.defective",
                                    to: "double",
                                    onError: 0,
                                    onNull: 0,
                                  },
                                },
                                {
                                  $convert: {
                                    input: "$$inv.expired",
                                    to: "double",
                                    onError: 0,
                                    onNull: 0,
                                  },
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  },
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
    else if (sortBy === "currentStock" || sortBy === "totalStockOnHand") sortStage = { currentStock: dir, _id: 1 };
    else if (sortBy === "availableStock" || sortBy === "totalAvailableStock") sortStage = { availableStock: dir, _id: 1 };

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
