const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Product = require("../src/models/Product");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Employee = require("../src/models/Employee");
const { hashPassword } = require("../src/utils/password");
const { generateAccessToken, TOKEN_CONTEXTS, TOKEN_AUDIENCES } = require("../src/services/token.service");
const { encodeSecureId } = require("../src/utils/secure-id.util");
const { ROLES } = require("../src/constants/auth.constants");

describe("Phase 6C: Vendor Lifecycle, Google-Verified Identity & Approval-to-Seller Access", () => {
  let adminUser;
  let adminToken;
  let superadminEmployee;
  let testCategory;
  let testBrand;

  const TEST_MONGODB_URI = process.env.MONGODB_URI
    ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_p6c_test?")
    : "mongodb://127.0.0.1:27017/buybox_p6c_test?replicaSet=rs0";

  jest.setTimeout(45000);

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // 1. Provision Platform Super Administrator (ensure clean state for single-Superadmin invariant)
    await User.deleteMany({ role: ROLES.SUPER_ADMIN });
    const adminEmail = `superadmin-p6c-${Date.now()}@buybox.test`;
    adminUser = await User.create({
      email: adminEmail,
      password: await hashPassword("AdminPass123!"),
      firstName: "Super",
      lastName: "Admin",
      role: ROLES.SUPER_ADMIN,
      roles: [ROLES.SUPER_ADMIN],
      isActive: true,
      isEmailVerified: true,
    });

    superadminEmployee = await Employee.create({
      userId: adminUser._id,
      jobTitle: "Super Administrator",
      department: "Platform Engineering",
      employeeNumber: `EMP-P6C-${Date.now().toString().slice(-4)}`,
      isActive: true,
      status: "active",
    });

    adminToken = generateAccessToken(
      {
        sub: adminUser._id.toString(),
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

    // 2. Provision test Category and Brand for product tests
    testCategory = await Category.create({
      name: `Category P6C ${Date.now()}`,
      slug: `category-p6c-${Date.now()}`,
      isActive: true,
    });

    testBrand = await Brand.create({
      name: `Brand P6C ${Date.now()}`,
      slug: `brand-p6c-${Date.now()}`,
      isActive: true,
    });
  });

  afterAll(async () => {
    if (adminUser) await User.deleteOne({ _id: adminUser._id });
    if (superadminEmployee) await Employee.deleteOne({ _id: superadminEmployee._id });
    if (testCategory) await Category.deleteOne({ _id: testCategory._id });
    if (testBrand) await Brand.deleteOne({ _id: testBrand._id });
    await mongoose.disconnect();
  });

  describe("Requirement B: Preserve Google-Verified Customer Identity", () => {
    let googleCustomer;
    let customerToken;
    let originalPasswordHash;

    beforeAll(async () => {
      const email = `google-customer-${Date.now()}@gmail.com`;
      originalPasswordHash = await hashPassword("CustomerOriginalPass123!");

      googleCustomer = await User.create({
        email,
        password: originalPasswordHash,
        firstName: "Smriti",
        lastName: "GoogleUser",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isActive: true,
        isEmailVerified: true, // Verified by Google OAuth flow
        authProviders: {
          google: {
            id: `google-sub-${Date.now()}`,
            email,
          },
        },
      });

      customerToken = generateAccessToken(
        {
          sub: googleCustomer._id.toString(),
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
      if (googleCustomer) {
        await Vendor.deleteMany({ userId: googleCustomer._id });
        await User.deleteOne({ _id: googleCustomer._id });
      }
    });

    it("1 & 2. Verified Google customer applies to become a vendor using authenticated session; same User ID is retained and linked", async () => {
      const businessSlug = `smriti-crafts-${Date.now()}`;
      const res = await request(app)
        .post("/api/v1/vendors/register")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          email: googleCustomer.email,
          password: "AttemptedNewPassword999!",
          firstName: "Smriti",
          lastName: "GoogleUser",
          businessName: "Smriti Organic Crafts",
          businessSlug,
          phone: "+919876543210",
          businessAddress: {
            addressLine1: "123 Green Way",
            city: "Kolkata",
            state: "WB",
            postalCode: "700001",
            country: "IN",
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isLinkedApplication).toBe(true);
      expect(res.body.data.isExistingUser).toBe(true);

      // Verify the same canonical User ID is retained
      expect(res.body.data.user.id.toString()).toBe(googleCustomer._id.toString());
      expect(res.body.data.vendor).toBeDefined();

      // Check database state
      const dbVendor = await Vendor.findById(res.body.data.vendor.id);
      expect(dbVendor).toBeTruthy();
      expect(dbVendor.userId.toString()).toBe(googleCustomer._id.toString());
      expect(dbVendor.onboardingStatus).toBe("pending");
      expect(dbVendor.isActive).toBe(false);
    });

    it("3. Customer email verification remains true without redundant verification", async () => {
      const dbUser = await User.findById(googleCustomer._id);
      expect(dbUser.isEmailVerified).toBe(true);
    });

    it("4 & 5. No duplicate User document is created; customer identity remains singular", async () => {
      const count = await User.countDocuments({ email: googleCustomer.email });
      expect(count).toBe(1);
    });

    it("6. A different or unverified email does NOT inherit verification", async () => {
      const unverifiedEmail = `unverified-${Date.now()}@buybox.test`;
      const res = await request(app)
        .post("/api/v1/vendors/register")
        .send({
          email: unverifiedEmail,
          password: "SecurePassword123!",
          firstName: "Unverified",
          lastName: "Candidate",
          businessName: `Store ${Date.now()}`,
          phone: "+919876543218",
          businessAddress: { country: "IN" },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.isEmailVerified).toBe(false);

      const dbUser = await User.findOne({ email: unverifiedEmail });
      expect(dbUser.isEmailVerified).toBe(false);

      if (dbUser) {
        await Vendor.deleteMany({ userId: dbUser._id });
        await User.deleteOne({ _id: dbUser._id });
      }
    });

    it("7. Existing password hash is unchanged after vendor application", async () => {
      const dbUser = await User.findById(googleCustomer._id).select("+password");
      expect(dbUser.password).toBe(originalPasswordHash);
    });

    it("8. Google OAuth linkage remains intact", async () => {
      const dbUser = await User.findById(googleCustomer._id);
      expect(dbUser.authProviders?.google?.id).toBeDefined();
      expect(dbUser.authProviders.google.email).toBe(googleCustomer.email);
    });

    it("9 & 10. An unauthenticated registration request cannot claim an existing customer identity", async () => {
      // Create a separate customer
      const victimEmail = `victim-customer-${Date.now()}@gmail.com`;
      const victimUser = await User.create({
        email: victimEmail,
        password: await hashPassword("VictimPassword123!"),
        firstName: "Victim",
        lastName: "Customer",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isActive: true,
        isEmailVerified: true,
      });

      // Attacker tries to register vendor with victim's email without logging in
      const res = await request(app)
        .post("/api/v1/vendors/register")
        .send({
          email: victimEmail,
          password: "AttackerNewPassword123!",
          firstName: "Attacker",
          lastName: "Malicious",
          businessName: "Hostile Takeover Store",
          phone: "+919876543219",
          businessAddress: { country: "IN" },
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("EMAIL_ALREADY_EXISTS");

      // Verify victim's account was NOT modified
      const victimAfter = await User.findById(victimUser._id);
      expect(victimAfter.firstName).toBe("Victim");
      expect(victimAfter.roles).toEqual([ROLES.CUSTOMER]);

      const victimVendor = await Vendor.findOne({ userId: victimUser._id });
      expect(victimVendor).toBeNull();

      await User.deleteOne({ _id: victimUser._id });
    });
  });

  describe("Requirement A & D: Superadmin Lifecycle and Authoritative Identifiers", () => {
    let testVendorUser;
    let testVendorDoc;

    beforeAll(async () => {
      const email = `vendor-lifecycle-${Date.now()}@buybox.test`;
      testVendorUser = await User.create({
        email,
        password: await hashPassword("VendorPassword123!"),
        firstName: "Lifecycle",
        lastName: "Merchant",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER, ROLES.VENDOR],
        isActive: true,
        isEmailVerified: true,
      });

      testVendorDoc = await Vendor.create({
        userId: testVendorUser._id,
        businessName: "Lifecycle Test Store",
        businessSlug: `lifecycle-store-${Date.now()}`,
        onboardingStatus: "pending",
        isActive: false,
        businessAddress: { country: "IN" },
      });
    });

    afterAll(async () => {
      if (testVendorDoc) await Vendor.deleteOne({ _id: testVendorDoc._id });
      if (testVendorUser) await User.deleteOne({ _id: testVendorUser._id });
    });

    it("16 & 18. Vendor detail endpoint returns real persisted identifiers (Slug, Vendor ID, User ID, secureId)", async () => {
      const res = await request(app)
        .get(`/api/v1/admin/vendors/${testVendorDoc._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const v = res.body.data.vendor;

      expect(v.businessName).toBe("Lifecycle Test Store");
      expect(v.businessSlug).toBe(testVendorDoc.businessSlug);
      expect(v.secureId).toMatch(/^ven_/);
      expect(v.userId).toBeDefined();
      expect(v.userId._id.toString()).toBe(testVendorUser._id.toString());
      expect(v.userId.email).toBe(testVendorUser.email);
      expect(v.userId.isEmailVerified).toBe(true);
      expect(v.onboardingStatus).toBe("pending");
      expect(v.isActive).toBe(false);
    });

    it("13 & 11. Pending vendor can be approved by authorized administrator; status updates to approved and active", async () => {
      const secureId = encodeSecureId("vendor", testVendorDoc._id);
      const res = await request(app)
        .post(`/api/v1/admin/vendors/${secureId}/approve`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vendor.onboardingStatus).toBe("approved");
      expect(res.body.data.vendor.isActive).toBe(true);

      const dbVendor = await Vendor.findById(testVendorDoc._id);
      expect(dbVendor.onboardingStatus).toBe("approved");
      expect(dbVendor.isActive).toBe(true);
    });

    it("14. Unauthorized users (e.g. customers) cannot approve vendors", async () => {
      const customerEmail = `attacker-cust-${Date.now()}@buybox.test`;
      const cust = await User.create({
        email: customerEmail,
        password: await hashPassword("Pass123!"),
        firstName: "Attacker",
        lastName: "Customer",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isActive: true,
      });

      const custToken = generateAccessToken(
        { sub: cust._id.toString(), role: ROLES.CUSTOMER },
        { context: TOKEN_CONTEXTS.CUSTOMER, audience: TOKEN_AUDIENCES.CUSTOMER }
      );

      const secureId = encodeSecureId("vendor", testVendorDoc._id);
      const res = await request(app)
        .post(`/api/v1/admin/vendors/${secureId}/approve`)
        .set("Authorization", `Bearer ${custToken}`);

      expect(res.status).toBe(403);
      await User.deleteOne({ _id: cust._id });
    });

    it("15. Suspended or deactivated vendors remain blocked from marketplace operations", async () => {
      // Suspend vendor
      await Vendor.updateOne({ _id: testVendorDoc._id }, { $set: { onboardingStatus: "suspended", isActive: false } });

      const vendorToken = generateAccessToken(
        {
          sub: testVendorUser._id.toString(),
          role: ROLES.VENDOR,
          roles: [ROLES.CUSTOMER, ROLES.VENDOR],
        },
        {
          context: TOKEN_CONTEXTS.VENDOR,
          audience: TOKEN_AUDIENCES.VENDOR,
        }
      );

      // Attempt vendor-restricted operation (download import template requires approved vendor)
      const res = await request(app)
        .get("/api/v1/products/vendor/import/template")
        .set("Authorization", `Bearer ${vendorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("VENDOR_ONBOARDING_NOT_APPROVED");

      // Restore to approved for subsequent tests
      await Vendor.updateOne({ _id: testVendorDoc._id }, { $set: { onboardingStatus: "approved", isActive: true } });
    });
  });

  describe("Requirement E: Approved Vendor Can Use Merchant Console", () => {
    let merchantUser;
    let merchantVendor;
    let merchantToken;
    let otherVendorUser;
    let otherVendor;
    let otherVendorToken;
    let createdProduct;

    beforeAll(async () => {
      // Approved Vendor 1
      const email1 = `merchant1-${Date.now()}@buybox.test`;
      merchantUser = await User.create({
        email: email1,
        password: await hashPassword("MerchantPass123!"),
        firstName: "Merchant",
        lastName: "One",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER, ROLES.VENDOR],
        isActive: true,
        isEmailVerified: true,
      });

      merchantVendor = await Vendor.create({
        userId: merchantUser._id,
        businessName: "Merchant One Crafts",
        businessSlug: `merchant-one-${Date.now()}`,
        onboardingStatus: "approved",
        isActive: true,
        businessAddress: { country: "IN" },
      });

      merchantToken = generateAccessToken(
        {
          sub: merchantUser._id.toString(),
          role: ROLES.VENDOR,
          roles: [ROLES.CUSTOMER, ROLES.VENDOR],
          authVersion: 1,
          permissionVersion: 1,
        },
        {
          context: TOKEN_CONTEXTS.VENDOR,
          audience: TOKEN_AUDIENCES.VENDOR,
        }
      );

      // Approved Vendor 2 (For multi-vendor tenant isolation tests)
      const email2 = `merchant2-${Date.now()}@buybox.test`;
      otherVendorUser = await User.create({
        email: email2,
        password: await hashPassword("MerchantPass123!"),
        firstName: "Merchant",
        lastName: "Two",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER, ROLES.VENDOR],
        isActive: true,
        isEmailVerified: true,
      });

      otherVendor = await Vendor.create({
        userId: otherVendorUser._id,
        businessName: "Merchant Two Supplies",
        businessSlug: `merchant-two-${Date.now()}`,
        onboardingStatus: "approved",
        isActive: true,
        businessAddress: { country: "IN" },
      });

      otherVendorToken = generateAccessToken(
        {
          sub: otherVendorUser._id.toString(),
          role: ROLES.VENDOR,
          roles: [ROLES.CUSTOMER, ROLES.VENDOR],
          authVersion: 1,
          permissionVersion: 1,
        },
        {
          context: TOKEN_CONTEXTS.VENDOR,
          audience: TOKEN_AUDIENCES.VENDOR,
        }
      );
    });

    afterAll(async () => {
      if (createdProduct) await Product.deleteOne({ _id: createdProduct._id });
      if (merchantVendor) await Vendor.deleteOne({ _id: merchantVendor._id });
      if (merchantUser) await User.deleteOne({ _id: merchantUser._id });
      if (otherVendor) await Vendor.deleteOne({ _id: otherVendor._id });
      if (otherVendorUser) await User.deleteOne({ _id: otherVendorUser._id });
    });

    it("19. Approved vendor can authenticate and reach permitted merchant routes (/products/vendor/my)", async () => {
      const res = await request(app)
        .get("/api/v1/products/vendor/my")
        .set("Authorization", `Bearer ${merchantToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("20 & 22. Approved vendor can create a product; ownership is strictly assigned to the correct vendor", async () => {
      const productSlug = `handmade-organic-silk-scarf-${Date.now()}`;
      const res = await request(app)
        .post("/api/v1/products")
        .set("Authorization", `Bearer ${merchantToken}`)
        .send({
          name: "Handmade Organic Silk Scarf",
          slug: productSlug,
          sku: `SCARF-ORG-${Date.now()}`,
          description: "Premium handcrafted organic silk scarf with eco-friendly dyes.",
          categoryId: testCategory._id.toString(),
          price: 1499,
          stockQuantity: 0,
          status: "draft",
        });

      if (res.status !== 201) {
        console.error("PRODUCT CREATE ERROR:", res.status, res.body);
      }

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product).toBeDefined();

      createdProduct = res.body.data.product;
      expect(createdProduct.name).toBe("Handmade Organic Silk Scarf");

      // Verify product vendor ownership in database
      const dbProduct = await Product.findById(createdProduct._id);
      expect(dbProduct.vendorId.toString()).toBe(merchantVendor._id.toString());
    });

    it("21. Approved vendor can download bulk import template", async () => {
      const res = await request(app)
        .get("/api/v1/products/vendor/import/template")
        .set("Authorization", `Bearer ${merchantToken}`);

      expect(res.status).toBe(200);
      expect(res.header["content-type"]).toMatch(/csv/i);
    });

    it("23. Pending vendor cannot create products", async () => {
      const pendingEmail = `pending-vend-${Date.now()}@buybox.test`;
      const pendingUser = await User.create({
        email: pendingEmail,
        password: await hashPassword("Pass123!"),
        firstName: "Pending",
        lastName: "Vendor",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER, ROLES.VENDOR],
        isActive: true,
      });

      const pendingVendor = await Vendor.create({
        userId: pendingUser._id,
        businessName: "Pending Store",
        businessSlug: `pending-store-${Date.now()}`,
        onboardingStatus: "pending",
        isActive: false,
        businessAddress: { country: "IN" },
      });

      const pendingToken = generateAccessToken(
        {
          sub: pendingUser._id.toString(),
          role: ROLES.VENDOR,
          roles: [ROLES.CUSTOMER, ROLES.VENDOR],
        },
        {
          context: TOKEN_CONTEXTS.VENDOR,
          audience: TOKEN_AUDIENCES.VENDOR,
        }
      );

      const res = await request(app)
        .post("/api/v1/products")
        .set("Authorization", `Bearer ${pendingToken}`)
        .send({
          name: "Unauthorized Product",
          slug: `unauthorized-prod-${Date.now()}`,
          sku: `UNAUTH-SKU-${Date.now()}`,
          description: "Should fail because vendor is pending.",
          categoryId: testCategory._id.toString(),
          price: 100,
          stockQuantity: 0,
          status: "draft",
        });

      expect(res.status).toBe(404); // Vendor profile not found/inactive check throws 404 VENDOR_NOT_FOUND

      await Vendor.deleteOne({ _id: pendingVendor._id });
      await User.deleteOne({ _id: pendingUser._id });
    });

    it("25. Multi-vendor tenant isolation: Vendor B cannot modify Vendor A's product", async () => {
      const res = await request(app)
        .patch(`/api/v1/products/${createdProduct._id}`)
        .set("Authorization", `Bearer ${otherVendorToken}`)
        .send({
          name: "Malicious Tampered Product Title",
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("PRODUCT_OWNERSHIP_REQUIRED");

      // Verify product was not altered
      const dbProduct = await Product.findById(createdProduct._id);
      expect(dbProduct.name).toBe("Handmade Organic Silk Scarf");
    });

    it("26. Customer storefront login continues to work for the same shared account", async () => {
      const customerStorefrontToken = generateAccessToken(
        {
          sub: merchantUser._id.toString(),
          role: ROLES.CUSTOMER,
          roles: [ROLES.CUSTOMER, ROLES.VENDOR],
        },
        {
          context: TOKEN_CONTEXTS.CUSTOMER,
          audience: TOKEN_AUDIENCES.CUSTOMER,
        }
      );

      // Verify customer storefront route access (GET /api/v1/customers/me)
      const res = await request(app)
        .get("/api/v1/customers/me")
        .set("Authorization", `Bearer ${customerStorefrontToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customer.userId.toString()).toBe(merchantUser._id.toString());
    });
  });

  describe("Requirement F: Phase 6C.2 Shared Customer/Vendor Session Boundary Security Suite", () => {
    let sharedUser;
    let sharedVendor;
    let customerContextToken;
    let vendorContextToken;

    beforeAll(async () => {
      const email = `shared-p6c2-${Date.now()}@buybox.test`;
      sharedUser = await User.create({
        email,
        password: await hashPassword("SharedBoundaryPass123!"),
        firstName: "Shared",
        lastName: "SecurityUser",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER, ROLES.VENDOR],
        isActive: true,
        isEmailVerified: true,
      });

      sharedVendor = await Vendor.create({
        userId: sharedUser._id,
        businessName: "Boundary Test Vendor Store",
        businessSlug: `boundary-store-${Date.now()}`,
        onboardingStatus: "approved",
        isActive: true,
        businessAddress: { country: "IN" },
      });

      customerContextToken = generateAccessToken(
        {
          sub: sharedUser._id.toString(),
          role: ROLES.CUSTOMER,
          roles: [ROLES.CUSTOMER, ROLES.VENDOR],
          authVersion: 1,
          permissionVersion: 1,
        },
        {
          context: TOKEN_CONTEXTS.CUSTOMER,
          audience: TOKEN_AUDIENCES.CUSTOMER,
        }
      );

      vendorContextToken = generateAccessToken(
        {
          sub: sharedUser._id.toString(),
          role: ROLES.VENDOR,
          roles: [ROLES.CUSTOMER, ROLES.VENDOR],
          authVersion: 1,
          permissionVersion: 1,
        },
        {
          context: TOKEN_CONTEXTS.VENDOR,
          audience: TOKEN_AUDIENCES.VENDOR,
        }
      );
    });

    afterAll(async () => {
      if (sharedVendor) await Vendor.deleteOne({ _id: sharedVendor._id });
      if (sharedUser) await User.deleteOne({ _id: sharedUser._id });
    });

    it("27. Customer token for shared account is strictly rejected on GET /api/v1/vendors/me/dashboard with 403 INVALID_SESSION_CONTEXT", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me/dashboard")
        .set("Authorization", `Bearer ${customerContextToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INVALID_SESSION_CONTEXT");
    });

    it("28. Customer token for shared account is strictly rejected on GET /api/v1/products/vendor/my with 403 INVALID_SESSION_CONTEXT", async () => {
      const res = await request(app)
        .get("/api/v1/products/vendor/my")
        .set("Authorization", `Bearer ${customerContextToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INVALID_SESSION_CONTEXT");
    });

    it("29. Customer token for shared account is rejected on POST /api/v1/products with 403 and creates ZERO records in DB", async () => {
      const initialCount = await Product.countDocuments({ vendorId: sharedVendor._id });
      const productSlug = `unauthorized-p6c2-prod-${Date.now()}`;

      const res = await request(app)
        .post("/api/v1/products")
        .set("Authorization", `Bearer ${customerContextToken}`)
        .send({
          name: "Malicious Injection Scarf",
          slug: productSlug,
          sku: `MALICIOUS-${Date.now()}`,
          description: "Customer context must not create vendor catalog products",
          categoryId: testCategory._id.toString(),
          price: 2499,
          stockQuantity: 50,
          status: "draft",
        });

      expect(res.status).toBe(403);
      const postCount = await Product.countDocuments({ vendorId: sharedVendor._id });
      expect(postCount).toBe(initialCount);

      const orphan = await Product.findOne({ slug: productSlug });
      expect(orphan).toBeNull();
    });

    it("30. Customer token for shared account is rejected with 403 across all merchant console self-service endpoints", async () => {
      const merchantEndpoints = [
        "/api/v1/inventory/vendor/my",
        "/api/v1/orders/vendor/my",
        "/api/v1/vendor-settlements/vendor/my",
        "/api/v1/warehouses/vendor/my",
        "/api/v1/return-requests/vendor/my",
        "/api/v1/shipments/vendor/my",
        "/api/v1/reviews/vendor/my",
        "/api/v1/questions/vendor/my",
      ];

      for (const endpoint of merchantEndpoints) {
        const res = await request(app)
          .get(endpoint)
          .set("Authorization", `Bearer ${customerContextToken}`);

        expect(res.status).toBe(403);
      }
    });

    it("31. Vendor token for the same shared account retains authorized access to all merchant console endpoints", async () => {
      // 1. Dashboard
      const dashRes = await request(app)
        .get("/api/v1/vendors/me/dashboard")
        .set("Authorization", `Bearer ${vendorContextToken}`);
      expect(dashRes.status).toBe(200);
      expect(dashRes.body.success).toBe(true);

      // 2. Products list
      const prodsRes = await request(app)
        .get("/api/v1/products/vendor/my")
        .set("Authorization", `Bearer ${vendorContextToken}`);
      expect(prodsRes.status).toBe(200);
      expect(Array.isArray(prodsRes.body.data)).toBe(true);

      // 3. Product creation
      const validSlug = `valid-p6c2-prod-${Date.now()}`;
      const createRes = await request(app)
        .post("/api/v1/products")
        .set("Authorization", `Bearer ${vendorContextToken}`)
        .send({
          name: "Legitimate Vendor Scarf",
          slug: validSlug,
          sku: `LEGIT-${Date.now()}`,
          description: "Approved vendor creating product under vendor context",
          categoryId: testCategory._id.toString(),
          price: 2499,
          stockQuantity: 0,
          status: "draft",
        });
      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);

      // Cleanup created product
      await Product.deleteOne({ slug: validSlug });
    });

    it("32. Client-supplied context or spoofed headers cannot elevate customer token to vendor session", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me/dashboard")
        .set("Authorization", `Bearer ${customerContextToken}`)
        .set("x-role", "vendor")
        .set("x-context", "vendor");

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INVALID_SESSION_CONTEXT");
    });

    it("33. Vendor tokens cannot access administrator or Superadmin endpoints (/api/v1/admin/*)", async () => {
      const res = await request(app)
        .get("/api/v1/admin/dashboard/stats")
        .set("Authorization", `Bearer ${vendorContextToken}`);

      expect([401, 403]).toContain(res.status);
    });

    it("34. Unapproved or suspended vendor is denied access even with vendor token", async () => {
      // Temporarily deactivate vendor
      await Vendor.updateOne({ _id: sharedVendor._id }, { $set: { isActive: false } });

      const res = await request(app)
        .get("/api/v1/vendors/me/dashboard")
        .set("Authorization", `Bearer ${vendorContextToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("VENDOR_INACTIVE");

      // Restore active status
      await Vendor.updateOne({ _id: sharedVendor._id }, { $set: { isActive: true } });
    });
  });
});
