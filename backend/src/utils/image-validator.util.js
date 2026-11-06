const MAX_IMAGE_URL_LENGTH = 2000;
const ALLOWED_LOCAL_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

/**
 * Validates an image reference according to Buybox catalog security policy.
 *
 * Permitted references:
 * 1. Syntactically valid HTTPS URLs (https://...).
 * 2. Approved local relative paths under /uploads/ (e.g. /uploads/product_123.jpg).
 * 3. Relative filenames from an accompanying uploaded ZIP archive (when zipArchiveContext is supplied).
 *
 * Rejected references:
 * - Protocols other than https: (e.g. http:, ftp:, file:, data:, javascript:).
 * - Protocol-relative URLs starting with '//'.
 * - Malformed URLs or URLs with embedded credentials (https://user:pass@host/path).
 * - SVG files (.svg) due to stored-XSS execution risk.
 * - Local paths containing directory traversal (..), backslashes (\), or control characters.
 * - Local paths outside the /uploads/ namespace.
 * - Relative filenames when no ZIP archive was uploaded.
 * - Strings exceeding 2000 characters.
 *
 * @param {string|null|undefined} val - Raw image reference string
 * @param {object} [options] - Optional validation options
 * @param {object} [options.zipArchiveContext] - Staged ZIP archive index for relative image matching
 * @returns {{ isValid: boolean, isBlank: boolean, error: string|null, reason: string|null, sanitizedUrl?: string, isZipReference?: boolean, fileMeta?: object }}
 */
