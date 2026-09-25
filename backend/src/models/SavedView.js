const mongoose = require("mongoose");

const savedViewSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    resource: {
      type: String,
      required: true,
      trim: true,
      enum: [
        "products",
        "orders",
        "customers",
        "vendors",
        "inventory",
        "warehouses",
        "tasks",
        "returns",
        "refunds",
        "shipments",
        "support",
        "reviews",
        "staff",
      ],
      index: true,
    },
    filters: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    sort: {
      field: { type: String, default: "createdAt" },
      order: { type: String, enum: ["asc", "desc"], default: "desc" },
    },
    columns: {
      type: [String],
      default: [],
    },
    isShared: {
      type: Boolean,
      default: false,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

savedViewSchema.index({ userId: 1, resource: 1 });

module.exports = mongoose.models.SavedView || mongoose.model("SavedView", savedViewSchema);
