const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");

const env = require("../config/env");

const generateAccessToken = (payload = {}) => {
  return jwt.sign(
    {
      ...payload,
      type: "access",
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      issuer: "buybox-api",
      audience: "buybox-client",
    }
  );
};

const generateRefreshToken = (payload = {}) => {
  return jwt.sign(
    {
      ...payload,
      jti: randomUUID(),
      type: "refresh",
    },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
      issuer: "buybox-api",
      audience: "buybox-client",
    }
  );
};;

const verifyAccessToken = (token) => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: "buybox-api",
    audience: "buybox-client",
  });
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: "buybox-api",
    audience: "buybox-client",
  });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};