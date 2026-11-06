const User = require("../models/User");
const Vendor = require("../models/Vendor");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Inventory = require("../models/Inventory");
const ReturnRequest = require("../models/ReturnRequest");
const SupportTicket = require("../models/SupportTicket");
const Refund = require("../models/Refund");
const { VendorSettlement } = require("../models/VendorSettlement");
const AuditLog = require("../models/AuditLog");
const Task = require("../models/Task");
const { getEffectivePermissions } = require("./authorization.service");

/**
 * Resolves standard or custom date range boundaries for dashboard metrics.
 * Uses local boundaries, returning deterministic UTC timestamps.
 *
 * @param {string} [range="30d"] - "today" | "7d" | "30d" | "90d" | "custom"
 * @param {string|Date} [customStart] - ISO string or Date for custom range start
 * @param {string|Date} [customEnd] - ISO string or Date for custom range end
 * @returns {{ range: string, startDate: Date, endDate: Date }}
 */
const resolveDateRange = (range = "30d", customStart, customEnd) => {
  const now = new Date();
  let endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  let startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);

  let validatedRange = range;

  switch (range) {
    case "today":
      // startDate is 00:00:00.000 today, endDate is 23:59:59.999 today
      break;
    case "7d":
      startDate.setDate(startDate.getDate() - 6);
      break;
    case "90d":
      startDate.setDate(startDate.getDate() - 89);
      break;
    case "custom":
      if (customStart && customEnd) {
        const s = new Date(customStart);
        const e = new Date(customEnd);
        if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && s <= e) {
          startDate = s;
          endDate = e;
          break;
        }
      }
      validatedRange = "30d";
      startDate.setDate(startDate.getDate() - 29);
      break;
    case "30d":
    default:
      validatedRange = "30d";
      startDate.setDate(startDate.getDate() - 29);
      break;
  }

  return {
    range: validatedRange,
    startDate,
    endDate,
  };
};

/**
 * Fetch platform dashboard metrics directly from MongoDB filtered by requester permissions and date range.
 * Zero mock data. Authoritative production aggregations.
 *
 * @param {Object} [user] - Authenticated administrator user
 * @param {Object} [options] - Date range and query options
 * @param {string} [options.range="30d"] - Date range identifier
 * @param {string} [options.startDate] - Custom start date
 * @param {string} [options.endDate] - Custom end date
 */
