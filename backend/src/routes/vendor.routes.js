const express = require("express");

const vendorController = require("../controllers/vendor.controller");
const orderController = require("../controllers/order.controller");
const orderFulfillmentController = require("../controllers/order-fulfillment.controller");
const fulfillmentOpsController = require("../controllers/fulfillment-operations.controller");
const shipmentController = require("../controllers/shipment.controller");
const returnRequestController = require("../controllers/return-request.controller");
const refundApplicationController = require("../controllers/refund-application.controller");
const {
  submitRefundApplicationSchema,
  resubmitRefundApplicationSchema,
} = require("../validators/order/refund-application.validator");
const vendorSettlementController = require("../controllers/vendor-settlement.controller");
const vendorBankAccountController = require("../controllers/vendor-bank-account.controller");
const vendorWalletController = require("../controllers/vendor-wallet.controller");
const withdrawalRequestController = require("../controllers/withdrawal-request.controller");
const {
  createWithdrawalRequestSchema,
  withdrawalQuerySchema,
} = require("../validators/finance/withdrawal-request.validator");
const { authenticate, authenticateVendor } = require("../middlewares/authentication.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  requirePermissions,
  requireRoles,
} = require("../middlewares/authorization.middleware");

const AppError = require("../errors/AppError");
const { decodeSecureId } = require("../utils/secure-id.util");
const { requireScope } = require("../middlewares/scope.middleware");
const { SCOPE_TYPES } = require("../constants/scope.constants");
const { authRegistrationLimiter } = require("../middlewares/rate-limiter.middleware");

const {
  registerVendorSchema,
} = require("../validators/vendor/register-vendor.validator");

const {
  createVendorSchema,
} = require("../validators/vendor/create-vendor.validator");

const {
  updateVendorSchema,
} = require("../validators/vendor/update-vendor.validator");

const {
  updateVendorStatusSchema,
} = require("../validators/vendor/update-vendor-status.validator");

const {
  rejectVendorSchema,
  requestChangesSchema,
  listVendorsQuerySchema,
} = require("../validators/vendor/review-vendor.validator");

const {
  vendorOrderIdSchema,
} = require("../validators/order/vendor-order-id.validator");
const {
  vendorOrderTransitionSchema,
  vendorOrderQuerySchema,
  createVendorOrderShipmentSchema,
  vendorOrderAcceptSchema,
  vendorOrderRejectSchema,
  vendorOrderFulfillmentDetailsSchema,
  vendorOrderConfirmFulfillmentSchema,
} = require("../validators/order/vendor-order.validator");
const {
  rejectReturnSchema,
  restockReturnSchema,
  returnActionNotesSchema,
  inspectReturnSchema,
  cancelReturnSchema,
  schedulePickupSchema,
  fulfillExchangeSchema,
} = require("../validators/order/return-request.validator");

const {
  suspendAccountSchema,
  reactivateAccountSchema,
  resetPasswordSchema,
  deleteAccountSchema,
  updateVendorAdminSchema,
} = require("../validators/admin/account-management.validator");

const {
  submitBankAccountSchema,
  resubmitBankAccountSchema,
  approveBankAccountSchema,
  rejectBankAccountSchema,
  unmaskBankAccountSchema,
  adminCreateBankAccountSchema,
  adminUpdateBankAccountSchema,
  adminStatusBankAccountSchema,
  adminDeleteBankAccountSchema,
  listBankApplicationsQuerySchema,
} = require("../validators/vendor/vendor-bank-account.validator");

const multer = require("multer");
const kycUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});
const brandingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
});

const {
  updateStoreBrandingSchema,
} = require("../validators/vendor/vendor-branding.validator");

const {
  uploadKycDocumentSchema,
  reviewKycDocumentSchema,
  listKycQueueQuerySchema,
} = require("../validators/vendor/vendor-kyc.validator");

const {
  PERMISSIONS,
} = require("../constants/permissions.constants");

const { ROLES } = require("../constants/auth.constants");

const router = express.Router();

