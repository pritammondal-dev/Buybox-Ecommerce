const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    productVariantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
      index: true,
    },

    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },

    onHand: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    reserved: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    lowStockThreshold: {
      type: Number,
      min: 0,
      default: 5,
    },

    reorderLevel: {
      type: Number,
      min: 0,
      default: 10,
    },

    damaged: {
      type: Number,
      default: 0,
      min: 0,
    },

    defective: {
      type: Number,
      default: 0,
      min: 0,
    },

    expired: {
      type: Number,
      default: 0,
      min: 0,
    },

    version: {
      type: Number,
      default: 0,
    },

    lastStockUpdateAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

inventorySchema.index(
  {
    productVariantId: 1,
    warehouseId: 1,
  },
  {
    unique: true,
  }
);

inventorySchema.virtual("available").get(function () {
  const nonSellable =
    (this.damaged || 0) + (this.defective || 0) + (this.expired || 0);
  return Math.max(this.onHand - this.reserved - nonSellable, 0);
});

inventorySchema.virtual("nonSellable").get(function () {
  return (this.damaged || 0) + (this.defective || 0) + (this.expired || 0);
});

inventorySchema.set("toJSON", {
  virtuals: true,
});
inventorySchema.set("toObject", {
  virtuals: true,
});

module.exports = mongoose.model(
  "Inventory",
  inventorySchema
);