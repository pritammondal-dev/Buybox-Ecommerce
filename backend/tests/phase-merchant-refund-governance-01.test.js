const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../src/app");

const User = require("../src/models/User");
const Customer = require("../src/models/Customer");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Order = require("../src/models/Order");
const ReturnRequest = require("../src/models/ReturnRequest");
const RefundApplication = require("../src/models/RefundApplication");
const Payment = require("../src/models/Payment");
const Refund = require("../src/models/Refund");

const { generateAccessToken } = require("../src/services/token.service");
const { ROLES } = require("../src/constants/auth.constants");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const refundService = require("../src/services/refund.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/\/buybox(_test)?(\?|$)/, "/buybox_merchant_refund_gov_test$2")
  : "mongodb://127.0.0.1:27017/buybox_merchant_refund_gov_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Phase MERCHANT-REFUND-GOVERNANCE-01 — Refund Application & Disbursement Authority Separation", () => {
  let superAdminUser, superAdminToken;
  let adminWithReviewUser, adminWithReviewToken;
  let adminWithDisburseUser, adminWithDisburseToken;
  let adminNoPermUser, adminNoPermToken;
  let customerUser, customerToken, customerDoc;
  let vendorUserA, vendorTokenA, vendorDocA;
  let vendorUserB, vendorTokenB, vendorDocB;
  let category, brand, productA, variantA;
  let orderPrepaid, paymentPrepaid;
  let returnNotInspected, returnInspectedA, returnInspectedB;

  const rand = Math.random().toString(36).substring(7);

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // 1. Superadmin (all permissions)
    superAdminUser = await User.findOne({ role: ROLES.SUPER_ADMIN, isActive: true });
    if (!superAdminUser) {
      superAdminUser = await User.create({
        firstName: "Super",
        lastName: "Governance",
        email: `super_gov_${rand}@buybox.local`,
        phone: "+919988112233",
        password: "Password123!",
        role: ROLES.SUPER_ADMIN,
        roles: [ROLES.SUPER_ADMIN],
        permissions: ["*"],
        isActive: true,
        authVersion: 1,
        permissionVersion: 1,
      });
    }
    superAdminToken = generateAccessToken({
      sub: superAdminUser._id.toString(),
      role: ROLES.SUPER_ADMIN,
      roles: [ROLES.SUPER_ADMIN],
      permissions: ["*"],
      authVersion: 1,
      permissionVersion: 1,
      context: "admin",
    });

    // 2. Admin with review/approve permissions only (NO disbursement permission)
    adminWithReviewUser = await User.create({
      firstName: "Review",
      lastName: "Officer",
      email: `review_officer_${rand}@buybox.local`,
      phone: "+919988223344",
      password: "Password123!",
      role: ROLES.SUPPORT,
      roles: [ROLES.SUPPORT],
      permissions: [
        PERMISSIONS.RETURNS_VIEW,
        PERMISSIONS.REFUND_APPLICATIONS_VIEW,
        PERMISSIONS.REFUND_APPLICATIONS_REVIEW,
        PERMISSIONS.REFUND_APPLICATIONS_APPROVE,
        PERMISSIONS.REFUND_APPLICATIONS_REJECT,
        PERMISSIONS.REFUND_APPLICATIONS_REVISE,
      ],
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    adminWithReviewToken = generateAccessToken({
      sub: adminWithReviewUser._id.toString(),
      role: ROLES.SUPPORT,
      roles: [ROLES.SUPPORT],
      permissions: [
        PERMISSIONS.RETURNS_VIEW,
        PERMISSIONS.REFUND_APPLICATIONS_VIEW,
        PERMISSIONS.REFUND_APPLICATIONS_REVIEW,
        PERMISSIONS.REFUND_APPLICATIONS_APPROVE,
        PERMISSIONS.REFUND_APPLICATIONS_REJECT,
        PERMISSIONS.REFUND_APPLICATIONS_REVISE,
      ],
      authVersion: 1,
      permissionVersion: 1,
      context: "admin",
    });

    // 3. Admin with disbursement permission
    adminWithDisburseUser = await User.create({
      firstName: "Disburse",
      lastName: "Finance",
      email: `disburse_officer_${rand}@buybox.local`,
      phone: "+919988334455",
      password: "Password123!",
      role: ROLES.SUPPORT,
      roles: [ROLES.SUPPORT],
      permissions: [
        PERMISSIONS.RETURNS_VIEW,
        PERMISSIONS.REFUNDS_CREATE,
        PERMISSIONS.REFUND_DISBURSEMENT_INITIATE,
        PERMISSIONS.REFUND_APPLICATIONS_VIEW,
      ],
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    adminWithDisburseToken = generateAccessToken({
      sub: adminWithDisburseUser._id.toString(),
      role: ROLES.SUPPORT,
      roles: [ROLES.SUPPORT],
      permissions: [
        PERMISSIONS.RETURNS_VIEW,
        PERMISSIONS.REFUNDS_CREATE,
        PERMISSIONS.REFUND_DISBURSEMENT_INITIATE,
        PERMISSIONS.REFUND_APPLICATIONS_VIEW,
      ],
      authVersion: 1,
      permissionVersion: 1,
      context: "admin",
    });

    // 4. Admin with NO refund permissions
    adminNoPermUser = await User.create({
      firstName: "Catalog",
      lastName: "Viewer",
      email: `catalog_viewer_${rand}@buybox.local`,
      phone: "+919988445566",
      password: "Password123!",
      role: ROLES.SUPPORT,
      roles: [ROLES.SUPPORT],
      permissions: [PERMISSIONS.PRODUCTS_VIEW],
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    adminNoPermToken = generateAccessToken({
      sub: adminNoPermUser._id.toString(),
      role: ROLES.SUPPORT,
      roles: [ROLES.SUPPORT],
      permissions: [PERMISSIONS.PRODUCTS_VIEW],
      authVersion: 1,
      permissionVersion: 1,
      context: "admin",
    });

    // 5. Customer
    customerUser = await User.create({
      firstName: "Neha",
      lastName: "Sharma",
      email: `neha_gov_${rand}@customer.com`,
      phone: "+919877112233",
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    customerDoc = await Customer.create({
      userId: customerUser._id,
      firstName: "Neha",
      lastName: "Sharma",
      email: `neha_gov_${rand}@customer.com`,
      phone: "+919877112233",
    });
    customerToken = generateAccessToken({
      sub: customerUser._id.toString(),
      role: ROLES.CUSTOMER,
      authVersion: 1,
      permissionVersion: 1,
      context: "customer",
    });

    // 6. Vendor A
    vendorUserA = await User.create({
      firstName: "Alpha",
      lastName: "Merchant",
      email: `alpha_gov_${rand}@vendor.com`,
      phone: "+919766112233",
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendorDocA = await Vendor.create({
      userId: vendorUserA._id,
      businessName: `Alpha Electronics ${rand}`,
      storeName: `Alpha Electronics Store ${rand}`,
      businessSlug: `alpha-electronics-${rand}`,
      onboardingStatus: "approved",
      isActive: true,
    });
    vendorTokenA = generateAccessToken({
      sub: vendorUserA._id.toString(),
      role: ROLES.VENDOR,
      authVersion: 1,
      permissionVersion: 1,
      context: "vendor",
    });

    // 7. Vendor B
    vendorUserB = await User.create({
      firstName: "Beta",
      lastName: "Merchant",
      email: `beta_gov_${rand}@vendor.com`,
      phone: "+919766223344",
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendorDocB = await Vendor.create({
      userId: vendorUserB._id,
      businessName: `Beta Retailers ${rand}`,
      storeName: `Beta Retail Store ${rand}`,
      businessSlug: `beta-retail-${rand}`,
      onboardingStatus: "approved",
      isActive: true,
    });
    vendorTokenB = generateAccessToken({
      sub: vendorUserB._id.toString(),
      role: ROLES.VENDOR,
      authVersion: 1,
      permissionVersion: 1,
      context: "vendor",
    });

    // 8. Catalog: Category, Brand, Product
    category = await Category.create({
      name: `Gov Category ${rand}`,
      slug: `gov-category-${rand}`,
      isActive: true,
    });
    brand = await Brand.create({
      name: `Gov Brand ${rand}`,
      slug: `gov-brand-${rand}`,
      isActive: true,
    });
    productA = await Product.create({
      name: `Gov Smart Speaker ${rand}`,
      slug: `gov-smart-speaker-${rand}`,
      sku: `GOV-SPEAKER-${rand}`,
      vendorId: vendorDocA._id,
      categoryId: category._id,
      brandId: brand._id,
      price: mongoose.Types.Decimal128.fromString("1500.00"),
      stock: 100,
      isActive: true,
    });
    variantA = await ProductVariant.create({
      productId: productA._id,
      sku: `GOV-SPEAKER-V1-${rand}`,
      price: mongoose.Types.Decimal128.fromString("1500.00"),
      stock: 50,
      isActive: true,
    });

    // 9. Order & Captured Payment
    orderPrepaid = await Order.create({
      orderNumber: `ORD-GOV-${rand}`,
      customerId: customerDoc._id,
      userId: customerUser._id,
      status: "delivered",
      paymentStatus: "paid",
      paymentMethod: "razorpay",
      currency: "INR",
      grandTotal: 1770,
      amountPaid: 1770,
      subtotal: 1500,
      taxTotal: 270,
      shippingTotal: 0,
      discountTotal: 0,
      placedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      deliveredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      items: [
        {
          productId: productA._id,
          productVariantId: variantA._id,
          productName: productA.name,
          sku: variantA.sku,
          quantity: 1,
          unitPrice: 1500,
          lineTotal: 1500,
          currency: "INR",
          discountTotal: 0,
          taxTotal: 270,
          vendorId: vendorDocA._id,
          fulfillmentStatus: "delivered",
        },
      ],
      shippingAddress: {
        fullName: "Neha Sharma",
        phone: "+919877112233",
        addressLine1: "101 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
    });

    paymentPrepaid = await Payment.create({
      orderId: orderPrepaid._id,
      customerId: customerDoc._id,
      gateway: "razorpay",
      gatewayPaymentId: `pay_gov_${rand}`,
      gatewayOrderId: `order_gov_${rand}`,
      amount: mongoose.Types.Decimal128.fromString("1820.00"),
      currency: "INR",
      status: "captured",
      capturedAt: new Date(),
    });

    // 10. Return Request: Not Yet Inspected (status: "requested")
    returnNotInspected = await ReturnRequest.create({
      returnNumber: `RET-NOTINS-${rand}`,
      orderId: orderPrepaid._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      type: "return",
      status: "requested",
      reason: "defective_product",
      items: [
        {
          orderItemId: orderPrepaid.items[0]._id,
          productId: productA._id,
          productVariantId: variantA._id,
          name: productA.name,
          sku: variantA.sku,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("1500.00"),
          taxRefund: mongoose.Types.Decimal128.fromString("270.00"),
          customerPaidAmount: mongoose.Types.Decimal128.fromString("1500.00"),
          reason: "defective_product",
        },
      ],
      refundAmount: mongoose.Types.Decimal128.fromString("1770.00"),
    });

    // 11. Return Request: Inspected (status: "inspected")
    returnInspectedA = await ReturnRequest.create({
      returnNumber: `RET-INS-A-${rand}`,
      orderId: orderPrepaid._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      type: "return",
      status: "inspected",
      reason: "defective_product",
      items: [
        {
          orderItemId: orderPrepaid.items[0]._id,
          productId: productA._id,
          productVariantId: variantA._id,
          name: productA.name,
          sku: variantA.sku,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("1500.00"),
          taxRefund: mongoose.Types.Decimal128.fromString("270.00"),
          customerPaidAmount: mongoose.Types.Decimal128.fromString("1500.00"),
          reason: "defective_product",
        },
      ],
      inspection: {
        passed: true,
        outcome: "passed",
        status: "passed",
        condition: "unopened",
        receivedCondition: "unopened",
        packagingCondition: "intact",
        productCondition: "resellable",
        missingAccessories: false,
        deductionAmount: mongoose.Types.Decimal128.fromString("0.00"),
        inspectedAt: new Date(),
        inspectedBy: vendorUserA._id,
      },
      merchantInspection: {
        passed: true,
        outcome: "passed",
        condition: "unopened",
        receivedCondition: "unopened",
        packagingCondition: "intact",
        productCondition: "resellable",
        missingAccessories: false,
        deductionAmount: mongoose.Types.Decimal128.fromString("0.00"),
        inspectedAt: new Date(),
        inspectorId: vendorUserA._id,
      },
      refundAmount: mongoose.Types.Decimal128.fromString("1770.00"),
      refundBreakdown: {
        productRefund: {
          customerPaidAmount: mongoose.Types.Decimal128.fromString("1500.00"),
        },
        taxRefund: {
          refundableTax: mongoose.Types.Decimal128.fromString("270.00"),
        },
        shippingRefund: {
          refundableShipping: mongoose.Types.Decimal128.fromString("0.00"),
        },
        deductions: {
          amount: mongoose.Types.Decimal128.fromString("0.00"),
        },
        finalRefund: {
          netRefundableAmount: mongoose.Types.Decimal128.fromString("1770.00"),
        },
      },
    });

    // 12. Return Request for Vendor B
    returnInspectedB = await ReturnRequest.create({
      returnNumber: `RET-INS-B-${rand}`,
      orderId: orderPrepaid._id,
      customerId: customerDoc._id,
      vendorId: vendorDocB._id,
      type: "return",
      status: "inspected",
      reason: "damaged_item",
      items: [
        {
          orderItemId: orderPrepaid.items[0]._id,
          productId: productA._id,
          productVariantId: variantA._id,
          name: productA.name,
          sku: variantA.sku,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("1500.00"),
          taxRefund: mongoose.Types.Decimal128.fromString("270.00"),
          customerPaidAmount: mongoose.Types.Decimal128.fromString("1500.00"),
          reason: "damaged_item",
        },
      ],
      merchantInspection: {
        passed: true,
        inspectedAt: new Date(),
      },
      refundAmount: mongoose.Types.Decimal128.fromString("1770.00"),
    });
  });

  // =========================================================================
  // SUITE 1: MERCHANT DIRECT DISBURSEMENT PROHIBITION
  // =========================================================================
  describe("Suite 1: Merchant Direct Disbursement Prohibition", () => {
    it("Scenario 1: Vendor direct disbursement via /vendors/me/returns/:id/refund is rejected with HTTP 403", async () => {
      const res = await request(app)
        .post(`/api/v1/vendors/me/returns/${returnInspectedA._id}/refund`)
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("MERCHANT_DISBURSEMENT_UNAUTHORIZED");
    });

    it("Scenario 2: Vendor direct disbursement via /returns/me/:id/refund is rejected with HTTP 403", async () => {
      const res = await request(app)
        .post(`/api/v1/returns/me/${returnInspectedA._id}/refund`)
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("MERCHANT_DISBURSEMENT_UNAUTHORIZED");
    });
  });

  // =========================================================================
  // SUITE 2: REFUND APPLICATION SUBMISSION & VALIDATION
  // =========================================================================
  describe("Suite 2: Refund Application Submission & Validation", () => {
    it("Scenario 3: Attempting refund application before inspection fails with HTTP 400", async () => {
      const res = await request(app)
        .post(`/api/v1/vendors/me/returns/${returnNotInspected._id}/refund-application`)
        .set("Authorization", `Bearer ${vendorTokenA}`)
        .send({
          merchantRemarks: "Premature submission without unboxing",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("RETURN_NOT_INSPECTED");
    });

    it("Scenario 4: Tenant isolation — Vendor B cannot apply for Vendor A's return", async () => {
      const res = await request(app)
        .post(`/api/v1/vendors/me/returns/${returnInspectedA._id}/refund-application`)
        .set("Authorization", `Bearer ${vendorTokenB}`)
        .send({
          merchantRemarks: "Unauthorized cross-vendor application",
        });

      expect(res.status).toBe(404);
    });

    it("Scenario 5: Customer cannot submit a merchant refund application", async () => {
      const res = await request(app)
        .post(`/api/v1/vendors/me/returns/${returnInspectedA._id}/refund-application`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          merchantRemarks: "Customer trying to masquerade as merchant",
        });

      expect(res.status).toBe(403);
    });

    let createdApplicationId;

    it("Scenario 6: Eligible merchant successfully submits refund application with immutable authoritative amount", async () => {
      const res = await request(app)
        .post(`/api/v1/vendors/me/returns/${returnInspectedA._id}/refund-application`)
        .set("Authorization", `Bearer ${vendorTokenA}`)
        .send({
          merchantRemarks: "Full unboxing inspection completed. Unit in sealed, resellable condition.",
          deductionExplanation: "Zero deduction applied.",
          // Attempting to pass tampered amount (must be ignored/overridden by backend calculation)
          requestedAmount: 99999,
        });

      expect(res.status).toBe(201);
      const appData = res.body.data;
      expect(appData).toBeDefined();
      expect(appData.applicationNumber).toMatch(/^RA-\d{6}-[A-Z0-9]+$/);
      expect(appData.applicationStatus).toBe("submitted");
      // Must reflect authoritative formula (1500 product + 270 tax = 1770), NOT 99999
      expect(Number(appData.requestedAmount)).toBe(1770);
      expect(appData.inspectionSnapshot).toBeDefined();
      expect(appData.inspectionSnapshot.outcome).toBe("passed");
      expect(appData.paymentSnapshot).toBeDefined();
      expect(appData.paymentSnapshot.gateway).toBe("razorpay");

      createdApplicationId = appData._id;
    });

    it("Scenario 7: Duplicate application for the same return is rejected with HTTP 409", async () => {
      const res = await request(app)
        .post(`/api/v1/vendors/me/returns/${returnInspectedA._id}/refund-application`)
        .set("Authorization", `Bearer ${vendorTokenA}`)
        .send({
          merchantRemarks: "Duplicate attempt while first is pending",
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("ACTIVE_APPLICATION_EXISTS");
    });

    it("Scenario 8: Merchant can retrieve application status via /returns/:id/refund-application", async () => {
      const res = await request(app)
        .get(`/api/v1/vendors/me/returns/${returnInspectedA._id}/refund-application`)
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data._id.toString()).toBe(createdApplicationId.toString());
      expect(res.body.data.applicationStatus).toBe("submitted");
    });
  });

  // =========================================================================
  // SUITE 3: ADMINISTRATIVE AUDIT QUEUE & DETAIL RETRIEVAL
  // =========================================================================
  describe("Suite 3: Administrative Audit Queue & Filtering", () => {
    it("Scenario 9: Admin without permission cannot view refund applications queue", async () => {
      const res = await request(app)
        .get("/api/v1/refund-applications")
        .set("Authorization", `Bearer ${adminNoPermToken}`);

      expect(res.status).toBe(403);
    });

    it("Scenario 10: Authorized admin retrieves refund applications queue with KPIs", async () => {
      const res = await request(app)
        .get("/api/v1/refund-applications")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.applications).toBeDefined();
      expect(Array.isArray(res.body.data.applications)).toBe(true);
      expect(res.body.data.applications.length).toBeGreaterThanOrEqual(1);

      // Verify KPI aggregation
      const kpis = res.body.data.kpis;
      expect(kpis).toBeDefined();
      expect(kpis.totalApplications).toBeGreaterThanOrEqual(1);
      expect(typeof kpis.totalLiability).toBe("number");
    });

    it("Scenario 11: Admin can filter applications by status=submitted", async () => {
      const res = await request(app)
        .get("/api/v1/refund-applications?status=submitted")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      res.body.data.applications.forEach((app) => {
        expect(app.applicationStatus).toBe("submitted");
      });
    });
  });

  // =========================================================================
  // SUITE 4: ADMINISTRATIVE REVIEW & REVISION LIFECYCLE
  // =========================================================================
  describe("Suite 4: Administrative Review, Revision, & Resubmission", () => {
    let testAppId;

    beforeAll(async () => {
      // Find the created application
      const appDoc = await RefundApplication.findOne({ returnId: returnInspectedA._id });
      testAppId = appDoc._id;
    });

    it("Scenario 12: Admin transitions application to under_review", async () => {
      const res = await request(app)
        .put(`/api/v1/refund-applications/${testAppId}/review`)
        .set("Authorization", `Bearer ${adminWithReviewToken}`)
        .send({ remarks: "Examining high-value return claim" });

      expect(res.status).toBe(200);
      expect(res.body.data.applicationStatus).toBe("under_review");
    });

    it("Scenario 13: Admin revision request fails if instructions are missing or < 5 characters", async () => {
      const res = await request(app)
        .post(`/api/v1/refund-applications/${testAppId}/request-revision`)
        .set("Authorization", `Bearer ${adminWithReviewToken}`)
        .send({ revisionInstructions: "Fix" });

      expect(res.status).toBe(400);
    });

    it("Scenario 14: Admin successfully requests revision from merchant with valid instructions", async () => {
      const res = await request(app)
        .post(`/api/v1/refund-applications/${testAppId}/request-revision`)
        .set("Authorization", `Bearer ${adminWithReviewToken}`)
        .send({
          revisionInstructions: "Please upload unboxing video and verify packaging condition intact.",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.applicationStatus).toBe("revision_requested");
      expect(res.body.data.revisionInstructions).toBe(
        "Please upload unboxing video and verify packaging condition intact."
      );
    });

    it("Scenario 15: Merchant successfully resubmits revised application", async () => {
      const res = await request(app)
        .post(`/api/v1/vendors/me/returns/${returnInspectedA._id}/resubmit-refund-application`)
        .set("Authorization", `Bearer ${vendorTokenA}`)
        .send({
          merchantRemarks: "Uploaded unboxing photograph and re-tested device functionality. Verified 100% operational.",
          supportingDocuments: ["https://example.com/unboxing-evidence.jpg"],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.applicationStatus).toBe("submitted");
      expect(res.body.data.revisionHistory.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // SUITE 5: REJECTION LIFECYCLE
  // =========================================================================
  describe("Suite 5: Application Rejection Lifecycle", () => {
    let appB;

    beforeAll(async () => {
      // Vendor B submits an application for returnInspectedB
      const res = await request(app)
        .post(`/api/v1/vendors/me/returns/${returnInspectedB._id}/refund-application`)
        .set("Authorization", `Bearer ${vendorTokenB}`)
        .send({
          merchantRemarks: "Damaged box received, requesting refund.",
        });
      appB = res.body.data;
    });

    it("Scenario 16: Admin rejection fails if rejectionReason is missing or < 5 characters", async () => {
      const res = await request(app)
        .post(`/api/v1/refund-applications/${appB._id}/reject`)
        .set("Authorization", `Bearer ${adminWithReviewToken}`)
        .send({ rejectionReason: "No" });

      expect(res.status).toBe(400);
    });

    it("Scenario 17: Admin successfully rejects application with valid reason", async () => {
      const res = await request(app)
        .post(`/api/v1/refund-applications/${appB._id}/reject`)
        .set("Authorization", `Bearer ${adminWithReviewToken}`)
        .send({
          rejectionReason: "Inspection photos reveal customer induced tampering of warranty seal.",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.applicationStatus).toBe("rejected");
      expect(res.body.data.rejectionReason).toBe(
        "Inspection photos reveal customer induced tampering of warranty seal."
      );
    });
  });

  // =========================================================================
  // SUITE 6: APPROVAL, DISBURSEMENT SEPARATION, & GATEWAY EXECUTION
  // =========================================================================
  describe("Suite 6: Approval, Disbursement Separation, & Gateway Execution", () => {
    let targetApp;

    beforeAll(async () => {
      targetApp = await RefundApplication.findOne({ returnId: returnInspectedA._id });
      if (!targetApp) {
        targetApp = await RefundApplication.create({
          applicationNumber: `RA-SUITE6-${rand}`,
          returnId: returnInspectedA._id,
          orderId: orderPrepaid._id,
          merchantId: vendorDocA._id,
          customerId: customerDoc._id,
          authoritativeRefundBreakdown: { finalRefund: { netRefundableAmount: 1770 } },
          requestedAmount: mongoose.Types.Decimal128.fromString("1770.00"),
          currency: "INR",
          applicationStatus: "submitted",
          merchantRemarks: "Verified in inspection.",
          submittedBy: vendorUserA._id,
        });
      }
    });

    it("Scenario 18: Admin approves application — locks approvedAmount and sets status to approved", async () => {
      const res = await request(app)
        .post(`/api/v1/refund-applications/${targetApp._id}/approve`)
        .set("Authorization", `Bearer ${adminWithReviewToken}`)
        .send({ remarks: "Approved following evidence review" });

      expect(res.status).toBe(200);
      expect(res.body.data.applicationStatus).toBe("approved");
      expect(Number(res.body.data.approvedAmount)).toBe(1770);
      // Ensure the return request is NOT yet refunded (approval is NOT disbursement)
      const ret = await ReturnRequest.findById(returnInspectedA._id);
      expect(ret.status).not.toBe("refunded");
    });

    it("Scenario 19: Disbursement without REFUNDS_CREATE permission is rejected with HTTP 403", async () => {
      // adminWithReviewUser has approve permission but NOT disbursement permission
      const res = await request(app)
        .post(`/api/v1/refund-applications/${targetApp._id}/disburse`)
        .set("Authorization", `Bearer ${adminWithReviewToken}`);

      expect(res.status).toBe(403);
    });

    it("Scenario 20: Non-admin (vendor) attempting disbursement is rejected with HTTP 403", async () => {
      const res = await request(app)
        .post(`/api/v1/refund-applications/${targetApp._id}/disburse`)
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(403);
    });

    it("Scenario 21: Authorized admin initiates disbursement — executes gateway reversal and updates status to disbursed", async () => {
      // Mock refundService.createRefund to simulate successful gateway execution
      jest.spyOn(refundService, "createRefund").mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(),
        id: `rpay_ref_${rand}`,
        amount: 1770,
        currency: "INR",
        status: "processed",
      });

      const res = await request(app)
        .post(`/api/v1/refund-applications/${targetApp._id}/disburse`)
        .set("Authorization", `Bearer ${adminWithDisburseToken}`)
        .send({ remarks: "Disbursement executed via Razorpay" });

      expect(res.status).toBe(200);
      expect(res.body.data.applicationStatus).toBe("disbursed");
      expect(Number(res.body.data.disbursedAmount)).toBe(1770);
      expect(res.body.data.disbursementReference).toBeDefined();

      // Verify ReturnRequest updated to refunded
      const updatedRet = await ReturnRequest.findById(returnInspectedA._id);
      expect(updatedRet.status).toBe("refunded");

      refundService.createRefund.mockRestore();
    });
  });

  // =========================================================================
  // SUITE 7: GATEWAY FAILURE SAFEGUARD & RETRY
  // =========================================================================
  describe("Suite 7: Gateway Failure Safeguard & Safe Retry", () => {
    let failApp, failReturn;

    beforeAll(async () => {
      // Create new return & application for failure testing
      failReturn = await ReturnRequest.create({
        returnNumber: `RET-FAIL-${rand}`,
        orderId: orderPrepaid._id,
        customerId: customerDoc._id,
        vendorId: vendorDocA._id,
        type: "return",
        status: "inspected",
        reason: "wrong_item",
        items: [
          {
            orderItemId: orderPrepaid.items[0]._id,
            productId: productA._id,
            productVariantId: variantA._id,
            name: productA.name,
            sku: variantA.sku,
            quantity: 1,
            itemPrice: mongoose.Types.Decimal128.fromString("1500.00"),
            taxRefund: mongoose.Types.Decimal128.fromString("270.00"),
            customerPaidAmount: mongoose.Types.Decimal128.fromString("1500.00"),
            reason: "wrong_item",
          },
        ],
        merchantInspection: {
          passed: true,
          inspectedAt: new Date(),
        },
        refundAmount: mongoose.Types.Decimal128.fromString("1770.00"),
      });

      failApp = await RefundApplication.create({
        applicationNumber: `RA-FAIL-${rand}`,
        returnId: failReturn._id,
        orderId: orderPrepaid._id,
        merchantId: vendorDocA._id,
        customerId: customerDoc._id,
        authoritativeRefundBreakdown: { finalRefund: { netRefundableAmount: 1770 } },
        requestedAmount: mongoose.Types.Decimal128.fromString("1770.00"),
        currency: "INR",
        applicationStatus: "approved",
        approvedAmount: mongoose.Types.Decimal128.fromString("1770.00"),
        merchantRemarks: "Wrong item received and verified.",
        submittedBy: vendorUserA._id,
      });
    });

    it("Scenario 22: Gateway failure marks application as disbursement_failed and records failureDetails", async () => {
      jest.spyOn(refundService, "createRefund").mockRejectedValueOnce(
        new Error("GATEWAY_TIMEOUT: Gateway connection dropped during debit")
      );

      const res = await request(app)
        .post(`/api/v1/refund-applications/${failApp._id}/disburse`)
        .set("Authorization", `Bearer ${adminWithDisburseToken}`);

      expect(res.status).toBe(502);
      expect(res.body.code).toBe("DISBURSEMENT_GATEWAY_FAILED");

      const checkApp = await RefundApplication.findById(failApp._id);
      expect(["disbursement_failed", "pending_confirmation"]).toContain(checkApp.applicationStatus);
      expect(checkApp.failureDetails.message).toContain("GATEWAY_TIMEOUT");

      refundService.createRefund.mockRestore();
    });

    it("Scenario 23: Authorized admin successfully retries disbursement following failure", async () => {
      jest.spyOn(refundService, "createRefund").mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(),
        id: `rpay_ref_retry_${rand}`,
        amount: 1770,
        currency: "INR",
        status: "processed",
      });

      const res = await request(app)
        .post(`/api/v1/refund-applications/${failApp._id}/retry`)
        .set("Authorization", `Bearer ${adminWithDisburseToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.applicationStatus).toBe("disbursed");
      expect(Number(res.body.data.disbursedAmount)).toBe(1770);

      refundService.createRefund.mockRestore();
    });
  });
});
