# CUSTOMER-PERMANENT-DELETE-02 — Forensic Audit & Architecture Specification

**Project:** Buybox-Ecommerce  
**Repository:** `pritammondal-dev/Buybox-Ecommerce`  
**Target Branch:** `main`  
**Baseline Commit:** `e35d287d4096fb7cb767e5e012ccc86a0f926f61`  
**Date:** November 11, 2026  
**Auditor:** Antigravity Senior Software Architect & Security Governance  
**Status:** **AUDIT COMPLETE — READY FOR REVIEW (NO DESTRUCTIVE CHANGES PERFORMED)**  

---

## 1. Executive Summary & Objective

This forensic audit evaluates the customer account deletion lifecycle across the Buybox-Ecommerce platform. 

The primary business requirement (**Option A**) dictates:
> **Permanently delete the customer account and customer-owned personal profile data from MongoDB and associated storage systems upon verified customer request, while preserving historical financial, tax, and order transaction records in an anonymized state for regulatory, legal, and operational continuity.**

Currently:
1. In the customer storefront (`frontend/src/app/(storefront)/account`), there is **no customer self-service account deletion UI or API integration**. Customers cannot initiate account deletion.
2. In the superadmin panel (`backend/src/controllers/admin-customer.controller.js` on `main`), customer deletion was implemented merely as a soft-deactivation (`isActive: false`, `deletedAt: new Date()`), leaving the full `User` and `Customer` records in MongoDB with all PII accessible.
3. In Google Sign-In (`backend/src/services/auth.service.js`), when a customer document does not exist, the OAuth callback **silently auto-provisions a new customer account**. If a deleted user signs in via Google, their account is instantly re-created without warning or restriction.
4. In the authentication middleware (`backend/src/middlewares/authentication.middleware.js`), stateless JWTs do not reject deleted accounts if `dbUser` is null; instead, the middleware proceeds and allows deleted users to continue making requests until the 15-minute token expires.

This audit establishes the complete customer-data dependency inventory, defines the financial preservation and anonymization rules, and outlines the canonical `CustomerDeletionService` architecture.

---

## 2. Root Cause & Existing Implementation Analysis

### 2.1 Frontend Investigation
- **Account Settings Paths:**
  - `frontend/src/app/(storefront)/account/security/SecurityPageView.jsx`: Implements change password, change email (OTP), change mobile (OTP), and logout-all. Contains **zero** account deletion controls.
  - `frontend/src/app/(storefront)/account/profile/page.js` & `ProfilePageView.jsx`: Handles phone, birth date, gender, and marketing preferences. Contains **no** account deletion interface.
  - `frontend/src/components/storefront/account/AccountNav.jsx`: Displays 13 storefront account navigation links; none link to account deletion or deactivation.
- **Admin Customer Management:**
  - `frontend/src/app/administrator/customers/[id]/page.js`: Has an action titled `"Soft-Deactivate Customer Account"`. Displays message: `"This customer account was deactivated... Account authentication and active cart sessions have been revoked. Historical orders, payments, refunds, and addresses are preserved..."`.
- **API Client:**
  - `frontend/src/services/customer.service.js`: Only defines `getProfile()`, `createProfile()`, and `updateProfile()`. No deletion method exists.

### 2.2 Backend Investigation
- **Admin Customer Controller (`backend/src/controllers/admin-customer.controller.js` on `main`):**
  - Line 786: `deleteCustomer` executes:
    ```javascript
    user.isActive = false;
    user.deletedAt = new Date();
    await user.save();
    await Customer.updateOne({ userId: user._id }, { $set: { isActive: false, deletedAt: user.deletedAt } });
    await RefreshToken.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    await Cart.deleteMany({ customerId: user._id }).catch(() => null);
    ```
  - **Result:** Physical documents in `users` and `customers` collections remain untouched. Saved addresses, wishlists, notifications, and profile images remain untouched.
- **Customer Routes (`backend/src/routes/customer.routes.js`):**
  - Mounts `GET /me`, `POST /me`, `PATCH /me`. There is **no `DELETE` route** defined.
- **Google OAuth Service (`backend/src/services/auth.service.js`):**
  - `authenticateGoogleUser` verifies the Google ID token. If no user matches `authProviders.google.id` and no user matches `email`, it runs:
    ```javascript
    const createdUsers = await User.create([{ email, firstName, lastName, role: "customer", ... }]);
    await Customer.create([{ userId: user._id }]);
    ```
  - **Result:** A customer who was deleted is silently re-created upon clicking "Sign in with Google".
