const { z } = require("zod");
const { createAddressSchema } = require("./create-address.validator");

const shapeWithoutDefaults = Object.fromEntries(
  Object.entries(createAddressSchema.shape).map(([key, field]) => [
    key,
    typeof field.removeDefault === "function" ? field.removeDefault() : field,
  ])
);

const updateAddressSchema = z
  .object(shapeWithoutDefaults)
  .strict()
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field must be provided for update"
  );

module.exports = {
  updateAddressSchema,
};
