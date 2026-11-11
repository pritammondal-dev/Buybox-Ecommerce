const mongoose = require("mongoose");
const RefundApplication = require("../models/RefundApplication");
const ReturnRequest = require("../models/ReturnRequest");
const Order = require("../models/Order");
const Vendor = require("../models/Vendor");
const Payment = require("../models/Payment");
const Refund = require("../models/Refund");
const AuditLog = require("../models/AuditLog");
const customerNotificationService = require("./customer-notification.service");
const AppError = require("../errors/AppError");
const { decodeSecureId, encodeSecureId } = require("../utils/secure-id.util");
const {
  calculateAuthoritativeRefundBreakdown,
  processReturnRefund,
} = require("./return-request.service");

const sanitizeDecimal = (val, defaultVal = "0.00") => {
  if (val === null || val === undefined) {
    return mongoose.Types.Decimal128.fromString(defaultVal);
  }
  if (val instanceof mongoose.Types.Decimal128) {
    return val;
  }
  if (typeof val === "object" && val.$numberDecimal) {
    return mongoose.Types.Decimal128.fromString(val.$numberDecimal);
  }
  const str = String(val).trim();
  const num = Number(str);
  if (isNaN(num)) {
    return mongoose.Types.Decimal128.fromString(defaultVal);
  }
  return mongoose.Types.Decimal128.fromString(num.toFixed(2));
};

/**
 * Resolves active vendor record for a given user.
 */
const resolveApprovedVendor = async (userId) => {
  const vendor = await Vendor.findOne({ userId });
  if (!vendor) {
    throw new AppError("Vendor account not found", 404, "VENDOR_NOT_FOUND");
  }
  return vendor;
};

/**
 * Submits a new Refund Disbursement Application by the Merchant.
 * Validates physical receipt, technical inspection completion, and authoritative calculation.
 */
