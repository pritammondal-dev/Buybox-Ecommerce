const { z } = require("zod");
const {
  ALLOWED_TAX_CATEGORIES,
} = require("../../constants/tax.constants");
const { downloadableFileSchema, imageItemSchema } = require("./product.validator");

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



const seoSchema = z
  .object({
    title: z.string().trim().max(200).optional().default(""),
    description: z.string().trim().max(500).optional().default(""),
    keywords: z.array(z.string().trim()).optional().default([]),
  })
  .strict();

const updateProductSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional(),

    title: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional(),

    productType: z
      .enum(["simple", "variable"])
      .optional(),

    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(1)
      .max(200)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must contain only lowercase letters, numbers and hyphens"
      )
      .optional(),

    description: z
      .string()
      .trim()
      .max(10000)
      .optional(),

    shortDescription: z
      .string()
      .trim()
      .max(500)
      .optional(),

    sku: z
      .string()
      .trim()
      .toUpperCase()
      .min(1)
      .max(100)
      .optional(),

    categoryId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Invalid category ID")
      .optional(),

    brandId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Invalid brand ID")
      .nullable()
      .optional(),

    price: priceFieldSchema.optional(),

    compareAtPrice: nullablePriceFieldSchema.nullable().optional(),

    currency: z
      .string()
      .trim()
      .toUpperCase()
      .length(3)
      .optional(),

    isTaxable: z
      .boolean()
      .optional(),

    taxCategory: z
      .enum(ALLOWED_TAX_CATEGORIES)
      .optional(),

    stockStatus: z
      .enum(["in_stock", "out_of_stock", "preorder"])
      .optional(),

    stockQuantity: z
      .union([
        z.number().int().nonnegative(),
        z.string().regex(/^\d+$/).transform(Number),
      ])
      .optional(),

    status: z
      .enum([
        "draft",
        "pending_approval",
        "active",
        "rejected",
        "inactive",
        "archived",
      ])
      .optional(),

    isFeatured: z
      .boolean()
      .optional(),

    tags: z
      .array(z.string().trim().min(1).max(50))
      .max(50)
      .optional(),

    images: z
      .array(imageItemSchema)
      .optional(),

    specifications: z
      .record(z.string().trim(), z.any())
      .optional(),

    seo: seoSchema.optional(),

    dimensions: dimensionsSchema.optional(),

    weight: weightSchema.optional(),

    shippingClass: z
      .string()
      .trim()
      .max(100)
      .nullable()
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
  .transform((data) => {
    if (!data.name && data.title) {
      data.name = data.title;
    }
    delete data.title;
    return data;
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field is required",
    }
  )
  .refine(
    (data) => {
      if (data.compareAtPrice != null && data.price != null) {
        return Number(data.compareAtPrice) >= Number(data.price);
      }
      return true;
    },
    {
      message: "Compare-at price must be greater than or equal to selling price",
      path: ["compareAtPrice"],
    }
  );

module.exports = {
  updateProductSchema,
  seoSchema,
};