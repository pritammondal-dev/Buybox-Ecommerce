const mongoose = require("mongoose");
const { Schema } = mongoose;

const ROUTING_SYSTEMS = Object.freeze([
  "IFSC",
  "SWIFT",
  "ROUTING_NUMBER",
  "IBAN",
  "OTHER",
]);

const partnerBankSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Canonical bank name is required"],
      trim: true,
      maxlength: [150, "Bank name cannot exceed 150 characters"],
    },

    normalizedName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    code: {
      type: String,
      required: [true, "Bank identifier code is required"],
      trim: true,
      uppercase: true,
      maxlength: [20, "Bank code cannot exceed 20 characters"],
      unique: true,
    },

    aliases: {
      type: [String],
      default: [],
    },

    countries: {
      type: [String],
      default: ["IN"], // ISO 3166-1 alpha-2
    },

    supportedStates: {
      type: [String],
      default: [], // Empty means all states in supported countries
    },

    routingSystem: {
      type: String,
      enum: ROUTING_SYSTEMS,
      default: "IFSC",
      required: true,
    },

    ifscPrefix: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [10, "IFSC prefix cannot exceed 10 characters"],
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isEligibleForNewApplications: {
      type: Boolean,
      default: true,
      index: true,
    },

    logoUrl: {
      type: String,
      trim: true,
      default: null,
    },

    displayOrder: {
      type: Number,
      default: 100,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        return ret;
      },
    },
    toObject: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        return ret;
      },
    },
  }
);

// Prevent duplicate canonical bank names within country scope
partnerBankSchema.index({ normalizedName: 1, countries: 1 }, { unique: true });

// Search index for name, aliases, code
partnerBankSchema.index({ name: 1, code: 1, isActive: 1, isEligibleForNewApplications: 1 });

partnerBankSchema.pre("validate", function () {
  if (this.name) {
    this.normalizedName = this.name.toLowerCase().trim();
  }
  if (this.code) {
    this.code = this.code.toUpperCase().trim();
  }
});

const PartnerBank = mongoose.model("PartnerBank", partnerBankSchema);

module.exports = PartnerBank;
module.exports.PartnerBank = PartnerBank;
module.exports.ROUTING_SYSTEMS = ROUTING_SYSTEMS;
