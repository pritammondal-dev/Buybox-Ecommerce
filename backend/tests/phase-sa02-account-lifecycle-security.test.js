const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const app = require("../src/app");
const User = require("../src/models/User");
const Customer = require("../src/models/Customer");
const Vendor = require("../src/models/Vendor");
const Product = require("../src/models/Product");
const Category = require("../src/models/Category");
const Order = require("../src/models/Order");
const Address = require("../src/models/Address");
const Review = require("../src/models/Review");
const Cart = require("../src/models/Cart");
const Employee = require("../src/models/Employee");
const RefreshToken = require("../src/models/RefreshToken");
const AuditLog = require("../src/models/AuditLog");
const { ROLES } = require("../src/constants/auth.constants");
const { hashPassword } = require("../src/utils/password");
const { hashToken } = require("../src/utils/token-hash");
const {
  generateAccessToken,
  generateRefreshToken,
  TOKEN_CONTEXTS,
  TOKEN_AUDIENCES,
} = require("../src/services/token.service");
const { rotateRefreshToken } = require("../src/services/refresh-token.service");

describe("Phase SA-02: Backend Account Lifecycle, Security & Audit Hardening", () => {
  jest.setTimeout(60000);

  let superadminUser;
  let superadminToken;
  let unauthorizedCustomerUser;
  let unauthorizedCustomerToken;
  let testCategory;

  const TEST_URI = process.env.MONGODB_URI
    ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_sa02_test?")
    : "mongodb://127.0.0.1:27017/buybox_sa02_test?replicaSet=rs0";

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI, { autoIndex: true });
    }

    // Ensure clean state for single-Superadmin invariant
    await User.deleteMany({ role: ROLES.SUPER_ADMIN });

    const uniqueSuffix = Date.now();

    // 1. Provision Platform Super Administrator
    superadminUser = await User.create({
      email: `superadmin-sa02-${uniqueSuffix}@buybox.test`,
      password: await hashPassword("SuperAdminPass123!"),
      firstName: "Super",
      lastName: "Admin",
      role: ROLES.SUPER_ADMIN,
      roles: [ROLES.SUPER_ADMIN],
      isActive: true,
      isEmailVerified: true,
    });

    await Employee.create({
      userId: superadminUser._id,
      jobTitle: "Platform Superadmin",
      department: "Platform Engineering",
      employeeNumber: `EMP-SA02-${uniqueSuffix.toString().slice(-4)}`,
      isActive: true,
      status: "active",
    });

    superadminToken = generateAccessToken(
      {
        sub: superadminUser._id.toString(),
        role: ROLES.SUPER_ADMIN,
        roles: [ROLES.SUPER_ADMIN],
        authVersion: 1,
        permissionVersion: 1,
      },
      {
        context: TOKEN_CONTEXTS.ADMINISTRATOR,
        audience: TOKEN_AUDIENCES.ADMINISTRATOR,
      }
    );

    // 2. Provision Unauthorized Customer User
    unauthorizedCustomerUser = await User.create({
      email: `unauth-cust-${uniqueSuffix}@buybox.test`,
      password: await hashPassword("CustPass123!"),
      firstName: "Unauthorized",
      lastName: "Customer",
      role: ROLES.CUSTOMER,
      roles: [ROLES.CUSTOMER],
      isActive: true,
      isEmailVerified: true,
    });

    await Customer.create({
      userId: unauthorizedCustomerUser._id,
      isActive: true,
    });

    testCategory = await Category.create({
      name: `Test Cat ${uniqueSuffix}`,
      slug: `test-cat-${uniqueSuffix}`,
    });

    unauthorizedCustomerToken = generateAccessToken(
      {
        sub: unauthorizedCustomerUser._id.toString(),
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        authVersion: 1,
        permissionVersion: 1,
      },
      {
        context: TOKEN_CONTEXTS.CUSTOMER,
        audience: TOKEN_AUDIENCES.CUSTOMER,
      }
    );
  });

  afterAll(async () => {
    // Keep test database intact for inspection
  });

  // =========================================================================
  // SUITE 1: SA-02A — VENDOR SESSION LEAK REGRESSION FIX
  // =========================================================================
  describe("1. SA-02A: Vendor Session Leak Regression & Identity Sync", () => {
    let vendorUser;
    let vendorDoc;
    let vendorAccessToken;
    let vendorRefreshToken;

    beforeEach(async () => {
      const suffix = Date.now() + Math.floor(Math.random() * 10000);
      vendorUser = await User.create({
        email: `vendor-leak-${suffix}@buybox.test`,
        password: await hashPassword("VendorSecret123!"),
        firstName: "Vendor",
        lastName: "Owner",
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
        isActive: true,
        isEmailVerified: true,
        authVersion: 1,
      });

      vendorDoc = await Vendor.create({
        userId: vendorUser._id,
        businessName: `Test Store ${suffix}`,
        businessSlug: `test-store-${suffix}`,
        onboardingStatus: "approved",
        isActive: true,
      });

      vendorAccessToken = generateAccessToken(
        {
          sub: vendorUser._id.toString(),
          role: ROLES.VENDOR,
          roles: [ROLES.VENDOR],
          authVersion: 1,
          permissionVersion: 1,
        },
        {
          context: TOKEN_CONTEXTS.VENDOR,
          audience: TOKEN_AUDIENCES.VENDOR,
        }
      );

      const rawRefresh = generateRefreshToken(
        { sub: vendorUser._id.toString() },
        { context: TOKEN_CONTEXTS.VENDOR }
      );
      vendorRefreshToken = rawRefresh;

      await RefreshToken.create({
        userId: vendorUser._id,
        tokenHash: hashToken(rawRefresh),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    });

    it("1.1 updateVendorAdmin toggling isActive:false synchronizes User.isActive, increments authVersion, and revokes tokens", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/vendors/${vendorDoc._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          isActive: false,
          reason: "Suspending vendor due to compliance policy check",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedVendor = await Vendor.findById(vendorDoc._id);
      expect(updatedVendor.isActive).toBe(false);

      const updatedUser = await User.findById(vendorUser._id);
      expect(updatedUser.isActive).toBe(false);
      expect(updatedUser.authVersion).toBe(2);

      const revokedTokens = await RefreshToken.find({ userId: vendorUser._id });
      expect(revokedTokens.length).toBeGreaterThan(0);
      expect(revokedTokens[0].revokedAt).not.toBeNull();

      // Previously issued JWT access token must be rejected
      const accessAttempt = await request(app)
        .get("/api/v1/vendors/me/profile")
        .set("Authorization", `Bearer ${vendorAccessToken}`);

      expect(accessAttempt.status).toBe(401);

      // Refresh token rotation must be rejected
      await expect(
        rotateRefreshToken({
          refreshToken: vendorRefreshToken,
          expectedContext: "vendor",
        })
      ).rejects.toThrow();
    });

    it("1.2 Dedicated suspendVendor synchronizes User, increments authVersion, revokes tokens, and unpublishes products", async () => {
      const pSuffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const productActive = await Product.create({
        name: "Active Vendor Product",
        slug: `active-vendor-product-${pSuffix}`,
        sku: `SKU-ACT-${pSuffix}`,
        vendorId: vendorDoc._id,
        categoryId: testCategory._id,
        price: 199,
        status: "active",
        isStoreVisible: true,
      });

      const res = await request(app)
        .post(`/api/v1/admin/vendors/${vendorDoc._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          reason: "Suspended for repeated delivery SLA violations",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedVendor = await Vendor.findById(vendorDoc._id);
      expect(updatedVendor.onboardingStatus).toBe("suspended");
      expect(updatedVendor.isActive).toBe(false);

      const updatedUser = await User.findById(vendorUser._id);
      expect(updatedUser.isActive).toBe(false);
      expect(updatedUser.authVersion).toBe(2);

      const productAfter = await Product.findById(productActive._id);
      expect(productAfter.isStoreVisible).toBe(false);

      // Previously issued token must be rejected with 401
      const meAttempt = await request(app)
        .get("/api/v1/vendors/me/profile")
        .set("Authorization", `Bearer ${vendorAccessToken}`);
      expect(meAttempt.status).toBe(401);
    });

    it("1.3 Reactivating a vendor restores User.isActive and authVersion, but only enables store visibility for 'active' products", async () => {
      // Suspend first
      await request(app)
        .post(`/api/v1/admin/vendors/${vendorDoc._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Temporarily suspending store for inspection" });

      const mSuffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const productActive = await Product.create({
        name: "Moderated Product",
        slug: `moderated-product-${mSuffix}`,
        sku: `SKU-MOD-${mSuffix}`,
        vendorId: vendorDoc._id,
        categoryId: testCategory._id,
        price: 299,
        status: "active",
        isStoreVisible: false,
      });

      const dSuffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const productDraft = await Product.create({
        name: "Unapproved Draft Product",
        slug: `unapproved-draft-product-${dSuffix}`,
        sku: `SKU-DRF-${dSuffix}`,
        vendorId: vendorDoc._id,
        categoryId: testCategory._id,
        price: 399,
        status: "draft",
        isStoreVisible: false,
      });

      const reactivateRes = await request(app)
        .post(`/api/v1/admin/vendors/${vendorDoc._id}/reactivate`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          reason: "Vendor compliance documents reviewed and approved",
        });

      expect(reactivateRes.status).toBe(200);
      expect(reactivateRes.body.success).toBe(true);

      const updatedVendor = await Vendor.findById(vendorDoc._id);
      expect(updatedVendor.onboardingStatus).toBe("approved");
      expect(updatedVendor.isActive).toBe(true);

      const updatedUser = await User.findById(vendorUser._id);
      expect(updatedUser.isActive).toBe(true);
      expect(updatedUser.authVersion).toBe(3);

      // Moderated product should be visible
      const checkedActiveProd = await Product.findById(productActive._id);
      expect(checkedActiveProd.isStoreVisible).toBe(true);

      // Draft product must remain hidden
      const checkedDraftProd = await Product.findById(productDraft._id);
      expect(checkedDraftProd.isStoreVisible).toBe(false);
    });

    it("1.4 Reactivating a pending or rejected vendor returns 400 INVALID_TRANSITION", async () => {
      const suffix = Date.now() + 99;
      const rejectedVendor = await Vendor.create({
        userId: new mongoose.Types.ObjectId(),
        businessName: `Rejected Store ${suffix}`,
        businessSlug: `rejected-store-${suffix}`,
        onboardingStatus: "rejected",
        isActive: false,
      });

      const res = await request(app)
        .post(`/api/v1/admin/vendors/${rejectedVendor._id}/reactivate`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Attempting to reactivate without re-onboarding" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_TRANSITION");
    });
  });

  // =========================================================================
  // SUITE 2: SA-02B & SA-02C — AUTHORIZATION & REASON VALIDATION
  // =========================================================================
  describe("2. SA-02B & SA-02C: Authorization Boundaries & Reason Validation", () => {
    let testCust;

    beforeEach(async () => {
      const suffix = Date.now() + Math.floor(Math.random() * 1000);
      testCust = await User.create({
        email: `auth-test-cust-${suffix}@buybox.test`,
        password: await hashPassword("Password123!"),
        firstName: "Test",
        lastName: "Customer",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isActive: true,
      });
      await Customer.create({ userId: testCust._id, isActive: true });
    });

    it("2.1 Rejects unauthenticated requests with 401", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/customers/${testCust._id}/suspend`)
        .send({ reason: "Valid reason without token" });

      expect(res.status).toBe(401);
    });

    it("2.2 Rejects unauthorized customer role with 403 INSUFFICIENT_PERMISSIONS", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/customers/${testCust._id}/suspend`)
        .set("Authorization", `Bearer ${unauthorizedCustomerToken}`)
        .send({ reason: "Attempting customer self-service suspension" });

      expect(res.status).toBe(403);
    });

    it("2.3 Rejects missing reason with 400 Bad Request", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/customers/${testCust._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message || res.body.error).toBeDefined();

      // Ensure account was not mutated
      const customerAfter = await User.findById(testCust._id);
      expect(customerAfter.isActive).toBe(true);
    });

    it("2.4 Rejects empty, whitespace-only, or too-short reason (< 10 chars) with 400", async () => {
      const shortRes = await request(app)
        .post(`/api/v1/admin/customers/${testCust._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Too short" });

      expect(shortRes.status).toBe(400);

      const whitespaceRes = await request(app)
        .post(`/api/v1/admin/customers/${testCust._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "          " });

      expect(whitespaceRes.status).toBe(400);

      const nullRes = await request(app)
        .post(`/api/v1/admin/customers/${testCust._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: null });

      expect(nullRes.status).toBe(400);
    });

    it("2.5 Prevents self-suspension and self-deletion for administrative accounts", async () => {
      const selfSuspend = await request(app)
        .post(`/api/v1/admin/customers/${superadminUser._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Attempting self-suspension by superadmin" });

      // Superadmin is not role: 'customer' or self-suspension check fires
      expect([400, 404]).toContain(selfSuspend.status);

      const selfDelete = await request(app)
        .delete(`/api/v1/admin/customers/${superadminUser._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Attempting self-deletion by superadmin" });

      expect([400, 403, 404]).toContain(selfDelete.status);
    });

    it("2.6 Valid reason is persisted in immutable AuditLog", async () => {
      const reasonText = "Customer account flagged for investigation by security ops";
      const res = await request(app)
        .post(`/api/v1/admin/customers/${testCust._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: reasonText });

      expect(res.status).toBe(200);

      const log = await AuditLog.findOne({
        targetId: testCust._id,
        action: "customer.suspended",
      }).sort({ createdAt: -1 });

      expect(log).not.toBeNull();
      expect(log.reason).toBe(reasonText);
      expect(log.actorId.toString()).toBe(superadminUser._id.toString());
      expect(log.beforeState).toBeDefined();
      expect(log.afterState).toBeDefined();
    });
  });

  // =========================================================================
  // SUITE 3: SA-02D — CUSTOMER ACCOUNT LIFECYCLE
  // =========================================================================
  describe("3. SA-02D: Customer Account Lifecycle", () => {
    let customerUser;
    let customerProfile;
    let customerToken;
    let rawCustomerRefresh;

    beforeEach(async () => {
      const suffix = Date.now() + Math.floor(Math.random() * 5000);
      customerUser = await User.create({
        email: `lifecycle-cust-${suffix}@buybox.test`,
        password: await hashPassword("CustomerPassword123!"),
        firstName: "Alice",
        lastName: "Smith",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isActive: true,
        isEmailVerified: true,
        authVersion: 1,
      });

      customerProfile = await Customer.create({
        userId: customerUser._id,
        phone: "+919876500000",
        isActive: true,
      });

      customerToken = generateAccessToken(
        {
          sub: customerUser._id.toString(),
          role: ROLES.CUSTOMER,
          roles: [ROLES.CUSTOMER],
          authVersion: 1,
          permissionVersion: 1,
        },
        {
          context: TOKEN_CONTEXTS.CUSTOMER,
          audience: TOKEN_AUDIENCES.CUSTOMER,
        }
      );

      rawCustomerRefresh = generateRefreshToken(
        { sub: customerUser._id.toString() },
        { context: TOKEN_CONTEXTS.CUSTOMER }
      );

      await RefreshToken.create({
        userId: customerUser._id,
        tokenHash: hashToken(rawCustomerRefresh),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    });

    it("3.1 Customer suspension immediately invalidates active sessions and bumps authVersion", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/customers/${customerUser._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Suspending customer due to excessive chargeback disputes" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const userAfter = await User.findById(customerUser._id);
      expect(userAfter.isActive).toBe(false);
      expect(userAfter.authVersion).toBe(2);

      const custAfter = await Customer.findOne({ userId: customerUser._id });
      expect(custAfter.isActive).toBe(false);

      // Access with previously issued token must fail
      const accessRes = await request(app)
        .get("/api/v1/cart")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(accessRes.status).toBe(401);

      // Refresh token rotation must fail
      await expect(
        rotateRefreshToken({
          refreshToken: rawCustomerRefresh,
          expectedContext: "customer",
        })
      ).rejects.toThrow();

      // Repeated suspension returns 400
      const repeatRes = await request(app)
        .post(`/api/v1/admin/customers/${customerUser._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Duplicate suspension attempt" });

      expect(repeatRes.status).toBe(400);
      expect(repeatRes.body.code).toBe("CUSTOMER_ALREADY_SUSPENDED");
    });

    it("3.2 Customer reactivation restores active state and increments authVersion", async () => {
      // Suspend first
      await request(app)
        .post(`/api/v1/admin/customers/${customerUser._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Initial suspension for identity verification" });

      const reactivateRes = await request(app)
        .post(`/api/v1/admin/customers/${customerUser._id}/reactivate`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Identity verification completed satisfactorily" });

      expect(reactivateRes.status).toBe(200);

      const userAfter = await User.findById(customerUser._id);
      expect(userAfter.isActive).toBe(true);
      expect(userAfter.deletedAt).toBeNull();
      expect(userAfter.authVersion).toBe(3);

      // Repeated reactivation returns 400
      const repeatRes = await request(app)
        .post(`/api/v1/admin/customers/${customerUser._id}/reactivate`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Second reactivation attempt" });

      expect(repeatRes.status).toBe(400);
      expect(repeatRes.body.code).toBe("CUSTOMER_ALREADY_ACTIVE");
    });

    it("3.3 Customer profile edit validates fields, mandates reason, and protects unauthorized fields", async () => {
      const uniquePhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
      const editRes = await request(app)
        .patch(`/api/v1/admin/customers/${customerUser._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          firstName: "Alicia",
          lastName: "Wonderland",
          phone: uniquePhone,
          reason: "Customer requested legal name correction via support ticket",
        });

      expect(editRes.status).toBe(200);
      expect(editRes.body.data.firstName).toBe("Alicia");
      expect(editRes.body.data.lastName).toBe("Wonderland");

      // Attempting to inject protected fields (e.g. role, password, email) must be rejected
      const hackRes = await request(app)
        .patch(`/api/v1/admin/customers/${customerUser._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          role: "super_admin",
          reason: "Attempting privilege escalation through customer update",
        });

      expect(hackRes.status).toBe(400);

      const userUnchanged = await User.findById(customerUser._id);
      expect(userUnchanged.role).toBe(ROLES.CUSTOMER);
    });

    it("3.4 Customer administrative password reset hashes securely and invalidates prior sessions", async () => {
      const newSecretPass = "NewSecureCustomerPass2026!";
      const resetRes = await request(app)
        .post(`/api/v1/admin/customers/${customerUser._id}/reset-password`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          newPassword: newSecretPass,
          reason: "Administrative password reset per customer account recovery",
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // Ensure plaintext password or hash is never returned
      expect(resetRes.body.password).toBeUndefined();
      expect(resetRes.body.passwordHash).toBeUndefined();
      expect(resetRes.body.data.password).toBeUndefined();

      const userAfter = await User.findById(customerUser._id).select("+password");
      expect(userAfter.authVersion).toBe(2);

      // Verify bcrypt hash matches new password
      const isMatch = await bcrypt.compare(newSecretPass, userAfter.password);
      expect(isMatch).toBe(true);

      // Old password must fail
      const isOldMatch = await bcrypt.compare("CustomerPassword123!", userAfter.password);
      expect(isOldMatch).toBe(false);

      // Prior session token must be rejected
      const oldSession = await request(app)
        .get("/api/v1/cart")
        .set("Authorization", `Bearer ${customerToken}`);
      expect(oldSession.status).toBe(401);

      // Audit log must NOT contain password
      const audit = await AuditLog.findOne({
        targetId: customerUser._id,
        action: "customer.password_reset",
      });
      expect(audit).not.toBeNull();
      expect(JSON.stringify(audit)).not.toContain(newSecretPass);
    });

    it("3.5 Customer soft-deactivation sets deletedAt, prevents login, and preserves historical orders", async () => {
      // Create historical order and address
      const ordSuffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const order = await Order.create({
        orderNumber: `ORD-${ordSuffix}`,
        customerId: customerUser._id,
        currency: "INR",
        status: "delivered",
        paymentStatus: "paid",
        fulfillmentStatus: "fulfilled",
        subtotal: 500,
        discountTotal: 0,
        taxTotal: 0,
        shippingTotal: 0,
        grandTotal: 500,
        shippingAddress: {
          fullName: "Alice Smith",
          phone: "+919876543210",
          addressLine1: "123 Main St",
          city: "Mumbai",
          state: "Maharashtra",
          postalCode: "400001",
          country: "IN",
        },
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productVariantId: new mongoose.Types.ObjectId(),
            vendorId: new mongoose.Types.ObjectId(),
            productName: "Historical Purchase",
            sku: `SKU-HIST-${ordSuffix}`,
            quantity: 1,
            unitPrice: 500,
            discountTotal: 0,
            taxTotal: 0,
            lineTotal: 500,
            currency: "INR",
          },
        ],
      });

      const address = await Address.create({
        userId: customerUser._id,
        firstName: "Alice",
        lastName: "Smith",
        phone: "+919876543210",
        addressLine1: "123 Main St",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      });

      const deleteRes = await request(app)
        .delete(`/api/v1/admin/customers/${customerUser._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          reason: "Customer requested account deletion under DPDP regulations",
        });

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      const userAfter = await User.findById(customerUser._id);
      expect(userAfter.isActive).toBe(false);
      expect(userAfter.deletedAt).not.toBeNull();
      expect(userAfter.authVersion).toBe(2);

      const custAfter = await Customer.findOne({ userId: customerUser._id });
      expect(custAfter.isActive).toBe(false);
      expect(custAfter.deletedAt).not.toBeNull();

      // Historical order and address must NOT be cascade-deleted
      const preservedOrder = await Order.findById(order._id);
      expect(preservedOrder).not.toBeNull();
      expect(preservedOrder.customerId.toString()).toBe(customerUser._id.toString());

      const preservedAddress = await Address.findById(address._id);
      expect(preservedAddress).not.toBeNull();

      // Repeated deletion returns 400
      const repeatDel = await request(app)
        .delete(`/api/v1/admin/customers/${customerUser._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Duplicate deletion call" });

      expect(repeatDel.status).toBe(400);
      expect(repeatDel.body.code).toBe("ACCOUNT_ALREADY_DEACTIVATED");
    });
  });

  // =========================================================================
  // SUITE 4: SA-02E — VENDOR ACCOUNT LIFECYCLE
  // =========================================================================
  describe("4. SA-02E: Vendor Account Lifecycle", () => {
    let vendorUser;
    let vendorDoc;

    beforeEach(async () => {
      const suffix = Date.now() + Math.floor(Math.random() * 8000);
      vendorUser = await User.create({
        email: `vendor-life-${suffix}@buybox.test`,
        password: await hashPassword("VendorSecret2026!"),
        firstName: "Rajesh",
        lastName: "Sharma",
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
        isActive: true,
        isEmailVerified: true,
        authVersion: 1,
      });

      vendorDoc = await Vendor.create({
        userId: vendorUser._id,
        businessName: `Rajesh Enterprises ${suffix}`,
        businessSlug: `rajesh-enterprises-${suffix}`,
        onboardingStatus: "approved",
        isActive: true,
      });
    });

    it("4.1 Vendor password reset updates hash, invalidates sessions, and captures reason", async () => {
      const newVendorSecret = "VendorNewPassSecure999!";
      const res = await request(app)
        .post(`/api/v1/admin/vendors/${vendorDoc._id}/reset-password`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          newPassword: newVendorSecret,
          reason: "Vendor requested password reset after suspected credential compromise",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const userAfter = await User.findById(vendorUser._id).select("+password");
      expect(userAfter.authVersion).toBe(2);

      const isMatch = await bcrypt.compare(newVendorSecret, userAfter.password);
      expect(isMatch).toBe(true);

      const audit = await AuditLog.findOne({
        targetId: vendorDoc._id,
        action: "vendor.password_reset",
      });
      expect(audit).not.toBeNull();
      expect(audit.reason).toContain("suspected credential compromise");
      expect(JSON.stringify(audit)).not.toContain(newVendorSecret);
    });

    it("4.2 Vendor soft-deactivation sets deletedAt, unpublishes products, and preserves seller orders", async () => {
      const vSuffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const product = await Product.create({
        name: "Vendor Seller Item",
        slug: `vendor-seller-item-${vSuffix}`,
        sku: `SKU-VND-${vSuffix}`,
        vendorId: vendorDoc._id,
        categoryId: testCategory._id,
        price: 100,
        status: "active",
        isStoreVisible: true,
      });

      const order = await Order.create({
        orderNumber: `ORD-VND-${vSuffix}`,
        customerId: new mongoose.Types.ObjectId(),
        currency: "INR",
        status: "processing",
        paymentStatus: "paid",
        fulfillmentStatus: "unfulfilled",
        subtotal: 200,
        discountTotal: 0,
        taxTotal: 0,
        shippingTotal: 0,
        grandTotal: 200,
        shippingAddress: {
          fullName: "Buyer Test",
          phone: "+919876543210",
          addressLine1: "456 Market Road",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
          country: "IN",
        },
        items: [
          {
            productName: "Vendor Seller Item",
            vendorId: vendorDoc._id,
            productId: product._id,
            productVariantId: new mongoose.Types.ObjectId(),
            sku: `SKU-VND-ITEM-${vSuffix}`,
            quantity: 2,
            unitPrice: 100,
            discountTotal: 0,
            taxTotal: 0,
            lineTotal: 200,
            currency: "INR",
          },
        ],
      });

      const delRes = await request(app)
        .delete(`/api/v1/admin/vendors/${vendorDoc._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          reason: "Vendor business permanently shutting down operations",
        });

      expect(delRes.status).toBe(200);

      const vendorAfter = await Vendor.findById(vendorDoc._id);
      expect(vendorAfter.deletedAt).not.toBeNull();
      expect(vendorAfter.isActive).toBe(false);
      expect(vendorAfter.onboardingStatus).toBe("inactive");

      const userAfter = await User.findById(vendorUser._id);
      expect(userAfter.isActive).toBe(false);
      expect(userAfter.deletedAt).not.toBeNull();
      expect(userAfter.authVersion).toBe(2);

      // Product must be hidden
      const productAfter = await Product.findById(product._id);
      expect(productAfter.isStoreVisible).toBe(false);

      // Order and attribution must be preserved
      const orderAfter = await Order.findById(order._id);
      expect(orderAfter).not.toBeNull();
      expect(orderAfter.items[0].vendorId.toString()).toBe(vendorDoc._id.toString());

      // Repeated deletion returns 400
      const repeatDel = await request(app)
        .delete(`/api/v1/admin/vendors/${vendorDoc._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Repeated vendor delete attempt" });

      expect(repeatDel.status).toBe(400);
      expect(repeatDel.body.code).toBe("VENDOR_ALREADY_DEACTIVATED");
    });
  });
});
