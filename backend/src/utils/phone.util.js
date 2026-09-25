/**
 * Phone Number Utilities
 *
 * Strict E.164-compatible normalization, validation, and privacy masking.
 * Ensures consistent database storage across all mobile authentication flows.
 */

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

/**
 * Normalize an incoming phone number into standard E.164 format.
 *
 * @param {string} rawPhone
 * @param {string} [defaultCountryPrefix='+91']
 * @returns {string} E.164 normalized phone string (e.g., '+919876543210')
 * @throws {Error} if phone number is invalid or cannot be normalized
 */
const normalizePhoneNumber = (rawPhone, defaultCountryPrefix = "+91") => {
  if (!rawPhone || typeof rawPhone !== "string") {
    throw new Error("Phone number must be a non-empty string");
  }

  // Remove spaces, hyphens, parentheses, and dots
  let cleaned = rawPhone.replace(/[\s\-\(\)\.]/g, "").trim();

  // If already starts with '+', validate against E.164
  if (cleaned.startsWith("+")) {
    if (!E164_REGEX.test(cleaned)) {
      throw new Error("Invalid international phone number format. Must adhere to E.164 (e.g. +919876543210)");
    }
    return cleaned;
  }

  // Handle leading '00' international prefix
  if (cleaned.startsWith("00")) {
    const withPlus = "+" + cleaned.slice(2);
    if (!E164_REGEX.test(withPlus)) {
      throw new Error("Invalid phone number format");
    }
    return withPlus;
  }

  // Handle local domestic formats:
  // 1. Single leading 0 domestic trunk prefix (e.g. '09876543210' -> '9876543210')
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }

  // 2. 10-digit national number (typical for India/US)
  if (/^\d{10}$/.test(cleaned)) {
    const normalized = `${defaultCountryPrefix}${cleaned}`;
    if (!E164_REGEX.test(normalized)) {
      throw new Error("Invalid phone number format");
    }
    return normalized;
  }

  // 3. 12-digit number already prefixed with 91 (without '+')
  if (/^91\d{10}$/.test(cleaned)) {
    const normalized = `+${cleaned}`;
    if (!E164_REGEX.test(normalized)) {
      throw new Error("Invalid phone number format");
    }
    return normalized;
  }

  // Fallback check if it's 8-15 digits
  if (/^\d{8,15}$/.test(cleaned)) {
    const normalized = `+${cleaned}`;
    if (E164_REGEX.test(normalized)) {
      return normalized;
    }
  }

  throw new Error("Invalid phone number. Please enter a valid mobile number with country code (e.g. +919876543210).");
};

/**
 * Validate whether a phone number can be normalized to valid E.164.
 *
 * @param {string} rawPhone
 * @returns {boolean}
 */
const isValidPhoneNumber = (rawPhone) => {
  try {
    normalizePhoneNumber(rawPhone);
    return true;
  } catch {
    return false;
  }
};

/**
 * Safely mask a phone number for user privacy display in UI or logs.
 * Example: '+919876543210' -> '+91 ••••• ••210'
 *
 * @param {string} phone
 * @returns {string}
 */
const maskPhoneNumber = (phone) => {
  if (!phone || typeof phone !== "string") {
    return "";
  }
  const clean = phone.trim();
  if (clean.length <= 5) {
    return "••••" + clean.slice(-2);
  }
  const lastFour = clean.slice(-4);
  const prefix = clean.slice(0, 3);
  return `${prefix} ••••• •${lastFour}`;
};

module.exports = {
  normalizePhoneNumber,
  isValidPhoneNumber,
  maskPhoneNumber,
  E164_REGEX,
};
