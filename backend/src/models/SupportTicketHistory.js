const mongoose = require("mongoose");

const supportTicketHistorySchema = new mongoose.Schema(
  {
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupportTicket",
      required: true,
      index: true,
    },

    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    action: {
      type: String,
      enum: [
        "created",
        "updated",
        "assigned",
        "reassigned",
        "status_changed",
      ],
      required: true,
      index: true,
    },

    fromValue: {
      type: String,
      default: null,
      trim: true,
    },

    toValue: {
      type: String,
      default: null,
      trim: true,
    },

    note: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
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

supportTicketHistorySchema.index({
  ticketId: 1,
  createdAt: 1,
});

module.exports = mongoose.model(
  "SupportTicketHistory",
  supportTicketHistorySchema
);