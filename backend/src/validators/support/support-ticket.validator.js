const { z } = require("zod");

const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const createSupportTicketSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  category: z
    .enum([
      "order",
      "payment",
      "shipping",
      "product",
      "refund",
      "account",
      "technical",
      "other",
    ])
    .optional(),
  priority: z
    .enum(["low", "medium", "high", "urgent"])
    .optional(),
  orderId: objectId.nullable().optional(),
  productId: objectId.nullable().optional(),
});

const updateSupportTicketSchema = z
  .object({
    subject: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(5000).optional(),
    category: z
      .enum([
        "order",
        "payment",
        "shipping",
        "product",
        "refund",
        "account",
        "technical",
        "other",
      ])
      .optional(),
    priority: z
      .enum(["low", "medium", "high", "urgent"])
      .optional(),
  })
  .refine(
    (data) =>
      data.subject !== undefined ||
      data.description !== undefined ||
      data.category !== undefined ||
      data.priority !== undefined,
    {
      message: "At least one field is required",
    }
  );

const assignSupportTicketSchema = z.object({
  assignedTo: objectId,
});

const transitionSupportTicketSchema = z.object({
  status: z.enum([
    "open",
    "pending",
    "in_progress",
    "resolved",
    "closed",
  ]),
  resolutionNote: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional(),
});

const supportTicketIdParamsSchema = z.object({
  ticketId: objectId,
});

module.exports = {
  createSupportTicketSchema,
  updateSupportTicketSchema,
  assignSupportTicketSchema,
  transitionSupportTicketSchema,
  supportTicketIdParamsSchema,
};