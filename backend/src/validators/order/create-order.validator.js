const { z } = require("zod");

const createOrderSchema = z
  .object({
    shippingAddressId: z
      .string()
      .regex(
        /^[0-9a-fA-F]{24}$/,
        "Invalid shipping address ID"
      ),

    couponCode: z
      .string()
      .trim()
      .min(3)
      .max(50)
      .transform((value) => value.toUpperCase())
      .optional()
      .nullable(),
  })
  .strict();

module.exports = {
  createOrderSchema,
};

