/**
 * Compliance & Regulatory Identification Validation Utilities
 *
 * Provides standardized validation and normalization for:
 * - GSTIN (India Goods & Services Tax Identification Number)
 * - PAN (India Permanent Account Number)
 * - IFSC (India Financial System Code)
 */

/**
 * Normalizes a GSTIN string: uppercase, trimmed, stripping whitespace and hyphens.
 *
 * @param {string} value
 * @returns {string}
 */
export function normalizeGSTIN(value) {
  if (!value || typeof value !== "string") return "";
  return value.trim().toUpperCase().replace(/[\s-]/g, "");
}

/**
 * Validates a GSTIN string.
 * Format: 15 alphanumeric characters:
 * - 2 digits: State code (01-37, 97-99)
 * - 10 characters: PAN (5 letters, 4 digits, 1 letter)
 * - 1 character: Entity number for same PAN in state (1-9 or A-Z)
 * - 1 character: 'Z' by default
 * - 1 character: Checksum digit (0-9 or A-Z)
 *
 * @param {string} value
 * @returns {{ isValid: boolean, error?: string, normalized: string }}
 */
export function validateGSTIN(value) {
  const normalized = normalizeGSTIN(value);

  if (!normalized) {
    return { isValid: false, error: "GSTIN is required", normalized };
  }

  if (normalized.length !== 15) {
    return {
      isValid: false,
      error: `GSTIN must be exactly 15 characters (currently ${normalized.length})`,
      normalized,
    };
  }

  // Regex standard: 2 digits + 5 alpha + 4 numeric + 1 alpha + 1 alphanumeric + 'Z' + 1 alphanumeric
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstinRegex.test(normalized)) {
    return {
      isValid: false,
      error: "Invalid GSTIN format. Expected: 2 digits + 10-char PAN + 1 entity code + 'Z' + 1 check character (e.g. 29ABCDE1234F1Z5)",
      normalized,
    };
  }

  return { isValid: true, normalized };
}

/**
 * Normalizes a PAN string: uppercase, trimmed, stripping whitespace and hyphens.
 *
 * @param {string} value
 * @returns {string}
 */
export function normalizePAN(value) {
  if (!value || typeof value !== "string") return "";
  return value.trim().toUpperCase().replace(/[\s-]/g, "");
}

/**
 * Validates an Indian PAN (Permanent Account Number).
 * Format: 10 alphanumeric characters:
 * - 5 letters: [A-Z]{5}
 * - 4 digits: [0-9]{4}
 * - 1 letter: [A-Z]{1}
 *
 * @param {string} value
 * @returns {{ isValid: boolean, error?: string, normalized: string }}
 */
export function validatePAN(value) {
  const normalized = normalizePAN(value);

  if (!normalized) {
    return { isValid: false, error: "PAN is required", normalized };
  }

  if (normalized.length !== 10) {
    return {
      isValid: false,
      error: `PAN must be exactly 10 characters (currently ${normalized.length})`,
      normalized,
    };
  }

  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(normalized)) {
    return {
      isValid: false,
      error: "Invalid PAN format. Expected: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)",
      normalized,
    };
  }

  return { isValid: true, normalized };
}

/**
 * Normalizes an IFSC string: uppercase, trimmed, stripping whitespace and hyphens.
 *
 * @param {string} value
 * @returns {string}
 */
export function normalizeIFSC(value) {
  if (!value || typeof value !== "string") return "";
  return value.trim().toUpperCase().replace(/[\s-]/g, "");
}

/**
 * Validates an IFSC code.
 * When country is India ('IN'), enforces 11 alphanumeric characters:
 * - 4 letters: Bank code
 * - 1 digit: '0'
 * - 6 alphanumeric characters: Branch identifier
 *
 * When country is not 'IN', IFSC validation is bypassed.
 *
 * @param {string} value
 * @param {string} [country="IN"]
 * @returns {{ isValid: boolean, error?: string, normalized: string }}
 */
export function validateIFSC(value, country = "IN") {
  const normalized = normalizeIFSC(value);

  // If country is not India, IFSC format check does not apply
  if (country && country.toUpperCase() !== "IN") {
    return { isValid: true, normalized };
  }

  if (!normalized) {
    return { isValid: false, error: "IFSC code is required for Indian bank accounts", normalized };
  }

  if (normalized.length !== 11) {
    return {
      isValid: false,
      error: `IFSC code must be exactly 11 characters (currently ${normalized.length})`,
      normalized,
    };
  }

  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  if (!ifscRegex.test(normalized)) {
    return {
      isValid: false,
      error: "Invalid IFSC format. Expected 4 letters, 0, then 6 alphanumeric characters (e.g. SBIN0001234)",
      normalized,
    };
  }

  return { isValid: true, normalized };
}

