const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Customer = require("../src/models/Customer");
const Address = require("../src/models/Address");
const Cart = require("../src/models/Cart");
const Wishlist = require("../src/models/Wishlist");
const CustomerNotification = require("../src/models/CustomerNotification");
const PaymentMethod = require("../src/models/PaymentMethod");
const RefreshToken = require("../src/models/RefreshToken");
const Otp = require("../src/models/Otp");
const EmailVerificationToken = require("../src/models/EmailVerificationToken");
const PasswordResetToken = require("../src/models/PasswordResetToken");
const Order = require("../src/models/Order");
const Payment = require("../src/models/Payment");
const Refund = require("../src/models/Refund");
const ReturnRequest = require("../src/models/ReturnRequest");
const ProductQuestion = require("../src/models/ProductQuestion");
const DeletedAccountTombstone = require("../src/models/DeletedAccountTombstone");

const { hashPassword } = require("../src/utils/password");
const { ROLES } = require("../src/constants/auth.constants");
const {
  generateAccessToken,
  TOKEN_CONTEXTS,
  TOKEN_AUDIENCES,
} = require("../src/services/token.service");
const googleAuthService = require("../src/services/google-auth.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_cust_perm_del_test?")
  : "mongodb://127.0.0.1:27017/buybox_cust_perm_del_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("PHASE CUSTOMER-PERMANENT-DELETE-02: Permanent Customer Account Deletion & Record Preservation", () => {
  let createdUserIds = [];
  let createdCustomerIds = [];

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // Clean up test artifacts
    await User.deleteMany({ email: { $regex: /@perm-del-test\.com$/i } });
    await DeletedAccountTombstone.deleteMany({});
  });

  afterAll(async () => {
    if (createdUserIds.length > 0 || createdCustomerIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
      await Customer.deleteMany({ $or: [{ _id: { $in: createdCustomerIds } }, { userId: { $in: createdUserIds } }] });
      await Address.deleteMany({ userId: { $in: createdUserIds } });
      await RefreshToken.deleteMany({ userId: { $in: createdUserIds } });
      await Otp.deleteMany({ userId: { $in: createdUserIds } });
      await Order.deleteMany({ $or: [{ customerId: { $in: createdUserIds } }, { customerId: { $in: createdCustomerIds } }] });
      await Payment.deleteMany({ $or: [{ customerId: { $in: createdUserIds } }, { customerId: { $in: createdCustomerIds } }] });
      await Refund.deleteMany({ $or: [{ customerId: { $in: createdUserIds } }, { customerId: { $in: createdCustomerIds } }] });
      await ReturnRequest.deleteMany({ $or: [{ customerId: { $in: createdUserIds } }, { customerId: { $in: createdCustomerIds } }] });
      await Cart.deleteMany({ customerId: { $in: createdUserIds } });
      await Wishlist.deleteMany({ customerId: { $in: createdUserIds } });
      await PaymentMethod.deleteMany({ customerId: { $in: createdCustomerIds } });
      await CustomerNotification.deleteMany({ $or: [{ userId: { $in: createdUserIds } }, { customerId: { $in: createdCustomerIds } }] });
    }
    await User.deleteMany({ email: { $regex: /@perm-del-test\.com$/i } });
    await mongoose.connection.close();
  });

  /* =========================================================================
     1. PHYSICAL MONGODB DELETION & ANONYMIZATION SUITE
     ========================================================================= */
  describe("1. Customer Self-Service Permanent Deletion (DELETE /api/v1/customers/account)", () => {
    it("permanently purges User, Customer, Addresses, Cart, Wishlist, and transient auth while preserving and anonymizing Orders", async () => {
      const email = `perm-delete-${Date.now()}@perm-del-test.com`;
      const passwordPlain = "CustomerSecret123!";

      // A. Create Customer user & profile
      const user = await User.create({
        email,
        password: await hashPassword(passwordPlain),
        firstName: "Anand",
        lastName: "Sharma",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isActive: true,
        isEmailVerified: true,
      });
      createdUserIds.push(user._id);

      const customer = await Customer.create({
        userId: user._id,
        phone: "+919876543210",
      });
      createdCustomerIds.push(customer._id);

      // B. Create customer-owned personal data
      await Address.create({
        userId: user._id,
        firstName: "Anand",
        lastName: "Sharma",
        phone: "+919876543210",
        addressLine1: "Flat 402, Lotus Towers",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      });

      await Cart.create({
        customerId: user._id,
        items: [],
      });

      await Wishlist.create({
        customerId: user._id,
        items: [{ productId: new mongoose.Types.ObjectId() }],
      });

      await CustomerNotification.create({
        userId: user._id,
        customerId: customer._id,
        title: "Welcome to Buybox",
        message: "Your profile is ready.",
      });

      await PaymentMethod.create({
        name: "My Card",
        code: `card_${Date.now()}`,
        gateway: "razorpay",
        type: "card",
        customerId: customer._id,
        token: "tok_12345",
      });

      await RefreshToken.create({
        userId: user._id,
        tokenHash: "fake_hash_123",
        expiresAt: new Date(Date.now() + 86400000),
      });

      await Otp.create({
        userId: user._id,
        email,
        otpHash: "dummy_hash_123",
        purpose: "email_verification",
        expiresAt: new Date(Date.now() + 600000),
      });

      // C. Create historical Order, Payment, and Refund (COMPLETED / DELIVERED)
      const order = await Order.create({
        orderNumber: `ORD-${Date.now()}-TEST`,
        customerId: customer._id,
        status: "delivered",
        fulfillmentStatus: "fulfilled",
        paymentStatus: "paid",
        cancellationStatus: "none",
        currency: "INR",
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productVariantId: new mongoose.Types.ObjectId(),
            vendorId: new mongoose.Types.ObjectId(),
            sku: "SKU-TEST-100",
            productName: "Heritage Cotton Shirt",
            quantity: 2,
            unitPrice: mongoose.Types.Decimal128.fromString("999.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("99.90"),
            lineTotal: mongoose.Types.Decimal128.fromString("1998.00"),
            currency: "INR",
          },
        ],
        subtotal: mongoose.Types.Decimal128.fromString("1998.00"),
        taxTotal: mongoose.Types.Decimal128.fromString("99.90"),
        shippingTotal: mongoose.Types.Decimal128.fromString("50.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("2147.90"),
        shippingAddress: {
          fullName: "Anand Sharma",
          phone: "+919876543210",
          addressLine1: "Flat 402, Lotus Towers",
          city: "Mumbai",
          state: "Maharashtra",
          postalCode: "400001",
          country: "IN",
        },
      });

      const gatewayOrderId = `order_rzp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const gatewayPaymentId = `pay_rzp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const gatewayRefundId = `rfnd_rzp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const payment = await Payment.create({
        orderId: order._id,
        customerId: customer._id,
        gateway: "razorpay",
        gatewayOrderId,
        gatewayPaymentId,
        amount: mongoose.Types.Decimal128.fromString("2147.90"),
        currency: "INR",
        status: "captured",
      });

      const refund = await Refund.create({
        paymentId: payment._id,
        orderId: order._id,
        customerId: customer._id,
        gateway: "razorpay",
        gatewayRefundId,
        amount: mongoose.Types.Decimal128.fromString("200.00"),
        currency: "INR",
        status: "processed",
      });

      // D. Generate Customer JWT
      const customerToken = generateAccessToken(
        {
          sub: user._id.toString(),
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

      // E. Call DELETE /api/v1/customers/account
      const res = await request(app)
        .delete("/api/v1/customers/account")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          password: passwordPlain,
          confirmation: "DELETE MY ACCOUNT",
          reason: "Exercising Option A deletion rights",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.permanentlyDeleted).toBe(true);

      // F. PHYSICAL DATABASE VERIFICATION
      // 1. User & Customer documents MUST BE NULL
      const userAfter = await User.findById(user._id);
      expect(userAfter).toBeNull();

      const customerAfter = await Customer.findOne({ userId: user._id });
      expect(customerAfter).toBeNull();

      // 2. Personal records MUST BE NULL / EMPTY
      const addressesAfter = await Address.find({ userId: user._id });
      expect(addressesAfter.length).toBe(0);

      const cartsAfter = await Cart.find({ customerId: user._id });
      expect(cartsAfter.length).toBe(0);

      const wishlistsAfter = await Wishlist.find({ customerId: user._id });
      expect(wishlistsAfter.length).toBe(0);

      const notifsAfter = await CustomerNotification.find({
        $or: [{ userId: user._id }, { customerId: customer._id }],
      });
      expect(notifsAfter.length).toBe(0);

      const pMethodsAfter = await PaymentMethod.find({ customerId: customer._id });
      expect(pMethodsAfter.length).toBe(0);

      const tokensAfter = await RefreshToken.find({ userId: user._id });
      expect(tokensAfter.length).toBe(0);

      const otpsAfter = await Otp.find({ userId: user._id });
      expect(otpsAfter.length).toBe(0);

      // 3. FINANCIAL RECORDS MUST BE SAFELY PRESERVED & ANONYMIZED
      const orderAfter = await Order.findById(order._id);
      expect(orderAfter).not.toBeNull();
      expect(orderAfter.items.length).toBe(1);
      expect(orderAfter.items[0].sku).toBe("SKU-TEST-100");
      expect(orderAfter.grandTotal.toString()).toBe("2147.90");

      // Verify Anonymization of shippingAddress
      expect(orderAfter.shippingAddress.fullName).toBe("Deleted Customer");
      expect(orderAfter.shippingAddress.phone).toBe("0000000000");
      expect(orderAfter.shippingAddress.addressLine1).toContain("Redacted for privacy");
      // State & Country preserved for GST jurisdiction audit
      expect(orderAfter.shippingAddress.state).toBe("Maharashtra");
      expect(orderAfter.shippingAddress.country).toBe("IN");

      // Verify Payment & Refund preservation
      const paymentAfter = await Payment.findById(payment._id);
      expect(paymentAfter).not.toBeNull();
      expect(paymentAfter.gatewayPaymentId).toBe(gatewayPaymentId);

      const refundAfter = await Refund.findById(refund._id);
      expect(refundAfter).not.toBeNull();
      expect(refundAfter.gatewayRefundId).toBe(gatewayRefundId);

      // 4. Verify Tombstone Registry Created (HMAC-SHA-256 fingerprint)
      const tombstones = await DeletedAccountTombstone.find({});
      expect(tombstones.length).toBeGreaterThanOrEqual(1);
      expect(tombstones[0].identityFingerprint).toBeDefined();
      expect(tombstones[0].identityFingerprint).not.toContain(email); // NEVER raw email
    });

    it("rejects deletion when password is incorrect", async () => {
      const email = `wrong-pass-${Date.now()}@perm-del-test.com`;

      const user = await User.create({
        email,
        password: await hashPassword("CorrectPassword123!"),
        firstName: "Test",
        lastName: "User",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isActive: true,
        isEmailVerified: true,
      });
      createdUserIds.push(user._id);
      const cust = await Customer.create({ userId: user._id });
      createdCustomerIds.push(cust._id);

      const customerToken = generateAccessToken(
        {
          sub: user._id.toString(),
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

      const res = await request(app)
        .delete("/api/v1/customers/account")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          password: "WrongPassword999!",
          confirmation: "DELETE MY ACCOUNT",
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_CREDENTIALS");

      // User must still exist
      const userStillExists = await User.findById(user._id);
      expect(userStillExists).not.toBeNull();
    });
  });

  /* =========================================================================
     2. IN-FLIGHT ORDER & ACTIVE RETURN RESTRICTIONS
     ========================================================================= */
  describe("2. Operational Eligibility (In-Flight Orders & Returns Blocking)", () => {
    it("blocks deletion when customer has an order in 'processing' status", async () => {
      const email = `in-flight-${Date.now()}@perm-del-test.com`;
      const pass = "Password123!";

      const user = await User.create({
        email,
        password: await hashPassword(pass),
        firstName: "Pending",
        lastName: "Customer",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isActive: true,
        isEmailVerified: true,
      });
      createdUserIds.push(user._id);
      const customer = await Customer.create({ userId: user._id });
      createdCustomerIds.push(customer._id);

      // In-flight processing order
      await Order.create({
        orderNumber: `ORD-ACTIVE-${Date.now()}`,
        customerId: customer._id,
        status: "processing", // ACTIVE / IN-FLIGHT
        fulfillmentStatus: "unfulfilled",
        paymentStatus: "paid",
        cancellationStatus: "none",
        currency: "INR",
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productVariantId: new mongoose.Types.ObjectId(),
            vendorId: new mongoose.Types.ObjectId(),
            sku: "SKU-ACTIVE-01",
            productName: "Active Order Item",
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("500.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("50.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("500.00"),
            currency: "INR",
          },
        ],
        subtotal: mongoose.Types.Decimal128.fromString("500.00"),
        taxTotal: mongoose.Types.Decimal128.fromString("50.00"),
        shippingTotal: mongoose.Types.Decimal128.fromString("0.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("550.00"),
        shippingAddress: {
          fullName: "Pending Customer",
          phone: "+919876543210",
          addressLine1: "123 High Street",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
          country: "IN",
        },
      });

      const customerToken = generateAccessToken(
        {
          sub: user._id.toString(),
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

      const res = await request(app)
        .delete("/api/v1/customers/account")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          password: pass,
          confirmation: "DELETE MY ACCOUNT",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("ACTIVE_ORDERS_IN_PROGRESS");

      // Verify user document was not deleted
      const checkUser = await User.findById(user._id);
      expect(checkUser).not.toBeNull();
    });

    it("blocks deletion when customer has an active return request in 'requested' status", async () => {
      const email = `return-active-${Date.now()}@perm-del-test.com`;
      const pass = "Password123!";

      const user = await User.create({
        email,
        password: await hashPassword(pass),
        firstName: "Return",
        lastName: "Applicant",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isActive: true,
        isEmailVerified: true,
      });
      createdUserIds.push(user._id);
      const customer = await Customer.create({ userId: user._id });
      createdCustomerIds.push(customer._id);

      const dummyOrderId = new mongoose.Types.ObjectId();

      await ReturnRequest.create({
        returnNumber: `RET-ACTIVE-${Date.now()}`,
        orderId: dummyOrderId,
        customerId: customer._id,
        status: "requested", // ACTIVE RETURN
        type: "return",
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            sku: "SKU-RET-1",
            name: "Item with size issue",
            quantity: 1,
            itemPrice: mongoose.Types.Decimal128.fromString("1000.00"),
            reason: "size_fit_issue",
          },
        ],
      });

      const customerToken = generateAccessToken(
        {
          sub: user._id.toString(),
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

      const res = await request(app)
        .delete("/api/v1/customers/account")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          password: pass,
          confirmation: "DELETE MY ACCOUNT",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("ACTIVE_RETURNS_IN_PROGRESS");
    });
  });

  /* =========================================================================
     3. GOOGLE SIGN-IN RESURRECTION PREVENTION & REJECTION
     ========================================================================= */
  describe("3. Google Sign-In Hardening & Tombstone Protection", () => {
    it("blocks Google Sign-In with 403 ACCOUNT_DELETED when Google sub was previously deleted", async () => {
      const googleSub = `google-sub-deleted-${Date.now()}`;
      const email = `google-deleted-${Date.now()}@perm-del-test.com`;

      // 1. Create Google customer user
      const user = await User.create({
        email,
        firstName: "Google",
        lastName: "User",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isActive: true,
        isEmailVerified: true,
        authProviders: {
          google: {
            id: googleSub,
            email,
            linkedAt: new Date(),
          },
        },
      });
      createdUserIds.push(user._id);
      const cust = await Customer.create({ userId: user._id });
      createdCustomerIds.push(cust._id);

      const customerToken = generateAccessToken(
        {
          sub: user._id.toString(),
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

      // 2. Customer performs permanent deletion with confirmation
      const delRes = await request(app)
        .delete("/api/v1/customers/account")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          confirmation: "DELETE MY ACCOUNT",
          reason: "Deleting Google-based account",
        });

      expect(delRes.status).toBe(200);

      // 3. User attempts to login via Google Sign-In with the deleted Google identity
      const spy = jest.spyOn(googleAuthService, "verifyIdToken").mockResolvedValueOnce({
        sub: googleSub,
        email,
        emailVerified: true,
        firstName: "Google",
        lastName: "User",
      });

      try {
        const loginRes = await request(app)
          .post("/api/v1/auth/google")
          .send({ idToken: "valid.google.id.token" });

        expect(loginRes.status).toBe(403);
        expect(loginRes.body.code).toBe("ACCOUNT_DELETED");
        expect(loginRes.body.message).toContain("permanently deleted");

        // Verify account was NOT recreated in MongoDB
        const resurrectedUser = await User.findOne({
          $or: [{ "authProviders.google.id": googleSub }, { email }],
        });
        expect(resurrectedUser).toBeNull();
      } finally {
        spy.mockRestore();
      }
    });

    it("allows fresh and unrelated Google users to register normally", async () => {
      const freshGoogleSub = `google-fresh-sub-${Date.now()}`;
      const freshEmail = `google-fresh-${Date.now()}@perm-del-test.com`;

      const spy = jest.spyOn(googleAuthService, "verifyIdToken").mockResolvedValueOnce({
        sub: freshGoogleSub,
        email: freshEmail,
        emailVerified: true,
        firstName: "Priya",
        lastName: "Nair",
      });

      try {
        const res = await request(app)
          .post("/api/v1/auth/google")
          .send({ idToken: "valid.fresh.google.id.token" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.user.email).toBe(freshEmail);

        const createdUser = await User.findOne({ email: freshEmail });
        expect(createdUser).not.toBeNull();
        createdUserIds.push(createdUser._id);
      } finally {
        spy.mockRestore();
      }
    });

    it("blocks repeat Google Sign-In attempts consistently without recreating documents", async () => {
      const email = `repeat-deleted-${Date.now()}@perm-del-test.com`;
      const googleSub = `google-sub-repeat-${Date.now()}`;

      // 1. Create and permanently delete account
      const user = await User.create({
        email,
        firstName: "Repeat",
        lastName: "Test",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isActive: true,
        isEmailVerified: true,
        authProviders: { google: { id: googleSub, email, linkedAt: new Date() } },
      });
      createdUserIds.push(user._id);
      const cust = await Customer.create({ userId: user._id });
      createdCustomerIds.push(cust._id);

      const customerToken = generateAccessToken(
        { sub: user._id.toString(), role: ROLES.CUSTOMER, roles: [ROLES.CUSTOMER], authVersion: 1, permissionVersion: 1 },
        { context: TOKEN_CONTEXTS.CUSTOMER, audience: TOKEN_AUDIENCES.CUSTOMER }
      );

      await request(app)
        .delete("/api/v1/customers/account")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ confirmation: "DELETE MY ACCOUNT" });

      // 2. Attempt Google Sign-In 3 times consecutively
      for (let attempt = 1; attempt <= 3; attempt++) {
        const spy = jest.spyOn(googleAuthService, "verifyIdToken").mockResolvedValueOnce({
          sub: googleSub,
          email,
          emailVerified: true,
          firstName: "Repeat",
          lastName: "Test",
        });

        try {
          const res = await request(app)
            .post("/api/v1/auth/google")
            .send({ idToken: "repeat.token" });

          expect(res.status).toBe(403);
          expect(res.body.code).toBe("ACCOUNT_DELETED");

          // Ensure User remains null
          const checkUser = await User.findOne({ email });
          expect(checkUser).toBeNull();
        } finally {
          spy.mockRestore();
        }
      }
    });

    it("preserves 403 ACCOUNT_LINKING_VERIFICATION_REQUIRED for legitimate unverified active accounts", async () => {
      const unverifiedEmail = `legit-unverified-${Date.now()}@perm-del-test.com`;

      // Legitimate unverified active user (registered via email/password, not deleted)
      const user = await User.create({
        email: unverifiedEmail,
        password: await hashPassword("Password123!"),
        firstName: "Legit",
        lastName: "Unverified",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isActive: true,
        isEmailVerified: false, // NOT VERIFIED
        deletedAt: null, // NOT DELETED
      });
      createdUserIds.push(user._id);
      const cust = await Customer.create({ userId: user._id });
      createdCustomerIds.push(cust._id);

      const spy = jest.spyOn(googleAuthService, "verifyIdToken").mockResolvedValueOnce({
        sub: `google-sub-unverified-${Date.now()}`,
        email: unverifiedEmail,
        emailVerified: true,
        firstName: "Legit",
        lastName: "Unverified",
      });

      try {
        const res = await request(app)
          .post("/api/v1/auth/google")
          .send({ idToken: "unverified.id.token" });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe("ACCOUNT_LINKING_VERIFICATION_REQUIRED");
        expect(res.body.message).toContain("An unverified account exists with this email address");
      } finally {
        spy.mockRestore();
      }
    });

    it("successfully links and logs in legitimate verified active accounts", async () => {
      const verifiedEmail = `legit-verified-${Date.now()}@perm-del-test.com`;
      const googleSub = `google-sub-legit-${Date.now()}`;

      // Legitimate verified active user (registered via email/password)
      const user = await User.create({
        email: verifiedEmail,
        password: await hashPassword("Password123!"),
        firstName: "Verified",
        lastName: "Customer",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isActive: true,
        isEmailVerified: true, // VERIFIED
        deletedAt: null, // NOT DELETED
      });
      createdUserIds.push(user._id);
      const cust = await Customer.create({ userId: user._id });
      createdCustomerIds.push(cust._id);

      const spy = jest.spyOn(googleAuthService, "verifyIdToken").mockResolvedValueOnce({
        sub: googleSub,
        email: verifiedEmail,
        emailVerified: true,
        firstName: "Verified",
        lastName: "Customer",
      });

      try {
        const res = await request(app)
          .post("/api/v1/auth/google")
          .send({ idToken: "legit.verified.id.token" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const updatedUser = await User.findById(user._id);
        expect(updatedUser.authProviders?.google?.id).toBe(googleSub);
      } finally {
        spy.mockRestore();
      }
    });

    it("rejects residual soft-deleted accounts with 403 ACCOUNT_DELETED and does NOT throw unverified account error", async () => {
      const legacyDeletedEmail = `legacy-deleted-${Date.now()}@perm-del-test.com`;

      // Simulate a legacy soft-deleted customer (deleted before CUSTOMER-PERMANENT-DELETE-02, isEmailVerified false)
      const user = await User.create({
        email: legacyDeletedEmail,
        firstName: "Legacy",
        lastName: "Deleted",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isActive: false,
        isEmailVerified: false, // RESIDUAL UNVERIFIED FLAG
        deletedAt: new Date(Date.now() - 86400000), // SOFT-DELETED YESTERDAY
      });
      createdUserIds.push(user._id);
      const cust = await Customer.create({ userId: user._id, deletedAt: new Date(Date.now() - 86400000) });
      createdCustomerIds.push(cust._id);

      const spy = jest.spyOn(googleAuthService, "verifyIdToken").mockResolvedValueOnce({
        sub: `google-sub-legacy-${Date.now()}`,
        email: legacyDeletedEmail,
        emailVerified: true,
        firstName: "Legacy",
        lastName: "Deleted",
      });

      try {
        const res = await request(app)
          .post("/api/v1/auth/google")
          .send({ idToken: "legacy.deleted.id.token" });

        // MUST be 403 ACCOUNT_DELETED, NOT 403 ACCOUNT_LINKING_VERIFICATION_REQUIRED
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("ACCOUNT_DELETED");
        expect(res.body.code).not.toBe("ACCOUNT_LINKING_VERIFICATION_REQUIRED");

        // Verify that residual user was upgraded and purged per Option A
        const userInDb = await User.findById(user._id);
        expect(userInDb).toBeNull();
      } finally {
        spy.mockRestore();
      }
    });

    it("matches tombstone fingerprints across email case and whitespace normalization", async () => {
      const canonicalEmail = `norm-test-${Date.now()}@perm-del-test.com`;
      const googleSub = `google-sub-norm-${Date.now()}`;

      const user = await User.create({
        email: canonicalEmail,
        firstName: "Norm",
        lastName: "User",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isActive: true,
        isEmailVerified: true,
        authProviders: { google: { id: googleSub, email: canonicalEmail, linkedAt: new Date() } },
      });
      createdUserIds.push(user._id);
      const cust = await Customer.create({ userId: user._id });
      createdCustomerIds.push(cust._id);

      const customerToken = generateAccessToken(
        { sub: user._id.toString(), role: ROLES.CUSTOMER, roles: [ROLES.CUSTOMER], authVersion: 1, permissionVersion: 1 },
        { context: TOKEN_CONTEXTS.CUSTOMER, audience: TOKEN_AUDIENCES.CUSTOMER }
      );

      await request(app)
        .delete("/api/v1/customers/account")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ confirmation: "DELETE MY ACCOUNT" });

      // Incoming Google token with UPPERCASE and whitespace
      const upperEmail = `  ${canonicalEmail.toUpperCase()}  `;
      const spy = jest.spyOn(googleAuthService, "verifyIdToken").mockResolvedValueOnce({
        sub: `different-google-sub-${Date.now()}`,
        email: upperEmail,
        emailVerified: true,
        firstName: "Norm",
        lastName: "User",
      });

      try {
        const res = await request(app)
          .post("/api/v1/auth/google")
          .send({ idToken: "different.sub.same.email" });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe("ACCOUNT_DELETED");
      } finally {
        spy.mockRestore();
      }
    });
  });

  /* =========================================================================
     4. MIDDLEWARE STALE JWT PROTECTION
     ========================================================================= */
  describe("4. Middleware Stale JWT Protection", () => {
    it("rejects access with 401 USER_NOT_FOUND when user document was permanently deleted", async () => {
      const email = `stale-jwt-${Date.now()}@perm-del-test.com`;
      const pass = "Password123!";

      const user = await User.create({
        email,
        password: await hashPassword(pass),
        firstName: "Stale",
        lastName: "Token",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isActive: true,
        isEmailVerified: true,
      });
      createdUserIds.push(user._id);
      const cust = await Customer.create({ userId: user._id });
      createdCustomerIds.push(cust._id);

      const customerToken = generateAccessToken(
        {
          sub: user._id.toString(),
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

      // Verify token works before deletion
      const initialRes = await request(app)
        .get("/api/v1/addresses")
        .set("Authorization", `Bearer ${customerToken}`);
      expect(initialRes.status).toBe(200);

      // Perform deletion
      await request(app)
        .delete("/api/v1/customers/account")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          password: pass,
          confirmation: "DELETE MY ACCOUNT",
        });

      // Subsequent request with the same unexpired token MUST be rejected with 401 USER_NOT_FOUND
      const staleRes = await request(app)
        .get("/api/v1/addresses")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(staleRes.status).toBe(401);
      expect(staleRes.body.code).toBe("USER_NOT_FOUND");
    });
  });
});
