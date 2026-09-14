const mongoose = require("mongoose");

const employeeRoleSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
      index: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
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

employeeRoleSchema.index(
  { employeeId: 1, roleId: 1 },
  { unique: true }
);

employeeRoleSchema.index({ employeeId: 1, isActive: 1 });

module.exports = mongoose.model("EmployeeRole", employeeRoleSchema);
