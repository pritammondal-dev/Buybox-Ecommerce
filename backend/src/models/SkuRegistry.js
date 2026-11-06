const mongoose = require("mongoose");

/**
 * SkuRegistry provides a centralized, hardware-indexed single namespace
 * to eliminate cross-collection SKU race conditions between Product and ProductVariant.
 *
 * In MongoDB, unique indexes are enforced per collection. Prior to SkuRegistry,
 * concurrent creations of a Product and a ProductVariant with the same SKU
 * could pass sequential existence checks and commit simultaneously to separate collections.
 *
 * SkuRegistry enforces atomic uniqueness on `sku` with a partialFilterExpression
 * ignoring soft-deleted records, guaranteeing that any concurrent attempt to reserve
 * the same SKU is serialized and rejected by WiredTiger's unique index engine.
 */
const skuRegistrySchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    entityType: {
      type: String,
      enum: ["product", "variant"],
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null,
      index: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
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

// Atomic uniqueness across active catalog SKUs
skuRegistrySchema.index(
  { sku: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

skuRegistrySchema.index({
  productId: 1,
  variantId: 1,
  deletedAt: 1,
});

module.exports = mongoose.model("SkuRegistry", skuRegistrySchema);
