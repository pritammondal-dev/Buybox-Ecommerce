const { z } = require("zod");

const createShipmentSchema = z
  .object({
    orderId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid order ID"),

    carrier: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional(),

    serviceLevel: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional(),
  })
  .strict();

module.exports = { createShipmentSchema };