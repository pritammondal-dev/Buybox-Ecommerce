const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const RolePermission = require("../src/models/RolePermission");
const Employee = require("../src/models/Employee");
const EmployeeRole = require("../src/models/EmployeeRole");
const AuditLog = require("../src/models/AuditLog");
const emailService = require("../src/services/email.service");
const { hashPassword } = require("../src/utils/password");
const { generateAccessToken } = require("../src/services/token.service");
const { encodeSecureId } = require("../src/utils/secure-id.util");
const { ROLES } = require("../src/constants/auth.constants");
const { PERMISSIONS } = require("../src/constants/permissions.constants");

describe("Phase 3B: Vendor Registration Remediation Suite", () => {
  let adminUser;
  let adminToken;
  let customerUser;
  let customerToken;

  const TEST_MONGODB_URI = process.env.MONGODB_URI
    ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_p3b_test?")
    : "mongodb://127.0.0.1:27017/buybox_p3b_test?replicaSet=rs0";

  jest.setTimeout(45000);

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // Provision Admin User
    const adminEmail = `admin-p3b-${Date.now()}@buybox.test`;
    adminUser = await User.create({
      email: adminEmail,
      password: await hashPassword("AdminPass123!"),
      firstName: "Super",
      lastName: "Administrator",
      role: ROLES.SUPER_ADMIN,
      isActive: true,
      isEmailVerified: true,
    });

    const adminEmployee = await Employee.create({
      userId: adminUser._id,
      jobTitle: "Platform Superadmin",
      department: "Platform Engineering",
      employeeNumber: `EMP-P3B-${Date.now().toString().slice(-4)}`,
      isActive: true,
    });

    const roleSuffix = Date.now().toString();
    const adminRole = await Role.create({
      name: `Admin Role ${roleSuffix}`,
      slug: `admin_${roleSuffix}`,
      description: "Full platform administration",
      isActive: true,
    });

    for (const slug of [PERMISSIONS.VENDORS_READ, PERMISSIONS.VENDORS_MANAGE]) {
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

    await EmployeeRole.create({
      employeeId: adminEmployee._id,
      roleId: adminRole._id,
      isActive: true,
    });

    adminToken = generateAccessToken({
      sub: adminUser._id.toString(),
      role: adminUser.role,
      authVersion: 1,
      permissionVersion: 1,
    });

    // Provision Regular Customer User
    customerUser = await User.create({
      email: `customer-p3b-${Date.now()}@buybox.test`,
      password: await hashPassword("CustomerPass123!"),
      firstName: "Regular",
      lastName: "Customer",
      role: ROLES.CUSTOMER,
      isActive: true,
      isEmailVerified: true,
    });

    customerToken = generateAccessToken({
      sub: customerUser._id.toString(),
      role: customerUser.role,
      authVersion: 1,
      permissionVersion: 1,
    });
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ email: { $regex: /@buybox\.test$/ } });
      await Vendor.deleteMany({ supportEmail: { $regex: /@buybox\.test$/ } });
      await AuditLog.deleteMany({ action: "VENDOR_EMAIL_VERIFIED_BY_ADMIN" });
    } catch {
      // Best-effort cleanup
    }
  });

  describe("DEF-VEND-03: Canonical Country Validation", () => {
    it("accepts valid 2-letter ISO country codes (IN, US) and normalizes to uppercase", async () => {
      const email = `vendor-iso-${Date.now()}@buybox.test`;
      const res = await request(app)
        .post("/api/v1/vendors/register")
        .send({
          email,
          password: "SecurePassword123!",
          firstName: "ISO",
          lastName: "Merchant",
          businessName: `ISO Store ${Date.now()}`,
          phone: "+919876543211",
          businessAddress: {
            addressLine1: "123 High Street",
            city: "Mumbai",
            state: "MH",
            postalCode: "400001",
            country: "in", // lowercase input
          },
          taxInformation: {
            taxId: "27AAAAA0000A1Z5",
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const dbVendor = await Vendor.findById(res.body.data.vendor.id);
      expect(dbVendor.businessAddress.country).toBe("IN");
    });

    it("rejects non-ISO-2 country names with HTTP 400 validation error (no 500 crash)", async () => {
      const res = await request(app)
        .post("/api/v1/vendors/register")
        .send({
          email: `vendor-fail-country-${Date.now()}@buybox.test`,
          password: "SecurePassword123!",
          firstName: "Invalid",
          lastName: "Country",
          businessName: `Invalid Country Store ${Date.now()}`,
          phone: "+919876543212",
          businessAddress: {
            addressLine1: "123 Road",
            city: "Delhi",
            state: "DL",
            postalCode: "110001",
            country: "India", // > 2 characters
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/country/i);
    });
  });

  describe("DEF-VEND-05: Phone Persistence and Uniqueness", () => {
    it("persists normalized phone on both User and Vendor records", async () => {
      const email = `vendor-phone-${Date.now()}@buybox.test`;
      const rawPhone = "09876543213"; // domestic Indian format
      const res = await request(app)
        .post("/api/v1/vendors/register")
        .send({
          email,
          password: "SecurePassword123!",
          firstName: "Phone",
          lastName: "Persist",
          businessName: `Phone Persist Store ${Date.now()}`,
          phone: rawPhone,
          businessAddress: {
            country: "IN",
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const dbUser = await User.findById(res.body.data.user.id);
      const dbVendor = await Vendor.findById(res.body.data.vendor.id);

      expect(dbUser.phone).toBe("+919876543213");
      expect(dbVendor.phone).toBe("+919876543213");
    });

    it("rejects duplicate phone number with 409 Conflict", async () => {
      const existingPhone = "+919876543213";
      const res = await request(app)
        .post("/api/v1/vendors/register")
        .send({
          email: `vendor-dup-phone-${Date.now()}@buybox.test`,
          password: "SecurePassword123!",
          firstName: "Dup",
          lastName: "Phone",
          businessName: `Dup Phone Store ${Date.now()}`,
          phone: existingPhone,
          businessAddress: { country: "IN" },
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("PHONE_ALREADY_EXISTS");
    });
  });

  describe("DEF-VEND-01: Truthful OTP Delivery Status", () => {
    it("reports email delivery status truthfully when provider fails without throwing 500", async () => {
      // Mock email service to simulate Elastic Email failure
      const sendOtpSpy = jest
        .spyOn(emailService.prototype, "sendEmailVerificationOTP")
        .mockResolvedValueOnce({
          success: false,
          error: "Account under review",
          status: "failed",
        });

      const email = `vendor-email-fail-${Date.now()}@buybox.test`;
      const res = await request(app)
        .post("/api/v1/vendors/register")
        .send({
          email,
          password: "SecurePassword123!",
          firstName: "Delivery",
          lastName: "Test",
          businessName: `Delivery Test Store ${Date.now()}`,
          phone: "+919876543214",
          businessAddress: { country: "IN" },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.emailDelivery).toBeDefined();
      expect(res.body.data.emailDelivery.sent).toBe(false);
      expect(res.body.data.emailDelivery.message).toMatch(/could not be delivered/i);

      // Verify OTP is not leaked in response
      expect(res.body.data.otp).toBeUndefined();

      sendOtpSpy.mockRestore();
    });
  });

  describe("DEF-VEND-02 & DEF-VEND-06: Approval, Email Verification & Admin Visibility", () => {
    let createdVendorId;
    let createdUserId;

    beforeAll(async () => {
      const email = `vendor-approval-${Date.now()}@buybox.test`;
      const res = await request(app)
        .post("/api/v1/vendors/register")
        .send({
          email,
          password: "SecurePassword123!",
          firstName: "Approval",
          lastName: "Candidate",
          businessName: `Approval Store ${Date.now()}`,
          phone: "+919876543215",
          businessAddress: { country: "IN" },
        });

      createdVendorId = res.body.data.vendor.id;
      createdUserId = res.body.data.user.id;
    });

    it("populates isEmailVerified in admin vendor detail query", async () => {
      const res = await request(app)
        .get(`/api/v1/admin/vendors/${createdVendorId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vendor.userId).toBeDefined();
      expect(res.body.data.vendor.userId.isEmailVerified).toBe(false);
    });

    it("admin approval activates vendor but does NOT automatically verify email", async () => {
      const secureId = encodeSecureId("vendor", createdVendorId);
      const res = await request(app)
        .post(`/api/v1/admin/vendors/${secureId}/approve`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vendor.onboardingStatus).toBe("approved");
      expect(res.body.data.vendor.isActive).toBe(true);

      const dbUser = await User.findById(createdUserId);
      expect(dbUser.isActive).toBe(true);
      expect(dbUser.isEmailVerified).toBe(false); // Kept separate per policy!
    });

    it("forbids non-admin users from waiving email verification", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/vendors/${createdVendorId}/verify-email`)
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it("allows authorized administrator to explicitly verify email with audit log", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/vendors/${createdVendorId}/verify-email`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbUser = await User.findById(createdUserId);
      expect(dbUser.isEmailVerified).toBe(true);

      // Verify audit log entry
      const audit = await AuditLog.findOne({
        targetId: createdVendorId,
        action: "VENDOR_EMAIL_VERIFIED_BY_ADMIN",
      });
      expect(audit).toBeTruthy();
      expect(audit.actorId.toString()).toBe(adminUser._id.toString());
    });
  });
});
