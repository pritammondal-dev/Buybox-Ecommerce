# BUYBOX E-COMMERCE
# PHASE VD-06B — SHIPPING SECURITY REMEDIATION REPORT
## RAW-BODY WEBHOOK VERIFICATION, ENVIRONMENT CONFIGURATION & PROVIDER DOCUMENTATION

**Document ID:** `BUYBOX-VD06B-SHIPPING-SECURITY-REMEDIATION`  
**Phase:** VD-06B  
**Date:** November 1, 2026  
**Auditor / Engineer:** Antigravity AI Engineering Team  
**Status:** **COMPLETED & VERIFIED**  

---

## 1. EXECUTIVE SUMMARY

Phase VD-06B resolves all findings identified in the Phase VD-06A Independent Forensic Audit (`phase_VD-06A_shipping_dispatch_fulfillment_forensic_audit_report.md`). 

The primary security remediation preserves unparsed request payload bytes (`req.rawBody`) during Express ingress without disturbing standard JSON parsing for application routes. Cryptographic HMAC-SHA256 signature verification for courier webhooks (specifically Delhivery) now operates strictly on the original payload buffer. Constant-time comparison prevents timing attacks, malformed/tampered signatures are strictly rejected, and state machine mutations are blocked when signatures fail.

Additionally, environment variable documentation for courier credentials and webhook secrets was added to `backend/.env.example`, optional environment schema bindings were added to `backend/src/config/env.js`, and courier integration capability claims in `phase_VD-06_shipping_dispatch_fulfillment_implementation_report.md` were corrected to reflect verified codebase realities.

### Key Remediation Highlights
- **Raw-Body Preservation:** Scoped `verify` hook in `express.json()` captures `req.rawBody = buf` for webhook routes while maintaining regular JSON parsing.
- **Strict Cryptographic Contract:** Delhivery HMAC-SHA256 calculated against original raw bytes. Strictly rejects missing, malformed, or tampered signatures; completely eliminates silent fallback to `JSON.stringify(req.body)`.
- **Constant-Time Verification:** Shiprocket token check and Delhivery signature comparison both use `crypto.timingSafeEqual()`.
- **Environment Stubs:** Full placeholder documentation added to `backend/.env.example` without exposing real credentials.
- **Provider Transparency:** Blue Dart, DTDC, and India Post explicitly classified as Manual / Merchant Fleet workflows using `CustomCourierAdapter`.
- **Regression Verification:** 15/15 tests passing in `courier-integration.test.js`, 14/14 tests passing in `vendor-shipping-operations-vd06.test.js`, 16/16 in `vendor-order-fulfillment-vd05.test.js`, 15/15 in `superadmin-shipment-management.test.js`, 21/21 in `vendor-shipment-splitting.test.js`, 31/31 in `phase3d-fulfillment-shipment-tracking.test.js`, and 728/728 passing in the frontend unit suite.

---

## 2. ORIGINAL FINDINGS AND THEIR DISPOSITION

| Finding ID | Severity | Description | Target Disposition | Final Acceptance Status |
|:---|:---:|:---|:---|:---:|
| **SEC-VD06A-01** | **P2** | Webhook HMAC verification used re-stringified JSON (`JSON.stringify(body)`) instead of original request bytes, risking signature mismatches on production payloads with formatting differences. | Captured `req.rawBody` via body-parser verify callback; refactored `DelhiveryAdapter` and `courierService` to verify raw bytes. | **FIXED AND VERIFIED** |
| **CONF-VD06A-01** | **P3** | Shipping credentials (`DELHIVERY_API_KEY`, `SHIPROCKET_EMAIL`, etc.) and webhook secrets were missing from `backend/.env.example`. | Added comprehensive configuration section with placeholder documentation and comments in `.env.example`. | **FIXED AND VERIFIED** |
| **DOC-VD06A-01** | **P3** | Phase VD-06 report claimed 5 integrated live carrier APIs, whereas Blue Dart, DTDC, and India Post route through `CustomCourierAdapter` (manual fleet). | Revised Capability Matrix in `phase_VD-06_shipping_dispatch_fulfillment_implementation_report.md` to accurately denote manual fleet/synthetic workflows. | **FIXED AND VERIFIED** |

---

## 3. FILES MODIFIED

