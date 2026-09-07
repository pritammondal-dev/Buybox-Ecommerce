const { z } = require("zod");

const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const pathField = z
  .string()
  .trim()
  .min(1)
  .max(500);

const createStorefrontRedirectSchema = z.object({
  sourcePath: pathField,

  destinationPath: pathField,

  statusCode: z
    .number()
    .int()
    .refine(
      (value) => value === 301 || value === 302,
      {
        message: "Status code must be 301 or 302",
      }
    )
    .optional(),

  isActive: z.boolean().optional(),
});

const updateStorefrontRedirectSchema = z
  .object({
    sourcePath: pathField.optional(),

    destinationPath: pathField.optional(),

    statusCode: z
      .number()
      .int()
      .refine(
        (value) => value === 301 || value === 302,
        {
          message: "Status code must be 301 or 302",
        }
      )
      .optional(),

    isActive: z.boolean().optional(),
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

const storefrontRedirectIdParamsSchema = z.object({
  redirectId: objectId,
});

const storefrontRedirectSourcePathParamsSchema =
  z.object({
    sourcePath: pathField,
  });

module.exports = {
  createStorefrontRedirectSchema,
  updateStorefrontRedirectSchema,
  storefrontRedirectIdParamsSchema,
  storefrontRedirectSourcePathParamsSchema,
};