- **Authentication Middleware (`backend/src/middlewares/authentication.middleware.js`):**
  - Lines 142–167 query `User.findById(decoded.sub)`.
  - If `dbUser` is `null` (user deleted), lines 162–213 are skipped.
  - The middleware fails to return `401 USER_NOT_FOUND` or reject the request; it builds `req.user = { id: resolvedUserId, ... }` and calls `next()`.
  - **Result:** A customer whose account is physically deleted can continue using an active JWT until it expires.

---

## 3. Full Customer-Data Dependency Inventory

The repository models were forensically inspected for references to `User`, `Customer`, and customer personal data:

| Model / Collection | Reference Field(s) | Personal Data (PII) | Data Ownership | Approved Policy | Operational Risk / Handling |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`User`** (`users`) | `_id`, `email`, `phone` | Email, Phone, Password hash, First/Last Name, Google ID | Customer Identity | **DELETE** | Canonical customer identity document permanently removed via `deleteOne({ _id })`. |
| **`Customer`** (`customers`) | `_id`, `userId` | Phone, Date of Birth, Gender, Avatar URL/PublicId, Marketing preferences | Customer Profile | **DELETE** | Canonical customer profile document permanently removed via `deleteMany({ userId })`. |
| **`Address`** (`addresses`) | `userId` | Full Name, Phone, Street Address Lines 1 & 2, City, State, Postal Code | Customer-owned | **DELETE** | Address book entries belong exclusively to the customer and are purged via `deleteMany({ userId })`. |
| **`Cart`** (`carts`) | `customerId` | Active cart items, selected options | Customer-owned | **DELETE** | Shopping sessions permanently purged via `deleteMany({ customerId })`. |
| **`Wishlist`** (`wishlists`) | `customerId` | Saved product IDs, variant selections | Customer-owned | **DELETE** | Saved wishlist records purged via `deleteMany({ customerId })`. |
| **`CustomerNotification`** (`customernotifications`) | `userId`, `customerId` | In-app alerts, order notifications | Customer-owned | **DELETE** | Notification inbox purged via `deleteMany({ $or: [{ userId }, { customerId }] })`. |
| **`PaymentMethod`** (`paymentmethods`) | `customerId` | Saved tokenized payment cards/gateways | Customer-owned | **DELETE** | Saved user payment methods purged where `customerId` matches. System gateways (`customerId: null`) are preserved. |
| **`RefreshToken`** (`refreshtokens`) | `userId` | Session token, IP, User Agent | Customer Session | **DELETE** | All active and historical refresh tokens purged via `deleteMany({ userId })`. |
| **`Otp`** (`otps`) | `userId`, `email`, `phone` | OTP code, target email/phone | Transient Auth | **DELETE** | All pending and consumed OTPs purged via `deleteMany({ $or: [{ userId }, { email }] })`. |
| **`EmailVerificationToken`** (`emailverificationtokens`) | `userId` | Cryptographic token | Transient Auth | **DELETE** | Verification tokens purged via `deleteMany({ userId })`. |
| **`PasswordResetToken`** (`passwordresettokens`) | `userId` | Reset token, expiry | Transient Auth | **DELETE** | Password reset tokens purged via `deleteMany({ userId })`. |
| **`Customer Avatar Storage`** (Cloudinary / Local) | Stored in `Customer.avatar.publicId` | Personal photo | Customer Asset | **DELETE** | If `publicId` exists, trigger storage deletion API to erase asset from object storage. |
| **`Order`** (`orders`) | `customerId`, `shippingAddress`, `guestEmail` | Full Name, Phone, Shipping Address, Email | Financial / Legal | **PRESERVE & ANONYMIZE** | **MUST PRESERVE** historical financial record. Anonymize PII in `shippingAddress` and `guestEmail`. Preserve line items, totals, taxes, and vendor relations. |
| **`Payment`** (`payments`) | `orderId`, `customerId`, `gatewayOrderId`, `gatewayPaymentId` | Transaction references | Financial / Legal | **PRESERVE** | **MUST PRESERVE** for Razorpay gateway reconciliation, merchant settlement, accounting, and dispute resolution. |
| **`Refund`** (`refunds`) | `paymentId`, `orderId`, `customerId`, `gatewayRefundId` | Refund amounts, gateway reference | Financial / Legal | **PRESERVE** | **MUST PRESERVE** for financial audit, merchant accounting, and banking reconciliation. |
| **`ReturnRequest`** (`returnrequests`) | `orderId`, `customerId`, `pickupAddress`, `bankDetails` | Pickup Name/Phone/Address, Bank Account/UPI ID | Operational / Dispute | **PRESERVE & ANONYMIZE** | **MUST PRESERVE** completed return records. Redact bank details and pickup address. Active/pending returns block deletion eligibility. |
| **`Shipment`** (`shipments`) | `orderId`, `customerId`, `shippingAddress` | Courier tracking, AWB, delivery address | Operational / Logistics | **PRESERVE & ANONYMIZE** | **MUST PRESERVE** courier fulfillment record. Redact shipping address after delivery. |
| **`CreditNote`** (`creditnotes`) | `orderId`, `customerId` | Invoicing & GST credit adjustments | Financial / Legal | **PRESERVE** | **MUST PRESERVE** statutory accounting and tax documents. |
| **`DigitalEntitlement`** (`digitalentitlements`) | `orderId`, `customerId`, `userId` | License keys, download access | Entitlement / Legal | **RETAIN / DEACTIVATE** | Maintain entitlement record linked to Order. Mark access revoked (`status: "revoked"`). |
| **`CouponRedemption`** (`couponredemptions`) | `couponId`, `orderId`, `customerId` | Coupon code, discount applied | Financial / Marketing | **PRESERVE** | Preserved for aggregate campaign analytics and coupon budget accounting. |
| **`RewardAccount` / `RewardTransaction`** (`rewardaccounts`) | `userId`, `customerId` | Points balance, loyalty history | Loyalty | **DELETE / PURGE** | Loyalty points are forfeited upon deletion. Account and balance purged. |
| **`Review`** (`reviews`) | `productId`, `orderId`, `customerId` | Rating, Review title, Comment | Public / Operational | **ANONYMIZE** | Product ratings and verified purchase stats preserved to avoid disrupting merchant reputation. Disassociate customer profile. |
| **`ProductQuestion`** (`productquestions`) | `productId`, `userId`, `customerId`, `userName` | Question text, user name, answers | Public / Community | **ANONYMIZE** | Preserve questions and vendor answers. Anonymize `userName: "Deleted Customer"` and remove from `helpfulVoters`. |
| **`SupportTicket`** (`supporttickets`) | `customerId`, `orderId`, `subject` | Ticket description, messages | Operational / Dispute | **PRESERVE / CLOSE** | If tickets are open, block deletion until closed or close ticket with resolution note. Preserved for operational history. |
| **`AuditLog`** (`auditlogs`) | `actorId`, `targetId`, `beforeState`, `afterState` | Audit event details | Security Governance | **PRESERVE (NON-PII)** | Retain non-sensitive audit event: `action: "customer.account_deleted"`, with zero raw PII in metadata. |

