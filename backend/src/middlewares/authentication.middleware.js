const mongoose = require("mongoose");
const User = require("../models/User");
const AppError = require("../errors/AppError");
const { verifyAccessToken } = require("../services/token.service");

const authenticate = async (req, res, next) => {
  const authorization = req.get("Authorization");

  if (!authorization) {
    return next(
      new AppError("Authentication required", 401, "AUTHENTICATION_REQUIRED"),
    );
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(
      new AppError(
        "Invalid authorization header",
        401,
        "INVALID_AUTHORIZATION_HEADER",
      ),
    );
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (error) {
    return next(
      new AppError(
        "Invalid or expired access token",
        401,
        "INVALID_ACCESS_TOKEN",
      ),
    );
  }

  if (decoded.type !== "access") {
    return next(
      new AppError("Invalid access token", 401, "INVALID_ACCESS_TOKEN"),
    );
  }

  const tokenAuthVersion = Number(decoded.authVersion ?? 1);
  const tokenPermissionVersion = Number(decoded.permissionVersion ?? 1);

  let dbUser = null;
  if (decoded.sub && mongoose.connection.readyState === 1) {
    try {
      const query = User.findById(decoded.sub);
      if (query && typeof query.select === "function") {
        dbUser = await query
          .select("authVersion permissionVersion isActive role")
          .lean();
      } else if (query && typeof query.then === "function") {
        dbUser = await query;
      }
    } catch (err) {
      dbUser = null;
    }
  }

  if (dbUser) {
    if (dbUser.isActive === false) {
      return next(
        new AppError("User account is inactive", 401, "USER_INACTIVE"),
      );
    }

    const userAuthVersion = Number(dbUser.authVersion ?? 1);
    if (tokenAuthVersion !== userAuthVersion) {
      return next(
        new AppError(
          "Session expired or invalidated",
          401,
          "AUTH_VERSION_MISMATCH",
        ),
      );
    }
  }

  const dbPermissionVersion = dbUser
    ? Number(dbUser.permissionVersion ?? 1)
    : tokenPermissionVersion;
  const isPermissionFresh = tokenPermissionVersion === dbPermissionVersion;

  req.user = {
    id: decoded.sub,
    role: dbUser?.role || decoded.role,
    authVersion: tokenAuthVersion,
    permissionVersion: tokenPermissionVersion,
    dbAuthVersion: dbUser ? Number(dbUser.authVersion ?? 1) : tokenAuthVersion,
    dbPermissionVersion,
    isPermissionFresh,
  };

  next();
};

module.exports = authenticate;
