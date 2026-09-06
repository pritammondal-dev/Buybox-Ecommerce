const mongoose = require("mongoose");

const shipmentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },

    shipmentNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    idempotencyKey: {
      type: String,
      trim: true,
      minlength: 8,
      maxlength: 128,
    },

    status: {
      type: String,
      required: true,
      enum: [
        "created",
        "ready_to_ship",
        "picked_up",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "failed",
        "cancelled",
        "returned",
      ],
      default: "created",
      index: true,
    },

    carrier: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },

    serviceLevel: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },

    trackingNumber: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    trackingUrl: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },

    shippingAddress: {
      fullName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
      },

      phone: {
        type: String,
        required: true,
        trim: true,
        maxlength: 30,
      },

      addressLine1: {
        type: String,
        required: true,
        trim: true,
        maxlength: 300,
      },

      addressLine2: {
        type: String,
        default: null,
        trim: true,
        maxlength: 300,
      },

      city: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
      },

      state: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
      },

      postalCode: {
        type: String,
        required: true,
        trim: true,
        maxlength: 20,
      },

      country: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
      },
    },

    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },

        productVariantId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ProductVariant",
          required: true,
        },

        sku: {
          type: String,
          required: true,
          trim: true,
          maxlength: 100,
        },

        name: {
          type: String,
          required: true,
          trim: true,
          maxlength: 300,
        },

        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
      },
    ],

    shippedAt: {
      type: Date,
      default: null,
    },

    deliveredAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    returnedAt: {
      type: Date,
      default: null,
    },

    failureReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },

    metadata: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

shipmentSchema.index({
  orderId: 1,
  vendorId: 1,
});

shipmentSchema.index({
  carrier: 1,
  trackingNumber: 1,
});

shipmentSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" },
    },
  }
);

module.exports = mongoose.model("Shipment", shipmentSchema);