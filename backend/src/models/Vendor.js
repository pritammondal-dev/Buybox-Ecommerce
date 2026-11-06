const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    businessName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    businessSlug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    phone: {
      type: String,
      default: null,
      trim: true,
      maxlength: 20,
    },

    supportEmail: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },

    businessAddress: {
      addressLine1: {
        type: String,
        default: null,
        trim: true,
        maxlength: 200,
      },

      addressLine2: {
        type: String,
        default: null,
        trim: true,
        maxlength: 200,
      },

      city: {
        type: String,
        default: null,
        trim: true,
        maxlength: 100,
      },

      state: {
        type: String,
        default: null,
        trim: true,
        maxlength: 100,
      },

      postalCode: {
        type: String,
        default: null,
        trim: true,
        maxlength: 20,
      },

      country: {
        type: String,
        default: "IN",
        uppercase: true,
        trim: true,
        maxlength: 2,
      },
    },

    taxInformation: {
      taxId: {
        type: String,
        default: null,
        trim: true,
        maxlength: 100,
      },

      taxType: {
        type: String,
        default: null,
        trim: true,
        maxlength: 50,
      },
    },

    branding: {
      displayName: {
        type: String,
        default: null,
        trim: true,
        maxlength: 150,
      },
      logo: {
        type: String,
        default: null,
        trim: true,
        maxlength: 500,
      },
      banner: {
        type: String,
        default: null,
        trim: true,
        maxlength: 500,
      },
      description: {
        type: String,
        default: null,
        trim: true,
        maxlength: 2000,
      },
      publicContactEmail: {
        type: String,
        default: null,
        lowercase: true,
        trim: true,
        maxlength: 254,
      },
      publicContactPhone: {
        type: String,
        default: null,
        trim: true,
        maxlength: 20,
      },
      policies: {
        shippingPolicy: {
          type: String,
          default: null,
          trim: true,
          maxlength: 5000,
        },
        returnPolicy: {
          type: String,
          default: null,
          trim: true,
          maxlength: 5000,
        },
        refundPolicy: {
          type: String,
          default: null,
          trim: true,
          maxlength: 5000,
        },
      },
      operatingHours: {
        type: String,
        default: null,
        trim: true,
        maxlength: 500,
      },
      socialLinks: {
        website: { type: String, default: null, trim: true, maxlength: 500 },
        instagram: { type: String, default: null, trim: true, maxlength: 500 },
        facebook: { type: String, default: null, trim: true, maxlength: 500 },
        twitter: { type: String, default: null, trim: true, maxlength: 500 },
      },
    },

    kycStatus: {
      type: String,
      enum: [
        "not_submitted",
        "pending",
        "under_review",
        "approved",
        "rejected",
      ],
      default: "not_submitted",
      index: true,
    },

    kycDocuments: [
      {
        documentCategory: {
          type: String,
          required: true,
          enum: [
            "identity_proof",
            "business_registration",
            "tax_id",
            "address_proof",
          ],
        },
        documentType: {
          type: String,
          required: true,
          trim: true,
          maxlength: 100,
        },
        documentNumber: {
          type: String,
          default: null,
          trim: true,
          maxlength: 100,
        },
        storageKey: {
          type: String,
          required: true,
          trim: true,
        },
        fileOriginalName: {
          type: String,
          required: true,
          trim: true,
          maxlength: 255,
        },
        fileSize: {
          type: Number,
          required: true,
        },
        mimeType: {
          type: String,
          required: true,
          enum: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
        },
        status: {
          type: String,
          enum: ["pending", "under_review", "approved", "rejected"],
          default: "pending",
        },
        submittedAt: {
          type: Date,
          default: Date.now,
        },
        reviewedAt: {
          type: Date,
          default: null,
        },
        reviewedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        rejectionReason: {
          type: String,
          default: null,
          maxlength: 500,
        },
        resubmissionHistory: [
          {
            storageKey: String,
            fileOriginalName: String,
            fileSize: Number,
            mimeType: String,
            documentNumber: String,
            submittedAt: Date,
            reviewedAt: Date,
            reviewedBy: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
            },
            rejectionReason: String,
          },
        ],
      },
    ],

    onboardingStatus: {
      type: String,
      enum: [
        "pending",
        "under_review",
        "approved",
        "rejected",
        "changes_requested",
        "suspended",
        "inactive",
      ],
      default: "pending",
      index: true,
    },

    rejectionReason: {
      type: String,
      default: null,
      maxlength: 500,
    },

    changesRequestedReason: {
      type: String,
      default: null,
      maxlength: 500,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    changesRequestedAt: {
      type: Date,
      default: null,
    },

    changesRequestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    commissionRate: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: false,
      index: true,
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

vendorSchema.virtual("slug").get(function () {
  return this.businessSlug;
});

vendorSchema.virtual("gstin").get(function () {
  return this.taxInformation?.taxId || null;
});

vendorSchema.virtual("taxId").get(function () {
  return this.taxInformation?.taxId || null;
});

vendorSchema.index({
  onboardingStatus: 1,
  isActive: 1,
});

vendorSchema.index({
  deletedAt: 1,
  createdAt: -1,
});

vendorSchema.virtual("bankAccounts", {
  ref: "VendorBankAccount",
  localField: "_id",
  foreignField: "vendorId",
});

module.exports = mongoose.model("Vendor", vendorSchema);