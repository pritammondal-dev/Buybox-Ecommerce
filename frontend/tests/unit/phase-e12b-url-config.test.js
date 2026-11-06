import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  validateAndSanitizeUrl,
  getBackendBaseUrl,
  getApiBaseUrl,
  getCdnBaseUrl,
  resolveMediaUrl,
  isPrivateOrInternalHost,
  getAllowedImageRemotePatterns,
} from "../../src/lib/config/api-config.js";
import { apiClient, API_BASE_URL } from "../../src/lib/api/axios.js";
import { adminApiClient, API_BASE_URL as ADMIN_API_BASE_URL } from "../../src/lib/api/admin-axios.js";
import productService from "../../src/services/product.service.js";

describe("PHASE E12B: Environment-Aware API & Media URL Configuration", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env to clean state
    delete process.env.INTERNAL_API_URL;
    delete process.env.NEXT_PUBLIC_BACKEND_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_CDN_URL;
    delete process.env.CDN_URL;
    delete process.env.S3_PUBLIC_BASE_URL;
    delete process.env.ALLOWED_IMAGE_HOSTS;
    delete process.env.NEXT_PUBLIC_ALLOWED_IMAGE_HOSTS;
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  // ============================================================================
  // 1. Local-Development URL Defaults
  // ============================================================================
  describe("1. Local-development URL defaults", () => {
    test("getBackendBaseUrl() defaults to http://localhost:5000 in non-production", () => {
      process.env.NODE_ENV = "development";
      const backend = getBackendBaseUrl();
      assert.equal(backend, "http://localhost:5000");
    });

    test("getApiBaseUrl() defaults to http://localhost:5000/api/v1 on server in non-production", () => {
      process.env.NODE_ENV = "development";
      const apiUrl = getApiBaseUrl();
      assert.equal(apiUrl, "http://localhost:5000/api/v1");
    });

    test("getCdnBaseUrl() returns empty string when no CDN is configured", () => {
      assert.equal(getCdnBaseUrl(), "");
    });
  });

  // ============================================================================
  // 2. Production Configuration Validation
  // ============================================================================
  describe("2. Production configuration validation", () => {
    test("throws descriptive error in production if no backend URL is configured", () => {
      process.env.NODE_ENV = "production";
      assert.throws(
        () => getBackendBaseUrl(),
        /Production environment error: Missing required backend URL/
      );
    });

    test("throws descriptive error in production if getApiBaseUrl() is called on server without config", () => {
      process.env.NODE_ENV = "production";
      assert.throws(
        () => getApiBaseUrl(),
        /Production environment error: Missing backend API configuration/
      );
    });

    test("succeeds in production when INTERNAL_API_URL is supplied", () => {
      process.env.NODE_ENV = "production";
      process.env.INTERNAL_API_URL = "http://backend-service:5000";
      assert.equal(getBackendBaseUrl(), "http://backend-service:5000");
      assert.equal(getApiBaseUrl(), "http://backend-service:5000/api/v1");
    });

    test("succeeds in production when NEXT_PUBLIC_BACKEND_URL is supplied", () => {
      process.env.NODE_ENV = "production";
      process.env.NEXT_PUBLIC_BACKEND_URL = "https://api.buybox.com";
      assert.equal(getBackendBaseUrl(), "https://api.buybox.com");
      assert.equal(getApiBaseUrl(), "https://api.buybox.com/api/v1");
    });
  });

  // ============================================================================
  // 3. Missing or Malformed Backend URL Handling
  // ============================================================================
  describe("3. Missing or malformed backend URL handling", () => {
    test("rejects empty or whitespace-only URLs", () => {
      assert.throws(() => validateAndSanitizeUrl(""), /URL string is required/);
      assert.throws(() => validateAndSanitizeUrl("   "), /URL string cannot be empty/);
      assert.throws(() => validateAndSanitizeUrl(null), /URL string is required/);
    });

    test("rejects malformed URLs without valid protocol", () => {
      assert.throws(() => validateAndSanitizeUrl("not-a-valid-url"), /Malformed/);
      assert.throws(() => validateAndSanitizeUrl("ftp://api.buybox.com"), /Insecure protocol/);
      assert.throws(() => validateAndSanitizeUrl("javascript:alert(1)"), /Insecure protocol/);
    });

    test("rejects URLs containing embedded credentials (security violation)", () => {
      assert.throws(
        () => validateAndSanitizeUrl("https://admin:secret123@api.buybox.com"),
        /Security Violation: URL must not contain embedded credentials/
      );
    });

    test("sanitizes valid URLs by removing trailing slashes", () => {
      assert.equal(validateAndSanitizeUrl("https://api.buybox.com/"), "https://api.buybox.com");
      assert.equal(validateAndSanitizeUrl("http://localhost:5000///"), "http://localhost:5000");
    });
  });

  // ============================================================================
  // 4. Rewrites Without Hardcoded Localhost in Production
  // ============================================================================
  describe("4. Rewrites without hardcoded localhost in production configuration", () => {
    test("next.config.mjs parameterizes rewrites with backend origin", async () => {
      const configPath = path.resolve(process.cwd(), "next.config.mjs");
      const nextConfigContent = fs.readFileSync(configPath, "utf-8");

      // Verify next.config.mjs inspects INTERNAL_API_URL and NEXT_PUBLIC_BACKEND_URL
      assert.ok(nextConfigContent.includes("INTERNAL_API_URL"));
      assert.ok(nextConfigContent.includes("NEXT_PUBLIC_BACKEND_URL"));
      assert.ok(nextConfigContent.includes("backendOrigin"));

      // Verify dynamic destination interpolation
      assert.ok(nextConfigContent.includes("destination: `${backendOrigin}/api/:path*`"));
    });

    test("next.config.mjs preserves literal http://localhost:5000 fallback for backward compatibility", async () => {
      const configPath = path.resolve(process.cwd(), "next.config.mjs");
      const nextConfigContent = fs.readFileSync(configPath, "utf-8");

      // Verifies exact string required by legacy static test assertions (e.g. phase-e4a)
      assert.ok(nextConfigContent.includes('"http://localhost:5000/uploads/:path*"'));
    });
  });

  // ============================================================================
  // 5. Correct /api Path Construction Without Duplication
  // ============================================================================
  describe("5. Correct /api path construction without duplication", () => {
    test("does not duplicate /api/v1 when input already has /api/v1", () => {
      process.env.INTERNAL_API_URL = "https://api.buybox.com/api/v1";
      assert.equal(getApiBaseUrl(), "https://api.buybox.com/api/v1");
      assert.equal(getBackendBaseUrl(), "https://api.buybox.com");
    });

    test("does not duplicate /api when input has /api", () => {
      process.env.INTERNAL_API_URL = "https://api.buybox.com/api";
      assert.equal(getBackendBaseUrl(), "https://api.buybox.com");
    });

    test("handles multiple trailing slashes before appending /api/v1", () => {
      process.env.INTERNAL_API_URL = "http://backend-server:5000///";
      assert.equal(getApiBaseUrl(), "http://backend-server:5000/api/v1");
    });
  });

  // ============================================================================
  // 6. Local /uploads Compatibility
  // ============================================================================
  describe("6. Local /uploads compatibility", () => {
    test("resolveMediaUrl preserves local /uploads path when no CDN is configured", () => {
      const localPath = "/uploads/products/sample-item.jpg";
      assert.equal(resolveMediaUrl(localPath), localPath);
    });

    test("resolveMediaUrl preserves root relative or empty inputs gracefully", () => {
      assert.equal(resolveMediaUrl(""), "");
      assert.equal(resolveMediaUrl(null), "");
      assert.equal(resolveMediaUrl(undefined), "");
    });
  });

  // ============================================================================
  // 7. Configured CDN URL Resolution
  // ============================================================================
  describe("7. Configured CDN URL resolution", () => {
    test("resolveMediaUrl prepends NEXT_PUBLIC_CDN_URL to /uploads paths", () => {
      process.env.NEXT_PUBLIC_CDN_URL = "https://cdn.buybox.com";
      const localPath = "/uploads/banners/summer-sale.webp";
      assert.equal(resolveMediaUrl(localPath), "https://cdn.buybox.com/uploads/banners/summer-sale.webp");
    });

    test("resolveMediaUrl handles CDN URL with trailing slash cleanly", () => {
      process.env.NEXT_PUBLIC_CDN_URL = "https://cdn.buybox.com///";
      const localPath = "/uploads/categories/tech.png";
      assert.equal(resolveMediaUrl(localPath), "https://cdn.buybox.com/uploads/categories/tech.png");
    });

    test("resolveMediaUrl does not alter already-absolute HTTP/HTTPS URLs", () => {
      process.env.NEXT_PUBLIC_CDN_URL = "https://cdn.buybox.com";
      const s3Url = "https://buybox-media.s3.ap-south-1.amazonaws.com/uploads/product.jpg";
      assert.equal(resolveMediaUrl(s3Url), s3Url);
    });
  });

  // ============================================================================
  // 8. Approved and Rejected Remote Image Hosts
  // ============================================================================
  describe("8. Approved and rejected remote image hosts", () => {
    test("identifies disallowed private IP ranges and cloud metadata hostnames", () => {
      assert.equal(isPrivateOrInternalHost("169.254.169.254"), true);
      assert.equal(isPrivateOrInternalHost("metadata.google.internal"), true);
      assert.equal(isPrivateOrInternalHost("10.0.0.1"), true);
      assert.equal(isPrivateOrInternalHost("192.168.1.100"), true);
      assert.equal(isPrivateOrInternalHost("172.16.0.5"), true);
      assert.equal(isPrivateOrInternalHost("172.31.255.255"), true);

      // Public / valid hosts must not be marked private
      assert.equal(isPrivateOrInternalHost("cdn.buybox.com"), false);
      assert.equal(isPrivateOrInternalHost("s3.amazonaws.com"), false);
      assert.equal(isPrivateOrInternalHost("images.unsplash.com"), false);
    });

    test("getAllowedImageRemotePatterns builds authorized patterns for local, AWS S3, R2, and CDN", () => {
      process.env.NEXT_PUBLIC_CDN_URL = "https://cdn.buybox.com";
      process.env.ALLOWED_IMAGE_HOSTS = "assets.partner.com, cdn.partner.org";

      const patterns = getAllowedImageRemotePatterns(process.env);

      // Localhost rules
      assert.ok(patterns.some((p) => p.hostname === "localhost" && p.port === "5000"));
      assert.ok(patterns.some((p) => p.hostname === "localhost" && p.port === "3000"));

      // Standard Cloud Object Storage rules
      assert.ok(patterns.some((p) => p.hostname === "*.amazonaws.com"));
      assert.ok(patterns.some((p) => p.hostname === "s3.amazonaws.com"));
      assert.ok(patterns.some((p) => p.hostname === "*.r2.cloudflarestorage.com"));

      // Configured CDN & extra hosts
      assert.ok(patterns.some((p) => p.hostname === "cdn.buybox.com" && p.protocol === "https"));
      assert.ok(patterns.some((p) => p.hostname === "assets.partner.com"));
      assert.ok(patterns.some((p) => p.hostname === "cdn.partner.org"));
    });

    test("getAllowedImageRemotePatterns excludes private/metadata IPs even if set in ALLOWED_IMAGE_HOSTS", () => {
      process.env.ALLOWED_IMAGE_HOSTS = "169.254.169.254, 10.0.1.5, valid-cdn.com";
      const patterns = getAllowedImageRemotePatterns(process.env);

      assert.ok(!patterns.some((p) => p.hostname === "169.254.169.254"));
      assert.ok(!patterns.some((p) => p.hostname === "10.0.1.5"));
      assert.ok(patterns.some((p) => p.hostname === "valid-cdn.com"));
    });
  });

  // ============================================================================
  // 9. SSR/Client URL Consistency
  // ============================================================================
  describe("9. SSR/client URL consistency", () => {
    test("client-side getApiBaseUrl() returns relative /api/v1 for Next.js rewrite proxying", () => {
      // Mock window object
      global.window = {};
      try {
        const clientUrl = getApiBaseUrl();
        assert.equal(clientUrl, "/api/v1");
      } finally {
        delete global.window;
      }
    });

    test("server-side getApiBaseUrl() returns absolute origin with /api/v1", () => {
      process.env.INTERNAL_API_URL = "http://internal-api:5000";
      assert.equal(typeof window, "undefined");
      const serverUrl = getApiBaseUrl();
      assert.equal(serverUrl, "http://internal-api:5000/api/v1");
    });
  });

  // ============================================================================
  // 10. Authentication and Credential Preservation
  // ============================================================================
  describe("10. Authentication and credential preservation", () => {
    test("apiClient retains withCredentials=true and JSON headers", () => {
      assert.equal(apiClient.defaults.withCredentials, true);
      assert.equal(apiClient.defaults.headers["Content-Type"], "application/json");
      assert.equal(apiClient.defaults.headers["Accept"], "application/json");
      assert.ok(API_BASE_URL.includes("/api/v1"));
    });

    test("adminApiClient retains withCredentials=true and JSON headers", () => {
      assert.equal(adminApiClient.defaults.withCredentials, true);
      assert.equal(adminApiClient.defaults.headers["Content-Type"], "application/json");
      assert.equal(adminApiClient.defaults.headers["Accept"], "application/json");
      assert.ok(ADMIN_API_BASE_URL.includes("/api/v1"));
    });
  });

  // ============================================================================
  // 11. Public Media vs Protected Digital Downloads
  // ============================================================================
  describe("11. Public media versus protected digital downloads", () => {
    test("public media paths are routed to CDN or relative static paths without credentials", () => {
      process.env.NEXT_PUBLIC_CDN_URL = "https://cdn.buybox.com";
      const publicBannerUrl = resolveMediaUrl("/uploads/banners/hero.webp");
      assert.equal(publicBannerUrl, "https://cdn.buybox.com/uploads/banners/hero.webp");
    });

    test("protected digital downloads call backend entitlement API endpoint with blob responseType", async () => {
      // Verify downloadDigitalAsset method signature in productService
      assert.equal(typeof productService.downloadDigitalAsset, "function");

      // Verify it does not construct a raw CDN/uploads URL, but invokes apiClient with /digital-downloads/:id
      const downloadFnString = productService.downloadDigitalAsset.toString();
      assert.ok(downloadFnString.includes("/digital-downloads/"));
      assert.ok(downloadFnString.includes('responseType: "blob"'));
    });
  });

  // ============================================================================
  // 12. Campaign Banners, CMS Images, Logos, and Product Images
  // ============================================================================
  describe("12. Campaign banners, CMS event images, store logos, and product images", () => {
    test("resolveMediaUrl safely handles campaign banner and CMS image paths", () => {
      process.env.NEXT_PUBLIC_CDN_URL = "https://cdn.buybox.com";

      const campaignBanner = "/uploads/campaigns/diwali-banner-2026.png";
      const cmsEventImage = "/uploads/cms/black-friday-event.jpg";
      const storeLogo = "/uploads/branding/logo.svg";
      const productPrimary = "/uploads/products/sony-wh1000xm5.webp";
      const variantImage = "/uploads/variants/midnight-blue.webp";

      assert.equal(resolveMediaUrl(campaignBanner), "https://cdn.buybox.com/uploads/campaigns/diwali-banner-2026.png");
      assert.equal(resolveMediaUrl(cmsEventImage), "https://cdn.buybox.com/uploads/cms/black-friday-event.jpg");
      assert.equal(resolveMediaUrl(storeLogo), "https://cdn.buybox.com/uploads/branding/logo.svg");
      assert.equal(resolveMediaUrl(productPrimary), "https://cdn.buybox.com/uploads/products/sony-wh1000xm5.webp");
      assert.equal(resolveMediaUrl(variantImage), "https://cdn.buybox.com/uploads/variants/midnight-blue.webp");
    });

    test("resolveMediaUrl preserves external HTTPS media for third-party hosted assets", () => {
      const externalUnsplash = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e";
      assert.equal(resolveMediaUrl(externalUnsplash), externalUnsplash);
    });
  });
});
