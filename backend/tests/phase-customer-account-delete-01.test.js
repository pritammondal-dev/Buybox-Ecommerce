const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Customer = require("../src/models/Customer");
const Order = require("../src/models/Order");
const Cart = require("../src/models/Cart");
const Wishlist = require("../src/models/Wishlist");
const Address = require("../src/models/Address");
const Otp = require("../src/models/Otp");
const RefreshToken = require("../src/models/RefreshToken");
const EmailVerificationToken = require("../src/models/EmailVerificationToken");
const PasswordResetToken = require("../src/models/PasswordResetToken");
const CustomerNotification = require("../src/models/CustomerNotification");
const Employee = require("../src/models/Employee");
const AuditLog = require("../src/models/AuditLog");
const { hashPassword } = require("../src/utils/password");
const { ROLES, AUDIT_ACTIONS } = require("../src/constants/auth.constants");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { generateAccessToken, TOKEN_CONTEXTS, TOKEN_AUDIENCES } = require("../src/services/token.service");
const googleAuthService = require("../src/services/google-auth.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_cust_del_test?")
  : "mongodb://127.0.0.1:27017/buybox_cust_del_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("PHASE CUSTOMER-ACCOUNT-DELETE-01: Permanent Customer Account Deletion & Google Sign-In Recovery", () => {
  let superadminUser;
  let superadminToken;
  let createdUserIds = [];

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // Clean up any test artifacts
    await User.deleteMany({ email: { $regex: /@delete-test\.com$/i } });
    await CustomerNotification.deleteMany({});

    // Ensure a single valid superadmin exists
    superadminUser = await User.findOne({ role: ROLES.SUPER_ADMIN, isActive: true });
    if (!superadminUser) {
      superadminUser = await User.create({
        email: `superadmin-${Date.now()}@delete-test.com`,
        password: await hashPassword("SuperAdminSecret123!"),
        firstName: "Super",
        lastName: "Administrator",
        role: ROLES.SUPER_ADMIN,
        roles: [ROLES.SUPER_ADMIN],
        isActive: true,
        isEmailVerified: true,
      });
      createdUserIds.push(superadminUser._id);
    }

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
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
      await Customer.deleteMany({ userId: { $in: createdUserIds } });
      await RefreshToken.deleteMany({ userId: { $in: createdUserIds } });
      await Otp.deleteMany({ userId: { $in: createdUserIds } });
      await Order.deleteMany({ customerId: { $in: createdUserIds } });
    }
    await User.deleteMany({ email: { $regex: /@delete-test\.com$/i } });
    await mongoose.connection.close();
  });

  /* =========================================================================
     PART 1: PERMANENT CUSTOMER ACCOUNT DELETION & DATA PURGING
     ========================================================================= */
  describe("1. Permanent Customer Account Deletion", () => {
    it("permanently purges User, Customer, and transient credentials while preserving historical orders", async () => {
      const email = `delete-me-${Date.now()}@delete-test.com`;

      // 1. Create Customer with full profile & related data
      const customerUser = await User.create({
        email,
        password: await hashPassword("CustomerPassword123!"),
        firstName: "Test",
        lastName: "Customer",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isActive: true,
        isEmailVerified: true,
      });
      createdUserIds.push(customerUser._id);

      const customerProfile = await Customer.create({
        userId: customerUser._id,
        phone: "+919876543210",
      });

      // Related transient entities
      await Cart.create({
        customerId: customerUser._id,
        items: [],
      });

      await Wishlist.create({
        customerId: customerUser._id,
        items: [{ productId: new mongoose.Types.ObjectId() }],
      });

      await Address.create({
        userId: customerUser._id,
        firstName: "Test",
        lastName: "Customer",
        fullName: "Test Customer",
        phone: "9876543210",
        addressLine1: "123 Test Street",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      });

      await Otp.create({
        userId: customerUser._id,
        email,
        purpose: "email_verification",
        otpHash: "mockHash123",
        expiresAt: new Date(Date.now() + 60000),
      });

      const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(7)}`;

      await RefreshToken.create({
        userId: customerUser._id,
        tokenHash: `tokenHash_${uniqueSuffix}`,
        expiresAt: new Date(Date.now() + 86400000),
      });

      await EmailVerificationToken.create({
        userId: customerUser._id,
        tokenHash: `verifyHash_${uniqueSuffix}`,
        expiresAt: new Date(Date.now() + 86400000),
      });

      await PasswordResetToken.create({
        userId: customerUser._id,
        tokenHash: `resetHash_${uniqueSuffix}`,
        expiresAt: new Date(Date.now() + 3600000),
      });

      await CustomerNotification.create({
        customerId: customerProfile._id,
        userId: customerUser._id,
        title: "Welcome",
        message: "Welcome to Buybox",
      });

      // Historical business record to preserve
      const historicalOrder = await Order.create({
        orderNumber: `ORD-TEST-${Date.now()}`,
        customerId: customerProfile._id,
        status: "delivered",
        paymentStatus: "paid",
        fulfillmentStatus: "fulfilled",
        subtotal: 25000,
        discountTotal: 0,
        taxTotal: 0,
        shippingTotal: 0,
        grandTotal: 25000,
        shippingAddress: {
          fullName: "Test Customer",
          phone: "9876543210",
          addressLine1: "123 Test Street",
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
            productName: "Test Smartphone",
            sku: "SKU-SMART-001",
            quantity: 1,
            unitPrice: 25000,
            discountTotal: 0,
            taxTotal: 0,
            lineTotal: 25000,
            currency: "INR",
          },
        ],
      });

      // 2. Perform Superadmin Permanent Deletion
      const deleteRes = await request(app)
        .delete(`/api/v1/admin/customers/${customerUser._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Customer requested permanent account closure under data protection regulations" });

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);
      expect(deleteRes.body.data.permanentlyDeleted).toBe(true);
      expect(deleteRes.body.data.id).toBe(customerUser._id.toString());

      // 3. Verify User and Customer documents are completely purged from MongoDB
      const userInDb = await User.findById(customerUser._id);
      expect(userInDb).toBeNull();

      const customerInDb = await Customer.findOne({ userId: customerUser._id });
      expect(customerInDb).toBeNull();

      // 4. Verify transient credentials and session records purged
      const otpInDb = await Otp.findOne({ userId: customerUser._id });
      expect(otpInDb).toBeNull();

      const refreshTokenInDb = await RefreshToken.findOne({ userId: customerUser._id });
      expect(refreshTokenInDb).toBeNull();

      const emailTokenInDb = await EmailVerificationToken.findOne({ userId: customerUser._id });
      expect(emailTokenInDb).toBeNull();

      const passwordTokenInDb = await PasswordResetToken.findOne({ userId: customerUser._id });
      expect(passwordTokenInDb).toBeNull();

      const cartInDb = await Cart.findOne({ customerId: customerUser._id });
      expect(cartInDb).toBeNull();

      const wishlistInDb = await Wishlist.findOne({ customerId: customerUser._id });
      expect(wishlistInDb).toBeNull();

      const addressInDb = await Address.findOne({ userId: customerUser._id });
      expect(addressInDb).toBeNull();

      const notifInDb = await CustomerNotification.findOne({ userId: customerUser._id });
      expect(notifInDb).toBeNull();

      // 5. Verify historical Order remains strictly intact for financial audit
      const orderInDb = await Order.findById(historicalOrder._id);
      expect(orderInDb).toBeTruthy();
      expect(orderInDb.customerId.toString()).toBe(customerProfile._id.toString());
      expect(Number(orderInDb.grandTotal)).toBe(25000);

      // 6. Verify Audit Log was recorded
      const auditEntry = await AuditLog.findOne({
        action: "customer.deleted",
        targetId: customerUser._id,
      });
      expect(auditEntry).toBeTruthy();
      expect(auditEntry.afterState.permanentlyDeleted).toBe(true);
    });

    it("allows immediate re-registration with the exact same email after permanent deletion", async () => {
      const email = `reuse-email-${Date.now()}@delete-test.com`;

      // 1. Create Customer
      const customer = await User.create({
        email,
        password: await hashPassword("OriginalSecret123!"),
        firstName: "Original",
        lastName: "User",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isActive: true,
        isEmailVerified: true,
      });

      // 2. Permanently delete customer
      const delRes = await request(app)
        .delete(`/api/v1/admin/customers/${customer._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "User requested permanent account deletion for re-registration test" });

      expect(delRes.status).toBe(200);

      // 3. Register a new customer using the identical email address
      const regRes = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email,
          password: "BrandNewPassword123!",
          firstName: "NewUser",
          lastName: "Recreated",
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.success).toBe(true);
      expect(regRes.body.data.user.email).toBe(email.toLowerCase());
      expect(regRes.body.data.user.id).not.toBe(customer._id.toString());
      createdUserIds.push(regRes.body.data.user.id);

      // Verify new user exists with fresh state
      const newUserInDb = await User.findById(regRes.body.data.user.id);
      expect(newUserInDb).toBeTruthy();
      expect(newUserInDb.firstName).toBe("NewUser");
      expect(newUserInDb.isEmailVerified).toBe(false);
    });

    it("prevents self-deletion and superadmin account deletion", async () => {
      // 1. Attempt self-deletion by superadmin
      const selfDelRes = await request(app)
        .delete(`/api/v1/admin/customers/${superadminUser._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Accidental self deletion attempt" });

      expect(selfDelRes.status).toBe(400);
      expect(selfDelRes.body.code).toBe("CANNOT_DELETE_SELF");

      // 2. Attempt to delete a superadmin account (superadmin accounts cannot be deleted)
      const anotherSuperAdmin = await User.create({
        email: `another-sa-${Date.now()}@delete-test.com`,
        password: await hashPassword("AdminSecret123!"),
        firstName: "Another",
        lastName: "SuperAdmin",
        role: ROLES.SUPER_ADMIN,
        roles: [ROLES.SUPER_ADMIN],
        isActive: false, // inactive bypasses the single active superadmin invariant
        isEmailVerified: true,
      });
      createdUserIds.push(anotherSuperAdmin._id);

      const crossSaDelRes = await request(app)
        .delete(`/api/v1/admin/customers/${anotherSuperAdmin._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Attempting to delete another superadmin" });

      expect(crossSaDelRes.status).toBe(403);
      expect(crossSaDelRes.body.code).toBe("CANNOT_DELETE_SUPERADMIN");
    });
  });

  /* =========================================================================
     PART 2: GOOGLE SIGN-IN COLLISION & ABANDONED ACCOUNT RECOVERY
     ========================================================================= */
  describe("2. Google Sign-In Collision & Abandoned Account Recovery", () => {
    it("recovers unverified abandoned account when user authenticates with verified Google ID token", async () => {
      const email = `abandoned-${Date.now()}@delete-test.com`;
      const googleSub = `sub-google-${Date.now()}`;

      // 1. Abandoned unverified customer account exists (e.g. user registered with password but never completed OTP)
      const abandonedUser = await User.create({
        email,
        password: await hashPassword("AbandonedBogusPassword123!"),
        firstName: "Abandoned",
        lastName: "Register",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isEmailVerified: false, // UNVERIFIED
        isActive: true,
      });
      createdUserIds.push(abandonedUser._id);

      const abandonedCustomer = await Customer.create({
        userId: abandonedUser._id,
        phone: null,
      });

      // Pending OTP for verification
      await Otp.create({
        userId: abandonedUser._id,
        email,
        purpose: "email_verification",
        otpHash: "abandonedOtpHash",
        expiresAt: new Date(Date.now() + 60000),
      });

      // 2. User signs in using Google with verified email claim
      const spy = jest.spyOn(googleAuthService, "verifyIdToken").mockResolvedValueOnce({
        sub: googleSub,
        email,
        emailVerified: true,
        firstName: "VerifiedGoogle",
        lastName: "Owner",
      });

      try {
        const authRes = await request(app)
          .post("/api/v1/auth/google")
          .send({ idToken: "valid.google.jwt.unverified.recovery" });

        expect(authRes.status).toBe(200);
        expect(authRes.body.success).toBe(true);
        expect(authRes.body.data.user.email).toBe(email);
        expect(authRes.body.data.user.isEmailVerified).toBe(true);
        expect(authRes.body.data.accessToken).toBeDefined();

        // 3. Verify unverified password account was deleted and clean Google-verified user created
        const cleanUser = await User.findOne({ email });
        expect(cleanUser).toBeTruthy();
        expect(cleanUser._id.toString()).not.toBe(abandonedUser._id.toString());
        expect(cleanUser.isEmailVerified).toBe(true);
        expect(cleanUser.authProviders.google.id).toBe(googleSub);
        createdUserIds.push(cleanUser._id);

        // 4. Verify stale OTPs purged
        const lingeringOtp = await Otp.findOne({ email });
        expect(lingeringOtp).toBeNull();

        // 5. Verify customer profile was re-linked to new user ID
        const customerProfile = await Customer.findOne({ userId: cleanUser._id });
        expect(customerProfile).toBeTruthy();
      } finally {
        spy.mockRestore();
      }
    });

    it("succeeds directly on repeat Google Sign-In via Google Provider ID without collision", async () => {
      const email = `repeat-google-${Date.now()}@delete-test.com`;
      const googleSub = `sub-repeat-${Date.now()}`;

      // Create existing user already linked to Google
      const linkedUser = await User.create({
        email,
        firstName: "Google",
        lastName: "Customer",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isEmailVerified: true,
        isActive: true,
        authProviders: {
          google: {
            id: googleSub,
            email,
            linkedAt: new Date(),
          },
        },
      });
      createdUserIds.push(linkedUser._id);
      await Customer.create({ userId: linkedUser._id });

      const spy = jest.spyOn(googleAuthService, "verifyIdToken").mockResolvedValueOnce({
        sub: googleSub,
        email,
        emailVerified: true,
        firstName: "Google",
        lastName: "Customer",
      });

      try {
        const res = await request(app)
          .post("/api/v1/auth/google")
          .send({ idToken: "valid.repeat.google.jwt" });

        expect(res.status).toBe(200);
        expect(res.body.data.user.id).toBe(linkedUser._id.toString());
        expect(res.body.data.user.email).toBe(email);
        expect(res.body.data.accessToken).toBeDefined();
      } finally {
        spy.mockRestore();
      }
    });

    it("links Google Provider to verified password customer when email is verified", async () => {
      const email = `verified-pwd-${Date.now()}@delete-test.com`;
      const googleSub = `sub-link-verified-${Date.now()}`;

      const verifiedUser = await User.create({
        email,
        password: await hashPassword("Password123!"),
        firstName: "Verified",
        lastName: "User",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isEmailVerified: true, // VERIFIED
        isActive: true,
      });
      createdUserIds.push(verifiedUser._id);
      await Customer.create({ userId: verifiedUser._id });

      const spy = jest.spyOn(googleAuthService, "verifyIdToken").mockResolvedValueOnce({
        sub: googleSub,
        email,
        emailVerified: true,
        firstName: "Verified",
        lastName: "User",
      });

      try {
        const res = await request(app)
          .post("/api/v1/auth/google")
          .send({ idToken: "valid.link.google.jwt" });

        expect(res.status).toBe(200);
        expect(res.body.data.user.id).toBe(verifiedUser._id.toString());

        const updatedUser = await User.findById(verifiedUser._id);
        expect(updatedUser.authProviders.google.id).toBe(googleSub);
      } finally {
        spy.mockRestore();
      }
    });

    it("strictly rejects Google Sign-In when Google email claim is unverified", async () => {
      const email = `unverified-claim-${Date.now()}@delete-test.com`;

      const spy = jest.spyOn(googleAuthService, "verifyIdToken").mockResolvedValueOnce({
        sub: `sub-unverified-${Date.now()}`,
        email,
        emailVerified: false, // NOT VERIFIED BY GOOGLE
        firstName: "Spoofer",
        lastName: "User",
      });

      try {
        const res = await request(app)
          .post("/api/v1/auth/google")
          .send({ idToken: "jwt.with.unverified.claim" });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe("GOOGLE_EMAIL_NOT_VERIFIED");
      } finally {
        spy.mockRestore();
      }
    });

    it("rejects cross-domain Google login when colliding with Admin or Staff accounts", async () => {
      const email = `staff-admin-${Date.now()}@delete-test.com`;
      const googleSub = `sub-admin-attempt-${Date.now()}`;

      const adminUser = await User.create({
        email,
        password: await hashPassword("AdminSecretPassword123!"),
        firstName: "Platform",
        lastName: "Admin",
        role: ROLES.ADMIN,
        roles: [ROLES.ADMIN],
        isEmailVerified: true,
        isActive: true,
      });
      createdUserIds.push(adminUser._id);

      const spy = jest.spyOn(googleAuthService, "verifyIdToken").mockResolvedValueOnce({
        sub: googleSub,
        email,
        emailVerified: true,
        firstName: "Platform",
        lastName: "Admin",
      });

      try {
        const res = await request(app)
          .post("/api/v1/auth/google")
          .send({ idToken: "valid.admin.google.jwt" });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe("STAFF_PORTAL_REQUIRED");
      } finally {
        spy.mockRestore();
      }
    });

    it("rejects cross-domain Google login when colliding with Merchant/Vendor accounts", async () => {
      const email = `merchant-vendor-${Date.now()}@delete-test.com`;
      const googleSub = `sub-vendor-attempt-${Date.now()}`;

      const vendorUser = await User.create({
        email,
        password: await hashPassword("VendorSecretPassword123!"),
        firstName: "Shop",
        lastName: "Owner",
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
        isEmailVerified: true,
        isActive: true,
      });
      createdUserIds.push(vendorUser._id);

      const spy = jest.spyOn(googleAuthService, "verifyIdToken").mockResolvedValueOnce({
        sub: googleSub,
        email,
        emailVerified: true,
        firstName: "Shop",
        lastName: "Owner",
      });

      try {
        const res = await request(app)
          .post("/api/v1/auth/google")
          .send({ idToken: "valid.vendor.google.jwt" });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe("VENDOR_PORTAL_REQUIRED");
      } finally {
        spy.mockRestore();
      }
    });
  });

  /* =========================================================================
     PART 3: STALE JWT REJECTION FOR DELETED CUSTOMERS
     ========================================================================= */
  describe("3. Middleware Stale JWT Protection", () => {
    it("rejects access with 401 USER_NOT_FOUND when customer account has been permanently deleted", async () => {
      const email = `stale-token-${Date.now()}@delete-test.com`;

      const customerUser = await User.create({
        email,
        password: await hashPassword("CustomerPassword123!"),
        firstName: "Stale",
        lastName: "TokenUser",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isActive: true,
        isEmailVerified: true,
      });

      const customerToken = generateAccessToken(
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

      // Verify token works initially on protected customer endpoint
      const initialRes = await request(app)
        .get("/api/v1/addresses")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(initialRes.status).toBe(200);

      // Permanently delete user
      await request(app)
        .delete(`/api/v1/admin/customers/${customerUser._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Permanent account deletion requested by user" });

      // Request with stale JWT should now be rejected with 401 USER_NOT_FOUND
      const staleRes = await request(app)
        .get("/api/v1/addresses")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(staleRes.status).toBe(401);
      expect(staleRes.body.code).toBe("USER_NOT_FOUND");
    });
  });
});
