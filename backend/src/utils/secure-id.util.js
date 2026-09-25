const mongoose = require("mongoose");
const { encrypt, decrypt } = require("./crypto.util");
const AppError = require("../errors/AppError");

const PREFIX_MAP = Object.freeze({
  order: "ord",
  product: "prd",
  variant: "var",
  inventory: "inv",
  shipment: "shp",
  return: "ret",
  warehouse: "wh",
  settlement: "stl",
  review: "rvw",
  question: "qst",
  ticket: "tkt",
  vendor: "ven",
});

const REVERSE_PREFIX_MAP = Object.freeze(
  Object.entries(PREFIX_MAP).reduce((acc, [type, prefix]) => {
    acc[prefix] = type;
    return acc;
  }, {})
);

/**
 * Encode a MongoDB ObjectId or entity ID into a URL-safe opaque secure identifier.
 *
 * @param {string} type Resource type ('order', 'product', 'shipment', etc.)
 * @param {string|mongoose.Types.ObjectId} rawId MongoDB ObjectId
 * @returns {string} Opaque secure identifier (e.g. 'ord_xyz...')
 */
const encodeSecureId = (type, rawId) => {
  if (!rawId) return null;
  const idStr = rawId.toString ? rawId.toString() : String(rawId);
  const prefix = PREFIX_MAP[type] || "sec";

  const payload = JSON.stringify({
    id: idStr,
    t: type,
  });

  const encrypted = encrypt(payload);
  if (!encrypted) return idStr;

  const base64Url = Buffer.from(encrypted, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${prefix}_${base64Url}`;
};

/**
 * Decode a secure identifier back into its 24-character hexadecimal MongoDB ObjectId.
 * In strict mode (public vendor endpoints), raw ObjectIds are rejected with RAW_IDENTIFIER_DISALLOWED.
 *
 * @param {string} secureId Secure identifier or raw ObjectId
 * @param {string} [expectedType] Expected resource type to guard against type transposition
 * @param {Object} [options] Options: { strict: boolean }
 * @returns {string} MongoDB ObjectId string
 */
const decodeSecureId = (secureId, expectedType = null, options = {}) => {
  if (!secureId) {
    throw new AppError("Invalid resource identifier", 400, "INVALID_IDENTIFIER");
  }

  const rawStr = typeof secureId === "string" ? secureId : (secureId.toString ? secureId.toString() : String(secureId));
  const trimmed = rawStr.trim();
  const strict = options.strict ?? false;

  // If already a valid raw 24-char hex ObjectId
  if (/^[a-fA-F0-9]{24}$/.test(trimmed)) {
    if (strict) {
      throw new AppError(
        "Raw database identifiers are disallowed on public endpoints. Encrypted secure identifier required.",
        400,
        "RAW_IDENTIFIER_DISALLOWED"
      );
    }
    return trimmed;
  }

  // Check prefix format: e.g. ord_...
  const underscoreIdx = trimmed.indexOf("_");
  if (underscoreIdx === -1) {
    if (!strict && mongoose.Types.ObjectId.isValid(trimmed)) {
      return trimmed;
    }
    throw new AppError("Malformed resource identifier", 400, "MALFORMED_IDENTIFIER");
  }

  const prefix = trimmed.substring(0, underscoreIdx);
  const base64Url = trimmed.substring(underscoreIdx + 1);

  const isSettlementMatch = expectedType === "settlement" && (prefix === "stl" || prefix === "set");
  if (expectedType && PREFIX_MAP[expectedType] && prefix !== PREFIX_MAP[expectedType] && !isSettlementMatch) {
    throw new AppError(
      "Resource identifier type mismatch",
      400,
      "IDENTIFIER_TYPE_MISMATCH"
    );
  }

  try {
    // Restore base64 padding and characters
    let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }

    const encryptedString = Buffer.from(base64, "base64").toString("utf8");
    const decryptedJson = decrypt(encryptedString);
    const parsed = typeof decryptedJson === "string" ? JSON.parse(decryptedJson) : decryptedJson;

    if (!parsed || !parsed.id) {
      throw new Error("Missing ID in payload");
    }

    if (expectedType && parsed.t && parsed.t !== expectedType) {
      throw new AppError(
        "Resource identifier type mismatch",
        400,
        "IDENTIFIER_TYPE_MISMATCH"
      );
    }

    return parsed.id;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("Unable to resolve secure identifier", 400, "INVALID_SECURE_ID");
  }
};

/**
 * Express middleware to validate and decode secure identifier param on public vendor endpoints.
 */
const requireSecureIdParam = (paramName = "id", expectedType = null) => {
  return (req, res, next) => {
    try {
      const rawParam = req.params[paramName];
      const decodedId = decodeSecureId(rawParam, expectedType, { strict: true });
      req.params[`original_${paramName}`] = rawParam;
      req.params[paramName] = decodedId;
      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = {
  encodeSecureId,
  decodeSecureId,
  requireSecureIdParam,
  PREFIX_MAP,
  REVERSE_PREFIX_MAP,
};
