const crypto = require("crypto");
const env = require("../config/env");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

/**
 * Derive a consistent 32-byte encryption key for AES-256-GCM.
 * Separated from the HMAC blind index secret.
 *
 * @returns {Buffer} 32-byte AES key buffer
 */
const getBankEncryptionKey = () => {
  const secretSource =
    env.BANK_ACCOUNT_ENCRYPTION_KEY ||
    env.CREDENTIAL_ENCRYPTION_KEY ||
    env.JWT_ACCESS_SECRET ||
    "buybox-bank-master-encryption-key-fallback";

  return crypto.createHash("sha256").update(String(secretSource)).digest();
};

/**
 * Derive a consistent 32-byte secret for HMAC-SHA256 blind indexing.
 * Uses a separate environment variable or distinct derived salt to prevent
 * cryptographic key-reuse attacks between the cipher and the HMAC index.
 *
 * @returns {Buffer} 32-byte HMAC secret buffer
 */
const getBankHmacSecret = () => {
  const secretSource =
    env.BANK_ACCOUNT_HMAC_SECRET ||
    (env.CREDENTIAL_ENCRYPTION_KEY
      ? `${env.CREDENTIAL_ENCRYPTION_KEY}_bank_blind_hmac_salt_v1`
      : env.JWT_REFRESH_SECRET || "buybox-bank-hmac-secret-salt-fallback");

  return crypto.createHash("sha256").update(String(secretSource)).digest();
};

/**
 * Normalize an account number by removing all whitespace and hyphens.
 *
 * @param {string} accountNumber Raw account number
 * @returns {string} Normalized account number
 */
const normalizeAccountNumber = (accountNumber) => {
  if (!accountNumber || typeof accountNumber !== "string") {
    return "";
  }
  return accountNumber.replace(/[\s-]/g, "").trim();
};

/**
 * Normalize an IFSC code by removing whitespace/hyphens and converting to uppercase.
 *
 * @param {string} ifsc Raw IFSC
 * @returns {string} Normalized IFSC code
 */
const normalizeIfsc = (ifsc) => {
  if (!ifsc || typeof ifsc !== "string") {
    return "";
  }
  return ifsc.replace(/[\s-]/g, "").trim().toUpperCase();
};

/**
 * Compute a deterministic HMAC-SHA256 blind index for privacy-preserving duplicate detection.
 * Account number + IFSC combination produces a unique 64-character hex hash.
 *
 * @param {string} accountNumber Plaintext account number
 * @param {string} ifscCode Indian Financial System Code
 * @returns {string} 64-character hex hash
 */
const computeBankAccountHash = (accountNumber, ifscCode = "GENERAL") => {
  const normalizedAccount = normalizeAccountNumber(accountNumber);
  const normalizedIfsc = normalizeIfsc(ifscCode) || "GENERAL";

  if (!normalizedAccount) {
    throw new Error("Account number is required to compute bank account hash");
  }

  const hmacSecret = getBankHmacSecret();
  return crypto
    .createHmac("sha256", hmacSecret)
    .update(`${normalizedAccount}:${normalizedIfsc}`)
    .digest("hex");
};

/**
 * Encrypt a raw bank account number using AES-256-GCM authenticated cipher.
 *
 * @param {string} rawAccountNumber Plaintext account number
 * @returns {string} Encrypted bundle in format `enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 */
const encryptBankAccount = (rawAccountNumber) => {
  const normalized = normalizeAccountNumber(rawAccountNumber);
  if (!normalized) {
    throw new Error("Plaintext account number is required for encryption");
  }

  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const key = getBankEncryptionKey();

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let ciphertext = cipher.update(normalized, "utf8", "hex");
  ciphertext += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `enc:v1:${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext}`;
};

/**
 * Decrypt an AES-256-GCM encrypted bank account bundle.
 *
 * @param {string} encryptedString Ciphertext string in format `enc:v1:<iv>:<tag>:<ciphertext>`
 * @returns {string} Plaintext normalized account number
 */
const decryptBankAccount = (encryptedString) => {
  if (!encryptedString || typeof encryptedString !== "string") {
    throw new Error("Encrypted ciphertext string is required for decryption");
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
  const key = getBankEncryptionKey();

  if (iv.length !== IV_LENGTH_BYTES || authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new Error("Invalid IV or authentication tag length");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertextHex, "hex", "utf8");
  plaintext += decipher.final("utf8");

  return plaintext;
};

/**
 * Safely mask a bank account number showing only the last 4 visible digits.
 *
 * Example: `maskBankAccount("123456789012")` => `••••••••••••9012`
 *
 * @param {string} accountNumber Raw account number
 * @param {number} [visibleCount=4] Number of tail digits to display
 * @returns {string} Masked string
 */
const maskBankAccount = (accountNumber, visibleCount = 4) => {
  const normalized = normalizeAccountNumber(accountNumber);
  if (!normalized) {
    return "";
  }

  if (normalized.length <= visibleCount) {
    return "••••••••••••".slice(0, normalized.length);
  }

  const visible = normalized.slice(-visibleCount);
  return `••••••••••••${visible}`;
};

module.exports = {
  getBankEncryptionKey,
  getBankHmacSecret,
  normalizeAccountNumber,
  normalizeIfsc,
  computeBankAccountHash,
  encryptBankAccount,
  decryptBankAccount,
  maskBankAccount,
};

