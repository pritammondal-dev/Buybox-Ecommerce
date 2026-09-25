/**
 * OTP Utilities & Privacy Masks
 *
 * Production Security Rules:
 * - Plaintext OTP is NEVER returned in API responses or displayed in client UI.
 * - Development-only/static OTP behavior has been completely removed across the entire platform.
 */

export const extractDevOtp = () => undefined;

export const shouldShowDevOtpToast = () => false;

/**
 * Mask an email address for privacy-safe display:
 * Example: "john.doe@example.com" -> "j***@example.com"
 * Example: "a@domain.com" -> "a***@domain.com"
 *
 * @param {string} rawEmail
 * @returns {string}
 */
export const maskEmail = (rawEmail) => {
  if (!rawEmail || typeof rawEmail !== "string" || !rawEmail.includes("@")) {
    return rawEmail || "";
  }
  const [localPart, domain] = rawEmail.trim().split("@");
  if (!localPart || !domain) return rawEmail;
  if (localPart.length <= 1) {
    return `${localPart}***@${domain}`;
  }
  const maskedLocal = `${localPart[0]}${"*".repeat(Math.min(localPart.length - 1, 3))}`;
  return `${maskedLocal}@${domain}`;
};

/**
 * Mask a phone number for privacy display
 * Example: "+919876543210" -> "+91 ••••• ••210"
 *
 * @param {string} rawPhone
 * @returns {string}
 */
export const maskPhone = (rawPhone) => {
  if (!rawPhone || typeof rawPhone !== "string") {
    return rawPhone || "";
  }
  const clean = rawPhone.trim();
  if (clean.length <= 4) {
    return "••••" + clean;
  }
  const lastThree = clean.slice(-3);
  const prefix = clean.startsWith("+") ? clean.slice(0, 3) : "";
  return `${prefix ? prefix + " " : ""}••••• ••${lastThree}`;
};

