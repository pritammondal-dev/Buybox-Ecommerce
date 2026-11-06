const { z } = require("zod");
const { createProductVariantSchema } = require("./product-variant.validator");
const { priceFieldSchema } = require("./product-variant.validator");

const nullablePriceSchema = z
  .union([
    z
      .number()
      .nonnegative("Price must be a non-negative number")
      .refine(Number.isFinite, "Price must be a finite number"),
    z.string().regex(/^\d+(?:\.\d{1,2})?$/, "Invalid price format"),
    z.null(),
  ])
  .transform((val) => {
    if (val === null || val === undefined) return null;
    const num = Number(val);
    if (!Number.isFinite(num) || num < 0) {
      throw new Error("Invalid price");
    }
    return num.toFixed(2);
  })
  .optional()
  .nullable();

const priceSchema = z
  .union([
    z
      .number()
      .nonnegative("Price must be a non-negative number")
      .refine(Number.isFinite, "Price must be a finite number"),
    z.string().regex(/^\d+(?:\.\d{1,2})?$/, "Invalid price format"),
  ])
  .transform((val) => {
    const num = Number(val);
    if (!Number.isFinite(num) || num < 0) {
      throw new Error("Invalid price");
    }
    return num.toFixed(2);
  });

const createBulkVariantsSchema = z
  .object({
    variants: z
      .array(createProductVariantSchema)
      .min(1, "At least one variant must be provided")
      .max(100, "Cannot create more than 100 variants in a single operation"),
  })
  .strict();

const variantImageSchema = z
  .object({
    url: z.string().trim().min(1).nullable().optional(),
    publicId: z.string().nullable().optional().default(null),
    altText: z.string().trim().max(200).optional().default(""),
  })
  .nullable()
  .optional();

const bulkVariantUpdateItemSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Invalid variant ID")
      .optional(),

    variantId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Invalid variant ID")
      .optional(),

    sku: z
      .string()
      .trim()
      .toUpperCase()
      .min(1)
      .max(100)
      .optional(),

    name: z
      .string()
      .trim()
      .max(200)
      .optional(),

    price: priceSchema.optional(),

    compareAtPrice: nullablePriceSchema,

    barcode: z
      .string()
      .trim()
      .max(100)
      .nullable()
      .optional(),

    image: variantImageSchema,

    isActive: z
      .boolean()
      .optional(),

    isVirtual: z.boolean().optional(),
    isDownloadable: z.boolean().optional(),
  })
  .strict()
  .transform((data) => {
    if (!data.id && data.variantId) {
      data.id = data.variantId;
    }
    return data;
  })
  .refine((data) => Boolean(data.id), {
    message: "Variant ID is required",
    path: ["id"],
  });

const updateBulkVariantsSchema = z
  .object({
    updates: z
      .array(bulkVariantUpdateItemSchema)
      .min(1, "At least one update item must be provided")
      .max(100, "Cannot update more than 100 variants in a single operation"),
  })
  .strict();

module.exports = {
  createBulkVariantsSchema,
  updateBulkVariantsSchema,
};
