const express = require("express");
const multer = require("multer");
const returnRequestController = require("../controllers/return-request.controller");
const { authenticate, authenticateVendor } = require("../middlewares/authentication.middleware");
const {
  requireRoles,
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  createReturnRequestSchema,
  rejectReturnSchema,
  schedulePickupSchema,
  fulfillExchangeSchema,
  inspectReturnSchema,
  restockReturnSchema,
  returnActionNotesSchema,
  cancelReturnSchema,
} = require("../validators/order/return-request.validator");
const { ROLES } = require("../constants/auth.constants");
const { PERMISSIONS } = require("../constants/permissions.constants");
const AppError = require("../errors/AppError");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 }, // 5 MB, max 5 files
});

const handleEvidenceUpload = (req, res, next) => {
  const uploadMiddleware = upload.fields([
    { name: "images", maxCount: 5 },
    { name: "file", maxCount: 5 },
  ]);
  uploadMiddleware(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(new AppError("File size exceeds 5MB limit", 400, "FILE_TOO_LARGE"));
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE" || err.code === "LIMIT_FILE_COUNT") {
          return next(
            new AppError(
              "You can upload a maximum of 5 evidence photographs",
              400,
              "TOO_MANY_FILES"
            )
          );
        }
        return next(new AppError(err.message, 400, "UPLOAD_ERROR"));
      }
      return next(err);
    }
    next();
  });
};

const router = express.Router();

router.use(authenticate);

// Evidence upload (customer defect photographs)
router.post(
  "/upload-evidence",
  handleEvidenceUpload,
  returnRequestController.uploadEvidence
);

// Order Return & Exchange Eligibility check
router.get(
  "/eligibility/:orderId",
  returnRequestController.checkEligibility
);

// Admin returns management (must precede generic routes)
router.get(
  "/admin",
  requirePermissions(PERMISSIONS.RETURNS_VIEW),
  returnRequestController.getAdminReturns
);

router.get(
  "/admin/:id",
  requirePermissions(PERMISSIONS.RETURNS_VIEW),
  returnRequestController.getAdminReturnById
);

router.post(
  "/admin/:id/approve",
  requirePermissions(PERMISSIONS.RETURNS_APPROVE),
  returnRequestController.approveReturn
);

router.post(
  "/admin/:id/reject",
  requirePermissions(PERMISSIONS.RETURNS_REJECT),
  validate(rejectReturnSchema),
  returnRequestController.rejectReturn
);

router.post(
  "/admin/:id/schedule-pickup",
  requirePermissions(PERMISSIONS.RETURNS_APPROVE),
  validate(schedulePickupSchema),
  returnRequestController.schedulePickup
);

router.post(
  "/admin/:id/confirm-pickup",
  requirePermissions(PERMISSIONS.RETURNS_APPROVE),
  returnRequestController.confirmPickup
);

router.post(
  "/admin/:id/inspect",
  requirePermissions(PERMISSIONS.RETURNS_APPROVE),
  validate(inspectReturnSchema),
  returnRequestController.inspectReturn
);

router.post(
  "/admin/:id/exchange",
  requirePermissions(PERMISSIONS.RETURNS_APPROVE),
  validate(fulfillExchangeSchema),
  returnRequestController.fulfillExchange
);

router.post(
  "/admin/:id/cancel",
  requirePermissions(PERMISSIONS.RETURNS_APPROVE),
  validate(cancelReturnSchema),
  returnRequestController.cancelReturn
);

router.post(
  "/admin/:id/receive",
  requirePermissions(PERMISSIONS.RETURNS_APPROVE),
  validate(restockReturnSchema),
  returnRequestController.receiveReturn
);

router.post(
  "/admin/:id/refund",
  requirePermissions(PERMISSIONS.REFUNDS_CREATE),
  validate(returnActionNotesSchema),
  returnRequestController.refundReturn
);

// Vendor-scoped returns (must precede generic /:id)
router.use("/vendor", authenticateVendor);
router.get(
  "/vendor/my",
  requireRoles(ROLES.VENDOR),
  returnRequestController.getMyVendorReturns
);

router.get(
  "/vendor/my/:returnId",
  requireRoles(ROLES.VENDOR),
  returnRequestController.getMyVendorReturnById
);

router.post(
  "/vendor/my/:returnId/approve",
  requireRoles(ROLES.VENDOR),
  returnRequestController.approveReturn
);

router.post(
  "/vendor/my/:returnId/reject",
  requireRoles(ROLES.VENDOR),
  validate(rejectReturnSchema),
  returnRequestController.rejectReturn
);

router.post(
  "/vendor/my/:returnId/schedule-pickup",
  requireRoles(ROLES.VENDOR),
  validate(schedulePickupSchema),
  returnRequestController.schedulePickup
);

router.post(
  "/vendor/my/:returnId/confirm-pickup",
  requireRoles(ROLES.VENDOR),
  returnRequestController.confirmPickup
);

router.post(
  "/vendor/my/:returnId/cancel",
  requireRoles(ROLES.VENDOR),
  validate(cancelReturnSchema),
  returnRequestController.cancelReturn
);

router.post(
  "/vendor/my/:returnId/inspect",
  requireRoles(ROLES.VENDOR),
  validate(inspectReturnSchema),
  returnRequestController.inspectReturn
);

router.post(
  "/vendor/my/:returnId/exchange",
  requireRoles(ROLES.VENDOR),
  validate(fulfillExchangeSchema),
  returnRequestController.fulfillExchange
);

router.post(
  "/vendor/my/:returnId/receive",
  requireRoles(ROLES.VENDOR),
  validate(restockReturnSchema),
  returnRequestController.receiveReturn
);

router.post(
  "/vendor/my/:returnId/refund",
  requireRoles(ROLES.VENDOR),
  validate(returnActionNotesSchema),
  returnRequestController.refundReturn
);

// Customer endpoints
router.post("/", validate(createReturnRequestSchema), returnRequestController.createReturn);
router.get("/my", returnRequestController.getMyReturns);
router.get("/order/:orderId", returnRequestController.getReturnsByOrderId);
router.get("/:id", returnRequestController.getCustomerReturnById);
router.post("/:id/cancel", validate(cancelReturnSchema), returnRequestController.cancelReturn);

module.exports = router;
