const mongoose = require("mongoose");

const storefrontRedirectSchema = new mongoose.Schema(
  {
    sourcePath: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    destinationPath: {
      type: String,
      required: true,
      trim: true,
    },

    statusCode: {
      type: Number,
      enum: [301, 302],
      default: 301,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

storefrontRedirectSchema.index({
  sourcePath: 1,
  isActive: 1,
});

module.exports = mongoose.model(
  "StorefrontRedirect",
  storefrontRedirectSchema
);