| File Path | Description of Changes |
|:---|:---|
| `backend/src/app.js` | Added `verify: (req, res, buf) => { if (req.originalUrl.includes("/webhooks")) req.rawBody = buf; }` to `express.json()`. |
| `backend/src/controllers/courier-webhook.controller.js` | Passed `rawBody: req.rawBody \|\| (Buffer.isBuffer(req.body) ? req.body : null)` to `courierService.handleWebhook()`. |
| `backend/src/services/courier.service.js` | Supported `rawBody` parameter, parsed Buffer body when necessary, passed raw buffer to adapter signature verification. |
| `backend/src/services/credential.service.js` | Added `clientSecret` and `webhookSecret` resolution from environment fallbacks for Delhivery and Shiprocket. |
| `backend/src/integrations/shipping/delhivery.adapter.js` | Refactored `verifyWebhookSignature` to hash `rawBody` Buffer, enforce 64-char hex format, apply constant-time comparison, and eliminate fallback to `JSON.stringify`. |
| `backend/src/integrations/shipping/shiprocket.adapter.js` | Refactored `verifyWebhookSignature` to apply constant-time comparison via `crypto.timingSafeEqual` and support `SHIPROCKET_WEBHOOK_SECRET`. |
| `backend/src/config/env.js` | Added optional `DELHIVERY_WEBHOOK_SECRET` and `SHIPROCKET_WEBHOOK_SECRET` schema entries. |
| `backend/.env.example` | Added complete documented configuration block for Delhivery and Shiprocket environment variables. |
| `backend/tests/courier-integration.test.js` | Expanded suite from 6 to 15 tests covering whitespace variations, key re-ordering, tampering, malformed headers, HTTP ingress, and invariant safety. |
| `phase_VD-06_shipping_dispatch_fulfillment_implementation_report.md` | Corrected Courier Integration Capability Matrix and operational descriptions. |

---

## 4. RAW-BODY CAPTURE IMPLEMENTATION DETAILS

### 4.1 Express Middleware Architecture
In `backend/src/app.js`:
```javascript
app.use(
  express.json({
    limit: "1mb",
    verify: (req, res, buf) => {
      // Capture exact unparsed payload bytes for webhook signature verification
      if (
        req.originalUrl &&
        (req.originalUrl.includes("/shipping/webhooks") ||
          req.originalUrl.includes("/webhooks"))
      ) {
        req.rawBody = buf;
      }
    },
  })
);
```

### 4.2 Architecture Guarantees
1. **No Duplicate Parsers:** Uses existing `express.json()` instance with standard Node.js/Express `verify` callback.
2. **Selective Buffering:** Only requests targeting webhook paths retain reference to `buf`, preventing memory retention on unrelated endpoints.
3. **Transparent JSON Parsing:** `req.body` is parsed into an object as normal. Non-webhook endpoints experience zero behavioral changes.
4. **Resilience to Express.raw:** If a request arrives pre-buffered (e.g. from `express.raw`), `courier-webhook.controller.js` seamlessly accepts `req.body` as Buffer and `courier.service.js` parses the JSON body internally.

---

## 5. PROVIDER-SPECIFIC SIGNATURE VERIFICATION CONTRACTS

### 5.1 Delhivery Logistics (`delhivery`)
- **Header:** `x-delhivery-signature` or `x-webhook-signature`.
- **Algorithm:** HMAC-SHA256 over raw payload Buffer using secret (`DELHIVERY_CLIENT_SECRET` or `DELHIVERY_WEBHOOK_SECRET`).
- **Signature Format:** 64-character hexadecimal string.
- **Normalized Comparison:** Signature is trimmed, lowercased, validated for 64-character hex length and alphanumeric hex character set, then evaluated against computed digest using `crypto.timingSafeEqual()`.
- **Strict Omission Guard:** If secret is configured and `rawBody` is absent, the adapter returns `false`. It never silently falls back to `JSON.stringify(body)`.
- **Zero-Mutation on Failure:** Throws `401 INVALID_WEBHOOK_SIGNATURE` before touching shipment records.

### 5.2 Shiprocket (`shiprocket`)
- **Header:** `x-api-key` or `x-webhook-token`.
- **Algorithm:** Constant-time token comparison against `SHIPROCKET_WEBHOOK_SECRET` or `SHIPROCKET_API_KEY`.
- **Normalized Comparison:** `crypto.timingSafeEqual(keyBuf, expBuf)` ensures timing attacks cannot leak token characters.

### 5.3 Custom / Merchant Fleet (`custom`, `bluedart`, `dtdc`, `indiapost`, `self`)
- Handled internally by `CustomCourierAdapter`.
- Webhooks represent internal dispatch events; returns `true` as documented.

---

## 6. TESTS ADDED OR UPDATED

The test suite in `backend/tests/courier-integration.test.js` was significantly expanded from 6 tests to 15 tests:

