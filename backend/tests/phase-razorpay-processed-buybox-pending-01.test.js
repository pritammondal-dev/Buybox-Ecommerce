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
const AuditLog = require("../src/models/AuditLog");

const { generateAccessToken } = require("../src/services/token.service");
const { ROLES } = require("../src/constants/auth.constants");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const refundService = require("../src/services/refund.service");
const razorpayRefundProvider = require("../src/integrations/payments/razorpay-refund.provider");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/\/buybox(_test)?(\?|$)/, "/buybox_razorpay_sync_test$2")
  : "mongodb://127.0.0.1:27017/buybox_razorpay_sync_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Phase RAZORPAY-PROCESSED-BUYBOX-PENDING-01 — Post-Refund Reconciliation & Double-Disbursement Prevention", () => {
  let superAdminUser, superAdminToken;
  let vendorUser, vendorToken, vendorDoc;
  let customerUser, customerToken, customerDoc;
  let category, brand, product, variant;
  let order, payment;
  let returnRequest, refundApplication;

  const rand = Math.random().toString(36).substring(7);

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // 1. Superadmin User
    superAdminUser = await User.findOne({ role: ROLES.SUPER_ADMIN, isActive: true });
    if (!superAdminUser) {
      superAdminUser = await User.create({
        firstName: "Super",
        lastName: "Admin",
        email: `super_sync_${rand}@buybox.local`,
        phone: "+919988112290",
        password: "Password123!",
        role: ROLES.SUPER_ADMIN,
        roles: [ROLES.SUPER_ADMIN],
        permissions: Object.values(PERMISSIONS),
        isActive: true,
      });
    }
    superAdminToken = generateAccessToken({
      userId: superAdminUser._id,
      role: ROLES.SUPER_ADMIN,
      roles: [ROLES.SUPER_ADMIN],
      permissions: Object.values(PERMISSIONS),
    });

    // 2. Vendor User & Profile
    vendorUser = await User.create({
      firstName: "Vendor",
      lastName: "Sync",
      email: `vendor_sync_${rand}@buybox.local`,
      phone: "+919988112291",
      password: "Password123!",
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      isActive: true,
    });
    vendorToken = generateAccessToken({
      userId: vendorUser._id,
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      permissions: [],
    });

    vendorDoc = await Vendor.create({
      userId: vendorUser._id,
      storeName: `Sync Store ${rand}`,
      businessName: `Sync Pvt Ltd ${rand}`,
      businessSlug: `sync-store-${rand}`,
      email: vendorUser.email,
      phone: vendorUser.phone,
      onboardingStatus: "approved",
      isActive: true,
      commissionRate: 10,
    });

    // 3. Customer User & Profile
    customerUser = await User.create({
      firstName: "Customer",
      lastName: "Sync",
      email: `cust_sync_${rand}@buybox.local`,
      phone: "+919988112292",
      password: "Password123!",
      role: ROLES.CUSTOMER,
      roles: [ROLES.CUSTOMER],
      isActive: true,
    });
    customerToken = generateAccessToken({
      userId: customerUser._id,
      role: ROLES.CUSTOMER,
      roles: [ROLES.CUSTOMER],
      permissions: [],
    });

    customerDoc = await Customer.create({
      userId: customerUser._id,
      firstName: customerUser.firstName,
      lastName: customerUser.lastName,
      email: customerUser.email,
      phone: customerUser.phone,
    });

    // 4. Catalog Entities
    category = await Category.create({
      name: `Sync Category ${rand}`,
      slug: `sync-cat-${rand}`,
      isActive: true,
    });

    brand = await Brand.create({
      name: `Sync Brand ${rand}`,
      slug: `sync-brand-${rand}`,
      isActive: true,
    });

    product = await Product.create({
      name: `Sync Product ${rand}`,
      slug: `sync-prod-${rand}`,
      sku: `SKU-PROD-${rand}`,
      price: 30794.46,
      brandId: brand._id,
      categoryId: category._id,
      vendorId: vendorDoc._id,
      status: "active",
    });

    variant = await ProductVariant.create({
      productId: product._id,
      name: "Default Variant",
      sku: `SKU-SYNC-${rand}`,
      price: 30794.46,
      stock: 50,
      isActive: true,
    });
  });

  afterAll(async () => {
    // Cleanup collections
    await User.deleteMany({ email: new RegExp(rand) });
    await Vendor.deleteMany({ _id: vendorDoc?._id });
    await Customer.deleteMany({ _id: customerDoc?._id });
    await Category.deleteMany({ _id: category?._id });
    await Brand.deleteMany({ _id: brand?._id });
    await Product.deleteMany({ _id: product?._id });
    await ProductVariant.deleteMany({ _id: variant?._id });
    await Order.deleteMany({ customerId: customerDoc?._id });
    await Payment.deleteMany({ customerId: customerDoc?._id });
    await ReturnRequest.deleteMany({ customerId: customerDoc?._id });
    await RefundApplication.deleteMany({ customerId: customerDoc?._id });
    await Refund.deleteMany({ customerId: customerDoc?._id });

    await mongoose.disconnect();
  });

  const setupOrderAndReturn = async ({ paymentAmount = 30794.46 } = {}) => {
    const itemSubtotal = 26097.0;
    const taxAmount = 4697.46;
    const grandTotal = paymentAmount;

    order = await Order.create({
      orderNumber: `ORD-SYNC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      customerId: customerDoc._id,
      userId: customerUser._id,
      vendorId: vendorDoc._id,
      status: "delivered",
      paymentStatus: "paid",
      paymentMethod: "razorpay",
      currency: "INR",
      subtotal: itemSubtotal,
      taxTotal: taxAmount,
      shippingTotal: 0,
      discountTotal: 0,
      grandTotal,
      amountPaid: grandTotal,
      deliveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      items: [
        {
          productId: product._id,
          productVariantId: variant._id,
          productName: product.name,
          sku: variant.sku,
          name: product.name,
          vendorId: vendorDoc._id,
          quantity: 1,
          unitPrice: itemSubtotal,
          originalUnitPrice: itemSubtotal,
          itemPrice: itemSubtotal,
          currency: "INR",
          lineTotal: itemSubtotal,
          taxAmount,
          taxTotal: taxAmount,
          customerPaidAmount: grandTotal,
          returnStatus: "requested",
          fulfillmentStatus: "delivered",
          taxBreakdown: {
            cgst: 2348.73,
            sgst: 2348.73,
            igst: 0,
            pricingMode: "tax_exclusive",
            taxRate: 18,
          },
        },
      ],
      shippingAddress: {
        fullName: "Sync Customer",
        phone: "+919988112292",
        addressLine1: "123 Market St",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
    });

    payment = await Payment.create({
      orderId: order._id,
      customerId: customerDoc._id,
      amount: grandTotal,
      currency: "INR",
      status: "captured",
      gateway: "razorpay",
      gatewayPaymentId: `pay_test_${Math.random().toString(36).substring(2, 10)}`,
      refundedAmount: 0.0,
      refundReservedAmount: grandTotal,
    });

    returnRequest = await ReturnRequest.create({
      returnNumber: `RET-SYNC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      orderId: order._id,
      customerId: customerDoc._id,
      vendorId: vendorDoc._id,
      vendorIds: [vendorDoc._id],
      status: "refund_pending",
      refundAmount: grandTotal,
      items: [
        {
          orderItemId: order.items[0]._id,
          productId: product._id,
          productVariantId: variant._id,
          sku: variant.sku,
          name: product.name,
          quantity: 1,
          itemPrice: itemSubtotal,
          reason: "defective_product",
          taxBreakdown: order.items[0].taxBreakdown,
        },
      ],
    });

    refundApplication = await RefundApplication.create({
      applicationNumber: `RA-SYNC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      returnId: returnRequest._id,
      orderId: order._id,
      merchantId: vendorDoc._id,
      customerId: customerDoc._id,
      authoritativeRefundBreakdown: {
        totalPayableRefund: grandTotal,
        netProductRefund: itemSubtotal,
        gstReversal: taxAmount,
      },
      requestedAmount: grandTotal,
      applicationStatus: "submitted",
      submittedBy: vendorUser._id,
    });

    return { order, payment, returnRequest, refundApplication };
  };

  test("1. Reconcile gateway refund sets Refund.status = 'processed', captures ARN and sets processedAt", async () => {
    const { payment, returnRequest, refundApplication } = await setupOrderAndReturn();
    const gatewayRefundId = `rfnd_sync_${Math.random().toString(36).substring(2, 10)}`;

    const refund = await Refund.create({
      paymentId: payment._id,
      orderId: order._id,
      customerId: customerDoc._id,
      gateway: "razorpay",
      gatewayRefundId,
      amount: 30794.46,
      currency: "INR",
      status: "pending",
      idempotencyKey: `ret_refund_${returnRequest._id}`,
    });
    returnRequest.refundId = refund._id;
    await returnRequest.save();

    jest.spyOn(razorpayRefundProvider, "fetchRefund").mockResolvedValueOnce({
      id: gatewayRefundId,
      payment_id: payment.gatewayPaymentId,
      amount: 3079446,
      status: "processed",
      created_at: 1794210989,
      acquirer_data: {
        arn: "10000000000000",
      },
      speed_processed: "normal",
    });

    const result = await refundService.reconcileGatewayRefund({
      refundId: refund._id,
      gatewayRefundId,
      userId: superAdminUser._id,
    });

    expect(result.reconciled).toBe(true);
    expect(result.newStatus).toBe("processed");
    expect(result.arn).toBe("10000000000000");

    const reloadedRefund = await Refund.findById(refund._id);
    expect(reloadedRefund.status).toBe("processed");
    expect(reloadedRefund.arn).toBe("10000000000000");
    expect(reloadedRefund.processedAt).toBeDefined();
    expect(reloadedRefund.acquirerData?.arn).toBe("10000000000000");

    razorpayRefundProvider.fetchRefund.mockRestore();
  });

  test("2. Exact double-entry pool transition: Payment.refundReservedAmount decrements and Payment.refundedAmount increments by ₹30,794.46", async () => {
    const { payment, returnRequest } = await setupOrderAndReturn();
    const gatewayRefundId = `rfnd_sync_${Math.random().toString(36).substring(2, 10)}`;

    const refund = await Refund.create({
      paymentId: payment._id,
      orderId: order._id,
      customerId: customerDoc._id,
      gateway: "razorpay",
      gatewayRefundId,
      amount: 30794.46,
      currency: "INR",
      status: "pending",
      idempotencyKey: `ret_refund_${returnRequest._id}`,
    });

    jest.spyOn(razorpayRefundProvider, "fetchRefund").mockResolvedValueOnce({
      id: gatewayRefundId,
      payment_id: payment.gatewayPaymentId,
      amount: 3079446,
      status: "processed",
      created_at: 1794210989,
      acquirer_data: { arn: "10000000000000" },
    });

    await refundService.reconcileGatewayRefund({
      refundId: refund._id,
      gatewayRefundId,
      userId: superAdminUser._id,
    });

    const reloadedPayment = await Payment.findById(payment._id);
    expect(Number(reloadedPayment.refundReservedAmount.toString())).toBe(0.0);
    expect(Number(reloadedPayment.refundedAmount.toString())).toBe(30794.46);
    expect(reloadedPayment.status).toBe("refunded");

    razorpayRefundProvider.fetchRefund.mockRestore();
  });

  test("3. ReturnRequest status transitions from refund_pending to refunded and captures ARN in timeline", async () => {
    const { payment, returnRequest } = await setupOrderAndReturn();
    const gatewayRefundId = `rfnd_sync_${Math.random().toString(36).substring(2, 10)}`;

    const refund = await Refund.create({
      paymentId: payment._id,
      orderId: order._id,
      customerId: customerDoc._id,
      gateway: "razorpay",
      gatewayRefundId,
      amount: 30794.46,
      currency: "INR",
      status: "pending",
      idempotencyKey: `ret_refund_${returnRequest._id}`,
    });
    returnRequest.refundId = refund._id;
    await returnRequest.save();

    jest.spyOn(razorpayRefundProvider, "fetchRefund").mockResolvedValueOnce({
      id: gatewayRefundId,
      payment_id: payment.gatewayPaymentId,
      amount: 3079446,
      status: "processed",
      created_at: 1794210989,
      acquirer_data: { arn: "10000000000000" },
    });

    await refundService.reconcileGatewayRefund({
      refundId: refund._id,
      gatewayRefundId,
      userId: superAdminUser._id,
    });

    const reloadedReturn = await ReturnRequest.findById(returnRequest._id);
    expect(reloadedReturn.status).toBe("refunded");
    expect(reloadedReturn.arn).toBe("10000000000000");
    expect(reloadedReturn.refundProcessedAt).toBeDefined();

    const lastTimeline = reloadedReturn.timeline[reloadedReturn.timeline.length - 1];
    expect(lastTimeline.status).toBe("refunded");
    expect(lastTimeline.notes).toContain("10000000000000");

    razorpayRefundProvider.fetchRefund.mockRestore();
  });

  test("4. RefundApplication transitions to disbursed and captures ARN", async () => {
    const { payment, returnRequest, refundApplication } = await setupOrderAndReturn();
    const gatewayRefundId = `rfnd_sync_${Math.random().toString(36).substring(2, 10)}`;

    const refund = await Refund.create({
      paymentId: payment._id,
      orderId: order._id,
      customerId: customerDoc._id,
      gateway: "razorpay",
      gatewayRefundId,
      amount: 30794.46,
      currency: "INR",
      status: "pending",
      idempotencyKey: `ret_refund_${returnRequest._id}`,
    });
    returnRequest.refundId = refund._id;
    await returnRequest.save();

    jest.spyOn(razorpayRefundProvider, "fetchRefund").mockResolvedValueOnce({
      id: gatewayRefundId,
      payment_id: payment.gatewayPaymentId,
      amount: 3079446,
      status: "processed",
      created_at: 1794210989,
      acquirer_data: { arn: "10000000000000" },
    });

    await refundService.reconcileGatewayRefund({
      refundId: refund._id,
      gatewayRefundId,
      userId: superAdminUser._id,
    });

    const reloadedApp = await RefundApplication.findById(refundApplication._id);
    expect(reloadedApp.applicationStatus).toBe("disbursed");
    expect(reloadedApp.disbursementStatus).toBe("disbursed");
    expect(Number(reloadedApp.disbursedAmount.toString())).toBe(30794.46);
    expect(reloadedApp.arn).toBe("10000000000000");
    expect(reloadedApp.disbursementReference.toString()).toBe(refund._id.toString());

    razorpayRefundProvider.fetchRefund.mockRestore();
  });

  test("5. Gateway failure mapping releases reservation and keeps return available for review", async () => {
    const { payment, returnRequest, refundApplication } = await setupOrderAndReturn();
    const gatewayRefundId = `rfnd_sync_${Math.random().toString(36).substring(2, 10)}`;

    const refund = await Refund.create({
      paymentId: payment._id,
      orderId: order._id,
      customerId: customerDoc._id,
      gateway: "razorpay",
      gatewayRefundId,
      amount: 30794.46,
      currency: "INR",
      status: "pending",
      idempotencyKey: `ret_refund_${returnRequest._id}`,
    });
    returnRequest.refundId = refund._id;
    await returnRequest.save();

    jest.spyOn(razorpayRefundProvider, "fetchRefund").mockResolvedValueOnce({
      id: gatewayRefundId,
      payment_id: payment.gatewayPaymentId,
      amount: 3079446,
      status: "failed",
      error_description: "Bank declined refund transfer",
      created_at: 1794210989,
    });

    const result = await refundService.reconcileGatewayRefund({
      refundId: refund._id,
      gatewayRefundId,
      userId: superAdminUser._id,
    });

    expect(result.newStatus).toBe("failed");

    const reloadedRefund = await Refund.findById(refund._id);
    expect(reloadedRefund.status).toBe("failed");
    expect(reloadedRefund.failureReason).toContain("Bank declined refund transfer");

    const reloadedPayment = await Payment.findById(payment._id);
    expect(Number(reloadedPayment.refundReservedAmount.toString())).toBe(0.0);

    const reloadedApp = await RefundApplication.findById(refundApplication._id);
    expect(reloadedApp.applicationStatus).toBe("disbursement_failed");

    razorpayRefundProvider.fetchRefund.mockRestore();
  });

  test("6. Idempotent reconciliation: Reconciling repeatedly does not duplicate records or drift balances", async () => {
    const { payment, returnRequest } = await setupOrderAndReturn();
    const gatewayRefundId = `rfnd_sync_${Math.random().toString(36).substring(2, 10)}`;

    const refund = await Refund.create({
      paymentId: payment._id,
      orderId: order._id,
      customerId: customerDoc._id,
      gateway: "razorpay",
      gatewayRefundId,
      amount: 30794.46,
      currency: "INR",
      status: "pending",
      idempotencyKey: `ret_refund_${returnRequest._id}`,
    });

    const mockResponse = {
      id: gatewayRefundId,
      payment_id: payment.gatewayPaymentId,
      amount: 3079446,
      status: "processed",
      created_at: 1794210989,
      acquirer_data: { arn: "10000000000000" },
    };

    jest.spyOn(razorpayRefundProvider, "fetchRefund").mockResolvedValue(mockResponse);

    // Call 1
    await refundService.reconcileGatewayRefund({
      refundId: refund._id,
      gatewayRefundId,
      userId: superAdminUser._id,
    });

    // Call 2
    const result2 = await refundService.reconcileGatewayRefund({
      refundId: refund._id,
      gatewayRefundId,
      userId: superAdminUser._id,
    });

    expect(result2.reconciled).toBe(true);
    expect(result2.newStatus).toBe("processed");

    const refundCount = await Refund.countDocuments({ orderId: order._id });
    expect(refundCount).toBe(1);

    const reloadedPayment = await Payment.findById(payment._id);
    expect(Number(reloadedPayment.refundedAmount.toString())).toBe(30794.46);
    expect(Number(reloadedPayment.refundReservedAmount.toString())).toBe(0.0);

    razorpayRefundProvider.fetchRefund.mockRestore();
  });

  test("7. Merchant disbursement quarantine: Merchant calling refund reconciliation directly receives HTTP 403", async () => {
    const { returnRequest } = await setupOrderAndReturn();

    const res = await request(app)
      .post(`/api/v1/returns/vendor/my/${returnRequest._id}/reconcile-refund`)
      .set("Authorization", `Bearer ${vendorToken}`)
      .send();

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("MERCHANT_DISBURSEMENT_UNAUTHORIZED");
  });

  test("8. Superadmin can reconcile return via POST /api/v1/returns/admin/:id/reconcile-refund", async () => {
    const { payment, returnRequest } = await setupOrderAndReturn();
    const gatewayRefundId = `rfnd_sync_${Math.random().toString(36).substring(2, 10)}`;

    const refund = await Refund.create({
      paymentId: payment._id,
      orderId: order._id,
      customerId: customerDoc._id,
      gateway: "razorpay",
      gatewayRefundId,
      amount: 30794.46,
      currency: "INR",
      status: "pending",
      idempotencyKey: `ret_refund_${returnRequest._id}`,
    });
    returnRequest.refundId = refund._id;
    await returnRequest.save();

    jest.spyOn(razorpayRefundProvider, "fetchRefund").mockResolvedValueOnce({
      id: gatewayRefundId,
      payment_id: payment.gatewayPaymentId,
      amount: 3079446,
      status: "processed",
      created_at: 1794210989,
      acquirer_data: { arn: "10000000000000" },
    });

    const res = await request(app)
      .post(`/api/v1/returns/admin/${returnRequest._id}/reconcile-refund`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("refunded");
    expect(res.body.data.arn).toBe("10000000000000");

    razorpayRefundProvider.fetchRefund.mockRestore();
  });

  test("9. Identity validation: Gateway refund for mismatched payment throws HTTP 409 REFUND_PAYMENT_MISMATCH", async () => {
    const { payment, returnRequest } = await setupOrderAndReturn();
    const gatewayRefundId = `rfnd_sync_${Math.random().toString(36).substring(2, 10)}`;

    const refund = await Refund.create({
      paymentId: payment._id,
      orderId: order._id,
      customerId: customerDoc._id,
      gateway: "razorpay",
      gatewayRefundId,
      amount: 30794.46,
      currency: "INR",
      status: "pending",
      idempotencyKey: `ret_refund_${returnRequest._id}`,
    });

    jest.spyOn(razorpayRefundProvider, "fetchRefund").mockResolvedValueOnce({
      id: gatewayRefundId,
      payment_id: "pay_different_payment_id",
      amount: 3079446,
      status: "processed",
    });

    await expect(
      refundService.reconcileGatewayRefund({
        refundId: refund._id,
        gatewayRefundId,
        userId: superAdminUser._id,
      })
    ).rejects.toMatchObject({ code: "REFUND_PAYMENT_MISMATCH" });

    razorpayRefundProvider.fetchRefund.mockRestore();
  });

  test("10. Amount validation: Gateway refund with mismatched minor units throws HTTP 409 REFUND_AMOUNT_MISMATCH", async () => {
    const { payment, returnRequest } = await setupOrderAndReturn();
    const gatewayRefundId = `rfnd_sync_${Math.random().toString(36).substring(2, 10)}`;

    const refund = await Refund.create({
      paymentId: payment._id,
      orderId: order._id,
      customerId: customerDoc._id,
      gateway: "razorpay",
      gatewayRefundId,
      amount: 30794.46,
      currency: "INR",
      status: "pending",
      idempotencyKey: `ret_refund_${returnRequest._id}`,
    });

    jest.spyOn(razorpayRefundProvider, "fetchRefund").mockResolvedValueOnce({
      id: gatewayRefundId,
      payment_id: payment.gatewayPaymentId,
      amount: 1000000, // ₹10,000 instead of ₹30,794.46
      status: "processed",
    });

    await expect(
      refundService.reconcileGatewayRefund({
        refundId: refund._id,
        gatewayRefundId,
        userId: superAdminUser._id,
      })
    ).rejects.toMatchObject({ code: "REFUND_AMOUNT_MISMATCH" });

    razorpayRefundProvider.fetchRefund.mockRestore();
  });

  test("11. Immutable Audit Log REFUND_GATEWAY_RECONCILED_SUCCESS is recorded with before and after state", async () => {
    const { payment, returnRequest } = await setupOrderAndReturn();
    const gatewayRefundId = `rfnd_sync_${Math.random().toString(36).substring(2, 10)}`;

    const refund = await Refund.create({
      paymentId: payment._id,
      orderId: order._id,
      customerId: customerDoc._id,
      gateway: "razorpay",
      gatewayRefundId,
      amount: 30794.46,
      currency: "INR",
      status: "pending",
      idempotencyKey: `ret_refund_${returnRequest._id}`,
    });

    jest.spyOn(razorpayRefundProvider, "fetchRefund").mockResolvedValueOnce({
      id: gatewayRefundId,
      payment_id: payment.gatewayPaymentId,
      amount: 3079446,
      status: "processed",
      created_at: 1794210989,
      acquirer_data: { arn: "10000000000000" },
    });

    await refundService.reconcileGatewayRefund({
      refundId: refund._id,
      gatewayRefundId,
      userId: superAdminUser._id,
    });

    const audit = await AuditLog.findOne({
      targetId: refund._id,
      action: "REFUND_GATEWAY_RECONCILED_SUCCESS",
    });

    expect(audit).toBeDefined();
    expect(audit.entityType).toBe("Refund");
    expect(audit.actorId.toString()).toBe(superAdminUser._id.toString());
    expect(audit.beforeState.status).toBe("pending");
    expect(audit.afterState.status).toBe("processed");
    expect(audit.afterState.arn).toBe("10000000000000");

    razorpayRefundProvider.fetchRefund.mockRestore();
  });

  test("12. Automatic reconcile on retry: Calling processReturnRefund on pending refund triggers gateway fetch and synchronizes", async () => {
    const { payment, returnRequest } = await setupOrderAndReturn();
    const gatewayRefundId = `rfnd_sync_${Math.random().toString(36).substring(2, 10)}`;

    const refund = await Refund.create({
      paymentId: payment._id,
      orderId: order._id,
      customerId: customerDoc._id,
      gateway: "razorpay",
      gatewayRefundId,
      amount: 30794.46,
      currency: "INR",
      status: "pending",
      idempotencyKey: `ret_refund_${returnRequest._id}`,
    });
    returnRequest.refundId = refund._id;
    await returnRequest.save();

    jest.spyOn(razorpayRefundProvider, "fetchRefund").mockResolvedValueOnce({
      id: gatewayRefundId,
      payment_id: payment.gatewayPaymentId,
      amount: 3079446,
      status: "processed",
      created_at: 1794210989,
      acquirer_data: { arn: "10000000000000" },
    });

    const returnRequestService = require("../src/services/return-request.service");
    const result = await returnRequestService.processReturnRefund({
      userId: superAdminUser._id,
      returnId: returnRequest._id,
      isAdmin: true,
    });

    expect(result.status).toBe("refunded");
    expect(result.arn).toBe("10000000000000");

    const reloadedPayment = await Payment.findById(payment._id);
    expect(reloadedPayment.status).toBe("refunded");
    expect(Number(reloadedPayment.refundedAmount.toString())).toBe(30794.46);

    razorpayRefundProvider.fetchRefund.mockRestore();
  });
});