const submitRefundApplication = async ({
  userId,
  returnId,
  merchantRemarks = null,
  deductionExplanation = null,
  supportingDocuments = [],
  ipAddress = null,
  userAgent = null,
}) => {
  const vendor = await resolveApprovedVendor(userId);
  const resolvedReturnId = decodeSecureId(returnId, "return", { strict: false });

  const ret = await ReturnRequest.findById(resolvedReturnId);
  if (!ret) {
    throw new AppError("Return request not found", 404, "RETURN_NOT_FOUND");
  }

  // Validate Merchant Ownership
  const vendorIdStr = vendor._id.toString();
  const ownsReturn =
    (ret.vendorId && ret.vendorId.toString() === vendorIdStr) ||
    (Array.isArray(ret.vendorIds) && ret.vendorIds.some((vId) => vId.toString() === vendorIdStr)) ||
    (Array.isArray(ret.items) && ret.items.some((it) => it.vendorId && it.vendorId.toString() === vendorIdStr));

  if (!ownsReturn) {
    throw new AppError("Return request not found", 404, "RETURN_NOT_FOUND");
  }

  // Exclude exchanges
  if (ret.type === "exchange") {
    throw new AppError(
      "Exchange requests are fulfilled via replacement items, not refund disbursement applications",
      400,
      "EXCHANGE_NOT_ELIGIBLE_FOR_REFUND"
    );
  }

  // Validate Physical Receipt and Inspection Completion
  const isInspected = ret.status === "inspected" || Boolean(ret.inspection?.inspectedAt);
  if (!isInspected) {
    throw new AppError(
      "Quality inspection must be completed before submitting a refund disbursement application",
      400,
      "RETURN_NOT_INSPECTED"
    );
  }

  // Validate No Conflicting Active Application
  const existingApp = await RefundApplication.findOne({
    returnId: ret._id,
    applicationStatus: {
      $in: [
        "submitted",
        "under_review",
        "approved",
        "disbursement_processing",
        "disbursed",
      ],
    },
  });

  if (existingApp) {
    throw new AppError(
      `An active refund application already exists in status '${existingApp.applicationStatus}'`,
      409,
      "ACTIVE_APPLICATION_EXISTS"
    );
  }

  // Validate Return has not already been refunded
  if (ret.status === "refunded") {
    throw new AppError("Return request has already been refunded", 409, "RETURN_ALREADY_REFUNDED");
  }

  const order = await Order.findById(ret.orderId);
  if (!order) {
    throw new AppError("Associated order not found", 404, "ORDER_NOT_FOUND");
  }

  // Authoritative Calculation Snapshot (Merchant CANNOT tamper with or specify requestedAmount)
  const breakdown = calculateAuthoritativeRefundBreakdown(ret, order);
  const netRefundableNum = Number(breakdown.finalRefund.netRefundableAmount);

  if (netRefundableNum <= 0) {
    throw new AppError(
      "Calculated refundable amount must be greater than zero to submit an application",
      400,
      "INVALID_REFUND_AMOUNT"
    );
  }

  // Payment Snapshot
  const paymentDoc = await Payment.findOne({ orderId: ret.orderId }).sort({ createdAt: -1 }).lean();
  const paymentSnapshot = {
    paymentMethod: paymentDoc?.method || order.paymentMethod || "unavailable",
    gateway: paymentDoc?.gateway || (order.paymentMethod === "cod" ? "cod" : "razorpay"),
    transactionId: paymentDoc?.gatewayPaymentId || null,
    referenceId: paymentDoc?.gatewayOrderId || order.orderNumber,
    capturedAmount: paymentDoc?.amount
      ? sanitizeDecimal(paymentDoc.amount, "0.00")
      : sanitizeDecimal(order.grandTotal, "0.00"),
    isCod: order.paymentMethod === "cod" || paymentDoc?.method === "cod",
    codCollectionStatus: order.paymentMethod === "cod"
      ? (order.paymentStatus === "paid" ? "cash_collected" : "pending_reconciliation")
      : null,
  };

  // Inspection Snapshot
  const inspectionObj = ret.merchantInspection || ret.inspection || {};
  const inspectionSnapshot = {
    status: inspectionObj.status || (inspectionObj.passed ? "passed" : "pending"),
    outcome: inspectionObj.outcome || (inspectionObj.passed ? "passed" : null),
    condition: inspectionObj.condition || inspectionObj.receivedCondition || null,
    packagingCondition: inspectionObj.packagingCondition || null,
    productCondition: inspectionObj.productCondition || null,
    missingAccessories: Boolean(inspectionObj.missingAccessories),
    missingAccessoriesNotes: inspectionObj.missingAccessoriesNotes || null,
    deductionAmount: sanitizeDecimal(inspectionObj.deductionAmount, "0.00"),
    deductionReason: inspectionObj.deductionReason || null,
    deductionCategory: inspectionObj.deductionCategory || null,
    photos: inspectionObj.photos || [],
    inspectedAt: inspectionObj.inspectedAt || null,
    inspectedBy: inspectionObj.inspectedBy || inspectionObj.inspectorId || null,
  };

  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const randSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const applicationNumber = `RA-${dateStr}-${randSuffix}`;

  const application = await RefundApplication.create({
    applicationNumber,
    returnId: ret._id,
    orderId: ret.orderId,
    merchantId: vendor._id,
    customerId: ret.customerId,
    authoritativeRefundBreakdown: breakdown,
    requestedAmount: mongoose.Types.Decimal128.fromString(netRefundableNum.toFixed(2)),
    currency: order.currency || "INR",
    applicationStatus: "submitted",
    merchantRemarks: merchantRemarks || null,
    deductionExplanation:
      deductionExplanation ||
      (Number(ret.customerDeductionsTotal) > 0 ? ret.inspection?.deductionReason : null),
    supportingDocuments: supportingDocuments || [],
    inspectionSnapshot,
    paymentSnapshot,
    submittedBy: userId,
    submittedAt: new Date(),
    timeline: [
      {
        status: "submitted",
        notes: `Merchant submitted refund disbursement application for ₹${netRefundableNum.toFixed(2)}`,
        timestamp: new Date(),
        actor: { actorType: "vendor", actorId: userId, role: "vendor" },
      },
    ],
  });

  // Link application to ReturnRequest
  ret.refundApplicationId = application._id;
  ret.timeline = ret.timeline || [];
  ret.timeline.push({
    status: "refund_application_submitted",
    notes: `Refund disbursement application ${applicationNumber} submitted for marketplace governance review`,
    timestamp: new Date(),
    actor: { actorType: "vendor", actorId: userId },
  });
  await ret.save();

  // Audit Log
  try {
    await AuditLog.create({
      actorId: userId,
      targetId: application._id,
      action: "REFUND_APPLICATION_SUBMITTED",
      entityType: "RefundApplication",
      beforeState: null,
      afterState: {
        applicationId: application._id,
        applicationNumber,
        returnId: ret._id,
        requestedAmount: netRefundableNum.toFixed(2),
      },
      reason: merchantRemarks || "Merchant submitted refund disbursement application",
      ipAddress,
      userAgent,
    });
  } catch {
    // Non-blocking audit log
  }

  // Notify customer
  try {
    await customerNotificationService.createCustomerNotification({
      customerId: ret.customerId,
      title: "Return Inspection Completed",
      message: `Quality inspection for order #${order.orderNumber} is complete. A refund disbursement application has been submitted to marketplace governance for verification.`,
      type: "return",
      link: `/account/orders/${order._id}`,
    });
  } catch {
    // Non-blocking notification
  }

  return formatApplicationDocument(application);
};

/**
 * Resubmits an application after an Administrator requested revisions.
 */
