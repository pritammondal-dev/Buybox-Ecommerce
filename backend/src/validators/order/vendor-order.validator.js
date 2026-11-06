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
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
  })
  .strict();

const vendorOrderAcceptSchema = z
  .object({
    notes: z.string().trim().max(1000).optional(),
    expectedVersion: z.coerce.number().int().optional(),
  })
  .optional()
  .default({});

const vendorOrderRejectSchema = z
  .object({
    rejectionReason: z.string().trim().min(5, "Rejection reason must be at least 5 characters").max(1000).optional(),
    reason: z.string().trim().min(5, "Reason must be at least 5 characters").max(1000).optional(),
    notes: z.string().trim().max(1000).optional(),
    expectedVersion: z.coerce.number().int().optional(),
  })
  .refine((data) => Boolean(data?.rejectionReason || data?.reason), {
    message: "A specific rejection reason (minimum 5 characters) is required",
    path: ["rejectionReason"],
  });

const vendorOrderFulfillmentDetailsSchema = z
  .object({
    partnerId: z.string().trim().min(2, "Partner ID is required"),
    partnerName: z.string().trim().max(100).optional(),
    serviceCode: z.string().trim().max(100).optional(),
    expectedDeliveryDate: z.string().trim().min(4, "Expected delivery date is required"),
    expectedVersion: z.coerce.number().int().optional(),
    notes: z.string().trim().max(1000).optional(),
  });

const vendorOrderConfirmFulfillmentSchema = z
  .object({
    notes: z.string().trim().max(1000).optional(),
    expectedVersion: z.coerce.number().int().optional(),
  })
  .optional()
  .default({});

const adminOverrideFulfillmentSchema = z
  .object({
    action: z.enum([
      "resolve_rejection",
      "update_delivery_date",
      "force_confirm",
      "assign_courier",
    ]),
    vendorId: z.string().trim().optional(),
    partnerId: z.string().trim().optional(),
    partnerName: z.string().trim().optional(),
    serviceCode: z.string().trim().optional(),
    expectedDeliveryDate: z.string().trim().optional(),
    expectedVersion: z.number().int().positive().optional(),
    overrideReason: z.string().trim().min(5, "Override reason must be at least 5 characters").optional(),
    reason: z.string().trim().min(5, "Reason must be at least 5 characters").optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((data) => Boolean(data.overrideReason || data.reason), {
    message: "A detailed override reason (min 5 characters) is required",
    path: ["overrideReason"],
  })
  .refine(
    (data) => {
      if (data.action === "assign_courier") {
        return Boolean(data.partnerId && data.partnerId.trim().length >= 2);
      }
      return true;
    },
    {
      message: "A valid partnerId is required when action is 'assign_courier'",
      path: ["partnerId"],
    }
  );

module.exports = {
  vendorOrderTransitionSchema,
  vendorOrderQuerySchema,
  createVendorOrderShipmentSchema,
  vendorOrderAcceptSchema,
  vendorOrderRejectSchema,
  vendorOrderFulfillmentDetailsSchema,
  vendorOrderConfirmFulfillmentSchema,
  adminOverrideFulfillmentSchema,
};
