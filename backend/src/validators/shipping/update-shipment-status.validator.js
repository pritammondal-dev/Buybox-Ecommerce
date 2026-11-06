const { z } = require("zod");

const adminUpdateShipmentStatusSchema = z
  .object({
    status: z.enum([
      "created",
      "ready_to_ship",
      "picked_up",
      "in_transit",
      "out_for_delivery",
      "delivered",
      "failed",
      "cancelled",
      "returned",
    ]),

    carrier: z
      .string()
      .trim()
      .max(100)
      .optional()
      .nullable(),

    serviceLevel: z
      .string()
      .trim()
      .max(100)
      .optional()
      .nullable(),

    trackingNumber: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .nullable(),

    trackingUrl: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .nullable()
      .refine((val) => !val || /^https?:\/\/.+/.test(val), {
        message: "Invalid tracking URL",
      }),

    failureReason: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .optional()
      .nullable(),

    notes: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .nullable(),

    reason: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .nullable(),

    expectedPreviousStatus: z
      .string()
      .trim()
      .optional(),

    expectedVersion: z
      .number()
      .int()
      .positive()
      .optional(),

    isOverride: z
      .boolean()
      .optional(),

    overrideReason: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .nullable(),
  })
  .strict();

const vendorUpdateShipmentStatusSchema = z
  .object({
    status: z.enum([
      "created",
      "ready_to_ship",
      "picked_up",
      "in_transit",
      "out_for_delivery",
      "delivered",
      "cancelled",
    ]),

    carrier: z
      .string()
      .trim()
      .max(100)
      .optional()
      .nullable(),

    serviceLevel: z
      .string()
      .trim()
      .max(100)
      .optional()
      .nullable(),

    trackingNumber: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .nullable(),

    trackingUrl: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .nullable()
      .refine((val) => !val || /^https?:\/\/.+/.test(val), {
        message: "Invalid tracking URL",
      }),

    notes: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .nullable(),

    reason: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .nullable(),

    expectedPreviousStatus: z
      .string()
      .trim()
      .optional(),

    expectedVersion: z
      .number()
      .int()
      .positive()
      .optional(),
  })
  .strict();

module.exports = {
  adminUpdateShipmentStatusSchema,
  vendorUpdateShipmentStatusSchema,
  updateShipmentStatusSchema: adminUpdateShipmentStatusSchema,
};
