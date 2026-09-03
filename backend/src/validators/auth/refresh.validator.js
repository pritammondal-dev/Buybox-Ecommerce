const { z } = require("zod");

const refreshSchema = z.object({
  refreshToken: z
    .string()
    .min(1, "Refresh token is required"),
});

module.exports = {
  refreshSchema,
};