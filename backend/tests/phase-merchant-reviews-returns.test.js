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
const Review = require("../src/models/Review");

const { generateAccessToken } = require("../src/services/token.service");
const { ROLES } = require("../src/constants/auth.constants");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/\/buybox(_test)?(\?|$)/, "/buybox_merchant_rev_test$2")
  : "mongodb://127.0.0.1:27017/buybox_merchant_rev_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Phase MERCHANT-REVIEWS-RETURNS-01 — Forensic Reviews & Returns Verification Suite", () => {
  let customerUser1, customerToken1, customerDoc1;
  let customerUser2, customerToken2, customerDoc2;
  let vendorUserA, vendorTokenA, vendorDocA;
  let vendorUserB, vendorTokenB, vendorDocB;
  let category, brand;
  let productA1, variantA1;
  let productA2, variantA2;
  let productB1, variantB1;
  let orderA1, orderA2, orderB1;
  let reviewA1_5Star, reviewA2_3Star, reviewA3_1Star, reviewB1_4Star;
  let returnA1;

  const rand = Math.random().toString(36).substring(7);

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // 1. Category & Brand
    category = await Category.create({
      name: `Category MRR ${rand}`,
      slug: `cat-mrr-${rand}`,
      isActive: true,
    });
    brand = await Brand.create({
      name: `Brand MRR ${rand}`,
      slug: `brand-mrr-${rand}`,
      isActive: true,
    });

    // 2. Customers
    customerUser1 = await User.create({
      firstName: "Rahul",
      lastName: "Sharma",
      email: `rahul_${rand}@example.com`,
      phone: "+919876543210",
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    customerDoc1 = await Customer.create({
      userId: customerUser1._id,
      isActive: true,
    });
    customerToken1 = generateAccessToken({
      sub: customerUser1._id.toString(),
      role: ROLES.CUSTOMER,
      authVersion: 1,
      permissionVersion: 1,
      context: "customer",
    });

    customerUser2 = await User.create({
      firstName: "Priya",
      lastName: "Patel",
      email: `priya_${rand}@example.com`,
      phone: "+919876543211",
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    customerDoc2 = await Customer.create({
      userId: customerUser2._id,
      isActive: true,
    });
    customerToken2 = generateAccessToken({
      sub: customerUser2._id.toString(),
      role: ROLES.CUSTOMER,
      authVersion: 1,
      permissionVersion: 1,
      context: "customer",
    });

    // 3. Vendors
    vendorUserA = await User.create({
      firstName: "Vendor",
      lastName: "Alpha",
      email: `vendor_a_${rand}@example.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendorDocA = await Vendor.create({
      userId: vendorUserA._id,
      businessName: `Vendor Alpha Electronics ${rand}`,
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
      email: `vendor_b_${rand}@example.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendorDocB = await Vendor.create({
      userId: vendorUserB._id,
      businessName: `Vendor Beta Sound ${rand}`,
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

    // 4. Products for Vendor A
    productA1 = await Product.create({
      name: `Acoustic Pro Wireless Headphones ${rand}`,
      slug: `acoustic-pro-headphones-${rand}`,
      vendorId: vendorDocA._id,
      categoryId: category._id,
      brandId: brand._id,
      sku: `AC-PRO-${rand}`,
      price: mongoose.Types.Decimal128.fromString("15397.23"),
      currency: "INR",
      status: "active",
      images: [{ url: "https://example.com/img1.jpg" }],
    });
    variantA1 = await ProductVariant.create({
      productId: productA1._id,
      sku: `AC-PRO-BLK-${rand}`,
      name: "Matte Black",
      price: mongoose.Types.Decimal128.fromString("15397.23"),
      stock: 100,
    });

    productA2 = await Product.create({
      name: `Noise Buster Earbuds ${rand}`,
      slug: `noise-buster-earbuds-${rand}`,
      vendorId: vendorDocA._id,
      categoryId: category._id,
      brandId: brand._id,
      sku: `NB-EAR-${rand}`,
      price: mongoose.Types.Decimal128.fromString("4999.00"),
      currency: "INR",
      status: "active",
      images: [{ url: "https://example.com/img2.jpg" }],
    });
    variantA2 = await ProductVariant.create({
      productId: productA2._id,
      sku: `NB-EAR-WHT-${rand}`,
      name: "Glossy White",
      price: mongoose.Types.Decimal128.fromString("4999.00"),
      stock: 50,
    });

    // 5. Products for Vendor B
    productB1 = await Product.create({
      name: `Studio Monitor Speaker ${rand}`,
      slug: `studio-monitor-speaker-${rand}`,
      vendorId: vendorDocB._id,
      categoryId: category._id,
      brandId: brand._id,
      sku: `ST-MON-${rand}`,
      price: mongoose.Types.Decimal128.fromString("19999.00"),
      currency: "INR",
      status: "active",
    });
    variantB1 = await ProductVariant.create({
      productId: productB1._id,
      sku: `ST-MON-OAK-${rand}`,
      name: "Oak Finish",
      price: mongoose.Types.Decimal128.fromString("19999.00"),
      stock: 20,
    });

    // 6. Orders
    orderA1 = await Order.create({
      orderNumber: `ORD-MRR-A1-${rand}`,
      customerId: customerDoc1._id,
      userId: customerUser1._id,
      status: "delivered",
      paymentStatus: "paid",
      subtotal: mongoose.Types.Decimal128.fromString("30794.46"),
      grandTotal: mongoose.Types.Decimal128.fromString("30794.46"),
      currency: "INR",
      shippingAddress: {
        fullName: "Rahul Sharma",
        phone: "+919876543210",
        addressLine1: "Flat 402, Lotus Tower",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
      items: [
        {
          productId: productA1._id,
          productVariantId: variantA1._id,
          vendorId: vendorDocA._id,
          productName: productA1.name,
          sku: variantA1.sku,
          quantity: 2,
          unitPrice: mongoose.Types.Decimal128.fromString("15397.23"),
          lineTotal: mongoose.Types.Decimal128.fromString("30794.46"),
          currency: "INR",
          fulfillmentStatus: "delivered",
        },
      ],
    });

    orderA2 = await Order.create({
      orderNumber: `ORD-MRR-A2-${rand}`,
      customerId: customerDoc2._id,
      userId: customerUser2._id,
      status: "delivered",
      paymentStatus: "paid",
      subtotal: mongoose.Types.Decimal128.fromString("4999.00"),
      grandTotal: mongoose.Types.Decimal128.fromString("4999.00"),
      currency: "INR",
      shippingAddress: {
        fullName: "Priya Patel",
        phone: "+919876543211",
        addressLine1: "12 Marine Drive",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400020",
        country: "IN",
      },
      items: [
        {
          productId: productA2._id,
          productVariantId: variantA2._id,
          vendorId: vendorDocA._id,
          productName: productA2.name,
          sku: variantA2.sku,
          quantity: 1,
          unitPrice: mongoose.Types.Decimal128.fromString("4999.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("4999.00"),
          currency: "INR",
          fulfillmentStatus: "delivered",
        },
      ],
    });

    orderB1 = await Order.create({
      orderNumber: `ORD-MRR-B1-${rand}`,
      customerId: customerDoc1._id,
      userId: customerUser1._id,
      status: "delivered",
      paymentStatus: "paid",
      subtotal: mongoose.Types.Decimal128.fromString("19999.00"),
      grandTotal: mongoose.Types.Decimal128.fromString("19999.00"),
      currency: "INR",
      shippingAddress: {
        fullName: "Rahul Sharma",
        phone: "+919876543210",
        addressLine1: "Flat 402, Lotus Tower",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
      items: [
        {
          productId: productB1._id,
          productVariantId: variantB1._id,
          vendorId: vendorDocB._id,
          productName: productB1.name,
          sku: variantB1.sku,
          quantity: 1,
          unitPrice: mongoose.Types.Decimal128.fromString("19999.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("19999.00"),
          currency: "INR",
          fulfillmentStatus: "delivered",
        },
      ],
    });

    // 7. Reviews
    // Review 1: 5-Star for Product A1 by Customer 1 (Answered by Vendor A)
    reviewA1_5Star = await Review.create({
      productId: productA1._id,
      productVariantId: variantA1._id,
      customerId: customerDoc1._id,
      orderId: orderA1._id,
      rating: 5,
      title: "Phenomenal sound quality and battery life",
      comment: "Best noise canceling headphones I have used. Totally worth the investment.",
      status: "approved",
      isVerifiedPurchase: true,
      vendorResponse: "Thank you for the wonderful feedback! Enjoy your Acoustic Pro headphones.",
      vendorRespondedAt: new Date(),
      helpfulCount: 12,
    });

    // Review 2: 3-Star for Product A2 by Customer 2 (Unanswered)
    reviewA2_3Star = await Review.create({
      productId: productA2._id,
      productVariantId: variantA2._id,
      customerId: customerDoc2._id,
      orderId: orderA2._id,
      rating: 3,
      title: "Decent earbuds, average mic clarity",
      comment: "Good music playback but callers sometimes complain about background noise.",
      status: "approved",
      isVerifiedPurchase: true,
      helpfulCount: 4,
    });

    // Review 3: 4-Star for Product B1 by Customer 1 (Vendor B product)
    reviewB1_4Star = await Review.create({
      productId: productB1._id,
      productVariantId: variantB1._id,
      customerId: customerDoc1._id,
      orderId: orderB1._id,
      rating: 4,
      title: "Clear studio sound",
      comment: "Very flat response curve, excellent for home mixing.",
      status: "approved",
      isVerifiedPurchase: true,
      helpfulCount: 1,
    });

    // 8. Return Request for Order A1 (The ₹30,794.46 return)
    returnA1 = await ReturnRequest.create({
      returnNumber: `RET-MRR-${rand}`,
      orderId: orderA1._id,
      customerId: customerDoc1._id,
      vendorIds: [vendorDocA._id],
      type: "return",
      status: "approved",
      customerNotes: "Received with right ear cup audio driver balance defect",
      refundAmount: mongoose.Types.Decimal128.fromString("30794.46"),
      netItemRefundTotal: mongoose.Types.Decimal128.fromString("26197.88"),
      taxRefundTotal: mongoose.Types.Decimal128.fromString("4596.58"),
      shippingRefundTotal: mongoose.Types.Decimal128.fromString("0.00"),
      customerDeductionsTotal: mongoose.Types.Decimal128.fromString("0.00"),
      refundMethod: "original_source",
      items: [
        {
          orderItemId: orderA1.items[0]._id,
          productId: productA1._id,
          productVariantId: variantA1._id,
          sku: variantA1.sku,
          name: productA1.name,
          quantity: 2,
          itemPrice: mongoose.Types.Decimal128.fromString("15397.23"),
          originalUnitPrice: mongoose.Types.Decimal128.fromString("15397.23"),
          taxRefund: mongoose.Types.Decimal128.fromString("2298.29"),
          shippingRefund: mongoose.Types.Decimal128.fromString("0.00"),
          customerPaidAmount: mongoose.Types.Decimal128.fromString("30794.46"),
          allocatedDiscount: mongoose.Types.Decimal128.fromString("0.00"),
          taxBreakdown: {
            taxRate: mongoose.Types.Decimal128.fromString("18.00"),
            pricingMode: "tax_inclusive",
            cgst: mongoose.Types.Decimal128.fromString("1149.15"),
            sgst: mongoose.Types.Decimal128.fromString("1149.15"),
            igst: mongoose.Types.Decimal128.fromString("0.00"),
          },
          reason: "defective",
          condition: "opened_unused",
          vendorId: vendorDocA._id,
        },
      ],
    });
  });

  afterAll(async () => {
    await Category.deleteMany({ _id: category._id });
    await Brand.deleteMany({ _id: brand._id });
    await ProductVariant.deleteMany({ _id: { $in: [variantA1._id, variantA2._id, variantB1._id] } });
    await Product.deleteMany({ _id: { $in: [productA1._id, productA2._id, productB1._id] } });
    await Order.deleteMany({ _id: { $in: [orderA1._id, orderA2._id, orderB1._id] } });
    await Review.deleteMany({ _id: { $in: [reviewA1_5Star._id, reviewA2_3Star._id, reviewB1_4Star._id] } });
    await ReturnRequest.deleteMany({ _id: returnA1._id });
    await Customer.deleteMany({ _id: { $in: [customerDoc1._id, customerDoc2._id] } });
    await Vendor.deleteMany({ _id: { $in: [vendorDocA._id, vendorDocB._id] } });
    await User.deleteMany({ _id: { $in: [customerUser1._id, customerUser2._id, vendorUserA._id, vendorUserB._id] } });
  });

  // ==========================================
  // PART A: VENDOR REVIEWS API (FLIPKART-STYLE)
  // ==========================================
  describe("A. Vendor Reviews API (Flipkart Experience & Security)", () => {
    it("1. Vendor A receives aggregated Flipkart-style overview statistics", async () => {
      const res = await request(app)
        .get("/api/v1/reviews/vendor/my")
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const meta = res.body.meta;
      expect(meta).toBeDefined();
      expect(meta.overview).toBeDefined();

      const ov = meta.overview;
      // Vendor A has 2 reviews: 5-star (weight 5) + 3-star (weight 3) = average 4.0
      expect(ov.totalReviews).toBe(2);
      expect(ov.averageRating).toBe(4.0);
      expect(ov.distribution[5]).toBe(1);
      expect(ov.distribution[4]).toBe(0);
      expect(ov.distribution[3]).toBe(1);
      expect(ov.distribution[2]).toBe(0);
      expect(ov.distribution[1]).toBe(0);
      expect(ov.distributionPercentages[5]).toBe(50);
      expect(ov.distributionPercentages[3]).toBe(50);
      expect(ov.answeredCount).toBe(1);
      expect(ov.unansweredCount).toBe(1);
      expect(ov.verifiedCount).toBe(2);

      // Meta also contains productsList for filter dropdown
      expect(Array.isArray(meta.productsList)).toBe(true);
      expect(meta.productsList.length).toBe(2);
      const prodNames = meta.productsList.map((p) => p.name);
      expect(prodNames).toContain(productA1.name);
      expect(prodNames).toContain(productA2.name);
    });

    it("2. Filters reviews by rating: rating=5 returns only 5-star reviews", async () => {
      const res = await request(app)
        .get("/api/v1/reviews/vendor/my?rating=5")
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].rating).toBe(5);
      expect(res.body.data[0].title).toBe("Phenomenal sound quality and battery life");
    });

    it("3. Filters reviews by answered status: answered=false returns pending replies", async () => {
      const res = await request(app)
        .get("/api/v1/reviews/vendor/my?answered=false")
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].rating).toBe(3);
      expect(res.body.data[0].vendorResponse).toBeNull();
    });

    it("4. Filters reviews by product ID: productId isolates reviews to that product", async () => {
      const res = await request(app)
        .get(`/api/v1/reviews/vendor/my?productId=${productA1._id}`)
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].product.name).toBe(productA1.name);
    });

    it("5. Searches reviews by keyword: search matches text across title and comments", async () => {
      const res = await request(app)
        .get("/api/v1/reviews/vendor/my?search=noise")
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(200);
      // Both reviews mention noise (noise canceling / background noise)
      expect(res.body.data.length).toBe(2);
    });

    it("6. Strictly protects customer PII: no email, no phone, masked display name", async () => {
      const res = await request(app)
        .get("/api/v1/reviews/vendor/my")
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(200);
      for (const item of res.body.data) {
        expect(item.customer).toBeDefined();
        // Masked name like 'Rahul S.' or 'Priya P.'
        expect(item.customer.displayName).toMatch(/^[A-Z][a-z]+ [A-Z]\.$/);
        // Sensitive PII must NOT exist anywhere in review item
        expect(item.customer.email).toBeUndefined();
        expect(item.customer.phone).toBeUndefined();
        expect(item.customer.userId).toBeUndefined();
        expect(item.customerId).toBeUndefined();
      }
    });

    it("7. Strictly enforces tenant isolation: Vendor B cannot see Vendor A's reviews", async () => {
      const res = await request(app)
        .get("/api/v1/reviews/vendor/my")
        .set("Authorization", `Bearer ${vendorTokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].product.name).toBe(productB1.name);

      // Confirm overview belongs only to Vendor B
      expect(res.body.meta.overview.totalReviews).toBe(1);
      expect(res.body.meta.overview.averageRating).toBe(4.0);
    });

    it("8. Vendor A can reply or update reply on their own review", async () => {
      const res = await request(app)
        .patch(`/api/v1/reviews/${reviewA2_3Star._id}/vendor-response`)
        .set("Authorization", `Bearer ${vendorTokenA}`)
        .send({ response: "Thank you for the constructive feedback. A firmware update is rolling out soon." });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify in database
      const updated = await Review.findById(reviewA2_3Star._id);
      expect(updated.vendorResponse).toBe("Thank you for the constructive feedback. A firmware update is rolling out soon.");
      expect(updated.vendorRespondedAt).toBeInstanceOf(Date);
    });

    it("9. Cross-vendor response denial: Vendor B cannot reply to Vendor A's review", async () => {
      const res = await request(app)
        .patch(`/api/v1/reviews/${reviewA1_5Star._id}/vendor-response`)
        .set("Authorization", `Bearer ${vendorTokenB}`)
        .send({ response: "Attempting unauthorized reply" });

      expect([403, 404]).toContain(res.status);
    });
  });

  // ==========================================
  // PART B: VENDOR RETURNS & REFUND BREAKDOWN
  // ==========================================
  describe("B. Vendor Returns & Authoritative Refund Breakdown", () => {
    it("10. Return item valuation is properly sanitized: NO NaN, NO [object Object]", async () => {
      const res = await request(app)
        .get(`/api/v1/return-requests/vendor/my/${returnA1._id}`)
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const ret = res.body.data;
      expect(ret).toBeDefined();
      expect(ret.items.length).toBe(1);

      const item = ret.items[0];
      // Item valuation fields must be clean strings, NOT raw Decimal128 objects
      expect(typeof item.itemPrice).toBe("string");
      expect(item.itemPrice).not.toBe("[object Object]");
      expect(Number(item.itemPrice)).toBe(15397.23);

      expect(typeof item.customerPaidAmount).toBe("string");
      expect(item.customerPaidAmount).not.toBe("[object Object]");
      expect(Number(item.customerPaidAmount)).toBe(30794.46);

      expect(typeof item.taxRefund).toBe("string");
      expect(Number(item.taxRefund)).toBe(2298.29);

      // Tax breakdown decimal fields
      expect(typeof item.taxBreakdown.cgst).toBe("string");
      expect(Number(item.taxBreakdown.cgst)).toBe(1149.15);
      expect(typeof item.taxBreakdown.sgst).toBe("string");
      expect(Number(item.taxBreakdown.sgst)).toBe(1149.15);
    });

    it("11. Returns authoritative financialSummary matching the ₹30,794.46 total refund", async () => {
      const res = await request(app)
        .get(`/api/v1/return-requests/vendor/my/${returnA1._id}`)
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(200);
      const ret = res.body.data;

      expect(ret.financialSummary).toBeDefined();
      const fs = ret.financialSummary;

      // Authoritative total refund
      expect(fs.totalRefund).toBe("30794.46");
      expect(Number(fs.totalRefund)).toBe(30794.46);

      // Pre-tax item subtotal
      expect(fs.netItemRefundTotal).toBe("26197.88");
      expect(fs.itemSubtotal).toBe("26197.88");

      // GST tax refund
      expect(fs.taxRefundTotal).toBe("4596.58");

      // Zero deductions / waived penalties
      expect(fs.customerDeductionsTotal).toBe("0.00");
      expect(fs.shippingRefundTotal).toBe("0.00");

      // Exact mathematical reconciliation
      const base = Number(fs.itemSubtotal);
      const tax = Number(fs.taxRefundTotal);
      const shipping = Number(fs.shippingRefundTotal);
      const deductions = Number(fs.customerDeductionsTotal);
      const total = Number(fs.totalRefund);

      expect(Number((base + tax + shipping - deductions).toFixed(2))).toBe(total);
    });

    it("12. Customer privacy protection in return detail: email and phone are stripped", async () => {
      const res = await request(app)
        .get(`/api/v1/return-requests/vendor/my/${returnA1._id}`)
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(200);
      const ret = res.body.data;

      expect(ret.customer).toBeDefined();
      expect(ret.customer.name).toBe("Rahul S.");
      expect(ret.customer.email).toBeUndefined();
      expect(ret.customer.phone).toBeUndefined();
    });

    it("13. Tenant isolation in returns: Vendor B cannot view Vendor A's return request", async () => {
      const res = await request(app)
        .get(`/api/v1/return-requests/vendor/my/${returnA1._id}`)
        .set("Authorization", `Bearer ${vendorTokenB}`);

      expect([403, 404]).toContain(res.status);
    });

    it("14. Return list view: getMyVendorReturns properly formats decimal refund amounts", async () => {
      const res = await request(app)
        .get("/api/v1/return-requests/vendor/my")
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const targetReturn = res.body.data.find((r) => r.returnNumber === returnA1.returnNumber);
      expect(targetReturn).toBeDefined();
      expect(targetReturn.refundAmount).toBe("30794.46");
      expect(targetReturn.items[0].itemPrice).toBe("15397.23");
    });
  });
});

