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
const Refund = require("../src/models/Refund");
const SupportTicket = require("../src/models/SupportTicket");
const { VendorSettlement } = require("../src/models/VendorSettlement");

const { generateAccessToken } = require("../src/services/token.service");
const { ROLES } = require("../src/constants/auth.constants");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/\/buybox(_test)?(\?|$)/, "/buybox_merchant_ops_fix_test$2")
  : "mongodb://127.0.0.1:27017/buybox_merchant_ops_fix_test?replicaSet=rs0";

jest.setTimeout(90000);

describe("Phase MERCHANT-OPS-FIX-01 — Critical Operational & Financial Accuracy Suite", () => {
  let customerUser, customerDoc, customerToken;
  let vendorUserA, vendorDocA, vendorTokenA;
  let vendorUserB, vendorDocB, vendorTokenB;
  let category, brand;
  let productA, variantA;
  let productB, variantB;

  const rand = Math.random().toString(36).substring(7);
  const now = new Date();

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // 1. Category & Brand
    category = await Category.create({
      name: `Category Fix ${rand}`,
      slug: `cat-fix-${rand}`,
      isActive: true,
    });
    brand = await Brand.create({
      name: `Brand Fix ${rand}`,
      slug: `brand-fix-${rand}`,
      isActive: true,
    });

    // 2. Customer
    customerUser = await User.create({
      firstName: "Ananya",
      lastName: "Iyer",
      email: `customer_fix_${rand}@example.com`,
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    customerDoc = await Customer.create({
      userId: customerUser._id,
      phone: `+9198765${Math.floor(10000 + Math.random() * 90000)}`,
      isActive: true,
    });
    customerToken = generateAccessToken({
      sub: customerUser._id.toString(),
      role: ROLES.CUSTOMER,
      authVersion: 1,
      permissionVersion: 1,
      context: "customer",
    });

    // 3. Vendor A (Primary Test Vendor)
    vendorUserA = await User.create({
      firstName: "Apex",
      lastName: "Electronics",
      email: `vendor_a_fix_${rand}@example.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendorDocA = await Vendor.create({
      userId: vendorUserA._id,
      businessName: `Apex Retailers ${rand}`,
      businessSlug: `apex-retail-${rand}`,
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

    // 4. Vendor B (Isolation Test Vendor)
    vendorUserB = await User.create({
      firstName: "Beacon",
      lastName: "Supplies",
      email: `vendor_b_fix_${rand}@example.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendorDocB = await Vendor.create({
      userId: vendorUserB._id,
      businessName: `Beacon Corp ${rand}`,
      businessSlug: `beacon-corp-${rand}`,
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

    // 5. Products & Variants
    productA = await Product.create({
      name: `Apex Ultra Wireless Earbuds ${rand}`,
      slug: `apex-ear-${rand}`,
      vendorId: vendorDocA._id,
      categoryId: category._id,
      brandId: brand._id,
      sku: `APX-EAR-${rand}`,
      price: mongoose.Types.Decimal128.fromString("2999.00"),
      currency: "INR",
      status: "active",
    });
    variantA = await ProductVariant.create({
      productId: productA._id,
      sku: `APX-EAR-BLK-${rand}`,
      name: "Matte Black",
      price: mongoose.Types.Decimal128.fromString("2999.00"),
      stock: 100,
    });

    productB = await Product.create({
      name: `Beacon Smart Lamp ${rand}`,
      slug: `bcn-lmp-${rand}`,
      vendorId: vendorDocB._id,
      categoryId: category._id,
      brandId: brand._id,
      sku: `BCN-LMP-${rand}`,
      price: mongoose.Types.Decimal128.fromString("4999.00"),
      currency: "INR",
      status: "active",
    });
    variantB = await ProductVariant.create({
      productId: productB._id,
      sku: `BCN-LMP-WHT-${rand}`,
      name: "Warm White",
      price: mongoose.Types.Decimal128.fromString("4999.00"),
      stock: 50,
    });
  });

  afterAll(async () => {
    if (category?._id) await Category.deleteMany({ _id: category._id });
    if (brand?._id) await Brand.deleteMany({ _id: brand._id });
    const variantIds = [variantA?._id, variantB?._id].filter(Boolean);
    if (variantIds.length) await ProductVariant.deleteMany({ _id: { $in: variantIds } });
    const productIds = [productA?._id, productB?._id].filter(Boolean);
    if (productIds.length) await Product.deleteMany({ _id: { $in: productIds } });
    if (customerDoc?._id) await Customer.deleteMany({ _id: customerDoc._id });
    const vendorIds = [vendorDocA?._id, vendorDocB?._id].filter(Boolean);
    if (vendorIds.length) await Vendor.deleteMany({ _id: { $in: vendorIds } });
    const userIds = [customerUser?._id, vendorUserA?._id, vendorUserB?._id].filter(Boolean);
    if (userIds.length) await User.deleteMany({ _id: { $in: userIds } });
    await SupportTicket.deleteMany({ subject: new RegExp(rand) });
    await Order.deleteMany({ orderNumber: new RegExp(rand) });
    await ReturnRequest.deleteMany({ returnNumber: new RegExp(rand) });
    if (vendorIds.length) await VendorSettlement.deleteMany({ vendorId: { $in: vendorIds } });
  });

  // ==============================================================
  // 1. REMEDIATION A: SUPPORT TICKET SUBMISSION & CATEGORY VALIDATION
  // ==============================================================
  describe("1. Remediation A — Support Ticket Submission", () => {
    let createdTicketAId;

    it("1.1 Successfully creates a support ticket with canonical vendor category and description", async () => {
      const res = await request(app)
        .post("/api/v1/support-tickets")
        .set("Authorization", `Bearer ${vendorTokenA}`)
        .send({
          subject: `Settlement statement inquiry ${rand}`,
          description: "Requesting breakdown for shipping deductions on settlement STL-2026-001.",
          category: "finance",
          priority: "high",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.category).toBe("finance");
      expect(res.body.data.priority).toBe("high");
      expect(res.body.data.status).toBe("open");
      expect(res.body.data.ticketNumber).toMatch(/^TKT-/);

      createdTicketAId = res.body.data._id;
    });

    it("1.2 Successfully accepts all supported vendor categories (general, catalog, finance, shipment, returns)", async () => {
      const categories = ["general", "catalog", "finance", "shipment", "returns"];

      for (const cat of categories) {
        const res = await request(app)
          .post("/api/v1/support-tickets")
          .set("Authorization", `Bearer ${vendorTokenA}`)
          .send({
            subject: `Test category ${cat} ${rand}`,
            description: `Verification ticket for category ${cat}`,
            category: cat,
            priority: "medium",
          });

        expect(res.status).toBe(201);
        expect(res.body.data.category).toBe(cat);
      }
    });

    it("1.3 Rejects ticket submission when description is missing or empty", async () => {
      const res = await request(app)
        .post("/api/v1/support-tickets")
        .set("Authorization", `Bearer ${vendorTokenA}`)
        .send({
          subject: `Incomplete ticket ${rand}`,
          description: "   ",
          category: "general",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("1.4 Rejects ticket submission with an invalid category", async () => {
      const res = await request(app)
        .post("/api/v1/support-tickets")
        .set("Authorization", `Bearer ${vendorTokenA}`)
        .send({
          subject: `Invalid category ticket ${rand}`,
          description: "Testing invalid category constraint",
          category: "non_existent_category",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("1.5 Authenticated vendor can retrieve their tickets via getMyTickets", async () => {
      const res = await request(app)
        .get("/api/v1/support-tickets/my")
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const found = res.body.data.find((t) => t._id === createdTicketAId);
      expect(found).toBeDefined();
    });

    it("1.6 Tenant Isolation: Vendor B cannot access Vendor A's support ticket", async () => {
      const res = await request(app)
        .get(`/api/v1/support-tickets/my/${createdTicketAId}`)
        .set("Authorization", `Bearer ${vendorTokenB}`);

      expect([403, 404]).toContain(res.status);
    });
  });

  // ==============================================================
  // 2. REMEDIATION B: REFUND-AWARE MERCHANT NET SALES
  // ==============================================================
  describe("2. Remediation B — Refund-Aware Merchant Net Sales", () => {
    let orderWithoutRefund;
    let orderWithFullRefund;
    let orderWithPartialRefund;
    let orderMultiRefund;
    let orderPendingRefund;
    let orderCancelledReturn;
    let orderRejectedReturn;
    let orderMultiVendor;

    const defaultShippingAddress = {
      fullName: "Ananya Iyer",
      phone: "+919876543210",
      addressLine1: "123 Tech Park Road",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560001",
      country: "IN",
    };

    beforeAll(async () => {
      // 1. Order without refund: Gross 2999, Discount 200, Net 2799
      orderWithoutRefund = await Order.create({
        orderNumber: `ORD-NO-REF-${rand}`,
        customerId: customerDoc._id,
        userId: customerUser._id,
        status: "delivered",
        paymentStatus: "paid",
        shippingAddress: defaultShippingAddress,
        subtotal: mongoose.Types.Decimal128.fromString("2999.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("2799.00"),
        currency: "INR",
        createdAt: now,
        items: [
          {
            productId: productA._id,
            productVariantId: variantA._id,
            vendorId: vendorDocA._id,
            productName: productA.name,
            sku: variantA.sku,
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("2999.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("200.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("2799.00"),
            currency: "INR",
          },
        ],
      });

      // 2. Order with full refund: Gross 2999, Net 0
      orderWithFullRefund = await Order.create({
        orderNumber: `ORD-FULL-REF-${rand}`,
        customerId: customerDoc._id,
        userId: customerUser._id,
        status: "delivered",
        paymentStatus: "refunded",
        shippingAddress: defaultShippingAddress,
        subtotal: mongoose.Types.Decimal128.fromString("2999.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("2999.00"),
        currency: "INR",
        createdAt: now,
        items: [
          {
            productId: productA._id,
            productVariantId: variantA._id,
            vendorId: vendorDocA._id,
            productName: productA.name,
            sku: variantA.sku,
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("2999.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("2999.00"),
            currency: "INR",
          },
        ],
      });

      await Refund.create({
        orderId: orderWithFullRefund._id,
        customerId: customerDoc._id,
        paymentId: new mongoose.Types.ObjectId(),
        amount: mongoose.Types.Decimal128.fromString("2999.00"),
        currency: "INR",
        gateway: "razorpay",
        status: "processed",
        createdAt: now,
      });

      // 3. Order with partial refund: Gross 5998 (2 units @ 2999), 1 unit refunded 2999 -> Net 2999
      orderWithPartialRefund = await Order.create({
        orderNumber: `ORD-PARTIAL-REF-${rand}`,
        customerId: customerDoc._id,
        userId: customerUser._id,
        status: "delivered",
        paymentStatus: "partially_refunded",
        shippingAddress: defaultShippingAddress,
        subtotal: mongoose.Types.Decimal128.fromString("5998.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("5998.00"),
        currency: "INR",
        createdAt: now,
        items: [
          {
            productId: productA._id,
            productVariantId: variantA._id,
            vendorId: vendorDocA._id,
            productName: productA.name,
            sku: variantA.sku,
            quantity: 2,
            unitPrice: mongoose.Types.Decimal128.fromString("2999.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("5998.00"),
            currency: "INR",
          },
        ],
      });

      await Refund.create({
        orderId: orderWithPartialRefund._id,
        customerId: customerDoc._id,
        paymentId: new mongoose.Types.ObjectId(),
        amount: mongoose.Types.Decimal128.fromString("2999.00"),
        currency: "INR",
        gateway: "razorpay",
        status: "processed",
        createdAt: now,
      });

      // 4. Order with multiple refunds: Gross 6000, two refunds of 1000 each -> Net 4000
      orderMultiRefund = await Order.create({
        orderNumber: `ORD-MULTI-REF-${rand}`,
        customerId: customerDoc._id,
        userId: customerUser._id,
        status: "delivered",
        paymentStatus: "partially_refunded",
        shippingAddress: defaultShippingAddress,
        subtotal: mongoose.Types.Decimal128.fromString("6000.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("6000.00"),
        currency: "INR",
        createdAt: now,
        items: [
          {
            productId: productA._id,
            productVariantId: variantA._id,
            vendorId: vendorDocA._id,
            productName: productA.name,
            sku: variantA.sku,
            quantity: 2,
            unitPrice: mongoose.Types.Decimal128.fromString("3000.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("6000.00"),
            currency: "INR",
          },
        ],
      });

      await Refund.create({
        orderId: orderMultiRefund._id,
        customerId: customerDoc._id,
        paymentId: new mongoose.Types.ObjectId(),
        amount: mongoose.Types.Decimal128.fromString("1000.00"),
        currency: "INR",
        gateway: "razorpay",
        status: "processed",
        createdAt: now,
      });

      await Refund.create({
        orderId: orderMultiRefund._id,
        customerId: customerDoc._id,
        paymentId: new mongoose.Types.ObjectId(),
        amount: mongoose.Types.Decimal128.fromString("1000.00"),
        currency: "INR",
        gateway: "razorpay",
        status: "processed",
        createdAt: now,
      });

      // 5. Order with pending refund: should NOT reduce Net Sales
      orderPendingRefund = await Order.create({
        orderNumber: `ORD-PENDING-REF-${rand}`,
        customerId: customerDoc._id,
        userId: customerUser._id,
        status: "delivered",
        paymentStatus: "paid",
        shippingAddress: defaultShippingAddress,
        subtotal: mongoose.Types.Decimal128.fromString("3000.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("3000.00"),
        currency: "INR",
        createdAt: now,
        items: [
          {
            productId: productA._id,
            productVariantId: variantA._id,
            vendorId: vendorDocA._id,
            productName: productA.name,
            sku: variantA.sku,
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("3000.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("3000.00"),
            currency: "INR",
          },
        ],
      });

      await Refund.create({
        orderId: orderPendingRefund._id,
        customerId: customerDoc._id,
        paymentId: new mongoose.Types.ObjectId(),
        amount: mongoose.Types.Decimal128.fromString("3000.00"),
        currency: "INR",
        gateway: "razorpay",
        status: "pending", // Pending must be ignored
        createdAt: now,
      });

      // 6. Cancelled return request: should NOT reduce Net Sales
      orderCancelledReturn = await Order.create({
        orderNumber: `ORD-CANCEL-RET-${rand}`,
        customerId: customerDoc._id,
        userId: customerUser._id,
        status: "delivered",
        paymentStatus: "paid",
        shippingAddress: defaultShippingAddress,
        subtotal: mongoose.Types.Decimal128.fromString("2000.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("2000.00"),
        currency: "INR",
        createdAt: now,
        items: [
          {
            productId: productA._id,
            productVariantId: variantA._id,
            vendorId: vendorDocA._id,
            productName: productA.name,
            sku: variantA.sku,
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("2000.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("2000.00"),
            currency: "INR",
          },
        ],
      });

      await ReturnRequest.create({
        returnNumber: `RET-CAN-${rand}`,
        orderId: orderCancelledReturn._id,
        customerId: customerDoc._id,
        userId: customerUser._id,
        status: "cancelled", // Cancelled must be ignored
        vendorIds: [vendorDocA._id],
        items: [
          {
            productId: productA._id,
            productVariantId: variantA._id,
            name: productA.name,
            sku: variantA.sku,
            itemPrice: mongoose.Types.Decimal128.fromString("2000.00"),
            reason: "defective",
            condition: "opened_unused",
            vendorId: vendorDocA._id,
            quantity: 1,
            refundAmount: mongoose.Types.Decimal128.fromString("2000.00"),
          },
        ],
        refundAmount: mongoose.Types.Decimal128.fromString("2000.00"),
      });

      // 7. Rejected return request: should NOT reduce Net Sales
      orderRejectedReturn = await Order.create({
        orderNumber: `ORD-REJ-RET-${rand}`,
        customerId: customerDoc._id,
        userId: customerUser._id,
        status: "delivered",
        paymentStatus: "paid",
        shippingAddress: defaultShippingAddress,
        subtotal: mongoose.Types.Decimal128.fromString("1500.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("1500.00"),
        currency: "INR",
        createdAt: now,
        items: [
          {
            productId: productA._id,
            productVariantId: variantA._id,
            vendorId: vendorDocA._id,
            productName: productA.name,
            sku: variantA.sku,
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("1500.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("1500.00"),
            currency: "INR",
          },
        ],
      });

      await ReturnRequest.create({
        returnNumber: `RET-REJ-${rand}`,
        orderId: orderRejectedReturn._id,
        customerId: customerDoc._id,
        userId: customerUser._id,
        status: "rejected", // Rejected must be ignored
        vendorIds: [vendorDocA._id],
        items: [
          {
            productId: productA._id,
            productVariantId: variantA._id,
            name: productA.name,
            sku: variantA.sku,
            itemPrice: mongoose.Types.Decimal128.fromString("1500.00"),
            reason: "defective",
            condition: "opened_unused",
            vendorId: vendorDocA._id,
            quantity: 1,
            refundAmount: mongoose.Types.Decimal128.fromString("1500.00"),
          },
        ],
        refundAmount: mongoose.Types.Decimal128.fromString("1500.00"),
      });

      // 8. Multi-Vendor Order: Vendor A items = 2000, Vendor B items = 4000. Total = 6000.
      // Vendor B's items are returned and refunded for 4000. Vendor A's net sales must NOT be deducted!
      orderMultiVendor = await Order.create({
        orderNumber: `ORD-MULTI-VEND-${rand}`,
        customerId: customerDoc._id,
        userId: customerUser._id,
        status: "delivered",
        paymentStatus: "partially_refunded",
        shippingAddress: defaultShippingAddress,
        subtotal: mongoose.Types.Decimal128.fromString("6000.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("6000.00"),
        currency: "INR",
        createdAt: now,
        items: [
          {
            productId: productA._id,
            productVariantId: variantA._id,
            vendorId: vendorDocA._id,
            productName: productA.name,
            sku: variantA.sku,
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("2000.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("2000.00"),
            currency: "INR",
          },
          {
            productId: productB._id,
            productVariantId: variantB._id,
            vendorId: vendorDocB._id,
            productName: productB.name,
            sku: variantB.sku,
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("4000.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("4000.00"),
            currency: "INR",
          },
        ],
      });

      const multiVendorReturnB = await ReturnRequest.create({
        returnNumber: `RET-MVB-${rand}`,
        orderId: orderMultiVendor._id,
        customerId: customerDoc._id,
        userId: customerUser._id,
        status: "refunded",
        vendorIds: [vendorDocB._id],
        items: [
          {
            productId: productB._id,
            productVariantId: variantB._id,
            name: productB.name,
            sku: variantB.sku,
            itemPrice: mongoose.Types.Decimal128.fromString("4000.00"),
            reason: "defective",
            condition: "opened_unused",
            vendorId: vendorDocB._id,
            quantity: 1,
            price: mongoose.Types.Decimal128.fromString("4000.00"),
            refundAmount: mongoose.Types.Decimal128.fromString("4000.00"),
          },
        ],
        refundAmount: mongoose.Types.Decimal128.fromString("4000.00"),
      });

      const multiVendorRefund = await Refund.create({
        orderId: orderMultiVendor._id,
        customerId: customerDoc._id,
        paymentId: new mongoose.Types.ObjectId(),
        amount: mongoose.Types.Decimal128.fromString("4000.00"),
        currency: "INR",
        gateway: "razorpay",
        status: "processed",
        createdAt: now,
      });

      multiVendorReturnB.refundId = multiVendorRefund._id;
      await multiVendorReturnB.save();
    });

    it("2.1 Reconciles Vendor A Net Sales with actual processed refunds, excluding pending/rejected/cross-vendor refunds", async () => {
      const res = await request(app)
        .get("/api/v1/analytics/vendor/overview?period=today")
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { metrics } = res.body.data;
      expect(metrics).toBeDefined();

      // Vendor A Gross:
      // orderWithoutRefund: 2999
      // orderWithFullRefund: 2999
      // orderWithPartialRefund: 5998
      // orderMultiRefund: 6000
      // orderPendingRefund: 3000
      // orderCancelledReturn: 2000
      // orderRejectedReturn: 1500
      // orderMultiVendor (Vendor A items only): 2000
      // Gross Total = 2999 + 2999 + 5998 + 6000 + 3000 + 2000 + 1500 + 2000 = 26496.00
      // Discounts Total = 200.00
      // Expected Merchandise = 26296.00
      // Processed Refunds for Vendor A:
      // orderWithFullRefund: 2999.00
      // orderWithPartialRefund: 2999.00
      // orderMultiRefund: 1000 + 1000 = 2000.00
      // (orderPendingRefund: 0, orderCancelledReturn: 0, orderRejectedReturn: 0, orderMultiVendor: 0 for Vendor A)
      // Total Vendor A Refunds = 2999 + 2999 + 2000 = 7998.00
      // Net Sales = 26296.00 - 7998.00 = 18298.00

      expect(metrics.grossSales).toBe("26496.00");
      expect(metrics.discounts).toBe("200.00");
      expect(metrics.merchandiseSales).toBe("26296.00");
      expect(metrics.refunds).toBe("7998.00");
      expect(metrics.netSales).toBe("18298.00");
      expect(metrics.refundAttributionAvailable).toBe(true);
    });

    it("2.2 Multi-Vendor Isolation: Vendor B Net Sales accounts for Vendor B's 4000 refund", async () => {
      const res = await request(app)
        .get("/api/v1/analytics/vendor/overview?period=today")
        .set("Authorization", `Bearer ${vendorTokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { metrics } = res.body.data;
      // Vendor B Gross: 4000 from orderMultiVendor
      // Vendor B Refund: 4000
      // Vendor B Net Sales: 0.00
      expect(metrics.grossSales).toBe("4000.00");
      expect(metrics.refunds).toBe("4000.00");
      expect(metrics.netSales).toBe("0.00");
    });
  });

  // ==============================================================
  // 3 & 4. REMEDIATIONS C & D: CUMULATIVE STATEMENTS & PAGINATION
  // ==============================================================
  describe("3 & 4. Remediations C & D — Database-Level Pagination & Cumulative Statement KPIs", () => {
    const totalSettlementsToCreate = 48;
    let expectedPaidTotal = 0;
    let expectedPendingTotal = 0;
    let expectedGrossTotal = 0;

    beforeAll(async () => {
      const settlementDocs = [];

      for (let i = 1; i <= totalSettlementsToCreate; i++) {
        // Distribute across statuses: paid (even numbers), payable/pending (odd numbers)
        const isPaid = i % 2 === 0;
        const status = isPaid ? "paid" : i % 3 === 0 ? "payable" : "pending";
        const gross = 1000 + i * 10;
        const commission = 100;
        const net = gross - commission;

        expectedGrossTotal += gross;
        if (isPaid) {
          expectedPaidTotal += net;
        } else {
          expectedPendingTotal += net;
        }

        const pStart = new Date(Date.UTC(2026, 0, 1 + i));
        const pEnd = new Date(Date.UTC(2026, 0, 7 + i));

        settlementDocs.push({
          vendorId: vendorDocA._id,
          settlementNumber: `STL-2026-A-${rand}-${String(i).padStart(3, "0")}`,
          periodStart: pStart,
          periodEnd: pEnd,
          currency: "INR",
          grossSales: mongoose.Types.Decimal128.fromString(gross.toFixed(2)),
          platformCommission: mongoose.Types.Decimal128.fromString(commission.toFixed(2)),
          netPayable: mongoose.Types.Decimal128.fromString(net.toFixed(2)),
          status,
          createdAt: new Date(Date.UTC(2026, 0, 10, 0, 0, i)),
        });
      }

      // Also insert 5 settlements for Vendor B to verify tenant isolation
      for (let j = 1; j <= 5; j++) {
        settlementDocs.push({
          vendorId: vendorDocB._id,
          settlementNumber: `STL-2026-B-${rand}-${String(j).padStart(3, "0")}`,
          periodStart: new Date(Date.UTC(2026, 0, 1)),
          periodEnd: new Date(Date.UTC(2026, 0, 7)),
          currency: "INR",
          grossSales: mongoose.Types.Decimal128.fromString("50000.00"),
          platformCommission: mongoose.Types.Decimal128.fromString("5000.00"),
          netPayable: mongoose.Types.Decimal128.fromString("45000.00"),
          status: "paid",
          createdAt: new Date(Date.UTC(2026, 0, 10, 0, 0, j)),
        });
      }

      await VendorSettlement.insertMany(settlementDocs);
    });

    it("3.1 Page 1 returns 20 records and cumulative summary across all 48 records", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me/settlements?page=1&limit=20")
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(20);

      const meta = res.body.meta;
      expect(meta.page).toBe(1);
      expect(meta.limit).toBe(20);
      expect(meta.total).toBe(totalSettlementsToCreate);
      expect(meta.totalPages).toBe(3);

      const summary = meta.summary;
      expect(summary).toBeDefined();
      expect(Number(summary.totalGrossVolume)).toBeCloseTo(expectedGrossTotal, 1);
      expect(Number(summary.totalSettledAmount)).toBeCloseTo(expectedPaidTotal, 1);
      expect(Number(summary.pendingDisbursements)).toBeCloseTo(expectedPendingTotal, 1);
    });

    it("3.2 Page 2 returns next 20 records with identical cumulative summary", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me/settlements?page=2&limit=20")
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(20);

      const meta = res.body.meta;
      expect(meta.page).toBe(2);

      const summary = meta.summary;
      // Summary MUST remain identical while navigating pages
      expect(Number(summary.totalGrossVolume)).toBeCloseTo(expectedGrossTotal, 1);
      expect(Number(summary.totalSettledAmount)).toBeCloseTo(expectedPaidTotal, 1);
      expect(Number(summary.pendingDisbursements)).toBeCloseTo(expectedPendingTotal, 1);
    });

    it("3.3 Page 3 returns remaining 8 records with identical cumulative summary", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me/settlements?page=3&limit=20")
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(8);

      const meta = res.body.meta;
      expect(meta.page).toBe(3);

      const summary = meta.summary;
      expect(Number(summary.totalGrossVolume)).toBeCloseTo(expectedGrossTotal, 1);
      expect(Number(summary.totalSettledAmount)).toBeCloseTo(expectedPaidTotal, 1);
      expect(Number(summary.pendingDisbursements)).toBeCloseTo(expectedPendingTotal, 1);
    });

    it("3.4 Status filtering recalculates cumulative summaries to match the filtered dataset", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me/settlements?status=paid&page=1&limit=20")
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(200);
      const meta = res.body.meta;

      // Paid settlements = 24 (half of 48)
      expect(meta.total).toBe(24);
      expect(meta.summary.pendingDisbursements).toBe("0.00");
      expect(Number(meta.summary.totalSettledAmount)).toBeCloseTo(expectedPaidTotal, 1);
    });

    it("3.5 Tenant Isolation: Vendor B only sees their 5 settlements and distinct summary", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me/settlements?page=1&limit=20")
        .set("Authorization", `Bearer ${vendorTokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(5);

      const meta = res.body.meta;
      expect(meta.total).toBe(5);
      // 5 * 50,000 gross = 250,000
      expect(Number(meta.summary.totalGrossVolume)).toBe(250000);
      // 5 * 45,000 net = 225,000
      expect(Number(meta.summary.totalSettledAmount)).toBe(225000);
      expect(Number(meta.summary.pendingDisbursements)).toBe(0);
    });
  });
});