/**
 * Middleware to resolve either secure ID (ven_...) or raw 24-hex ObjectId.
 * In strict mode, raw 24-hex identifiers are rejected with RAW_IDENTIFIER_DISALLOWED.
 */
const resolveVendorIdParam = (paramName = "id", { strict = false } = {}) => {
  return (req, res, next) => {
    try {
      const rawParam = req.params[paramName];
      if (!rawParam) {
        throw new AppError("Vendor ID is required", 400, "INVALID_OBJECT_ID");
      }
      const trimmed = String(rawParam).trim();

      // Check if it's a 24-hex ObjectId
      if (/^[a-fA-F0-9]{24}$/.test(trimmed)) {
        if (strict) {
          throw new AppError(
            "Raw database identifiers are disallowed on this endpoint. Encrypted secure identifier required.",
            400,
            "RAW_IDENTIFIER_DISALLOWED"
          );
        }
        req.params[`original_${paramName}`] = rawParam;
        req.params[paramName] = trimmed;
        return next();
      }

      // Check if it starts with ven_
      if (trimmed.startsWith("ven_")) {
        const decodedId = decodeSecureId(trimmed, "vendor", { strict: false });
        req.params[`original_${paramName}`] = rawParam;
        req.params[paramName] = decodedId;
        return next();
      }

      // Neither valid ObjectId nor valid ven_ secure ID
      throw new AppError(`Invalid ${paramName}`, 400, "INVALID_OBJECT_ID");
    } catch (err) {
      next(err);
    }
  };
};

/*
 * Public Vendor Onboarding Registration (Supports optional authentication for existing customer shared identity)
 */
const authenticateOptional = authenticate.authenticateOptional || ((req, res, next) => next());

router.post(
  "/register",
  authRegistrationLimiter,
  authenticateOptional,
  validate(registerVendorSchema),
  vendorController.registerVendor
);

/*
 * Public Storefront Routing
 */
router.get("/store/:slug", vendorController.getPublicStore);

router.use(authenticate);
router.use("/me", authenticateVendor);

const {
  requireApprovedVendor,
} = require("../middlewares/vendor.middleware");

/*
 * Vendor self-service
 */

router.get(
  "/me/dashboard",
  requireApprovedVendor,
  vendorController.getDashboardAnalytics
);

router.get(
  "/me/activity",
  requireApprovedVendor,
  vendorController.getActivityLogs
);

/*
 * Vendor Orders & Fulfillment
 */
router.get(
  "/me/orders/shipment-partners",
  requireApprovedVendor,
  orderFulfillmentController.getShipmentPartners
);

router.get(
  "/me/orders",
  requireApprovedVendor,
  validate(vendorOrderQuerySchema, "query"),
  orderController.getMyVendorOrders
);

router.get(
  "/me/orders/:orderId",
  requireApprovedVendor,
  validate(vendorOrderIdSchema, "params"),
  orderController.getMyVendorOrderById
);

router.get(
  "/me/orders/:orderId/packing-slip",
  requireApprovedVendor,
  requirePermissions(PERMISSIONS.ORDERS_READ_OWN),
  validate(vendorOrderIdSchema, "params"),
  fulfillmentOpsController.getOrderPackingSlip
);

router.post(
  "/me/orders/:orderId/accept",
  requireApprovedVendor,
  validate(vendorOrderIdSchema, "params"),
  validate(vendorOrderAcceptSchema),
  orderFulfillmentController.acceptVendorOrder
);

router.post(
  "/me/orders/:orderId/reject",
  requireApprovedVendor,
  validate(vendorOrderIdSchema, "params"),
  validate(vendorOrderRejectSchema),
  orderFulfillmentController.rejectVendorOrder
);

router.patch(
  "/me/orders/:orderId/fulfillment-details",
  requireApprovedVendor,
  validate(vendorOrderIdSchema, "params"),
  validate(vendorOrderFulfillmentDetailsSchema),
  orderFulfillmentController.updateVendorFulfillmentDetails
);

router.post(
  "/me/orders/:orderId/confirm-fulfillment",
  requireApprovedVendor,
  validate(vendorOrderIdSchema, "params"),
  validate(vendorOrderConfirmFulfillmentSchema),
  orderFulfillmentController.confirmVendorFulfillment
);

