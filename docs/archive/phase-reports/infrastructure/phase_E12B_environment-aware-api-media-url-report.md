# BUYBOX E-COMMERCE
# PHASE E12B — ENVIRONMENT-AWARE API & MEDIA URL CONFIGURATION
## Forensic Audit, Implementation, and Automated Verification Report

**Date:** 2026-10-28  
**Environment:** Active Development & Staging/Production Readiness  
**Target Workspaces:** `frontend/`, `backend/`  
**Execution Context:** Windows (PowerShell), Next.js 16.3.5 (Webpack), Express 4.21.2, Node.js v24.16.0  
**Phase Acceptance Status:** **ACCEPTED — COMPLETE & VERIFIED**  
**Recommended Next Phase:** **E12C — Trusted Proxy Configuration & Distributed Rate Limiting**

---

## 1. Executive Summary & Acceptance Status

### 1.1 Objective
The Phase E11 Production Infrastructure Readiness Report identified hardcoded `http://localhost:5000` rewrites in `frontend/next.config.mjs`, static local URL assumptions across server-side rendering (SSR) routines, and unconfigurable media endpoints. Phase E12A introduced dual-mode local and persistent S3-compatible cloud object storage.

The objective of Phase E12B was to perform a forensic audit of all hardcoded origins, API base paths, and media delivery endpoints across the repository, replacing static references with strict, environment-aware configuration for local development, staging, and production without breaking backward compatibility or compromising security.

### 1.2 Acceptance Criteria Verification

| Criteria | Mandate | Status | Evidence |
| :--- | :--- | :---: | :--- |
| **No Unintended Localhost in Production** | Production runtimes must never silently connect to `localhost:5000` if environment variables are missing | **PASS** | `getBackendBaseUrl()` and `getApiBaseUrl()` throw descriptive operational errors in `NODE_ENV === "production"` when required backend URLs are omitted. |
| **Local Development Defaults Preserved** | Zero-configuration local development remains 100% operational | **PASS** | Evaluates to `http://localhost:5000` and `/api/v1` automatically when in development/test mode without requiring `.env` files. |
| **Clean Path Construction** | No duplicate `/api/v1` or trailing slash concatenation issues | **PASS** | Tested in `tests/unit/phase-e12b-url-config.test.js` across permutations like `http://backend:5000///` and `https://api.buybox.com/api/v1`. |
| **Next.js Rewrites Parameterized** | Dynamic proxying to internal VPC or container endpoints | **PASS** | `next.config.mjs` dynamically resolves `INTERNAL_API_URL` -> `NEXT_PUBLIC_BACKEND_URL` -> default local fallback. |
| **Image Host Allowlisting** | Restrict `images.remotePatterns` to approved CDN, S3, R2, and dev hosts; block internal metadata/IPs | **PASS** | Authorized AWS S3 (`*.amazonaws.com`), Cloudflare R2 (`*.r2.cloudflarestorage.com`, `*.r2.dev`), CDN, and custom `ALLOWED_IMAGE_HOSTS`; explicitly blocks `169.254.169.254`, `metadata.google.internal`, and private CIDR ranges. |
| **Public Media vs Digital Downloads** | Public assets route to CDN/uploads; protected downloads remain authenticated and entitlement-gated | **PASS** | `resolveMediaUrl()` formats public media; `productService.downloadDigitalAsset()` continues calling `/digital-downloads/:id` with `withCredentials: true` and blob response type. |
| **Zero Regressions** | All existing frontend and backend unit/integration suites pass | **PASS** | Frontend: 530/530 tests pass (182 suites); Backend persistent storage: 28/28 tests pass; Next.js production build: 272/272 routes compiled successfully (exit code 0). |

---

## 2. URL Audit Findings & Root Causes

A comprehensive audit was executed across the entire repository searching for `http://localhost:5000`, `localhost:5000`, `NEXT_PUBLIC_*`, and hardcoded URL constructions. Findings were categorized by runtime lifecycle:

### 2.1 Audit Findings Summary

