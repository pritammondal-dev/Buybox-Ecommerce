const { z } = require("zod");
const AppError = require("../../errors/AppError");

const refreshSchema = z.object({
  refreshToken: z
    .string()
    .min(1, "Refresh token is required"),
});

const validateRefreshToken = (req, res, next) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return next(
      new AppError(
        "Refresh token is required",
        400,
        "VALIDATION_ERROR"
      )
    );
  }

  req.refreshToken = token.trim();
  next();
};

module.exports = {
  refreshSchema,
  validateRefreshToken,
};