router.post(
  "/me/orders/:orderId/process",
  requireApprovedVendor,
  validate(vendorOrderIdSchema, "params"),
  (req, res, next) => {
    req.body.action = "process";
    next();
  },
  orderController.transitionVendorOrderStatus
);

router.post(
  "/me/orders/:orderId/ready-to-ship",
  requireApprovedVendor,
  validate(vendorOrderIdSchema, "params"),
  (req, res, next) => {
    req.body.action = "ready_to_ship";
    next();
  },
  orderController.transitionVendorOrderStatus
);

router.post(
  "/me/orders/:orderId/transition",
  requireApprovedVendor,
  validate(vendorOrderIdSchema, "params"),
  validate(vendorOrderTransitionSchema),
  orderController.transitionVendorOrderStatus
);

router.post(
  "/me/orders/:orderId/shipments",
  requireApprovedVendor,
  validate(vendorOrderIdSchema, "params"),
  validate(createVendorOrderShipmentSchema),
  (req, res, next) => {
    req.body.orderId = req.params.orderId;
    next();
  },
  shipmentController.createVendorShipment
);

/*
 * Vendor Returns Lifecycle
 */
router.get(
  "/me/returns",
  requireApprovedVendor,
  returnRequestController.getMyVendorReturns
);

router.get(
  "/me/returns/:returnId",
  requireApprovedVendor,
  returnRequestController.getMyVendorReturnById
);

router.post(
  "/me/returns/:returnId/approve",
  requireApprovedVendor,
  validate(returnActionNotesSchema),
  returnRequestController.approveReturn
);

router.post(
  "/me/returns/:returnId/reject",
  requireApprovedVendor,
  validate(rejectReturnSchema),
  returnRequestController.rejectReturn
);

router.post(
  "/me/returns/:returnId/schedule-pickup",
  requireApprovedVendor,
  validate(schedulePickupSchema),
  returnRequestController.schedulePickup
);

router.post(
  "/me/returns/:returnId/confirm-pickup",
  requireApprovedVendor,
  returnRequestController.confirmPickup
);

router.post(
  "/me/returns/:returnId/exchange",
  requireApprovedVendor,
  validate(fulfillExchangeSchema),
  returnRequestController.fulfillExchange
);

router.post(
  "/me/returns/:returnId/cancel",
  requireApprovedVendor,
  validate(cancelReturnSchema),
  returnRequestController.cancelReturn
);

router.post(
  "/me/returns/:returnId/inspect",
  requireApprovedVendor,
  validate(inspectReturnSchema),
  returnRequestController.inspectReturn
);

router.post(
  "/me/returns/:returnId/receive",
  requireApprovedVendor,
  validate(restockReturnSchema),
  returnRequestController.receiveReturn
);

router.post(
  "/me/returns/:returnId/refund-application",
  requireApprovedVendor,
  validate(submitRefundApplicationSchema),
  refundApplicationController.submitRefundApplication
);

router.post(
  "/me/returns/:returnId/resubmit-refund-application",
  requireApprovedVendor,
  validate(resubmitRefundApplicationSchema),
  refundApplicationController.resubmitRefundApplication
);

router.get(
  "/me/returns/:returnId/refund-application",
  requireApprovedVendor,
  refundApplicationController.getMyRefundApplication
);

router.post(
  "/me/returns/:returnId/refund",
  requireApprovedVendor,
  (req, res, next) => {
    return next(
      new AppError(
        "Merchants do not have authority to disburse refunds directly. Please submit a Refund Disbursement Application for Admin/Superadmin approval.",
        403,
        "MERCHANT_DISBURSEMENT_UNAUTHORIZED"
      )
    );
  }
);

/*
 * Vendor Finance & Settlements
 */
router.get(
  "/me/wallet",
  requireApprovedVendor,
  vendorWalletController.getMyWallet
);

router.get(
  "/me/wallet/transactions",
  requireApprovedVendor,
  vendorWalletController.getMyWalletTransactions
);

