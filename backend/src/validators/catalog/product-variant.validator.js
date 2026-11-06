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
  })
  .optional()
  .default(null);

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

const { validateImageReference } = require("../../utils/image-validator.util");

const variantImageSchema = z
  .object({
    url: z
      .string()
      .trim()
      .nullable()
      .optional()
      .default(null)
      .refine(
        (val) => {
          if (!val) return true;
          const res = validateImageReference(val);
          return res.isValid && !res.isBlank;
        },
        (val) => {
          const res = validateImageReference(val);
          return { message: res.error || "Invalid variant image URL" };
        }
      ),
    publicId: z.string().nullable().optional().default(null),
    altText: z.string().trim().max(200).optional().default(""),
  })
  .strict();

const { normalizeVariantAttributes } = require("../../utils/attribute.util");

const attributesFieldSchema = z
  .union([
    z.record(z.string().trim().min(1).max(100), z.string().trim().min(1).max(100)),
    z.array(z.any()),
    z.instanceof(Map),
    z.any(),
  ])
  .transform((val) => normalizeVariantAttributes(val))
  .optional()
  .default({});

const createProductVariantSchema = z
  .object({
    productId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Invalid product ID")
      .optional(),

    sku: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, "Variant SKU is required")
      .max(100),

    name: z
      .string()
      .trim()
      .max(200)
      .optional()
      .default(""),

    attributes: attributesFieldSchema,

    price: priceFieldSchema,

    compareAtPrice: nullablePriceFieldSchema,

    costPrice: nullablePriceFieldSchema,

    currency: z
      .string()
      .trim()
      .toUpperCase()
      .length(3)
      .optional()
      .default("INR"),

    barcode: z
      .string()
      .trim()
      .max(100)
      .nullable()
      .optional()
      .default(null),

    stockQuantity: z
      .union([
        z.number().int().nonnegative(),
        z.string().regex(/^\d+$/).transform(Number),
      ])
      .optional()
      .default(0),

    stockStatus: z
      .enum([
        "in_stock",
        "out_of_stock",
        "preorder",
      ])
      .optional()
      .default("out_of_stock"),

    isDefault: z
      .boolean()
      .optional()
      .default(false),

    image: variantImageSchema.optional(),

    weight: weightSchema.optional(),

    dimensions: dimensionsSchema.optional(),

    shippingClass: z
      .string()
      .trim()
      .max(100)
      .nullable()
      .optional()
      .default(null),

    warehouseId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Invalid warehouse ID")
      .nullable()
      .optional()
      .default(null),

    lowStockThreshold: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .default(5),

    isActive: z
      .boolean()
      .optional()
      .default(true),

    isVirtual: z.boolean().optional().default(false),
    isDownloadable: z.boolean().optional().default(false),
    downloadableFiles: z.array(downloadableFileSchema).optional().default([]),
    downloadLimit: z
      .union([z.number().int().nonnegative(), z.null()])
      .optional()
      .default(null),
    downloadExpiryDays: z
      .union([z.number().int().nonnegative(), z.null()])
      .optional()
      .default(null),
  })
  .strict();

module.exports = {
  createProductVariantSchema,
};