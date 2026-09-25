const CustomerNotification = require("../models/CustomerNotification");
const apiResponse = require("../utils/apiResponse");
const AppError = require("../errors/AppError");

const getMyNotifications = async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = { userId };
  if (req.query.unreadOnly === "true") {
    filter.isRead = false;
  }
  if (req.query.type) {
    filter.type = req.query.type;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    CustomerNotification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CustomerNotification.countDocuments(filter),
    CustomerNotification.countDocuments({ userId, isRead: false }),
  ]);

  return apiResponse.sendSuccess(res, {
    message: "Notifications retrieved successfully",
    data: notifications,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      unreadCount,
    },
  });
};

const markAsRead = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const notification = await CustomerNotification.findOneAndUpdate(
    { _id: id, userId },
    { isRead: true, readAt: new Date() },
    { new: true }
  );

  if (!notification) {
    throw new AppError("Notification not found", 404, "NOT_FOUND");
  }

  return apiResponse.sendSuccess(res, {
    message: "Notification marked as read",
    data: notification,
  });
};

const markAllAsRead = async (req, res) => {
  const userId = req.user.id;

  await CustomerNotification.updateMany(
    { userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );

  return apiResponse.sendSuccess(res, {
    message: "All notifications marked as read",
  });
};

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
};
