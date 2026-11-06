const { z } = require("zod");

const returnItemInputSchema = z.object({
  productId: z.string().trim().min(1, "Product ID is required"),
  productVariantId: z.string().trim().optional().nullable(),
  orderItemId: z.string().trim().optional().nullable(),
  quantity: z.coerce.number().int().positive("Quantity must be at least 1"),
  reason: z.string().trim().optional().nullable(),
  condition: z.string().trim().optional().nullable(),
  images: z
    .array(
      z.union([
        z.string().trim().url(),
        z.object({
          url: z.string().trim().min(1),
          publicId: z.string().trim().optional().nullable(),
          caption: z.string().trim().optional().nullable(),
        }),
      ])
    )
    .optional()
    .nullable(),
});

const pickupAddressInputSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200).optional().nullable(),
    phone: z.string().trim().min(5).max(30).optional().nullable(),
    addressLine1: z.string().trim().min(1).max(300).optional().nullable(),
    addressLine2: z.string().trim().max(300).optional().nullable(),
    city: z.string().trim().min(1).max(100).optional().nullable(),
    state: z.string().trim().min(1).max(100).optional().nullable(),
    postalCode: z.string().trim().min(3).max(20).optional().nullable(),
    country: z.string().trim().max(100).default("IN").optional().nullable(),
  })
  .optional()
  .nullable();

const bankDetailsInputSchema = z
  .object({
    accountNumber: z.string().trim().min(9).max(30).optional().nullable(),
    confirmAccountNumber: z.string().trim().min(9).max(30).optional().nullable(),
    ifscCode: z.string().trim().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code format").optional().nullable(),
    accountHolderName: z.string().trim().min(2).max(150).optional().nullable(),
    upiId: z.string().trim().regex(/^[\w.-]+@[\w.-]+$/, "Invalid UPI ID format").optional().nullable(),
  })
  .optional()
  .nullable();

const createReturnRequestSchema = z.object({
  orderId: z.string().trim().min(1, "Order ID is required"),
  type: z.enum(["return", "exchange"]).default("return").optional(),
  resolution: z.string().trim().optional().nullable(),
  reason: z.string().trim().optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  items: z.array(returnItemInputSchema).min(1, "At least one item is required"),
  customerNotes: z.string().trim().max(1000).optional().nullable(),
  replacementVariantId: z.string().trim().optional().nullable(),
  idempotencyKey: z.string().trim().max(128).optional().nullable(),
  images: z
    .array(
      z.union([
        z.string().trim().min(1),
        z.object({
          url: z.string().trim().min(1),
          publicId: z.string().trim().optional().nullable(),
          caption: z.string().trim().optional().nullable(),
        }),
      ])
    )
    .max(10, "Maximum of 10 evidence images allowed")
    .optional()
    .nullable(),
  pickupAddress: pickupAddressInputSchema,
  refundMethod: z.enum(["original_source", "bank_transfer", "upi"]).default("original_source").optional(),
  bankDetails: bankDetailsInputSchema,
});

const rejectReturnSchema = z
  .object({
    reason: z.string().trim().min(3, "Rejection reason must be at least 3 characters").max(500),
    notes: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

const schedulePickupSchema = z.object({
  scheduledDate: z.string().trim().min(1, "Scheduled pickup date is required"),
  timeSlot: z.string().trim().default("10:00-13:00").optional(),
  carrier: z.string().trim().default("Delhivery").optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

const fulfillExchangeSchema = z.object({
  replacementVariantId: z.string().trim().optional().nullable(),
  warehouseId: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

const inspectReturnSchema = z.object({
  notes: z.string().trim().max(500).optional().nullable(),
  condition: z.enum(["unopened", "opened_unused", "defective_in_box", "damaged", "missing_parts"]).optional().nullable(),
  passed: z.boolean().optional(),
  outcome: z.enum(["resellable", "damaged", "defective", "missing_parts", "not_restockable"]).optional().nullable(),
  restock: z.boolean().optional(),
  warehouseId: z.string().trim().optional().nullable(),
  items: z
    .array(
      z.object({
        productId: z.string().trim().optional(),
        productVariantId: z.string().trim().optional().nullable(),
        condition: z.enum(["unopened", "opened_unused", "defective_in_box", "damaged", "missing_parts"]).optional(),
        passed: z.boolean().optional(),
        notes: z.string().trim().max(500).optional().nullable(),
        restock: z.boolean().optional(),
      })
    )
    .optional(),
});

const restockReturnSchema = z.object({
  warehouseId: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  restock: z.boolean().optional(),
  idempotencyKey: z.string().trim().max(128).optional().nullable(),
  items: z
    .array(
      z.object({
        productId: z.string().trim().optional(),
        productVariantId: z.string().trim().optional().nullable(),
        condition: z.enum(["unopened", "opened_unused", "defective_in_box", "damaged", "missing_parts"]).optional(),
        restock: z.boolean().optional(),
      })
    )
    .optional(),
});

const returnActionNotesSchema = z.object({
  notes: z.string().trim().max(500).optional().nullable(),
  reason: z.string().trim().max(500).optional().nullable(),
  idempotencyKey: z.string().trim().max(128).optional().nullable(),
  bankReference: z.string().trim().max(100).optional().nullable(),
});

const cancelReturnSchema = z.object({
  reason: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

const previewReturnRefundSchema = z.object({
  orderId: z.string().trim().min(1, "Order ID is required"),
  items: z
    .array(
      z.object({
        orderItemId: z.string().trim().optional().nullable(),
        productId: z.string().trim().optional().nullable(),
        productVariantId: z.string().trim().optional().nullable(),
        quantity: z.coerce.number().int().positive("Quantity must be at least 1"),
      })
    )
    .min(1, "At least one item is required for preview"),
});

module.exports = {
  createReturnRequestSchema,
  previewReturnRefundSchema,
  rejectReturnSchema,
  schedulePickupSchema,
  fulfillExchangeSchema,
  inspectReturnSchema,
  restockReturnSchema,
  returnActionNotesSchema,
  cancelReturnSchema,
};
