/**
 * Determine if plaintext OTP display is permissible for local development/testing.
 *
 * STRICT SECURITY GUARANTEE:
 * Development-only/static OTP behavior has been completely removed across the entire platform.
 * Plaintext OTP is NEVER returned in API responses or displayed in client UI.
 *
 * @returns {boolean} Always false
 */
const isDevOtpDisplayAllowed = () => {
  return false;
};

module.exports = {
  isDevOtpDisplayAllowed,
};
