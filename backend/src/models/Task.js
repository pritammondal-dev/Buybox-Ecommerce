const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    status: {
      type: String,
      enum: [
        "TODO",
        "IN_PROGRESS",
        "BLOCKED",
        "REVIEW",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "TODO",
      index: true,
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
      index: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    internalNotes: [
      {
        note: {
          type: String,
          required: true,
          trim: true,
          maxlength: 1000,
        },
        author: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    history: [
      {
        action: {
          type: String,
          required: true,
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        previousStatus: String,
        newStatus: String,
        notes: String,
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ priority: 1, status: 1 });

module.exports = mongoose.model("Task", taskSchema);
