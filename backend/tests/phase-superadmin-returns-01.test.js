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

const { generateAccessToken } = require("../src/services/token.service");
const { ROLES } = require("../src/constants/auth.constants");
const { PERMISSIONS } = require("../src/constants/permissions.constants");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/\/buybox(_test)?(\?|$)/, "/buybox_superadmin_returns_test$2")
  : "mongodb://127.0.0.1:27017/buybox_superadmin_returns_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Phase SUPERADMIN-RETURNS-01 — Superadmin RMA Parity & Governance Test Suite", () => {
  let superAdminUser, superAdminToken;
  let regularAdminUser, regularAdminToken;
  let customerUser, customerToken, customerDoc;
  let vendorUserA, vendorTokenA, vendorDocA;
  let vendorUserB, vendorTokenB, vendorDocB;
  let vendorUserSuspended, vendorDocSuspended;
  let category, brand;
  let productA, variantA;
  let productB, variantB;
  let productSuspended, variantSuspended;
  let orderA, orderMultiVendor, orderSuspended;

  const rand = Math.random().toString(36).substring(7);

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // 1. Superadmin & Regular Admin
    superAdminUser = await User.create({
      firstName: "Super",
      lastName: "Administrator",
      email: `superadmin_${rand}@buybox.local`,
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
      email: `ops_admin_${rand}@buybox.local`,
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

    // 2. Customer
    customerUser = await User.create({
      firstName: "Pooja",
      lastName: "Hegde",
      email: `pooja_${rand}@example.com`,
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

    // 3. Vendors: Vendor A (Active), Vendor B (Active), Vendor Suspended
    vendorUserA = await User.create({
      firstName: "Apex",
      lastName: "Vendor",
      email: `apex_${rand}@vendor.com`,
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
      businessSlug: `apex-tech-${rand}`,
      onboardingStatus: "approved",
      isActive: true,
      businessAddress: {
        addressLine1: "100 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
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
      email: `beacon_${rand}@vendor.com`,
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
      businessSlug: `beacon-apparel-${rand}`,
      onboardingStatus: "approved",
      isActive: true,
      businessAddress: {
        addressLine1: "200 Linking Road",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400050",
        country: "IN",
      },
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
      email: `suspended_${rand}@vendor.com`,
      phone: "+919855333444",
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: false,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendorDocSuspended = await Vendor.create({
      userId: vendorUserSuspended._id,
      businessName: `Suspended Logistics LLC ${rand}`,
      businessSlug: `suspended-llc-${rand}`,
      onboardingStatus: "suspended",
      isActive: false,
      businessAddress: {
        addressLine1: "300 Industrial Area",
        city: "Delhi",
        state: "Delhi",
        postalCode: "110020",
        country: "IN",
      },
    });

    // 4. Catalog Entities
    category = await Category.create({
      name: `Electronics SA ${rand}`,
      slug: `elec-sa-${rand}`,
      isActive: true,
    });
    brand = await Brand.create({
      name: `Global Brand SA ${rand}`,
      slug: `brand-sa-${rand}`,
      isActive: true,
    });

    productA = await Product.create({
      name: `Apex Pro ANC Headphones ${rand}`,
      slug: `apex-pro-anc-${rand}`,
      sku: `APX-PRO-${rand}`,
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
      name: "Space Grey",
      sku: `APX-PRO-GRY-${rand}`,
      price: mongoose.Types.Decimal128.fromString("2000.00"),
      stock: 50,
      isActive: true,
    });

    productB = await Product.create({
      name: `Beacon Cotton Polo ${rand}`,
      slug: `beacon-polo-${rand}`,
      sku: `BCN-POLO-${rand}`,
      vendorId: vendorDocB._id,
      categoryId: category._id,
      brandId: brand._id,
      price: mongoose.Types.Decimal128.fromString("1200.00"),
      status: "active",
      isActive: true,
      images: [{ url: "https://example.com/p2.jpg" }],
    });
    variantB = await ProductVariant.create({
      productId: productB._id,
      name: "Navy Blue / L",
      sku: `BCN-POLO-NVY-${rand}`,
      price: mongoose.Types.Decimal128.fromString("1200.00"),
      stock: 30,
      isActive: true,
    });

    productSuspended = await Product.create({
      name: `Suspended Merchant Powerbank ${rand}`,
      slug: `susp-pwr-${rand}`,
      sku: `SUSP-PWR-${rand}`,
      vendorId: vendorDocSuspended._id,
      categoryId: category._id,
      brandId: brand._id,
      price: mongoose.Types.Decimal128.fromString("800.00"),
      status: "active",
      isActive: true,
      images: [{ url: "https://example.com/p3.jpg" }],
    });
    variantSuspended = await ProductVariant.create({
      productId: productSuspended._id,
      name: "10000mAh",
      sku: `SUSP-PWR-10K-${rand}`,
      price: mongoose.Types.Decimal128.fromString("800.00"),
      stock: 15,
      isActive: true,
    });

    // 5. Orders
    orderA = await Order.create({
      orderNumber: `ORD-SA-A-${rand}`,
      customerId: customerDoc._id,
      userId: customerUser._id,
      status: "delivered",
      paymentStatus: "paid",
      paymentMethod: "razorpay",
      currency: "INR",
      subtotal: 2000.0,
      discountTotal: 200.0,
      shippingTotal: 100.0,
      grandTotal: 2224.0,
      taxSummary: {
        totalTax: 324.0,
        pricingMode: "tax_exclusive",
      },
      items: [
        {
          productId: productA._id,
          productVariantId: variantA._id,
          sku: variantA.sku,
          productName: productA.name,
          quantity: 1,
          unitPrice: 2000.0,
          lineTotal: 2000.0,
          currency: "INR",
          discountTotal: 200.0,
          taxTotal: 324.0,
          taxDetails: {
            taxRate: 0.18,
            pricingMode: "tax_exclusive",
          },
          vendorId: vendorDocA._id,
          fulfillmentStatus: "delivered",
          deliveredAt: new Date(),
        },
      ],
      shippingAddress: {
        fullName: "Pooja Hegde",
        phone: "+919811998877",
        addressLine1: "Flat 4B, Sky Towers",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560008",
        country: "IN",
      },
    });

    orderMultiVendor = await Order.create({
      orderNumber: `ORD-SA-MULTI-${rand}`,
      customerId: customerDoc._id,
      userId: customerUser._id,
      status: "delivered",
      paymentStatus: "paid",
      paymentMethod: "razorpay",
      currency: "INR",
      subtotal: 3200.0,
      discountTotal: 320.0,
      shippingTotal: 150.0,
      grandTotal: 3548.4,
      taxSummary: {
        totalTax: 518.4,
        pricingMode: "tax_exclusive",
      },
      items: [
        {
          productId: productA._id,
          productVariantId: variantA._id,
          sku: variantA.sku,
          productName: productA.name,
          quantity: 1,
          unitPrice: 2000.0,
          lineTotal: 2000.0,
          currency: "INR",
          discountTotal: 200.0,
          taxTotal: 324.0,
          taxDetails: {
            taxRate: 0.18,
            pricingMode: "tax_exclusive",
          },
          vendorId: vendorDocA._id,
          fulfillmentStatus: "delivered",
          deliveredAt: new Date(),
        },
        {
          productId: productB._id,
          productVariantId: variantB._id,
          sku: variantB.sku,
          productName: productB.name,
          quantity: 1,
          unitPrice: 1200.0,
          lineTotal: 1200.0,
          currency: "INR",
          discountTotal: 120.0,
          taxTotal: 194.4,
          taxDetails: {
            taxRate: 0.18,
            pricingMode: "tax_exclusive",
          },
          vendorId: vendorDocB._id,
          fulfillmentStatus: "delivered",
          deliveredAt: new Date(),
        },
      ],
      shippingAddress: {
        fullName: "Pooja Hegde",
        phone: "+919811998877",
        addressLine1: "Flat 4B, Sky Towers",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560008",
        country: "IN",
      },
    });

    orderSuspended = await Order.create({
      orderNumber: `ORD-SA-SUSP-${rand}`,
      customerId: customerDoc._id,
      userId: customerUser._id,
      status: "delivered",
      paymentStatus: "paid",
      paymentMethod: "razorpay",
      currency: "INR",
      subtotal: 800.0,
      discountTotal: 0.0,
      shippingTotal: 50.0,
      grandTotal: 994.0,
      taxSummary: {
        totalTax: 144.0,
        pricingMode: "tax_exclusive",
      },
      items: [
        {
          productId: productSuspended._id,
          productVariantId: variantSuspended._id,
          sku: variantSuspended.sku,
          productName: productSuspended.name,
          quantity: 1,
          unitPrice: 800.0,
          lineTotal: 800.0,
          currency: "INR",
          discountTotal: 0.0,
          taxTotal: 144.0,
          taxDetails: {
            taxRate: 0.18,
            pricingMode: "tax_exclusive",
          },
          vendorId: vendorDocSuspended._id,
          fulfillmentStatus: "delivered",
          deliveredAt: new Date(),
        },
      ],
      shippingAddress: {
        fullName: "Pooja Hegde",
        phone: "+919811998877",
        addressLine1: "Flat 4B, Sky Towers",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560008",
        country: "IN",
      },
    });
  });

  afterAll(async () => {
    await ReturnRequest.deleteMany({ returnNumber: new RegExp(rand) });
    await Order.deleteMany({ orderNumber: new RegExp(rand) });
    await ProductVariant.deleteMany({ sku: new RegExp(rand) });
    await Product.deleteMany({ sku: new RegExp(rand) });
    await Vendor.deleteMany({ businessSlug: new RegExp(rand) });
    await Customer.deleteMany({ _id: customerDoc?._id });
    await User.deleteMany({ email: new RegExp(rand) });
    await Brand.deleteMany({ slug: new RegExp(rand) });
    await Category.deleteMany({ slug: new RegExp(rand) });
  });

  // TEST 1: Superadmin can retrieve complete return detail
  test("Scenario 1: Superadmin can retrieve a complete return detail via GET /returns/admin/:id", async () => {
    const returnNumber = `RET-SA-01-${rand}`.toUpperCase();
    const returnDoc = await ReturnRequest.create({
      returnNumber,
      orderId: orderA._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      vendorIds: [vendorDocA._id],
      type: "return",
      status: "requested",
      reason: "defective_product",
      customerComments: "Audio drivers crackle in left earbud on high volume",
      customerNotes: "Audio drivers crackle in left earbud on high volume",
      refundAmount: mongoose.Types.Decimal128.fromString("2224.00"),
      taxRefundTotal: mongoose.Types.Decimal128.fromString("324.00"),
      shippingRefundTotal: mongoose.Types.Decimal128.fromString("100.00"),
      items: [
        {
          productId: productA._id,
          productVariantId: variantA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("2000.00"),
          originalUnitPrice: mongoose.Types.Decimal128.fromString("2000.00"),
          allocatedDiscount: mongoose.Types.Decimal128.fromString("200.00"),
          taxRefund: mongoose.Types.Decimal128.fromString("324.00"),
          shippingRefund: mongoose.Types.Decimal128.fromString("100.00"),
          customerPaidAmount: mongoose.Types.Decimal128.fromString("1800.00"),
          reason: "defective_product",
          customerComments: "Audio drivers crackle in left earbud on high volume",
          vendorId: vendorDocA._id,
          condition: "opened_unused",
        },
      ],
      images: [{ url: "https://cdn.buybox.local/evidence1.jpg" }],
      timeline: [
        {
          status: "requested",
          notes: "Customer filed RMA for defective audio unit",
          timestamp: new Date(),
          actor: { actorType: "customer", actorId: customerUser._id },
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/returns/admin/${returnDoc._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.returnNumber).toBe(returnNumber);
    expect(data.customerInformation).toBeDefined();
    expect(data.refundBreakdown).toBeDefined();
    expect(data.financialSummary).toBeDefined();
    expect(data.vendor).toBeDefined();
    expect(data.vendor.storeName).toBe(vendorDocA.businessName);
    expect(data.vendorStatus).toBe("active");
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBe(1);
    expect(Array.isArray(data.timeline)).toBe(true);
    expect(data.timeline.length).toBeGreaterThanOrEqual(1);
  });

  // TEST 2: Structured customer reason is displayed correctly
  test("Scenario 2: Structured customer reason is formatted with canonical label", async () => {
    const returnNumber = `RET-SA-02-${rand}`.toUpperCase();
    const returnDoc = await ReturnRequest.create({
      returnNumber,
      orderId: orderA._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      type: "return",
      status: "requested",
      reason: "damaged_item",
      items: [
        {
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("2000.00"),
          reason: "damaged_item",
          vendorId: vendorDocA._id,
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/returns/admin/${returnDoc._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const custInfo = res.body.data.customerInformation;
    expect(custInfo.selectedReason).toBe("damaged_item");
    expect(custInfo.selectedReasonLabel).toBe("Damaged Item (Damaged in transit / packaging broken)");
  });

  // TEST 3: Legacy reason aliases resolve correctly
  test("Scenario 3: Legacy reason aliases resolve backward-compatibly", async () => {
    const returnNumber = `RET-SA-03-${rand}`.toUpperCase();
    const returnDoc = await ReturnRequest.create({
      returnNumber,
      orderId: orderA._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      type: "return",
      status: "requested",
      reason: "buyer_remorse",
      items: [
        {
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("2000.00"),
          reason: "buyer_remorse",
          vendorId: vendorDocA._id,
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/returns/admin/${returnDoc._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const custInfo = res.body.data.customerInformation;
    expect(custInfo.selectedReason).toBe("buyer_remorse");
    expect(custInfo.selectedReasonLabel).toBe("Changed Mind / Don't want product anymore");
  });

  // TEST 4: Customer comments remain separate
  test("Scenario 4: Customer comments remain strictly isolated from reason taxonomy", async () => {
    const customComments = "Packaging arrived torn and serial number label was scratched off";
    const returnNumber = `RET-SA-04-${rand}`.toUpperCase();
    const returnDoc = await ReturnRequest.create({
      returnNumber,
      orderId: orderA._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      type: "return",
      status: "requested",
      reason: "damaged_packaging",
      customerComments: customComments,
      customerNotes: customComments,
      items: [
        {
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("2000.00"),
          reason: "damaged_packaging",
          customerComments: customComments,
          vendorId: vendorDocA._id,
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/returns/admin/${returnDoc._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const custInfo = res.body.data.customerInformation;
    expect(custInfo.customerComments).toBe(customComments);
    expect(custInfo.selectedReason).toBe("damaged_packaging");
  });

  // TEST 5: Customer evidence photographs are returned properly
  test("Scenario 5: Customer evidence defect gallery is returned with URLs", async () => {
    const returnNumber = `RET-SA-05-${rand}`.toUpperCase();
    const photos = ["https://cdn.buybox.local/evidence_sa1.jpg", "https://cdn.buybox.local/evidence_sa2.jpg"];
    const returnDoc = await ReturnRequest.create({
      returnNumber,
      orderId: orderA._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      type: "return",
      status: "requested",
      reason: "quality_issue",
      images: photos.map((url) => ({ url })),
      items: [
        {
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("2000.00"),
          reason: "quality_issue",
          vendorId: vendorDocA._id,
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/returns/admin/${returnDoc._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const evidence = res.body.data.customerInformation.evidenceImages;
    expect(Array.isArray(evidence)).toBe(true);
    expect(evidence.length).toBe(2);
  });

  // TEST 6: Refund breakdown matches authoritative financial formula
  test("Scenario 6: 5-pillar refund breakdown matches backend calculation engine", async () => {
    const returnNumber = `RET-SA-06-${rand}`.toUpperCase();
    const returnDoc = await ReturnRequest.create({
      returnNumber,
      orderId: orderA._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      type: "return",
      status: "requested",
      reason: "wrong_item",
      refundAmount: mongoose.Types.Decimal128.fromString("2224.00"),
      netItemRefundTotal: mongoose.Types.Decimal128.fromString("1800.00"),
      taxRefundTotal: mongoose.Types.Decimal128.fromString("324.00"),
      shippingRefundTotal: mongoose.Types.Decimal128.fromString("100.00"),
      customerDeductionsTotal: mongoose.Types.Decimal128.fromString("0.00"),
      discountDeductedTotal: mongoose.Types.Decimal128.fromString("200.00"),
      items: [
        {
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("2000.00"),
          originalUnitPrice: mongoose.Types.Decimal128.fromString("2000.00"),
          allocatedDiscount: mongoose.Types.Decimal128.fromString("200.00"),
          taxRefund: mongoose.Types.Decimal128.fromString("324.00"),
          shippingRefund: mongoose.Types.Decimal128.fromString("100.00"),
          customerPaidAmount: mongoose.Types.Decimal128.fromString("1800.00"),
          reason: "wrong_item",
          vendorId: vendorDocA._id,
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/returns/admin/${returnDoc._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const breakdown = res.body.data.refundBreakdown;
    expect(Number(breakdown.productRefund.customerPaidAmount)).toBe(1800.00);
    expect(Number(breakdown.taxRefund.refundableTax)).toBe(324.00);
    expect(Number(breakdown.shippingRefund.refundableShipping)).toBe(100.00);
    expect(Number(breakdown.deductions.amount)).toBe(0.00);
    expect(Number(breakdown.finalRefund.netRefundableAmount)).toBe(2224.00);
  });

  // TEST 7: GST tax breakdown components
  test("Scenario 7: GST reversal calculations provide itemized tax components", async () => {
    const returnNumber = `RET-SA-07-${rand}`.toUpperCase();
    const returnDoc = await ReturnRequest.create({
      returnNumber,
      orderId: orderA._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      type: "return",
      status: "requested",
      reason: "defective_product",
      refundAmount: mongoose.Types.Decimal128.fromString("2124.00"),
      taxRefundTotal: mongoose.Types.Decimal128.fromString("324.00"),
      items: [
        {
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("1800.00"),
          taxRefund: mongoose.Types.Decimal128.fromString("324.00"),
          taxBreakdown: {
            taxRate: mongoose.Types.Decimal128.fromString("18.00"),
            cgst: mongoose.Types.Decimal128.fromString("162.00"),
            sgst: mongoose.Types.Decimal128.fromString("162.00"),
            igst: mongoose.Types.Decimal128.fromString("0.00"),
          },
          reason: "defective_product",
          vendorId: vendorDocA._id,
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/returns/admin/${returnDoc._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const taxRefund = res.body.data.refundBreakdown.taxRefund;
    expect(Number(taxRefund.cgst)).toBe(162.00);
    expect(Number(taxRefund.sgst)).toBe(162.00);
    expect(Number(taxRefund.refundableTax)).toBe(324.00);
  });

  // TEST 8: Shipping refund remorse policy
  test("Scenario 8: Outbound shipping fee is non-refundable for remorse returns", async () => {
    const returnNumber = `RET-SA-08-${rand}`.toUpperCase();
    const returnDoc = await ReturnRequest.create({
      returnNumber,
      orderId: orderA._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      type: "return",
      status: "requested",
      reason: "changed_mind",
      refundAmount: mongoose.Types.Decimal128.fromString("2124.00"),
      shippingRefundTotal: mongoose.Types.Decimal128.fromString("0.00"),
      items: [
        {
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("1800.00"),
          taxRefund: mongoose.Types.Decimal128.fromString("324.00"),
          shippingRefund: mongoose.Types.Decimal128.fromString("0.00"),
          reason: "changed_mind",
          vendorId: vendorDocA._id,
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/returns/admin/${returnDoc._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const shipping = res.body.data.refundBreakdown.shippingRefund;
    expect(Number(shipping.refundableShipping)).toBe(0.00);
    expect(shipping.isEligible).toBe(false);
  });

  // TEST 9: Previous refunds are accounted for correctly
  test("Scenario 9: Previous refunds are deducted from customer entitlement", async () => {
    const returnNumber = `RET-SA-09-${rand}`.toUpperCase();
    const returnDoc = await ReturnRequest.create({
      returnNumber,
      orderId: orderA._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      type: "return",
      status: "requested",
      reason: "defective_product",
      refundAmount: mongoose.Types.Decimal128.fromString("1724.00"),
      previouslyRefundedTotal: mongoose.Types.Decimal128.fromString("500.00"),
      items: [
        {
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("2000.00"),
          customerPaidAmount: mongoose.Types.Decimal128.fromString("1800.00"),
          taxRefund: mongoose.Types.Decimal128.fromString("324.00"),
          shippingRefund: mongoose.Types.Decimal128.fromString("100.00"),
          reason: "defective_product",
          vendorId: vendorDocA._id,
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/returns/admin/${returnDoc._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const finalRefund = res.body.data.refundBreakdown.finalRefund;
    expect(Number(finalRefund.previouslyRefunded)).toBe(500.00);
  });

  // TEST 10: Permitted deduction validation (rejects excessive deductions)
  test("Scenario 10: Excessive inspection deductions are rejected with HTTP 400", async () => {
    const returnNumber = `RET-SA-10-${rand}`.toUpperCase();
    const returnDoc = await ReturnRequest.create({
      returnNumber,
      orderId: orderA._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      type: "return",
      status: "picked_up",
      reason: "defective_product",
      refundAmount: mongoose.Types.Decimal128.fromString("2224.00"),
      items: [
        {
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("1800.00"),
          taxRefund: mongoose.Types.Decimal128.fromString("324.00"),
          shippingRefund: mongoose.Types.Decimal128.fromString("100.00"),
          customerPaidAmount: mongoose.Types.Decimal128.fromString("1800.00"),
          reason: "defective_product",
          vendorId: vendorDocA._id,
        },
      ],
    });

    const res = await request(app)
      .post(`/api/v1/returns/admin/${returnDoc._id}/inspect`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({
        outcome: "failed",
        condition: "damaged",
        deductionAmount: 5000.00, // Exceeds 2224.00
        deductionCategory: "customer_damage",
        deductionReason: "Product completely wrecked",
        notes: "Excessive penalty test",
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("EXCESSIVE_DEDUCTION");
  });

  // TEST 11: Superadmin inspection persists correctly
  test("Scenario 11: Superadmin technical inspection persists subdocument and updates status", async () => {
    const returnNumber = `RET-SA-11-${rand}`.toUpperCase();
    const returnDoc = await ReturnRequest.create({
      returnNumber,
      orderId: orderA._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      type: "return",
      status: "picked_up",
      reason: "defective_product",
      refundAmount: mongoose.Types.Decimal128.fromString("2224.00"),
      items: [
        {
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("1800.00"),
          taxRefund: mongoose.Types.Decimal128.fromString("324.00"),
          shippingRefund: mongoose.Types.Decimal128.fromString("100.00"),
          customerPaidAmount: mongoose.Types.Decimal128.fromString("1800.00"),
          reason: "defective_product",
          vendorId: vendorDocA._id,
        },
      ],
    });

    const res = await request(app)
      .post(`/api/v1/returns/admin/${returnDoc._id}/inspect`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({
        outcome: "passed",
        condition: "opened_unused",
        packagingCondition: "opened",
        productCondition: "like_new",
        missingAccessories: true,
        missingAccessoriesNotes: "Charging cable missing from box",
        deductionAmount: 200.00,
        deductionCategory: "missing_accessories",
        deductionReason: "Missing standard USB-C cable",
        notes: "Superadmin inspection performed at central depot",
      });

    expect(res.status).toBe(200);
    const updated = await ReturnRequest.findById(returnDoc._id).lean();
    expect(updated.status).toBe("inspected");
    expect(updated.inspection.missingAccessories).toBe(true);
    expect(updated.inspection.missingAccessoriesNotes).toBe("Charging cable missing from box");
    expect(Number(updated.customerDeductionsTotal.toString())).toBe(200.00);
    expect(Number(updated.refundAmount.toString())).toBe(2024.00);
  });

  // TEST 12: Customer claims remain immutable
  test("Scenario 12: Customer claim and comments remain strictly immutable after admin inspection", async () => {
    const returnNumber = `RET-SA-12-${rand}`.toUpperCase();
    const originalReason = "defective_product";
    const originalComments = "Left audio driver completely dead on unboxing";

    const returnDoc = await ReturnRequest.create({
      returnNumber,
      orderId: orderA._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      type: "return",
      status: "picked_up",
      reason: originalReason,
      customerComments: originalComments,
      customerNotes: originalComments,
      refundAmount: mongoose.Types.Decimal128.fromString("2224.00"),
      items: [
        {
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("1800.00"),
          customerPaidAmount: mongoose.Types.Decimal128.fromString("1800.00"),
          reason: originalReason,
          customerComments: originalComments,
          vendorId: vendorDocA._id,
        },
      ],
    });

    await request(app)
      .post(`/api/v1/returns/admin/${returnDoc._id}/inspect`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({
        outcome: "failed",
        condition: "damaged",
        notes: "Admin observed physical impact marks on housing",
      });

    const refreshed = await ReturnRequest.findById(returnDoc._id).lean();
    expect(refreshed.reason).toBe(originalReason);
    expect(refreshed.customerComments).toBe(originalComments);
    expect(refreshed.items[0].reason).toBe(originalReason);
    expect(refreshed.items[0].customerComments).toBe(originalComments);
  });

  // TEST 13: Merchant can only access its own return
  test("Scenario 13: Merchant tenant isolation is enforced (Vendor B cannot access Vendor A returns)", async () => {
    const returnNumber = `RET-SA-13-${rand}`.toUpperCase();
    const returnDoc = await ReturnRequest.create({
      returnNumber,
      orderId: orderA._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      vendorIds: [vendorDocA._id],
      type: "return",
      status: "requested",
      reason: "wrong_item",
      items: [
        {
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("2000.00"),
          reason: "wrong_item",
          vendorId: vendorDocA._id,
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/returns/vendor/my/${returnDoc._id}`)
      .set("Authorization", `Bearer ${vendorTokenB}`);

    expect(res.status).toBe(403);
  });

  // TEST 14: Superadmin can access returns belonging to different vendors
  test("Scenario 14: Superadmin can access returns belonging to different vendors across marketplace", async () => {
    const returnNumberA = `RET-SA-14A-${rand}`.toUpperCase();
    const returnDocA = await ReturnRequest.create({
      returnNumber: returnNumberA,
      orderId: orderA._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      type: "return",
      status: "requested",
      reason: "damaged_item",
      items: [
        {
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("2000.00"),
          reason: "damaged_item",
          vendorId: vendorDocA._id,
        },
      ],
    });

    const returnNumberB = `RET-SA-14B-${rand}`.toUpperCase();
    const returnDocB = await ReturnRequest.create({
      returnNumber: returnNumberB,
      orderId: orderMultiVendor._id,
      customerId: customerDoc._id,
      vendorId: vendorDocB._id,
      type: "return",
      status: "requested",
      reason: "wrong_item",
      items: [
        {
          productId: productB._id,
          sku: variantB.sku,
          name: productB.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("1200.00"),
          reason: "wrong_item",
          vendorId: vendorDocB._id,
        },
      ],
    });

    const resA = await request(app)
      .get(`/api/v1/returns/admin/${returnDocA._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);
    expect(resA.status).toBe(200);
    expect(resA.body.data.vendor.storeName).toBe(vendorDocA.businessName);

    const resB = await request(app)
      .get(`/api/v1/returns/admin/${returnDocB._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);
    expect(resB.status).toBe(200);
    expect(resB.body.data.vendor.storeName).toBe(vendorDocB.businessName);
  });

  // TEST 15: Unauthorized users cannot access administrative actions
  test("Scenario 15: Non-admin users cannot access administrative return endpoints", async () => {
    const returnNumber = `RET-SA-15-${rand}`.toUpperCase();
    const returnDoc = await ReturnRequest.create({
      returnNumber,
      orderId: orderA._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      type: "return",
      status: "requested",
      reason: "wrong_item",
      items: [
        {
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("2000.00"),
          reason: "wrong_item",
          vendorId: vendorDocA._id,
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/returns/admin/${returnDoc._id}`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect([401, 403]).toContain(res.status);
  });

  // TEST 16: Merchant-unavailable intervention works through authorized workflows
  test("Scenario 16: Superadmin can inspect & approve returns when merchant is suspended", async () => {
    const returnNumber = `RET-SA-16-${rand}`.toUpperCase();
    const returnDoc = await ReturnRequest.create({
      returnNumber,
      orderId: orderSuspended._id,
      customerId: customerDoc._id,
      vendorId: vendorDocSuspended._id,
      vendorIds: [vendorDocSuspended._id],
      type: "return",
      status: "requested",
      reason: "defective_product",
      customerComments: "Powerbank overheats severely while charging",
      refundAmount: mongoose.Types.Decimal128.fromString("994.00"),
      items: [
        {
          productId: productSuspended._id,
          sku: variantSuspended.sku,
          name: productSuspended.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("800.00"),
          taxRefund: mongoose.Types.Decimal128.fromString("144.00"),
          shippingRefund: mongoose.Types.Decimal128.fromString("50.00"),
          customerPaidAmount: mongoose.Types.Decimal128.fromString("800.00"),
          reason: "defective_product",
          vendorId: vendorDocSuspended._id,
        },
      ],
    });

    // 1. Fetch return - asserts vendor status is "suspended"
    const detailRes = await request(app)
      .get(`/api/v1/returns/admin/${returnDoc._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.vendorStatus).toBe("suspended");

    // 2. Superadmin approves on behalf of suspended vendor
    const approveRes = await request(app)
      .post(`/api/v1/returns/admin/${returnDoc._id}/approve`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ notes: "Superadmin approval due to merchant suspension" });
    expect(approveRes.status).toBe(200);

    const refreshed = await ReturnRequest.findById(returnDoc._id).lean();
    expect(refreshed.status).toBe("approved");
  });

  // TEST 17: Duplicate refund requests remain idempotent
  test("Scenario 17: Duplicate refund executions remain strictly idempotent", async () => {
    const returnNumber = `RET-SA-17-${rand}`.toUpperCase();
    const returnDoc = await ReturnRequest.create({
      returnNumber,
      orderId: orderA._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      type: "return",
      status: "refunded",
      reason: "defective_product",
      refundAmount: mongoose.Types.Decimal128.fromString("2224.00"),
      items: [
        {
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("2000.00"),
          reason: "defective_product",
          vendorId: vendorDocA._id,
        },
      ],
    });

    const res = await request(app)
      .post(`/api/v1/returns/admin/${returnDoc._id}/refund`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ notes: "Attempt duplicate refund disbursement" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("refunded");
  });

  // TEST 18: Failed gateway refunds cannot be falsely marked processed
  test("Scenario 18: Incomplete/failed refunds resolve to failed or initiated lifecycle status", async () => {
    const returnNumber = `RET-SA-18-${rand}`.toUpperCase();
    const returnDoc = await ReturnRequest.create({
      returnNumber,
      orderId: orderA._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      type: "return",
      status: "refund_pending",
      reason: "wrong_item",
      refundAmount: mongoose.Types.Decimal128.fromString("2224.00"),
      items: [
        {
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("2000.00"),
          reason: "wrong_item",
          vendorId: vendorDocA._id,
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/returns/admin/${returnDoc._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.refundBreakdown.finalRefund.status).toBe("initiated");
  });

  // TEST 19: Administrative override records actor and reason
  test("Scenario 19: Superadmin action records admin actor identity and mandatory notes in audit timeline", async () => {
    const returnNumber = `RET-SA-19-${rand}`.toUpperCase();
    const adminNote = "Special executive intervention: order damaged in courier transit";
    const returnDoc = await ReturnRequest.create({
      returnNumber,
      orderId: orderA._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      type: "return",
      status: "requested",
      reason: "damaged_item",
      items: [
        {
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("2000.00"),
          reason: "damaged_item",
          vendorId: vendorDocA._id,
        },
      ],
    });

    const res = await request(app)
      .post(`/api/v1/returns/admin/${returnDoc._id}/approve`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ notes: adminNote });

    expect(res.status).toBe(200);
    const updated = await ReturnRequest.findById(returnDoc._id).lean();
    const lastEvent = updated.timeline[updated.timeline.length - 1];
    expect(lastEvent.actor.actorType).toBe("admin");
    expect(lastEvent.notes).toContain(adminNote);
  });

  // TEST 20: Complete activity history reflects the correct lifecycle
  test("Scenario 20: Activity timeline records sequential lifecycle events", async () => {
    const returnNumber = `RET-SA-20-${rand}`.toUpperCase();
    const returnDoc = await ReturnRequest.create({
      returnNumber,
      orderId: orderA._id,
      customerId: customerDoc._id,
      vendorId: vendorDocA._id,
      type: "return",
      status: "requested",
      reason: "defective_product",
      timeline: [
        {
          status: "requested",
          notes: "Customer filed return request",
          timestamp: new Date(Date.now() - 3600000),
          actor: { actorType: "customer", actorId: customerUser._id },
        },
      ],
      items: [
        {
          productId: productA._id,
          sku: variantA.sku,
          name: productA.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("2000.00"),
          reason: "defective_product",
          vendorId: vendorDocA._id,
        },
      ],
    });

    // 1. Approve
    await request(app)
      .post(`/api/v1/returns/admin/${returnDoc._id}/approve`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ notes: "Approved by Superadmin" });

    // 2. Fetch Detail
    const res = await request(app)
      .get(`/api/v1/returns/admin/${returnDoc._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const timeline = res.body.data.timeline;
    expect(timeline.length).toBeGreaterThanOrEqual(2);
    expect(timeline[0].status).toBe("requested");
    expect(timeline[1].status).toBe("approved");
    expect(timeline[1].actor.actorType).toBe("admin");
  });
});
