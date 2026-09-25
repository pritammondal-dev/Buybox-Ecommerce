const { z } = require("zod");

const returnItemInputSchema = z.object({
  productId: z.string().trim().min(1, "Product ID is required"),
  productVariantId: z.string().trim().optional().nullable(),
  quantity: z.coerce.number().int().positive("Quantity must be at least 1"),
  reason: z.string().trim().optional(),
  condition: z.string().trim().optional(),
});

const createReturnRequestSchema = z
  .object({
    orderId: z.string().trim().min(1, "Order ID is required"),
    type: z.enum(["return", "exchange"]).default("return"),
    items: z.array(returnItemInputSchema).min(1, "At least one item is required"),
    customerNotes: z.string().trim().max(1000).optional().nullable(),
    replacementVariantId: z.string().trim().optional().nullable(),
  })
  .strict();

const rejectReturnSchema = z
  .object({
    reason: z.string().trim().min(3, "Rejection reason must be at least 3 characters").max(500),
  })
  .strict();

const restockReturnSchema = z
  .object({
    warehouseId: z.string().trim().optional().nullable(),
    notes: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

const returnActionNotesSchema = z
  .object({
    notes: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

module.exports = {
  createReturnRequestSchema,
  rejectReturnSchema,
  restockReturnSchema,
  returnActionNotesSchema,
};
