const { z } = require("zod");
const AppError = require("../../errors/AppError");

const refreshSchema = z.object({
  refreshToken: z
    .string()
    .min(1, "Refresh token is required"),
});

const { COOKIE_NAMES } = require("../../config/cookie");

const validateRefreshToken = (req, res, next) => {
  // If request contains cross-context cookies at customer endpoint, reject with 401
  if (
    !req.cookies?.[COOKIE_NAMES.CUSTOMER] &&
    !req.cookies?.bb_customer_session &&
    !req.cookies?.refreshToken &&
    !req.body?.refreshToken &&
    (req.cookies?.[COOKIE_NAMES.ADMINISTRATOR] ||
      req.cookies?.bb_administrator_session ||
      req.cookies?.[COOKIE_NAMES.VENDOR] ||
      req.cookies?.bb_vendor_session)
  ) {
    return next(
      new AppError(
        "Invalid token context: administrative or vendor session cannot authenticate customer endpoints",
        401,
        "INVALID_TOKEN_CONTEXT"
      )
    );
  }

  const token =
    req.cookies?.[COOKIE_NAMES.CUSTOMER] ||
    req.cookies?.bb_customer_session ||
    req.cookies?.refreshToken ||
    req.body?.refreshToken;

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