const mongoose = require("mongoose");
const CustomerNotification = require("../models/CustomerNotification");
const Customer = require("../models/Customer");

/**
 * Creates an in-app persistent notification for a customer.
 */
const createCustomerNotification = async ({
  customerId,
  userId,
  title,
  message,
  type = "system",
  link = null,
  metadata = {},
}) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return null;
    }

    let targetCustomerId = customerId;
    let targetUserId = userId;

    if (!targetCustomerId && targetUserId) {
      const cust = await Customer.findOne({ userId: targetUserId }).select("_id").lean();
      targetCustomerId = cust?._id || targetUserId;
    } else if (!targetUserId && targetCustomerId) {
      const cust = await Customer.findById(targetCustomerId).select("userId").lean();
      targetUserId = cust?.userId || targetCustomerId;
    }

    if (!targetUserId || !targetCustomerId) {
      return null;
    }

    if (
      !mongoose.Types.ObjectId.isValid(targetUserId) ||
      !mongoose.Types.ObjectId.isValid(targetCustomerId)
    ) {
      return null;
    }

    return await CustomerNotification.create({
      customerId: targetCustomerId,
      userId: targetUserId,
      title,
      message,
      type,
      link,
      metadata,
    });
  } catch (err) {
    // Non-blocking error logging for notification creation
    console.error("Failed to create in-app notification:", err?.message);
    return null;
  }
};

module.exports = {
  createCustomerNotification,
};
