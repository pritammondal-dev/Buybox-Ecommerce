const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../src/app");

const User = require("../src/models/User");
const Customer = require("../src/models/Customer");
const Vendor = require("../src/models/Vendor");
const Employee = require("../src/models/Employee");
const JobRole = require("../src/models/JobRole");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Order = require("../src/models/Order");
const ReturnRequest = require("../src/models/ReturnRequest");
const Review = require("../src/models/Review");
const ProductQuestion = require("../src/models/ProductQuestion");
const ProductDiscount = require("../src/models/ProductDiscount");

const { generateAccessToken } = require("../src/services/token.service");
const { ROLES } = require("../src/constants/auth.constants");
const { PERMISSIONS } = require("../src/constants/permissions.constants");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/\/buybox(_test)?(\?|$)/, "/buybox_rbac02_test$2")
  : "mongodb://127.0.0.1:27017/buybox_rbac02_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Phase RBAC-02 — Runtime Authorization, Access Control & Privilege Escalation Security Suite", () => {
  let superadminUser, superadminToken;
  let adminStaffUser, adminStaffToken;
  let regularStaffUser, regularStaffToken;
  let customerUserA, customerTokenA, customerDocA;
  let customerUserB, customerTokenB, customerDocB;
  let vendorUserA, vendorTokenA, vendorDocA;
  let vendorUserB, vendorTokenB, vendorDocB;
  let testCategory, testBrand;
  let productA, variantA;
  let productB, variantB;
  let orderA, orderB;
  let returnA;
  let unapprovedReviewA, approvedReviewA;
  let questionProductA;

  const rand = Math.random().toString(36).substring(7);

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // 1. Setup Category & Brand
    testCategory = await Category.create({
      name: `RBAC02 Cat ${rand}`,
      slug: `rbac02-cat-${rand}`,
      isActive: true,
    });

    testBrand = await Brand.create({
      name: `RBAC02 Brand ${rand}`,
      slug: `rbac02-brand-${rand}`,
      isActive: true,
    });

    // 2. Setup Superadmin
    superadminUser = await User.create({
      firstName: "Super",
      lastName: "Admin",
      email: `superadmin_${rand}@rbac02.com`,
      password: "Password123!",
      role: ROLES.SUPER_ADMIN,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const superRole = await JobRole.create({
      name: `SuperAdminRole_${rand}`,
      slug: `superadmin-role-${rand}`,
      tier: 1,
      permissions: Object.values(PERMISSIONS),
      isActive: true,
    });

    await Employee.create({
      userId: superadminUser._id,
      employeeNumber: `EMP-SUP-${rand.toUpperCase()}`,
      jobRoleId: superRole._id,
      status: "active",
    });

    superadminToken = generateAccessToken({
      sub: superadminUser._id.toString(),
      role: ROLES.SUPER_ADMIN,
      authVersion: 1,
      permissionVersion: 1,
      context: "administrator",
    });

    // 3. Setup Admin Staff with reviews:moderate, discounts:read, discounts:manage
    adminStaffUser = await User.create({
      firstName: "Admin",
      lastName: "Staff",
      email: `adminstaff_${rand}@rbac02.com`,
      password: "Password123!",
      role: ROLES.ADMIN,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const adminRole = await JobRole.create({
      name: `AdminRole_${rand}`,
      slug: `admin-role-${rand}`,
      tier: 2,
      permissions: [
        PERMISSIONS.REVIEWS_READ,
        PERMISSIONS.REVIEWS_MODERATE,
        PERMISSIONS.DISCOUNTS_READ,
        PERMISSIONS.DISCOUNTS_MANAGE,
        PERMISSIONS.CATALOG_READ,
        PERMISSIONS.PRODUCTS_READ,
      ],
      isActive: true,
    });

    await Employee.create({
      userId: adminStaffUser._id,
      employeeNumber: `EMP-ADM-${rand.toUpperCase()}`,
      jobRoleId: adminRole._id,
      status: "active",
    });

    adminStaffToken = generateAccessToken({
      sub: adminStaffUser._id.toString(),
      role: ROLES.ADMIN,
      authVersion: 1,
      permissionVersion: 1,
      context: "administrator",
    });

    // 4. Setup Regular Staff (Editor) without moderation or discount manage permissions
    regularStaffUser = await User.create({
      firstName: "Regular",
      lastName: "Editor",
      email: `editor_${rand}@rbac02.com`,
      password: "Password123!",
      role: ROLES.EDITOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const editorRole = await JobRole.create({
      name: `EditorRole_${rand}`,
      slug: `editor-role-${rand}`,
      tier: 3,
      permissions: [PERMISSIONS.CATALOG_READ, PERMISSIONS.PRODUCTS_READ],
      isActive: true,
    });

    await Employee.create({
      userId: regularStaffUser._id,
      employeeNumber: `EMP-EDT-${rand.toUpperCase()}`,
      jobRoleId: editorRole._id,
      status: "active",
    });

    regularStaffToken = generateAccessToken({
      sub: regularStaffUser._id.toString(),
      role: ROLES.EDITOR,
      authVersion: 1,
      permissionVersion: 1,
      context: "administrator",
    });

    // 5. Setup Customer A & Customer B
    customerUserA = await User.create({
      firstName: "Customer",
      lastName: "Alpha",
      email: `customerA_${rand}@rbac02.com`,
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    customerDocA = await Customer.create({
      userId: customerUserA._id,
      isActive: true,
    });
    customerTokenA = generateAccessToken({
      sub: customerUserA._id.toString(),
      role: ROLES.CUSTOMER,
      authVersion: 1,
      permissionVersion: 1,
      context: "customer",
    });

    customerUserB = await User.create({
      firstName: "Customer",
      lastName: "Beta",
      email: `customerB_${rand}@rbac02.com`,
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    customerDocB = await Customer.create({
      userId: customerUserB._id,
      isActive: true,
    });
    customerTokenB = generateAccessToken({
      sub: customerUserB._id.toString(),
      role: ROLES.CUSTOMER,
      authVersion: 1,
      permissionVersion: 1,
      context: "customer",
    });

    // 6. Setup Vendor A & Vendor B
    vendorUserA = await User.create({
      firstName: "Vendor",
      lastName: "Alpha",
      email: `vendorA_${rand}@rbac02.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendorDocA = await Vendor.create({
      userId: vendorUserA._id,
      businessName: `Vendor Alpha ${rand}`,
      businessSlug: `vendor-alpha-${rand}`,
      isActive: true,
      onboardingStatus: "approved",
    });
    vendorTokenA = generateAccessToken({
      sub: vendorUserA._id.toString(),
      role: ROLES.VENDOR,
      authVersion: 1,
      permissionVersion: 1,
      context: "vendor",
    });

    vendorUserB = await User.create({
      firstName: "Vendor",
      lastName: "Beta",
      email: `vendorB_${rand}@rbac02.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendorDocB = await Vendor.create({
      userId: vendorUserB._id,
      businessName: `Vendor Beta ${rand}`,
      businessSlug: `vendor-beta-${rand}`,
      isActive: true,
      onboardingStatus: "approved",
    });
    vendorTokenB = generateAccessToken({
      sub: vendorUserB._id.toString(),
      role: ROLES.VENDOR,
      authVersion: 1,
      permissionVersion: 1,
      context: "vendor",
    });

    // 7. Setup Products for Vendor A and Vendor B
    productA = await Product.create({
      name: `Product Alpha ${rand}`,
      slug: `product-alpha-${rand}`,
      vendorId: vendorDocA._id,
      categoryId: testCategory._id,
      brandId: testBrand._id,
      sku: `SKU-A-${rand}`,
      price: mongoose.Types.Decimal128.fromString("1000.00"),
      currency: "INR",
      status: "active",
    });
    variantA = await ProductVariant.create({
      productId: productA._id,
      sku: `VAR-A-${rand}`,
      name: `Variant Alpha ${rand}`,
      price: mongoose.Types.Decimal128.fromString("1000.00"),
      stock: 100,
    });

    productB = await Product.create({
      name: `Product Beta ${rand}`,
      slug: `product-beta-${rand}`,
      vendorId: vendorDocB._id,
      categoryId: testCategory._id,
      brandId: testBrand._id,
      sku: `SKU-B-${rand}`,
      price: mongoose.Types.Decimal128.fromString("2000.00"),
      currency: "INR",
      status: "active",
    });
    variantB = await ProductVariant.create({
      productId: productB._id,
      sku: `VAR-B-${rand}`,
      name: `Variant Beta ${rand}`,
      price: mongoose.Types.Decimal128.fromString("2000.00"),
      stock: 50,
    });

    // 8. Setup Orders for Customer A and Customer B
    orderA = await Order.create({
      orderNumber: `ORD-A1-${rand}`,
      customerId: customerDocA._id,
      userId: customerUserA._id,
      status: "delivered",
      paymentStatus: "paid",
      subtotal: mongoose.Types.Decimal128.fromString("1000.00"),
      grandTotal: mongoose.Types.Decimal128.fromString("1000.00"),
      currency: "INR",
      shippingAddress: {
        fullName: "Customer Alpha",
        phone: "+919876543210",
        addressLine1: "123 Alpha Way",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      items: [
        {
          productId: productA._id,
          productVariantId: variantA._id,
          vendorId: vendorDocA._id,
          productName: productA.name,
          sku: variantA.sku,
          quantity: 1,
          unitPrice: mongoose.Types.Decimal128.fromString("1000.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("1000.00"),
          currency: "INR",
          fulfillmentStatus: "delivered",
        },
      ],
    });

    const orderA2 = await Order.create({
      orderNumber: `ORD-A2-${rand}`,
      customerId: customerDocA._id,
      userId: customerUserA._id,
      status: "delivered",
      paymentStatus: "paid",
      subtotal: mongoose.Types.Decimal128.fromString("1000.00"),
      grandTotal: mongoose.Types.Decimal128.fromString("1000.00"),
      currency: "INR",
      shippingAddress: {
        fullName: "Customer Alpha",
        phone: "+919876543210",
        addressLine1: "123 Alpha Way",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      items: [
        {
          productId: productA._id,
          productVariantId: variantA._id,
          vendorId: vendorDocA._id,
          productName: productA.name,
          sku: variantA.sku,
          quantity: 1,
          unitPrice: mongoose.Types.Decimal128.fromString("1000.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("1000.00"),
          currency: "INR",
          fulfillmentStatus: "delivered",
        },
      ],
    });

    orderB = await Order.create({
      orderNumber: `ORD-B-${rand}`,
      customerId: customerDocB._id,
      userId: customerUserB._id,
      status: "delivered",
      paymentStatus: "paid",
      subtotal: mongoose.Types.Decimal128.fromString("2000.00"),
      grandTotal: mongoose.Types.Decimal128.fromString("2000.00"),
      currency: "INR",
      shippingAddress: {
        fullName: "Customer Beta",
        phone: "+919876543211",
        addressLine1: "456 Beta Street",
        city: "Delhi",
        state: "Delhi",
        postalCode: "110001",
        country: "IN",
      },
      items: [
        {
          productId: productB._id,
          productVariantId: variantB._id,
          vendorId: vendorDocB._id,
          productName: productB.name,
          sku: variantB.sku,
          quantity: 1,
          unitPrice: mongoose.Types.Decimal128.fromString("2000.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("2000.00"),
          currency: "INR",
          fulfillmentStatus: "delivered",
        },
      ],
    });

    // 9. Setup Return Request for Customer A
    returnA = await ReturnRequest.create({
      returnNumber: `RET-A-${rand}`.toUpperCase(),
      orderId: orderA._id,
      customerId: customerDocA._id,
      userId: customerUserA._id,
      items: [
        {
          orderItemId: orderA.items[0]._id,
          productId: productA._id,
          productVariantId: variantA._id,
          sku: variantA.sku,
          name: productA.name,
          vendorId: vendorDocA._id,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("1000.00"),
          reason: "defective",
          condition: "unopened",
        },
      ],
      vendorIds: [vendorDocA._id],
      status: "requested",
      type: "return",
      requestedRefundAmount: mongoose.Types.Decimal128.fromString("1000.00"),
      currency: "INR",
    });

    // 10. Setup Reviews for Product A
    unapprovedReviewA = await Review.create({
      productId: productA._id,
      productVariantId: variantA._id,
      customerId: customerDocA._id,
      orderId: orderA._id,
      rating: 3,
      title: "Pending Review by Customer A",
      comment: "Awaiting moderator review.",
      status: "pending",
      isVerifiedPurchase: true,
    });

    approvedReviewA = await Review.create({
      productId: productA._id,
      productVariantId: variantA._id,
      customerId: customerDocA._id,
      orderId: orderA2._id,
      rating: 5,
      title: "Approved Review by Customer A",
      comment: "This is a great product!",
      status: "approved",
      isVerifiedPurchase: true,
    });

    // 11. Setup Product Question for Product A (owned by Vendor A)
    questionProductA = await ProductQuestion.create({
      productId: productA._id,
      customerId: customerDocA._id,
      userId: customerUserA._id,
      userName: "Customer Alpha",
      question: "Is this product water resistant?",
      status: "approved",
      answers: [],
    });
  });

  afterAll(async () => {
    await Category.deleteMany({ _id: testCategory?._id });
    await Brand.deleteMany({ _id: testBrand?._id });
    await User.deleteMany({
      _id: {
        $in: [
          superadminUser?._id,
          adminStaffUser?._id,
          regularStaffUser?._id,
          customerUserA?._id,
          customerUserB?._id,
          vendorUserA?._id,
          vendorUserB?._id,
        ].filter(Boolean),
      },
    });
    await Customer.deleteMany({ _id: { $in: [customerDocA?._id, customerDocB?._id].filter(Boolean) } });
    await Vendor.deleteMany({ _id: { $in: [vendorDocA?._id, vendorDocB?._id].filter(Boolean) } });
    await Product.deleteMany({ _id: { $in: [productA?._id, productB?._id].filter(Boolean) } });
    await ProductVariant.deleteMany({ _id: { $in: [variantA?._id, variantB?._id].filter(Boolean) } });
    await Order.deleteMany({ _id: { $in: [orderA?._id, orderB?._id].filter(Boolean) } });
    await ReturnRequest.deleteMany({ _id: returnA?._id });
    await Review.deleteMany({ _id: { $in: [unapprovedReviewA?._id, approvedReviewA?._id].filter(Boolean) } });
    await ProductQuestion.deleteMany({ _id: questionProductA?._id });
    await ProductDiscount.deleteMany({ name: new RegExp(rand) });
  });

  /*
   * ========================================================
   * FINDING 1: REVIEW AUTHORIZATION & DATA EXPOSURE GUARD
   * ========================================================
   */
  describe("Finding 1: Review Authorization & Data Exposure Guard", () => {
    test("Customer token MUST be rejected when attempting to list all reviews via GET /api/v1/reviews (403)", async () => {
      const res = await request(app)
        .get("/api/v1/reviews")
        .set("Authorization", `Bearer ${customerTokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test("Vendor token MUST be rejected when attempting to list all platform reviews via GET /api/v1/reviews (403)", async () => {
      const res = await request(app)
        .get("/api/v1/reviews")
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test("Staff token with reviews:moderate CAN list all reviews via GET /api/v1/reviews (200)", async () => {
      const res = await request(app)
        .get("/api/v1/reviews")
        .set("Authorization", `Bearer ${adminStaffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test("Public storefront user CAN view approved reviews via GET /api/v1/reviews/product/:productId (200)", async () => {
      const res = await request(app)
        .get(`/api/v1/reviews/product/${productA._id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const reviews = res.body.data;
      expect(Array.isArray(reviews)).toBe(true);
      // Must include approved review and MUST NOT leak unapproved review
      expect(reviews.some((r) => r.status === "approved")).toBe(true);
      expect(reviews.every((r) => r.status === "approved")).toBe(true);
    });

    test("Customer B cannot view Customer A's unapproved review via GET /api/v1/reviews/:reviewId (404)", async () => {
      const res = await request(app)
        .get(`/api/v1/reviews/${unapprovedReviewA._id}`)
        .set("Authorization", `Bearer ${customerTokenB}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    test("Customer A CAN view their own unapproved review via GET /api/v1/reviews/:reviewId (200)", async () => {
      const res = await request(app)
        .get(`/api/v1/reviews/${unapprovedReviewA._id}`)
        .set("Authorization", `Bearer ${customerTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id.toString()).toBe(unapprovedReviewA._id.toString());
    });

    test("Customer B CAN view Customer A's approved review via GET /api/v1/reviews/:reviewId (200)", async () => {
      const res = await request(app)
        .get(`/api/v1/reviews/${approvedReviewA._id}`)
        .set("Authorization", `Bearer ${customerTokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id.toString()).toBe(approvedReviewA._id.toString());
    });
  });

  /*
   * ========================================================
   * FINDING 2: DISCOUNT & PROMOTION ADMINISTRATIVE CONTEXT
   * ========================================================
   */
  describe("Finding 2: Discount & Promotion Administrative Token Context Guard", () => {
    test("Customer token MUST be rejected on /api/v1/admin/discounts (403 INVALID_SESSION_CONTEXT)", async () => {
      const res = await request(app)
        .get("/api/v1/admin/discounts")
        .set("Authorization", `Bearer ${customerTokenA}`);

      expect([401, 403]).toContain(res.status);
    });

    test("Customer token MUST be rejected on root /api/v1/discounts (403 INVALID_SESSION_CONTEXT)", async () => {
      const res = await request(app)
        .get("/api/v1/discounts")
        .set("Authorization", `Bearer ${customerTokenA}`);

      expect([401, 403]).toContain(res.status);
    });

    test("Customer token MUST be rejected on root /api/v1/promotions (403 INVALID_SESSION_CONTEXT)", async () => {
      const res = await request(app)
        .get("/api/v1/promotions")
        .set("Authorization", `Bearer ${customerTokenA}`);

      expect([401, 403]).toContain(res.status);
    });

    test("Vendor token MUST be rejected on /api/v1/admin/discounts (403 INVALID_SESSION_CONTEXT)", async () => {
      const res = await request(app)
        .get("/api/v1/admin/discounts")
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect([401, 403]).toContain(res.status);
    });

    test("Administrator token with discounts:read CAN access /api/v1/admin/discounts (200)", async () => {
      const res = await request(app)
        .get("/api/v1/admin/discounts")
        .set("Authorization", `Bearer ${adminStaffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("Administrator token CAN access root /api/v1/discounts alias (200)", async () => {
      const res = await request(app)
        .get("/api/v1/discounts")
        .set("Authorization", `Bearer ${adminStaffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  /*
   * ========================================================
   * FINDING 3: VENDOR Q&A OWNERSHIP & STAFF IDENTIFICATION
   * ========================================================
   */
  describe("Finding 3: Product Q&A Ownership & Staff Author Role Identification", () => {
    test("Customer answering a question receives authorRole: 'customer' and isVerified: false", async () => {
      const res = await request(app)
        .post(`/api/v1/questions/${questionProductA._id}/answers`)
        .set("Authorization", `Bearer ${customerTokenA}`)
        .send({ answer: "Yes, it worked fine in light rain." });

      expect(res.status).toBe(201);
      const answers = res.body.data.answers;
      const lastAnswer = answers[answers.length - 1];
      expect(lastAnswer.authorRole).toBe("customer");
      expect(lastAnswer.isVerified).toBe(false);
    });

    test("Superadmin answering a question receives authorRole: 'admin' and isVerified: true", async () => {
      const res = await request(app)
        .post(`/api/v1/questions/${questionProductA._id}/answers`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ answer: "Official Platform Notice: IPX4 splash resistance certified." });

      expect(res.status).toBe(201);
      const answers = res.body.data.answers;
      const lastAnswer = answers[answers.length - 1];
      expect(lastAnswer.authorRole).toBe("admin");
      expect(lastAnswer.isVerified).toBe(true);
    });

    test("Staff (Editor) answering a question receives authorRole: 'admin' and isVerified: true", async () => {
      const res = await request(app)
        .post(`/api/v1/questions/${questionProductA._id}/answers`)
        .set("Authorization", `Bearer ${regularStaffToken}`)
        .send({ answer: "Support confirms: manufacturer warranty covers light splashes." });

      expect(res.status).toBe(201);
      const answers = res.body.data.answers;
      const lastAnswer = answers[answers.length - 1];
      expect(lastAnswer.authorRole).toBe("admin");
      expect(lastAnswer.isVerified).toBe(true);
    });

    test("Owning Vendor (Vendor A) answering on their OWN product receives authorRole: 'vendor' and isVerified: true", async () => {
      const res = await request(app)
        .post(`/api/v1/questions/${questionProductA._id}/answers`)
        .set("Authorization", `Bearer ${vendorTokenA}`)
        .send({ answer: "We are the official brand manufacturer. It is IPX5 water-resistant." });

      expect(res.status).toBe(201);
      const answers = res.body.data.answers;
      const lastAnswer = answers[answers.length - 1];
      expect(lastAnswer.authorRole).toBe("vendor");
      expect(lastAnswer.isVerified).toBe(true);
    });

    test("Rival Vendor (Vendor B) answering on Product A DOES NOT get verified badge or vendor designation (isVerified: false, authorRole: 'customer')", async () => {
      const res = await request(app)
        .post(`/api/v1/questions/${questionProductA._id}/answers`)
        .set("Authorization", `Bearer ${vendorTokenB}`)
        .send({ answer: "Competitor claim: our other brand is much better." });

      expect(res.status).toBe(201);
      const answers = res.body.data.answers;
      const lastAnswer = answers[answers.length - 1];
      // Verified badge spoofing prevented: rival vendor is demoted to customer role without verified badge
      expect(lastAnswer.authorRole).toBe("customer");
      expect(lastAnswer.isVerified).toBe(false);
    });
  });

  /*
   * ========================================================
   * MULTI-TENANT ISOLATION & IDOR PROTECTION
   * ========================================================
   */
  describe("Multi-Tenant Isolation & IDOR Protection", () => {
    test("Customer A cannot access Customer B's order via GET /api/v1/orders/:id (404/403)", async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderB._id}`)
        .set("Authorization", `Bearer ${customerTokenA}`);

      expect([403, 404]).toContain(res.status);
    });

    test("Customer A cannot access Customer B's return request via GET /api/v1/returns/:id (404)", async () => {
      // Customer B trying to fetch Customer A's return
      const res = await request(app)
        .get(`/api/v1/returns/${returnA._id}`)
        .set("Authorization", `Bearer ${customerTokenB}`);

      expect(res.status).toBe(404);
    });

    test("Customer B cannot cancel Customer A's return request via POST /api/v1/returns/:id/cancel (404/403)", async () => {
      const res = await request(app)
        .post(`/api/v1/returns/${returnA._id}/cancel`)
        .set("Authorization", `Bearer ${customerTokenB}`)
        .send({ reason: "Malicious cancellation attempt" });

      expect([403, 404]).toContain(res.status);
    });

    test("Vendor A cannot update Vendor B's product via PATCH /api/v1/products/:id (403 PRODUCT_NOT_OWNED)", async () => {
      const res = await request(app)
        .patch(`/api/v1/products/${productB._id}`)
        .set("Authorization", `Bearer ${vendorTokenA}`)
        .send({ title: "Tampered Title by Competitor" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test("Vendor A cannot access Vendor B's wallet via GET /api/v1/finance/wallets/:vendorId (403 FORBIDDEN)", async () => {
      const res = await request(app)
        .get(`/api/v1/finance/wallets/${vendorDocB._id}`)
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  /*
   * ========================================================
   * PRIVILEGE ESCALATION & PERMISSION CACHE INVALIDATION
   * ========================================================
   */
  describe("Privilege Escalation & Permission Invalidation Governance", () => {
    test("Non-superadmin administrator cannot invoke Superadmin Transfer (403 FORBIDDEN)", async () => {
      const res = await request(app)
        .post("/api/v1/admin/governance/superadmin/transfer")
        .set("Authorization", `Bearer ${adminStaffToken}`)
        .send({
          newSuperadminUserId: adminStaffUser._id.toString(),
          reason: "Unauthorized self-promotion attempt",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test("Token with stale permissionVersion is immediately rejected (401/403)", async () => {
      // Create a staff user with permissionVersion = 1
      const testRevokeUser = await User.create({
        firstName: "Stale",
        lastName: "VersionTest",
        email: `stale_${rand}@rbac02.com`,
        password: "Password123!",
        role: ROLES.ADMIN,
        isActive: true,
        authVersion: 1,
        permissionVersion: 1,
      });

      const staleToken = generateAccessToken({
        sub: testRevokeUser._id.toString(),
        role: ROLES.ADMIN,
        authVersion: 1,
        permissionVersion: 1,
        context: "administrator",
      });

      // User's permission version increments in database (e.g. role modified or permissions revoked)
      await User.findByIdAndUpdate(testRevokeUser._id, { $inc: { permissionVersion: 1 } });

      // Request with stale token must be rejected immediately
      const res = await request(app)
        .get("/api/v1/admin/dashboard")
        .set("Authorization", `Bearer ${staleToken}`);

      expect([401, 403]).toContain(res.status);

      await User.deleteOne({ _id: testRevokeUser._id });
    });
  });
});
