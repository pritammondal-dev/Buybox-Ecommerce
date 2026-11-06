/**
 * BUYBOX E-COMMERCE — TRUSTED PROXY CONFIGURATION
 *
 * Implements environment-driven, safe Express proxy trust configuration.
 *
 * Security Invariants:
 * 1. Default is `false` (direct client connection; ignores all X-Forwarded-* headers).
 * 2. In production, indiscriminate `true` logs a prominent security warning,
 *    demanding explicit perimeter network isolation.
 * 3. Integer hop counts (e.g. 1) trust only the exact number of verified proxy hops.
 * 4. Subnet/CIDR lists (e.g. "loopback, 10.0.0.0/8, 172.16.0.0/12") verify the immediate
 *    upstream peer before unwrapping client IP forwarding headers.
 */

/**
 * Parses and validates TRUST_PROXY environment configuration.
 *
 * @param {string|number|boolean|undefined} rawSetting
 * @param {string} [nodeEnv=process.env.NODE_ENV]
 * @returns {boolean|number|string|string[]} Express-compatible trust proxy value
 */
function parseTrustProxySetting(rawSetting, nodeEnv = process.env.NODE_ENV) {
  if (
    rawSetting === undefined ||
    rawSetting === null ||
    rawSetting === "" ||
    rawSetting === "false" ||
    rawSetting === false
  ) {
    return false;
  }

  if (rawSetting === "true" || rawSetting === true) {
    if (nodeEnv === "production") {
      console.warn(
        "[Security Warning] TRUST_PROXY is set to 'true'. This trusts all X-Forwarded-* headers from any origin. " +
        "Ensure your backend container is strictly unreachable from the public internet without passing through your ingress proxy."
      );
    }
    return true;
  }

  // Integer hop count (e.g. 1, 2)
  if (typeof rawSetting === "number" || (/^-?\d+$/.test(String(rawSetting).trim()))) {
    const hopCount = Number(rawSetting);
    if (hopCount < 0) {
      throw new Error(`[Security Error] Invalid TRUST_PROXY hop count: ${hopCount}. Must be >= 0.`);
    }
    return hopCount;
  }

  // String or comma-separated list of IPs / subnets / built-in names
  if (typeof rawSetting === "string") {
    const tokens = rawSetting
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (tokens.length === 1) {
      return tokens[0];
    }
    return tokens;
  }

  return false;
}

/**
 * Configures trust proxy on the Express application instance.
 *
 * @param {import("express").Application} app
 * @param {string|number|boolean|undefined} rawSetting
 * @param {string} [nodeEnv=process.env.NODE_ENV]
 * @returns {boolean|number|string|string[]}
 */
function configureTrustProxy(app, rawSetting, nodeEnv) {
  const parsed = parseTrustProxySetting(rawSetting, nodeEnv);
  app.set("trust proxy", parsed);
  return parsed;
}

module.exports = {
  parseTrustProxySetting,
  configureTrustProxy,
};