function validateImageReference(val, options = {}) {
  const { zipArchiveContext = null } = options;

  if (val === null || val === undefined) {
    return { isValid: true, isBlank: true, error: null, reason: null };
  }
  const str = String(val).trim();
  if (str === "") {
    return { isValid: true, isBlank: true, error: null, reason: null };
  }

  if (str.length > MAX_IMAGE_URL_LENGTH) {
    const error = `Image reference exceeds maximum allowed length of ${MAX_IMAGE_URL_LENGTH} characters.`;
    return {
      isValid: false,
      isBlank: false,
      error,
      reason: error,
    };
  }

  // Reject protocol-relative URLs (e.g. //cdn.example.com/img.jpg)
  if (str.startsWith("//")) {
    const error = "Protocol-relative URLs starting with '//' are not allowed. Please use a full 'https://' URL.";
    return {
      isValid: false,
      isBlank: false,
      error,
      reason: error,
    };
  }

  // Check approved local upload path (/uploads/...)
  if (str.startsWith("/uploads/")) {
    if (str.includes("..") || str.includes("\\") || str.includes("\0") || /[\r\n\t]/.test(str)) {
      const error = "Local upload path contains invalid path traversal segments, backslashes, or control characters.";
      return {
        isValid: false,
        isBlank: false,
        error,
        reason: error,
      };
    }
    const cleanPath = str.split("?")[0].split("#")[0];
    const lastDotIndex = cleanPath.lastIndexOf(".");
    if (lastDotIndex === -1) {
      const error = "Local upload image must contain a valid file extension.";
      return {
        isValid: false,
        isBlank: false,
        error,
        reason: error,
      };
    }
    const ext = cleanPath.slice(lastDotIndex).toLowerCase();
    if (ext === ".svg") {
      const error = "SVG image format is not permitted for product images due to security policy. Please use JPG, PNG, WEBP, GIF, or AVIF.";
      return {
        isValid: false,
        isBlank: false,
        error,
        reason: error,
      };
    }
    if (!ALLOWED_LOCAL_EXTENSIONS.includes(ext)) {
      const error = `Local upload image extension '${ext}' is not supported. Allowed formats: ${ALLOWED_LOCAL_EXTENSIONS.join(", ")}.`;
      return {
        isValid: false,
        isBlank: false,
        error,
        reason: error,
      };
    }
    return {
      isValid: true,
      isBlank: false,
      error: null,
      reason: null,
      sanitizedUrl: str,
    };
  }

  // Reject other relative paths outside /uploads/
  if (str.startsWith("/")) {
    const error = "Local paths outside the approved '/uploads/' namespace are not permitted.";
    return {
      isValid: false,
      isBlank: false,
      error,
      reason: error,
    };
  }

  // If a ZIP image archive context is provided, evaluate relative filenames against the archive
  if (zipArchiveContext && !str.startsWith("/")) {
    // Explicit rejection of SVG even in ZIP matching
    const extMatch = str.split("?")[0].split("#")[0].match(/\.[a-zA-Z0-9]+$/);
    if (extMatch && extMatch[0].toLowerCase() === ".svg") {
      const error = "SVG image format is not permitted for product images due to security policy. Please use JPG, PNG, WEBP, GIF, or AVIF.";
      return {
        isValid: false,
        isBlank: false,
        error,
        reason: error,
      };
    }

    const { matchFilenameInZip } = require("./zip-extractor.util");
    const match = matchFilenameInZip(str, zipArchiveContext);
    if (!match.isMatch) {
      return {
        isValid: false,
        isBlank: false,
        error: match.error,
        reason: match.error,
      };
    }
    return {
      isValid: true,
      isBlank: false,
      isZipReference: true,
      fileMeta: match.fileMeta,
      error: null,
      reason: null,
      sanitizedUrl: str,
    };
  }

  // Must be HTTPS if not matching a ZIP archive entry
  if (!str.toLowerCase().startsWith("https://")) {
    const schemeMatch = str.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
    const scheme = schemeMatch ? schemeMatch[1] : "relative";
    const error =
      scheme === "relative"
        ? `Relative image filename '${str}' requires an accompanying ZIP image archive. Please upload an image ZIP archive or provide a secure 'https://' URL.`
        : `Unsupported image URL scheme '${scheme}'. Only secure 'https://' URLs, approved local '/uploads/' paths, and ZIP archive image filenames are accepted.`;
    return {
      isValid: false,
      isBlank: false,
      error,
      reason: error,
    };
  }

  try {
    const parsed = new URL(str);
    if (parsed.protocol !== "https:") {
      const error = "Only 'https://' protocol is permitted for remote image URLs.";
      return {
        isValid: false,
        isBlank: false,
        error,
        reason: error,
      };
    }
    if (parsed.username || parsed.password) {
      const error = "Image URLs containing embedded username or password credentials are not allowed.";
      return {
        isValid: false,
        isBlank: false,
        error,
        reason: error,
      };
    }
    if (!parsed.hostname || parsed.hostname.length < 1) {
      const error = "Image URL must contain a valid hostname.";
      return {
        isValid: false,
        isBlank: false,
        error,
        reason: error,
      };
    }
    // Reject remote SVG paths to avoid stored-XSS execution upon direct navigation
    const remotePath = parsed.pathname.toLowerCase().split("?")[0].split("#")[0];
    if (remotePath.endsWith(".svg")) {
      const error = "SVG image format is not permitted for product images due to security policy. Please use JPG, PNG, WEBP, GIF, or AVIF.";
      return {
        isValid: false,
        isBlank: false,
        error,
        reason: error,
      };
    }
    return {
      isValid: true,
      isBlank: false,
      error: null,
      reason: null,
      sanitizedUrl: parsed.href,
    };
  } catch (err) {
    const error = `Malformed image URL: ${err.message}`;
    return {
      isValid: false,
      isBlank: false,
      error,
      reason: error,
    };
  }
}

/**
 * Returns true if the string is a valid non-blank image reference.
 * @param {string} val
 * @returns {boolean}
 */
function isValidImageReference(val) {
  const result = validateImageReference(val);
  return result.isValid && !result.isBlank;
}

module.exports = {
  validateImageReference,
  isValidImageReference,
  MAX_IMAGE_URL_LENGTH,
  ALLOWED_LOCAL_EXTENSIONS,
};
