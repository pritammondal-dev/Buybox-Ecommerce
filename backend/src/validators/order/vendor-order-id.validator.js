const { z } = require("zod");

const vendorOrderIdSchema = z
  .object({
    orderId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid order ID"),
  })
  .strict();

module.exports = {
  vendorOrderIdSchema,
};
