const { z } = require("zod");

const orderIdSchema = z
  .object({
    id: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid order ID"),
  })
  .strict();

module.exports = {
  orderIdSchema,
};