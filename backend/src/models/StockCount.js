const mongoose = require("mongoose");

const countItemSchema = new mongoose.Schema(
  {
    productVariantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
    },
    productName: {
      type: String,
      default: "",
      trim: true,
    },
    snapshotOnHand: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Snapshot on-hand must be an integer",
      },
    },
    countedOnHand: {
      type: Number,
      default: null,
      min: 0,
      validate: {
        validator: (val) => val === null || Number.isInteger(val),
        message: "Counted on-hand must be an integer",
      },
    },
    discrepancy: {
      type: Number,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Discrepancy must be an integer",
      },
    },
    reason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 200,
    },
    adjustmentApplied: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

countItemSchema.virtual("systemQuantitySnapshot")
  .get(function () {
    return this.snapshotOnHand;
  })
  .set(function (val) {
    this.snapshotOnHand = val;
  });

const stockCountSchema = new mongoose.Schema(
  {
    countNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 50,
      index: true,
    },

    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },

    scope: {
      type: String,
      enum: ["full", "partial", "cycle", "cycle_count"],
      default: "full",
    },

    status: {
      type: String,
      enum: ["draft", "in_progress", "review", "completed", "finalized", "cancelled"],
      default: "draft",
      index: true,
    },

    items: {
      type: [countItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: "Stock count must contain at least one item",
      },
    },

    notes: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },

    snapshotAt: {
      type: Date,
      default: Date.now,
    },

    startedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancellationReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

stockCountSchema.virtual("countedByUserId", {
  ref: "User",
  localField: "completedBy",
  foreignField: "_id",
  justOne: true,
});

stockCountSchema.index({ warehouseId: 1, status: 1 });
stockCountSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("StockCount", stockCountSchema);