const resubmitRefundApplication = async ({
  userId,
  returnId,
  resubmittedRemarks,
  deductionExplanation = null,
  supportingDocuments = [],
  ipAddress = null,
  userAgent = null,
}) => {
  const vendor = await resolveApprovedVendor(userId);
  const resolvedReturnId = decodeSecureId(returnId, "return", { strict: false });

  const application = await RefundApplication.findOne({
    returnId: resolvedReturnId,
    merchantId: vendor._id,
  }).sort({ createdAt: -1 });

  if (!application) {
    throw new AppError("Refund application not found", 404, "APPLICATION_NOT_FOUND");
  }

  if (application.applicationStatus !== "revision_requested") {
    throw new AppError(
      `Cannot resubmit application in status '${application.applicationStatus}'. Revisions can only be submitted when status is 'revision_requested'`,
      409,
      "INVALID_STATUS_TRANSITION"
    );
  }

  const previousRemarks = application.merchantRemarks;
  const revisionNumber = (application.revisionHistory?.length || 0) + 1;

  application.revisionHistory = application.revisionHistory || [];
  application.revisionHistory.push({
    revisionNumber,
    requestedAt: application.updatedAt || new Date(),
    instructions: application.revisionInstructions || "Revision requested",
    previousRemarks,
    resubmittedAt: new Date(),
    resubmittedRemarks,
  });

  application.merchantRemarks = resubmittedRemarks;
  if (deductionExplanation) {
    application.deductionExplanation = deductionExplanation;
  }
  if (supportingDocuments && supportingDocuments.length > 0) {
    const formattedDocs = supportingDocuments.map((doc) =>
      typeof doc === "string" ? { url: doc, name: "Supporting Evidence" } : doc
    );
    application.supportingDocuments = (application.supportingDocuments || []).concat(formattedDocs);
  }

  application.applicationStatus = "submitted";
  application.revisionInstructions = null;
  application.timeline = application.timeline || [];
  application.timeline.push({
    status: "submitted",
    notes: `Merchant resubmitted application for revision #${revisionNumber}: ${resubmittedRemarks}`,
    timestamp: new Date(),
    actor: { actorType: "vendor", actorId: userId, role: "vendor" },
  });

  await application.save();

  try {
    await AuditLog.create({
      actorId: userId,
      targetId: application._id,
      action: "REFUND_APPLICATION_RESUBMITTED",
      entityType: "RefundApplication",
      beforeState: { applicationStatus: "revision_requested", remarks: previousRemarks },
      afterState: { applicationStatus: "submitted", remarks: resubmittedRemarks, revisionNumber },
      reason: resubmittedRemarks,
      ipAddress,
      userAgent,
    });
  } catch {}

  return formatApplicationDocument(application);
};

/**
 * Retrieves the active refund application for a given return request.
 */
const getRefundApplicationByReturnId = async ({ userId, returnId, isAdmin = false }) => {
  const resolvedReturnId = decodeSecureId(returnId, "return", { strict: false });
  let vendor = null;
  if (!isAdmin) {
    vendor = await resolveApprovedVendor(userId);
  }

  const query = { returnId: resolvedReturnId };
  if (!isAdmin && vendor) {
    query.merchantId = vendor._id;
  }

  const application = await RefundApplication.findOne(query)
    .sort({ createdAt: -1 })
    .populate("submittedBy", "firstName lastName name email")
    .populate("approvedBy", "firstName lastName name email")
    .populate("reviewedBy", "firstName lastName name email")
    .populate("rejectedBy", "firstName lastName name email")
    .lean();

  if (!application) {
    return null;
  }

  return formatApplicationDocument(application);
};

/**
 * Lists refund applications queue for Admin/Superadmin with multi-parameter filters and KPIs.
 */
