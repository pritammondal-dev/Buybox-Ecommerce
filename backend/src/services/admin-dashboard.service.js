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

const { getEffectivePermissions } = require("./authorization.service");
const Task = require("../models/Task");

/**
 * Fetch platform dashboard metrics directly from MongoDB filtered by requester permissions.
 * Zero mock data. Real production aggregation.
 *
 * @param {Object} [user] - Authenticated administrator user
 */
const getDashboardStats = async (user) => {
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

  const promises = [];

  // 0: Customers
  promises.push(
    canViewCustomers
      ? Promise.all([
          User.countDocuments({ role: "customer" }),
          User.countDocuments({ role: "customer", isActive: true }),
        ])
      : Promise.resolve([null, null])
  );

  // 1: Vendors
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

  // 2: Products
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

  // 3: Orders
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

  // 4: Finance (GMV, Revenue, Refunds, Settlements)
  promises.push(
    canViewFinance
      ? Promise.all([
          Order.aggregate([
            { $match: { status: { $ne: "cancelled" } } },
            { $group: { _id: null, total: { $sum: "$grandTotal" } } },
          ]),
          Order.aggregate([
            { $match: { paymentStatus: "paid" } },
            { $group: { _id: null, total: { $sum: "$grandTotal" } } },
          ]),
          Refund.aggregate([
            { $match: { status: { $ne: "failed" } } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ]),
          VendorSettlement.countDocuments({
            status: { $in: ["pending", "eligible", "processing", "payable"] },
          }),
        ])
      : Promise.resolve([[], [], [], null])
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

  // 9: Recent Orders
  promises.push(
    canViewOrders
      ? Order.find()
          .select(
            "orderNumber grandTotal currency status paymentStatus createdAt"
          )
          .sort({ createdAt: -1 })
          .limit(5)
          .lean()
      : Promise.resolve([])
  );

  // 10: Recent Vendors
  promises.push(
    canViewVendors
      ? Vendor.find({ deletedAt: null })
          .select(
            "businessName businessSlug onboardingStatus isActive createdAt"
          )
          .sort({ createdAt: -1 })
          .limit(5)
          .lean()
      : Promise.resolve([])
  );

  // 11: Recent Activity
  promises.push(
    canViewActivity
      ? AuditLog.find()
          .populate("actorId", "firstName lastName email role")
          .sort({ createdAt: -1 })
          .limit(5)
          .lean()
      : Promise.resolve([])
  );

  const [
    [totalCustomers, activeCustomers],
    [totalVendors, pendingVendors, activeVendors],
    [totalProducts, pendingProducts],
    [totalOrders, pendingOrders],
    [gmvAgg, revenueAgg, refundsAgg, settlementsCount],
    lowStockCount,
    pendingReturnsCount,
    openTicketsCount,
    [pendingTasksCount, completedTasksCount],
    recentOrders,
    recentVendors,
    recentActivity,
  ] = await Promise.all(promises);

  const rawGmv = gmvAgg[0]?.total
    ? parseFloat(gmvAgg[0].total.toString())
    : 0;
  const rawRevenue = revenueAgg[0]?.total
    ? parseFloat(revenueAgg[0].total.toString())
    : 0;
  const rawRefunds = refundsAgg[0]?.total
    ? parseFloat(refundsAgg[0].total.toString())
    : 0;
  const rawCommission = Number((rawRevenue * 0.1).toFixed(2));

  const kpis = {};

  if (canViewCustomers) {
    kpis.totalCustomers = totalCustomers;
    kpis.activeCustomers = activeCustomers;
  }
  if (canViewVendors) {
    kpis.totalVendors = totalVendors;
    kpis.pendingVendors = pendingVendors;
    kpis.activeVendors = activeVendors;
  }
  if (canViewProducts) {
    kpis.totalProducts = totalProducts;
    kpis.pendingProducts = pendingProducts;
  }
  if (canViewOrders) {
    kpis.totalOrders = totalOrders;
    kpis.pendingOrders = pendingOrders;
  }
  if (canViewFinance) {
    kpis.gmv = rawGmv;
    kpis.revenue = rawRevenue;
    kpis.refunds = rawRefunds;
    kpis.commission = rawCommission;
    kpis.vendorSettlements = settlementsCount;
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
};
