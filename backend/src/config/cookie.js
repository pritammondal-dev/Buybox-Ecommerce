const env = require("./env");

const refreshCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.NODE_ENV === "production" ? "strict" : "lax",
  path: "/api/v1/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

module.exports = {
  refreshCookieOptions,
};