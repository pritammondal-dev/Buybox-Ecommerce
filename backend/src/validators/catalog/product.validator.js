const { z } = require("zod");
const {
  ALLOWED_TAX_CATEGORIES,
  DEFAULT_TAX_CATEGORY,
} = require("../../constants/tax.constants");

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

const imageItemSchema = z
  .object({
    url: z
      .string()
      .trim()
      .min(1, "Image URL is required")
      .refine(
        (val) => {
          const res = validateImageReference(val);
          return res.isValid && !res.isBlank;
        },
        (val) => {
          const res = validateImageReference(val);
          return { message: res.error || "Invalid image URL" };
        }
      ),
    publicId: z.string().nullable().optional().default(null),
    altText: z.string().trim().max(200).optional().default(""),
    sortOrder: z.number().int().optional().default(0),
  })
  .strict();

const seoSchema = z
  .object({
    title: z.string().trim().max(200).optional().default(""),
    description: z.string().trim().max(500).optional().default(""),
    keywords: z.array(z.string().trim()).optional().default([]),
  })
  .strict();

const downloadableFileSchema = z
  .object({
    id: z.string().trim().min(1, "File ID is required"),
    name: z.string().trim().min(1, "File name is required").max(200),
    fileUrl: z.string().trim().min(1, "File URL or storage path is required"),
    storageKey: z.string().trim().nullable().optional().default(null),
    fileSize: z.number().int().nonnegative().optional().default(0),
    mimeType: z.string().trim().optional().default("application/octet-stream"),
    version: z.string().trim().max(50).optional().default("1.0"),
    uploadedAt: z.union([z.string(), z.date()]).optional(),
  })
  .strict();

const createProductSchema = z
  .object({
    name: z.string().trim().min(1, "Product name is required").max(200).optional(),
    title: z.string().trim().min(1).max(200).optional(),

    productType: z.enum(["simple", "variable"]).optional().default("simple"),

    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Product slug is required")
      .max(200)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must contain only lowercase letters, numbers and hyphens"
      ),

    description: z
      .string()
      .trim()
      .max(10000)
      .optional()
      .default(""),

    shortDescription: z
      .string()
      .trim()
      .max(500)
      .optional()
      .default(""),

    sku: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, "SKU is required")
      .max(100),

    categoryId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Invalid category ID"),

    brandId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Invalid brand ID")
      .nullable()
      .optional()
      .default(null),

    vendorId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Invalid vendor ID")
      .optional(),

    price: priceFieldSchema,

    compareAtPrice: nullablePriceFieldSchema,

    currency: z
      .string()
      .trim()
      .toUpperCase()
      .length(3)
      .optional()
      .default("INR"),

    isTaxable: z
      .boolean()
      .optional()
      .default(true),

    taxCategory: z
      .enum(ALLOWED_TAX_CATEGORIES)
      .optional()
      .default(DEFAULT_TAX_CATEGORY),

    stockStatus: z
      .enum(["in_stock", "out_of_stock", "preorder"])
      .optional()
      .default("out_of_stock"),

    stockQuantity: z
      .union([
        z.number().int().nonnegative(),
        z.string().regex(/^\d+$/).transform(Number),
      ])
      .optional()
      .default(0),

    status: z
      .enum([
        "draft",
        "pending_approval",
        "active",
        "rejected",
        "inactive",
        "archived",
      ])
      .optional()
      .default("draft"),

    isFeatured: z
      .boolean()
      .optional()
      .default(false),

    tags: z
      .array(z.string().trim().min(1).max(50))
      .max(50)
      .optional()
      .default([]),

    images: z
      .array(imageItemSchema)
      .optional()
      .default([]),

    specifications: z
      .record(z.string().trim(), z.any())
      .optional()
      .default({}),

    seo: seoSchema.optional(),

    dimensions: dimensionsSchema.optional(),

    weight: weightSchema.optional(),

    shippingClass: z
      .string()
      .trim()
      .max(100)
      .nullable()
      .optional()
      .default(null),

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
  .strict()
  .transform((data) => {
    if (!data.name && data.title) {
      data.name = data.title;
    }
    delete data.title;
    return data;
  })
  .refine((data) => Boolean(data.name && data.name.trim().length > 0), {
    message: "Product name is required",
    path: ["name"],
  })
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
  createProductSchema,
  imageItemSchema,
  seoSchema,
  downloadableFileSchema,
};