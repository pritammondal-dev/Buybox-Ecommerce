const { z } = require("zod");

const capturePayPalSchema = z
  .object({
    orderId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid order ID"),
    paypalOrderId: z
      .string()
      .min(1, "PayPal order ID is required")
      .max(100),
  })
  .strict();

module.exports = {
  capturePayPalSchema,
};
