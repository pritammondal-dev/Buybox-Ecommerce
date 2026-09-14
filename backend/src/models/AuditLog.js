const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    beforeState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    afterState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
      trim: true,
    },
    userAgent: {
      type: String,
      default: null,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ targetId: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

// Safeguard append-only immutability at the Mongoose schema level
auditLogSchema.pre("save", function () {
  if (!this.isNew) {
    throw new Error(
      "AuditLog records are append-only and cannot be updated"
    );
  }
});

auditLogSchema.pre(
  ["updateOne", "updateMany", "findOneAndUpdate", "findByIdAndUpdate"],
  function () {
    throw new Error(
      "AuditLog records are append-only and cannot be updated"
    );
  }
);

auditLogSchema.pre(
  ["deleteOne", "deleteMany", "findOneAndDelete", "findByIdAndDelete"],
  function () {
    throw new Error(
      "AuditLog records are append-only and cannot be deleted"
    );
  }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