1. `generates correct tracking URLs for Delhivery and Shiprocket`
2. `verifies Delhivery webhook signature correctly with exact raw payload buffer`
3. `verifies Delhivery signature with whitespace variations when rawBody is preserved` (contrasted against `JSON.stringify` failure)
4. `verifies Delhivery signature with alternative key ordering in raw payload bytes`
5. `rejects Delhivery signature when payload has been modified`
6. `rejects Delhivery signature when header is missing, malformed, or incorrect` (tests missing, non-hex, invalid length, and wrong hash)
7. `rejects Delhivery signature when rawBody is missing without silently falling back to JSON.stringify` (Rule 11 compliance)
8. `verifies and rejects Shiprocket webhook tokens using constant-time comparison`
9. `transitions shipment from ready_to_ship -> picked_up -> in_transit`
10. `rejects illegal status transition (created directly to delivered)`
11. `enforces idempotency and catches duplicate webhook delivery`
12. `receives POST /api/v1/shipping/webhooks/shiprocket successfully`
13. `verifies HTTP POST /api/v1/shipping/webhooks/delhivery with raw JSON body and valid HMAC`
14. `rejects invalid webhook signature over HTTP without mutating shipment status`
15. `preserves standard JSON body parsing on unrelated routes`

---

## 7. EXACT TESTS EXECUTED AND OUTCOMES

| Test Suite / Command | Total Tests | Passed | Failed | Status |
|:---|:---:|:---:|:---:|:---:|
| `npm --prefix backend test -- tests/courier-integration.test.js` | 15 | 15 | 0 | **PASS** |
| `npm --prefix backend test -- tests/vendor-shipping-operations-vd06.test.js` | 14 | 14 | 0 | **PASS** |
| `npm --prefix backend test -- tests/vendor-order-fulfillment-vd05.test.js` | 16 | 16 | 0 | **PASS** |
| `npm --prefix backend test -- tests/superadmin-shipment-management.test.js` | 15 | 15 | 0 | **PASS** |
| `npm --prefix backend test -- tests/vendor-shipment-splitting.test.js` | 21 | 21 | 0 | **PASS** |
| `npm --prefix backend test -- tests/phase3d-fulfillment-shipment-tracking.test.js` | 31 | 31 | 0 | **PASS** |
| `npm --prefix frontend test -- tests/unit/vendor-shipping-vd06.test.js` | 9 | 9 | 0 | **PASS** |
| `npm --prefix frontend test` (Full frontend unit suite) | 728 | 728 | 0 | **PASS** |

---

## 8. ENVIRONMENT VARIABLE DOCUMENTATION CHANGES

Added the following configuration documentation block to `backend/.env.example`:

```bash
# ----------------------------------------------------
# Shipping, Couriers & Webhook Integration
# ----------------------------------------------------
# Delhivery Courier Integration
# DELHIVERY_API_KEY: Production or Sandbox API token (used in Authorization header: Token <key>)
# DELHIVERY_CLIENT_ID: Registered Delhivery Client ID / Account Name
# DELHIVERY_CLIENT_SECRET: Webhook signing secret used to verify X-Delhivery-Signature (HMAC-SHA256)
# DELHIVERY_WEBHOOK_SECRET: Optional alias for DELHIVERY_CLIENT_SECRET for webhook verification
DELHIVERY_API_KEY=
DELHIVERY_CLIENT_ID=
DELHIVERY_CLIENT_SECRET=
DELHIVERY_WEBHOOK_SECRET=

# Shiprocket Logistics Aggregator
# SHIPROCKET_EMAIL: Registered Shiprocket account email address (used for Bearer JWT auth)
# SHIPROCKET_PASSWORD: Registered Shiprocket account password (used for Bearer JWT auth)
# SHIPROCKET_API_KEY: Optional Shiprocket API key / webhook token
# SHIPROCKET_WEBHOOK_SECRET: Webhook verification secret checked against X-Api-Key / X-Webhook-Token header
SHIPROCKET_EMAIL=
SHIPROCKET_PASSWORD=
SHIPROCKET_API_KEY=
SHIPROCKET_WEBHOOK_SECRET=
```

All credentials default to `""` in `backend/src/config/env.js`, ensuring existing environments and tests function safely without mandatory dummy values.

---

## 9. CORRECTED COURIER CAPABILITY MATRIX

