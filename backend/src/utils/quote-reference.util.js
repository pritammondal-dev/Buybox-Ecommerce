const crypto = require("crypto");
const env = require("../config/env");
const logger = require("../config/logger");
const AppError = require("../errors/AppError");

const DEFAULT_QUOTE_TTL_MS = 15 * 60 * 1000; // 15 minutes
let fallbackWarningLogged = false;

/**
 * Resolve the secret key used for signing checkout quotes.
 * 
 * Precedence:
 * 1. Dedicated env.CHECKOUT_QUOTE_SECRET (recommended, isolates quote signing from JWT rotation).
 * 2. Fallback env.JWT_ACCESS_SECRET (migration compatibility with explicit warning).
 * 3. In production, never falls back to insecure constant; throws an explicit configuration error.
 * 4. In development/test mode, provides a 45-character fallback key if env is unpopulated.
 * 
 * @param {Object} [customEnv] Optional env override for unit testing
 * @returns {string} Signing key of at least 32 characters
 */
const getSigningKey = (customEnv = null) => {
  const activeEnv = customEnv || env;

  if (activeEnv.CHECKOUT_QUOTE_SECRET && typeof activeEnv.CHECKOUT_QUOTE_SECRET === "string") {
    const key = activeEnv.CHECKOUT_QUOTE_SECRET.trim();
    if (key.length < 32) {
      throw new AppError("CHECKOUT_QUOTE_SECRET must be at least 32 characters long", 500, "INVALID_SIGNING_KEY");
    }
    return key;
  }

  if (activeEnv.JWT_ACCESS_SECRET && typeof activeEnv.JWT_ACCESS_SECRET === "string") {
    const key = activeEnv.JWT_ACCESS_SECRET.trim();
    if (key.length < 32) {
      throw new AppError("JWT_ACCESS_SECRET fallback key must be at least 32 characters long", 500, "INVALID_SIGNING_KEY");
    }
    if (!fallbackWarningLogged && activeEnv.NODE_ENV !== "test") {
      logger.warn(
        "CHECKOUT_QUOTE_SECRET is not configured; using JWT_ACCESS_SECRET as backward-compatible fallback for quote signing. Set CHECKOUT_QUOTE_SECRET to decouple quote signing from auth token rotation."
      );
      fallbackWarningLogged = true;
    }
    return key;
  }

  if (activeEnv.NODE_ENV === "production") {
    throw new AppError(
      "Missing quote signing secret: CHECKOUT_QUOTE_SECRET (or JWT_ACCESS_SECRET) must be configured in production",
      500,
      "CONFIG_ERROR"
    );
  }

  return "buybox-default-quote-signing-key-32chars-min";
};

/**
 * Format a number or string into a standardized 2-decimal string.
 * @param {number|string} val 
 * @returns {string} e.g. "500.00"
 */
const toStandardDecimalString = (val) => {
  if (val === null || val === undefined) return "0.00";
  const num = Number(val);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
};

/**
 * Normalize and deterministically sort pricing items for canonical hashing.
 * Sort order: by productVariantId (ascending), then sku (ascending).
 * 
 * @param {Array<Object>} items
 * @returns {Array<Object>} Canonical sorted and normalized items
 */
const normalizePricingItems = (items = []) => {
  return (items || [])
    .map((item) => {
      const pvid = String(item.productVariantId || item.pvid || "").trim();
      const pid = String(item.productId || item.pid || "").trim();
      const sku = String(item.sku || "").trim();
      const qty = Number(item.quantity !== undefined ? item.quantity : (item.qty || 0));
      const unitPrice = toStandardDecimalString(item.unitPrice);
      const lineTotal = toStandardDecimalString(item.lineTotal);
      const taxTotal = toStandardDecimalString(item.taxTotal);
      const discountTotal = toStandardDecimalString(item.discountTotal);

      return {
        discountTotal,
        lineTotal,
        pid,
        pvid,
        qty: Number.isFinite(qty) ? Math.max(0, qty) : 0,
        sku,
        taxTotal,
        unitPrice,
      };
    })
    .sort((a, b) => a.pvid.localeCompare(b.pvid) || a.sku.localeCompare(b.sku));
};

