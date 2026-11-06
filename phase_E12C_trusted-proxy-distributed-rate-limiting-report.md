# BUYBOX E-COMMERCE
# PHASE E12C — TRUSTED PROXY CONFIGURATION & DISTRIBUTED RATE LIMITING
## Forensic Audit, Implementation, and Verification Report

**Date:** 2026-10-28  
**Environment:** Active Development, Staging & Multi-Replica Production Readiness  
**Target Workspaces:** `backend/`, `frontend/`  
**Execution Context:** Windows (PowerShell), Express 5.2.1, ioredis 6.0.0, express-rate-limit 8.7.0, Node.js v24.16.0  
**Phase Acceptance Status:** **ACCEPTED — COMPLETE & VERIFIED**  
**Recommended Next Phase:** **E12D — Database Index Deployment, Backup and Recovery Readiness**

---

## 1. Executive Summary & Acceptance Status

### 1.1 Objective
The Phase E11 Infrastructure Readiness Report identified that Buybox-Ecommerce operated with in-memory rate limiting stores that did not share state across backend replicas, while Express lacked explicit `trust proxy` configuration. This created dual operational vulnerabilities:
1. **Client IP Spoofing or Proxy IP Collation**: Without explicit proxy trust, requests arriving through a reverse proxy (e.g. AWS ALB, Cloudflare, NGINX) derived their IP from the proxy socket, causing all legitimate customers behind that proxy to share a single rate-limit bucket. Conversely, if `trust proxy` were set to `true` indiscriminately, attackers could spoof `X-Forwarded-For` headers to bypass rate limits or manipulate audit logs.
2. **Local Memory Rate-Limiting Blindspots**: With multiple horizontal container replicas, an attacker could multiply their quota by the number of running instances, and container restarts reset counters to zero.

The objective of Phase E12C was to implement an explicit, environment-driven Express trusted proxy configuration and a Redis-backed distributed rate-limiting architecture with distinct endpoint policies and deliberate outage behavior.

### 1.2 Acceptance Criteria Verification

| Criteria | Mandate | Status | Evidence |
| :--- | :--- | :---: | :--- |
| **Explicit Proxy Trust** | Ingress trust must be environment-driven and validate hop count or subnets | **PASS** | `backend/src/config/proxy.js` parses integer hop counts, CIDR subnets, built-in aliases, and warns on blind `true`. Default is `false`. |
| **Anti-Spoofing Verification** | Untrusted forwarding headers must not manipulate client IP or bypass limits | **PASS** | Automated integration tests prove `trust proxy = false` ignores `X-Forwarded-For`, and hop count `1` extracts only the authenticated immediate hop. |
| **Distributed Shared State** | Rate limits must be shared across independent backend instances when Redis is up | **PASS** | `RedisRateLimitStore` uses atomic Lua scripts (`INCR` + `PEXPIRE` + `PTTL`). Validated across independently initialized store instances. |
| **Deliberate Outage Policies** | Redis outages must follow explicit, safe degradation policies without unbounded traffic | **PASS** | Sensitive endpoints (auth, OTP, registration, admin) enforce `fail-closed`; transactional paths (checkout, payment, downloads) enforce `fallback-memory`. |
| **Endpoint-Specific Budgets** | Distinct quotas for auth, OTP, refresh, checkout, payments, webhooks, and downloads | **PASS** | Configured separate rate limiters across all domain boundaries with RFC-compliant `Retry-After` headers and JSON responses. |
| **Preserved Workflows** | Zero regressions on auth, payment webhooks, checkout, digital downloads, and local dev | **PASS** | Backend test suite passes 49/49 tests (E12A: 28/28, E12C: 21/21); Frontend test suite passes 530/530 tests. |

---

## 2. Forensic Findings & Route-to-Limiter Inventory

