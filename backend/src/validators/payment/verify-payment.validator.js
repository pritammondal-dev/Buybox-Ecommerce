const { z } = require("zod");

const verifyPaymentSchema = z
  .object({
    orderId: z
      .string()
      .regex(
        /^[0-9a-fA-F]{24}$/,
        "Invalid order ID"
      ),

    razorpayOrderId: z
      .string()
      .min(1)
      .max(100),

    razorpayPaymentId: z
      .string()
      .min(1)
      .max(100),

    razorpaySignature: z
      .string()
      .regex(
        /^[a-f0-9]{64}$/,
        "Invalid Razorpay signature format"
      ),
  })
  .strict();

module.exports = {
  verifyPaymentSchema,
};