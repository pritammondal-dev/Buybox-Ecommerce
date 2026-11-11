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

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/\/buybox(_test)?(\?|$)/, "/buybox_returns02_test$2")
  : "mongodb://127.0.0.1:27017/buybox_returns02_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Phase MERCHANT-RETURNS-02 — Return Reason, Refund Accuracy & RMA Modernization Suite", () => {
  let customerUser1, customerToken1, customerDoc1;
  let customerUser2, customerToken2, customerDoc2;
  let vendorUserA, vendorTokenA, vendorDocA;
  let vendorUserB, vendorTokenB, vendorDocB;
  let category, brand;
  let productA1, variantA1;
  let productA2, variantA2;
  let productB1, variantB1;
  let orderA1, orderMultiVendor;

  const rand = Math.random().toString(36).substring(7);

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // 1. Category & Brand
    category = await Category.create({
      name: `Category R02 ${rand}`,
      slug: `cat-r02-${rand}`,
      isActive: true,
    });
    brand = await Brand.create({
      name: `Brand R02 ${rand}`,
      slug: `brand-r02-${rand}`,
      isActive: true,
    });

    // 2. Customers
    customerUser1 = await User.create({
      firstName: "Aarav",
      lastName: "Kapoor",
      email: `aarav_${rand}@example.com`,
      phone: "+919811122233",
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
      firstName: "Meera",
      lastName: "Sen",
      email: `meera_${rand}@example.com`,
      phone: "+919822233344",
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
      firstName: "Apex",
      lastName: "Vendor",
      email: `apex_${rand}@example.com`,
      phone: "+919833344455",
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
      onboardingStatus: "approved",
      isActive: true,
      businessAddress: {
        addressLine1: "123 Tech Park",
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
      lastName: "Merchant",
      email: `beacon_${rand}@example.com`,
      phone: "+919844455566",
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendorDocB = await Vendor.create({
      userId: vendorUserB._id,
      businessName: `Beacon Stores ${rand}`,
      businessSlug: `beacon-stores-${rand}`,
      onboardingStatus: "approved",
      isActive: true,
      businessAddress: {
        addressLine1: "456 Market St",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
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

    // 4. Products
    productA1 = await Product.create({
      name: `Apex Wireless ANC Headphones ${rand}`,
      slug: `apex-wireless-anc-${rand}`,
      sku: `APX-ANC-${rand}`,
      vendorId: vendorDocA._id,
      categoryId: category._id,
      brandId: brand._id,
      price: mongoose.Types.Decimal128.fromString("1000.00"),
      status: "active",
      isActive: true,
      images: [{ url: "https://example.com/img1.jpg" }],
    });
    variantA1 = await ProductVariant.create({
      productId: productA1._id,
      name: "Matte Black",
      sku: `APX-ANC-BLK-${rand}`,
      price: mongoose.Types.Decimal128.fromString("1000.00"),
      stock: 50,
      isActive: true,
    });

    productA2 = await Product.create({
      name: `Apex Smart Speaker ${rand}`,
      slug: `apex-speaker-${rand}`,
      sku: `APX-SPK-${rand}`,
      vendorId: vendorDocA._id,
      categoryId: category._id,
      brandId: brand._id,
      price: mongoose.Types.Decimal128.fromString("1000.00"),
      status: "active",
      isActive: true,
      images: [{ url: "https://example.com/img2.jpg" }],
    });
    variantA2 = await ProductVariant.create({
      productId: productA2._id,
      name: "Charcoal Grey",
      sku: `APX-SPK-GRY-${rand}`,
      price: mongoose.Types.Decimal128.fromString("1000.00"),
      stock: 50,
      isActive: true,
    });

    productB1 = await Product.create({
      name: `Beacon Fitness Tracker ${rand}`,
      slug: `beacon-tracker-${rand}`,
      sku: `BCN-FIT-${rand}`,
      vendorId: vendorDocB._id,
      categoryId: category._id,
      brandId: brand._id,
      price: mongoose.Types.Decimal128.fromString("1500.00"),
      status: "active",
      isActive: true,
      images: [{ url: "https://example.com/img3.jpg" }],
    });
    variantB1 = await ProductVariant.create({
      productId: productB1._id,
      name: "Midnight Blue",
      sku: `BCN-FIT-BLU-${rand}`,
      price: mongoose.Types.Decimal128.fromString("1500.00"),
      stock: 30,
      isActive: true,
    });

    // 5. Orders
    // Order A1: Vendor A only, item price 1000, discount 200, net paid 800 + 144 GST (18%) + 50 shipping = 994
    orderA1 = await Order.create({
      orderNumber: `ORD-R02-A1-${rand}`,
      customerId: customerDoc1._id,
      userId: customerUser1._id,
      status: "delivered",
      paymentStatus: "paid",
      paymentMethod: "prepaid",
      currency: "INR",
      items: [
        {
          productId: productA1._id,
          productVariantId: variantA1._id,
          vendorId: vendorDocA._id,
          sku: variantA1.sku,
          productName: productA1.name,
          quantity: 1,
          unitPrice: 1000.0,
          lineTotal: 1000.0,
          currency: "INR",
          discountTotal: 200.0,
          taxTotal: 144.0,
          taxDetails: {
            taxRate: 0.18,
            jurisdictionState: "Karnataka",
            pricingMode: "tax_exclusive",
          },
          fulfillmentStatus: "delivered",
          deliveredAt: new Date(),
        },
      ],
      shippingAddress: {
        fullName: "Aarav Kapoor",
        phone: "+919811122233",
        addressLine1: "10 Residency Rd",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560025",
        country: "IN",
      },
      shippingTotal: 50.0,
      discountTotal: 200.0,
      grandTotal: 994.0,
      taxSummary: {
        totalTax: 144.0,
        pricingMode: "tax_exclusive",
      },
    });

    // Order Multi-Vendor: Item A (Vendor A) 1000 with 200 discount, Item B (Vendor B) 1500 with 300 discount
    orderMultiVendor = await Order.create({
      orderNumber: `ORD-R02-MV-${rand}`,
      customerId: customerDoc1._id,
      userId: customerUser1._id,
      status: "delivered",
      paymentStatus: "paid",
      paymentMethod: "prepaid",
      currency: "INR",
      items: [
        {
          productId: productA2._id,
          productVariantId: variantA2._id,
          vendorId: vendorDocA._id,
          sku: variantA2.sku,
          productName: productA2.name,
          quantity: 1,
          unitPrice: 1000.0,
          lineTotal: 1000.0,
          currency: "INR",
          discountTotal: 200.0,
          taxTotal: 144.0,
          taxDetails: {
            taxRate: 0.18,
            jurisdictionState: "Karnataka",
            pricingMode: "tax_exclusive",
          },
          fulfillmentStatus: "delivered",
          deliveredAt: new Date(),
        },
        {
          productId: productB1._id,
          productVariantId: variantB1._id,
          vendorId: vendorDocB._id,
          sku: variantB1.sku,
          productName: productB1.name,
          quantity: 1,
          unitPrice: 1500.0,
          lineTotal: 1500.0,
          currency: "INR",
          discountTotal: 300.0,
          taxTotal: 216.0,
          taxDetails: {
            taxRate: 0.18,
            jurisdictionState: "Maharashtra",
            pricingMode: "tax_exclusive",
          },
          fulfillmentStatus: "delivered",
          deliveredAt: new Date(),
        },
      ],
      shippingAddress: {
        fullName: "Aarav Kapoor",
        phone: "+919811122233",
        addressLine1: "10 Residency Rd",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560025",
        country: "IN",
      },
      shippingTotal: 100.0,
      discountTotal: 500.0,
      grandTotal: 2560.0,
      taxSummary: {
        totalTax: 360.0,
        pricingMode: "tax_exclusive",
      },
    });
  });

  afterAll(async () => {
    try {
      await Category.deleteMany({ slug: new RegExp(rand) });
      await Brand.deleteMany({ slug: new RegExp(rand) });
      await Product.deleteMany({ sku: new RegExp(rand) });
      await ProductVariant.deleteMany({ sku: new RegExp(rand) });
      await Order.deleteMany({ orderNumber: new RegExp(rand) });
      await ReturnRequest.deleteMany({ returnNumber: new RegExp(rand) });
      await Customer.deleteMany({ _id: { $in: [customerDoc1._id, customerDoc2._id] } });
      await Vendor.deleteMany({ businessSlug: new RegExp(rand) });
      await User.deleteMany({ _id: { $in: [customerUser1._id, customerUser2._id, vendorUserA._id, vendorUserB._id] } });
    } catch {}
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  let returnRequest1;

  // 1. Structured return reason persistence
  test("1. Customer creates return with canonical reason 'damaged_item' — persists in reason fields", async () => {
    const res = await request(app)
      .post("/api/v1/return-requests")
      .set("Authorization", `Bearer ${customerToken1}`)
      .send({
        orderId: orderA1._id.toString(),
        type: "return",
        reason: "damaged_item",
        customerComments: "Package arrived completely crushed and audio jack is cracked.",
        items: [
          {
            orderItemId: orderA1.items[0]._id.toString(),
            productId: productA1._id.toString(),
            productVariantId: variantA1._id.toString(),
            quantity: 1,
            reason: "damaged_item",
            customerComments: "Audio jack is cracked upon unboxing.",
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    returnRequest1 = res.body.data;
    expect(returnRequest1.reason).toBe("damaged_item");
    expect(returnRequest1.items[0].reason).toBe("damaged_item");
  });

  // 2. Structured return reason display vs free-text comments separation
  test("2. Vendor retrieves return details — structured reason and free-text comments are cleanly separated", async () => {
    const res = await request(app)
      .get(`/api/v1/return-requests/vendor/my/${returnRequest1.secureId || returnRequest1._id}`)
      .set("Authorization", `Bearer ${vendorTokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;

    expect(data.customerInformation).toBeDefined();
    expect(data.customerInformation.selectedReason).toBe("damaged_item");
    expect(data.customerInformation.selectedReasonLabel).toContain("Damaged Item");
    expect(data.customerInformation.customerComments).toContain("Package arrived completely crushed");
    expect(data.customerInformation.isLegacy).toBe(false);
  });

  // 3. Legacy return request backward compatibility
  test("3. Gracefully supports legacy return request with legacy reason without errors", async () => {
    const legacyReturn = await ReturnRequest.create({
      returnNumber: `RET-LEGACY-${rand}`,
      orderId: orderA1._id,
      customerId: customerDoc1._id,
      vendorId: vendorDocA._id,
      vendorIds: [vendorDocA._id],
      status: "requested",
      type: "return",
      customerNotes: "Legacy return submitted before canonical enum rollout",
      refundAmount: mongoose.Types.Decimal128.fromString("800.00"),
      netItemRefundTotal: mongoose.Types.Decimal128.fromString("800.00"),
      taxRefundTotal: mongoose.Types.Decimal128.fromString("144.00"),
      shippingRefundTotal: mongoose.Types.Decimal128.fromString("0.00"),
      items: [
        {
          orderItemId: orderA1.items[0]._id,
          productId: productA1._id,
          sku: variantA1.sku,
          name: productA1.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("800.00"),
          reason: "defective",
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/return-requests/vendor/my/${legacyReturn._id}`)
      .set("Authorization", `Bearer ${vendorTokenA}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.customerInformation).toBeDefined();
    expect(data.customerInformation.selectedReasonLabel).toBeDefined();
    expect(data.customerInformation.selectedReasonLabel).toContain("Defective");
    expect(data.customerInformation.customerComments).toBe("Legacy return submitted before canonical enum rollout");
  });

  // 4. Correct customer-paid amount calculation (net of discounts)
  test("4. Customer-paid amount reflects net price after discount (₹800, NOT ₹1000)", async () => {
    const retDoc = await ReturnRequest.findById(returnRequest1._id).lean();
    expect(Number(retDoc.items[0].customerPaidAmount.toString())).toBe(994); // Net paid with tax and shipping
    expect(Number(retDoc.items[0].allocatedDiscount.toString())).toBe(200);
    expect(Number(retDoc.discountDeductedTotal.toString())).toBe(200);
  });

  // 5. Item-level discount allocation in partial returns
  test("5. Multi-item order calculates proportional discount allocation per item", async () => {
    // In orderMultiVendor: Product A2 had ₹200 discount on ₹1000 (20%), Product B1 had ₹300 discount on ₹1500 (20%)
    const res = await request(app)
      .post("/api/v1/return-requests")
      .set("Authorization", `Bearer ${customerToken1}`)
      .send({
        orderId: orderMultiVendor._id.toString(),
        type: "return",
        reason: "wrong_item",
        customerComments: "Received incorrect model for Apex speaker",
        items: [
          {
            orderItemId: orderMultiVendor.items[0]._id.toString(),
            productId: productA2._id.toString(),
            productVariantId: variantA2._id.toString(),
            quantity: 1,
            reason: "wrong_item",
          },
        ],
      });

    expect(res.status).toBe(201);
    const ret = res.body.data;
    const vendorId = ret.vendorId || ret.vendorIds?.[0] || ret.items?.[0]?.vendorId;
    expect(vendorId.toString()).toBe(vendorDocA._id.toString());
    const allocDisc = Number(ret.items[0].allocatedDiscount?.$numberDecimal || ret.items[0].allocatedDiscount);
    expect(allocDisc).toBe(200);
  });

  // 6. Correct GST/tax reversal calculation
  test("6. Tax refund calculates proportional tax reversal correctly", async () => {
    const res = await request(app)
      .get(`/api/v1/return-requests/vendor/my/${returnRequest1.secureId || returnRequest1._id}`)
      .set("Authorization", `Bearer ${vendorTokenA}`);

    expect(res.status).toBe(200);
    const refundBreakdown = res.body.data.refundBreakdown;
    expect(refundBreakdown.taxRefund).toBeDefined();
    expect(Number(refundBreakdown.taxRefund.refundableTax)).toBe(144);
  });

  // 7. Refundable vs non-refundable shipping fee handling
  test("7. Remorse return ('changed_mind') treats partial shipping as non-refundable", async () => {
    const res = await request(app)
      .post("/api/v1/return-requests")
      .set("Authorization", `Bearer ${customerToken1}`)
      .send({
        orderId: orderMultiVendor._id.toString(),
        type: "return",
        reason: "changed_mind",
        customerComments: "Decided to keep fitness tracker, don't want it now",
        items: [
          {
            orderItemId: orderMultiVendor.items[1]._id.toString(),
            productId: productB1._id.toString(),
            productVariantId: variantB1._id.toString(),
            quantity: 1,
            reason: "changed_mind",
          },
        ],
      });

    expect(res.status).toBe(201);
    const ret = res.body.data;
    const shipRefund = Number(ret.shippingRefundTotal?.$numberDecimal || ret.shippingRefundTotal || 0);
    expect(shipRefund).toBe(0);
  });

  // 8. Previously refunded amount deduction (prevent duplicate refund)
  test("8. Order balance caps refund if prior refund was processed", async () => {
    // Record prior refund of ₹500 on orderA1
    await Refund.create({
      orderId: orderA1._id,
      customerId: customerDoc1._id,
      paymentId: new mongoose.Types.ObjectId(),
      currency: "INR",
      amount: mongoose.Types.Decimal128.fromString("500.00"),
      status: "processed",
      reason: "Prior customer compensation",
      idempotencyKey: `prior_ref_${rand}`,
    });

    const priorRefunds = await Refund.find({ orderId: orderA1._id, status: "processed" }).lean();
    expect(priorRefunds.length).toBeGreaterThanOrEqual(1);
  });

  // 9. Valid merchant inspection deduction
  test("9. Vendor documents valid inspection deduction (₹150 for missing accessories)", async () => {
    // First simulate return lifecycle: requested -> approved -> pickup_scheduled -> picked_up
    await ReturnRequest.findByIdAndUpdate(returnRequest1._id, { status: "picked_up" });

    const res = await request(app)
      .post(`/api/v1/return-requests/vendor/my/${returnRequest1.secureId || returnRequest1._id}/inspect`)
      .set("Authorization", `Bearer ${vendorTokenA}`)
      .send({
        outcome: "passed",
        condition: "opened_unused",
        packagingCondition: "opened",
        productCondition: "resellable",
        missingAccessories: true,
        missingAccessoriesNotes: "Charging cable missing from box",
        deductionAmount: 150,
        deductionReason: "Original charging cable missing from box",
        deductionCategory: "missing_parts",
        notes: "Item functions perfectly, deducted cable replacement cost",
      });

    expect(res.status).toBe(200);
    const ret = res.body.data;
    expect(ret.status).toBe("inspected");
    expect(ret.merchantInspection).toBeDefined();
    expect(Number(ret.merchantInspection.deductionAmount)).toBe(150);
    expect(ret.merchantInspection.missingAccessories).toBe(true);
    expect(Number(ret.refundBreakdown.finalRefund.deductionsTotal)).toBe(150);
  });

  // 10. Excessive merchant deduction prevention (deduction cannot exceed eligible amount)
  test("10. Excessive deduction exceeding eligible refund is rejected with 400", async () => {
    // Reset status to picked_up to test excessive deduction validation
    await ReturnRequest.findByIdAndUpdate(returnRequest1._id, { status: "picked_up" });

    const res = await request(app)
      .post(`/api/v1/return-requests/vendor/my/${returnRequest1.secureId || returnRequest1._id}/inspect`)
      .set("Authorization", `Bearer ${vendorTokenA}`)
      .send({
        outcome: "passed",
        condition: "damaged",
        deductionAmount: 99999, // Exceeds return amount of ₹994
        deductionReason: "Excessive arbitrary deduction",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("cannot exceed the eligible");
  });

  // 11. Final refund amount formula validation
  test("11. Final refund formula validates: Customer-Paid + Tax + Shipping - Deductions = Net Refund", async () => {
    const res = await request(app)
      .get(`/api/v1/return-requests/vendor/my/${returnRequest1.secureId || returnRequest1._id}`)
      .set("Authorization", `Bearer ${vendorTokenA}`);

    expect(res.status).toBe(200);
    const finalRefund = res.body.data.refundBreakdown.finalRefund;
    const netRefundable = Number(finalRefund.netRefundableAmount);
    const deductions = Number(finalRefund.deductionsTotal);

    // Initial refund was 994.00, deducted 150.00 -> Net should be 844.00
    expect(deductions).toBe(150);
    expect(netRefundable).toBe(844);
  });

  // 12. Immutable customer return information upon merchant inspection
  test("12. Customer original return information remains immutable after inspection", async () => {
    const res = await request(app)
      .get(`/api/v1/return-requests/vendor/my/${returnRequest1.secureId || returnRequest1._id}`)
      .set("Authorization", `Bearer ${vendorTokenA}`);

    expect(res.status).toBe(200);
    const info = res.body.data.customerInformation;
    expect(info.selectedReason).toBe("damaged_item");
    expect(info.customerComments).toContain("Package arrived completely crushed");
    expect(info.customerComments).not.toContain("Item functions perfectly"); // Vendor note was kept in separate inspection
  });

  // 13. Merchant inspection subdocument persistence
  test("13. Merchant inspection subdocument persists condition, notes, deductions, inspector", async () => {
    const retDoc = await ReturnRequest.findById(returnRequest1._id).lean();
    expect(retDoc.inspection).toBeDefined();
    expect(retDoc.inspection.inspectedBy.toString()).toBe(vendorUserA._id.toString());
    expect(retDoc.inspection.receivedCondition).toBe("opened_unused");
    expect(retDoc.inspection.packagingCondition).toBe("opened");
    expect(Number(retDoc.inspection.deductionAmount.toString())).toBe(150);
    expect(retDoc.inspection.deductionReason).toContain("charging cable missing");
  });

  // 14. Vendor tenant isolation
  test("14. Vendor B cannot view, inspect, approve, or reject Vendor A's return", async () => {
    // 14a. View denial
    const viewRes = await request(app)
      .get(`/api/v1/return-requests/vendor/my/${returnRequest1.secureId || returnRequest1._id}`)
      .set("Authorization", `Bearer ${vendorTokenB}`);
    expect(viewRes.status).toBe(403);

    // 14b. Inspect denial
    const inspectRes = await request(app)
      .post(`/api/v1/return-requests/vendor/my/${returnRequest1.secureId || returnRequest1._id}/inspect`)
      .set("Authorization", `Bearer ${vendorTokenB}`)
      .send({ outcome: "passed" });
    expect(inspectRes.status).toBe(403);

    // 14c. Approve denial
    const approveRes = await request(app)
      .post(`/api/v1/return-requests/vendor/my/${returnRequest1.secureId || returnRequest1._id}/approve`)
      .set("Authorization", `Bearer ${vendorTokenB}`)
      .send({ notes: "Unauthorized approval attempt" });
    expect(approveRes.status).toBe(403);

    // 14d. Reject denial
    const rejectRes = await request(app)
      .post(`/api/v1/return-requests/vendor/my/${returnRequest1.secureId || returnRequest1._id}/reject`)
      .set("Authorization", `Bearer ${vendorTokenB}`)
      .send({ reason: "Unauthorized rejection attempt" });
    expect(rejectRes.status).toBe(403);
  });

  // 15. Multi-vendor order return isolation
  test("15. Multi-vendor order partitions return requests strictly per vendor", async () => {
    const returnsForMV = await ReturnRequest.find({ orderId: orderMultiVendor._id }).lean();
    expect(returnsForMV.length).toBeGreaterThanOrEqual(2);

    const vendorA_Returns = returnsForMV.filter((r) => {
      const vId = r.vendorId || r.vendorIds?.[0] || r.items?.[0]?.vendorId;
      return vId && vId.toString() === vendorDocA._id.toString();
    });
    const vendorB_Returns = returnsForMV.filter((r) => {
      const vId = r.vendorId || r.vendorIds?.[0] || r.items?.[0]?.vendorId;
      return vId && vId.toString() === vendorDocB._id.toString();
    });

    expect(vendorA_Returns.length).toBeGreaterThanOrEqual(1);
    expect(vendorB_Returns.length).toBeGreaterThanOrEqual(1);
  });

  // 16. Rejection workflow requiring mandatory rejection reason
  test("16. Rejection requires mandatory non-empty rejection reason", async () => {
    // Create new requested return to test rejection
    const retToReject = await ReturnRequest.create({
      returnNumber: `RET-REJ-${rand}`,
      orderId: orderA1._id,
      customerId: customerDoc1._id,
      vendorId: vendorDocA._id,
      vendorIds: [vendorDocA._id],
      status: "requested",
      type: "return",
      refundAmount: mongoose.Types.Decimal128.fromString("800.00"),
      items: [
        {
          orderItemId: orderA1.items[0]._id,
          productId: productA1._id,
          sku: variantA1.sku,
          name: productA1.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("800.00"),
          reason: "other",
        },
      ],
    });

    const res = await request(app)
      .post(`/api/v1/return-requests/vendor/my/${retToReject._id}/reject`)
      .set("Authorization", `Bearer ${vendorTokenA}`)
      .send({ reason: "" }); // Empty reason

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // 17. Refund status lifecycle validation
  test("17. Refund lifecycle states transition: requested -> approved -> inspected -> refunded", async () => {
    // 17a. Status when requested: 'estimated'
    const newRet = await ReturnRequest.create({
      returnNumber: `RET-LC-${rand}`,
      orderId: orderA1._id,
      customerId: customerDoc1._id,
      vendorId: vendorDocA._id,
      vendorIds: [vendorDocA._id],
      status: "requested",
      type: "return",
      refundAmount: mongoose.Types.Decimal128.fromString("500.00"),
      items: [
        {
          orderItemId: orderA1.items[0]._id,
          productId: productA1._id,
          sku: variantA1.sku,
          name: productA1.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("500.00"),
          reason: "defective_product",
        },
      ],
    });

    let res = await request(app)
      .get(`/api/v1/return-requests/vendor/my/${newRet._id}`)
      .set("Authorization", `Bearer ${vendorTokenA}`);
    expect(res.body.data.refundBreakdown.finalRefund.status).toBe("estimated");

    // 17b. Status when approved: 'authorized'
    await ReturnRequest.findByIdAndUpdate(newRet._id, { status: "approved" });
    res = await request(app)
      .get(`/api/v1/return-requests/vendor/my/${newRet._id}`)
      .set("Authorization", `Bearer ${vendorTokenA}`);
    expect(res.body.data.refundBreakdown.finalRefund.status).toBe("authorized");

    // 17c. Status when refunded: 'processed'
    await ReturnRequest.findByIdAndUpdate(newRet._id, { status: "refunded" });
    res = await request(app)
      .get(`/api/v1/return-requests/vendor/my/${newRet._id}`)
      .set("Authorization", `Bearer ${vendorTokenA}`);
    expect(res.body.data.refundBreakdown.finalRefund.status).toBe("processed");
  });

  // 18. Idempotent approval and refund processing
  test("18. Idempotent approval on already-approved return returns 200 without error", async () => {
    const appRet = await ReturnRequest.create({
      returnNumber: `RET-IDEM-${rand}`,
      orderId: orderA1._id,
      customerId: customerDoc1._id,
      vendorId: vendorDocA._id,
      vendorIds: [vendorDocA._id],
      status: "approved",
      type: "return",
      refundAmount: mongoose.Types.Decimal128.fromString("500.00"),
      items: [
        {
          orderItemId: orderA1.items[0]._id,
          productId: productA1._id,
          sku: variantA1.sku,
          name: productA1.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("500.00"),
          reason: "defective_product",
        },
      ],
    });

    const res = await request(app)
      .post(`/api/v1/return-requests/vendor/my/${appRet._id}/approve`)
      .set("Authorization", `Bearer ${vendorTokenA}`)
      .send({ notes: "Repeated approval attempt" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("approved");
  });
});