### 2.1 Audit Findings Summary
- **Express `trust proxy`**: Previously unconfigured in `backend/src/app.js`. Express defaulted to `false`, causing all requests routed through Next.js rewrite proxies or load balancers to share the proxy socket address.
- **In-Memory Store**: Previous rate limiters in `rate-limiter.middleware.js` and `app.js` utilized the default `MemoryStore`.
- **Missing Protection on Sensitive Routes**:
  - `POST /api/v1/administrator/auth/login`: Lacked dedicated rate limiting, vulnerable to credential stuffing.
  - `POST /api/v1/auth/refresh` & `POST /api/v1/administrator/auth/refresh`: Lacked rate limiting against token rotation flooding.
  - `POST /api/v1/payments/*`: Financial transaction endpoints lacked dedicated transaction-velocity limits.
  - `POST /api/v1/payments/webhooks/*`: Webhook endpoints lacked burst caps.
  - `GET /api/v1/digital-downloads/:entitlementId`: Lacked bandwidth-exhaustion rate limiting.
  - `POST /api/v1/storefront/media/upload`: Lacked dedicated file upload limits.

### 2.2 Route-to-Limiter Policy Inventory

| Route / Boundary | Assigned Limiter | Window | Limit | Key Generator | Outage Policy | Purpose |
| :--- | :--- | :---: | :---: | :--- | :---: | :--- |
| `POST /api/v1/auth/register`<br>`POST /api/v1/vendors/register` | `authRegistrationLimiter` | 15 min | 20 req | Client IP | **Fail-Closed** | Account creation abuse & bot registration prevention |
| `POST /api/v1/auth/login*`<br>`POST /api/v1/administrator/auth/login` | `authLoginLimiter` | 15 min | 30 req | Client IP | **Fail-Closed** | Password spraying and credential stuffing defense |
| `POST /api/v1/auth/refresh`<br>`POST /api/v1/administrator/auth/refresh` | `tokenRefreshLimiter` | 15 min | 120 req | User ID / IP | **Fallback-Memory** | Token refresh loop & session polling protection |
| `POST /api/v1/auth/login/*/request`<br>`POST /api/v1/auth/forgot-password` | `otpRequestLimiter` | 15 min | 20 req | Client IP | **Fail-Closed** | SMS/email pumping and third-party API exhaustion |
| `POST /api/v1/auth/login/*/verify`<br>`POST /api/v1/auth/register/verify` | `otpVerificationLimiter` | 15 min | 30 req | Client IP | **Fail-Closed** | Automated PIN search defense |
| `POST /api/v1/auth/resend-verification` | `otpResendLimiter` | 15 min | 15 req | Client IP | **Fail-Closed** | Secondary protection over 60s cooldown |
| `PATCH /api/v1/auth/change-*` | `accountSecurityLimiter` | 15 min | 15 req | User ID / IP | **Fail-Closed** | Account takeover and unauthorized security alterations |
| `POST /api/v1/orders/quote`<br>`POST /api/v1/orders*` | `checkoutLimiter` | 15 min | 60 req | User ID / IP | **Fallback-Memory** | Inventory lockouts & quote flooding prevention |
| `POST /api/v1/payments/orders/*`<br>`POST /api/v1/payments/verify` | `paymentLimiter` | 15 min | 45 req | User ID / IP | **Fallback-Memory** | Card testing & automated payment gateway flooding |
| `POST /api/v1/payments/webhooks/*`<br>`POST /api/v1/shipping/webhooks/*` | `webhookLimiter` | 1 min | 120 req | Client IP | **Fallback-Memory** | Legitimate burst handling & webhook DDoS protection |
| `GET /api/v1/digital-downloads/:id` | `digitalDownloadLimiter` | 15 min | 30 req | User ID / IP | **Fallback-Memory** | Asset egress bandwidth protection |
| `POST /api/v1/storefront/media/upload`<br>`POST /api/v1/products/admin/import/*` | `uploadLimiter` | 15 min | 40 req | User ID / IP | **Fallback-Memory** | Storage ingest exhaustion defense |
| `POST /api/v1/staff*`<br>`POST /api/v1/job-roles*` | `adminSensitiveOpLimiter` | 5 min | 50 req | Admin ID / IP | **Fail-Closed** | Internal governance and privilege abuse prevention |
| Production API Global Fallback | `globalApiLimiter` | 15 min | 300 req | Client IP | **Fallback-Memory** | Broad volumetric scraper defense |

