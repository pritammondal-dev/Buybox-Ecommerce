const mongoose = require("mongoose");

const refundApplicationSchema = new mongoose.Schema(
  {
    applicationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    returnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReturnRequest",
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    authoritativeRefundBreakdown: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    requestedAmount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    approvedAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },
    disbursedAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
    },
    applicationStatus: {
      type: String,
      enum: [
        "submitted",
        "under_review",
        "revision_requested",
        "approved",
        "rejected",
        "disbursement_processing",
        "pending_confirmation",
        "disbursed",
        "disbursement_failed",
        "reversed",
      ],
      default: "submitted",
      index: true,
    },
    merchantRemarks: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },
    deductionExplanation: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },
    supportingDocuments: [
      {
        url: { type: String, required: true },
        name: { type: String, default: "Document" },
        caption: { type: String, default: null },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    administratorRemarks: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },
    rejectionReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },
    revisionInstructions: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },
    revisionHistory: [
      {
        revisionNumber: { type: Number, required: true },
        requestedAt: { type: Date, default: Date.now },
        requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        instructions: { type: String, required: true },
        previousRemarks: { type: String, default: null },
        resubmittedAt: { type: Date, default: null },
        resubmittedRemarks: { type: String, default: null },
      },
    ],
    inspectionSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    paymentSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    disbursementReference: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Refund",
      default: null,
    },
    gatewayRefundId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    gatewayStatus: {
      type: String,
      default: null,
      trim: true,
    },
    arn: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    acquirerData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    lastReconciledAt: {
      type: Date,
      default: null,
    },
    normalizedGatewayMessage: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },
    reconciliationHistory: [
      {
        reconciledAt: { type: Date, default: Date.now },
        reconciledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        previousStatus: { type: String, default: null },
        newStatus: { type: String, default: null },
        gatewayStatus: { type: String, default: null },
        message: { type: String, default: null },
        rawMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
      },
    ],
    disbursementStatus: {
      type: String,
      enum: ["pending", "processing", "disbursed", "failed"],
      default: "pending",
      index: true,
    },
    disbursedAt: {
      type: Date,
      default: null,
    },
    failureDetails: {
      code: { type: String, default: null },
      message: { type: String, default: null },
      failedAt: { type: Date, default: null },
    },
    idempotencyKey: {
      type: String,
      default: null,
      trim: true,
      maxlength: 128,
    },
    timeline: [
      {
        status: { type: String, required: true },
        notes: { type: String, default: null },
        timestamp: { type: Date, default: Date.now },
        actor: {
          actorType: { type: String, default: "system" },
          actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
          role: { type: String, default: null },
        },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

refundApplicationSchema.index({ returnId: 1, applicationStatus: 1 });
refundApplicationSchema.index({ merchantId: 1, applicationStatus: 1 });
refundApplicationSchema.index({ createdAt: -1 });

module.exports = mongoose.model("RefundApplication", refundApplicationSchema);