const getAdminRefundApplications = async ({ query = {} }) => {
  const {
    status = "all",
    search = "",
    merchantId = null,
    orderId = null,
    page = 1,
    limit = 20,
    startDate = null,
    endDate = null,
  } = query;

  const filter = {};

  if (status && status !== "all") {
    filter.applicationStatus = status;
  }

  if (merchantId) {
    filter.merchantId = merchantId;
  }

  if (orderId) {
    filter.orderId = orderId;
  }

  if (startDate || endDate) {
    filter.submittedAt = {};
    if (startDate) {
      filter.submittedAt.$gte = new Date(startDate);
    }
    if (endDate) {
      filter.submittedAt.$lte = new Date(endDate);
    }
  }

  if (search && search.trim()) {
    const s = search.trim();
    filter.$or = [
      { applicationNumber: { $regex: s, $options: "i" } },
      { merchantRemarks: { $regex: s, $options: "i" } },
      { administratorRemarks: { $regex: s, $options: "i" } },
    ];
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (safePage - 1) * safeLimit;

  // Execute queue query and global KPIs
  const [items, total, allDocs] = await Promise.all([
    RefundApplication.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate("returnId", "returnNumber status type reason items")
      .populate("orderId", "orderNumber grandTotal currency paymentMethod paymentStatus")
      .populate("merchantId", "storeName businessName email phone")
      .populate("customerId", "firstName lastName email phone")
      .populate("submittedBy", "firstName lastName name email")
      .populate("approvedBy", "firstName lastName name email")
      .populate("reviewedBy", "firstName lastName name email")
      .populate("rejectedBy", "firstName lastName name email")
      .lean(),
    RefundApplication.countDocuments(filter),
    RefundApplication.find({}).select("applicationStatus requestedAmount approvedAmount disbursedAmount").lean(),
  ]);

  // Global KPIs calculation
  let totalRequestedLiability = 0;
  let totalApprovedLiability = 0;
  let totalDisbursed = 0;

  let submittedCount = 0;
  let underReviewCount = 0;
  let revisionRequestedCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let disbursementProcessingCount = 0;
  let disbursedCount = 0;
  let disbursementFailedCount = 0;

  for (const doc of allDocs) {
    const reqAmt = Number(doc.requestedAmount?.toString?.() || 0);
    const appAmt = Number(doc.approvedAmount?.toString?.() || 0);
    const disbAmt = Number(doc.disbursedAmount?.toString?.() || 0);

    totalRequestedLiability += reqAmt;
    if (["approved", "disbursement_processing", "disbursed"].includes(doc.applicationStatus)) {
      totalApprovedLiability += (appAmt || reqAmt);
    }
    if (doc.applicationStatus === "disbursed") {
      totalDisbursed += (disbAmt || appAmt || reqAmt);
    }

    switch (doc.applicationStatus) {
      case "submitted":
        submittedCount++;
        break;
      case "under_review":
        underReviewCount++;
        break;
      case "revision_requested":
        revisionRequestedCount++;
        break;
      case "approved":
        approvedCount++;
        break;
      case "rejected":
        rejectedCount++;
        break;
      case "disbursement_processing":
        disbursementProcessingCount++;
        break;
      case "disbursed":
        disbursedCount++;
        break;
      case "disbursement_failed":
        disbursementFailedCount++;
        break;
      default:
        break;
    }
  }

  const kpis = {
    totalApplications: allDocs.length,
    submitted: submittedCount,
    underReview: underReviewCount,
    revisionRequested: revisionRequestedCount,
    approved: approvedCount,
    rejected: rejectedCount,
    disbursementProcessing: disbursementProcessingCount,
    disbursed: disbursedCount,
    disbursementFailed: disbursementFailedCount,
    totalLiability: totalRequestedLiability,
    totalRequestedLiability: totalRequestedLiability.toFixed(2),
    totalApprovedLiability: totalApprovedLiability.toFixed(2),
    totalDisbursed: totalDisbursed.toFixed(2),
  };

  return {
    items: items.map(formatApplicationDocument),
    kpis,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
};

/**
 * Retrieves full application details for Admin review.
 */
const getAdminRefundApplicationById = async (applicationId) => {
  const application = await RefundApplication.findById(applicationId)
    .populate("returnId")
    .populate("orderId")
    .populate("merchantId")
    .populate("customerId")
    .populate("submittedBy", "firstName lastName name email")
    .populate("reviewedBy", "firstName lastName name email")
    .populate("approvedBy", "firstName lastName name email")
    .populate("rejectedBy", "firstName lastName name email")
    .populate("disbursementReference")
    .lean();

  if (!application) {
    throw new AppError("Refund application not found", 404, "APPLICATION_NOT_FOUND");
  }

  return formatApplicationDocument(application);
};

/**
 * Transitions application to 'under_review'.
 */
const reviewRefundApplication = async ({
  applicationId,
  userId,
  notes = null,
  ipAddress = null,
  userAgent = null,
}) => {
  const application = await RefundApplication.findById(applicationId);
  if (!application) {
    throw new AppError("Refund application not found", 404, "APPLICATION_NOT_FOUND");
  }

  if (["disbursed", "rejected"].includes(application.applicationStatus)) {
    throw new AppError(
      `Cannot review application in status '${application.applicationStatus}'`,
      409,
      "INVALID_STATUS_TRANSITION"
    );
  }

  application.applicationStatus = "under_review";
  application.reviewedBy = userId;
  application.reviewedAt = new Date();
  if (notes) {
    application.administratorRemarks = notes;
  }

  application.timeline = application.timeline || [];
  application.timeline.push({
    status: "under_review",
    notes: notes || "Administrator opened application for formal review",
    timestamp: new Date(),
    actor: { actorType: "admin", actorId: userId, role: "admin" },
  });

  await application.save();

  try {
    await AuditLog.create({
      actorId: userId,
      targetId: application._id,
      action: "REFUND_APPLICATION_UNDER_REVIEW",
      entityType: "RefundApplication",
      beforeState: { applicationStatus: "submitted" },
      afterState: { applicationStatus: "under_review" },
      reason: notes || "Application marked under review",
      ipAddress,
      userAgent,
    });
  } catch {}

  return formatApplicationDocument(application);
};

/**
 * Approves a Refund Application and locks the financial snapshot permanently.
 */
const approveRefundApplication = async ({
  applicationId,
  userId,
  notes = null,
  ipAddress = null,
  userAgent = null,
}) => {
  const application = await RefundApplication.findById(applicationId);
  if (!application) {
    throw new AppError("Refund application not found", 404, "APPLICATION_NOT_FOUND");
  }

  if (!["submitted", "under_review", "revision_requested"].includes(application.applicationStatus)) {
    if (application.applicationStatus === "approved") {
      return formatApplicationDocument(application);
    }
    throw new AppError(
      `Cannot approve application in status '${application.applicationStatus}'`,
      409,
      "INVALID_STATUS_TRANSITION"
    );
  }

  const requestedAmtStr = application.requestedAmount?.toString?.() || "0.00";
  application.approvedAmount = mongoose.Types.Decimal128.fromString(requestedAmtStr);
  application.applicationStatus = "approved";
  application.approvedBy = userId;
  application.approvedAt = new Date();
  if (notes) {
    application.administratorRemarks = notes;
  }

  application.timeline = application.timeline || [];
  application.timeline.push({
    status: "approved",
    notes: notes || `Administrator approved refund application for ₹${requestedAmtStr}`,
    timestamp: new Date(),
    actor: { actorType: "admin", actorId: userId, role: "admin" },
  });

  await application.save();

  // Audit Log
  try {
    await AuditLog.create({
      actorId: userId,
      targetId: application._id,
      action: "REFUND_APPLICATION_APPROVED",
      entityType: "RefundApplication",
      beforeState: { applicationStatus: application.applicationStatus },
      afterState: {
        applicationStatus: "approved",
        approvedAmount: requestedAmtStr,
      },
      reason: notes || "Refund application approved by administrator",
      ipAddress,
      userAgent,
    });
  } catch {}

  // Customer notification
  try {
    const order = await Order.findById(application.orderId).select("orderNumber");
    await customerNotificationService.createCustomerNotification({
      customerId: application.customerId,
      title: "Refund Application Approved",
      message: `Your refund application for order #${order?.orderNumber || ""} has been approved and queued for financial disbursement.`,
      type: "return",
    });
  } catch {}

  return formatApplicationDocument(application);
};

/**
 * Rejects a Refund Application with mandatory documented justification.
 */
const rejectRefundApplication = async ({
  applicationId,
  userId,
  reason,
  notes = null,
  ipAddress = null,
  userAgent = null,
}) => {
  if (!reason || !reason.trim() || reason.trim().length < 5) {
    throw new AppError(
      "A mandatory rejection reason (at least 5 characters) is required",
      400,
      "REJECTION_REASON_REQUIRED"
    );
  }

  const application = await RefundApplication.findById(applicationId);
  if (!application) {
    throw new AppError("Refund application not found", 404, "APPLICATION_NOT_FOUND");
  }

  if (!["submitted", "under_review", "revision_requested"].includes(application.applicationStatus)) {
    throw new AppError(
      `Cannot reject application in status '${application.applicationStatus}'`,
      409,
      "INVALID_STATUS_TRANSITION"
    );
  }

  application.applicationStatus = "rejected";
  application.rejectedBy = userId;
  application.rejectedAt = new Date();
  application.rejectionReason = reason.trim();
  if (notes) {
    application.administratorRemarks = notes;
  }

  application.timeline = application.timeline || [];
  application.timeline.push({
    status: "rejected",
    notes: `Administrator rejected refund application: ${reason.trim()}`,
    timestamp: new Date(),
    actor: { actorType: "admin", actorId: userId, role: "admin" },
  });

  await application.save();

  // Audit Log
  try {
    await AuditLog.create({
      actorId: userId,
      targetId: application._id,
      action: "REFUND_APPLICATION_REJECTED",
      entityType: "RefundApplication",
      beforeState: { applicationStatus: application.applicationStatus },
      afterState: { applicationStatus: "rejected", rejectionReason: reason.trim() },
      reason: reason.trim(),
      ipAddress,
      userAgent,
    });
  } catch {}

  // Customer notification
  try {
    const order = await Order.findById(application.orderId).select("orderNumber");
    await customerNotificationService.createCustomerNotification({
      customerId: application.customerId,
      title: "Refund Application Update",
      message: `The refund application for order #${order?.orderNumber || ""} was not approved. Reason: ${reason.trim()}`,
      type: "return",
    });
  } catch {}

  return formatApplicationDocument(application);
};

/**
 * Requests specific revisions or additional evidence from the merchant.
 */
const requestRefundApplicationRevision = async ({
  applicationId,
  userId,
  instructions,
  notes = null,
  ipAddress = null,
  userAgent = null,
}) => {
  if (!instructions || !instructions.trim() || instructions.trim().length < 5) {
    throw new AppError(
      "Specific revision instructions (at least 5 characters) are required for the merchant",
      400,
      "REVISION_INSTRUCTIONS_REQUIRED"
    );
  }

  const application = await RefundApplication.findById(applicationId);
  if (!application) {
    throw new AppError("Refund application not found", 404, "APPLICATION_NOT_FOUND");
  }

  if (!["submitted", "under_review"].includes(application.applicationStatus)) {
    throw new AppError(
      `Cannot request revision for application in status '${application.applicationStatus}'`,
      409,
      "INVALID_STATUS_TRANSITION"
    );
  }

  application.applicationStatus = "revision_requested";
  application.revisionInstructions = instructions.trim();
  if (notes) {
    application.administratorRemarks = notes;
  }

  application.timeline = application.timeline || [];
  application.timeline.push({
    status: "revision_requested",
    notes: `Administrator requested revision: ${instructions.trim()}`,
    timestamp: new Date(),
    actor: { actorType: "admin", actorId: userId, role: "admin" },
  });

  await application.save();

  // Audit Log
  try {
    await AuditLog.create({
      actorId: userId,
      targetId: application._id,
      action: "REFUND_APPLICATION_REVISION_REQUESTED",
      entityType: "RefundApplication",
      beforeState: { applicationStatus: application.applicationStatus },
      afterState: { applicationStatus: "revision_requested", instructions: instructions.trim() },
      reason: instructions.trim(),
      ipAddress,
      userAgent,
    });
  } catch {}

  return formatApplicationDocument(application);
};

/**
 * Initiates the actual customer refund disbursement via payment gateway or ledger reversal.
 * STRICT: Only accessible to authorized Admin/Superadmin with REFUNDS_CREATE / refund_disbursements.initiate.
 */
const disburseRefundApplication = async ({
  applicationId,
  userId,
  notes = null,
  bankReference = null,
  ipAddress = null,
  userAgent = null,
}) => {
  // Pre-flight atomic state transition: prevents concurrent disbursement race condition
  const application = await RefundApplication.findOneAndUpdate(
    {
      _id: applicationId,
      applicationStatus: { $in: ["approved", "disbursement_failed", "pending_confirmation"] },
    },
    {
      $set: {
        applicationStatus: "disbursement_processing",
        disbursementStatus: "processing",
        administratorRemarks: notes || undefined,
      },
      $push: {
        timeline: {
          status: "disbursement_processing",
          notes: notes ? `Disbursement initiated: ${notes}` : "Administrator initiated customer refund disbursement via gateway",
          timestamp: new Date(),
          actor: { actorType: "admin", actorId: userId, role: "admin" },
        },
      },
    },
    { new: true }
  );

  if (!application) {
    const existing = await RefundApplication.findById(applicationId);
    if (!existing) {
      throw new AppError("Refund application not found", 404, "APPLICATION_NOT_FOUND");
    }
    if (existing.applicationStatus === "disbursement_processing") {
      throw new AppError(
        "Refund disbursement is currently in progress by another administrator",
        409,
        "DISBURSEMENT_IN_PROGRESS"
      );
    }
    throw new AppError(
      `Cannot initiate disbursement for application in status '${existing.applicationStatus}'. Application must be approved first.`,
      400,
      "APPLICATION_NOT_APPROVED"
    );
  }

  const ret = await ReturnRequest.findById(application.returnId);
  if (!ret) {
    throw new AppError("Return request not found", 404, "RETURN_NOT_FOUND");
  }

  const order = await Order.findById(application.orderId);
  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  // Check if an existing gateway refund exists for this return to prevent duplicate disbursement
  const idempotencyKey = `ret_refund_${ret._id.toString()}`;
  const Refund = require("../models/Refund");
  const existingRefund =
    (application.disbursementReference ? await Refund.findById(application.disbursementReference) : null) ||
    (ret.refundId ? await Refund.findById(ret.refundId) : null) ||
    (await Refund.findOne({ orderId: application.orderId, idempotencyKey }));

  if (existingRefund && existingRefund.gatewayRefundId) {
    // If already processed, mark application disbursed immediately
    if (existingRefund.status === "processed") {
      application.applicationStatus = "disbursed";
      application.disbursementStatus = "disbursed";
      application.disbursementReference = existingRefund._id;
      application.gatewayRefundId = existingRefund.gatewayRefundId;
      application.gatewayStatus = "processed";
      application.disbursedAmount = application.approvedAmount || application.requestedAmount;
      application.disbursedAt = existingRefund.processedAt || new Date();
      await application.save();
      return formatApplicationDocument(application);
    }

    // If pending, reconcile with gateway rather than creating another refund
    if (existingRefund.status === "pending") {
      const refundService = require("./refund.service");
      const recResult = await refundService.reconcileGatewayRefund({
        refundId: existingRefund._id,
        gatewayRefundId: existingRefund.gatewayRefundId,
        userId,
      });

      const refreshed = await RefundApplication.findById(application._id);
      if (refreshed.applicationStatus === "disbursed") {
        return formatApplicationDocument(refreshed);
      }

      // Still pending at gateway
      return formatApplicationDocument(refreshed);
    }
  }

  try {
    // Invoke Authoritative Gateway Refund Processor
    const updatedReturn = await processReturnRefund({
      userId,
      returnId: ret._id,
      notes: notes || application.administratorRemarks,
      bankReference,
      strict: false,
      ipAddress,
      userAgent,
      isAdmin: true, // Sole administrative disbursement execution
    });

    if (updatedReturn && updatedReturn.status === "refund_pending") {
      const pendingRefund = updatedReturn.refundId ? await Refund.findById(updatedReturn.refundId) : null;
      application.applicationStatus = "pending_confirmation";
      application.disbursementStatus = "pending";
      application.disbursementReference = updatedReturn.refundId || null;
      application.gatewayRefundId = pendingRefund?.gatewayRefundId || null;
      application.gatewayStatus = "pending";
      application.normalizedGatewayMessage = "Refund pending gateway confirmation";
      application.failureDetails = {
        code: "GATEWAY_TIMEOUT",
        message: "Payment gateway disbursement outcome is uncertain or timed out: GATEWAY_TIMEOUT",
        failedAt: new Date(),
      };
      application.timeline.push({
        status: "pending_confirmation",
        notes: "Refund initiated at payment gateway; pending authoritative settlement confirmation",
        timestamp: new Date(),
        actor: { actorType: "admin", actorId: userId, role: "admin" },
      });
      await application.save();

      throw new AppError(
        "Payment gateway disbursement outcome is uncertain or timed out: GATEWAY_TIMEOUT",
        502,
        "DISBURSEMENT_GATEWAY_FAILED"
      );
    }

    if (!updatedReturn || updatedReturn.status !== "refunded") {
      throw new AppError(
        "Payment gateway disbursement outcome is uncertain or timed out: GATEWAY_TIMEOUT",
        502,
        "DISBURSEMENT_GATEWAY_FAILED"
      );
    }

    // Confirmed Disbursement Success
    const disbAmtStr = (application.approvedAmount || application.requestedAmount).toString();
    const createdRefund = updatedReturn.refundId ? await Refund.findById(updatedReturn.refundId) : null;

    application.applicationStatus = "disbursed";
    application.disbursementStatus = "disbursed";
    application.disbursedAmount = mongoose.Types.Decimal128.fromString(disbAmtStr);
    application.disbursedAt = new Date();
    application.disbursementReference = updatedReturn.refundId || null;
    application.gatewayRefundId = createdRefund?.gatewayRefundId || null;
    application.gatewayStatus = "processed";
    application.normalizedGatewayMessage = "Refund processed successfully";
    application.failureDetails = null;

    application.timeline.push({
      status: "disbursed",
      notes: `Refund of ₹${disbAmtStr} successfully disbursed to customer`,
      timestamp: new Date(),
      actor: { actorType: "admin", actorId: userId, role: "admin" },
    });

    await application.save();

    // Audit Log
    try {
      await AuditLog.create({
        actorId: userId,
        targetId: application._id,
        action: "REFUND_APPLICATION_DISBURSED",
        entityType: "RefundApplication",
        beforeState: { applicationStatus: "disbursement_processing" },
        afterState: {
          applicationStatus: "disbursed",
          disbursedAmount: disbAmtStr,
          refundId: updatedReturn.refundId,
          gatewayRefundId: application.gatewayRefundId,
        },
        reason: notes || "Refund disbursed by administrator",
        ipAddress,
        userAgent,
      });
    } catch {}

    // Customer Notification
    try {
      await customerNotificationService.createCustomerNotification({
        customerId: application.customerId,
        title: "Refund Successfully Disbursed",
        message: `Your refund of ₹${disbAmtStr} for order #${order.orderNumber} has been successfully processed.`,
        type: "refund",
      });
    } catch {}

    return formatApplicationDocument(application);
  } catch (err) {
    if (application.applicationStatus === "pending_confirmation") {
      throw err;
    }

    const isTimeout =
      Boolean(err?.isTimeout) ||
      err?.statusCode === 504 ||
      err?.code === "ETIMEDOUT" ||
      err?.code === "ESOCKETTIMEDOUT";

    if (isTimeout) {
      application.applicationStatus = "pending_confirmation";
      application.disbursementStatus = "pending";
      application.normalizedGatewayMessage = "Gateway request timed out; outcome uncertain. Reconciliation required.";
      application.failureDetails = {
        code: "GATEWAY_TIMEOUT",
        message: "Payment gateway timeout. Authoritative reconciliation required before retry.",
        failedAt: new Date(),
      };
      application.timeline.push({
        status: "pending_confirmation",
        notes: "Gateway timeout during disbursement. Marked pending confirmation for reconciliation.",
        timestamp: new Date(),
        actor: { actorType: "admin", actorId: userId, role: "admin" },
      });
      await application.save();

      throw new AppError(
        `Disbursement gateway execution failed: ${err.message}`,
        502,
        "DISBURSEMENT_GATEWAY_FAILED"
      );
    }

    // Definite Gateway Failure
    application.applicationStatus = "disbursement_failed";
    application.disbursementStatus = "failed";
    application.failureDetails = {
      code: err.errorCode || err.name || "GATEWAY_ERROR",
      message: err.message || "Payment gateway disbursement failed",
      failedAt: new Date(),
    };

    application.timeline.push({
      status: "disbursement_failed",
      notes: `Disbursement failed: ${err.message}`,
      timestamp: new Date(),
      actor: { actorType: "admin", actorId: userId, role: "admin" },
    });

    await application.save();

    try {
      await AuditLog.create({
        actorId: userId,
        targetId: application._id,
        action: "REFUND_APPLICATION_DISBURSEMENT_FAILED",
        entityType: "RefundApplication",
        beforeState: { applicationStatus: "disbursement_processing" },
        afterState: {
          applicationStatus: "disbursement_failed",
          failureReason: err.message,
        },
        reason: err.message,
        ipAddress,
        userAgent,
      });
    } catch {}

    throw new AppError(
      `Disbursement gateway execution failed: ${err.message}`,
      502,
      "DISBURSEMENT_GATEWAY_FAILED"
    );
  }
};

/**
 * Reconciles an active or pending refund disbursement application against authoritative gateway state.
 */
const reconcileRefundApplicationDisbursement = async ({
  applicationId,
  userId,
  ipAddress = null,
  userAgent = null,
}) => {
  const application = await RefundApplication.findById(applicationId);
  if (!application) {
    throw new AppError("Refund application not found", 404, "APPLICATION_NOT_FOUND");
  }

  // Locate associated Refund document
  const Refund = require("../models/Refund");
  let refund = null;
  if (application.disbursementReference) {
    refund = await Refund.findById(application.disbursementReference);
  }
  if (!refund) {
    const ret = await ReturnRequest.findById(application.returnId);
    if (ret?.refundId) {
      refund = await Refund.findById(ret.refundId);
    }
  }
  if (!refund) {
    const idempotencyKey = `ret_refund_${application.returnId.toString()}`;
    refund = await Refund.findOne({ orderId: application.orderId, idempotencyKey });
  }

  const effectiveGatewayRefundId = application.gatewayRefundId || refund?.gatewayRefundId;
  if (!effectiveGatewayRefundId && !refund) {
    throw new AppError(
      "Cannot reconcile application: No gateway refund transaction has been initiated yet.",
      400,
      "RECONCILIATION_NOT_APPLICABLE"
    );
  }

  const refundService = require("./refund.service");
  await refundService.reconcileGatewayRefund({
    refundId: refund?._id,
    gatewayRefundId: effectiveGatewayRefundId,
    userId,
  });

  const refreshed = await RefundApplication.findById(application._id);
  return formatApplicationDocument(refreshed);
};

const toDecimalString = (val, defaultVal = null) => {
  if (val === null || val === undefined) return defaultVal;
  if (typeof val === "object" && val.$numberDecimal) return val.$numberDecimal;
  if (val.toString) return val.toString();
  return String(val);
};

/**
 * Format helper for clean JSON serialization of Decimal128 and ObjectIds.
 */
const formatApplicationDocument = (doc) => {
  if (!doc) return null;
  const raw = doc.toObject ? doc.toObject() : doc;

  return {
    ...raw,
    _id: raw._id,
    id: raw._id,
    requestedAmount: toDecimalString(raw.requestedAmount, "0.00"),
    approvedAmount: raw.approvedAmount != null ? toDecimalString(raw.approvedAmount, null) : null,
    disbursedAmount: raw.disbursedAmount != null ? toDecimalString(raw.disbursedAmount, null) : null,
  };
};

module.exports = {
  submitRefundApplication,
  resubmitRefundApplication,
  getRefundApplicationByReturnId,
  getAdminRefundApplications,
  getAdminRefundApplicationById,
  reviewRefundApplication,
  approveRefundApplication,
  rejectRefundApplication,
  requestRefundApplicationRevision,
  disburseRefundApplication,
  reconcileRefundApplicationDisbursement,
};
