const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Customer = require("../src/models/Customer");
const Vendor = require("../src/models/Vendor");
const Employee = require("../src/models/Employee");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const RolePermission = require("../src/models/RolePermission");
const EmployeeRole = require("../src/models/EmployeeRole");
const AuditLog = require("../src/models/AuditLog");
const { hashPassword } = require("../src/utils/password");
const { generateAccessToken } = require("../src/services/token.service");
const { encodeSecureId } = require("../src/utils/secure-id.util");
const { ROLES } = require("../src/constants/auth.constants");
const { PERMISSIONS } = require("../src/constants/permissions.constants");

describe("Production Vendor Onboarding & Approval Workflow Integration Suite", () => {
  let adminUser;
  let adminToken;
  let superAdminUser;
  let superAdminToken;
  let customerUser;
  let customerToken;
  let pendingVendorUser;
  let pendingVendorToken;
  let pendingVendorDoc;
  let createdUserIds = [];
  let createdVendorIds = [];

  const TEST_MONGODB_URI = process.env.MONGODB_URI
    ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_vendor_onboarding_test?")
    : "mongodb://127.0.0.1:27017/buybox_vendor_onboarding_test?replicaSet=rs0";

  jest.setTimeout(60000);

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // 1. Super Admin
    superAdminUser = await User.create({
      email: `test-superadmin-${Date.now()}@buybox.test`,
      password: await hashPassword("AdminPassword123!"),
      firstName: "Super",
      lastName: "Admin",
      role: ROLES.SUPER_ADMIN,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    createdUserIds.push(superAdminUser._id);

    superAdminToken = generateAccessToken({
      sub: superAdminUser._id.toString(),
      id: superAdminUser._id.toString(),
      role: ROLES.SUPER_ADMIN,
      roles: [ROLES.SUPER_ADMIN],
      permissions: [PERMISSIONS.VENDORS_READ, PERMISSIONS.VENDORS_MANAGE],
    });

    // 2. Admin Employee
    adminUser = await User.create({
      email: `test-admin-${Date.now()}@buybox.test`,
      password: await hashPassword("AdminPassword123!"),
      firstName: "Ops",
      lastName: "Reviewer",
      role: ROLES.ADMIN,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    createdUserIds.push(adminUser._id);

    const adminEmployee = await Employee.create({
      userId: adminUser._id,
      employeeNumber: `EMP-${Date.now()}`,
      status: "active",
      jobTitle: "Vendor Operations Reviewer",
    });

    const roleSuffix = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const adminRole = await Role.create({
      name: `Vendor Admin ${roleSuffix}`,
      slug: `vendor_admin_${roleSuffix}`,
      description: "Manage vendor onboarding",
      isActive: true,
    });

    const permSlugs = [PERMISSIONS.VENDORS_READ, PERMISSIONS.VENDORS_MANAGE];
    for (const slug of permSlugs) {
      let perm = await Permission.findOne({ slug });
      if (!perm) {
        perm = await Permission.create({
          slug,
          name: slug,
          module: "vendors",
          description: slug,
          isActive: true,
        });
      }
      await RolePermission.create({
        roleId: adminRole._id,
        permissionId: perm._id,
      });
    }

    const superEmployee = await Employee.create({
      userId: superAdminUser._id,
      employeeNumber: `EMP-SUPER-${Date.now()}`,
      status: "active",
      jobTitle: "Super Admin",
    });

    await EmployeeRole.create({
      employeeId: superEmployee._id,
      roleId: adminRole._id,
      isActive: true,
    });

    adminToken = generateAccessToken({
      sub: adminUser._id.toString(),
      id: adminUser._id.toString(),
      role: ROLES.ADMIN,
      roles: [ROLES.ADMIN],
      permissions: [PERMISSIONS.VENDORS_READ, PERMISSIONS.VENDORS_MANAGE],
    });

    // 3. Regular Customer
    customerUser = await User.create({
      email: `test-cust-${Date.now()}@buybox.test`,
      password: await hashPassword("CustomerPassword123!"),
      firstName: "Jane",
      lastName: "Shopper",
      role: ROLES.CUSTOMER,
      isActive: true,
    });
    createdUserIds.push(customerUser._id);
    await Customer.create({ userId: customerUser._id });

    customerToken = generateAccessToken({
      sub: customerUser._id.toString(),
      id: customerUser._id.toString(),
      role: ROLES.CUSTOMER,
      roles: [ROLES.CUSTOMER],
      permissions: [PERMISSIONS.PRODUCTS_READ],
    });
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ _id: { $in: createdUserIds } });
      await Vendor.deleteMany({ _id: { $in: createdVendorIds } });
      await AuditLog.deleteMany({ targetId: { $in: createdVendorIds } });
    } catch {
      // Best-effort cleanup
    }
  });

  // =========================================================================
  // 1. VENDOR REGISTRATION LIFECYCLE
  // =========================================================================
  describe("1. Vendor Registration Lifecycle", () => {
    test("registers a vendor in PENDING status with isActive = false", async () => {
      const payload = {
        email: `candidate-${Date.now()}@buybox.test`,
        password: "StrongPassword123!",
        firstName: "Vikram",
        lastName: "Patel",
        businessName: "Patel Organic Spices",
        businessSlug: `patel-spices-${Date.now()}`,
        phone: "+919876543210",
        supportEmail: "support@patelspices.test",
        businessAddress: {
          addressLine1: "42 Market Street",
          city: "Ahmedabad",
          state: "Gujarat",
          postalCode: "380001",
          country: "IN",
        },
        taxInformation: {
          taxId: "24AAAAA0000A1Z5",
          taxType: "GSTIN",
        },
      };

      const res = await request(app)
        .post("/api/v1/vendors/register")
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vendor.onboardingStatus).toBe("pending");
      expect(res.body.data.vendor.isActive).toBe(false);

      const dbVendor = await Vendor.findById(res.body.data.vendor.id);
      expect(dbVendor).not.toBeNull();
      expect(dbVendor.onboardingStatus).toBe("pending");
      expect(dbVendor.isActive).toBe(false);

      pendingVendorDoc = dbVendor;
      createdVendorIds.push(dbVendor._id);

      pendingVendorUser = await User.findById(res.body.data.user.id);
      createdUserIds.push(pendingVendorUser._id);
      expect(pendingVendorUser.role).toBe(ROLES.VENDOR);
      expect(pendingVendorUser.isActive).toBe(true);

      pendingVendorToken = generateAccessToken({
        sub: pendingVendorUser._id.toString(),
        id: pendingVendorUser._id.toString(),
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
      });
    });

    test("pending vendor is blocked from operational dashboard (403 VENDOR_ONBOARDING_NOT_APPROVED)", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me/dashboard")
        .set("Authorization", `Bearer ${pendingVendorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("VENDOR_ONBOARDING_NOT_APPROVED");
    });
  });

  // =========================================================================
  // 2. SECURE ID ENFORCEMENT ON REVIEW ENDPOINTS
  // =========================================================================
  describe("2. Secure Identifier Enforcement on Review Endpoints", () => {
    test("rejects raw 24-character hex ObjectId with 400 RAW_IDENTIFIER_DISALLOWED", async () => {
      const rawHexId = pendingVendorDoc._id.toString();

      const res = await request(app)
        .post(`/api/v1/admin/vendors/${rawHexId}/approve`)
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("RAW_IDENTIFIER_DISALLOWED");
    });
  });

  // =========================================================================
  // 3. REQUEST CHANGES & RESUBMISSION WORKFLOW
  // =========================================================================
  describe("3. Request Changes & Resubmission Workflow", () => {
    test("rejects request-changes if reason/instructions are missing or too short (< 5 chars)", async () => {
      const secureId = encodeSecureId("vendor", pendingVendorDoc._id);

      const res = await request(app)
        .post(`/api/v1/admin/vendors/${secureId}/request-changes`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ reason: "bad" });

      expect(res.status).toBe(400);
    });

    test("admin can request changes, setting status to changes_requested and recording audit log", async () => {
      const secureId = encodeSecureId("vendor", pendingVendorDoc._id);
      const instructions = "Please provide your updated GSTIN certificate and full registered street address.";

      const res = await request(app)
        .post(`/api/v1/admin/vendors/${secureId}/request-changes`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ reason: instructions });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vendor.onboardingStatus).toBe("changes_requested");
      expect(res.body.data.vendor.isActive).toBe(false);

      const updated = await Vendor.findById(pendingVendorDoc._id);
      expect(updated.onboardingStatus).toBe("changes_requested");
      expect(updated.changesRequestedReason).toBe(instructions);
      expect(updated.changesRequestedAt).not.toBeNull();

      const audit = await AuditLog.findOne({
        targetId: pendingVendorDoc._id,
        action: "VENDOR_CHANGES_REQUESTED",
      });
      expect(audit).not.toBeNull();
    });

    test("vendor in changes_requested can update store profile and resubmit application", async () => {
      // Vendor updates profile
      const updateRes = await request(app)
        .patch("/api/v1/vendors/me")
        .set("Authorization", `Bearer ${pendingVendorToken}`)
        .send({
          businessAddress: {
            addressLine1: "42 Market Street, Commercial Tower B, Suite 404",
            city: "Ahmedabad",
            state: "Gujarat",
            postalCode: "380001",
            country: "IN",
          },
        });

      expect(updateRes.status).toBe(200);

      // Vendor resubmits application
      const resubmitRes = await request(app)
        .post("/api/v1/vendors/me/resubmit")
        .set("Authorization", `Bearer ${pendingVendorToken}`);

      expect(resubmitRes.status).toBe(200);
      expect(resubmitRes.body.data.vendor.onboardingStatus).toBe("pending");

      const dbVendor = await Vendor.findById(pendingVendorDoc._id);
      expect(dbVendor.onboardingStatus).toBe("pending");

      const audit = await AuditLog.findOne({
        targetId: pendingVendorDoc._id,
        action: "VENDOR_APPLICATION_RESUBMITTED",
      });
      expect(audit).not.toBeNull();
    });

    test("resubmitting when already in pending status returns 400 ALREADY_PENDING", async () => {
      const res = await request(app)
        .post("/api/v1/vendors/me/resubmit")
        .set("Authorization", `Bearer ${pendingVendorToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("ALREADY_PENDING");
    });
  });

  // =========================================================================
  // 4. APPROVAL WORKFLOW & DASHBOARD UNLOCK
  // =========================================================================
  describe("4. Approval Workflow & Dashboard Unlock", () => {
    test("admin approves vendor application: updates status to approved, activates vendor, records audit log", async () => {
      const secureId = encodeSecureId("vendor", pendingVendorDoc._id);

      const res = await request(app)
        .post(`/api/v1/admin/vendors/${secureId}/approve`)
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vendor.onboardingStatus).toBe("approved");
      expect(res.body.data.vendor.isActive).toBe(true);

      const updated = await Vendor.findById(pendingVendorDoc._id);
      expect(updated.onboardingStatus).toBe("approved");
      expect(updated.isActive).toBe(true);
      expect(updated.approvedAt).not.toBeNull();
      expect(updated.approvedBy.toString()).toBe(superAdminUser._id.toString());

      const audit = await AuditLog.findOne({
        targetId: pendingVendorDoc._id,
        action: "VENDOR_APPROVED",
      });
      expect(audit).not.toBeNull();
    });

    test("idempotent approval: calling approve on already approved vendor succeeds with 200", async () => {
      const secureId = encodeSecureId("vendor", pendingVendorDoc._id);

      const res = await request(app)
        .post(`/api/v1/admin/vendors/${secureId}/approve`)
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.vendor.onboardingStatus).toBe("approved");
    });

    test("approved vendor can now access the operational dashboard (/me/dashboard returns 200)", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me/dashboard")
        .set("Authorization", `Bearer ${pendingVendorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.metrics).toBeDefined();
    });
  });

  // =========================================================================
  // 5. REJECTION WORKFLOW & STATE GUARDS
  // =========================================================================
  describe("5. Rejection Workflow & State Guards", () => {
    let secondVendorDoc;
    let secondVendorUser;

    beforeAll(async () => {
      secondVendorUser = await User.create({
        email: `reject-candidate-${Date.now()}@buybox.test`,
        password: await hashPassword("Password123!"),
        firstName: "Rohit",
        lastName: "Mehta",
        role: ROLES.VENDOR,
        isActive: true,
      });
      createdUserIds.push(secondVendorUser._id);

      secondVendorDoc = await Vendor.create({
        userId: secondVendorUser._id,
        businessName: "Mehta Knockoffs",
        businessSlug: `mehta-knockoffs-${Date.now()}`,
        onboardingStatus: "pending",
        isActive: false,
      });
      createdVendorIds.push(secondVendorDoc._id);
    });

    test("rejecting an application without reason fails validation with 400", async () => {
      const secureId = encodeSecureId("vendor", secondVendorDoc._id);

      const res = await request(app)
        .post(`/api/v1/admin/vendors/${secureId}/reject`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    test("admin rejects pending vendor with valid reason, setting status to rejected and recording audit log", async () => {
      const secureId = encodeSecureId("vendor", secondVendorDoc._id);
      const reason = "Product catalog violates platform anti-counterfeiting and trademark policies.";

      const res = await request(app)
        .post(`/api/v1/admin/vendors/${secureId}/reject`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ reason });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vendor.onboardingStatus).toBe("rejected");
      expect(res.body.data.vendor.isActive).toBe(false);

      const updated = await Vendor.findById(secondVendorDoc._id);
      expect(updated.onboardingStatus).toBe("rejected");
      expect(updated.rejectionReason).toBe(reason);
      expect(updated.rejectedAt).not.toBeNull();

      const audit = await AuditLog.findOne({
        targetId: secondVendorDoc._id,
        action: "VENDOR_REJECTED",
      });
      expect(audit).not.toBeNull();
    });

    test("cannot reject an already approved active vendor (400 INVALID_STATE_TRANSITION)", async () => {
      const secureId = encodeSecureId("vendor", pendingVendorDoc._id);

      const res = await request(app)
        .post(`/api/v1/admin/vendors/${secureId}/reject`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ reason: "Cannot reject active merchant directly" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_STATE_TRANSITION");
    });
  });

  // =========================================================================
  // 6. RBAC & IDOR AUTHORIZATION BOUNDARY
  // =========================================================================
  describe("6. RBAC & IDOR Authorization Boundary", () => {
    test("customer calling approve is rejected with 403", async () => {
      const secureId = encodeSecureId("vendor", pendingVendorDoc._id);

      const res = await request(app)
        .post(`/api/v1/admin/vendors/${secureId}/approve`)
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    test("vendor calling approve on self or another vendor is rejected with 403", async () => {
      const secureId = encodeSecureId("vendor", pendingVendorDoc._id);

      const res = await request(app)
        .post(`/api/v1/admin/vendors/${secureId}/approve`)
        .set("Authorization", `Bearer ${pendingVendorToken}`);

      expect(res.status).toBe(403);
    });
  });
});
