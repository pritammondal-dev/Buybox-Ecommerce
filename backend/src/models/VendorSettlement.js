const mongoose = require("mongoose");

const { Schema } = mongoose;

const VENDOR_SETTLEMENT_STATUSES = Object.freeze([
  "pending",
  "processing",
  "payable",
  "paid",
  "failed",
  "cancelled",
]);

const vendorSettlementSchema = new Schema(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    settlementNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 100,
    },

    periodStart: {
      type: Date,
      required: true,
    },

    periodEnd: {
      type: Date,
      required: true,
    },

    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },

    grossSales: {
      type: Schema.Types.Decimal128,
      required: true,
      default: "0.00",
    },

    discounts: {
      type: Schema.Types.Decimal128,
      required: true,
      default: "0.00",
    },

    refunds: {
      type: Schema.Types.Decimal128,
      required: true,
      default: "0.00",
    },

    platformCommission: {
      type: Schema.Types.Decimal128,
      required: true,
      default: "0.00",
    },

    netPayable: {
      type: Schema.Types.Decimal128,
      required: true,
      default: "0.00",
    },

    status: {
      type: String,
      enum: VENDOR_SETTLEMENT_STATUSES,
      default: "pending",
      required: true,
      index: true,
    },

    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    processedAt: {
      type: Date,
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    failureReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    metadata: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

vendorSettlementSchema.index({
  vendorId: 1,
  periodStart: 1,
  periodEnd: 1,
});

vendorSettlementSchema.index({
  vendorId: 1,
  status: 1,
  createdAt: -1,
});

vendorSettlementSchema.index(
  {
    vendorId: 1,
    idempotencyKey: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: {
        $type: "string",
      },
    },
  }
);

vendorSettlementSchema.pre("validate", function validateSettlement() {
  if (this.periodEnd <= this.periodStart) {
    throw new Error(
      "Settlement period end must be after period start"
    );
  }
});

module.exports = {
  VendorSettlement: mongoose.model(
    "VendorSettlement",
    vendorSettlementSchema
  ),
  VENDOR_SETTLEMENT_STATUSES,
};