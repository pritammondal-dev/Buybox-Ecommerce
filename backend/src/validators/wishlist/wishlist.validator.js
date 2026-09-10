const { z } = require("zod");

const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const addWishlistItemSchema = z
  .object({
    productId: objectId,
    productVariantId: objectId.nullable().optional(),
  })
  .strict();

const wishlistItemIdParamsSchema = z
  .object({
    itemId: objectId,
  })
  .strict();

module.exports = {
  addWishlistItemSchema,
  wishlistItemIdParamsSchema,
};