---

## 4. Financial Record Preservation & Anonymization Architecture

### 4.1 Legal & Operational Rationale
Under applicable consumer protection, taxation (GST / Income Tax), and e-commerce regulations, commercial platforms are legally obligated to retain invoices, payments, tax breakdowns, refund histories, and order line items for 7–8 years. Deleting order documents corrupts:
- Merchant sales and revenue reports.
- Tax filings (CGST/SGST/IGST breakdown).
- Razorpay payout settlements and chargeback defense.
- Inventory movement ledgers.

### 4.2 Anonymization Rules for Retained Orders
When an account deletion is executed:
1. **`shippingAddress`:**
   - `fullName` → `"Deleted Customer"`
   - `phone` → `"0000000000"` (schema enforces `maxlength: 20`, non-empty string)
   - `addressLine1` → `"Redacted for privacy (Account Deleted)"`
   - `addressLine2` → `""`
   - `city`, `state`, `postalCode`, `country` → Retained for GST state-jurisdiction compliance.
2. **`guestEmail`:**
   - Nullified or replaced with non-reversible placeholder: `deleted-customer-<shortHash>@anonymized.buybox.internal`.
3. **`customerId`:**
   - Retained as the historical immutable reference or kept as-is. Mongoose population of deleted customer will naturally yield `null` on the joined profile, while the order itself remains completely intact.
4. **Order Line Items & Financial Totals:**
   - All `items`, `subtotal`, `taxTotal`, `taxSnapshot`, `shippingTotal`, `grandTotal`, and `paymentAttempts` remain **100% untouched**.

