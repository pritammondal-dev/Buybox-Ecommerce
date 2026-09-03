const mongoose = require("mongoose");

const inventoryTransactionSchema = new mongoose.Schema(
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

    type: {
      type: String,
      enum: [
        "receive",
        "adjustment",
        "reservation",
        "release",
        "sale",
        "return",
        "transfer",
      ],
      required: true,
      index: true,
    },

    quantity: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be an integer",
      },
    },

    onHandBefore: {
      type: Number,
      required: true,
      min: 0,
    },

    onHandAfter: {
      type: Number,
      required: true,
      min: 0,
    },

    reservedBefore: {
      type: Number,
      required: true,
      min: 0,
    },

    reservedAfter: {
      type: Number,
      required: true,
      min: 0,
    },

    referenceType: {
      type: String,
      default: null,
      trim: true,
      maxlength: 50,
    },

    referenceId: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },

    idempotencyKey: {
      type: String,
      default: null,
      trim: true,
      maxlength: 150,
      index: true,
    },

    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    notes: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

inventoryTransactionSchema.index({
  productVariantId: 1,
  warehouseId: 1,
  createdAt: -1,
});

inventoryTransactionSchema.index({
  warehouseId: 1,
  createdAt: -1,
});

inventoryTransactionSchema.index({
  idempotencyKey: 1,
  type: 1,
});

module.exports = mongoose.model(
  "InventoryTransaction",
  inventoryTransactionSchema
);