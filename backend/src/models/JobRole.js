const mongoose = require("mongoose");

const jobRoleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    tier: {
      type: Number,
      required: true,
      min: 1,
    },
    permissions: {
      type: [String],
      default: [],
    },
    managementScope: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "JobRole",
      },
    ],
    isSystemRole: {
      type: Boolean,
      default: false,
      index: true,
    },
    isSuperadminRole: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

jobRoleSchema.index({ tier: 1 });
jobRoleSchema.index({ isActive: 1 });
jobRoleSchema.index(
  { isSuperadminRole: 1 },
  {
    unique: true,
    partialFilterExpression: { isSuperadminRole: true, isActive: true },
    name: "unique_active_superadmin_job_role_idx",
  }
);

module.exports = mongoose.model("JobRole", jobRoleSchema);
