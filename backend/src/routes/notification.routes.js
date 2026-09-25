const express = require("express");
const notificationController = require("../controllers/notification.controller");
const authenticate = require("../middlewares/authentication.middleware");

const router = express.Router();

router.use(authenticate);

router.get("/", notificationController.getMyNotifications);
router.patch("/:id/read", notificationController.markAsRead);
router.post("/mark-all-read", notificationController.markAllAsRead);

module.exports = router;