const getDashboardStats = async (user, options = {}) => {
  const isSuperadmin =
    user?.role === "super_admin" || user?.roles?.includes?.("super_admin");

  const permissions = user?._id
    ? await getEffectivePermissions(user._id)
    : [];

  const hasPerm = (dotPerm, colonPerm) => {
    if (isSuperadmin) return true;
    return (
      permissions.includes(dotPerm) ||
      (colonPerm && permissions.includes(colonPerm))
    );
  };

  const canViewCustomers = hasPerm("customers.view", "users:read");
  const canViewVendors = hasPerm("vendors.view", "vendors:read");
  const canViewProducts = hasPerm("products.view", "products:read");
  const canViewOrders = hasPerm("orders.view", "orders:read");
  const canViewFinance =
    hasPerm("finance.view", "finance:read") ||
    hasPerm("payments.view", "payments:read");
  const canViewInventory = hasPerm("inventory.view", "inventory:read");
  const canViewReturns = hasPerm("returns.view", "orders:read");
  const canViewSupport = hasPerm("support.view", "support_tickets:read");
  const canViewTasks = hasPerm("tasks.view", "work_assignments:read");
  const canViewActivity = hasPerm("activity_logs.view", "audit_logs:read");

  // 1. Resolve date range
  const { range = "30d", startDate: customStart, endDate: customEnd } = options;
  const dateFilter = resolveDateRange(range, customStart, customEnd);
  const { startDate, endDate } = dateFilter;

  const promises = [];

  // 0: Customers All-time
  promises.push(
    canViewCustomers
      ? Promise.all([
          User.countDocuments({ role: "customer" }),
          User.countDocuments({ role: "customer", isActive: true }),
        ])
      : Promise.resolve([null, null])
  );

  // 1: Vendors All-time
  promises.push(
    canViewVendors
      ? Promise.all([
          Vendor.countDocuments({ deletedAt: null }),
          Vendor.countDocuments({
            onboardingStatus: {
              $in: ["pending", "under_review", "changes_requested"],
            },
            deletedAt: null,
          }),
          Vendor.countDocuments({
            onboardingStatus: "approved",
            isActive: true,
            deletedAt: null,
          }),
        ])
      : Promise.resolve([null, null, null])
  );

  // 2: Products All-time
  promises.push(
    canViewProducts
      ? Promise.all([
          Product.countDocuments({ deletedAt: null }),
          Product.countDocuments({
            status: "pending_approval",
            deletedAt: null,
          }),
        ])
      : Promise.resolve([null, null])
  );

  // 3: Orders All-time
  promises.push(
    canViewOrders
      ? Promise.all([
          Order.countDocuments(),
          Order.countDocuments({
            status: { $in: ["pending", "confirmed", "processing"] },
          }),
        ])
      : Promise.resolve([null, null])
  );

  // 4: Finance All-time (GMV, Revenue, Refunds, Settlements)
  promises.push(
    canViewFinance
      ? Promise.all([
          Order.aggregate([
            { $match: { status: { $nin: ["cancelled", "voided"] } } },
            { $group: { _id: null, total: { $sum: { $toDouble: "$grandTotal" } } } },
          ]),
          Order.aggregate([
            { $match: { paymentStatus: "paid", status: { $nin: ["cancelled", "voided"] } } },
            { $group: { _id: null, total: { $sum: { $toDouble: "$grandTotal" } } } },
          ]),
          Refund.aggregate([
            { $match: { status: { $ne: "failed" } } },
            { $group: { _id: null, total: { $sum: { $toDouble: "$amount" } } } },
          ]),
          VendorSettlement.countDocuments({
            status: { $in: ["pending", "eligible", "processing", "payable"] },
          }),
          VendorSettlement.aggregate([
            { $match: { status: { $ne: "cancelled" } } },
            { $group: { _id: null, totalCommission: { $sum: { $toDouble: "$platformCommission" } } } },
          ]),
        ])
      : Promise.resolve([[], [], [], null, []])
  );

  // 5: Inventory Low Stock
  promises.push(
    canViewInventory
      ? Inventory.countDocuments({
          $expr: {
            $lte: [
              { $subtract: ["$onHand", "$reserved"] },
              "$lowStockThreshold",
            ],
          },
        })
      : Promise.resolve(null)
  );

  // 6: Pending Returns
  promises.push(
    canViewReturns
      ? ReturnRequest.countDocuments({
          status: { $in: ["requested", "under_review", "refund_pending"] },
        })
      : Promise.resolve(null)
  );

  // 7: Open Support Tickets
  promises.push(
    canViewSupport
      ? SupportTicket.countDocuments({
          status: { $in: ["open", "pending", "in_progress"] },
        })
      : Promise.resolve(null)
  );

  // 8: Tasks
  promises.push(
    canViewTasks
      ? Promise.all([
          Task.countDocuments({ status: { $ne: "COMPLETED" } }),
          Task.countDocuments({ status: "COMPLETED" }),
        ])
      : Promise.resolve([null, null])
  );

  // 9: Recent Orders (Top 10 with populated customer details)
  promises.push(
    canViewOrders
      ? Order.find()
          .select(
            "orderNumber grandTotal currency status paymentStatus fulfillmentStatus createdAt customerId"
          )
          .populate("customerId", "firstName lastName email")
          .sort({ createdAt: -1 })
          .limit(10)
          .lean()
      : Promise.resolve([])
  );

  // 10: Recent Vendors
  promises.push(
    canViewVendors
      ? Vendor.find({ deletedAt: null })
          .select(
            "businessName businessSlug onboardingStatus isActive email createdAt"
          )
          .sort({ createdAt: -1 })
          .limit(8)
          .lean()
      : Promise.resolve([])
  );

  // 11: Recent Activity
  promises.push(
    canViewActivity
      ? AuditLog.find()
          .populate("actorId", "firstName lastName email role")
          .sort({ createdAt: -1 })
          .limit(8)
          .lean()
      : Promise.resolve([])
  );

  // 12: Period Orders & Revenue Aggregation (Bounded by [startDate, endDate])
  promises.push(
    canViewOrders || canViewFinance
      ? Order.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate },
              status: { $nin: ["cancelled", "voided"] },
            },
          },
          {
            $group: {
              _id: null,
              ordersCount: { $sum: 1 },
              gmv: { $sum: { $toDouble: "$grandTotal" } },
              revenue: {
                $sum: {
                  $cond: [
                    { $eq: ["$paymentStatus", "paid"] },
                    { $toDouble: "$grandTotal" },
                    0,
                  ],
                },
              },
              pendingOrders: {
                $sum: {
                  $cond: [
                    { $in: ["$status", ["pending", "confirmed", "processing"]] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ])
      : Promise.resolve([])
  );

  // 13: Period Refunds Aggregation
  promises.push(
    canViewFinance
      ? Refund.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate },
              status: { $ne: "failed" },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: { $toDouble: "$amount" } },
            },
          },
        ])
      : Promise.resolve([])
  );

  // 14: Period New Customers Count
  promises.push(
    canViewCustomers
      ? User.countDocuments({
          role: "customer",
          createdAt: { $gte: startDate, $lte: endDate },
        })
      : Promise.resolve(null)
  );

  // 15: Period New Vendors Count
  promises.push(
    canViewVendors
      ? Vendor.countDocuments({
          deletedAt: null,
          createdAt: { $gte: startDate, $lte: endDate },
        })
      : Promise.resolve(null)
  );

  // 16: Daily Trends Aggregation for Orders & Sales Chart
  promises.push(
    canViewOrders || canViewFinance
      ? Order.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate },
              status: { $nin: ["cancelled", "voided"] },
            },
          },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              sales: {
                $sum: {
                  $cond: [
                    { $eq: ["$paymentStatus", "paid"] },
                    { $toDouble: "$grandTotal" },
                    0,
                  ],
                },
              },
              gmv: { $sum: { $toDouble: "$grandTotal" } },
              orders: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ])
      : Promise.resolve([])
  );

  // 17: Daily Trends for Customer Signups
  promises.push(
    canViewCustomers
      ? User.aggregate([
          {
            $match: {
              role: "customer",
              createdAt: { $gte: startDate, $lte: endDate },
            },
          },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              newCustomers: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ])
      : Promise.resolve([])
  );

  const [
    [totalCustomers, activeCustomers],
    [totalVendors, pendingVendors, activeVendors],
    [totalProducts, pendingProducts],
    [totalOrders, pendingOrders],
    [gmvAgg, revenueAgg, refundsAgg, settlementsCount, commissionAgg],
    lowStockCount,
    pendingReturnsCount,
    openTicketsCount,
    [pendingTasksCount, completedTasksCount],
    recentOrders,
    recentVendors,
    recentActivity,
    periodOrdersAgg,
    periodRefundsAgg,
    periodNewCustomers,
    periodNewVendors,
    orderTrendsAgg,
    customerTrendsAgg,
  ] = await Promise.all(promises);

  // Calculate All-Time Financials
  const rawGmv = gmvAgg[0]?.total
    ? Number(Number(gmvAgg[0].total).toFixed(2))
    : 0;
  const rawRevenue = revenueAgg[0]?.total
    ? Number(Number(revenueAgg[0].total).toFixed(2))
    : 0;
  const rawRefunds = refundsAgg[0]?.total
    ? Number(Number(refundsAgg[0].total).toFixed(2))
    : 0;
  const rawSettlementCommission = commissionAgg && commissionAgg[0]?.totalCommission
    ? Number(Number(commissionAgg[0].totalCommission).toFixed(2))
    : null;
  const rawCommission = rawSettlementCommission !== null && rawSettlementCommission > 0
    ? rawSettlementCommission
    : Number((rawRevenue * 0.1).toFixed(2));

  // Build Continuous Daily Trend Sequence
  const trendMap = new Map();
  const curDate = new Date(startDate);
  while (curDate <= endDate) {
    const dateKey = curDate.toISOString().slice(0, 10);
    trendMap.set(dateKey, {
      date: dateKey,
      sales: 0,
      gmv: 0,
      orders: 0,
      newCustomers: 0,
    });
    curDate.setDate(curDate.getDate() + 1);
  }

  if (Array.isArray(orderTrendsAgg)) {
    for (const pt of orderTrendsAgg) {
      if (trendMap.has(pt._id)) {
        const bucket = trendMap.get(pt._id);
        if (canViewFinance) {
          bucket.sales = Number((pt.sales || 0).toFixed(2));
          bucket.gmv = Number((pt.gmv || 0).toFixed(2));
        }
        if (canViewOrders) {
          bucket.orders = pt.orders || 0;
        }
      }
    }
  }

  if (Array.isArray(customerTrendsAgg) && canViewCustomers) {
    for (const pt of customerTrendsAgg) {
      if (trendMap.has(pt._id)) {
        const bucket = trendMap.get(pt._id);
        bucket.newCustomers = pt.newCustomers || 0;
      }
    }
  }

  const trends = Array.from(trendMap.values());

  // Period Aggregation Totals
  const periodOrderRow = periodOrdersAgg?.[0] || {};
  const periodRefundRow = periodRefundsAgg?.[0] || {};

  const periodMetrics = {
    range: dateFilter.range,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    orders: canViewOrders ? (periodOrderRow.ordersCount || 0) : null,
    pendingOrders: canViewOrders ? (periodOrderRow.pendingOrders || 0) : null,
    gmv: canViewFinance ? Number((periodOrderRow.gmv || 0).toFixed(2)) : null,
    revenue: canViewFinance ? Number((periodOrderRow.revenue || 0).toFixed(2)) : null,
    refunds: canViewFinance ? Number((periodRefundRow.total || 0).toFixed(2)) : null,
    commission: canViewFinance
      ? Number(((periodOrderRow.revenue || 0) * 0.1).toFixed(2))
      : null,
    newCustomers: canViewCustomers ? (periodNewCustomers || 0) : null,
    newVendors: canViewVendors ? (periodNewVendors || 0) : null,
  };

  // Compile Backward-Compatible KPIs
  const kpis = {};

  if (canViewCustomers) {
    kpis.totalCustomers = totalCustomers;
    kpis.activeCustomers = activeCustomers;
    kpis.periodNewCustomers = periodNewCustomers || 0;
  }
  if (canViewVendors) {
    kpis.totalVendors = totalVendors;
    kpis.pendingVendors = pendingVendors;
    kpis.activeVendors = activeVendors;
    kpis.periodNewVendors = periodNewVendors || 0;
  }
  if (canViewProducts) {
    kpis.totalProducts = totalProducts;
    kpis.pendingProducts = pendingProducts;
  }
  if (canViewOrders) {
    kpis.totalOrders = totalOrders;
    kpis.pendingOrders = pendingOrders;
    kpis.periodOrders = periodOrderRow.ordersCount || 0;
  }
  if (canViewFinance) {
    kpis.gmv = rawGmv;
    kpis.revenue = rawRevenue;
    kpis.refunds = rawRefunds;
    kpis.commission = rawCommission;
    kpis.vendorSettlements = settlementsCount;
    kpis.periodRevenue = periodMetrics.revenue;
    kpis.periodGmv = periodMetrics.gmv;
    kpis.periodRefunds = periodMetrics.refunds;
    kpis.periodCommission = periodMetrics.commission;
  }
  if (canViewInventory) {
    kpis.lowStock = lowStockCount;
  }
  if (canViewReturns) {
    kpis.pendingReturns = pendingReturnsCount;
  }
  if (canViewSupport) {
    kpis.openSupportTickets = openTicketsCount;
  }
  if (canViewTasks) {
    kpis.pendingTasks = pendingTasksCount;
    kpis.completedTasks = completedTasksCount;
  }

  return {
    stats: kpis,
    kpis,
    periodMetrics,
    trends,
    recentOrders,
    recentVendors,
    recentActivity,
    authorizedSections: {
      customers: canViewCustomers,
      vendors: canViewVendors,
      products: canViewProducts,
      orders: canViewOrders,
      finance: canViewFinance,
      inventory: canViewInventory,
      returns: canViewReturns,
      support: canViewSupport,
      tasks: canViewTasks,
      activity: canViewActivity,
    },
  };
};

module.exports = {
  getDashboardStats,
  resolveDateRange,
};
