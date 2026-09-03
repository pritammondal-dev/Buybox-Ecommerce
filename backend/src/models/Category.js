const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
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
      maxlength: 1000,
    },

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },

    image: {
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

categorySchema.index({
  parentId: 1,
  isActive: 1,
  deletedAt: 1,
});

categorySchema.index({
  sortOrder: 1,
  name: 1,
});

module.exports = mongoose.model("Category", categorySchema);