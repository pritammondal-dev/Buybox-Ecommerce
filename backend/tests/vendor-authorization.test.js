const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const Customer = require("../src/models/Customer");
const Vendor = require("../src/models/Vendor");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const RolePermission = require("../src/models/RolePermission");
const EmployeeRole = require("../src/models/EmployeeRole");
const EmployeePermissionGrant = require("../src/models/EmployeePermissionGrant");
const EmployeePermissionRestriction = require("../src/models/EmployeePermissionRestriction");
const WorkAssignment = require("../src/models/WorkAssignment");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { SCOPE_TYPES } = require("../src/constants/scope.constants");
const { generateAccessToken } = require("../src/services/token.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_vendor_auth_test?")
  : "mongodb://127.0.0.1:27017/buybox_vendor_auth_test?replicaSet=rs0";

jest.setTimeout(30000);

describe("Phase B — Vendor Operations & Scope Authorization", () => {
  let createdPermissions = new Map();
  let vendorUserA;
  let vendorA;
  let vendorTokenA;
  let vendorUserB;
  let vendorB;
  let vendorTokenB;

  async function getOrCreatePermission(slug) {
    if (createdPermissions.has(slug)) {
      return createdPermissions.get(slug);
    }
    let perm = await Permission.findOne({ slug });
    if (!perm) {
      perm = await Permission.create({
        slug,
        name: `Perm ${slug}`,
        module: slug.split(":")[0],
        description: `Description for ${slug}`,
        isActive: true,
      });
    }
    createdPermissions.set(slug, perm);
    return perm;
  }

  async function createTestEmployee(options = {}) {
    const status = options.status || "active";
    const user = await User.create({
      firstName: "VendorOps",
      lastName: "Staff",
      email: `vend_staff_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
      password: "Password123!",
      role: options.userRole || "manager",
      isActive: options.isActive !== undefined ? options.isActive : true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const employee = await Employee.create({
      userId: user._id,
      employeeNumber: `EMP_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`,
      jobTitle: "Vendor Relations Specialist",
      department: "Partner Operations",
      status,
    });

    if (options.permissions && options.permissions.length > 0) {
      const suffix = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const role = await Role.create({
        slug: `vend_role_${suffix}`,
        name: `Vendor Ops Role ${suffix}`,
        isActive: true,
      });

      for (const slug of options.permissions) {
        const perm = await getOrCreatePermission(slug);
        await RolePermission.create({
          roleId: role._id,
          permissionId: perm._id,
        });
      }

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });
    }

    const token = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
    });

    return { user, employee, token };
  }

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    await getOrCreatePermission(PERMISSIONS.VENDORS_READ);
    await getOrCreatePermission(PERMISSIONS.VENDORS_MANAGE);

    // 1. Vendor A
    vendorUserA = await User.create({
      firstName: "Vendor",
      lastName: "Alpha",
      email: `vendor_a_${Date.now()}@test.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendorA = await Vendor.create({
      userId: vendorUserA._id,
      businessName: "Alpha Vendor Ltd",
      businessSlug: `alpha-vendor-${Date.now()}`,
      businessEmail: vendorUserA.email,
      phone: "9876543210",
      onboardingStatus: "approved",
      isActive: true,
    });
    vendorTokenA = generateAccessToken({
      sub: vendorUserA._id.toString(),
      role: ROLES.VENDOR,
      authVersion: 1,
      permissionVersion: 1,
    });

    // 2. Vendor B
    vendorUserB = await User.create({
      firstName: "Vendor",
      lastName: "Beta",
      email: `vendor_b_${Date.now()}@test.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendorB = await Vendor.create({
      userId: vendorUserB._id,
      businessName: "Beta Vendor Ltd",
      businessSlug: `beta-vendor-${Date.now()}`,
      businessEmail: vendorUserB.email,
      phone: "9876543211",
      onboardingStatus: "pending",
      isActive: false,
    });
    vendorTokenB = generateAccessToken({
      sub: vendorUserB._id.toString(),
      role: ROLES.VENDOR,
      authVersion: 1,
      permissionVersion: 1,
    });
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ email: /@test\.com$/ });
      await Employee.deleteMany({ department: "Partner Operations" });
      await Vendor.deleteMany({ businessSlug: /^[ab].*-vendor-/ });
      await Role.deleteMany({ slug: /^vend_role_/ });
      await RolePermission.deleteMany({});
      await EmployeeRole.deleteMany({});
      await WorkAssignment.deleteMany({});
    } catch (e) {
      // Ignored
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  describe("1. Vendor Self-Service & Identity Boundary (/me)", () => {
    test("vendor A can retrieve own profile via /me", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me")
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vendor._id).toBe(vendorA._id.toString());
      expect(res.body.data.vendor.businessName).toBe("Alpha Vendor Ltd");
    });

    test("vendor A can update own profile details via /me", async () => {
      const res = await request(app)
        .patch("/api/v1/vendors/me")
        .set("Authorization", `Bearer ${vendorTokenA}`)
        .send({ phone: "9876543299" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vendor.phone).toBe("9876543299");
    });

    test("vendor B retrieves own profile and cannot see vendor A data", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me")
        .set("Authorization", `Bearer ${vendorTokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.data.vendor._id).toBe(vendorB._id.toString());
      expect(res.body.data.vendor.businessName).toBe("Beta Vendor Ltd");
    });

    test("non-vendor user calling /me is rejected with 403", async () => {
      const { token } = await createTestEmployee();

      const res = await request(app)
        .get("/api/v1/vendors/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe("2. Platform Vendor Operations & Scope Authorization", () => {
    test("platform employee with vendors:read can retrieve vendor by ID", async () => {
      const { token } = await createTestEmployee({
        permissions: [PERMISSIONS.VENDORS_READ],
      });

      const res = await request(app)
        .get(`/api/v1/vendors/${vendorA._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vendor._id).toBe(vendorA._id.toString());
    });

    test("platform employee with matching vendor scope can access assigned vendor", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.VENDORS_READ],
      });

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.VENDOR,
        scopeId: vendorA._id.toString(),
        isActive: true,
      });

      const res = await request(app)
        .get(`/api/v1/vendors/${vendorA._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.vendor._id).toBe(vendorA._id.toString());
    });

    test("platform employee scoped to Vendor A CANNOT access Vendor B (403 INSUFFICIENT_SCOPE)", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.VENDORS_READ],
      });

      // Scoped only to Vendor A
      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.VENDOR,
        scopeId: vendorA._id.toString(),
        isActive: true,
      });

      const res = await request(app)
        .get(`/api/v1/vendors/${vendorB._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_SCOPE");
    });

    test("platform employee without vendors:read is rejected with 403 INSUFFICIENT_PERMISSIONS", async () => {
      const { token } = await createTestEmployee({
        permissions: [],
      });

      const res = await request(app)
        .get(`/api/v1/vendors/${vendorA._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("vendor status update requires vendors:manage and matching vendor scope", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.VENDORS_MANAGE],
      });

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.VENDOR,
        scopeId: vendorB._id.toString(),
        isActive: true,
      });

      const res = await request(app)
        .patch(`/api/v1/vendors/${vendorB._id}/status`)
        .set("Authorization", `Bearer ${token}`)
        .send({ onboardingStatus: "approved" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vendor.onboardingStatus).toBe("approved");
    });

    test("vendor status update with wrong scope fails 403 INSUFFICIENT_SCOPE", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.VENDORS_MANAGE],
      });

      // Scoped only to Vendor A, attempting status update on Vendor B
      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.VENDOR,
        scopeId: vendorA._id.toString(),
        isActive: true,
      });

      const res = await request(app)
        .patch(`/api/v1/vendors/${vendorB._id}/status`)
        .set("Authorization", `Bearer ${token}`)
        .send({ onboardingStatus: "rejected", rejectionReason: "Documents invalid" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_SCOPE");
    });

    test("malformed vendor ID fails validation (400 INVALID_OBJECT_ID)", async () => {
      const { token } = await createTestEmployee({
        permissions: [PERMISSIONS.VENDORS_READ],
      });

      const res = await request(app)
        .get("/api/v1/vendors/not-a-valid-objectid")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_OBJECT_ID");
    });
  });

  describe("3. Vendor & Customer Boundary Protections", () => {
    test("vendor cannot list all platform vendors (403 INSUFFICIENT_PERMISSIONS)", async () => {
      const res = await request(app)
        .get("/api/v1/vendors")
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("vendor cannot access another vendor by ID (fails closed)", async () => {
      const res = await request(app)
        .get(`/api/v1/vendors/${vendorB._id}`)
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(403);
    });

    test("vendor cannot modify vendor status (403 INSUFFICIENT_PERMISSIONS)", async () => {
      const res = await request(app)
        .patch(`/api/v1/vendors/${vendorA._id}/status`)
        .set("Authorization", `Bearer ${vendorTokenA}`)
        .send({ onboardingStatus: "approved" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("customer calling platform vendor routes is rejected with 403", async () => {
      const customerUser = await User.create({
        firstName: "Customer",
        lastName: "VendorTester",
        email: `cust_vend_${Date.now()}@test.com`,
        password: "Password123!",
        role: ROLES.CUSTOMER,
        isActive: true,
        authVersion: 1,
        permissionVersion: 1,
      });

      const customerToken = generateAccessToken({
        sub: customerUser._id.toString(),
        role: ROLES.CUSTOMER,
        authVersion: 1,
        permissionVersion: 1,
      });

      const res = await request(app)
        .get(`/api/v1/vendors/${vendorA._id}`)
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe("4. PBAC Edge Cases & Super Admin Behavior", () => {
    test("direct grant: employee with direct grant for vendors:manage succeeds", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.VENDORS_MANAGE);

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      const res = await request(app)
        .patch(`/api/v1/vendors/${vendorB._id}/status`)
        .set("Authorization", `Bearer ${token}`)
        .send({ onboardingStatus: "approved" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("restriction dominance: direct restriction on vendors:read overrides role", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.VENDORS_READ],
      });
      const perm = await getOrCreatePermission(PERMISSIONS.VENDORS_READ);

      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      const res = await request(app)
        .get(`/api/v1/vendors/${vendorA._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("suspended employee is rejected with 403", async () => {
      const { token } = await createTestEmployee({
        permissions: [PERMISSIONS.VENDORS_READ],
        status: "suspended",
      });

      const res = await request(app)
        .get(`/api/v1/vendors/${vendorA._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    test("Super Admin operates globally across vendors without scope restriction", async () => {
      const { token } = await createTestEmployee({
        permissions: [PERMISSIONS.VENDORS_READ, PERMISSIONS.VENDORS_MANAGE],
        userRole: ROLES.SUPER_ADMIN,
      });

      const res = await request(app)
        .get(`/api/v1/vendors/${vendorA._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.vendor._id).toBe(vendorA._id.toString());
    });
  });
});
