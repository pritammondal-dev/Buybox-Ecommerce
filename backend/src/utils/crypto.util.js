const crypto = require("crypto");
const env = require("../config/env");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

/**
 * Derive a consistent 32-byte encryption key for AES-256-GCM.
 * Uses CREDENTIAL_ENCRYPTION_KEY or derives from JWT_ACCESS_SECRET if not explicitly provided.
 *
 * @returns {Buffer} 32-byte key buffer
 */
const getEncryptionKey = () => {
  const secretSource =
    env.CREDENTIAL_ENCRYPTION_KEY ||
    env.JWT_ACCESS_SECRET ||
    "buybox-default-master-encryption-key-fallback";

  return crypto.createHash("sha256").update(String(secretSource)).digest();
};

/**
 * Encrypt a plaintext string or object using AES-256-GCM.
 *
 * @param {string|object} data Plaintext string or object to encrypt
 * @returns {string} Encrypted bundle in format `enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 */
const encrypt = (data) => {
  if (data === null || data === undefined) {
    return null;
  }

  const plaintext = typeof data === "object" ? JSON.stringify(data) : String(data);
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const key = getEncryptionKey();

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `enc:v1:${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext}`;
};

/**
 * Decrypt an encrypted bundle produced by `encrypt`.
 *
 * @param {string} encryptedString Encrypted bundle
 * @returns {string|object} Decrypted string or parsed object
 */
const decrypt = (encryptedString) => {
  if (!encryptedString || typeof encryptedString !== "string") {
    return null;
  }

  if (!encryptedString.startsWith("enc:v1:")) {
    throw new Error("Invalid or unsupported ciphertext format");
  }

  const parts = encryptedString.split(":");
  if (parts.length !== 5) {
    throw new Error("Malformed ciphertext payload");
  }

  const [, , ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = getEncryptionKey();

  if (iv.length !== IV_LENGTH_BYTES || authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new Error("Invalid IV or authentication tag length");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertextHex, "hex", "utf8");
  plaintext += decipher.final("utf8");

  try {
    return JSON.parse(plaintext);
  } catch {
    return plaintext;
  }
};

/**
 * Safely mask a secret for frontend display or logging.
 * Returns only the last visible characters, masked with bullet points.
 *
 * Example: `maskSecret("sk_live_1234567890ABCDEF")` => `••••••••••••CDEF`
 *
 * @param {string} secret Plaintext secret
 * @param {number} [visibleCount=4] Number of tail characters to show
 * @returns {string} Masked string
 */
const maskSecret = (secret, visibleCount = 4) => {
  if (!secret || typeof secret !== "string") {
    return "";
  }

  const trimmed = secret.trim();
  if (trimmed.length <= visibleCount) {
    return "••••".slice(0, trimmed.length);
  }

  const visible = trimmed.slice(-visibleCount);
  return `••••••••••••${visible}`;
};

/**
 * Generate a cryptographically secure 6-digit numeric OTP.
 *
 * @returns {string} 6-digit string, e.g. "492815"
 */
const generateSecureNumericOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

/**
 * Hash an OTP using SHA-256 for persistent database storage.
 *
 * @param {string} otp 6-digit OTP
 * @returns {string} 64-character hex hash
 */
const hashOtp = (otp) => {
  if (!otp || typeof otp !== "string") {
    throw new Error("Valid OTP string is required for hashing");
  }
  return crypto.createHash("sha256").update(otp.trim()).digest("hex");
};

/**
 * Compare an incoming raw OTP against a persisted SHA-256 hash using timing-safe comparison.
 *
 * @param {string} rawOtp Incoming OTP
 * @param {string} storedHash Persisted hash
 * @returns {boolean} True if matching
 */
const verifyOtpHash = (rawOtp, storedHash) => {
  if (!rawOtp || !storedHash) {
    return false;
  }

  const candidateHash = hashOtp(rawOtp);
  const candidateBuf = Buffer.from(candidateHash, "hex");
  const storedBuf = Buffer.from(storedHash, "hex");

  if (candidateBuf.length !== storedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(candidateBuf, storedBuf);
};

module.exports = {
  encrypt,
  decrypt,
  encryptSecret: encrypt,
  decryptSecret: decrypt,
  maskSecret,
  generateSecureNumericOtp,
  hashOtp,
  verifyOtpHash,
};
