const mongoose = require("mongoose");
const {
  ALLOWED_TAX_CATEGORIES,
  DEFAULT_TAX_CATEGORY,
  ALLOWED_TAX_PRICING_MODES,
  DEFAULT_TAX_PRICING_MODE,
} = require("../constants/tax.constants");

const orderItemSchema = new mongoose.Schema(
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

    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: false,
      default: null,
    },

    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    isVirtual: {
      type: Boolean,
      default: false,
    },

    isDownloadable: {
      type: Boolean,
      default: false,
    },

    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    productName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    variantName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be an integer",
      },
    },

    unitPrice: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
    },

    discountTotal: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
      default: 0,
    },

    taxTotal: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
      default: 0,
    },

    lineTotal: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
    },

    taxDetails: {
      taxRuleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TaxRule",
        default: null,
      },
      ruleName: {
        type: String,
        default: null,
        trim: true,
      },
      jurisdictionCountry: {
        type: String,
        uppercase: true,
        trim: true,
        default: null,
      },
      jurisdictionState: {
        type: String,
        uppercase: true,
        trim: true,
        default: null,
      },
      taxCategory: {
        type: String,
        enum: ALLOWED_TAX_CATEGORIES,
        default: DEFAULT_TAX_CATEGORY,
      },
      isTaxable: {
        type: Boolean,
        default: true,
      },
      pricingMode: {
        type: String,
        enum: ALLOWED_TAX_PRICING_MODES,
        default: DEFAULT_TAX_PRICING_MODE,
      },
      taxRate: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0,
      },
      taxableBase: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0,
      },
      taxAmount: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0,
      },
    },

    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },

    inventoryStatus: {
      type: String,
      enum: ["reserved", "released", "deducted", "not_required"],
      default: "reserved",
      required: true,
      index: true,
    },

    inventoryReleasedAt: {
      type: Date,
      default: null,
    },

    fulfillmentStatus: {
      type: String,
      enum: [
        "unfulfilled",
        "processing",
        "ready_to_ship",
        "shipped",
        "delivered",
        "cancelled",
        "returned",
      ],
      default: "unfulfilled",
      required: true,
      index: true,
    },

    shipmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shipment",
      default: null,
    },

    settlementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VendorSettlement",
      default: null,
    },

    /*
     * Phase D5: Immutable promotional snapshot fields
     */
    regularPrice: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },

    compareAtPrice: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },

    effectivePrice: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },

    isPromotional: {
      type: Boolean,
      default: false,
    },

    promotionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductDiscount",
      default: null,
    },

    promotionName: {
      type: String,
      default: null,
      trim: true,
      maxlength: 200,
    },

    promotionDiscountAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },

    promotionDiscountPercentage: {
      type: Number,
      default: 0,
    },

    fundingSource: {
      type: String,
      enum: ["platform", "vendor"],
      default: null,
    },

    allowCoupons: {
      type: Boolean,
      default: true,
    },

    couponDiscountAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },

    /*
     * Phase VW-02: Centralized & Immutable Commission Snapshot
     */
    commissionRate: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },

    commissionAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },

    commissionSnapshot: {
      policyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CommissionPolicy",
        default: null,
      },
      policyVersion: {
        type: Number,
        default: 1,
      },
      policyName: {
        type: String,
        default: null,
        trim: true,
      },
      source: {
        type: String,
        enum: [
          "product",
          "vendor",
          "vendor_profile",
          "category",
          "global",
          "legacy_fallback",
        ],
        default: null,
      },
      commissionRate: {
        type: mongoose.Schema.Types.Decimal128,
        default: null,
      },
      commissionPercentage: {
        type: Number,
        default: null,
      },
      calculationBase: {
        type: mongoose.Schema.Types.Decimal128,
        default: null,
      },
      commissionAmount: {
        type: mongoose.Schema.Types.Decimal128,
        default: null,
      },
      vendorNetEntitlement: {
        type: mongoose.Schema.Types.Decimal128,
        default: null,
      },
      currency: {
        type: String,
        default: "INR",
        uppercase: true,
        trim: true,
      },
      calculatedAt: {
        type: Date,
        default: null,
      },
      calculationVersion: {
        type: Number,
        default: 1,
      },
      discountDeducted: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0,
      },
      subsidyAdded: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0,
      },
      isLocked: {
        type: Boolean,
        default: false,
        index: true,
      },
    },

    /*
     * Phase VD-05: Authoritative Vendor Fulfillment State & Acceptance Scope
     */
    vendorAcceptance: {
      status: {
        type: String,
        enum: ["pending", "accepted", "rejected"],
        default: "pending",
        index: true,
      },
      acceptedAt: {
        type: Date,
        default: null,
      },
      rejectedAt: {
        type: Date,
        default: null,
      },
      rejectionReason: {
        type: String,
        default: null,
        trim: true,
        maxlength: 1000,
      },
      rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },
      notes: {
        type: String,
        default: null,
        trim: true,
        maxlength: 1000,
      },
    },

    assignedShipmentPartner: {
      partnerId: {
        type: String,
        default: null,
        trim: true,
      },
      partnerName: {
        type: String,
        default: null,
        trim: true,
      },
      serviceCode: {
        type: String,
        default: null,
        trim: true,
      },
      assignedAt: {
        type: Date,
        default: null,
      },
      assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },
    },

    expectedDeliveryDate: {
      type: Date,
      default: null,
      index: true,
    },

    isFulfillmentConfirmed: {
      type: Boolean,
      default: false,
      index: true,
    },

    fulfillmentConfirmedAt: {
      type: Date,
      default: null,
    },
        shipmentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Shipment",
          default: null,
        },
        awbNumber: {
          type: String,
          default: null,
          trim: true,
        },
        carrier: {
          type: String,
          default: null,
          trim: true,
        },
        trackingUrl: {
          type: String,
          default: null,
          trim: true,
        },

    fulfillmentConfirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    returnWindowDaysSnapshot: {
      type: Number,
      default: null,
      min: 1,
      max: 90,
    },

    returnedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    returnStatus: {
      type: String,
      enum: ["none", "requested", "approved", "returned", "exchanged"],
      default: "none",
    },

    returnRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReturnRequest",
      default: null,
    },
  },
  {
    _id: true,
    versionKey: false,
  }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      uppercase: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: false,
      default: null,
      index: true,
    },

    isGuestOrder: {
      type: Boolean,
      default: false,
      index: true,
    },

    guestId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    guestEmail: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
      index: true,
    },

    guestOrderAccessToken: {
      type: String,
      default: null,
      index: true,
    },

    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    /*
     * Coupon snapshot.
     *
     * Keeping the coupon ID and code on the order preserves
     * which promotion was actually applied even if the coupon
     * is later edited or deactivated.
     */
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
      index: true,
    },

    couponCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    returnWindowDaysSnapshot: {
      type: Number,
      default: null,
      min: 1,
      max: 90,
    },

    returnedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    returnStatus: {
      type: String,
      enum: ["none", "requested", "approved", "returned", "exchanged"],
      default: "none",
    },

    returnRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReturnRequest",
      default: null,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "completed",
      ],
      default: "pending",
      required: true,
      index: true,
    },

    /*
     * Cancellation workflow state.
     *
     * This is separate from the final order status so the
     * cancellation process can survive failures between the
     * payment gateway and MongoDB transaction.
     */
    cancellationStatus: {
      type: String,
      enum: [
        "none",
        "pending",
        "completed",
        "failed",
      ],
      default: "none",
      required: true,
      index: true,
    },

    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    cancellationClaim: {
      claimedAt: { type: Date, default: null },
      claimedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
      operationId: { type: String, default: null, trim: true },
      itemIds: [{ type: String }],
    },

    paymentStatus: {
      type: String,
      enum: [
        "pending",
        "authorized",
        "paid",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      default: "pending",
      required: true,
      index: true,
    },

    fulfillmentStatus: {
      type: String,
      enum: [
        "unfulfilled",
        "partially_fulfilled",
        "fulfilled",
        "cancelled",
        "returned",
      ],
      default: "unfulfilled",
      required: true,
      index: true,
    },

    inventoryStatus: {
      type: String,
      enum: [
        "reserved",
        "partially_released",
        "released",
        "deducted",
      ],
      default: "reserved",
      index: true,
    },

    inventoryReleasedAt: {
      type: Date,
      default: null,
    },

    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      default: "INR",
    },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) => items.length > 0,
        message: "Order must contain at least one item",
      },
    },

    subtotal: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
      default: 0,
    },

    discountTotal: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
      default: 0,
    },

    productDiscountTotal: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },

    couponDiscountTotal: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },

    taxTotal: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
      default: 0,
    },

    pricingMode: {
      type: String,
      enum: ALLOWED_TAX_PRICING_MODES,
      default: DEFAULT_TAX_PRICING_MODE,
    },

    taxSnapshot: {
      jurisdictionCountry: {
        type: String,
        uppercase: true,
        trim: true,
        default: null,
      },
      jurisdictionState: {
        type: String,
        uppercase: true,
        trim: true,
        default: null,
      },
      calculatedAt: {
        type: Date,
        default: Date.now,
      },
      itemsTaxTotal: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0,
      },
      shippingTaxTotal: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0,
      },
      totalTax: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0,
      },
      pricingMode: {
        type: String,
        enum: ALLOWED_TAX_PRICING_MODES,
        default: DEFAULT_TAX_PRICING_MODE,
      },
    },

    shippingTotal: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
      default: 0,
    },

    grandTotal: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
      default: 0,
    },

    shippingAddress: {
      fullName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 150,
      },

      phone: {
        type: String,
        required: true,
        trim: true,
        maxlength: 20,
      },

      addressLine1: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
      },

      addressLine2: {
        type: String,
        default: "",
        trim: true,
        maxlength: 200,
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
        uppercase: true,
        trim: true,
        maxlength: 2,
        default: "IN",
      },
    },

    placedAt: {
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

    completedAt: {
      type: Date,
      default: null,
    },

    idempotencyKey: {
      type: String,
      default: null,
      trim: true,
    },

    idempotencyFingerprint: {
      type: String,
      default: null,
    },

    /*
     * Selected delivery option snapshot (standard / express).
     */
    deliveryOption: {
      id: {
        type: String,
        default: "standard",
        trim: true,
      },
      name: {
        type: String,
        default: "Standard Delivery",
        trim: true,
      },
      cost: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0,
      },
      estimatedDays: {
        type: String,
        default: "2–4 business days",
        trim: true,
      },
    },

    couponDiscount: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },

    amountPaid: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },

    amountRefunded: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },

    /*
     * Append-only lifecycle activity timeline for customer & admin audit.
     */
    timeline: [
      {
        event: {
          type: String,
          required: true,
          trim: true,
        },
        title: {
          type: String,
          required: true,
          trim: true,
        },
        description: {
          type: String,
          default: "",
          trim: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        actor: {
          actorType: {
            type: String,
            enum: ["customer", "guest", "system", "admin", "vendor"],
            default: "customer",
          },
          actorId: {
            type: String,
            default: null,
          },
        },
        metadata: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
      },
    ],

    /*
     * Payment attempts history for reconciliation and customer support.
     */
    paymentAttempts: [
      {
        attemptNumber: {
          type: Number,
          required: true,
        },
        gateway: {
          type: String,
          required: true,
          trim: true,
        },
        method: {
          type: String,
          default: null,
          trim: true,
        },
        amount: {
          type: mongoose.Schema.Types.Decimal128,
          required: true,
        },
        currency: {
          type: String,
          default: "INR",
          trim: true,
        },
        status: {
          type: String,
          enum: ["created", "pending", "successful", "failed", "cancelled"],
          default: "created",
        },
        gatewayOrderId: {
          type: String,
          default: null,
          trim: true,
        },
        gatewayPaymentId: {
          type: String,
          default: null,
          trim: true,
        },
        failureReason: {
          type: String,
          default: null,
          trim: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        completedAt: {
          type: Date,
          default: null,
        },
      },
    ],

    /*
     * Phase VD-05: Multi-Vendor Fulfillment Packages & Concurrency Controls
     */
    vendorFulfillments: [
      {
        vendorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Vendor",
          required: true,
          index: true,
        },
        acceptanceStatus: {
          type: String,
          enum: ["pending", "accepted", "rejected", "partially_accepted"],
          default: "pending",
          index: true,
        },
        rejectionReason: {
          type: String,
          default: null,
          trim: true,
          maxlength: 1000,
        },
        rejectedAt: {
          type: Date,
          default: null,
        },
        assignedShipmentPartner: {
          partnerId: {
            type: String,
            default: null,
            trim: true,
          },
          partnerName: {
            type: String,
            default: null,
            trim: true,
          },
          serviceCode: {
            type: String,
            default: null,
            trim: true,
          },
          assignedAt: {
            type: Date,
            default: null,
          },
        },
        expectedDeliveryDate: {
          type: Date,
          default: null,
        },
        isFulfillmentConfirmed: {
          type: Boolean,
          default: false,
        },
        fulfillmentConfirmedAt: {
          type: Date,
          default: null,
        },
        shipmentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Shipment",
          default: null,
        },
        awbNumber: {
          type: String,
          default: null,
          trim: true,
        },
        carrier: {
          type: String,
          default: null,
          trim: true,
        },
        trackingUrl: {
          type: String,
          default: null,
          trim: true,
        },
        fulfillmentStatus: {
          type: String,
          enum: [
            "unfulfilled",
            "processing",
            "ready_to_ship",
            "shipped",
            "delivered",
            "cancelled",
            "returned",
          ],
          default: "unfulfilled",
        },
        notes: {
          type: String,
          default: null,
          trim: true,
        },
        version: {
          type: Number,
          default: 1,
        },
      },
    ],

    fulfillmentVersion: {
      type: Number,
      default: 1,
      index: true,
    },

    version: {
      type: Number,
      default: 1,
      index: true,
    },

  },
  {
    timestamps: true,
    versionKey: false,
  }
);

orderSchema.index({
  customerId: 1,
  createdAt: -1,
});

orderSchema.index({
  customerId: 1,
  status: 1,
});

orderSchema.index({
  "items.vendorId": 1,
  status: 1,
  createdAt: -1,
});

orderSchema.index({
  status: 1,
  paymentStatus: 1,
  createdAt: -1,
});

orderSchema.index({
  cancellationStatus: 1,
  status: 1,
});

orderSchema.index({
  status: 1,
  createdAt: 1,
});

orderSchema.pre("validate", function () {
  if (!this.customerId && !this.guestId && !this.isGuestOrder) {
    throw new Error("Order must be bound to either a customerId or a guest identity");
  }
});

orderSchema.index(
  {
    customerId: 1,
    idempotencyKey: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: {
        $type: "string",
      },
    },
  }
);

orderSchema.index(
  {
    guestId: 1,
    idempotencyKey: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: {
        $type: "string",
      },
      guestId: {
        $type: "string",
      },
    },
  }
);

module.exports = mongoose.model("Order", orderSchema);