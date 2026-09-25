const { z } = require("zod");

const vendorOrderIdSchema = z
  .object({
    orderId: z
      .string()
      .refine(
        (val) => /^[0-9a-fA-F]{24}$/.test(val) || /^ord_[A-Za-z0-9_-]+$/.test(val),
        { message: "Invalid order identifier format" }
      ),
  })
  .strict();

module.exports = {
  vendorOrderIdSchema,
};
