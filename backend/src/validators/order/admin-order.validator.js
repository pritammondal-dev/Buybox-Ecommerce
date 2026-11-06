const { z } = require("zod");
const { ORDER_STATUSES } = require("../../constants/order.constants");

const allowedStatuses = Object.values(ORDER_STATUSES);

const updateAdminOrderStatusSchema = z
  .object({
    status: z.enum(allowedStatuses, {
      errorMap: () => ({ message: `Status must be one of: ${allowedStatuses.join(", ")}` }),
    }),
    reason: z.string().trim().max(500, "Reason must not exceed 500 characters").optional(),
    notes: z.string().trim().max(1000, "Notes must not exceed 1000 characters").optional(),
    expectedPreviousStatus: z.string().trim().optional(),
    expectedVersion: z.number().int().positive().optional(),
    isOverride: z.boolean().optional(),
    overrideReason: z.string().trim().max(500, "Override reason must not exceed 500 characters").optional(),
  })
  .strict();

module.exports = {
  updateAdminOrderStatusSchema,
};
