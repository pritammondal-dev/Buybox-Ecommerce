const { z } = require("zod");
const { downloadableFileSchema } = require("./product.validator");

const priceFieldSchema = z
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

const nullablePriceFieldSchema = z
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
  });

const dimensionsSchema = z
  .object({
    length: z
      .number()
      .nonnegative("Length must be non-negative")
      .nullable()
      .optional()
      .default(null),
    width: z
      .number()
      .nonnegative("Width must be non-negative")
      .nullable()
      .optional()
      .default(null),
    height: z
      .number()
      .nonnegative("Height must be non-negative")
      .nullable()
      .optional()
      .default(null),
    unit: z.enum(["cm", "in", "m", "mm"]).optional().default("cm"),
  })
  .strict();

const weightSchema = z
  .object({
    value: z
      .number()
      .nonnegative("Weight must be non-negative")
      .nullable()
      .optional()
      .default(null),
    unit: z.enum(["g", "kg", "lb", "oz"]).optional().default("kg"),
  })
  .strict();

const variantImageSchema = z
  .object({
    url: z.string().trim().nullable().optional().default(null),
    publicId: z.string().nullable().optional().default(null),
    altText: z.string().trim().max(200).optional().default(""),
  })
  .strict();

const { normalizeVariantAttributes } = require("../../utils/attribute.util");

const attributesUpdateFieldSchema = z
  .union([
    z.record(z.string().trim().min(1).max(100), z.string().trim().min(1).max(100)),
    z.array(z.any()),
    z.instanceof(Map),
    z.any(),
  ])
  .transform((val) => normalizeVariantAttributes(val))
  .optional();

const updateProductVariantSchema = z
  .object({
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

    attributes: attributesUpdateFieldSchema,

    price: priceFieldSchema.optional(),

    compareAtPrice: nullablePriceFieldSchema.nullable().optional(),

    costPrice: nullablePriceFieldSchema.nullable().optional(),

    currency: z
      .string()
      .trim()
      .toUpperCase()
      .length(3)
      .optional(),

    stockQuantity: z
      .union([
        z.number().int().nonnegative(),
        z.string().regex(/^\d+$/).transform(Number),
      ])
      .optional(),

    stockStatus: z
      .enum([
        "in_stock",
        "out_of_stock",
        "preorder",
      ])
      .optional(),

    isDefault: z
      .boolean()
      .optional(),

    image: variantImageSchema.optional(),

    weight: weightSchema.optional(),

    dimensions: dimensionsSchema.optional(),

    shippingClass: z
      .string()
      .trim()
      .max(100)
      .nullable()
      .optional(),

    isActive: z
      .boolean()
      .optional(),

    isVirtual: z.boolean().optional(),
    isDownloadable: z.boolean().optional(),
    downloadableFiles: z.array(downloadableFileSchema).optional(),
    downloadLimit: z
      .union([z.number().int().nonnegative(), z.null()])
      .optional(),
    downloadExpiryDays: z
      .union([z.number().int().nonnegative(), z.null()])
      .optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field is required",
    }
  );

module.exports = {
  updateProductVariantSchema,
};