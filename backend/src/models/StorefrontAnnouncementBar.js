const mongoose = require("mongoose");

const storefrontAnnouncementBarSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    linkUrl: {
      type: String,
      trim: true,
      default: null,
    },

    linkLabel: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    displayOrder: {
      type: Number,
      min: 0,
      default: 0,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    startsAt: {
      type: Date,
      default: null,
      index: true,
    },

    endsAt: {
      type: Date,
      default: null,
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

storefrontAnnouncementBarSchema.index({
  isActive: 1,
  displayOrder: 1,
});

storefrontAnnouncementBarSchema.index({
  isActive: 1,
  startsAt: 1,
  endsAt: 1,
});

module.exports = mongoose.model(
  "StorefrontAnnouncementBar",
  storefrontAnnouncementBarSchema
);