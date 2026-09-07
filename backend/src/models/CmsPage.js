const mongoose = require("mongoose");

const cmsPageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },

    seo: {
      title: {
        type: String,
        trim: true,
        maxlength: 200,
        default: null,
      },

      description: {
        type: String,
        trim: true,
        maxlength: 500,
        default: null,
      },

      keywords: {
        type: [String],
        default: [],
      },
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    publishedAt: {
      type: Date,
      default: null,
      index: true,
    },

    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

cmsPageSchema.index({
  status: 1,
  createdAt: -1,
});

cmsPageSchema.pre("validate", function () {
  if (this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  if (this.status !== "published") {
    this.publishedAt = null;
    this.publishedBy = null;
  }

  if (this.status === "archived" && !this.archivedAt) {
    this.archivedAt = new Date();
  }

  if (this.status !== "archived") {
    this.archivedAt = null;
  }
});

module.exports = mongoose.model("CmsPage", cmsPageSchema);