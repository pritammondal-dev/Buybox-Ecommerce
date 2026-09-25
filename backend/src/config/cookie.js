const env = require("./env");

const COOKIE_NAMES = Object.freeze({
  CUSTOMER: "bb_customer_session",
  VENDOR: "bb_vendor_session",
  ADMINISTRATOR: "bb_administrator_session",
  LEGACY_REFRESH: "refreshToken",
});

const baseCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.NODE_ENV === "production" ? "strict" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const customerCookieOptions = {
  ...baseCookieOptions,
  path: "/api/v1/auth",
};

const vendorCookieOptions = {
  ...baseCookieOptions,
  path: "/api/v1/vendor/auth",
};

const administratorCookieOptions = {
  ...baseCookieOptions,
  path: "/api/v1/administrator/auth",
};

// Legacy refresh cookie options for backward compatibility
const refreshCookieOptions = customerCookieOptions;

module.exports = {
  COOKIE_NAMES,
  customerCookieOptions,
  vendorCookieOptions,
  administratorCookieOptions,
  refreshCookieOptions,
};