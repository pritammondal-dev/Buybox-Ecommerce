const mongoose = require("mongoose");

const brandSchema = new mongoose.Schema(
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

    description: {
      type: String,
      default: "",
      maxlength: 2000,
    },

    logo: {
      url: {
        type: String,
        default: null,
      },

      publicId: {
        type: String,
        default: null,
      },

      altText: {
        type: String,
        default: "",
        maxlength: 200,
      },
    },

    website: {
      type: String,
      default: null,
      trim: true,
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

    seo: {
      title: {
        type: String,
        default: "",
        maxlength: 200,
      },

      description: {
        type: String,
        default: "",
        maxlength: 500,
      },

      keywords: [
        {
          type: String,
          trim: true,
        },
      ],
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

brandSchema.index({
  isActive: 1,
  deletedAt: 1,
  sortOrder: 1,
});

module.exports = mongoose.model("Brand", brandSchema);