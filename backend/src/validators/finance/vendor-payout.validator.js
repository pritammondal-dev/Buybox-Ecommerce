const { z } = require("zod");

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");

const createVendorPayoutSchema = z
  .object({
    settlementId: objectId,
    vendorId: objectId,
    provider: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .default("razorpay"),
    metadata: z
      .record(z.string().max(500))
      .optional(),
  })
  .strict();

const updateVendorPayoutStatusSchema = z
  .object({
    status: z.enum([
      "processing",
      "paid",
      "failed",
      "cancelled",
    ]),
    providerReference: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional(),

    failureReason: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .optional(),
  })
  .strict();

module.exports = {
  createVendorPayoutSchema,
  updateVendorPayoutStatusSchema,
};