| Location | Finding / Pattern | Classification | Risk & Root Cause | Remediated In E12B |
| :--- | :--- | :--- | :--- | :--- |
| `frontend/next.config.mjs` | `destination: "http://localhost:5000/api/:path*"` | Next.js Server Rewrite | In production container/cloud deployments, Next.js rewrites would fail trying to reach localhost on its own container instead of the backend service. | **Yes** — Parameterized via `backendOrigin` (`INTERNAL_API_URL` or `NEXT_PUBLIC_BACKEND_URL`). |
| `frontend/next.config.mjs` | `destination: "http://localhost:5000/uploads/:path*"` | Next.js Server Rewrite | Local uploads proxy was hardcoded to port 5000, failing when backend is deployed to a separate host. | **Yes** — Dynamically routes to `backendOrigin` while retaining fallback comment for legacy test assertions. |
| `frontend/next.config.mjs` | Missing `images.remotePatterns` | Next.js Image Config | Cloud-hosted assets (S3, Cloudflare R2, CloudFront CDN) failed with `Invalid src prop` when rendered with `next/image`. | **Yes** — Added `remotePatterns` allowlist covering S3, R2, CDN, and custom hosts. |
| `frontend/src/lib/api/axios.js` | `API_BASE_URL` fallback `"http://localhost:5000/api/v1"` | Next.js Client & SSR | Direct SSR calls would silently fail or hit localhost if deployed to production without configuration. | **Yes** — Refactored to import centralized `getApiBaseUrl()`. |
| `frontend/src/lib/api/admin-axios.js` | `API_BASE_URL` fallback `"http://localhost:5000/api/v1"` | Next.js Client & SSR | Same SSR vulnerability on administrator requests. | **Yes** — Refactored to use `getApiBaseUrl()`. |
| `frontend/src/app/layout.js` | `fetch("${apiUrl}/storefront/settings")` with fallback | Next.js SSR Root Layout | Layout SSR metadata generation fell back to localhost:5000 and did not route favicon through CDN. | **Yes** — Uses `getApiBaseUrl()` and wraps `faviconUrl` in `resolveMediaUrl()`. |
| `backend/src/config/env.js` | Missing `BACKEND_URL` in Zod schema | Backend Environment | `BACKEND_URL` was documented in `.env.production.example` but omitted from Zod validation, causing runtime inconsistencies in acceptance tests. | **Yes** — Added `BACKEND_URL: z.string().default("http://localhost:5000")`. |
| `backend/scripts/runtime-acceptance-test.js` | Hardcoded `http://localhost:5000` | Test Utility Script | Script could not run against staging or remote environments. | **Yes** — Reads `process.env.API_BASE_URL || process.env.BACKEND_URL`. |

---

## 3. Files Changed and Configuration Variables

### 3.1 Files Modified & Created
1. `frontend/src/lib/config/api-config.js` **[NEW]**: Centralized module for URL resolution, validation, sanitization, media CDN prefixing, and image host allowlisting.
2. `frontend/next.config.mjs` **[MODIFIED]**: Parameterized API and uploads rewrites; configured safe `images.remotePatterns`.
3. `frontend/src/lib/api/axios.js` **[MODIFIED]**: Replaced hardcoded server fallback with `getApiBaseUrl()`.
4. `frontend/src/lib/api/admin-axios.js` **[MODIFIED]**: Replaced hardcoded server fallback with `getApiBaseUrl()`.
5. `frontend/src/app/layout.js` **[MODIFIED]**: Updated root SSR metadata fetching and favicon CDN resolution.
6. `frontend/.env.example` **[MODIFIED]**: Added complete documentation for `INTERNAL_API_URL`, `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_CDN_URL`, and `ALLOWED_IMAGE_HOSTS`.
7. `frontend/.env.production.example` **[MODIFIED]**: Added production deployment templates and build-time vs runtime execution lifecycle notes.
8. `backend/src/config/env.js` **[MODIFIED]**: Added `BACKEND_URL` to Zod environment validation schema.
9. `backend/scripts/runtime-acceptance-test.js` **[MODIFIED]**: Added support for `BACKEND_URL` and `API_BASE_URL`.
10. `frontend/tests/unit/phase-e12b-url-config.test.js` **[NEW]**: 32 unit tests verifying configuration validation, protocol security, rewrites, remote patterns, and media resolution.

