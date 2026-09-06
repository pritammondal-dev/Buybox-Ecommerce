const mongoose = require("mongoose");

const supportTicketMessageSchema = new mongoose.Schema(
  {
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupportTicket",
      required: true,
      index: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    messageType: {
      type: String,
      enum: ["customer", "agent", "internal_note", "system"],
      default: "customer",
      index: true,
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

supportTicketMessageSchema.index({
  ticketId: 1,
  createdAt: 1,
});

module.exports = mongoose.model(
  "SupportTicketMessage",
  supportTicketMessageSchema
);