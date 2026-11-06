/**
 * BUYBOX E-COMMERCE — ENVIRONMENT-AWARE API & MEDIA CONFIGURATION
 *
 * Centralized utility for resolving API base URLs, backend origins,
 * public CDN delivery URLs, and Next.js image remotePatterns.
 *
 * Execution Context Rules:
 * 1. Browser Client (typeof window !== "undefined"):
 *    - Defaults to relative "/api/v1" to leverage same-origin Next.js rewrites,
 *      preserving first-party httpOnly cookies (refreshToken) and preventing CORS.
 * 2. Server-Side SSR / Next.js Node.js Runtime (typeof window === "undefined"):
 *    - Priority: INTERNAL_API_URL -> NEXT_PUBLIC_BACKEND_URL -> NEXT_PUBLIC_API_URL -> Dev Default
 *    - In production (NODE_ENV === "production"), refuses silent fallback to localhost:5000.
 *    - Normalizes URLs to guarantee clean "/api/v1" paths without double-prefixing.
 */

const DEFAULT_LOCAL_BACKEND = "http://localhost:5000";
const DEFAULT_LOCAL_API_PATH = "/api/v1";

/**
 * Validate that a URL has a valid http/https scheme and is parseable.
 * @param {string} rawUrl
 * @param {string} [paramName="URL"]
 * @returns {string} Sanitized URL without trailing slashes
 */
