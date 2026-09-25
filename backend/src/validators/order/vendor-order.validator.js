const { z } = require("zod");

const vendorOrderTransitionSchema = z
  .object({
    notes: z.string().trim().max(500, "Notes must not exceed 500 characters").optional(),
  })
  .strict();

const vendorOrderQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z
      .enum([
        "all",
        "pending",
        "confirmed",
        "processing",
        "ready_to_ship",
        "shipped",
        "delivered",
        "cancelled",
        "completed",
      ])
      .optional(),
    search: z.string().trim().optional(),
    dateFrom: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    dateTo: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    fulfillmentStatus: z.string().trim().optional(),
    paymentStatus: z.string().trim().optional(),
  });

const createVendorOrderShipmentSchema = z
  .object({
    carrier: z.string().trim().min(2, "Carrier name must be at least 2 characters").max(100),
    serviceLevel: z.string().trim().max(100).optional(),
    warehouseId: z.string().trim().optional(),
    trackingNumber: z.string().trim().max(100).optional(),
    trackingUrl: z.string().trim().url("Tracking URL must be a valid URL").optional().or(z.literal("")),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

module.exports = {
  vendorOrderTransitionSchema,
  vendorOrderQuerySchema,
  createVendorOrderShipmentSchema,
};