| Courier Partner | Identifier | Integration Mode | Implementation Reality | Serviceability | AWB Generation | Pickup Scheduling | Webhook Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Delhivery Logistics** | `delhivery` | **Live REST Client** | Implemented in source (`DelhiveryAdapter`); verified with mocks & test payload. Live endpoints active when credentials provided. | Live REST API (with regex fallback when unconfigured) | Automated Waybill API (`/cmu/create.json`) | Scheduled Pickup API (`/fm/request/new/`) | **HMAC-SHA256 (Raw Buffer Verified)** via `x-delhivery-signature` |
| **Shiprocket** | `shiprocket` | **Live REST Client** | Implemented in source (`ShiprocketAdapter`); verified with mocks & test payload. Live endpoints active when credentials provided. | Live Aggregator Rate Check (with regex fallback when unconfigured) | Automated Adhoc Order & AWB Assign API | Pickup Request API (`/courier/generate/pickup`) | **Constant-Time Token Verification** via `x-api-key` / `x-webhook-token` |
| **Blue Dart Express** | `bluedart` | **Manual / Merchant Fleet** | Handled via `CustomCourierAdapter`. No live TrackDart API client; operates as manual tracking & synthetic AWB workflow. | Regex 6-digit Pincode Check | Synthetic Consignment Barcode (`BLUEDART-xxx`) | Merchant Dispatch Slot | Internal Vendor Handover Milestone |
| **DTDC Courier** | `dtdc` | **Manual / Merchant Fleet** | Handled via `CustomCourierAdapter`. No live DTDC API client; operates as manual tracking & synthetic AWB workflow. | Regex 6-digit Pincode Check | Synthetic Consignment Barcode (`DTDC-xxx`) | Merchant Dispatch Slot | Internal Vendor Handover Milestone |
| **India Post (Speed Post)**| `indiapost` | **Manual / Merchant Fleet** | Handled via `CustomCourierAdapter`. No live Speed Post API client; operates as manual tracking & synthetic AWB workflow. | Regex 6-digit Pincode Check | Synthetic Consignment Barcode (`INDIAPOST-xxx`) | Merchant Dispatch Slot | Internal Vendor Handover Milestone |
| **Custom / Merchant Fleet** | `custom` / `self` | **Internal Fleet** | Handled via `CustomCourierAdapter`. Merchant-operated direct delivery or local third-party courier. | Regex 6-digit Pincode Check | Internal Tracking Number (`BUYBOX-xxx`) | Vendor Dispatch Slot | Internal Vendor Handover Milestone |

---

## 10. REGRESSION TEST RESULTS

All core operational and fulfillment invariants were re-verified following the security modifications:
- **Central Confirmation Guard:** Vendors without confirmed fulfillment cannot book shipments.
- **Tenant Isolation:** Vendors cannot access or modify shipments belonging to other vendors.
- **State Machine Integrity:** Forward-only transitions strictly enforced; direct jump to terminal states blocked.
- **Inventory Handover:** Stock deduction occurs exclusively upon `picked_up` transition; cancellation restores reservation.
- **Financial Decoupling:** Shipment state changes never mutate `VendorWallet` or generate ledger entries.
- **Unrelated Route Stability:** Standard authentication and business routes parse JSON normally.

---

## 11. BUILD RESULTS

- **Backend:** Node.js syntax & ESM/CJS interop verified with zero runtime warnings.
- **Frontend Unit Tests:** 728/728 unit tests passing across 232 test suites (0 failures).
- **Next.js Production Build:** Completed successfully with 291/291 pages generated in 12.3s (Exit Code: 0, 0 Errors).

---

## 12. REMAINING LIMITATIONS

1. **Live Carrier Credentials:** External network calls to Delhivery and Shiprocket live production APIs require active merchant accounts and production API keys. In local/development mode, fallback serviceability regex and mock responses remain operational.
2. **Third-Party Carrier Clients:** Blue Dart, DTDC, and India Post currently utilize manual tracking and merchant fleet workflows. If native API automation is desired for those carriers, dedicated SOAP/REST adapters can be introduced in a future phase.

---

## 13. ACCEPTANCE STATUS FOR EACH FINDING

| Finding ID | Title | Acceptance Status |
|:---|:---|:---:|
| **SEC-VD06A-01** | Raw-Body Cryptographic Webhook HMAC Verification | **FIXED AND VERIFIED** |
| **CONF-VD06A-01** | Missing Shipping Credentials in `.env.example` | **FIXED AND VERIFIED** |
| **DOC-VD06A-01** | Clarification of Manual Fleet vs Live Carrier Integrations | **FIXED AND VERIFIED** |

---

**Report Approved by:**  
*Lead Quality & Security Engineer — Google Deepmind Antigravity System*  
*Timestamp: 2026-11-01T13:27:00+05:30*