### 4.3 Return Requests & Bank Details Anonymization
- `pickupAddress.fullName` → `"Deleted Customer"`
- `pickupAddress.phone` → `"0000000000"`
- `pickupAddress.addressLine1` → `"Redacted"`
- `bankDetails.accountNumberMasked` → `"****"`
- `bankDetails.accountNumberEncrypted` → `null`
- `bankDetails.accountHolderName` → `"Deleted Customer"`
- `bankDetails.upiId` → `"redacted@upi"`

---

## 5. Deletion Eligibility Rules

Before an account can be deleted, the system must validate that the customer is in an eligible operational state:
1. **No In-Flight Orders:**
   - If the customer has an order where `status` is in `["pending", "confirmed", "processing", "shipped"]` or `cancellationStatus == "pending"`, deletion is **REJECTED** with HTTP 400 (`ACTIVE_ORDERS_IN_PROGRESS`). The customer must wait for delivery or cancel in-flight orders.
2. **No Active Returns or Refunds:**
   - If the customer has an active return request where `status` is in `["requested", "under_review", "approved", "pickup_scheduled", "picked_up", "received", "inspected", "refund_pending", "replacement_fulfillment", "replacement_shipped"]`, deletion is **REJECTED** with HTTP 400 (`ACTIVE_RETURNS_IN_PROGRESS`).
3. **Identity Verification:**
   - **Password-authenticated accounts:** Customer must supply their correct current password.
   - **Google-only accounts:** Customer must supply explicit confirmation string (`"DELETE MY ACCOUNT"`) and have a currently active verified session.

---

## 6. Authentication Hardening & Google Sign-In Protection

### 6.1 The Silent Recreation Vulnerability
In standard OAuth, if an account document does not exist, Google Sign-In automatically creates a new customer. If a customer deletes their account, clicking Google Sign-In would instantly recreate their account.