/**
 * Compute a deterministic, versioned pricing fingerprint over all payable components.
 * 
 * Covers:
 * - Product variant IDs and product IDs
 * - Quantities
 * - Unit prices and line totals
 * - Discounts and coupon code
 * - Shipping total and delivery option ID
 * - Tax total
 * - Grand total and currency
 * 
 * @param {Object} components
 * @returns {string} SHA-256 hex fingerprint
 */
const computePricingFingerprint = ({
  items = [],
  currency = "INR",
  subtotal = "0.00",
  discountTotal = "0.00",
  shippingTotal = "0.00",
  taxTotal = "0.00",
  grandTotal = "0.00",
  deliveryOptionId = null,
  couponCode = null,
}) => {
  const normalizedItems = normalizePricingItems(items);

  const canonicalPayload = {
    v: 1, // fingerprint schema version
    cur: String(currency || "INR").trim().toUpperCase(),
    sub: toStandardDecimalString(subtotal),
    disc: toStandardDecimalString(discountTotal),
    ship: toStandardDecimalString(shippingTotal),
    tax: toStandardDecimalString(taxTotal),
    gt: toStandardDecimalString(grandTotal),
    deliv: deliveryOptionId ? String(deliveryOptionId).trim().toLowerCase() : null,
    coup: couponCode ? String(couponCode).trim().toUpperCase() : null,
    items: normalizedItems,
  };

  const canonicalString = JSON.stringify(canonicalPayload);
  return crypto.createHash("sha256").update(canonicalString, "utf8").digest("hex");
};

/**
 * Generate a cryptographically signed checkout quote reference token
 * containing a tamper-proof pricing fingerprint and quote snapshot.
 * 
 * @param {Object} params
 * @param {string} params.customerId
 * @param {string} params.cartId
 * @param {string|number} params.grandTotal
 * @param {string} params.currency
 * @param {Array<Object>} [params.items=[]]
 * @param {string|number} [params.subtotal]
 * @param {string|number} [params.discountTotal="0.00"]
 * @param {string|number} [params.shippingTotal="0.00"]
 * @param {string|number} [params.taxTotal="0.00"]
 * @param {string} [params.deliveryOptionId]
 * @param {string} [params.couponCode]
 * @param {string} [params.pricingFingerprint]
 * @param {number} [params.expiresInMs=900000]
 * @param {string} [params.signingKey]
 * @returns {{ quoteReference: string, expiresAt: string, expiresAtMs: number, pricingFingerprint: string }}
 */
const generateQuoteReference = ({
  customerId,
  cartId,
  grandTotal,
  currency,
  items = [],
  subtotal = null,
  discountTotal = "0.00",
  shippingTotal = "0.00",
  taxTotal = "0.00",
  deliveryOptionId = null,
  couponCode = null,
  pricingFingerprint = null,
  expiresInMs = DEFAULT_QUOTE_TTL_MS,
  signingKey = null,
}) => {
  const expiresAtMs = Date.now() + expiresInMs;
  const standardGrandTotal = toStandardDecimalString(grandTotal);
  const standardSubtotal = toStandardDecimalString(subtotal !== null && subtotal !== undefined ? subtotal : grandTotal);

  const hasItems = Array.isArray(items) && items.length > 0;
  const fp = pricingFingerprint || (hasItems ? computePricingFingerprint({
    items,
    currency,
    subtotal: standardSubtotal,
    discountTotal,
    shippingTotal,
    taxTotal,
    grandTotal: standardGrandTotal,
    deliveryOptionId,
    couponCode,
  }) : null);

  const normalizedItems = normalizePricingItems(items);

  const payload = {
    cid: String(customerId),
    cartId: String(cartId),
    gt: standardGrandTotal,
    cur: String(currency || "INR").trim().toUpperCase(),
    fp,
    exp: expiresAtMs,
    snap: {
      subtotal: standardSubtotal,
      discountTotal: toStandardDecimalString(discountTotal),
      shippingTotal: toStandardDecimalString(shippingTotal),
      taxTotal: toStandardDecimalString(taxTotal),
      grandTotal: standardGrandTotal,
      currency: String(currency || "INR").trim().toUpperCase(),
      deliveryOptionId: deliveryOptionId || null,
      couponCode: couponCode || null,
      items: normalizedItems.map((it) => ({
        productVariantId: it.pvid,
        productId: it.pid,
        sku: it.sku,
        quantity: it.qty,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
        taxTotal: it.taxTotal,
        discountTotal: it.discountTotal,
      })),
    },
  };

  const payloadString = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadString, "utf8").toString("base64url");
  const key = signingKey || getSigningKey();
  const signature = crypto
    .createHmac("sha256", key)
    .update(payloadB64)
    .digest("base64url");

  const quoteReference = `qref_v1_${payloadB64}.${signature}`;
  return {
    quoteReference,
    expiresAt: new Date(expiresAtMs).toISOString(),
    expiresAtMs,
    pricingFingerprint: fp,
  };
};

