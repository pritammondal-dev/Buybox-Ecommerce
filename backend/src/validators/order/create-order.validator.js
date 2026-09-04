const { z } = require("zod");

const createOrderSchema = z
  .object({
    shippingAddressId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid shipping address ID"),
  })
  .strict();

module.exports = {
  createOrderSchema,
};