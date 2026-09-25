const mongoose = require("mongoose");
const { OTP_PURPOSES } = require("../constants/auth.constants");

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
      default: null,
      index: true,
    },

    phone: {
      type: String,
      required: false,
      trim: true,
      default: null,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    purpose: {
      type: String,
      required: true,
      enum: Object.values(OTP_PURPOSES),
      default: OTP_PURPOSES.EMAIL_VERIFICATION,
      index: true,
    },

    otpHash: {
      type: String,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    attemptsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    resendCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastResentAt: {
      type: Date,
      default: Date.now,
    },

    isUsed: {
      type: Boolean,
      default: false,
      index: true,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Require at least email or phone on validation
otpSchema.pre("validate", function () {
  if (!this.email && !this.phone) {
    throw new Error("OTP record requires an email address or a phone number destination.");
  }
});

// Compound indexes for active lookup
otpSchema.index({ email: 1, purpose: 1, isUsed: 1 });
otpSchema.index({ phone: 1, purpose: 1, isUsed: 1 });

// TTL index for automatic expiration cleanup
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Otp", otpSchema);

