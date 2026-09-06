const { z } = require("zod");

const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const createSupportTicketMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1)
    .max(5000),
});

const supportTicketMessageIdParamsSchema = z.object({
  ticketId: objectId,
});

module.exports = {
  createSupportTicketMessageSchema,
  supportTicketMessageIdParamsSchema,
};

