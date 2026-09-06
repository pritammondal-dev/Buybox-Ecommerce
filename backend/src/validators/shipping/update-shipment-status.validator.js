const { z } = require("zod");

const updateShipmentStatusSchema = z
  .object({
    status: z.enum([
      "ready_to_ship",
      "picked_up",
      "in_transit",
      "out_for_delivery",
      "delivered",
      "failed",
      "cancelled",
      "returned",
    ]),

    trackingNumber: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional(),

    trackingUrl: z
      .string()
      .trim()
      .url()
      .max(1000)
      .optional(),

    failureReason: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .optional(),
  })
  .strict();

module.exports = {
  updateShipmentStatusSchema,
};