const { z } = require("zod");

const createPaymentSchema = z
  .object({
    orderId: z
      .string()
      .regex(
        /^[0-9a-fA-F]{24}$/,
        "Invalid order ID"
      ),
  })
  .strict();

module.exports = {
  createPaymentSchema,
};