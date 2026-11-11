const crypto = require("crypto");
const DeletedAccountTombstone = require("../models/DeletedAccountTombstone");

const CURRENT_KEY_VERSION = 1;

/**
 * Retrieve the active HMAC secret for tombstone fingerprint generation.
 * @param {number} keyVersion
 * @returns {string}
 */
const getTombstoneSecret = (keyVersion = CURRENT_KEY_VERSION) => {
  if (keyVersion === 1) {
    return (
      process.env.TOMBSTONE_HMAC_SECRET ||
      process.env.JWT_SECRET ||
      "buybox-default-tombstone-hmac-secret-secure-salt-2026"
    );
  }
  // Future secret rotation versions can be added here
  return (
    process.env[`TOMBSTONE_HMAC_SECRET_V${keyVersion}`] ||
    process.env.TOMBSTONE_HMAC_SECRET ||
    process.env.JWT_SECRET ||
    "buybox-default-tombstone-hmac-secret-secure-salt-2026"
  );
};

/**
 * Generate a privacy-preserving HMAC-SHA-256 fingerprint for a customer identifier.
 *
 * @param {("google_sub"|"email")} type
 * @param {string} rawIdentifier
 * @param {number} [keyVersion=1]
 * @returns {string} Hex encoded HMAC digest
 */
const generateIdentityFingerprint = (type, rawIdentifier, keyVersion = CURRENT_KEY_VERSION) => {
  if (!rawIdentifier || typeof rawIdentifier !== "string") {
    return null;
  }

  const normalized =
    type === "email"
      ? rawIdentifier.trim().toLowerCase()
      : rawIdentifier.trim();

  const secret = getTombstoneSecret(keyVersion);
  return crypto
    .createHmac("sha256", secret)
    .update(`${type}:${normalized}`)
    .digest("hex");
};

/**
 * Check whether any identifier associated with a customer or incoming auth request
 * exists in the DeletedAccountTombstone registry.
 *
 * @param {Object} params
 * @param {string} [params.email]
 * @param {string} [params.googleSub]
 * @param {number} [keyVersion=1]
 * @returns {Promise<boolean>}
 */
const isIdentityTombstoned = async ({ email = null, googleSub = null }, keyVersion = CURRENT_KEY_VERSION) => {
  const fingerprints = [];

  if (googleSub) {
    const googleFp = generateIdentityFingerprint("google_sub", googleSub, keyVersion);
    if (googleFp) fingerprints.push(googleFp);
  }

  if (email) {
    const emailFp = generateIdentityFingerprint("email", email, keyVersion);
    if (emailFp) fingerprints.push(emailFp);
  }

  if (fingerprints.length === 0) {
    return false;
  }

  const match = await DeletedAccountTombstone.findOne({
    identityFingerprint: { $in: fingerprints },
  }).lean();

  return Boolean(match);
};

module.exports = {
  CURRENT_KEY_VERSION,
  generateIdentityFingerprint,
  isIdentityTombstoned,
};