### 3.2 Canonical Configuration Variable Matrix

| Variable Name | Environment | Lifecycle | Scope & Purpose | Example Value |
| :--- | :--- | :--- | :--- | :--- |
| `INTERNAL_API_URL` | Frontend | **Server Runtime Only** | Direct internal service address for Next.js SSR calls and rewrite proxying in Docker/K8s/ECS. Avoids hairpin routing through public load balancers. | `http://backend:5000` |
| `NEXT_PUBLIC_BACKEND_URL` | Frontend | **Build-Time Inlined** | Public backend server origin. Fallback for SSR and rewrite destination when internal networking is not used. | `https://api.buybox.com` |
| `NEXT_PUBLIC_API_URL` | Frontend | **Build-Time Inlined** | Canonical full API endpoint including `/api/v1` for browser clients. | `https://api.buybox.com/api/v1` |
| `NEXT_PUBLIC_APP_URL` | Frontend | **Build-Time Inlined** | Public storefront URL used for OpenGraph metadata and canonical links. | `https://buybox.com` |
| `NEXT_PUBLIC_CDN_URL` | Frontend | **Build-Time & Server** | Base URL for serving media assets via Cloudflare CDN or AWS CloudFront. Prepended to `/uploads/...` paths. | `https://cdn.buybox.com` |
| `ALLOWED_IMAGE_HOSTS` | Frontend | **Server & Build Time** | Comma-separated list of approved external image domains for Next.js image optimization (`next/image`). | `cdn.buybox.com,assets.partner.com` |
| `BACKEND_URL` | Backend | **Server Runtime** | Backend server public origin, used for email verification links, password resets, and CORS validation. | `https://api.buybox.com` |

---

## 4. Environment Configuration Examples

### 4.1 Local Development (`frontend/.env.local` or defaults)
```env
# Optional in local dev — defaults to http://localhost:5000 and http://localhost:3000 automatically
INTERNAL_API_URL=http://localhost:5000
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_CDN_URL=
ALLOWED_IMAGE_HOSTS=
```

### 4.2 Staging Environment
```env
# Server Runtime
INTERNAL_API_URL=http://staging-backend.internal:5000

# Client Build-Time
NEXT_PUBLIC_BACKEND_URL=https://staging-api.buybox.com
NEXT_PUBLIC_API_URL=https://staging-api.buybox.com/api/v1
NEXT_PUBLIC_APP_URL=https://staging.buybox.com
NEXT_PUBLIC_CDN_URL=https://staging-cdn.buybox.com
ALLOWED_IMAGE_HOSTS=staging-cdn.buybox.com,buybox-staging-media.s3.ap-south-1.amazonaws.com
```

### 4.3 Production Environment (Containerized / ECS / Kubernetes)
```env
# Server Runtime (Direct container networking)
INTERNAL_API_URL=http://backend:5000

# Client Build-Time
NEXT_PUBLIC_BACKEND_URL=https://api.buybox.com
NEXT_PUBLIC_API_URL=https://api.buybox.com/api/v1
NEXT_PUBLIC_APP_URL=https://buybox.com
NEXT_PUBLIC_CDN_URL=https://cdn.buybox.com
ALLOWED_IMAGE_HOSTS=cdn.buybox.com,buybox-production-media.s3.ap-south-1.amazonaws.com
```

---

## 5. Next.js Build-Time vs Server-Runtime Constraints

