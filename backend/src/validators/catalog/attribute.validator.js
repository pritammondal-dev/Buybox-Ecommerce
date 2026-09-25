const { z } = require("zod");

const attributeValueSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(100),
  value: z.string().trim().min(1, "Value is required").max(100),
  sortOrder: z.number().int().default(0),
});

const createAttributeSchema = z.object({
  name: z.string().trim().min(1, "Attribute name is required").max(100),
  slug: z.string().trim().min(1).max(100).optional(),
  type: z.enum([
    "text",
    "number",
    "boolean",
    "select",
    "multiselect",
    "size",
    "color",
    "measurement",
    "date",
  ]).default("select"),
  categoryIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Category ID")).optional(),
  isRequired: z.boolean().default(false),
  attributeGroup: z.string().trim().max(100).default("General"),
  values: z.array(attributeValueSchema).optional(),
  isVariantAttribute: z.boolean().default(false),
  isFilterable: z.boolean().default(true),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const updateAttributeSchema = createAttributeSchema.partial();

module.exports = {
  createAttributeSchema,
  updateAttributeSchema,
};
