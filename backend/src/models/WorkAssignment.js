const mongoose = require("mongoose");

const workAssignmentSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    scopeType: {
      type: String,
      required: true,
      enum: ["vendor", "warehouse", "category", "support_queue"],
      index: true,
    },
    scopeId: {
      type: String,
      required: true,
      trim: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

workAssignmentSchema.index(
  { employeeId: 1, scopeType: 1, scopeId: 1 },
  { unique: true }
);

workAssignmentSchema.index({
  employeeId: 1,
  isActive: 1,
});

module.exports = mongoose.model("WorkAssignment", workAssignmentSchema);
