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

  // 1. Check explicit tombstone registry
  const match = await DeletedAccountTombstone.findOne({
    identityFingerprint: { $in: fingerprints },
  }).lean();

  if (match) {
    return true;
  }

  // 2. Check for legacy/residual deleted user documents
  try {
    const User = require("../models/User");
    const queryConditions = [];
    if (googleSub) {
      queryConditions.push({ "authProviders.google.id": String(googleSub).trim() });
    }
    if (email) {
      queryConditions.push({ email: String(email).trim().toLowerCase() });
    }

    if (queryConditions.length > 0) {
      const residualDeletedUser = await User.findOne({
        $or: queryConditions,
        deletedAt: { $ne: null },
      }).lean();

      if (residualDeletedUser) {
        // Upgrade legacy soft-deleted record to Option A permanent tombstone
        if (residualDeletedUser.email) {
          const legacyEmailFp = generateIdentityFingerprint("email", residualDeletedUser.email, keyVersion);
          if (legacyEmailFp) {
            await DeletedAccountTombstone.updateOne(
              { identityFingerprint: legacyEmailFp },
              {
                $set: {
                  identityFingerprint: legacyEmailFp,
                  fingerprintType: "email",
                  keyVersion,
                  deletedAt: residualDeletedUser.deletedAt || new Date(),
                  reason: "Legacy deleted customer upgraded to tombstone registry",
                },
              },
              { upsert: true }
            );
          }
        }

        const legacyGoogleId = googleSub || residualDeletedUser.authProviders?.google?.id;
        if (legacyGoogleId) {
          const legacyGoogleFp = generateIdentityFingerprint("google_sub", legacyGoogleId, keyVersion);
          if (legacyGoogleFp) {
            await DeletedAccountTombstone.updateOne(
              { identityFingerprint: legacyGoogleFp },
              {
                $set: {
                  identityFingerprint: legacyGoogleFp,
                  fingerprintType: "google_sub",
                  keyVersion,
                  deletedAt: residualDeletedUser.deletedAt || new Date(),
                  reason: "Legacy deleted customer upgraded to tombstone registry",
                },
              },
              { upsert: true }
            );
          }
        }

        // Purge residual user and customer documents per Option A
        const Customer = require("../models/Customer");
        await Customer.deleteMany({ userId: residualDeletedUser._id }).catch(() => {});
        await User.deleteOne({ _id: residualDeletedUser._id }).catch(() => {});

        return true;
      }
    }
  } catch {
    // Non-blocking fallback; continue evaluation
  }

  return false;
};

module.exports = {
  CURRENT_KEY_VERSION,
  generateIdentityFingerprint,
  isIdentityTombstoned,
};

