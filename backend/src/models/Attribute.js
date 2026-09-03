const mongoose = require("mongoose");

const attributeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "text",
        "number",
        "boolean",
        "select",
        "multiselect",
        "color",
      ],
      default: "select",
    },

    values: [
      {
        label: {
          type: String,
          required: true,
          trim: true,
          maxlength: 100,
        },

        value: {
          type: String,
          required: true,
          trim: true,
          maxlength: 100,
        },

        sortOrder: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
    ],

    isVariantAttribute: {
      type: Boolean,
      default: false,
      index: true,
    },

    isFilterable: {
      type: Boolean,
      default: true,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
      min: 0,
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

attributeSchema.index({
  isActive: 1,
  isFilterable: 1,
  sortOrder: 1,
});

attributeSchema.index({
  isVariantAttribute: 1,
  isActive: 1,
});

module.exports = mongoose.model("Attribute", attributeSchema);
