const mongoose = require("mongoose");

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    category: {
      type: String,
      enum: [
        "order",
        "payment",
        "shipping",
        "product",
        "refund",
        "account",
        "technical",
        "other",
      ],
      default: "other",
      index: true,
    },

    status: {
      type: String,
      enum: [
        "open",
        "pending",
        "in_progress",
        "resolved",
        "closed",
      ],
      default: "open",
      index: true,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },

    closedAt: {
      type: Date,
      default: null,
    },

    resolutionNote: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },

    metadata: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

supportTicketSchema.index({
  customerId: 1,
  createdAt: -1,
});

supportTicketSchema.index({
  status: 1,
  priority: 1,
  createdAt: -1,
});

supportTicketSchema.index({
  assignedTo: 1,
  status: 1,
  createdAt: -1,
});

supportTicketSchema.pre("validate", function () {
  if (this.status === "resolved" && !this.resolvedAt) {
    this.resolvedAt = new Date();
  }

  if (this.status === "closed" && !this.closedAt) {
    this.closedAt = new Date();
  }

  if (this.status !== "resolved" && this.status !== "closed") {
    this.resolvedAt = null;
    this.closedAt = null;
  }
});

const SupportTicket = mongoose.model(
  "SupportTicket",
  supportTicketSchema
);

module.exports = SupportTicket;