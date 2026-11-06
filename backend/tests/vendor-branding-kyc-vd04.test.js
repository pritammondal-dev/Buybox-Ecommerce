const request = require("supertest");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const app = require("../src/app");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Employee = require("../src/models/Employee");
const AuditLog = require("../src/models/AuditLog");
const { ROLES } = require("../src/constants/auth.constants");
const { hashPassword } = require("../src/utils/password");
const {
  generateAccessToken,
  TOKEN_CONTEXTS,
  TOKEN_AUDIENCES,
} = require("../src/services/token.service");
const {
  validateKycFile,
  uploadKycDocument,
  reviewKycDocument,
  listKycReviewQueue,
} = require("../src/services/vendor-kyc.service");
const AppError = require("../src/errors/AppError");

describe("Phase VD-04: Vendor Store Branding & KYC Document Management", () => {
  jest.setTimeout(60000);

  let superadminUser;
  let superadminToken;
  let unauthorizedCustomerUser;
  let unauthorizedCustomerToken;

  let vendorAUser;
  let vendorADoc;
  let vendorAToken;

  let vendorBUser;
  let vendorBDoc;
  let vendorBToken;

  const uniqueSuffix = Date.now();

  const TEST_URI = process.env.MONGODB_URI
    ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_vd04_test?")
    : "mongodb://127.0.0.1:27017/buybox_vd04_test?replicaSet=rs0";

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI, { autoIndex: true });
    }

    // 1. Provision Platform Super Administrator
    superadminUser = await User.findOne({ role: ROLES.SUPER_ADMIN, isActive: true });
    if (!superadminUser) {
      superadminUser = await User.create({
        email: `superadmin-vd04-${uniqueSuffix}@buybox.test`,
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
        jobTitle: "Platform Compliance Superadmin",
        department: "Compliance Operations",
        employeeNumber: `EMP-VD04-${uniqueSuffix.toString().slice(-4)}`,
        isActive: true,
        status: "active",
      });
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

    // 2. Provision Unauthorized Customer User
    unauthorizedCustomerUser = await User.create({
      email: `unauth-cust-vd04-${uniqueSuffix}@buybox.test`,
      password: await hashPassword("CustPass123!"),
      firstName: "Unauthorized",
      lastName: "Customer",
      role: ROLES.CUSTOMER,
      roles: [ROLES.CUSTOMER],
      isActive: true,
      isEmailVerified: true,
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

    // 3. Provision Vendor A
    vendorAUser = await User.create({
      email: `vendor-a-vd04-${uniqueSuffix}@buybox.test`,
      password: await hashPassword("VendorSecret123!"),
      firstName: "VendorA",
      lastName: "Store",
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      isActive: true,
      isEmailVerified: true,
      authVersion: 1,
    });

    vendorADoc = await Vendor.create({
      userId: vendorAUser._id,
      businessName: `Alpha Electronics ${uniqueSuffix}`,
      businessSlug: `alpha-electronics-${uniqueSuffix}`,
      onboardingStatus: "approved",
      isActive: true,
      taxInformation: {
        gstin: "27AAAAA0000A1Z5",
        pan: "ABCDE1234F",
      },
      supportEmail: "support@alpha-electronics.internal",
      phone: "+919876543210",
      kycStatus: "not_submitted",
      kycDocuments: [],
    });

    vendorAToken = generateAccessToken(
      {
        sub: vendorAUser._id.toString(),
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

    // 4. Provision Vendor B
    vendorBUser = await User.create({
      email: `vendor-b-vd04-${uniqueSuffix}@buybox.test`,
      password: await hashPassword("VendorSecret123!"),
      firstName: "VendorB",
      lastName: "Store",
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      isActive: true,
      isEmailVerified: true,
      authVersion: 1,
    });

    vendorBDoc = await Vendor.create({
      userId: vendorBUser._id,
      businessName: `Beta Apparel ${uniqueSuffix}`,
      businessSlug: `beta-apparel-${uniqueSuffix}`,
      onboardingStatus: "approved",
      isActive: true,
      kycStatus: "not_submitted",
      kycDocuments: [],
    });

    vendorBToken = generateAccessToken(
      {
        sub: vendorBUser._id.toString(),
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
  });

  afterAll(async () => {
    // Cleanup created test records
    await Vendor.deleteMany({
      _id: { $in: [vendorADoc?._id, vendorBDoc?._id].filter(Boolean) },
    });
    await User.deleteMany({
      _id: {
        $in: [
          vendorAUser?._id,
          vendorBUser?._id,
          unauthorizedCustomerUser?._id,
        ].filter(Boolean),
      },
    });

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // --------------------------------------------------------------------------
  // 1. STORE BRANDING MANAGEMENT & PUBLIC STORE PROFILE
  // --------------------------------------------------------------------------
  describe("1. Store Branding Management & Public Storefront Isolation", () => {
    test("GET /api/v1/vendors/me/branding returns default branding structure", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me/branding")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.branding).toBeDefined();
    });

    test("PATCH /api/v1/vendors/me/branding updates store branding with field validation", async () => {
      const brandingPayload = {
        displayName: "Alpha Elite Electronics",
        description: "Official authorized dealer of premium computing and audio hardware.",
        publicContactEmail: "contact@alpha-electronics.public",
        publicContactPhone: "+91-9988776655",
        operatingHours: "Mon-Sat: 09:00 AM - 08:00 PM IST",
        policies: {
          shippingPolicy: "Orders dispatched within 24 hours via express surface courier.",
          returnPolicy: "7-day return window for unopened items in original packaging.",
          refundPolicy: "Refunds credited to original payment source within 3-5 days.",
        },
        socialLinks: {
          website: "https://alphaelectronics.example.com",
          twitter: "https://twitter.com/alpha_electronics",
        },
      };

      const res = await request(app)
        .patch("/api/v1/vendors/me/branding")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send(brandingPayload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.branding.displayName).toBe("Alpha Elite Electronics");
      expect(res.body.data.branding.description).toContain("Official authorized dealer");
      expect(res.body.data.branding.policies.shippingPolicy).toContain("express surface courier");
      expect(res.body.data.branding.socialLinks.website).toBe("https://alphaelectronics.example.com");

      // Verify persistence in MongoDB
      const updatedVendor = await Vendor.findById(vendorADoc._id);
      expect(updatedVendor.branding.displayName).toBe("Alpha Elite Electronics");
      expect(updatedVendor.branding.publicContactEmail).toBe("contact@alpha-electronics.public");
    });

    test("PATCH /api/v1/vendors/me/branding strictly blocks SVG image references", async () => {
      const invalidPayload = {
        logo: "https://cdn.example.com/malicious-vector.svg",
      };

      const res = await request(app)
        .patch("/api/v1/vendors/me/branding")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send(invalidPayload)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot be an SVG file/i);
    });

    test("GET /api/v1/vendors/store/:slug returns public storefront profile with strict privacy guarantees", async () => {
      const res = await request(app)
        .get(`/api/v1/vendors/store/${vendorADoc.businessSlug}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const store = res.body.data.store;
      expect(store).toBeDefined();
      expect(store.branding.displayName).toBe("Alpha Elite Electronics");
      expect(store.branding.policies).toBeDefined();

      // STRICT PRIVACY BOUNDARY INVARIANTS:
      // Must NEVER leak internal, regulatory, bank, or tax data to public visitors
      expect(store.taxInformation).toBeUndefined();
      expect(store.gstin).toBeUndefined();
      expect(store.pan).toBeUndefined();
      expect(store.bankAccounts).toBeUndefined();
      expect(store.kycDocuments).toBeUndefined();
      expect(store.rejectionReason).toBeUndefined();
      expect(store.userId).toBeUndefined();
      expect(store.commissionRate).toBeUndefined();
      expect(store.walletBalance).toBeUndefined();
      expect(store.supportEmail).toBeUndefined();
      expect(store.phone).toBeUndefined();
    });

    test("GET /api/v1/vendors/store/:slug returns 404 for nonexistent store slug", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/store/nonexistent-store-slug-99999")
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. KYC FILE VALIDATION & SECURITY CHECKS
  // --------------------------------------------------------------------------
  describe("2. KYC File Security & Magic Byte Validation", () => {
    test("validateKycFile accepts valid PDF buffer with %PDF- header", () => {
      const pdfBuffer = Buffer.from("%PDF-1.4 sample pdf content for testing validation");
      expect(() => {
        validateKycFile({
          buffer: pdfBuffer,
          originalname: "aadhaar_card.pdf",
          size: pdfBuffer.length,
          mimetype: "application/pdf",
        });
      }).not.toThrow();
    });

    test("validateKycFile accepts valid PNG buffer with magic bytes 89 50 4E 47", () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const pngBuffer = Buffer.concat([pngHeader, Buffer.alloc(100)]);

      expect(() => {
        validateKycFile({
          buffer: pngBuffer,
          originalname: "pan_card.png",
          size: pngBuffer.length,
          mimetype: "image/png",
        });
      }).not.toThrow();
    });

    test("validateKycFile accepts valid JPEG buffer with magic bytes FF D8 FF", () => {
      const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const jpegBuffer = Buffer.concat([jpegHeader, Buffer.alloc(100)]);

      expect(() => {
        validateKycFile({
          buffer: jpegBuffer,
          originalname: "electricity_bill.jpg",
          size: jpegBuffer.length,
          mimetype: "image/jpeg",
        });
      }).not.toThrow();
    });

    test("validateKycFile rejects SVG files with malicious script tags", () => {
      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      expect(() => {
        validateKycFile({
          buffer: svgBuffer,
          originalname: "malicious.svg",
          size: svgBuffer.length,
          mimetype: "image/svg+xml",
        });
      }).toThrow(/SVG uploads are not permitted/i);
    });

    test("validateKycFile rejects executable PE binary payload (.exe)", () => {
      const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
      expect(() => {
        validateKycFile({
          buffer: exeBuffer,
          originalname: "payload.exe",
          size: exeBuffer.length,
          mimetype: "application/octet-stream",
        });
      }).toThrow(/Executable files are strictly disallowed/i);
    });

    test("validateKycFile rejects oversized files exceeding 5MB limit", () => {
      const pdfHeader = Buffer.from("%PDF-1.4");
      expect(() => {
        validateKycFile({
          buffer: pdfHeader,
          originalname: "huge.pdf",
          size: 6 * 1024 * 1024, // 6 MB
          mimetype: "application/pdf",
        });
      }).toThrow(/exceeds 5MB limit/i);
    });
  });

  // --------------------------------------------------------------------------
  // 3. KYC UPLOAD, TENANT ISOLATION & PRIVATE DOWNLOAD
  // --------------------------------------------------------------------------
  describe("3. KYC Document Upload & Tenant Isolated Streaming", () => {
    let uploadedDocAId;

    test("POST /api/v1/vendors/me/kyc/upload uploads valid PDF document", async () => {
      const pdfBuffer = Buffer.from("%PDF-1.4 Certificate of Incorporation sample text for testing");

      const res = await request(app)
        .post("/api/v1/vendors/me/kyc/upload")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .field("documentCategory", "business_registration")
        .field("documentType", "Certificate of Incorporation")
        .field("documentNumber", "U72200MH2024PTC123456")
        .attach("file", pdfBuffer, "incorporation_cert.pdf")
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.kycStatus).toBe("pending");
      expect(res.body.data.document).toBeDefined();
      expect(res.body.data.document.documentCategory).toBe("business_registration");
      expect(res.body.data.document.status).toBe("pending");

      uploadedDocAId = res.body.data.document._id;

      // Verify document stored in vendor record
      const vendor = await Vendor.findById(vendorADoc._id);
      expect(vendor.kycStatus).toBe("pending");
      const doc = vendor.kycDocuments.id(uploadedDocAId);
      expect(doc).toBeDefined();
      expect(doc.storageKey).toMatch(/^kyc/);
    });

    test("POST /api/v1/vendors/me/kyc/upload archives prior document to resubmissionHistory on re-upload", async () => {
      const newPdfBuffer = Buffer.from("%PDF-1.5 Updated Certificate of Incorporation text");

      const res = await request(app)
        .post("/api/v1/vendors/me/kyc/upload")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .field("documentCategory", "business_registration")
        .field("documentType", "Certificate of Incorporation")
        .field("documentNumber", "U72200MH2024PTC123456-V2")
        .attach("file", newPdfBuffer, "incorporation_cert_v2.pdf")
        .expect(201);

      expect(res.body.success).toBe(true);

      const vendor = await Vendor.findById(vendorADoc._id);
      const activeDoc = vendor.kycDocuments.find(
        (d) => d.documentCategory === "business_registration"
      );
      expect(activeDoc.documentNumber).toBe("U72200MH2024PTC123456-V2");
      expect(activeDoc.resubmissionHistory).toBeDefined();
      expect(activeDoc.resubmissionHistory.length).toBe(1);
      expect(activeDoc.resubmissionHistory[0].fileOriginalName).toBe("incorporation_cert.pdf");

      uploadedDocAId = activeDoc._id;
    });

    test("GET /api/v1/vendors/me/kyc returns uploaded KYC documents", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me/kyc")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.kycStatus).toBe("pending");
      expect(Array.isArray(res.body.data.documents)).toBe(true);
      expect(res.body.data.documents.length).toBe(1);
    });

    test("GET /api/v1/vendors/me/kyc/documents/:documentId/download streams document to authorized owner", async () => {
      const res = await request(app)
        .get(`/api/v1/vendors/me/kyc/documents/${uploadedDocAId}/download`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .expect(200);

      expect(res.headers["content-type"]).toBe("application/pdf");
      expect(res.headers["content-disposition"]).toContain("incorporation_cert_v2.pdf");
      expect(res.body).toBeDefined();
    });

    test("Tenant Isolation Invariant: Vendor B CANNOT download Vendor A's KYC document", async () => {
      const res = await request(app)
        .get(`/api/v1/vendors/me/kyc/documents/${uploadedDocAId}/download`)
        .set("Authorization", `Bearer ${vendorBToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    test("Customer CANNOT access vendor KYC endpoints", async () => {
      await request(app)
        .get("/api/v1/vendors/me/kyc")
        .set("Authorization", `Bearer ${unauthorizedCustomerToken}`)
        .expect(403);
    });
  });

  // --------------------------------------------------------------------------
  // 4. ADMIN REVIEW WORKFLOW & AUDIT TRAIL
  // --------------------------------------------------------------------------
  describe("4. Administrative Review Console & Audit Log", () => {
    let docIdToReview;

    beforeAll(async () => {
      const vendor = await Vendor.findById(vendorADoc._id);
      docIdToReview = vendor.kycDocuments[0]._id;
    });

    test("GET /api/v1/admin/vendors/kyc/queue lists pending KYC submissions", async () => {
      const res = await request(app)
        .get("/api/v1/admin/vendors/kyc/queue?status=pending")
        .set("Authorization", `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.queue)).toBe(true);
      const found = res.body.data.queue.find(
        (v) => v._id.toString() === vendorADoc._id.toString()
      );
      expect(found).toBeDefined();
    });

    test("GET /api/v1/admin/vendors/:id/kyc/documents/:documentId/download allows authorized admin download", async () => {
      const res = await request(app)
        .get(`/api/v1/admin/vendors/${vendorADoc._id}/kyc/documents/${docIdToReview}/download`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.headers["content-type"]).toBe("application/pdf");
    });

    test("POST /api/v1/admin/vendors/:id/kyc/documents/:documentId/review rejects rejection without reason", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/vendors/${vendorADoc._id}/kyc/documents/${docIdToReview}/review`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ status: "rejected" }) // missing rejectionReason
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/rejection reason.*required/i);
    });

    test("POST /api/v1/admin/vendors/:id/kyc/documents/:documentId/review rejects document with audit reason", async () => {
      const rejectionReason = "Document image is illegible; please re-upload clear high-resolution certificate.";

      const res = await request(app)
        .post(`/api/v1/admin/vendors/${vendorADoc._id}/kyc/documents/${docIdToReview}/review`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          status: "rejected",
          rejectionReason,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.document.status).toBe("rejected");
      expect(res.body.data.document.rejectionReason).toBe(rejectionReason);

      // Verify vendor overall kycStatus is updated to 'rejected'
      const vendor = await Vendor.findById(vendorADoc._id);
      expect(vendor.kycStatus).toBe("rejected");

      // Verify AuditLog record written
      const auditEntry = await AuditLog.findOne({
        targetId: vendorADoc._id.toString(),
        action: "VENDOR_KYC_DOCUMENT_REJECTED",
      });
      expect(auditEntry).toBeDefined();
      expect(auditEntry.reason).toBe(rejectionReason);
    });

    test("POST /api/v1/admin/vendors/:id/kyc/documents/:documentId/review approves document", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/vendors/${vendorADoc._id}/kyc/documents/${docIdToReview}/review`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          status: "approved",
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.document.status).toBe("approved");

      // Verify document status in DB
      const vendor = await Vendor.findById(vendorADoc._id);
      const doc = vendor.kycDocuments.id(docIdToReview);
      expect(doc.status).toBe("approved");
      expect(doc.reviewedBy).toBeDefined();
    });
  });
});