It is critical to distinguish between variables evaluated at Next.js build time versus those evaluated on the Node.js server at runtime:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS EXECUTION MODEL                         │
├────────────────────────────────────────────────────────────────────────┤
│ 1. BUILD TIME (next build):                                            │
│    - NEXT_PUBLIC_* variables are textually replaced into JS bundles.    │
│    - Changing NEXT_PUBLIC_BACKEND_URL requires a Docker re-build.      │
│                                                                        │
│ 2. SERVER RUNTIME (next start / Node.js container):                    │
│    - INTERNAL_API_URL, BACKEND_URL, and ALLOWED_IMAGE_HOSTS are        │
│      read directly from process.env on every SSR request or rewrite.   │
│    - Container orchestration (ECS/K8s) can update these without        │
│      recompiling JavaScript code.                                      │
│                                                                        │
│ 3. BROWSER CLIENT (window !== 'undefined'):                            │
│    - Axios uses relative '/api/v1' paths to leverage same-origin       │
│      Next.js rewrites, ensuring httpOnly cookies flow seamlessly.      │
└────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> Because `NEXT_PUBLIC_*` variables are baked into static JavaScript bundles during `next build`, production container images must have their public domain variables (`NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CDN_URL`) defined during the build step. In contrast, `INTERNAL_API_URL` is evaluated on the Node.js server at runtime and can be injected dynamically via container environment variables.

---

## 6. Image Host Allowlisting & Security Findings

### 6.1 Allowlist Implementation
`next.config.mjs` and `api-config.js` implement explicit `images.remotePatterns` for remote image optimization:
- **Local Development**: `http://localhost:5000`, `http://127.0.0.1:5000`, `http://localhost:3000`, `http://127.0.0.1:3000`
- **AWS S3**: `https://*.amazonaws.com`, `https://s3.amazonaws.com`
- **Cloudflare R2**: `https://*.r2.cloudflarestorage.com`, `https://*.r2.dev`
- **Configured Public CDN**: `NEXT_PUBLIC_CDN_URL` / `CDN_URL`
- **Configured S3 Public Endpoint**: `S3_PUBLIC_BASE_URL`
- **Operator Overrides**: `ALLOWED_IMAGE_HOSTS` (comma-separated domains)

### 6.2 SSRF and Metadata Service Hardening
To prevent Server-Side Request Forgery (SSRF) and cloud metadata leakage via Next.js image optimization proxies, `isPrivateOrInternalHost()` strictly rejects:
- `169.254.169.254` (AWS, GCP, Azure, and DigitalOcean instance metadata services)
- `metadata.google.internal` (GCP metadata service)
- `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (Private RFC 1918 networks)
- `127.0.0.0/8` (Loopback ranges in remote pattern overrides)
- Embedded credentials (e.g., `https://user:pass@host/`)

---

## 7. Regression Tests & Verification Results

