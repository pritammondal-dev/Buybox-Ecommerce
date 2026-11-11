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
const Payment = require("../src/models/Payment");
const Refund = require("../src/models/Refund");
const AuditLog = require("../src/models/AuditLog");

const { generateAccessToken } = require("../src/services/token.service");
const { ROLES } = require("../src/constants/auth.constants");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { encodeSecureId } = require("../src/utils/secure-id.util");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/\/buybox(_test)?(\?|$)/, "/buybox_superadmin_returns_02_test$2")
  : "mongodb://127.0.0.1:27017/buybox_superadmin_returns_02_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Phase SUPERADMIN-RETURNS-02 — Complete Return Operations, Payment Visibility & Refund Control", () => {
  let superAdminUser, superAdminToken;
  let regularAdminUser, regularAdminToken;
  let viewerAdminUser, viewerAdminToken;
  let customerUser, customerToken, customerDoc;
  let vendorUserA, vendorTokenA, vendorDocA;
  let vendorUserB, vendorTokenB, vendorDocB;
  let vendorUserSuspended, vendorDocSuspended;
  let category, brand;
  let productA, variantA;
  let productB, variantB;
  let orderPrepaid, orderCod, orderMultiVendor;
  let paymentPrepaid;

  const rand = Math.random().toString(36).substring(7);

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // 1. Superadmin & Admins
    superAdminUser = await User.create({
      firstName: "Super",
      lastName: "Admin",
      email: `superadmin_02_${rand}@buybox.local`,
      phone: "+919900112233",
      password: "Password123!",
      role: ROLES.SUPER_ADMIN,
      roles: [ROLES.SUPER_ADMIN],
      permissions: ["*"],
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    superAdminToken = generateAccessToken({
      sub: superAdminUser._id.toString(),
      role: ROLES.SUPER_ADMIN,
      roles: [ROLES.SUPER_ADMIN],
      permissions: ["*"],
      authVersion: 1,
      permissionVersion: 1,
      context: "admin",
    });

    regularAdminUser = await User.create({
      firstName: "Ops",
      lastName: "Manager",
      email: `ops_admin_02_${rand}@buybox.local`,
      phone: "+919900223344",
      password: "Password123!",
      role: ROLES.ADMIN,
      roles: [ROLES.ADMIN],
      permissions: [
        PERMISSIONS.RETURNS_VIEW,
        PERMISSIONS.RETURNS_APPROVE,
        PERMISSIONS.RETURNS_REJECT,
        PERMISSIONS.REFUNDS_CREATE,
        PERMISSIONS.REFUNDS_APPROVE,
      ],
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    regularAdminToken = generateAccessToken({
      sub: regularAdminUser._id.toString(),
      role: ROLES.ADMIN,
      roles: [ROLES.ADMIN],
      permissions: [
        PERMISSIONS.RETURNS_VIEW,
        PERMISSIONS.RETURNS_APPROVE,
        PERMISSIONS.RETURNS_REJECT,
        PERMISSIONS.REFUNDS_CREATE,
        PERMISSIONS.REFUNDS_APPROVE,
      ],
      authVersion: 1,
      permissionVersion: 1,
      context: "admin",
    });

    viewerAdminUser = await User.create({
      firstName: "Read",
      lastName: "OnlyAdmin",
      email: `readonly_02_${rand}@buybox.local`,
      phone: "+919900334455",
      password: "Password123!",
      role: ROLES.SUPPORT,
      roles: [ROLES.SUPPORT],
      permissions: [PERMISSIONS.RETURNS_VIEW],
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    viewerAdminToken = generateAccessToken({
      sub: viewerAdminUser._id.toString(),
      role: ROLES.SUPPORT,
      roles: [ROLES.SUPPORT],
      permissions: [PERMISSIONS.RETURNS_VIEW],
      authVersion: 1,
      permissionVersion: 1,
      context: "admin",
    });

    // 2. Customer
    customerUser = await User.create({
      firstName: "Sneha",
      lastName: "Patil",
      email: `sneha_${rand}@example.com`,
      phone: "+919811998877",
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    customerDoc = await Customer.create({
      userId: customerUser._id,
      isActive: true,
    });
    customerToken = generateAccessToken({
      sub: customerUser._id.toString(),
      role: ROLES.CUSTOMER,
      authVersion: 1,
      permissionVersion: 1,
      context: "customer",
    });

    // 3. Vendors
    vendorUserA = await User.create({
      firstName: "Apex",
      lastName: "Vendor",
      email: `apex_02_${rand}@vendor.com`,
      phone: "+919833111222",
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendorDocA = await Vendor.create({
      userId: vendorUserA._id,
      businessName: `Apex Tech Solutions ${rand}`,
      storeName: `Apex Tech Store ${rand}`,
      businessSlug: `apex-tech-02-${rand}`,
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

    vendorUserB = await User.create({
      firstName: "Beacon",
      lastName: "Vendor",
      email: `beacon_02_${rand}@vendor.com`,
      phone: "+919844222333",
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendorDocB = await Vendor.create({
      userId: vendorUserB._id,
      businessName: `Beacon Apparels ${rand}`,
      storeName: `Beacon Apparels Store ${rand}`,
      businessSlug: `beacon-apparel-02-${rand}`,
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

    vendorUserSuspended = await User.create({
      firstName: "Suspended",
      lastName: "Merchant",
      email: `suspended_02_${rand}@vendor.com`,
      phone: "+919855333444",
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: false,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendorDocSuspended = await Vendor.create({
      userId: vendorUserSuspended._id,
      businessName: `Suspended Retailer ${rand}`,
      storeName: `Suspended Store ${rand}`,
      businessSlug: `suspended-store-02-${rand}`,
      onboardingStatus: "suspended",
      isActive: false,
    });

    // 4. Products & Variants
    category = await Category.create({
      name: `Electronics 02 ${rand}`,
      slug: `electronics-02-${rand}`,
      isActive: true,
    });
    brand = await Brand.create({
      name: `Sony 02 ${rand}`,
      slug: `sony-02-${rand}`,
      isActive: true,
    });

    productA = await Product.create({
      name: `Noise Cancelling Headphones 02 ${rand}`,
      slug: `headphones-02-${rand}`,
      sku: `HEADPHONE-02-${rand}`,
      vendorId: vendorDocA._id,
      categoryId: category._id,
      brandId: brand._id,
      price: mongoose.Types.Decimal128.fromString("2000.00"),
      status: "active",
      isActive: true,
      images: [{ url: "https://example.com/p1.jpg" }],
    });
    variantA = await ProductVariant.create({
      productId: productA._id,
      name: "Black Variant",
      sku: `HEADPHONE-BLK-${rand}`,
      price: mongoose.Types.Decimal128.fromString("2000.00"),
      stock: 50,
      isActive: true,
    });

    productB = await Product.create({
      name: `Smart Fitness Watch 02 ${rand}`,
      slug: `fitness-watch-02-${rand}`,
      sku: `WATCH-02-${rand}`,
      vendorId: vendorDocB._id,
      categoryId: category._id,
      brandId: brand._id,
      price: mongoose.Types.Decimal128.fromString("3000.00"),
      status: "active",
      isActive: true,
      images: [{ url: "https://example.com/p2.jpg" }],
    });
    variantB = await ProductVariant.create({
      productId: productB._id,
      name: "Silver Variant",
      sku: `WATCH-SILVER-${rand}`,
      price: mongoose.Types.Decimal128.fromString("3000.00"),
      stock: 40,
      isActive: true,
    });

    // 5. Orders: Prepaid, COD, MultiVendor
    orderPrepaid = await Order.create({
      orderNumber: `ORD-PRE-${rand}`,
      customerId: customerDoc._id,
      userId: customerUser._id,
      status: "delivered",
      paymentStatus: "paid",
      paymentMethod: "razorpay",
      currency: "INR",
      grandTotal: 2360,
      amountPaid: 2360,
      subtotal: 2000,
      taxTotal: 360,
      shippingTotal: 0,
      discountTotal: 0,
      taxSummary: {
        totalTax: 360,
        pricingMode: "tax_exclusive",
      },
      placedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      deliveredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      items: [
        {
          productId: productA._id,
          productVariantId: variantA._id,
          productName: productA.name,
          sku: variantA.sku,
          quantity: 1,
          unitPrice: 2000,
          lineTotal: 2000,
          currency: "INR",
          discountTotal: 0,
          taxTotal: 360,
          taxDetails: {
            taxRate: 0.18,
            pricingMode: "tax_exclusive",
          },
          vendorId: vendorDocA._id,
          fulfillmentStatus: "delivered",
          deliveredAt: new Date(),
          returnStatus: "requested",
        },
      ],
      shippingAddress: {
        fullName: "Sneha Patil",
        phone: "+919811998877",
        addressLine1: "123 Indiranagar 100ft Rd",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560038",
        country: "IN",
      },
    });

    paymentPrepaid = await Payment.create({
      orderId: orderPrepaid._id,
      customerId: customerDoc._id,
      gateway: "razorpay",
      gatewayOrderId: `order_${rand}_123`,
      gatewayPaymentId: `pay_${rand}_abc456`,
      amount: 2360,
      currency: "INR",
      status: "captured",
      method: "upi",
      refundedAmount: 0,
      capturedAt: new Date(),
    });

    orderCod = await Order.create({
      orderNumber: `ORD-COD-${rand}`,
      customerId: customerDoc._id,
      userId: customerUser._id,
      status: "delivered",
      paymentStatus: "paid",
      paymentMethod: "cod",
      currency: "INR",
      grandTotal: 1000,
      amountPaid: 1000,
      subtotal: 1000,
      taxTotal: 0,
      shippingTotal: 0,
      discountTotal: 0,
      taxSummary: {
        totalTax: 0,
        pricingMode: "tax_exclusive",
      },
      paymentAttempts: [
        {
          attemptNumber: 1,
          gateway: "cod",
          method: "cod",
          amount: 1000,
          status: "successful",
        },
      ],
      placedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      deliveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      items: [
        {
          productId: productA._id,
          productVariantId: variantA._id,
          productName: productA.name,
          sku: variantA.sku,
          quantity: 1,
          unitPrice: 1000,
          lineTotal: 1000,
          currency: "INR",
          discountTotal: 0,
          taxTotal: 0,
          vendorId: vendorDocA._id,
          fulfillmentStatus: "delivered",
          deliveredAt: new Date(),
          returnStatus: "requested",
        },
      ],
      shippingAddress: {
        fullName: "Sneha Patil",
        phone: "+919811998877",
        addressLine1: "123 Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560038",
        country: "IN",
      },
    });

    orderMultiVendor = await Order.create({
      orderNumber: `ORD-MULTI-${rand}`,
      customerId: customerDoc._id,
      userId: customerUser._id,
      status: "delivered",
      paymentStatus: "paid",
      paymentMethod: "razorpay",
      currency: "INR",
      grandTotal: 5900,
      amountPaid: 5900,
      subtotal: 5000,
      taxTotal: 900,
      shippingTotal: 0,
      discountTotal: 0,
      taxSummary: {
        totalTax: 900,
        pricingMode: "tax_exclusive",
      },
      placedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      deliveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      items: [
        {
          productId: productA._id,
          productVariantId: variantA._id,
          productName: productA.name,
          sku: variantA.sku,
          quantity: 1,
          unitPrice: 2000,
          lineTotal: 2000,
          currency: "INR",
          discountTotal: 0,
          taxTotal: 360,
          taxDetails: {
            taxRate: 0.18,
            pricingMode: "tax_exclusive",
          },
          vendorId: vendorDocA._id,
          fulfillmentStatus: "delivered",
          deliveredAt: new Date(),
          returnStatus: "requested",
        },
        {
          productId: productB._id,
          productVariantId: variantB._id,
          productName: productB.name,
          sku: variantB.sku,
          quantity: 1,
          unitPrice: 3000,
          lineTotal: 3000,
          currency: "INR",
          discountTotal: 0,
          taxTotal: 540,
          taxDetails: {
            taxRate: 0.18,
            pricingMode: "tax_exclusive",
          },
          vendorId: vendorDocB._id,
          fulfillmentStatus: "delivered",
          deliveredAt: new Date(),
          returnStatus: "requested",
        },
      ],
      shippingAddress: {
        fullName: "Sneha Patil",
        phone: "+919811998877",
        addressLine1: "123 Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560038",
        country: "IN",
      },
    });
  });

  afterAll(async () => {
    // Teardown
    await ReturnRequest.deleteMany({
      returnNumber: { $regex: rand },
    });
    await Refund.deleteMany({
      orderId: { $in: [orderPrepaid?._id, orderCod?._id, orderMultiVendor?._id] },
    });
    await Payment.deleteMany({
      orderId: { $in: [orderPrepaid?._id, orderCod?._id, orderMultiVendor?._id] },
    });
    await Order.deleteMany({
      orderNumber: { $regex: rand },
    });
    await ProductVariant.deleteMany({
      sku: { $regex: rand },
    });
    await Product.deleteMany({
      slug: { $regex: rand },
    });
    await Category.deleteMany({
      slug: { $regex: rand },
    });
    await Brand.deleteMany({
      slug: { $regex: rand },
    });
    await Customer.deleteMany({ userId: customerUser?._id });
    await Vendor.deleteMany({
      userId: { $in: [vendorUserA?._id, vendorUserB?._id, vendorUserSuspended?._id] },
    });
    await User.deleteMany({
      email: { $regex: rand },
    });
  });

  // SCENARIO 1: Complete Authoritative Payment Details
  it("Scenario 1: Should populate complete original payment details for prepaid return", async () => {
    const returnReq = await ReturnRequest.create({
      returnNumber: `RET-PAY-01-${rand}`,
      orderId: orderPrepaid._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      vendorIds: [vendorDocA._id],
      type: "return",
      status: "requested",
      refundAmount: 2360,
      reason: "defective_product",
      items: [
        {
          orderItemId: orderPrepaid.items[0]._id,
          productId: productA._id,
          productVariantId: variantA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: 2000,
          originalUnitPrice: 2000,
          customerPaidAmount: 2000,
          taxRefund: 360,
          reason: "defective_product",
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/returns/admin/${returnReq._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const body = res.body.data;
    expect(body.originalPayment).toBeDefined();
    expect(body.originalPayment.isAvailable).toBe(true);
    expect(body.originalPayment.paymentGateway).toBe("razorpay");
    expect(body.originalPayment.transactionId).toBe(`pay_${rand}_abc456`);
    expect(body.originalPayment.referenceId).toBe(`order_${rand}_123`);
    expect(body.originalPayment.paymentStatus).toBe("captured");
    expect(Number(body.originalPayment.amountCaptured)).toBe(2360);
  });

  // SCENARIO 2: Missing/Unavailable Payment Details Fallback
  it("Scenario 2: Should show explicit unavailable state when payment record is missing", async () => {
    const orphanOrder = await Order.create({
      orderNumber: `ORD-ORPHAN-${rand}`,
      customerId: customerDoc._id,
      userId: customerUser._id,
      status: "delivered",
      paymentStatus: "pending",
      paymentMethod: null,
      currency: "INR",
      grandTotal: 500,
      taxSummary: { totalTax: 0, pricingMode: "tax_exclusive" },
      items: [
        {
          productId: productA._id,
          productVariantId: variantA._id,
          productName: productA.name,
          sku: variantA.sku,
          currency: "INR",
          quantity: 1,
          unitPrice: 500,
          lineTotal: 500,
          vendorId: vendorDocA._id,
          fulfillmentStatus: "delivered",
          deliveredAt: new Date(),
          returnStatus: "requested",
        },
      ],
      shippingAddress: orderPrepaid.shippingAddress,
    });

    const returnReq = await ReturnRequest.create({
      returnNumber: `RET-ORPHAN-${rand}`,
      orderId: orphanOrder._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      status: "requested",
      refundAmount: 500,
      reason: "changed_mind",
      items: [
        {
          orderItemId: orphanOrder.items[0]._id,
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: 500,
          reason: "changed_mind",
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/returns/admin/${returnReq._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const body = res.body.data;
    expect(body.originalPayment).toBeDefined();
    expect(body.originalPayment.isAvailable).toBe(false);
    expect(body.originalPayment.paymentStatus).toBe("pending");
  });

  // SCENARIO 3: COD Collection and Reconciliation State
  it("Scenario 3: Should distinguish COD cash collection and reconciliation states", async () => {
    const returnReq = await ReturnRequest.create({
      returnNumber: `RET-COD-01-${rand}`,
      orderId: orderCod._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      status: "requested",
      refundAmount: 1000,
      refundMethod: "bank_transfer",
      reason: "damaged_item",
      items: [
        {
          orderItemId: orderCod.items[0]._id,
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: 1000,
          reason: "damaged_item",
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/returns/admin/${returnReq._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const payment = res.body.data.originalPayment;
    expect(payment.isCod).toBe(true);
    expect(payment.codCollectionStatus).toBe("cash_collected");
    expect(payment.codReconciled).toBe(true);
  });

  // SCENARIO 4: Refund Breakdown Reconciliation
  it("Scenario 4: Should accurately reconcile 5-pillar refund formula against customer entitlement", async () => {
    const returnReq = await ReturnRequest.create({
      returnNumber: `RET-RECON-01-${rand}`,
      orderId: orderPrepaid._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      status: "approved",
      refundAmount: 2360,
      taxRefundTotal: 360,
      customerDeductionsTotal: 0,
      previouslyRefundedTotal: 0,
      netItemRefundTotal: 2000,
      reason: "defective_product",
      items: [
        {
          orderItemId: orderPrepaid.items[0]._id,
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: 2000,
          taxRefund: 360,
          customerPaidAmount: 2000,
          reason: "defective_product",
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/returns/admin/${returnReq._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const breakdown = res.body.data.refundBreakdown;
    expect(Number(breakdown.productRefund.customerPaidAmount)).toBe(2000);
    expect(Number(breakdown.taxRefund.refundableTax)).toBe(360);
    expect(Number(breakdown.finalRefund.netRefundableAmount)).toBe(2360);
    expect(breakdown.finalRefund.status).toBe("authorized");
  });

  // SCENARIO 5: Previous Refund Aggregation
  it("Scenario 5: Should itemize and aggregate prior refunds from Refund records", async () => {
    // Create an existing processed refund on orderPrepaid
    const priorRefund = await Refund.create({
      paymentId: paymentPrepaid._id,
      orderId: orderPrepaid._id,
      customerId: customerDoc._id,
      gateway: "razorpay",
      gatewayRefundId: `rfnd_prior_${rand}`,
      amount: 500,
      currency: "INR",
      status: "processed",
      reason: "Partial adjustment",
      idempotencyKey: `prior_ref_key_${rand}`,
      processedAt: new Date(),
    });

    const returnReq = await ReturnRequest.create({
      returnNumber: `RET-PREV-AGG-${rand}`,
      orderId: orderPrepaid._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      status: "approved",
      refundAmount: 1860,
      previouslyRefundedTotal: 500,
      reason: "defective_product",
      items: [
        {
          orderItemId: orderPrepaid.items[0]._id,
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: 1860,
          reason: "defective_product",
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/returns/admin/${returnReq._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const body = res.body.data;
    expect(body.previousRefunds).toBeDefined();
    expect(body.previousRefunds.length).toBeGreaterThanOrEqual(1);
    expect(Number(body.refundBreakdown.finalRefund.previouslyRefunded)).toBe(500);
    expect(Number(body.refundBreakdown.finalRefund.remainingRefundableAmount)).toBe(0);
  });

  // SCENARIO 6: Partial Return Valuation
  it("Scenario 6: Should correctly evaluate partial return without double-counting order grandTotal", async () => {
    const returnReq = await ReturnRequest.create({
      returnNumber: `RET-PARTIAL-${rand}`,
      orderId: orderMultiVendor._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      status: "requested",
      refundAmount: 2360, // only item A
      taxRefundTotal: 360,
      netItemRefundTotal: 2000,
      reason: "quality_issue",
      items: [
        {
          orderItemId: orderMultiVendor.items[0]._id,
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: 2000,
          customerPaidAmount: 2000,
          taxRefund: 360,
          reason: "quality_issue",
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/returns/admin/${returnReq._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const body = res.body.data;
    expect(Number(body.refundBreakdown.finalRefund.netRefundableAmount)).toBe(2360);
    expect(body.items.length).toBe(1);
    expect(body.items[0].sku).toBe(variantA.sku);
  });

  // SCENARIO 7: Multiple Returned Items Line Valuation
  it("Scenario 7: Should calculate multi-item line valuations with itemized taxes and discounts", async () => {
    const returnReq = await ReturnRequest.create({
      returnNumber: `RET-MULTI-ITEMS-${rand}`,
      orderId: orderMultiVendor._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      status: "requested",
      refundAmount: 5900,
      taxRefundTotal: 900,
      netItemRefundTotal: 5000,
      reason: "defective_product",
      items: [
        {
          orderItemId: orderMultiVendor.items[0]._id,
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: 2000,
          taxRefund: 360,
          reason: "defective_product",
        },
        {
          orderItemId: orderMultiVendor.items[1]._id,
          productId: productB._id,
          sku: variantB.sku,
          name: productB.name,
          quantity: 1,
          itemPrice: 3000,
          taxRefund: 540,
          reason: "defective_product",
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/returns/admin/${returnReq._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const items = res.body.data.items;
    expect(items.length).toBe(2);
    expect(Number(items[0].itemPrice)).toBe(2000);
    expect(Number(items[1].itemPrice)).toBe(3000);
  });

  // SCENARIO 8: Multi-Vendor Order Attribution
  it("Scenario 8: Should correctly attribute multiple vendors to their respective return items", async () => {
    const returnReq = await ReturnRequest.create({
      returnNumber: `RET-MULTI-VEND-${rand}`,
      orderId: orderMultiVendor._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      vendorIds: [vendorDocA._id, vendorDocB._id],
      status: "requested",
      refundAmount: 5900,
      reason: "not_as_described",
      items: [
        {
          orderItemId: orderMultiVendor.items[0]._id,
          productId: productA._id,
          vendorId: vendorDocA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: 2000,
          reason: "not_as_described",
        },
        {
          orderItemId: orderMultiVendor.items[1]._id,
          productId: productB._id,
          vendorId: vendorDocB._id,
          sku: variantB.sku,
          name: productB.name,
          quantity: 1,
          itemPrice: 3000,
          reason: "not_as_described",
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/returns/admin/${returnReq._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const items = res.body.data.items;
    expect(items[0].vendor.storeName).toContain("Apex Tech");
    expect(items[1].vendor.storeName).toContain("Beacon Apparels");
  });

  // SCENARIO 9: Vendor Acceptance Workflow
  it("Scenario 9: Should allow vendor to approve a return belonging to their store", async () => {
    const returnReq = await ReturnRequest.create({
      returnNumber: `RET-VEND-APP-${rand}`,
      orderId: orderPrepaid._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      vendorIds: [vendorDocA._id],
      status: "requested",
      refundAmount: 2360,
      reason: "damaged_item",
      items: [
        {
          orderItemId: orderPrepaid.items[0]._id,
          productId: productA._id,
          vendorId: vendorDocA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: 2000,
          reason: "damaged_item",
        },
      ],
    });

    const res = await request(app)
      .post(`/api/v1/returns/vendor/my/${returnReq._id}/approve`)
      .set("Authorization", `Bearer ${vendorTokenA}`)
      .send({ notes: "Merchant accepted return for inspection" });

    expect(res.status).toBe(200);
    const updated = await ReturnRequest.findById(returnReq._id);
    expect(updated.status).toBe("approved");
  });

  // SCENARIO 10: Vendor Rejection Workflow
  it("Scenario 10: Should allow vendor to reject return with reason and update order items", async () => {
    const returnReq = await ReturnRequest.create({
      returnNumber: `RET-VEND-REJ-${rand}`,
      orderId: orderPrepaid._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      vendorIds: [vendorDocA._id],
      status: "requested",
      refundAmount: 2360,
      reason: "changed_mind",
      items: [
        {
          orderItemId: orderPrepaid.items[0]._id,
          productId: productA._id,
          vendorId: vendorDocA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: 2000,
          reason: "changed_mind",
        },
      ],
    });

    const res = await request(app)
      .post(`/api/v1/returns/vendor/my/${returnReq._id}/reject`)
      .set("Authorization", `Bearer ${vendorTokenA}`)
      .send({ reason: "Product seal tampered by customer" });

    expect(res.status).toBe(200);
    const updated = await ReturnRequest.findById(returnReq._id);
    expect(updated.status).toBe("rejected");
    expect(updated.resolutionNotes).toBe("Product seal tampered by customer");
  });

  // SCENARIO 11: Superadmin Override of Vendor Rejection
  it("Scenario 11: Should allow Superadmin to override vendor rejection to approved with mandatory reason", async () => {
    const returnReq = await ReturnRequest.create({
      returnNumber: `RET-OVERRIDE-APP-${rand}`,
      orderId: orderPrepaid._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      vendorIds: [vendorDocA._id],
      status: "rejected",
      resolutionNotes: "Vendor claimed seal broken",
      refundAmount: 2360,
      reason: "damaged_item",
      items: [
        {
          orderItemId: orderPrepaid.items[0]._id,
          productId: productA._id,
          vendorId: vendorDocA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: 2000,
          reason: "damaged_item",
        },
      ],
    });

    const res = await request(app)
      .post(`/api/v1/returns/admin/${returnReq._id}/approve`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ notes: "Superadmin verified customer courier transit damage photos" });

    expect(res.status).toBe(200);
    const updated = await ReturnRequest.findById(returnReq._id);
    expect(updated.status).toBe("approved");

    const audit = await AuditLog.findOne({
      targetId: returnReq._id,
      action: "RETURN_OVERRIDE_APPROVED",
    });
    expect(audit).not.toBeNull();
    expect(audit.reason).toContain("Superadmin verified customer courier transit damage photos");
  });

  // SCENARIO 12: Superadmin Rejection with Mandatory Reason
  it("Scenario 12: Should reject Superadmin rejection when mandatory reason is omitted", async () => {
    const returnReq = await ReturnRequest.create({
      returnNumber: `RET-REJ-NOREASON-${rand}`,
      orderId: orderPrepaid._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      status: "requested",
      refundAmount: 2360,
      reason: "damaged_item",
      items: [
        {
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: 2000,
          reason: "damaged_item",
        },
      ],
    });

    const res = await request(app)
      .post(`/api/v1/returns/admin/${returnReq._id}/reject`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({}); // missing reason

    expect(res.status).toBe(400);
  });

  // SCENARIO 13: Superadmin Override of Vendor Approval
  it("Scenario 13: Should allow Superadmin to override vendor approval to rejected with mandatory reason", async () => {
    const returnReq = await ReturnRequest.create({
      returnNumber: `RET-OVERRIDE-REJ-${rand}`,
      orderId: orderPrepaid._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      vendorIds: [vendorDocA._id],
      status: "approved",
      refundAmount: 2360,
      reason: "defective_product",
      items: [
        {
          orderItemId: orderPrepaid.items[0]._id,
          productId: productA._id,
          vendorId: vendorDocA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: 2000,
          reason: "defective_product",
        },
      ],
    });

    const res = await request(app)
      .post(`/api/v1/returns/admin/${returnReq._id}/reject`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ reason: "Superadmin fraud investigation confirmed warranty expired" });

    expect(res.status).toBe(200);
    const updated = await ReturnRequest.findById(returnReq._id);
    expect(updated.status).toBe("rejected");

    const audit = await AuditLog.findOne({
      targetId: returnReq._id,
      action: "RETURN_OVERRIDE_REJECTED",
    });
    expect(audit).not.toBeNull();
  });

  // SCENARIO 14: Invalid Lifecycle State Transition
  it("Scenario 14: Should prevent invalid lifecycle transitions (e.g. approving a cancelled return)", async () => {
    const returnReq = await ReturnRequest.create({
      returnNumber: `RET-CANCELLED-${rand}`,
      orderId: orderPrepaid._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      status: "cancelled",
      refundAmount: 2360,
      reason: "changed_mind",
      items: [
        {
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: 2000,
          reason: "changed_mind",
        },
      ],
    });

    const res = await request(app)
      .post(`/api/v1/returns/admin/${returnReq._id}/approve`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ notes: "Invalid approve attempt" });

    expect(res.status).toBe(409);
  });

  // SCENARIO 15: Unauthorized Refund Action (RBAC)
  it("Scenario 15: Should reject refund action when user lacks REFUNDS_CREATE permission", async () => {
    const returnReq = await ReturnRequest.create({
      returnNumber: `RET-UNAUTH-REF-${rand}`,
      orderId: orderPrepaid._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      status: "inspected",
      refundAmount: 2360,
      reason: "defective_product",
      items: [
        {
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: 2000,
          reason: "defective_product",
        },
      ],
    });

    const res = await request(app)
      .post(`/api/v1/returns/admin/${returnReq._id}/refund`)
      .set("Authorization", `Bearer ${viewerAdminToken}`)
      .send({ notes: "Attempt refund without refunds.create" });

    expect(res.status).toBe(403);
  });

  // SCENARIO 16: Safe Refund Initiation
  it("Scenario 16: Should allow authorized admin to initiate refund for inspected return", async () => {
    const returnReq = await ReturnRequest.create({
      returnNumber: `RET-REFUND-INIT-${rand}`,
      orderId: orderCod._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      status: "inspected",
      refundAmount: 1000,
      refundMethod: "bank_transfer",
      reason: "defective_product",
      bankDetails: {
        accountNumberMasked: "XXXXXX1234",
        ifscCode: "HDFC0001234",
        accountHolderName: "Sneha Patil",
      },
      items: [
        {
          orderItemId: orderCod.items[0]._id,
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: 1000,
          reason: "defective_product",
        },
      ],
    });

    const res = await request(app)
      .post(`/api/v1/returns/admin/${returnReq._id}/refund`)
      .set("Authorization", `Bearer ${regularAdminToken}`)
      .send({ notes: "COD bank transfer initiated" });

    expect(res.status).toBe(200);
    const updated = await ReturnRequest.findById(returnReq._id);
    expect(updated.status).toBe("refunded");
  });

  // SCENARIO 17: Duplicate Refund Prevention
  it("Scenario 17: Should prevent duplicate refund execution for already refunded return", async () => {
    const returnReq = await ReturnRequest.create({
      returnNumber: `RET-ALREADY-REF-${rand}`,
      orderId: orderCod._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      status: "refunded",
      refundAmount: 1000,
      refundMethod: "bank_transfer",
      reason: "defective_product",
      items: [
        {
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: 1000,
          reason: "defective_product",
        },
      ],
    });

    const res = await request(app)
      .post(`/api/v1/returns/admin/${returnReq._id}/refund`)
      .set("Authorization", `Bearer ${regularAdminToken}`)
      .send({ notes: "Attempt second refund" });

    expect(res.status).toBe(200); // idempotent return of existing
    const updated = await ReturnRequest.findById(returnReq._id);
    expect(updated.status).toBe("refunded");
  });

  // SCENARIO 18: Prevent Refund Exceeding Captured Payment
  it("Scenario 18: Should reject refund attempts exceeding captured payment amount", async () => {
    const returnReq = await ReturnRequest.create({
      returnNumber: `RET-EXCEED-REF-${rand}`,
      orderId: orderPrepaid._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      status: "inspected",
      refundAmount: 999999, // Exceeds 2360 payment
      refundMethod: "original_source",
      reason: "defective_product",
      items: [
        {
          orderItemId: orderPrepaid.items[0]._id,
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: 2000,
          reason: "defective_product",
        },
      ],
    });

    const res = await request(app)
      .post(`/api/v1/returns/admin/${returnReq._id}/refund`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ notes: "Exorbitant refund amount" });

    expect([422, 500]).toContain(res.status);
  });

  // SCENARIO 19: Failed Refund and Safe Retry
  it("Scenario 19: Should allow safe retry on a return with failed refund via /retry-refund", async () => {
    const returnReq = await ReturnRequest.create({
      returnNumber: `RET-RETRY-REF-${rand}`,
      orderId: orderCod._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      status: "refund_pending",
      resolutionNotes: "Gateway rejected request: Network timeout",
      refundAmount: 1000,
      refundMethod: "bank_transfer",
      reason: "defective_product",
      items: [
        {
          orderItemId: orderCod.items[0]._id,
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: 1000,
          reason: "defective_product",
        },
      ],
    });

    const res = await request(app)
      .post(`/api/v1/returns/admin/${returnReq._id}/retry-refund`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ notes: "Superadmin retrying payout after gateway recovery" });

    expect(res.status).toBe(200);
    const updated = await ReturnRequest.findById(returnReq._id);
    expect(updated.status).toBe("refunded");
  });

  // SCENARIO 20: Verified Gateway Settlement History Exposure
  it("Scenario 20: Should expose all gateway refund transactions and previous refunds in detail view", async () => {
    const returnReq = await ReturnRequest.create({
      returnNumber: `RET-GATEWAY-HIST-${rand}`,
      orderId: orderPrepaid._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      status: "refunded",
      refundAmount: 500,
      reason: "quality_issue",
      items: [
        {
          orderItemId: orderPrepaid.items[0]._id,
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: 500,
          reason: "quality_issue",
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/returns/admin/${returnReq._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const body = res.body.data;
    expect(body.refundTransactions).toBeDefined();
    expect(Array.isArray(body.refundTransactions)).toBe(true);
    expect(body.vendorDecision).toBeDefined();
    expect(body.auditHistory).toBeDefined();
  });

  // SCENARIO 21: Immutable Audit Log Enforcement
  it("Scenario 21: Should strictly reject update or delete attempts on AuditLog records", async () => {
    const auditRecord = await AuditLog.create({
      actorId: superAdminUser._id,
      targetId: orderPrepaid._id,
      action: "RETURN_TEST_IMMUTABLE",
      entityType: "return_request",
      reason: "Test immutability enforcement",
    });

    auditRecord.reason = "Tampered reason";
    await expect(auditRecord.save()).rejects.toThrow(/append-only/i);

    await expect(
      AuditLog.updateOne({ _id: auditRecord._id }, { reason: "Tampered" })
    ).rejects.toThrow(/append-only/i);

    await expect(
      AuditLog.deleteOne({ _id: auditRecord._id })
    ).rejects.toThrow(/cannot be deleted/i);
  });

  // SCENARIO 22: Cross-Vendor Data Isolation
  it("Scenario 22: Should prevent Vendor A from accessing returns belonging to Vendor B", async () => {
    const returnReqB = await ReturnRequest.create({
      returnNumber: `RET-VENDOR-B-${rand}`,
      orderId: orderMultiVendor._id,
      customerId: customerDoc._id,
      vendorId: vendorDocB._id,
      vendorIds: [vendorDocB._id],
      status: "requested",
      refundAmount: 3000,
      reason: "defective_product",
      items: [
        {
          orderItemId: orderMultiVendor.items[1]._id,
          productId: productB._id,
          vendorId: vendorDocB._id,
          sku: variantB.sku,
          name: productB.name,
          quantity: 1,
          itemPrice: 3000,
          reason: "defective_product",
        },
      ],
    });

    // Vendor A tries to access Vendor B's return
    const res = await request(app)
      .get(`/api/v1/returns/vendor/my/${returnReqB._id}`)
      .set("Authorization", `Bearer ${vendorTokenA}`);

    expect([403, 404]).toContain(res.status);
  });

  // SCENARIO 23: Operational KPIs Server-Side Aggregation
  it("Scenario 23: Should calculate complete operational KPIs across entire dataset", async () => {
    const res = await request(app)
      .get("/api/v1/returns/admin?page=1&limit=5")
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const meta = res.body.meta;
    expect(meta.kpis).toBeDefined();
    expect(typeof meta.kpis.totalReturns).toBe("number");
    expect(typeof meta.kpis.pendingVendorDecisions).toBe("number");
    expect(typeof meta.kpis.pendingSuperadminInterventions).toBe("number");
    expect(typeof meta.kpis.acceptedReturns).toBe("number");
    expect(typeof meta.kpis.rejectedReturns).toBe("number");
    expect(typeof meta.kpis.totalAuthorizedLiability).toBe("string");
    expect(typeof meta.kpis.totalSuccessfullyRefunded).toBe("string");
    expect(typeof meta.kpis.outstandingRefundLiability).toBe("string");
  });

  // SCENARIO 24: Comprehensive Filter & Pagination Regression
  it("Scenario 24: Should filter returns by status, reason, and pagination server-side", async () => {
    const res = await request(app)
      .get("/api/v1/returns/admin?status=refunded&page=1&limit=10")
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const items = res.body.data;
    expect(Array.isArray(items)).toBe(true);
    items.forEach((it) => {
      expect(it.status).toBe("refunded");
    });
  });

  // SCENARIO 25: Search by Return Number or Order Number
  it("Scenario 25: Should support search by returnNumber or orderNumber cleanly", async () => {
    const res = await request(app)
      .get(`/api/v1/returns/admin?search=ORD-PRE-${rand}`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const items = res.body.data;
    expect(items.length).toBeGreaterThanOrEqual(1);
  });
});

