const mongoose = require("mongoose");
const { Schema } = mongoose;

const VENDOR_BANK_ACCOUNT_STATUSES = Object.freeze([
  "pending",
  "under_review",
  "approved",
  "rejected",
]);

const VENDOR_BANK_ACCOUNT_TYPES = Object.freeze([
  "savings",
  "current",
  "other",
]);

const MAX_BANK_ACCOUNTS_PER_VENDOR = 3;

const vendorBankAccountSchema = new Schema(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    partnerBankId: {
      type: Schema.Types.ObjectId,
      ref: "PartnerBank",
      default: null,
      index: true,
    },

    accountHolderName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    bankName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    // AES-256-GCM ciphertext in format: enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
    accountNumberEncrypted: {
      type: String,
      required: true,
      trim: true,
    },

    // Presentation format, e.g., "••••••••••••1234"
    accountNumberMasked: {
      type: String,
      required: true,
      trim: true,
    },

    // Blind HMAC-SHA256 index for privacy-preserving duplicate detection
    accountNumberHash: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // Indian Financial System Code (IFSC) format validation (4 letters, 0, 6 alphanumeric)
    ifscCode: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) {
            return this.country !== "IN";
          }
          if (!this.country || this.country === "IN") {
            return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v);
          }
          return true;
        },
        message: "Invalid Indian IFSC format. Expected 4 letters, '0', followed by 6 alphanumeric characters.",
      },
    },

    branchName: {
      type: String,
      default: null,
      trim: true,
      maxlength: 150,
    },

    country: {
      type: String,
      default: "IN",
      trim: true,
      uppercase: true,
      maxlength: 2,
    },

    state: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },

    accountType: {
      type: String,
      enum: VENDOR_BANK_ACCOUNT_TYPES,
      default: "current",
      required: true,
    },

    status: {
      type: String,
      enum: VENDOR_BANK_ACCOUNT_STATUSES,
      default: "pending",
      required: true,
      index: true,
    },

    // True ONLY if approved AND currently selected as payout destination
    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Submission Metadata
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    submittedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },

    submissionReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },

    // Reviewer & Audit Metadata
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    activatedAt: {
      type: Date,
      default: null,
    },

    deactivatedAt: {
      type: Date,
      default: null,
    },

    deactivatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Deactivation & Soft-Delete Tracking
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },

    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    deletedReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },

    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret.accountNumberEncrypted;
        delete ret.accountNumberHash;
        return ret;
      },
    },
    toObject: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        return ret;
      },
    },
  }
);

// 1. Exactly one active bank account per vendor (partial index excluding soft-deleted)
vendorBankAccountSchema.index(
  { vendorId: 1, isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true, deletedAt: null },
  }
);

// 2. Prevent duplicate account number + IFSC per vendor (excluding soft-deleted)
vendorBankAccountSchema.index(
  { vendorId: 1, accountNumberHash: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
  }
);

// 3. Review queue sorting & chronological index
vendorBankAccountSchema.index({ status: 1, submittedAt: -1 });
vendorBankAccountSchema.index({ vendorId: 1, createdAt: -1 });

const VendorBankAccount = mongoose.model("VendorBankAccount", vendorBankAccountSchema);

module.exports = VendorBankAccount;
module.exports.VendorBankAccount = VendorBankAccount;
module.exports.VENDOR_BANK_ACCOUNT_STATUSES = VENDOR_BANK_ACCOUNT_STATUSES;
module.exports.VENDOR_BANK_ACCOUNT_TYPES = VENDOR_BANK_ACCOUNT_TYPES;
module.exports.MAX_BANK_ACCOUNTS_PER_VENDOR = MAX_BANK_ACCOUNTS_PER_VENDOR;