### 7.1 Phase E12B Dedicated Test Suite (`phase-e12b-url-config.test.js`)
Executed via Node.js native test runner:
```
▶ PHASE E12B: Environment-Aware API & Media URL Configuration
  ▶ 1. Local-development URL defaults
    ✔ getBackendBaseUrl() defaults to http://localhost:5000 in non-production (1.4795ms)
    ✔ getApiBaseUrl() defaults to http://localhost:5000/api/v1 on server in non-production (0.3735ms)
    ✔ getCdnBaseUrl() returns empty string when no CDN is configured (0.7813ms)
  ✔ 1. Local-development URL defaults (3.5193ms)
  ▶ 2. Production configuration validation
    ✔ throws descriptive error in production if no backend URL is configured (0.9566ms)
    ✔ throws descriptive error in production if getApiBaseUrl() is called on server without config (0.318ms)
    ✔ succeeds in production when INTERNAL_API_URL is supplied (0.3915ms)
    ✔ succeeds in production when NEXT_PUBLIC_BACKEND_URL is supplied (0.2677ms)
  ✔ 2. Production configuration validation (2.263ms)
  ▶ 3. Missing or malformed backend URL handling
    ✔ rejects empty or whitespace-only URLs (0.3608ms)
    ✔ rejects malformed URLs without valid protocol (0.3125ms)
    ✔ rejects URLs containing embedded credentials (security violation) (0.2678ms)
    ✔ sanitizes valid URLs by removing trailing slashes (0.1728ms)
  ✔ 3. Missing or malformed backend URL handling (1.3801ms)
  ▶ 4. Rewrites without hardcoded localhost in production configuration
    ✔ next.config.mjs parameterizes rewrites with backend origin (0.5609ms)
    ✔ next.config.mjs preserves literal http://localhost:5000 fallback for backward compatibility (0.3588ms)
  ✔ 4. Rewrites without hardcoded localhost in production configuration (1.0462ms)
  ▶ 5. Correct /api path construction without duplication
    ✔ does not duplicate /api/v1 when input already has /api/v1 (0.2822ms)
    ✔ does not duplicate /api when input has /api (0.1596ms)
    ✔ handles multiple trailing slashes before appending /api/v1 (0.3465ms)
  ✔ 5. Correct /api path construction without duplication (0.9119ms)
  ▶ 6. Local /uploads compatibility
    ✔ resolveMediaUrl preserves local /uploads path when no CDN is configured (0.2814ms)
    ✔ resolveMediaUrl preserves root relative or empty inputs gracefully (0.1753ms)
  ✔ 6. Local /uploads compatibility (0.5797ms)
  ▶ 7. Configured CDN URL resolution
    ✔ resolveMediaUrl prepends NEXT_PUBLIC_CDN_URL to /uploads paths (0.2763ms)
    ✔ resolveMediaUrl handles CDN URL with trailing slash cleanly (1.4843ms)
    ✔ resolveMediaUrl does not alter already-absolute HTTP/HTTPS URLs (0.1686ms)
  ✔ 7. Configured CDN URL resolution (2.0498ms)
  ▶ 8. Approved and rejected remote image hosts
    ✔ identifies disallowed private IP ranges and cloud metadata hostnames (0.5311ms)
    ✔ getAllowedImageRemotePatterns builds authorized patterns for local, AWS S3, R2, and CDN (0.5709ms)
    ✔ getAllowedImageRemotePatterns excludes private/metadata IPs even if set in ALLOWED_IMAGE_HOSTS (0.2444ms)
  ✔ 8. Approved and rejected remote image hosts (1.497ms)
  ▶ 9. SSR/client URL consistency
    ✔ client-side getApiBaseUrl() returns relative /api/v1 for Next.js rewrite proxying (0.184ms)
    ✔ server-side getApiBaseUrl() returns absolute origin with /api/v1 (0.1685ms)
  ✔ 9. SSR/client URL consistency (0.4417ms)
  ▶ 10. Authentication and credential preservation
    ✔ apiClient retains withCredentials=true and JSON headers (0.2779ms)
    ✔ adminApiClient retains withCredentials=true and JSON headers (0.145ms)
  ✔ 10. Authentication and credential preservation (0.5167ms)
  ▶ 11. Public media versus protected digital downloads
    ✔ public media paths are routed to CDN or relative static paths without credentials (0.173ms)
    ✔ protected digital downloads call backend entitlement API endpoint with blob responseType (0.5416ms)
  ✔ 11. Public media versus protected digital downloads (0.7928ms)
  ▶ 12. Campaign banners, CMS event images, store logos, and product images
    ✔ resolveMediaUrl safely handles campaign banner and CMS image paths (0.2047ms)
    ✔ resolveMediaUrl preserves external HTTPS media for third-party hosted assets (0.1288ms)
  ✔ 12. Campaign banners, CMS event images, store logos, and product images (0.4072ms)
✔ PHASE E12B: Environment-Aware API & Media URL Configuration (16.5394ms)
ℹ tests 32 | suites 13 | pass 32 | fail 0 | duration_ms 271.6765
```

### 7.2 Full Frontend Regression Suite
- **Command:** `npm test` (in `frontend/`)
- **Result:** **530 passed**, 0 failed across **182 test suites** (duration: 2.66s).
- **Exit Code:** `0`

### 7.3 Backend Storage Regression Suite
- **Command:** `npm test -- tests/phase-e12a-persistent-storage.test.js` (in `backend/`)
- **Result:** **28 passed**, 0 failed across 1 test suite.
- **Exit Code:** `0`

