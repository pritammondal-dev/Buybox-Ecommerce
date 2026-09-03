const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    businessName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    businessSlug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    phone: {
      type: String,
      default: null,
      trim: true,
      maxlength: 20,
    },

    supportEmail: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },

    businessAddress: {
      addressLine1: {
        type: String,
        default: null,
        trim: true,
        maxlength: 200,
      },

      addressLine2: {
        type: String,
        default: null,
        trim: true,
        maxlength: 200,
      },

      city: {
        type: String,
        default: null,
        trim: true,
        maxlength: 100,
      },

      state: {
        type: String,
        default: null,
        trim: true,
        maxlength: 100,
      },

      postalCode: {
        type: String,
        default: null,
        trim: true,
        maxlength: 20,
      },

      country: {
        type: String,
        default: "IN",
        uppercase: true,
        trim: true,
        maxlength: 2,
      },
    },

    taxInformation: {
      taxId: {
        type: String,
        default: null,
        trim: true,
        maxlength: 100,
      },

      taxType: {
        type: String,
        default: null,
        trim: true,
        maxlength: 50,
      },
    },

    onboardingStatus: {
      type: String,
      enum: [
        "pending",
        "under_review",
        "approved",
        "rejected",
        "suspended",
        "inactive",
      ],
      default: "pending",
      index: true,
    },

    rejectionReason: {
      type: String,
      default: null,
      maxlength: 500,
    },

    commissionRate: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

vendorSchema.index({
  onboardingStatus: 1,
  isActive: 1,
});

vendorSchema.index({
  deletedAt: 1,
  createdAt: -1,
});

module.exports = mongoose.model("Vendor", vendorSchema);