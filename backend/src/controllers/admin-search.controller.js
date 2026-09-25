const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const Vendor = require("../models/Vendor");
const Employee = require("../models/Employee");
const Shipment = require("../models/Shipment");
const SupportTicket = require("../models/SupportTicket");
const { getEffectivePermissions } = require("../services/authorization.service");
const { sendSuccess } = require("../utils/apiResponse");

const globalSearch = async (req, res, next) => {
  try {
    const q = (req.query.q || req.query.query || "").trim();
    if (!q || q.length < 2) {
      return sendSuccess(res, {
        data: {
          orders: [],
          products: [],
          customers: [],
          vendors: [],
          staff: [],
          shipments: [],
          support: [],
          totalResults: 0,
        },
      });
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");

    const isSuperadmin =
      req.user?.role === "super_admin" ||
      req.user?.roles?.includes?.("super_admin");

    const permissions = req.user?._id
      ? await getEffectivePermissions(req.user._id)
      : [];

    const hasPerm = (dotPerm, colonPerm) => {
      if (isSuperadmin) return true;
      return (
        permissions.includes(dotPerm) ||
        (colonPerm && permissions.includes(colonPerm))
      );
    };

    const searchPromises = {};

    if (hasPerm("orders.view", "orders:read")) {
      searchPromises.orders = Order.find({
        $or: [{ orderNumber: regex }, { status: regex }],
      })
        .select("orderNumber grandTotal status paymentStatus createdAt")
        .limit(8)
        .lean();
    }

    if (hasPerm("products.view", "products:read")) {
      searchPromises.products = Product.find({
        $or: [{ title: regex }, { sku: regex }, { slug: regex }],
        deletedAt: null,
      })
        .select("title slug sku price status")
        .limit(8)
        .lean();
    }

    if (hasPerm("customers.view", "users:read")) {
      searchPromises.customers = User.find({
        role: "customer",
        $or: [{ firstName: regex }, { lastName: regex }, { email: regex }],
      })
        .select("firstName lastName email isActive lastLoginAt")
        .limit(8)
        .lean();
    }

    if (hasPerm("vendors.view", "vendors:read")) {
      searchPromises.vendors = Vendor.find({
        $or: [
          { businessName: regex },
          { businessSlug: regex },
          { email: regex },
        ],
        deletedAt: null,
      })
        .select("businessName businessSlug onboardingStatus isActive email")
        .limit(8)
        .lean();
    }

    if (hasPerm("staff.view", "employees:read")) {
      searchPromises.staff = User.find({
        role: { $in: ["super_admin", "admin", "editor", "staff"] },
        $or: [{ firstName: regex }, { lastName: regex }, { email: regex }],
      })
        .select("firstName lastName email role isActive")
        .limit(8)
        .lean();
    }

    if (hasPerm("shipping.view", "shipments:read")) {
      searchPromises.shipments = Shipment.find({
        $or: [{ shipmentNumber: regex }, { trackingNumber: regex }],
      })
        .select("shipmentNumber trackingNumber carrier status createdAt")
        .limit(8)
        .lean();
    }

    if (hasPerm("support.view", "support_tickets:read")) {
      searchPromises.support = SupportTicket.find({
        $or: [{ ticketNumber: regex }, { subject: regex }],
      })
        .select("ticketNumber subject priority status createdAt")
        .limit(8)
        .lean();
    }

    const keys = Object.keys(searchPromises);
    const results = await Promise.all(Object.values(searchPromises));

    const data = {
      orders: [],
      products: [],
      customers: [],
      vendors: [],
      staff: [],
      shipments: [],
      support: [],
      totalResults: 0,
    };

    keys.forEach((key, idx) => {
      data[key] = results[idx] || [];
      data.totalResults += data[key].length;
    });

    return sendSuccess(res, {
      message: "Global search executed successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  globalSearch,
};