router.get(
  "/me/wallet/clearance-timeline",
  requireApprovedVendor,
  vendorWalletController.getMyClearanceTimeline
);

router.post(
  "/me/withdrawals",
  requireApprovedVendor,
  validate(createWithdrawalRequestSchema),
  withdrawalRequestController.submitWithdrawal
);

router.get(
  "/me/withdrawals",
  requireApprovedVendor,
  validate(withdrawalQuerySchema, "query"),
  withdrawalRequestController.getMyWithdrawals
);

router.get(
  "/me/withdrawals/:id",
  requireApprovedVendor,
  withdrawalRequestController.getMyWithdrawalById
);

router.get(
  "/me/finance",
  requireApprovedVendor,
  vendorSettlementController.getVendorFinanceSummary
);

router.get(
  "/me/settlements",
  requireApprovedVendor,
  vendorSettlementController.getMyVendorSettlements
);

router.get(
  "/me/settlements/:settlementId",
  requireApprovedVendor,
  vendorSettlementController.getMyVendorSettlementById
);

/*
 * Vendor Bank Account Management (Max 3, AES-256-GCM Encrypted, HMAC Blind Indexed)
 */
router.get(
  "/me/bank-accounts",
  requireApprovedVendor,
  vendorBankAccountController.getMyBankAccounts
);

router.post(
  "/me/bank-accounts",
  requireApprovedVendor,
  validate(submitBankAccountSchema),
  vendorBankAccountController.submitMyBankAccount
);

router.patch(
  "/me/bank-accounts/:id/active",
  requireApprovedVendor,
  vendorBankAccountController.switchMyActiveBankAccount
);

router.post(
  "/me/bank-accounts/:id/resubmit",
  requireApprovedVendor,
  validate(resubmitBankAccountSchema),
  vendorBankAccountController.resubmitMyBankAccount
);

router.get(
  "/me",
  requireRoles(ROLES.VENDOR),
  vendorController.getMyProfile
);

router.post(
  "/me",
  requireRoles(ROLES.VENDOR),
  validate(createVendorSchema),
  vendorController.createMyProfile
);

router.patch(
  "/me",
  requireRoles(ROLES.VENDOR),
  validate(updateVendorSchema),
  vendorController.updateMyProfile
);

router.post(
  "/me/resubmit",
  requireRoles(ROLES.VENDOR),
  vendorController.resubmitApplication
);

/*
 * Vendor Store Branding Self-Service
 */
router.get(
  "/me/branding",
  requireRoles(ROLES.VENDOR),
  vendorController.getMyBranding
);

router.patch(
  "/me/branding",
  requireRoles(ROLES.VENDOR),
  validate(updateStoreBrandingSchema),
  vendorController.updateMyBranding
);

router.post(
  "/me/branding/upload",
  requireRoles(ROLES.VENDOR),
  brandingUpload.single("file"),
  vendorController.uploadBrandingAsset
);

/*
 * Vendor KYC Document Management Self-Service
 */
router.get(
  "/me/kyc",
  requireRoles(ROLES.VENDOR),
  vendorController.getMyKycStatus
);

router.post(
  "/me/kyc/upload",
  requireRoles(ROLES.VENDOR),
  kycUpload.single("file"),
  validate(uploadKycDocumentSchema),
  vendorController.uploadMyKycDocument
);

router.get(
  "/me/kyc/documents/:documentId/download",
  requireRoles(ROLES.VENDOR),
  vendorController.downloadMyKycDocument
);

/*
 * Admin/vendor management & review workflow
 */

/*
 * Administrative Reviewer Queue: Vendor KYC Queue & Document Review
 * Route: GET /api/v1/admin/vendors/kyc/queue
 */
router.get(
  "/kyc/queue",
  requirePermissions(PERMISSIONS.VENDORS_KYC_VIEW),
  validate(listKycQueueQuerySchema, "query"),
  vendorController.listKycQueue
);

router.post(
  "/:id/kyc/documents/:documentId/review",
  resolveVendorIdParam("id", { strict: false }),
  requirePermissions(PERMISSIONS.VENDORS_KYC_REVIEW),
  validate(reviewKycDocumentSchema),
  vendorController.reviewKycDocument
);

