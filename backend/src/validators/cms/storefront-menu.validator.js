const { z } = require("zod");

const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const menuItemSchema = z.object({
  label: z.string().trim().min(1).max(100),

  linkType: z
    .enum(["internal", "external"])
    .optional(),

  url: z.string().trim().min(1).max(500),

  displayOrder: z
    .number()
    .int()
    .min(0)
    .optional(),

  isActive: z
    .boolean()
    .optional(),

  parentId: objectId.nullable().optional(),
});

const createStorefrontMenuSchema = z.object({
  name: z.string().trim().min(1).max(100),

  key: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(
      /^[a-zA-Z0-9]+(?:[-_][a-zA-Z0-9]+)*$/,
      "Invalid menu key"
    ),

  location: z.enum(["header", "footer"]),

  displayOrder: z
    .number()
    .int()
    .min(0)
    .optional(),

  isActive: z
    .boolean()
    .optional(),

  items: z
    .array(menuItemSchema)
    .max(100)
    .optional(),
});

const updateStorefrontMenuSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),

    key: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(
        /^[a-zA-Z0-9]+(?:[-_][a-zA-Z0-9]+)*$/,
        "Invalid menu key"
      )
      .optional(),

    location: z
      .enum(["header", "footer"])
      .optional(),

    displayOrder: z
      .number()
      .int()
      .min(0)
      .optional(),

    isActive: z
      .boolean()
      .optional(),

    items: z
      .array(menuItemSchema)
      .max(100)
      .optional(),
  })
  .refine(
    (data) =>
      Object.values(data).some(
        (value) => value !== undefined
      ),
    {
      message: "At least one field is required",
    }
  );

const storefrontMenuIdParamsSchema = z.object({
  menuId: objectId,
});

const storefrontMenuKeyParamsSchema = z.object({
  key: z.string().trim().min(1).max(100),
});

const storefrontMenuListQuerySchema = z.object({
  location: z
    .enum(["header", "footer"])
    .optional(),

  isActive: z
    .enum(["true", "false"])
    .optional(),
});

module.exports = {
  createStorefrontMenuSchema,
  updateStorefrontMenuSchema,
  storefrontMenuIdParamsSchema,
  storefrontMenuKeyParamsSchema,
  storefrontMenuListQuerySchema,
};