const mongoose = require("mongoose");

const platformCredentialSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      unique: true,
      enum: [
        "elastic_email",
        "razorpay",
        "paypal",
        "delhivery",
        "shiprocket",
      ],
      index: true,
    },

    category: {
      type: String,
      required: true,
      enum: ["email", "payment", "shipping", "storage"],
      index: true,
    },

    encryptedPayload: {
      type: String,
      required: true,
    },

    maskedSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    status: {
      type: String,
      required: true,
      enum: ["connected", "not_configured", "error"],
      default: "not_configured",
      index: true,
    },

    lastTestedAt: {
      type: Date,
      default: null,
    },

    lastTestStatus: {
      type: String,
      enum: ["success", "failed", null],
      default: null,
    },

    lastTestError: {
      type: String,
      default: null,
      maxlength: 1000,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("PlatformCredential", platformCredentialSchema);
