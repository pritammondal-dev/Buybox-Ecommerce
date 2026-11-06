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

    vendorFulfillmentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
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
        "booking_pending",
        "booked",
        "awb_assigned",
        "label_available",
        "pickup_scheduled",
        "ready_to_ship",
        "picked_up",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "failed",
        "exception",
        "rto_initiated",
        "rto_in_transit",
        "rto_delivered",
        "cancelled",
        "cancellation_pending",
        "booking_failed",
        "returned",
      ],
      default: "created",
      index: true,
    },

    inventoryStatus: {
      type: String,
      enum: [
        "reserved",
        "released",
        "deducted",
        "rto_pending",
        "restocked",
        "quarantined",
      ],
      default: "reserved",
      required: true,
      index: true,
    },

    inventoryReleasedAt: {
      type: Date,
      default: null,
    },

    dispatchBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },

    cancellationClaim: {
      claimedAt: { type: Date, default: null },
      claimedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
      operationId: { type: String, default: null, trim: true },
      itemIds: [{ type: String }],
    },

    carrier: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },

    provider: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    providerType: {
      type: String,
      enum: ["integrated", "manual"],
      default: "integrated",
    },

    providerShipmentId: {
      type: String,
      default: null,
      trim: true,
    },

    providerOrderId: {
      type: String,
      default: null,
      trim: true,
    },

    bookingDetails: {
      attemptedAt: {
        type: Date,
        default: null,
      },
      provider: {
        type: String,
        default: null,
      },
      status: {
        type: String,
        enum: ["unattempted", "pending", "booked", "failed", "not_configured"],
        default: "unattempted",
      },
      errorCode: {
        type: String,
        default: null,
      },
      errorMessage: {
        type: String,
        default: null,
      },
      attempts: {
        type: Number,
        default: 0,
      },
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

    awbNumber: {
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

    labelUrl: {
      type: String,
      default: null,
      trim: true,
    },

    labelPdf: {
      type: String,
      default: null,
    },

    labelGeneratedAt: {
      type: Date,
      default: null,
    },

    pickupSchedule: {
      scheduledDate: {
        type: Date,
        default: null,
      },
      timeSlot: {
        type: String,
        default: null,
      },
      pickupToken: {
        type: String,
        default: null,
      },
      status: {
        type: String,
        enum: ["unassigned", "scheduled", "completed", "failed", "cancelled"],
        default: "unassigned",
      },
      notes: {
        type: String,
        default: null,
      },
      scheduledAt: {
        type: Date,
        default: null,
      },
    },

    packageDetails: {
      weightGrams: {
        type: Number,
        default: 500,
      },
      lengthCm: {
        type: Number,
        default: 10,
      },
      breadthCm: {
        type: Number,
        default: 10,
      },
      heightCm: {
        type: Number,
        default: 10,
      },
      packageType: {
        type: String,
        default: "box",
      },
    },

    expectedDeliveryDate: {
      type: Date,
      default: null,
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

    trackingEvents: [
      {
        status: {
          type: String,
          required: true,
        },
        milestone: {
          type: String,
          default: null,
        },
        location: {
          type: String,
          default: null,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        description: {
          type: String,
          default: null,
        },
        source: {
          type: String,
          enum: [
            "carrier_webhook",
            "carrier_poll",
            "vendor_manual",
            "admin_override",
            "system",
          ],
          default: "system",
        },
        rawPayload: {
          type: mongoose.Schema.Types.Mixed,
          default: null,
        },
      },
    ],

    exceptionDetails: {
      reason: {
        type: String,
        default: null,
      },
      category: {
        type: String,
        default: null,
      },
      actionRequired: {
        type: String,
        default: null,
      },
      occurredAt: {
        type: Date,
        default: null,
      },
    },

    rtoDetails: {
      initiatedAt: {
        type: Date,
        default: null,
      },
      reason: {
        type: String,
        default: null,
      },
      rtoAwb: {
        type: String,
        default: null,
      },
      deliveredAt: {
        type: Date,
        default: null,
      },
    },

    rtoInspection: {
      receivedAt: {
        type: Date,
        default: null,
      },
      inspectedAt: {
        type: Date,
        default: null,
      },
      inspectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },
      outcome: {
        type: String,
        enum: ["resellable", "damaged", "defective", null],
        default: null,
      },
      condition: {
        type: String,
        default: null,
      },
      notes: {
        type: String,
        default: null,
      },
      restocked: {
        type: Boolean,
        default: false,
      },
      refundIssued: {
        type: Boolean,
        default: false,
      },
      refundAmount: {
        type: mongoose.Schema.Types.Decimal128,
        default: null,
      },
      creditNoteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CreditNote",
        default: null,
      },
    },

    cancellationDetails: {
      requestedAt: {
        type: Date,
        default: null,
      },
      reason: {
        type: String,
        default: null,
      },
      cancelledBy: {
        type: String,
        default: null,
      },
      carrierAck: {
        type: Boolean,
        default: false,
      },
    },

    isManual: {
      type: Boolean,
      default: false,
    },

    version: {
      type: Number,
      default: 1,
      index: true,
    },

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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual alias for events / trackingHistory for backwards compatibility with frontends
shipmentSchema.virtual("events").get(function () {
  return this.trackingEvents || [];
});

shipmentSchema.virtual("trackingHistory").get(function () {
  return this.trackingEvents || [];
});

// Pre-save synchronization hook between awbNumber and trackingNumber
shipmentSchema.pre("save", function () {
  if (this.awbNumber && !this.trackingNumber) {
    this.trackingNumber = this.awbNumber;
  } else if (this.trackingNumber && !this.awbNumber) {
    this.awbNumber = this.trackingNumber;
  }
});

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