---

## 3. Trusted-Proxy Configuration & Deployment Assumptions

### 3.1 Proxy Trust Configuration (`backend/src/config/proxy.js`)
Configured via `TRUST_PROXY` in `backend/src/config/env.js`:
- **`false` (Default for Local Development)**: Ignores `X-Forwarded-*`. Client IP is derived from the immediate TCP socket.
- **Integer Hop Count (`1`, `2`)**:
  - `1`: Single reverse proxy hop (e.g. AWS Application Load Balancer or Cloudflare). Express trusts exactly 1 proxy hop, extracting the first untrusted IP from the right of `X-Forwarded-For`.
  - `2`: Multi-tier proxy (e.g. Cloudflare CDN -> AWS ALB -> Node.js container).
- **Subnet / CIDR Allowlist**:
  - `"loopback, 10.0.0.0/8, 172.16.0.0/12"`: Verifies that the immediate peer belongs to the trusted VPC network before evaluating `X-Forwarded-For`.
- **`true` (Restricted Guardrail)**: Logs an explicit security warning requiring strict perimeter network isolation.

### 3.2 Deployment Architecture & Header Ownership
```
   [ Client Browser ]
           │
           ▼ (Public Internet HTTPS)
   [ Cloudflare CDN / AWS ALB ] ── Adds authoritative X-Forwarded-For
           │
           ▼ (Private VPC / Container Mesh)
   [ Express Backend (TRUST_PROXY=1) ] ── Strips 1 hop, verifies real client IP
```

> [!IMPORTANT]
> When `TRUST_PROXY=1` is configured, your ingress load balancer must overwrite or correctly append to `X-Forwarded-For`. Untrusted clients must be physically blocked from bypassing the load balancer to hit backend container ports directly.

---

## 4. Redis-Backed Distributed Rate Limiting Architecture

### 4.1 RedisRateLimitStore Implementation (`backend/src/middlewares/rate-limit-redis-store.js`)
- **Atomic Lua Script**:
  ```lua
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then
    redis.call('PEXPIRE', KEYS[1], ARGV[1])
  end
  local ttl = redis.call('PTTL', KEYS[1])
  if ttl < 0 then
    redis.call('PEXPIRE', KEYS[1], ARGV[1])
    ttl = tonumber(ARGV[1])
  end
  return { current, ttl }
  ```
  Guarantees atomicity of counter increment and expiration in a single round-trip without race conditions.
- **Prefix Namespacing**: Keys are prefixed with `rl:<limiter_name>:<client_key>` (e.g. `rl:login:203.0.113.195`), completely isolated from BullMQ worker queues (`bull:*`).
- **Resource Cleanup**: Keys automatically expire based on their `windowMs` TTL, consuming minimal Redis memory.

### 4.2 Stable Identity Signal (`resolveClientKey`)
- If the request has an authenticated session (`req.user`, `req.administrator`, `req.customer`, or `req.vendor`), the rate limit key is bound to `user:<id>`.
- This prevents entire corporate offices, university campuses, or households sharing a NAT gateway from being collectively throttled when one user makes requests.
- Unauthenticated requests are keyed by the validated `req.ip`.

---

## 5. Redis Outage Policies & Operational Behavior

A critical requirement of Phase E12C was ensuring that Redis unavailability does not leave the system vulnerable or crash unrelated services:

```
                  ┌──────────────────────────────┐
                  │    Incoming HTTP Request     │
                  └──────────────┬───────────────┘
                                 │
                     Is Redis Connection Ready?
                                 │
                     ┌───────────┴───────────┐
                    YES                      NO
                     │                       │
           Execute Atomic Lua      Check Route FailPolicy
                     │                       │
             Return Shared Count    ┌────────┴────────┐
                                    │                 │
                               Fail-Closed     Fallback-Memory
                                    │                 │
                             Block Request     Increment Local
                             with HTTP 429     In-Memory Store
                             (Sensitive)       (Transactional)
```