/**
 * Verify a checkout quote reference token.
 * Validates cryptographic signature, expiry, customer/cart binding, and extracts payload.
 * 
 * @param {string} token
 * @param {Object} context
 * @param {string} context.customerId
 * @param {string} context.cartId
 * @param {Object} [options]
 * @param {string} [options.signingKey]
 * @returns {Object} Unpacked quote payload with snapshot and fingerprint
 */
const verifyQuoteReference = (token, { customerId, cartId }, options = {}) => {
  const signingKey = options.signingKey || getSigningKey();

  if (!token || typeof token !== "string" || !token.startsWith("qref_v1_")) {
    throw new AppError("Invalid or unsupported quote reference format", 400, "INVALID_QUOTE_REFERENCE");
  }

  const parts = token.slice("qref_v1_".length).split(".");
  if (parts.length !== 2) {
    throw new AppError("Malformed quote reference", 400, "INVALID_QUOTE_REFERENCE");
  }

  const [payloadB64, signature] = parts;
  const expectedSignature = crypto
    .createHmac("sha256", signingKey)
    .update(payloadB64)
    .digest("base64url");

  // Constant-time signature comparison
  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);
  if (
    sigBuffer.length !== expectedSigBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
  ) {
    throw new AppError("Quote reference signature verification failed", 400, "INVALID_QUOTE_REFERENCE");
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    throw new AppError("Corrupted quote reference payload", 400, "INVALID_QUOTE_REFERENCE");
  }

  if (
    !payload ||
    !payload.cid ||
    !payload.cartId ||
    payload.gt === undefined ||
    !payload.exp
  ) {
    throw new AppError("Incomplete quote reference payload", 400, "INVALID_QUOTE_REFERENCE");
  }

  // Customer binding verification
  if (payload.cid !== String(customerId)) {
    throw new AppError("Quote reference belongs to another customer account", 400, "INVALID_QUOTE_REFERENCE");
  }

  // Cart binding verification
  if (payload.cartId !== String(cartId)) {
    throw new AppError("Quote reference does not match the active customer cart", 400, "INVALID_QUOTE_REFERENCE");
  }

  // Expiration verification
  if (Date.now() > payload.exp) {
    throw new AppError(
      "Checkout quote has expired. Please refresh checkout to verify current pricing.",
      409,
      "QUOTE_EXPIRED",
      {
        quotedGrandTotal: payload.gt,
        currency: payload.cur,
        expiredAt: new Date(payload.exp).toISOString(),
        snapshot: payload.snap || null,
      }
    );
  }

  return {
    customerId: payload.cid,
    cartId: payload.cartId,
    quotedGrandTotal: payload.gt,
    currency: payload.cur,
    pricingFingerprint: payload.fp || null,
    snapshot: payload.snap || null,
    expiresAtMs: payload.exp,
  };
};

module.exports = {
  DEFAULT_QUOTE_TTL_MS,
  getSigningKey,
  computePricingFingerprint,
  normalizePricingItems,
  generateQuoteReference,
  verifyQuoteReference,
};
