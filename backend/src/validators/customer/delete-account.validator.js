const { z } = require("zod");

const deleteCustomerAccountSchema = z
  .object({
    password: z.string().min(1).max(128).optional(),
    confirmation: z.string().trim().max(100).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

module.exports = {
  deleteCustomerAccountSchema,
};

