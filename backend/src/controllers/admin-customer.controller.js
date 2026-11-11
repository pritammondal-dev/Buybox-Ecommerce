const mongoose = require("mongoose");
const crypto = require("crypto");
const User = require("../models/User");
const Customer = require("../models/Customer");
const Address = require("../models/Address");
const Order = require("../models/Order");
const ReturnRequest = require("../models/ReturnRequest");
const GiftCard = require("../models/GiftCard");
const GiftCardTransaction = require("../models/GiftCardTransaction");
const Coupon = require("../models/Coupon");
const CouponRedemption = require("../models/CouponRedemption");
const AppError = require("../errors/AppError");
const Cart = require("../models/Cart");
const RefreshToken = require("../models/RefreshToken");
const Otp = require("../models/Otp");
const EmailVerificationToken = require("../models/EmailVerificationToken");
const PasswordResetToken = require("../models/PasswordResetToken");
const CustomerNotification = require("../models/CustomerNotification");
const Wishlist = require("../models/Wishlist");
const { hashPassword } = require("../utils/password");
const { recordAuditLog } = require("../services/governance.service");

/**
 * List all customers with pagination, search, and status filters.
 */
const listCustomers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, isEmailVerified, isActive, includeDeleted } = req.query;

    const query = { role: "customer" };

    if (includeDeleted !== "true") {
      query.deletedAt = null;
    }

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
        { phone: regex },
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
    const [customers, addresses] = await Promise.all([
      Customer.find({ userId: { $in: userIds } }).lean(),
      Address.find({ userId: { $in: userIds }, deletedAt: null }).sort({ isDefault: -1 }).lean(),
    ]);

    const customerMap = new Map();
    for (const c of customers) {
      customerMap.set(c.userId.toString(), c);
    }

    const addressMap = new Map();
    for (const addr of addresses) {
      if (!addressMap.has(addr.userId.toString())) {
        addressMap.set(addr.userId.toString(), addr);
      }
    }

    const customerIds = customers.map((c) => c._id);
    const allQueryIds = [...customerIds, ...userIds];
    const ordersCountMap = new Map();
    if (allQueryIds.length > 0) {
      const orderCounts = await Order.aggregate([
        { $match: { customerId: { $in: allQueryIds } } },
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
      const addr = addressMap.get(u._id.toString()) || null;
      const orderDataCust = cust ? ordersCountMap.get(cust._id.toString()) : null;
      const orderDataUser = ordersCountMap.get(u._id.toString());
      const totalOrders = (orderDataCust?.count || 0) + (orderDataUser?.count || 0);
      const totalSpent = (orderDataCust?.totalSpent || 0) + (orderDataUser?.totalSpent || 0);
      const phone = u.phone || cust?.phone || addr?.phone || null;

      return {
        id: u._id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        isActive: u.isActive,
        isEmailVerified: u.isEmailVerified,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        phone,
        customerId: cust?._id || null,
        totalOrders,
        totalSpent,
        addressSnippet: addr ? `${addr.city}, ${addr.state}` : null,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        customers: items,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single customer details with full KPIs, order history, addresses, and gift cards.
 */
const getCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid customer user ID", 400, "INVALID_ID");
    }

    let user = await User.findById(id).select("-password").lean();
    let customer = null;

    if (!user || (user.role !== "customer" && !user.roles?.includes("customer"))) {
      customer = await Customer.findById(id).lean();
      if (customer && customer.userId) {
        user = await User.findById(customer.userId).select("-password").lean();
      }
    } else {
      customer = await Customer.findOne({ userId: user._id }).lean();
    }

    if (!user || (user.role !== "customer" && !user.roles?.includes("customer"))) {
      throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
    }

    if (!customer) {
      customer = await Customer.findOne({ userId: user._id }).lean();
    }

    const matchingCustomerIds = [user._id, ...(customer ? [customer._id] : [])];

    // Concurrently fetch addresses, orders, returns, gift cards, and coupon redemptions
    const [savedAddresses, allOrders, returns, giftCards, couponRedemptions, activeCouponsCount] = await Promise.all([
      Address.find({ userId: user._id, deletedAt: null }).sort({ isDefault: -1, createdAt: -1 }).lean(),
      Order.find({ customerId: { $in: matchingCustomerIds } })
        .select("orderNumber grandTotal status paymentStatus fulfillmentStatus items shippingAddress couponCode couponId createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      ReturnRequest.find({ customerId: { $in: matchingCustomerIds } })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      GiftCard.find({ claimedByCustomerId: { $in: matchingCustomerIds } })
        .sort({ createdAt: -1 })
        .lean(),
      CouponRedemption.find({ customerId: { $in: matchingCustomerIds } })
        .populate("couponId", "code title discountType discountValue status expiresAt")
        .sort({ redeemedAt: -1 })
        .lean(),
      Coupon.countDocuments({ status: "active", expiresAt: { $gt: new Date() } }),
    ]);

    // Build delivery addresses list from saved addresses, fallback to recent order shipping address if none saved
    let addresses = savedAddresses.map((a) => ({
      id: a._id,
      type: a.type || "home",
      fullName: [a.firstName, a.lastName].filter(Boolean).join(" "),
      phone: a.phone,
      addressLine1: a.addressLine1,
      addressLine2: a.addressLine2 || "",
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
      country: a.country || "IN",
      isDefault: Boolean(a.isDefault),
    }));

    if (addresses.length === 0) {
      const orderWithAddress = allOrders.find((o) => o.shippingAddress?.addressLine1);
      if (orderWithAddress && orderWithAddress.shippingAddress) {
        const sa = orderWithAddress.shippingAddress;
        addresses = [
          {
            id: `ord-addr-${orderWithAddress._id}`,
            type: "Recent Order Delivery Address",
            fullName: sa.fullName || `${user.firstName} ${user.lastName}`,
            phone: sa.phone || user.phone || "",
            addressLine1: sa.addressLine1,
            addressLine2: sa.addressLine2 || "",
            city: sa.city,
            state: sa.state,
            postalCode: sa.postalCode,
            country: sa.country || "IN",
            isDefault: true,
          },
        ];
      }
    }

    // Determine authoritative phone number (never undefined/null if any record exists)
    const authoritativePhone =
      user.phone ||
      customer?.phone ||
      addresses[0]?.phone ||
      null;

    const orders = allOrders.map((o) => ({
      _id: o._id,
      orderNumber: o.orderNumber,
      grandTotal: parseFloat(o.grandTotal?.toString() || 0),
      status: o.status,
      paymentStatus: o.paymentStatus,
      fulfillmentStatus: o.fulfillmentStatus || "unfulfilled",
      itemCount: o.items?.length || 0,
      itemsSummary: (o.items || [])
        .map((i) => i.productTitle || i.productName || i.title || "Item")
        .slice(0, 3)
        .join(", "),
      couponCode: o.couponCode || null,
      shippingAddress: o.shippingAddress || null,
      createdAt: o.createdAt,
    }));

    // Aggregate KPIs
    let totalSpent = 0;
    let completedOrders = 0;
    let cancelledOrders = 0;
    let pendingOrders = 0;

    for (const o of allOrders) {
      const isCancelled = ["cancelled", "expired"].includes(o.status);
      const isCompleted =
        ["delivered", "completed"].includes(o.status) || o.fulfillmentStatus === "fulfilled";
      const isPending =
        ["pending", "pending_payment", "confirmed", "processing", "packed"].includes(o.status) && !isCompleted;

      if (!isCancelled) {
        totalSpent += parseFloat(o.grandTotal?.toString() || 0);
      }
      if (isCompleted) completedOrders++;
      if (isCancelled) cancelledOrders++;
      if (isPending) pendingOrders++;
    }

    let giftCardBalance = 0;
    for (const gc of giftCards) {
      if (gc.status === "active" && (!gc.expiresAt || new Date(gc.expiresAt) > new Date())) {
        giftCardBalance += parseFloat(gc.currentBalance?.toString() || 0);
      }
    }

    // Build coupon redemption summary
    const redeemedCoupons = couponRedemptions.map((cr) => ({
      id: cr._id,
      code: cr.couponId?.code || "PROMO",
      title: cr.couponId?.title || "Special Discount",
      discountType: cr.couponId?.discountType || "percentage",
      discountValue: cr.couponId?.discountValue || 0,
      orderId: cr.orderId,
      redeemedAt: cr.redeemedAt || cr.createdAt,
    }));

    // Also pull distinct coupon codes used in orders
    const usedOrderCoupons = allOrders
      .filter((o) => o.couponCode)
      .map((o) => ({
        id: `ord-cpn-${o._id}`,
        code: o.couponCode,
        title: "Order Promotion",
        orderNumber: o.orderNumber,
        redeemedAt: o.createdAt,
      }));

    const kpis = {
      totalOrders: allOrders.length,
      totalSpent: Math.round(totalSpent * 100) / 100,
      completedOrders,
      cancelledOrders,
      returnedOrders: returns.length,
      pendingOrders,
      giftCardBalance: Math.round(giftCardBalance * 100) / 100,
      couponUsage: couponRedemptions.length || usedOrderCoupons.length,
      availableCoupons: activeCouponsCount,
    };

    res.status(200).json({
      success: true,
      data: {
        customer: {
          id: user._id,
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: authoritativePhone,
          isActive: user.isActive,
          isEmailVerified: user.isEmailVerified,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          profile: customer,
          addresses,
          orders,
          returns,
          giftCards,
          coupons: redeemedCoupons.length > 0 ? redeemedCoupons : usedOrderCoupons,
          kpis,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Superadmin issue gift card to customer
 */
const issueGiftCard = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, notes, expiresAt } = req.body;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new AppError("Gift card amount must be a positive number", 400, "INVALID_AMOUNT");
    }

    const user = await User.findById(id);
    if (!user || user.role !== "customer") {
      throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
    }

    let customer = await Customer.findOne({ userId: user._id });
    if (!customer) {
      customer = await Customer.create({ userId: user._id });
    }

    const code = `GIFT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const expiry = expiresAt
      ? new Date(expiresAt)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // default 1 year

    const giftCard = await GiftCard.create({
      code,
      initialBalance: mongoose.Types.Decimal128.fromString(amountNum.toFixed(2)),
      currentBalance: mongoose.Types.Decimal128.fromString(amountNum.toFixed(2)),
      currency: "INR",
      status: "active",
      expiresAt: expiry,
      claimedByCustomerId: customer._id,
      claimedAt: new Date(),
    });

    const transaction = await GiftCardTransaction.create({
      giftCardId: giftCard._id,
      customerId: customer._id,
      amount: mongoose.Types.Decimal128.fromString(amountNum.toFixed(2)),
      type: "issue",
      notes: notes?.trim() || "Complimentary gift card issued by marketplace superadmin",
    });

    await recordAuditLog({
      actorId: req.user._id,
      targetId: customer._id,
      action: "customer.gift_card_issued",
      entityType: "customer",
      beforeState: null,
      afterState: {
        giftCardId: giftCard._id,
        code: giftCard.code,
        amount: amountNum,
        customerId: customer._id,
      },
      req,
    });

    res.status(201).json({
      success: true,
      message: `Gift card of ₹${amountNum.toFixed(2)} issued successfully`,
      data: {
        giftCard: {
          id: giftCard._id,
          code: giftCard.code,
          currentBalance: amountNum,
          expiresAt: giftCard.expiresAt,
          status: giftCard.status,
        },
        transaction,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Superadmin update customer profile with validated administrative justification.
 */
const updateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, isActive, reason } = req.body;

    const user = await User.findById(id);
    if (!user || user.role !== "customer") {
      throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
    }

    const beforeState = {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || null,
      isActive: user.isActive,
    };

    // If isActive was specifically toggled here without status endpoint, handle lifecycle semantics
    const statusChanged = isActive !== undefined && Boolean(isActive) !== beforeState.isActive;
    if (statusChanged) {
      const actorId = req.user._id || req.user.id;
      if (!isActive && user._id.toString() === actorId.toString()) {
        throw new AppError("Administrators cannot deactivate their own account", 400, "CANNOT_DEACTIVATE_SELF");
      }
      user.isActive = Boolean(isActive);
      if (!user.isActive) {
        user.authVersion = (user.authVersion || 0) + 1;
        await RefreshToken.updateMany(
          { userId: user._id, revokedAt: null },
          { $set: { revokedAt: new Date() } }
        );
      } else {
        user.deletedAt = null;
      }
      await Customer.updateOne(
        { userId: user._id },
        { $set: { isActive: user.isActive, deletedAt: user.deletedAt || null } }
      );
    }

    if (firstName) user.firstName = firstName.trim();
    if (lastName) user.lastName = lastName.trim();
    if (phone !== undefined) {
      user.phone = phone && phone.trim() ? phone.trim() : undefined;
    }

    await user.save();

    if (phone !== undefined) {
      await Customer.updateOne(
        { userId: user._id },
        { $set: { phone: phone ? phone.trim() : null, isActive: user.isActive } },
        { upsert: true }
      );
    }

    await recordAuditLog({
      actorId: req.user._id || req.user.id,
      targetId: user._id,
      action: "customer.updated_by_admin",
      entityType: "customer",
      beforeState,
      afterState: {
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || null,
        isActive: user.isActive,
        reason,
      },
      reason,
      req,
    });

    res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      data: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isActive: user.isActive,
        phone: user.phone,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle customer account status (activate or suspend) with mandatory reason.
 */
const updateCustomerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive, reason } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid customer user ID", 400, "INVALID_ID");
    }

    const user = await User.findById(id);
    if (!user) {
      throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
    }

    const actorId = req.user._id || req.user.id;
    if (user._id.toString() === actorId.toString()) {
      throw new AppError("Administrators cannot suspend their own account", 400, "CANNOT_SUSPEND_SELF");
    }
    if (user.role === "super_admin") {
      throw new AppError("Superadmin accounts cannot be suspended", 403, "CANNOT_SUSPEND_SUPERADMIN");
    }
    if (user.role !== "customer") {
      throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
    }

    const beforeState = { isActive: user.isActive, deletedAt: user.deletedAt || null };
    const targetActive = Boolean(isActive);

    if (targetActive) {
      // Reactivation
      if (user.isActive && !user.deletedAt) {
        throw new AppError("Customer account is already active", 400, "CUSTOMER_ALREADY_ACTIVE");
      }
      user.isActive = true;
      user.deletedAt = null;
      user.authVersion = (user.authVersion || 0) + 1;
      await user.save();
      await Customer.updateOne({ userId: user._id }, { $set: { isActive: true, deletedAt: null } });
    } else {
      // Suspension
      if (user.deletedAt) {
        throw new AppError("Customer account is deactivated and cannot be suspended", 400, "ACCOUNT_DEACTIVATED");
      }
      if (!user.isActive) {
        throw new AppError("Customer account is already suspended", 400, "CUSTOMER_ALREADY_SUSPENDED");
      }
      user.isActive = false;
      user.authVersion = (user.authVersion || 0) + 1;
      await user.save();
      await Customer.updateOne({ userId: user._id }, { $set: { isActive: false } });
      await RefreshToken.updateMany(
        { userId: user._id, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }

    await recordAuditLog({
      actorId: req.user._id || req.user.id,
      targetId: user._id,
      action: user.isActive ? "customer.reactivated" : "customer.suspended",
      entityType: "customer",
      beforeState,
      afterState: { isActive: user.isActive, deletedAt: user.deletedAt, reason },
      reason,
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

/**
 * Dedicated suspend customer endpoint
 */
const suspendCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid customer user ID", 400, "INVALID_ID");
    }

    const user = await User.findById(id);
    if (!user) {
      throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
    }

    const actorId = req.user._id || req.user.id;
    if (user._id.toString() === actorId.toString()) {
      throw new AppError("Administrators cannot suspend their own account", 400, "CANNOT_SUSPEND_SELF");
    }
    if (user.role === "super_admin") {
      throw new AppError("Superadmin accounts cannot be suspended", 403, "CANNOT_SUSPEND_SUPERADMIN");
    }

    if (user.role !== "customer") {
      throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
    }

    if (user.deletedAt) {
      throw new AppError("Customer account is deactivated and cannot be suspended", 400, "ACCOUNT_DEACTIVATED");
    }

    if (!user.isActive) {
      throw new AppError("Customer account is already suspended", 400, "CUSTOMER_ALREADY_SUSPENDED");
    }

    const beforeState = { isActive: user.isActive };
    user.isActive = false;
    user.authVersion = (user.authVersion || 0) + 1;
    await user.save();

    await Customer.updateOne({ userId: user._id }, { $set: { isActive: false } });
    await RefreshToken.updateMany(
      { userId: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    await recordAuditLog({
      actorId: req.user._id || req.user.id,
      targetId: user._id,
      action: "customer.suspended",
      entityType: "customer",
      beforeState,
      afterState: { isActive: false, reason },
      reason,
      req,
    });

    res.status(200).json({
      success: true,
      message: "Customer suspended successfully",
      data: {
        id: user._id,
        isActive: false,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Dedicated reactivate customer endpoint
 */
const reactivateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid customer user ID", 400, "INVALID_ID");
    }

    const user = await User.findById(id);
    if (!user || user.role !== "customer") {
      throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
    }

    if (user.isActive && !user.deletedAt) {
      throw new AppError("Customer account is already active", 400, "CUSTOMER_ALREADY_ACTIVE");
    }

    const beforeState = { isActive: user.isActive, deletedAt: user.deletedAt || null };
    user.isActive = true;
    user.deletedAt = null;
    user.authVersion = (user.authVersion || 0) + 1;
    await user.save();

    await Customer.updateOne({ userId: user._id }, { $set: { isActive: true, deletedAt: null } });

    await recordAuditLog({
      actorId: req.user._id || req.user.id,
      targetId: user._id,
      action: "customer.reactivated",
      entityType: "customer",
      beforeState,
      afterState: { isActive: true, deletedAt: null, reason },
      reason,
      req,
    });

    res.status(200).json({
      success: true,
      message: "Customer reactivated successfully",
      data: {
        id: user._id,
        isActive: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Superadmin reset customer password securely
 */
const resetCustomerPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newPassword, reason } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid customer user ID", 400, "INVALID_ID");
    }

    const user = await User.findById(id);
    if (!user) {
      throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
    }

    const actorId = req.user._id || req.user.id;
    if (user._id.toString() === actorId.toString()) {
      throw new AppError("Administrators cannot reset their own password via customer management", 400, "CANNOT_RESET_SELF");
    }

    if (user.role !== "customer") {
      throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
    }

    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;
    user.authVersion = (user.authVersion || 0) + 1;
    await user.save();

    await RefreshToken.updateMany(
      { userId: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    await recordAuditLog({
      actorId,
      targetId: user._id,
      action: "customer.password_reset",
      entityType: "customer",
      afterState: { userId: user._id, resetAt: new Date(), reason },
      reason,
      req,
    });

    res.status(200).json({
      success: true,
      message: "Customer password reset successfully and active sessions invalidated",
      data: {
        id: user._id,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Permanently delete customer account and associated transient credentials/sessions
 * Preserves historical orders, payments, refunds, and financial compliance records
 */
const deleteCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid customer user ID", 400, "INVALID_ID");
    }

    const user = await User.findById(id);
    if (!user) {
      throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
    }

    const actorId = req.user._id || req.user.id;
    if (user._id.toString() === actorId.toString()) {
      throw new AppError("Administrators cannot delete their own account", 400, "CANNOT_DELETE_SELF");
    }

    if (user.role === "super_admin" || (user.roles || []).includes("super_admin")) {
      throw new AppError("Superadmin accounts cannot be deleted", 403, "CANNOT_DELETE_SUPERADMIN");
    }

    if (user.role !== "customer" && !(user.roles || []).includes("customer")) {
      throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
    }

    const customerDoc = await Customer.findOne({ userId: user._id });

    const beforeState = {
      userId: user._id,
      customerId: customerDoc?._id || null,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      deletedAt: user.deletedAt || null,
    };

    const executeDeletion = async (session = null) => {
      const opts = session ? { session } : {};
      const userId = user._id;
      const customerId = customerDoc?._id;

      // 1. Permanently delete User document
      await User.deleteOne({ _id: userId }, opts);

      // 2. Permanently delete Customer profile(s)
      await Customer.deleteMany({ userId }, opts);

      // 3. Purge authentication, tokens & sessions
      await Otp.deleteMany({ $or: [{ userId }, { email: user.email }] }, opts);
      await RefreshToken.deleteMany({ userId }, opts);
      await EmailVerificationToken.deleteMany({ userId }, opts);
      await PasswordResetToken.deleteMany({ userId }, opts);

      // 4. Purge shopping carts & notifications & wishlist & addresses
      const cartOr = [{ customerId: userId }];
      if (customerId) cartOr.push({ customerId });
      await Cart.deleteMany({ $or: cartOr }, opts);

      const notifOr = [{ userId }];
      if (customerId) notifOr.push({ customerId });
      await CustomerNotification.deleteMany({ $or: notifOr }, opts);

      const wishOr = [{ customerId: userId }];
      if (customerId) wishOr.push({ customerId });
      await Wishlist.deleteMany({ $or: wishOr }, opts);

      await Address.deleteMany({ userId }, opts);
    };

    let session = null;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      await executeDeletion(session);
      await session.commitTransaction();
    } catch (txnErr) {
      if (session) {
        await session.abortTransaction().catch(() => {});
      }
      if (txnErr?.message?.includes("replica set") || txnErr?.message?.includes("Transaction numbers")) {
        await executeDeletion(null);
      } else {
        throw txnErr;
      }
    } finally {
      if (session) {
        await session.endSession().catch(() => {});
      }
    }

    await recordAuditLog({
      actorId,
      targetId: user._id,
      action: "customer.deleted",
      entityType: "customer",
      beforeState,
      afterState: {
        permanentlyDeleted: true,
        email: user.email,
        deletedAt: new Date(),
        reason,
      },
      reason,
      req,
    }).catch(() => {});

    res.status(200).json({
      success: true,
      message: "Customer account permanently deleted successfully",
      data: {
        id: user._id,
        email: user.email,
        permanentlyDeleted: true,
        isActive: false,
        deletedAt: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listCustomers,
  getCustomer,
  issueGiftCard,
  updateCustomer,
  updateCustomerStatus,
  suspendCustomer,
  reactivateCustomer,
  resetCustomerPassword,
  deleteCustomer,
};