1. **`fail-closed` (High-Security Endpoints: Login, Registration, OTP, Admin)**:
   - If Redis is unreachable, the store returns `totalHits: Infinity`, triggering the rate limit handler.
   - Blocks automated password spraying or OTP attacks during infrastructure degradation.
2. **`fallback-memory` (Business Availability Endpoints: Checkout, Payment, Catalog, Downloads)**:
   - If Redis is unreachable, the store falls back to local in-memory tracking for that container.
   - Requests are **never left unbounded**. Each container continues enforcing rate limits locally.
   - Outage warnings are throttled to log once every 10 seconds to avoid log flooding.

---

## 6. Security Headers & CORS Consistency

### 6.1 Express & Helmet Security Configuration
- `X-Content-Type-Options: nosniff` (Active on all responses).
- `Cross-Origin-Opener-Policy: same-origin-allow-popups` (Enables Google Identity Services and Razorpay modal integration without opener leakage).
- `Strict-Transport-Security` (HSTS): Enforced in production (`max-age=31536000; includeSubDomains`).
- `Content-Security-Policy`: Disabled globally on Express to avoid interfering with storefront hydration; enforced with strict sandbox restrictions (`default-src 'none'; sandbox; Content-Disposition: attachment`) on public `/uploads/*.svg` files to prevent Stored XSS.

### 6.2 CORS Validation
- Origins are validated against `CORS_ALLOWED_ORIGINS` (comma-separated list) and development localhost patterns in non-production.
- `credentials: true` allows authenticated cross-origin cookies.

---

## 7. Automated Test Suite & Actual Results

### 7.1 Phase E12C Dedicated Test Suite (`tests/phase-e12c-trusted-proxy-rate-limiting.test.js`)
Executed using Jest against active Redis:
```
PASS tests/phase-e12c-trusted-proxy-rate-limiting.test.js
  PHASE E12C — Trusted Proxy Configuration & Distributed Rate Limiting Test Suite
    1. Trusted-Proxy Parsing and Client-IP Correctness
      √ parseTrustProxySetting defaults to false when omitted or disabled (5 ms)
      √ parseTrustProxySetting parses integer hop counts (2 ms)
      √ parseTrustProxySetting throws error on negative hop counts (4 ms)
      √ parseTrustProxySetting parses CIDR subnets and built-in names (2 ms)
      √ parseTrustProxySetting handles true with warning in production (3 ms)
    2. Client-IP Derivation and Spoofing Protection
      √ when trust proxy is disabled, X-Forwarded-For is strictly ignored (111 ms)
      √ when trust proxy is 1 (single hop), derives real client IP and rejects spoofed prefix (74 ms)
      √ when trust proxy is loopback, trusts loopback peer and extracts forwarded IP (48 ms)
    3. Stable Client Identity Key Resolution
      √ keys authenticated customer by user ID to prevent collective IP lockout
      √ keys authenticated administrator by admin ID
      √ keys unauthenticated guest by validated client IP (1 ms)
    4. Distributed RedisRateLimitStore Execution
      √ increments count atomically and sets expiration time (56 ms)
      √ decrements count correctly (75 ms)
      √ resets key cleanly (68 ms)
      √ shares state across independently initialized store instances (Horizontal Scaling) (77 ms)
    5. Redis Outage Handling & Degradation Policies
      √ fail-closed policy returns infinity on Redis outage to block brute-force attacks (12 ms)
      √ fallback-memory policy enforces local in-memory caps during Redis outage
    6. HTTP 429 Response Format and Retry-After Header
      √ emits HTTP 429 with Retry-After header and structured error body (55 ms)
    7. Endpoint-Specific Rate-Limiter Inventory
      √ exports all required endpoint rate limiters with expected configurations (3 ms)
    8. Security Headers, CORS, and Express Integration
      √ Express app includes Helmet security headers and CORS (12 ms)
      √ readiness probe verifies Redis readiness (7 ms)

Test Suites: 1 passed, 1 total
Tests:       21 passed, 21 total
Snapshots:   0 total
Time:        4.563 s
```

### 7.2 Storage Regression Suite (`tests/phase-e12a-persistent-storage.test.js`)
- **Result:** **28 / 28 passed** (0 failures).

