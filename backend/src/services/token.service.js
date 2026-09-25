const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");
const env = require("../config/env");

const TOKEN_AUDIENCES = Object.freeze({
  CUSTOMER: "buybox-customer",
  VENDOR: "buybox-vendor",
  ADMINISTRATOR: "buybox-administrator",
  LEGACY: "buybox-client",
});

const TOKEN_CONTEXTS = Object.freeze({
  CUSTOMER: "customer",
  VENDOR: "vendor",
  ADMINISTRATOR: "administrator",
});

const ALL_VALID_AUDIENCES = [
  TOKEN_AUDIENCES.CUSTOMER,
  TOKEN_AUDIENCES.VENDOR,
  TOKEN_AUDIENCES.ADMINISTRATOR,
  TOKEN_AUDIENCES.LEGACY,
];

const generateAccessToken = (payload = {}, options = {}) => {
  const context =
    options.context ||
    payload.context ||
    (["super_admin", "admin", "editor"].includes(payload.role)
      ? TOKEN_CONTEXTS.ADMINISTRATOR
      : payload.role === "vendor"
      ? TOKEN_CONTEXTS.VENDOR
      : TOKEN_CONTEXTS.CUSTOMER);

  const audience =
    options.audience ||
    payload.audience ||
    (context === TOKEN_CONTEXTS.ADMINISTRATOR
      ? TOKEN_AUDIENCES.ADMINISTRATOR
      : context === TOKEN_CONTEXTS.VENDOR
      ? TOKEN_AUDIENCES.VENDOR
      : TOKEN_AUDIENCES.CUSTOMER);

  return jwt.sign(
    {
      authVersion: payload.authVersion ?? 1,
      permissionVersion: payload.permissionVersion ?? 1,
      ...payload,
      context,
      type: "access",
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      issuer: "buybox-api",
      audience,
    }
  );
};

const generateRefreshToken = (payload = {}, options = {}) => {
  const context =
    options.context ||
    payload.context ||
    (["super_admin", "admin", "editor"].includes(payload.role)
      ? TOKEN_CONTEXTS.ADMINISTRATOR
      : payload.role === "vendor"
      ? TOKEN_CONTEXTS.VENDOR
      : TOKEN_CONTEXTS.CUSTOMER);

  const audience =
    options.audience ||
    payload.audience ||
    (context === TOKEN_CONTEXTS.ADMINISTRATOR
      ? TOKEN_AUDIENCES.ADMINISTRATOR
      : context === TOKEN_CONTEXTS.VENDOR
      ? TOKEN_AUDIENCES.VENDOR
      : TOKEN_AUDIENCES.CUSTOMER);

  return jwt.sign(
    {
      ...payload,
      context,
      jti: randomUUID(),
      type: "refresh",
    },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
      issuer: "buybox-api",
      audience,
    }
  );
};

const verifyAccessToken = (token, options = {}) => {
  const allowedAudiences = options.expectedAudience
    ? [options.expectedAudience]
    : ALL_VALID_AUDIENCES;

  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: "buybox-api",
    audience: allowedAudiences,
  });

  if (options.expectedContext && decoded.context !== options.expectedContext) {
    const err = new Error(`Invalid token context. Expected ${options.expectedContext}, got ${decoded.context}`);
    err.name = "JsonWebTokenError";
    throw err;
  }

  return decoded;
};

const verifyRefreshToken = (token, options = {}) => {
  const allowedAudiences = options.expectedAudience
    ? [options.expectedAudience]
    : ALL_VALID_AUDIENCES;

  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: "buybox-api",
    audience: allowedAudiences,
  });

  if (options.expectedContext && decoded.context !== options.expectedContext) {
    const err = new Error(`Invalid refresh token context. Expected ${options.expectedContext}, got ${decoded.context}`);
    err.name = "JsonWebTokenError";
    throw err;
  }

  return decoded;
};

module.exports = {
  TOKEN_AUDIENCES,
  TOKEN_CONTEXTS,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};