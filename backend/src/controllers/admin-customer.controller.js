const mongoose = require("mongoose");
const User = require("../models/User");
const Customer = require("../models/Customer");
const Order = require("../models/Order");
const ReturnRequest = require("../models/ReturnRequest");
const AppError = require("../errors/AppError");
const { recordAuditLog } = require("../services/governance.service");

/**
 * List all customers with pagination, search, and status filters.
 */
const listCustomers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, isEmailVerified, isActive } = req.query;

    const query = { role: "customer" };

    if (isEmailVerified !== undefined) {
      query.isEmailVerified = isEmailVerified === "true";
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      query.$or = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(query),
    ]);

    const userIds = users.map((u) => u._id);
    const customers = await Customer.find({ userId: { $in: userIds } }).lean();
    const customerMap = new Map();
    for (const c of customers) {
      customerMap.set(c.userId.toString(), c);
    }

    const customerIds = customers.map((c) => c._id);
    const ordersCountMap = new Map();
    if (customerIds.length > 0) {
      const orderCounts = await Order.aggregate([
        { $match: { customerId: { $in: customerIds } } },
        { $group: { _id: "$customerId", count: { $sum: 1 }, totalSpent: { $sum: "$grandTotal" } } },
      ]);
      for (const oc of orderCounts) {
        ordersCountMap.set(oc._id.toString(), {
          count: oc.count,
          totalSpent: oc.totalSpent ? parseFloat(oc.totalSpent.toString()) : 0,
        });
      }
    }

    const items = users.map((u) => {
      const cust = customerMap.get(u._id.toString()) || null;
      const orderData = cust ? ordersCountMap.get(cust._id.toString()) : { count: 0, totalSpent: 0 };
      return {
        id: u._id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        isActive: u.isActive,
        isEmailVerified: u.isEmailVerified,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        phone: cust?.phone || null,
        customerId: cust?._id || null,
        totalOrders: orderData?.count || 0,
        totalSpent: orderData?.totalSpent || 0,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        customers: items,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single customer details with order history and returns.
 */
const getCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid customer user ID", 400, "INVALID_ID");
    }

    const user = await User.findById(id).select("-password").lean();
    if (!user || user.role !== "customer") {
      throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
    }

    const customer = await Customer.findOne({ userId: user._id }).lean();
    let orders = [];
    let returns = [];

    if (customer) {
      orders = await Order.find({ customerId: customer._id })
        .select("orderNumber grandTotal status paymentStatus createdAt")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      returns = await ReturnRequest.find({ customerId: user._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();
    }

    res.status(200).json({
      success: true,
      data: {
        customer: {
          id: user._id,
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          isActive: user.isActive,
          isEmailVerified: user.isEmailVerified,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          profile: customer,
          orders,
          returns,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle customer account status (activate or suspend).
 */
const updateCustomerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid customer user ID", 400, "INVALID_ID");
    }

    const user = await User.findById(id);
    if (!user || user.role !== "customer") {
      throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
    }

    const beforeState = { isActive: user.isActive };
    user.isActive = Boolean(isActive);
    await user.save();

    await Customer.updateOne({ userId: user._id }, { isActive: Boolean(isActive) });

    await recordAuditLog({
      actorId: req.user._id,
      targetId: user._id,
      action: user.isActive ? "customer.reactivated" : "customer.suspended",
      entityType: "customer",
      beforeState,
      afterState: { isActive: user.isActive },
      req,
    });

    res.status(200).json({
      success: true,
      message: `Customer ${user.isActive ? "reactivated" : "suspended"} successfully`,
      data: {
        id: user._id,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listCustomers,
  getCustomer,
  updateCustomerStatus,
};
