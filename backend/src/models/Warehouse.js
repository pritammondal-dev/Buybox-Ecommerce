const mongoose = require("mongoose");

const warehouseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 30,
    },

    description: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },

    address: {
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

    contactPhone: {
      type: String,
      default: null,
      trim: true,
      maxlength: 20,
    },

    contactEmail: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },

    isActive: {
      type: Boolean,
      default: true,
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
  }
);

warehouseSchema.index({
  isActive: 1,
  deletedAt: 1,
});

module.exports = mongoose.model(
  "Warehouse",
  warehouseSchema
);