router.get(
  "/:id/kyc/documents/:documentId/download",
  resolveVendorIdParam("id", { strict: false }),
  requirePermissions(PERMISSIONS.VENDORS_KYC_VIEW),
  vendorController.downloadVendorKycDocument
);

/*
 * Administrative Reviewer Queue: Bank Account Applications across all vendors
 * Route: GET /api/v1/admin/vendors/bank-accounts/applications
 */
router.get(
  "/bank-accounts/applications",
  requirePermissions(PERMISSIONS.VENDORS_BANK_ACCOUNTS_VIEW),
  validate(listBankApplicationsQuerySchema, "query"),
  vendorBankAccountController.listPendingApplications
);

router.post(
  "/bank-accounts/:accountId/approve",
  requirePermissions(PERMISSIONS.VENDORS_BANK_ACCOUNTS_APPROVE),
  validate(approveBankAccountSchema),
  vendorBankAccountController.approveVendorBankAccount
);

router.post(
  "/bank-accounts/:accountId/reject",
  requirePermissions(PERMISSIONS.VENDORS_BANK_ACCOUNTS_REJECT),
  validate(rejectBankAccountSchema),
  vendorBankAccountController.rejectVendorBankAccount
);

router.post(
  "/bank-accounts/:accountId/under-review",
  requirePermissions(PERMISSIONS.VENDORS_BANK_ACCOUNTS_REVIEW),
  vendorBankAccountController.markVendorBankAccountUnderReview
);

router.post(
  "/bank-accounts/:accountId/unmask",
  requirePermissions(PERMISSIONS.VENDORS_BANK_ACCOUNTS_VIEW_UNMASKED),
  validate(unmaskBankAccountSchema),
  vendorBankAccountController.unmaskVendorBankAccount
);

router.get(
  "/",
  requirePermissions(PERMISSIONS.VENDORS_READ),
  validate(listVendorsQuerySchema, "query"),
  vendorController.listVendors
);

router.get(
  "/:id",
  resolveVendorIdParam("id", { strict: false }),
  requirePermissions(PERMISSIONS.VENDORS_READ),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  vendorController.getVendor
);

router.get(
  "/:id/overview",
  resolveVendorIdParam("id", { strict: false }),
  requirePermissions(PERMISSIONS.VENDORS_READ),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  vendorController.getVendorOverview
);

router.patch(
  "/:id",
  resolveVendorIdParam("id", { strict: false }),
  requirePermissions(PERMISSIONS.VENDORS_MANAGE),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  validate(updateVendorAdminSchema),
  vendorController.updateVendorAdmin
);

router.post(
  "/:id/suspend",
  resolveVendorIdParam("id", { strict: false }),
  requirePermissions(PERMISSIONS.VENDORS_SUSPEND),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  validate(suspendAccountSchema),
  vendorController.suspendVendor
);

router.post(
  "/:id/reactivate",
  resolveVendorIdParam("id", { strict: false }),
  requirePermissions(PERMISSIONS.VENDORS_SUSPEND),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  validate(reactivateAccountSchema),
  vendorController.reactivateVendor
);

router.patch(
  "/:id/status",
  resolveVendorIdParam("id", { strict: false }),
  requirePermissions(PERMISSIONS.VENDORS_MANAGE),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  validate(updateVendorStatusSchema),
  vendorController.updateVendorStatus
);

router.post(
  "/:id/approve",
  resolveVendorIdParam("id", { strict: true }),
  requirePermissions(PERMISSIONS.VENDORS_MANAGE),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  vendorController.approveVendor
);

router.post(
  "/:id/verify-email",
  resolveVendorIdParam("id", { strict: false }),
  requirePermissions(PERMISSIONS.VENDORS_MANAGE),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  vendorController.verifyVendorEmailByAdmin
);

router.post(
  "/:id/reject",
  resolveVendorIdParam("id", { strict: true }),
  requirePermissions(PERMISSIONS.VENDORS_MANAGE),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  validate(rejectVendorSchema),
  vendorController.rejectVendor
);

