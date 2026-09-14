const mongoose = require("mongoose");

const employeePermissionGrantSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    permissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Permission",
      required: true,
      index: true,
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

employeePermissionGrantSchema.index(
  { employeeId: 1, permissionId: 1 },
  { unique: true }
);

employeePermissionGrantSchema.index({ employeeId: 1, isActive: 1 });

module.exports = mongoose.model(
  "EmployeePermissionGrant",
  employeePermissionGrantSchema
);
