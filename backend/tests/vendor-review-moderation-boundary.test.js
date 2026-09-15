const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const Customer = require("../src/models/Customer");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Product = require("../src/models/Product");
const Review = require("../src/models/Review");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const RolePermission = require("../src/models/RolePermission");
const EmployeeRole = require("../src/models/EmployeeRole");
const EmployeePermissionGrant = require("../src/models/EmployeePermissionGrant");
const EmployeePermissionRestriction = require("../src/models/EmployeePermissionRestriction");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");
const {
  incrementAuthVersion,
  incrementPermissionVersion,
} = require("../src/services/authorization.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_review_boundary_test?")
  : "mongodb://127.0.0.1:27017/buybox_review_boundary_test?replicaSet=rs0";

describe("Phase 3B-0 — Vendor Review Moderation Security Boundary & PBAC Hardening", () => {
  let createdPermissions = new Map();
  let testCategory;

  // Helper to ensure permissions exist in DB
  async function getOrCreatePermission(slug) {
    if (createdPermissions.has(slug)) {
      return createdPermissions.get(slug);
    }
    let perm = await Permission.findOne({ slug });
    if (!perm) {
      perm = await Permission.create({
        slug,
        name: `Test Perm ${slug}`,
        module: slug.split(":")[0],
        description: `Description for ${slug}`,
        isActive: true,
      });
    }
    createdPermissions.set(slug, perm);
    return perm;
  }

  // Helper to assign dynamic role to employee
  async function assignRoleWithPermissions(employeeId, roleSlug, permissionSlugs) {
    let role = await Role.findOne({ slug: roleSlug });
    if (!role) {
      role = await Role.create({
        slug: roleSlug,
        name: `Role ${roleSlug}`,
        description: `Test role ${roleSlug}`,
        isActive: true,
      });
    }

    for (const slug of permissionSlugs) {
      const perm = await getOrCreatePermission(slug);
      await RolePermission.findOneAndUpdate(
        { roleId: role._id, permissionId: perm._id },
        { roleId: role._id, permissionId: perm._id },
        { upsert: true, new: true }
      );
    }

    const employeeRole = await EmployeeRole.create({
      employeeId,
      roleId: role._id,
      isActive: true,
      expiresAt: null,
    });

    return { role, employeeRole };
  }

  // Helper to create test employee
  async function createTestEmployee(options = {}) {
    const status = options.status || "active";
    const user = await User.create({
      firstName: "Staff",
      lastName: "Tester",
      email: `staff_${Date.now()}_${Math.random().toString(36).substring(7)}@test-boundary.com`,
      password: "Password123!",
      role: options.userRole || ROLES.MANAGER,
      isActive: options.isActive !== undefined ? options.isActive : true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const employee = await Employee.create({
      userId: user._id,
      employeeNumber: `EMP_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`,
      jobTitle: "Content Moderator",
      department: "Trust & Safety",
      status,
    });

    const token = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
    });

    return { user, employee, token };
  }

  // Helper to create test vendor
  async function createTestVendor(options = {}) {
    const user = await User.create({
      firstName: options.firstName || "Vendor",
      lastName: "User",
      email: `vendor_${Date.now()}_${Math.random().toString(36).substring(7)}@test-boundary.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const vendor = await Vendor.create({
      userId: user._id,
      businessName: `Vendor Corp ${Date.now()}_${Math.random().toString(36).substring(7)}`,
      businessSlug: `vendor-corp-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
      onboardingStatus: "approved",
    });

    const token = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
    });

    return { user, vendor, token };
  }

  // Helper to create test customer
  async function createTestCustomer() {
    const user = await User.create({
      firstName: "Customer",
      lastName: "Reviewer",
      email: `customer_${Date.now()}_${Math.random().toString(36).substring(7)}@test-boundary.com`,
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const customer = await Customer.create({
      userId: user._id,
      isActive: true,
    });

    const token = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
    });

    return { user, customer, token };
  }

  // Helper to create active product owned by a vendor
  async function createTestProduct(vendorId, overrides = {}) {
    const product = await Product.create({
      name: `Product ${Date.now()}_${Math.random().toString(36).substring(7)}`,
      slug: `product-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      sku: `SKU-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
      categoryId: testCategory._id,
      vendorId,
      price: 199.99,
      status: "active",
      deletedAt: null,
      ...overrides,
    });

    return product;
  }

  // Helper to create a review on a product
  async function createTestReview(productId, customerId, overrides = {}) {
    const review = await Review.create({
      productId,
      customerId,
      orderId: new mongoose.Types.ObjectId(),
      rating: 5,
      title: "Excellent Product",
      comment: "Highly recommended item.",
      status: "pending",
      isVerifiedPurchase: true,
      ...overrides,
    });

    return review;
  }

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }
    await getOrCreatePermission(PERMISSIONS.REVIEWS_READ);
    await getOrCreatePermission(PERMISSIONS.REVIEWS_MANAGE);
    await getOrCreatePermission(PERMISSIONS.REVIEWS_MODERATE);

    testCategory = await Category.create({
      name: "Electronics Test",
      slug: `electronics-test-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
    });
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ email: /@test-boundary\.com$/ });
      await Employee.deleteMany({ department: "Trust & Safety" });
      await Customer.deleteMany({});
      await Vendor.deleteMany({ businessSlug: /^vendor-corp-/ });
      await Role.deleteMany({ slug: /^test_boundary_/ });
      await Review.deleteMany({});
      await Product.deleteMany({ slug: /^product-/ });
      await Category.deleteMany({ slug: /^electronics-test-/ });
    } catch (e) {
      // Ignored in cleanup
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  // ---------------------------------------------------------------------------
  // 1. Vendor Denial Tests (Scenarios 1-4)
  // ---------------------------------------------------------------------------
  describe("1. Vendor Denial Tests", () => {
    test("1. Vendor attempts review moderation -> 403 INSUFFICIENT_PERMISSIONS", async () => {
      const { token: vendorToken } = await createTestVendor();
      const { customer } = await createTestCustomer();
      const { vendor: otherVendor } = await createTestVendor();
      const product = await createTestProduct(otherVendor._id);
      const review = await createTestReview(product._id, customer._id);

      const res = await request(app)
        .patch(`/api/v1/reviews/${review._id}/moderate`)
        .set("Authorization", `Bearer ${vendorToken}`)
        .send({ status: "approved" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("2. Vendor owns the reviewed product -> still 403 INSUFFICIENT_PERMISSIONS on moderation", async () => {
      const { vendor, token: vendorToken } = await createTestVendor();
      const { customer } = await createTestCustomer();
      const product = await createTestProduct(vendor._id);
      const review = await createTestReview(product._id, customer._id);

      // Even though vendor owns the product, moderation is platform-only
      const res = await request(app)
        .patch(`/api/v1/reviews/${review._id}/moderate`)
        .set("Authorization", `Bearer ${vendorToken}`)
        .send({ status: "approved" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("3. Vendor has legacy reviews:manage fallback -> still 403 on reviews:moderate endpoint", async () => {
      const { token: vendorToken } = await createTestVendor();
      const { customer } = await createTestCustomer();
      const { vendor: v2 } = await createTestVendor();
      const product = await createTestProduct(v2._id);
      const review = await createTestReview(product._id, customer._id);

      // Legacy fallback gives Vendor reviews:manage, NOT reviews:moderate
      const res = await request(app)
        .patch(`/api/v1/reviews/${review._id}/moderate`)
        .set("Authorization", `Bearer ${vendorToken}`)
        .send({
          status: "rejected",
          moderationReason: "Spam content detected",
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("4. Vendor has unrelated permissions (products:create, inventory:manage, etc.) -> still 403 on moderation", async () => {
      const { token: vendorToken } = await createTestVendor();
      const nonExistentReviewId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .patch(`/api/v1/reviews/${nonExistentReviewId}/moderate`)
        .set("Authorization", `Bearer ${vendorToken}`)
        .send({ status: "approved" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Vendor Response Tests (Scenarios 5-7)
  // ---------------------------------------------------------------------------
  describe("2. Vendor Response Tests", () => {
    test("5. Vendor responds to own product review -> allowed (200, updates vendorResponse & vendorRespondedAt)", async () => {
      const { vendor, token: vendorToken } = await createTestVendor();
      const { customer } = await createTestCustomer();
      const product = await createTestProduct(vendor._id);
      const review = await createTestReview(product._id, customer._id);

      const responseText = "Thank you for the wonderful feedback!";
      const res = await request(app)
        .patch(`/api/v1/reviews/${review._id}/vendor-response`)
        .set("Authorization", `Bearer ${vendorToken}`)
        .send({ response: responseText });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Vendor response added successfully");
      expect(res.body.data.vendorResponse).toBe(responseText);
      expect(res.body.data.vendorRespondedAt).toBeDefined();

      const updated = await Review.findById(review._id);
      expect(updated.vendorResponse).toBe(responseText);
      expect(updated.vendorRespondedAt).toBeInstanceOf(Date);
    });

    test("6. Vendor responds to another vendor's review -> denied (403 REVIEW_VENDOR_ACCESS_DENIED)", async () => {
      const { token: vendorAToken } = await createTestVendor();
      const { vendor: vendorB } = await createTestVendor();
      const { customer } = await createTestCustomer();
      const productB = await createTestProduct(vendorB._id);
      const reviewB = await createTestReview(productB._id, customer._id);

      // Vendor A attempts to reply to Vendor B's product review
      const res = await request(app)
        .patch(`/api/v1/reviews/${reviewB._id}/vendor-response`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({ response: "Unauthorized reply attempt" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("REVIEW_VENDOR_ACCESS_DENIED");
      expect(res.body.message).toContain("You are not allowed to respond to this review");
    });

    test("7. Vendor cannot use moderation endpoint as a substitute for response", async () => {
      const { vendor, token: vendorToken } = await createTestVendor();
      const { customer } = await createTestCustomer();
      const product = await createTestProduct(vendor._id);
      const review = await createTestReview(product._id, customer._id);

      // Attempt to self-approve review using moderation endpoint
      const res = await request(app)
        .patch(`/api/v1/reviews/${review._id}/moderate`)
        .set("Authorization", `Bearer ${vendorToken}`)
        .send({ status: "approved" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Employee Moderation Tests (Scenarios 8-14)
  // ---------------------------------------------------------------------------
  describe("3. Employee Moderation Tests", () => {
    test("8. Employee with reviews:moderate -> allowed (200, status updated to approved)", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_boundary_mod_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MODERATE]
      );

      const { vendor } = await createTestVendor();
      const { customer } = await createTestCustomer();
      const product = await createTestProduct(vendor._id);
      const review = await createTestReview(product._id, customer._id);

      const res = await request(app)
        .patch(`/api/v1/reviews/${review._id}/moderate`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "approved" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("approved");
      expect(res.body.data.moderatedAt).toBeDefined();

      const updated = await Review.findById(review._id);
      expect(updated.status).toBe("approved");
    });

    test("9. Employee without reviews:moderate (only reviews:manage) -> 403 INSUFFICIENT_PERMISSIONS", async () => {
      const { employee, token } = await createTestEmployee();
      // Employee has reviews:manage, but NOT reviews:moderate
      await assignRoleWithPermissions(
        employee._id,
        `test_boundary_nomod_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MANAGE]
      );

      const { vendor } = await createTestVendor();
      const { customer } = await createTestCustomer();
      const product = await createTestProduct(vendor._id);
      const review = await createTestReview(product._id, customer._id);

      const res = await request(app)
        .patch(`/api/v1/reviews/${review._id}/moderate`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "approved" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("10. Direct grant of reviews:moderate without assigned role -> allowed (200)", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.REVIEWS_MODERATE);

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      const { vendor } = await createTestVendor();
      const { customer } = await createTestCustomer();
      const product = await createTestProduct(vendor._id);
      const review = await createTestReview(product._id, customer._id);

      const res = await request(app)
        .patch(`/api/v1/reviews/${review._id}/moderate`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          status: "rejected",
          moderationReason: "Violates community standards",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("rejected");
      expect(res.body.data.moderationReason).toBe("Violates community standards");
    });

    test("11. Direct restriction on reviews:moderate overrides role and grant -> denied (403)", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.REVIEWS_MODERATE);

      // Active role with reviews:moderate
      await assignRoleWithPermissions(
        employee._id,
        `test_boundary_restr_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MODERATE]
      );

      // Direct grant with reviews:moderate
      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      // Direct restriction (must strictly dominate)
      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      const { vendor } = await createTestVendor();
      const { customer } = await createTestCustomer();
      const product = await createTestProduct(vendor._id);
      const review = await createTestReview(product._id, customer._id);

      const res = await request(app)
        .patch(`/api/v1/reviews/${review._id}/moderate`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "approved" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("12. Expired direct grant of reviews:moderate -> denied (403)", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.REVIEWS_MODERATE);

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: new Date(Date.now() - 60000), // Expired 1 min ago
      });

      const { vendor } = await createTestVendor();
      const { customer } = await createTestCustomer();
      const product = await createTestProduct(vendor._id);
      const review = await createTestReview(product._id, customer._id);

      const res = await request(app)
        .patch(`/api/v1/reviews/${review._id}/moderate`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "approved" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("13. Suspended employee with role granting reviews:moderate -> denied (403)", async () => {
      const { employee, token } = await createTestEmployee({ status: "suspended" });
      await assignRoleWithPermissions(
        employee._id,
        `test_boundary_susp_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MODERATE]
      );

      const { vendor } = await createTestVendor();
      const { customer } = await createTestCustomer();
      const product = await createTestProduct(vendor._id);
      const review = await createTestReview(product._id, customer._id);

      const res = await request(app)
        .patch(`/api/v1/reviews/${review._id}/moderate`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "approved" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("14. Terminated employee with role granting reviews:moderate -> denied (403)", async () => {
      const { employee, token } = await createTestEmployee({ status: "terminated" });
      await assignRoleWithPermissions(
        employee._id,
        `test_boundary_term_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MODERATE]
      );

      const { vendor } = await createTestVendor();
      const { customer } = await createTestCustomer();
      const product = await createTestProduct(vendor._id);
      const review = await createTestReview(product._id, customer._id);

      const res = await request(app)
        .patch(`/api/v1/reviews/${review._id}/moderate`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "approved" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Multi-Role Scenarios (Scenarios 15-17)
  // ---------------------------------------------------------------------------
  describe("4. Multi-Role Scenarios", () => {
    test("15. Employee with multiple roles none of which grant reviews:moderate -> denied (403)", async () => {
      const { employee, token } = await createTestEmployee();
      // Role 1: reviews:manage, reviews:read
      await assignRoleWithPermissions(
        employee._id,
        `test_boundary_mr1_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_READ, PERMISSIONS.REVIEWS_MANAGE]
      );
      // Role 2: vendors:read, inventory:read
      await assignRoleWithPermissions(
        employee._id,
        `test_boundary_mr2_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.VENDORS_READ, PERMISSIONS.INVENTORY_READ]
      );

      const { vendor } = await createTestVendor();
      const { customer } = await createTestCustomer();
      const product = await createTestProduct(vendor._id);
      const review = await createTestReview(product._id, customer._id);

      const res = await request(app)
        .patch(`/api/v1/reviews/${review._id}/moderate`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "approved" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("16. Employee with multiple roles where one grants reviews:moderate -> allowed (200)", async () => {
      const { employee, token } = await createTestEmployee();
      // Role 1: support ticket management
      await assignRoleWithPermissions(
        employee._id,
        `test_boundary_mr3_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.SUPPORT_TICKETS_READ, PERMISSIONS.SUPPORT_TICKETS_MANAGE]
      );
      // Role 2: moderation role
      await assignRoleWithPermissions(
        employee._id,
        `test_boundary_mr4_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MODERATE]
      );

      const { vendor } = await createTestVendor();
      const { customer } = await createTestCustomer();
      const product = await createTestProduct(vendor._id);
      const review = await createTestReview(product._id, customer._id);

      const res = await request(app)
        .patch(`/api/v1/reviews/${review._id}/moderate`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "approved" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("approved");
    });

    test("17. Restriction on reviews:moderate overrides multiple granting roles -> denied (403)", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.REVIEWS_MODERATE);

      // Role 1 grants reviews:moderate
      await assignRoleWithPermissions(
        employee._id,
        `test_boundary_mr5_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MODERATE, PERMISSIONS.REVIEWS_READ]
      );
      // Role 2 also grants reviews:moderate
      await assignRoleWithPermissions(
        employee._id,
        `test_boundary_mr6_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MODERATE, PERMISSIONS.REVIEWS_MANAGE]
      );

      // Direct restriction applied
      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      const { vendor } = await createTestVendor();
      const { customer } = await createTestCustomer();
      const product = await createTestProduct(vendor._id);
      const review = await createTestReview(product._id, customer._id);

      const res = await request(app)
        .patch(`/api/v1/reviews/${review._id}/moderate`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "approved" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Version Security (Scenarios 18-19)
  // ---------------------------------------------------------------------------
  describe("5. Version Security", () => {
    test("18. Stale permissionVersion: Token issued before reviews:moderate role assignment, DB recalculation resolves permission -> 200", async () => {
      const { user, employee, token } = await createTestEmployee();
      // Token created when employee had NO roles/permissions

      // Assign moderation role in DB
      await assignRoleWithPermissions(
        employee._id,
        `test_boundary_pv_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MODERATE]
      );

      // Signal staleness by incrementing user's permissionVersion in DB
      await incrementPermissionVersion(user._id);

      const { vendor } = await createTestVendor();
      const { customer } = await createTestCustomer();
      const product = await createTestProduct(vendor._id);
      const review = await createTestReview(product._id, customer._id);

      const res = await request(app)
        .patch(`/api/v1/reviews/${review._id}/moderate`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "approved" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("approved");
    });

    test("19. Stale authVersion: Token issued before authVersion bumped in DB -> 401 AUTH_VERSION_MISMATCH", async () => {
      const { user, employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_boundary_av_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MODERATE]
      );

      // Invalidate authVersion in DB
      await incrementAuthVersion(user._id);

      const { vendor } = await createTestVendor();
      const { customer } = await createTestCustomer();
      const product = await createTestProduct(vendor._id);
      const review = await createTestReview(product._id, customer._id);

      const res = await request(app)
        .patch(`/api/v1/reviews/${review._id}/moderate`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "approved" });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTH_VERSION_MISMATCH");
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Super Admin Security (Scenario 20)
  // ---------------------------------------------------------------------------
  describe("6. Super Admin Security", () => {
    test("20. Super Admin retains moderation capability through dynamic authorization -> 200", async () => {
      const { employee, token } = await createTestEmployee({ userRole: ROLES.SUPER_ADMIN });
      // Super admin role gets all permissions dynamically
      await assignRoleWithPermissions(
        employee._id,
        `test_boundary_sa_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        Object.values(PERMISSIONS)
      );

      const { vendor } = await createTestVendor();
      const { customer } = await createTestCustomer();
      const product = await createTestProduct(vendor._id);
      const review = await createTestReview(product._id, customer._id);

      const res = await request(app)
        .patch(`/api/v1/reviews/${review._id}/moderate`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          status: "hidden",
          moderationReason: "Pending internal audit review",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("hidden");
    });
  });
});