router.post(
  "/:id/request-changes",
  resolveVendorIdParam("id", { strict: true }),
  requirePermissions(PERMISSIONS.VENDORS_MANAGE),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  validate(requestChangesSchema),
  vendorController.requestChanges
);

router.post(
  "/:id/reset-password",
  resolveVendorIdParam("id", { strict: false }),
  requirePermissions(PERMISSIONS.VENDORS_RESET_PASSWORD),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  validate(resetPasswordSchema),
  vendorController.resetVendorPassword
);

router.delete(
  "/:id",
  resolveVendorIdParam("id", { strict: false }),
  requirePermissions(PERMISSIONS.VENDORS_DELETE),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  validate(deleteAccountSchema),
  vendorController.deleteVendor
);

/*
 * Administrative Per-Vendor Bank Account Management
 */
router.get(
  "/:id/bank-accounts",
  resolveVendorIdParam("id", { strict: false }),
  requirePermissions(PERMISSIONS.VENDORS_BANK_ACCOUNTS_VIEW),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  vendorBankAccountController.getVendorBankAccounts
);

router.post(
  "/:id/bank-accounts",
  resolveVendorIdParam("id", { strict: false }),
  requirePermissions(PERMISSIONS.VENDORS_BANK_ACCOUNTS_MANAGE),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  validate(adminCreateBankAccountSchema),
  vendorBankAccountController.adminAddVendorBankAccount
);

router.get(
  "/:id/bank-accounts/:accountId",
  resolveVendorIdParam("id", { strict: false }),
  requirePermissions(PERMISSIONS.VENDORS_BANK_ACCOUNTS_VIEW),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  vendorBankAccountController.getVendorBankAccountById
);

router.post(
  "/:id/bank-accounts/:accountId/unmask",
  resolveVendorIdParam("id", { strict: false }),
  requirePermissions(PERMISSIONS.VENDORS_BANK_ACCOUNTS_VIEW_UNMASKED),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  validate(unmaskBankAccountSchema),
  vendorBankAccountController.unmaskVendorBankAccount
);

router.post(
  "/:id/bank-accounts/:accountId/approve",
  resolveVendorIdParam("id", { strict: false }),
  requirePermissions(PERMISSIONS.VENDORS_BANK_ACCOUNTS_APPROVE),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  validate(approveBankAccountSchema),
  vendorBankAccountController.approveVendorBankAccount
);

router.post(
  "/:id/bank-accounts/:accountId/reject",
  resolveVendorIdParam("id", { strict: false }),
  requirePermissions(PERMISSIONS.VENDORS_BANK_ACCOUNTS_REJECT),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  validate(rejectBankAccountSchema),
  vendorBankAccountController.rejectVendorBankAccount
);

router.post(
  "/:id/bank-accounts/:accountId/under-review",
  resolveVendorIdParam("id", { strict: false }),
  requirePermissions(PERMISSIONS.VENDORS_BANK_ACCOUNTS_REVIEW),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  vendorBankAccountController.markVendorBankAccountUnderReview
);

router.patch(
  "/:id/bank-accounts/:accountId",
  resolveVendorIdParam("id", { strict: false }),
  requirePermissions(PERMISSIONS.VENDORS_BANK_ACCOUNTS_MANAGE),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  validate(adminUpdateBankAccountSchema),
  vendorBankAccountController.adminUpdateVendorBankAccount
);

router.patch(
  "/:id/bank-accounts/:accountId/status",
  resolveVendorIdParam("id", { strict: false }),
  requirePermissions(PERMISSIONS.VENDORS_BANK_ACCOUNTS_MANAGE),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  validate(adminStatusBankAccountSchema),
  vendorBankAccountController.adminSetStatusVendorBankAccount
);

router.delete(
  "/:id/bank-accounts/:accountId",
  resolveVendorIdParam("id", { strict: false }),
  requirePermissions(PERMISSIONS.VENDORS_BANK_ACCOUNTS_MANAGE),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  validate(adminDeleteBankAccountSchema),
  vendorBankAccountController.adminDeleteVendorBankAccount
);

module.exports = router;