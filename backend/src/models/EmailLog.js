const mongoose = require("mongoose");

const emailLogSchema = new mongoose.Schema(
  {
    recipient: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    emailType: {
      type: String,
      required: true,
      index: true,
    },

    provider: {
      type: String,
      required: true,
      default: "elastic_email",
    },

    providerMessageId: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      required: true,
      enum: ["queued", "sent", "failed"],
      default: "queued",
      index: true,
    },

    attemptCount: {
      type: Number,
      default: 1,
    },

    failureReason: {
      type: String,
      default: null,
      maxlength: 1000,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

emailLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("EmailLog", emailLogSchema);