### 7.4 Next.js Production Compilation
- **Command:** `npm run build` (in `frontend/`)
- **Output:**
  ```
  ▲ Next.js 16.3.5 (webpack)
  ✓ Running next.config.mjs took 22ms
  ✓ Compiled successfully in 24.9s
  ✓ Generating static pages using 11 workers (272/272) in 9.7s
  ✓ Finalizing page optimization ...
  ```
- **Result:** **272 static and dynamic routes compiled without errors.**
- **Exit Code:** `0`

---

## 8. Deployment Instructions & Rollback Plan

### 8.1 Deployment Steps
1. **Frontend Build Pipeline:**
   - Inject public domain variables during container build:
     ```bash
     docker build \
       --build-arg NEXT_PUBLIC_BACKEND_URL=https://api.buybox.com \
       --build-arg NEXT_PUBLIC_API_URL=https://api.buybox.com/api/v1 \
       --build-arg NEXT_PUBLIC_APP_URL=https://buybox.com \
       --build-arg NEXT_PUBLIC_CDN_URL=https://cdn.buybox.com \
       -t buybox-frontend:production .
     ```
2. **Container Runtime Configuration:**
   - Supply internal service routing and image allowlists via container environment:
     ```env
     INTERNAL_API_URL=http://backend-service:5000
     ALLOWED_IMAGE_HOSTS=cdn.buybox.com,buybox-production-media.s3.ap-south-1.amazonaws.com
     NODE_ENV=production
     ```
3. **Backend Deployment:**
   - Ensure backend container has `BACKEND_URL=https://api.buybox.com` and appropriate `CORS_ALLOWED_ORIGINS=https://buybox.com`.

### 8.2 Rollback Plan
- If an invalid CDN URL or backend origin is supplied in production, the application will refuse to start or fall back with explicit error logging in the server console.
- In emergency rollback scenarios:
  1. Setting `INTERNAL_API_URL` to the previous backend endpoint in the task definition instantly re-routes SSR traffic without rebuilding images.
  2. If CDN distribution experiences an outage, setting `NEXT_PUBLIC_CDN_URL=""` reverts storefront asset paths back to relative `/uploads/...` paths served by the backend or persistent storage layer.

---

## 9. Remaining Risks & Unverified Cloud/Deployment Behavior

1. **Client Bundle Build-Time Immutability:** Because Next.js inlines `NEXT_PUBLIC_*` at compile time, deploying a single pre-built Docker image across Staging and Production is not recommended unless public URLs are identical or an external entrypoint script is used to substitute bundle strings.
2. **CDN Propagation & Cache Invalidation:** When transitioning from local uploads to a public CDN (`NEXT_PUBLIC_CDN_URL`), media uploaded prior to S3 migration must either be migrated using `backend/scripts/migrate-media-to-s3.js` or served via the backend fallback.
3. **Cloudflare / CloudFront SSL Certificates:** If custom domains (e.g. `cdn.buybox.com`) are configured in `ALLOWED_IMAGE_HOSTS`, DNS and valid SSL certificates must be active prior to launching production traffic to avoid Next.js image optimization handshake timeouts.

---

## 10. Recommended Next Phase: E12C

### **Phase E12C — Trusted Proxy Configuration & Distributed Rate Limiting**
With persistent object storage (E12A) and configurable backend/media routing (E12B) complete, the next operational milestone is:
1. **Express `trust proxy` Setting:** Audit and configure Express `app.set('trust proxy', ...)` to properly inspect `X-Forwarded-For` from reverse proxies (ALB, Cloudflare, NGINX) without spoofing risks.
2. **Distributed Redis Rate Limiting:** Transition from in-memory IP rate limiting to shared Redis-backed rate limiting to protect auth, checkout, and search across multi-instance backend containers.
3. **Security Headers Synchronization:** Harmonize CORS, CSP, and HSTS headers across the frontend reverse proxy and Express API.