### 6.2 The Privacy-Conscious Deletion Tombstone Registry
To permanently prevent silent recreation without storing raw personal data:
Create a dedicated, minimal model: **`DeletedAccountTombstone`** (or `RevokedIdentity`):
- `provider`: String (`"google"` | `"email"`)
- `identifierHash`: String (SHA-256 hash of provider subject or email)
- `googleSub`: String (sparse unique index, stores Google's opaque numeric subject ID `1098234...` which contains zero PII)
- `deletedAt`: Date
- `reason`: String

When a Google authentication attempt occurs in `backend/src/services/auth.service.js`:
```javascript
const payload = await googleAuthService.verifyIdToken(idToken);

// Check Deletion Tombstone
const isTombstoned = await DeletedAccountTombstone.findOne({
  $or: [
    { googleSub: payload.sub },
    { identifierHash: hashIdentifier(payload.email) }
  ]
});

if (isTombstoned) {
  throw new AppError(
    "This account was permanently deleted. Automatic recreation via Google Sign-In is blocked.",
    403,
    "ACCOUNT_DELETED"
  );
}
```
This guarantees:
1. Deleted Google users cannot silently re-register through OAuth.
2. The user receives a clear, actionable message.
3. No raw emails or names are stored in the tombstone.
4. Unrelated Google users can sign in and register normally.

### 6.3 Stateless JWT Invalidation
In `backend/src/middlewares/authentication.middleware.js`:
```javascript
if (!dbUser && decoded.sub && mongoose.connection.readyState === 1) {
  return next(new AppError("User account not found or has been deleted", 401, "USER_NOT_FOUND"));
}
```
This guarantees that as soon as the user document is removed from MongoDB, any active access token is immediately rejected across all endpoints.

---

## 7. Proposed Deletion Architecture: `CustomerDeletionService`

### 7.1 Service Responsibilities
Create `backend/src/services/customer-deletion.service.js`:
1. `validateDeletionEligibility(userId)`: Checks for in-flight orders, pending returns, and open disputes.
2. `verifyCustomerIdentity(user, credentials)`: Verifies password (for password users) or confirmation string (for Google users).
3. `executePermanentDeletion(userId, reason)`:
   - Starts MongoDB transaction where supported.
   - Fetches `Customer` profile linked to `userId`.
   - Records tombstone entry in `DeletedAccountTombstone` with `googleSub` and hashed email.
   - Anonymizes `Order` records: redacts shipping address and guest email.
   - Anonymizes completed `ReturnRequest` records: redacts pickup address and bank details.
   - Anonymizes `ProductQuestion` user names and removes `helpfulVoters`.
   - Deletes customer-owned records:
     - `User.deleteOne({ _id: userId })`
     - `Customer.deleteMany({ userId })`
     - `Address.deleteMany({ userId })`
     - `Cart.deleteMany({ customerId })`
     - `Wishlist.deleteMany({ customerId })`
     - `CustomerNotification.deleteMany({ ... })`
     - `PaymentMethod.deleteMany({ customerId })`
     - `RewardAccount.deleteMany({ userId })`
     - `RewardTransaction.deleteMany({ customerId })`
     - `RefreshToken.deleteMany({ userId })`
     - `Otp.deleteMany({ ... })`
     - `EmailVerificationToken.deleteMany({ userId })`
     - `PasswordResetToken.deleteMany({ userId })`
   - Invokes external storage cleanup for customer avatar (if Cloudinary public ID exists).
   - Records non-sensitive governance audit log.

### 7.2 API Endpoint Contract
- **Method & Route:** `DELETE /api/v1/customers/account`
- **Authentication:** `authenticateCustomer`
- **Request Body (Password Users):**
  ```json
  {
    "password": "CustomerCurrentPassword123!",
    "reason": "Personal decision to close account"
  }
  ```
- **Request Body (Google-Only Users):**
  ```json
  {
    "confirmation": "DELETE MY ACCOUNT",
    "reason": "Personal decision to close account"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Your account and personal data have been permanently deleted.",
    "data": {
      "permanentlyDeleted": true,
      "deletedAt": "2026-11-11T12:45:00.000Z"
    }
  }
  ```

---

## 8. Frontend Deletion Experience Specification

### 8.1 Location & UX
Add a dedicated **"Danger Zone / Delete Account"** card to `frontend/src/app/(storefront)/account/security/SecurityPageView.jsx`:
- Explains the irreversible nature of the action.
- Details that personal addresses and profile data will be permanently deleted.
- Clarifies that historical orders and invoices are retained in anonymized format for legal compliance.
- Opens an explicit confirmation modal:
  - Form dynamically detects if user is password-based (`user.hasPassword !== false`) or Google-only.
  - Prompts for password or typing `"DELETE MY ACCOUNT"`.
  - Shows loading/processing state upon submission.
  - On confirmed completion:
    - Clears auth token via `tokenManager.clearAccessToken()`.
    - Wipes local storage (`buybox_customer_user`, `buybox_auth_user`).
    - Resets checkout store.
    - Displays persistent success notification.
    - Redirects customer to homepage (`/`).

---

## 9. Test & Verification Strategy

### 9.1 Automated Test Suite
Create `backend/tests/phase-customer-permanent-delete-02.test.js`:
1. **Permanent Deletion:** Proves `User`, `Customer`, `Address`, `Cart`, `Wishlist`, `PaymentMethod`, `RefreshToken` are completely absent from MongoDB after deletion.
2. **Financial Preservation:** Proves historical `Order`, `Payment`, and `Refund` documents remain in MongoDB with exact IDs, amounts, and tax snapshots intact.
3. **Anonymization Verification:** Proves `shippingAddress` on historical orders is anonymized to `"Deleted Customer"` and phone `"0000000000"`.
4. **Google Sign-In Rejection:** Proves deleted Google user attempting `/api/v1/auth/google` receives `403 ACCOUNT_DELETED` and no new user is created.
5. **Unrelated Google Registration:** Proves fresh Google user with different `sub` registers successfully.
6. **Active Order Blocking:** Proves customer with `processing` order is blocked from deletion with `400 ACTIVE_ORDERS_IN_PROGRESS`.
7. **Stale JWT Rejection:** Proves expired/stale JWT receives `401 USER_NOT_FOUND` once user document is deleted.

---

## 10. Audit Checklist & Stop Condition

- [x] Current deletion behavior documented.
- [x] Root cause identified across frontend, backend, and database layers.
- [x] 100% of repository models scanned and classified in dependency inventory.
- [x] Financial record preservation and tax compliance basis established.
- [x] Google OAuth recreation vulnerability analyzed and tombstone architecture designed.
- [x] Deletion eligibility rules defined (active orders & returns protection).
- [x] Zero destructive changes made during Phase 1 audit.
- [x] Stop condition respected: Awaiting user review before starting implementation.

