const express = require("express");
const AuditLog = require("../models/AuditLog");
const authenticate = require("../middlewares/authentication.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");

const router = express.Router();

router.use(authenticate);

/**
 * List security events (permission updates, staff suspension, password resets, credential updates).
 */
router.get(
  "/events",
  requirePermissions(PERMISSIONS.ACTIVITY_LOGS_VIEW),
  async (req, res, next) => {
    try {
      const { page = 1, limit = 20 } = req.query;

      const securityActions = [
        "permission.updated",
        "staff.created",
        "staff.updated",
        "staff.suspended",
        "staff.reactivated",
        "staff.password_reset",
        "credential.updated",
        "security.failed_login",
      ];

      const query = {
        action: { $in: securityActions },
      };

      const skip = (Number(page) - 1) * Number(limit);

      const [events, total] = await Promise.all([
        AuditLog.find(query)
          .populate("actorId", "firstName lastName email role")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        AuditLog.countDocuments(query),
      ]);

      res.status(200).json({
        success: true,
        data: {
          events,
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Full audit logs with filters and state diffs.
 */
router.get(
  "/audit-logs",
  requirePermissions(PERMISSIONS.ACTIVITY_LOGS_VIEW),
  async (req, res, next) => {
    try {
      const { page = 1, limit = 20, entityType, action, search } = req.query;

      const query = {};
      if (entityType) query.entityType = entityType;
      if (action) query.action = action;

      const skip = (Number(page) - 1) * Number(limit);

      const [logs, total] = await Promise.all([
        AuditLog.find(query)
          .populate("actorId", "firstName lastName email role")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        AuditLog.countDocuments(query),
      ]);

      res.status(200).json({
        success: true,
        data: {
          logs,
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