export function validateAndSanitizeUrl(rawUrl, paramName = "URL") {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error(`[Buybox Config] Invalid ${paramName}: URL string is required.`);
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error(`[Buybox Config] Invalid ${paramName}: URL string cannot be empty.`);
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (err) {
    throw new Error(`[Buybox Config] Malformed ${paramName} '${trimmed}': ${err.message}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `[Buybox Config] Insecure protocol '${parsed.protocol}' for ${paramName}. Only 'http:' and 'https:' are permitted.`
    );
  }

  // Prevent embedded credentials (e.g. https://user:pass@example.com)
  if (parsed.username || parsed.password) {
    throw new Error(`[Buybox Config] Security Violation: ${paramName} must not contain embedded credentials.`);
  }

  return trimmed.replace(/\/+$/, "");
}

/**
 * Resolve the backend origin (e.g. "http://localhost:5000" or "https://api.buybox.com").
 * Strips any trailing "/api" or "/api/v1" if present in the raw value.
 * @returns {string}
 */
export function getBackendBaseUrl() {
  const isProd = process.env.NODE_ENV === "production";
  const rawBackend =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    (process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api(\/v1)?\/?$/, "") : null);

  if (rawBackend) {
    const sanitized = validateAndSanitizeUrl(rawBackend, "Backend URL");
    return sanitized.replace(/\/api(\/v1)?\/?$/, "");
  }

  if (isProd) {
    throw new Error(
      "[Buybox Config] Production environment error: Missing required backend URL. " +
      "Production deployment requires INTERNAL_API_URL, NEXT_PUBLIC_BACKEND_URL, or NEXT_PUBLIC_API_URL to be explicitly configured. " +
      "Silent fallback to localhost is forbidden in production."
    );
  }

  return DEFAULT_LOCAL_BACKEND;
}

/**
 * Resolve the full API base URL for HTTP clients.
 * In the browser, returns "/api/v1" to route through Next.js rewrites.
 * On the server, returns the full normalized URL (e.g. "http://localhost:5000/api/v1" or "http://backend:5000/api/v1").
 * @returns {string}
 */
export function getApiBaseUrl() {
  // Browser execution uses relative path for rewrite proxying
  if (typeof window !== "undefined") {
    return DEFAULT_LOCAL_API_PATH;
  }

  // Server-side (SSR) execution
  const isProd = process.env.NODE_ENV === "production";

  // 1. Explicit internal API URL for container networks (Kubernetes / ECS / Docker)
  if (process.env.INTERNAL_API_URL) {
    const sanitized = validateAndSanitizeUrl(process.env.INTERNAL_API_URL, "INTERNAL_API_URL");
    return sanitized.endsWith("/api/v1") ? sanitized : `${sanitized}/api/v1`;
  }

  // 2. Explicit public backend URL
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    const sanitized = validateAndSanitizeUrl(process.env.NEXT_PUBLIC_BACKEND_URL, "NEXT_PUBLIC_BACKEND_URL");
    return sanitized.endsWith("/api/v1") ? sanitized : `${sanitized}/api/v1`;
  }

  // 3. Legacy NEXT_PUBLIC_API_URL
  if (process.env.NEXT_PUBLIC_API_URL) {
    const sanitized = validateAndSanitizeUrl(process.env.NEXT_PUBLIC_API_URL, "NEXT_PUBLIC_API_URL");
    return sanitized.endsWith("/api/v1") ? sanitized : `${sanitized}/api/v1`;
  }

  // 4. Production guardrail: Reject silent fallback to localhost
  if (isProd) {
    throw new Error(
      "[Buybox Config] Production environment error: Missing backend API configuration. " +
      "Set INTERNAL_API_URL or NEXT_PUBLIC_BACKEND_URL in your server environment."
    );
  }

  // 5. Local development default
  return `${DEFAULT_LOCAL_BACKEND}${DEFAULT_LOCAL_API_PATH}`;
}

/**
 * Resolve the public CDN base URL (e.g. "https://cdn.buybox.com").
 * Returns empty string if no CDN is configured.
 * @returns {string}
 */
export function getCdnBaseUrl() {
  const rawCdn = process.env.NEXT_PUBLIC_CDN_URL || process.env.CDN_URL;
  if (!rawCdn) return "";

  try {
    return validateAndSanitizeUrl(rawCdn, "CDN_URL");
  } catch {
    return "";
  }
}

/**
 * Resolve media URLs for storefront rendering.
 * Converts local "/uploads/..." paths to absolute CDN URLs when a CDN is configured.
 * Preserves external HTTPS URLs and local fallback paths.
 * @param {string|null|undefined} mediaPath
 * @returns {string}
 */
export function resolveMediaUrl(mediaPath) {
  if (!mediaPath || typeof mediaPath !== "string") return "";
  const trimmed = mediaPath.trim();
  if (!trimmed) return "";

  // Already an absolute URL (e.g. S3 direct or CDN URL)
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  // Local upload path
  if (trimmed.startsWith("/uploads/")) {
    const cdnBase = getCdnBaseUrl();
    if (cdnBase) {
      return `${cdnBase}${trimmed}`;
    }
    return trimmed;
  }

  return trimmed;
}

/**
 * Disallowed private / sensitive IP ranges for remote image loading.
 */
const PRIVATE_HOST_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./, // AWS / Cloud metadata service
  /^metadata\.google\.internal$/,
  /^instance-data$/,
];

/**
 * Checks if a hostname belongs to a private network or metadata service.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isPrivateOrInternalHost(hostname) {
  if (!hostname) return true;
  const host = hostname.toLowerCase().trim();

  // localhost is allowed in development, but not in remote patterns for production
  for (const pattern of PRIVATE_HOST_PATTERNS) {
    if (pattern.test(host)) return true;
  }

  return false;
}

/**
 * Generates an array of remotePatterns for Next.js image configuration.
 * Authorizes configured CDN, S3 buckets, Cloudflare R2, and local development.
 * @param {Object} [env=process.env]
 * @returns {Array<Object>}
 */
export function getAllowedImageRemotePatterns(env = process.env) {
  const patterns = [];
  const seenKeys = new Set();

  function addPattern(protocol, hostname, port = "", pathname = "/**") {
    const cleanHost = hostname ? hostname.trim().toLowerCase() : "";
    if (!cleanHost) return;

    const key = `${protocol}://${cleanHost}:${port}${pathname}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);

    const rule = { protocol, hostname: cleanHost, pathname };
    if (port) rule.port = port;
    patterns.push(rule);
  }

  // 1. Local development hostnames
  addPattern("http", "localhost", "5000");
  addPattern("http", "127.0.0.1", "5000");
  addPattern("http", "localhost", "3000");
  addPattern("http", "127.0.0.1", "3000");

  // 2. Configured public CDN
  const cdnUrl = env.NEXT_PUBLIC_CDN_URL || env.CDN_URL;
  if (cdnUrl) {
    try {
      const parsed = new URL(cdnUrl);
      if (!isPrivateOrInternalHost(parsed.hostname)) {
        addPattern(parsed.protocol.replace(":", ""), parsed.hostname, parsed.port || "");
      }
    } catch {}
  }

  // 3. Configured S3 / Cloudflare R2 Public Base URL
  const s3PublicUrl = env.S3_PUBLIC_BASE_URL;
  if (s3PublicUrl) {
    try {
      const parsed = new URL(s3PublicUrl);
      if (!isPrivateOrInternalHost(parsed.hostname)) {
        addPattern(parsed.protocol.replace(":", ""), parsed.hostname, parsed.port || "");
      }
    } catch {}
  }

  // 4. AWS S3 standard patterns
  addPattern("https", "*.amazonaws.com");
  addPattern("https", "s3.amazonaws.com");

  // 5. Cloudflare R2 standard patterns
  addPattern("https", "*.r2.cloudflarestorage.com");
  addPattern("https", "*.r2.dev");

  // 6. Custom extra hosts from ALLOWED_IMAGE_HOSTS or NEXT_PUBLIC_ALLOWED_IMAGE_HOSTS
  const customHosts = (env.ALLOWED_IMAGE_HOSTS || env.NEXT_PUBLIC_ALLOWED_IMAGE_HOSTS || "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

  for (const host of customHosts) {
    if (!isPrivateOrInternalHost(host)) {
      addPattern("https", host);
    }
  }

  return patterns;
}
