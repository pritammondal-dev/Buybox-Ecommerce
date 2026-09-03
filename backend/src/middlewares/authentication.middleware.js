const AppError = require("../errors/AppError");
const {
  verifyAccessToken,
} = require("../services/token.service");

const authenticate = (req, res, next) => {
  const authorization = req.get("Authorization");

  if (!authorization) {
    return next(
      new AppError(
        "Authentication required",
        401,
        "AUTHENTICATION_REQUIRED"
      )
    );
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(
      new AppError(
        "Invalid authorization header",
        401,
        "INVALID_AUTHORIZATION_HEADER"
      )
    );
  }

  try {
    const decoded = verifyAccessToken(token);

    if (decoded.type !== "access") {
      return next(
        new AppError(
          "Invalid access token",
          401,
          "INVALID_ACCESS_TOKEN"
        )
      );
    }

    req.user = {
      id: decoded.sub,
      role: decoded.role,
    };

    next();
  } catch (error) {
    return next(
      new AppError(
        "Invalid or expired access token",
        401,
        "INVALID_ACCESS_TOKEN"
      )
    );
  }
};

module.exports = authenticate;