### 7.3 Frontend Regression Suite (`npm test` in `frontend/`)
- **Result:** **530 / 530 passed** across 182 test suites.

---

## 8. Files Changed & Added

1. `backend/src/config/proxy.js` **[NEW]**: Trusted proxy parser and applier supporting hop counts, CIDR lists, and fail-safe defaults.
2. `backend/src/middlewares/rate-limit-redis-store.js` **[NEW]**: Custom `express-rate-limit` v8 Store backed by `ioredis` with atomic Lua scripts and dual outage policies.
3. `backend/src/middlewares/rate-limiter.middleware.js` **[MODIFIED]**: Re-implemented with 14 endpoint-specific rate limiters and user ID key generation.
4. `backend/src/app.js` **[MODIFIED]**: Integrated `configureTrustProxy` and distributed `globalApiLimiter`.
5. `backend/src/routes/administrator-auth.routes.js` **[MODIFIED]**: Added `authLoginLimiter` and `tokenRefreshLimiter`.
6. `backend/src/routes/auth.routes.js` **[MODIFIED]**: Added `tokenRefreshLimiter` to `/refresh`.
7. `backend/src/routes/payment.routes.js` **[MODIFIED]**: Added `webhookLimiter` and `paymentLimiter`.
8. `backend/src/routes/digital-download.routes.js` **[MODIFIED]**: Added `digitalDownloadLimiter`.
9. `backend/src/routes/storefront-media.routes.js` **[MODIFIED]**: Added `uploadLimiter`.
10. `backend/src/config/env.js` **[MODIFIED]**: Added `TRUST_PROXY` to Zod schema.
11. `backend/.env.example` & `backend/.env.production.example` **[MODIFIED]**: Documented `TRUST_PROXY` options and topologies.
12. `backend/tests/phase-e12c-trusted-proxy-rate-limiting.test.js` **[NEW]**: 21 unit & integration tests.

---

## 9. Configuration Examples

### 9.1 Local Development (`backend/.env`)
```env
PORT=5000
NODE_ENV=development
TRUST_PROXY=false
REDIS_URL=redis://127.0.0.1:6379
```

### 9.2 Staging & Production (AWS ECS behind Application Load Balancer)
```env
PORT=5000
NODE_ENV=production
TRUST_PROXY=1
BACKEND_URL=https://api.buybox.com
FRONTEND_URL=https://buybox.com
CORS_ALLOWED_ORIGINS=https://buybox.com,https://www.buybox.com
REDIS_URL=rediss://default:secret@production-redis.internal:6379
```

### 9.3 Production (Cloudflare CDN -> AWS ALB -> Kubernetes Pod)
```env
PORT=5000
NODE_ENV=production
TRUST_PROXY=2
# Or specify trusted internal VPC subnets:
# TRUST_PROXY=loopback, 10.0.0.0/8, 172.16.0.0/12
```

---

## 10. Rollback Plan & Operational Alerts

1. **Rollback**: If proxy configuration causes unexpected client IP blocking, setting `TRUST_PROXY=false` reverts to direct TCP socket evaluation without requiring code modifications.
2. **Redis Outage Alerting**: Monitor logs for `[RedisRateLimitStore]` warnings. If Redis is down, alerts should fire if `Security enforcement: blocking sensitive request` logs spike, indicating that fail-closed policies are actively defending authentication endpoints.

---

## 11. Recommended Next Phase: E12D

### **Phase E12D — Database Index Deployment, Backup and Recovery Readiness**
With persistent object storage (E12A), environment-aware URL routing (E12B), and trusted proxy rate-limiting (E12C) complete, the remaining production readiness gap is:
1. **Mongoose Index Audit & Deployment**: Verify that all unique constraints and compound query indexes (orders, products, users, campaigns, cart) exist in the MongoDB cluster with background builds.
2. **Backup & Point-in-Time Recovery**: Establish automated MongoDB dump and S3 archiving procedures with automated restore verification scripts.
3. **Database Read Replicas & Connection Pooling**: Tune Mongoose `maxPoolSize`, `minPoolSize`, and socket timeouts for containerized workloads.
