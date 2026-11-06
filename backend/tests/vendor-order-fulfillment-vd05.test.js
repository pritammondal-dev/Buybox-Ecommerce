const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");

const User = require("../src/models/User");
const Customer = require("../src/models/Customer");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Order = require("../src/models/Order");
const Warehouse = require("../src/models/Warehouse");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken, TOKEN_CONTEXTS } = require("../src/services/token.service");
const { hashPassword } = require("../src/utils/password");
const { encodeSecureId } = require("../src/utils/secure-id.util");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_vd05_test?")
  : "mongodb://127.0.0.1:27017/buybox_vd05_test?replicaSet=rs0";

jest.setTimeout(45000);

describe("Phase VD-05: Unified Order Management, Vendor Fulfillment & Cross-Platform Synchronization", () => {
  let adminUser, adminToken;
  let vendorAUser, vendorA, vendorAToken;
  let vendorBUser, vendorB, vendorBToken;
  let customerUser, customer, customerToken;
  let warehouse, category, brand;
  let productA, variantA, productB, variantB;
  let multiVendorOrder, orderSecureId;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(TEST_MONGODB_URI);

    // 1. Provision Platform Super Administrator
    adminUser = await User.findOne({ role: ROLES.SUPER_ADMIN, isActive: true });
    if (!adminUser) {
      adminUser = await User.create({
        firstName: "Super",
        lastName: "Admin",
        email: `admin_vd05_${Date.now()}@buybox.test`,
        password: await hashPassword("Password123!"),
        role: ROLES.SUPER_ADMIN,
        roles: [ROLES.SUPER_ADMIN],
        isEmailVerified: true,
        isActive: true,
        authVersion: 1,
        permissionVersion: 1,
      });
    }
    adminToken = generateAccessToken(
      {
        sub: adminUser._id.toString(),
        id: adminUser._id.toString(),
        email: adminUser.email,
        role: ROLES.SUPER_ADMIN,
        roles: [ROLES.SUPER_ADMIN],
        permissions: [PERMISSIONS.ORDERS_READ, PERMISSIONS.ORDERS_MANAGE],
        authVersion: adminUser.authVersion || 1,
        permissionVersion: adminUser.permissionVersion || 1,
      },
      {
        context: TOKEN_CONTEXTS.ADMINISTRATOR,
      }
    );

    // Setup Vendor A
    vendorAUser = await User.create({
      firstName: "Alpha",
      lastName: "Seller",
      email: `vendor_a_${Date.now()}@buybox.test`,
      password: await hashPassword("Password123!"),
      role: ROLES.VENDOR,
      isEmailVerified: true,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendorA = await Vendor.create({
      userId: vendorAUser._id,
      storeName: "Alpha Store",
      businessName: "Alpha Merchant Inc",
      businessSlug: `alpha-store-${Date.now()}`,
      status: "approved",
      isActive: true,
      approvalStatus: "approved",
      onboardingStatus: "approved",
      email: vendorAUser.email,
      phone: "+919876543210",
      complianceStatus: "verified",
      verificationStatus: "verified",
    });
    vendorAToken = generateAccessToken(
      {
        sub: vendorAUser._id.toString(),
        id: vendorAUser._id.toString(),
        email: vendorAUser.email,
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
        vendorId: vendorA._id.toString(),
        permissions: [PERMISSIONS.ORDERS_READ_OWN, PERMISSIONS.ORDERS_MANAGE_OWN],
        authVersion: 1,
        permissionVersion: 1,
      },
      {
        context: TOKEN_CONTEXTS.VENDOR,
      }
    );

    // Setup Vendor B
    vendorBUser = await User.create({
      firstName: "Beta",
      lastName: "Seller",
      email: `vendor_b_${Date.now()}@buybox.test`,
      password: await hashPassword("Password123!"),
      role: ROLES.VENDOR,
      isEmailVerified: true,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendorB = await Vendor.create({
      userId: vendorBUser._id,
      storeName: "Beta Store",
      businessName: "Beta Enterprises",
      businessSlug: `beta-store-${Date.now()}`,
      status: "approved",
      isActive: true,
      approvalStatus: "approved",
      onboardingStatus: "approved",
      email: vendorBUser.email,
      phone: "+919876543211",
      complianceStatus: "verified",
      verificationStatus: "verified",
    });
    vendorBToken = generateAccessToken(
      {
        sub: vendorBUser._id.toString(),
        id: vendorBUser._id.toString(),
        email: vendorBUser.email,
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
        vendorId: vendorB._id.toString(),
        permissions: [PERMISSIONS.ORDERS_READ_OWN, PERMISSIONS.ORDERS_MANAGE_OWN],
        authVersion: 1,
        permissionVersion: 1,
      },
      {
        context: TOKEN_CONTEXTS.VENDOR,
      }
    );

    // Setup Customer
    customerUser = await User.create({
      firstName: "John",
      lastName: "Buyer",
      email: `customer_vd05_${Date.now()}@buybox.test`,
      password: await hashPassword("Password123!"),
      role: ROLES.CUSTOMER,
      isEmailVerified: true,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    customer = await Customer.create({
      userId: customerUser._id,
      firstName: customerUser.firstName,
      lastName: customerUser.lastName,
      email: customerUser.email,
    });
    customerToken = generateAccessToken({
      sub: customerUser._id.toString(),
      id: customerUser._id.toString(),
      email: customerUser.email,
      role: ROLES.CUSTOMER,
      roles: [ROLES.CUSTOMER],
    });

    // Setup Warehouse, Category, Brand
    warehouse = await Warehouse.create({
      name: "Mumbai Central Hub",
      code: `WH-BOM-${Date.now().toString().slice(-4)}`,
      address: {
        addressLine1: "123 Logistics Park",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      isActive: true,
    });

    category = await Category.create({
      name: "Electronics",
      slug: `electronics-${Date.now()}`,
      isActive: true,
    });

    brand = await Brand.create({
      name: "Buybox Originals",
      slug: `buybox-originals-${Date.now()}`,
      isActive: true,
    });

    // Product & Variant for Vendor A
    productA = await Product.create({
      name: "Alpha Wireless Headphones",
      title: "Alpha Wireless Headphones",
      slug: `alpha-headphones-${Date.now()}`,
      sku: `PROD-A-${Date.now().toString().slice(-4)}`,
      vendorId: vendorA._id,
      categoryId: category._id,
      brandId: brand._id,
      price: mongoose.Types.Decimal128.fromString("2999.00"),
      currency: "INR",
      status: "active",
      approvalStatus: "approved",
      publishedAt: new Date(),
      isActive: true,
    });
    variantA = await ProductVariant.create({
      productId: productA._id,
      sku: `SKU-ALPHA-${Date.now()}`,
      price: mongoose.Types.Decimal128.fromString("2999.00"),
      stock: 100,
      isActive: true,
    });

    // Product & Variant for Vendor B
    productB = await Product.create({
      name: "Beta Mechanical Keyboard",
      title: "Beta Mechanical Keyboard",
      slug: `beta-keyboard-${Date.now()}`,
      sku: `PROD-B-${Date.now().toString().slice(-4)}`,
      vendorId: vendorB._id,
      categoryId: category._id,
      brandId: brand._id,
      price: mongoose.Types.Decimal128.fromString("4999.00"),
      currency: "INR",
      status: "active",
      approvalStatus: "approved",
      publishedAt: new Date(),
      isActive: true,
    });
    variantB = await ProductVariant.create({
      productId: productB._id,
      sku: `SKU-BETA-${Date.now()}`,
      price: mongoose.Types.Decimal128.fromString("4999.00"),
      stock: 50,
      isActive: true,
    });
  });

  beforeEach(async () => {
    // Create multi-vendor order spanning Vendor A and Vendor B
    multiVendorOrder = await Order.create({
      orderNumber: `BB-VD05-${Date.now()}`,
      customerId: customer._id,
      status: "confirmed",
      paymentStatus: "paid",
      fulfillmentStatus: "unfulfilled",
      currency: "INR",
      subtotal: mongoose.Types.Decimal128.fromString("7998.00"),
      discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
      taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
      shippingTotal: mongoose.Types.Decimal128.fromString("0.00"),
      grandTotal: mongoose.Types.Decimal128.fromString("7998.00"),
      amountPaid: mongoose.Types.Decimal128.fromString("7998.00"),
      shippingAddress: {
        fullName: "John Buyer",
        phone: "+919876500000",
        addressLine1: "42 MG Road",
        city: "Bangalore",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
      items: [
        {
          productId: productA._id,
          productVariantId: variantA._id,
          warehouseId: warehouse._id,
          vendorId: vendorA._id,
          sku: variantA.sku,
          productName: "Alpha Wireless Headphones",
          quantity: 1,
          unitPrice: mongoose.Types.Decimal128.fromString("2999.00"),
          discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
          taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("2999.00"),
          currency: "INR",
          fulfillmentStatus: "unfulfilled",
          vendorAcceptance: {
            status: "pending",
            acceptedAt: null,
            rejectedAt: null,
            rejectionReason: null,
          },
          assignedShipmentPartner: null,
          expectedDeliveryDate: null,
          isFulfillmentConfirmed: false,
        },
        {
          productId: productB._id,
          productVariantId: variantB._id,
          warehouseId: warehouse._id,
          vendorId: vendorB._id,
          sku: variantB.sku,
          productName: "Beta Mechanical Keyboard",
          quantity: 1,
          unitPrice: mongoose.Types.Decimal128.fromString("4999.00"),
          discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
          taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("4999.00"),
          currency: "INR",
          fulfillmentStatus: "unfulfilled",
          vendorAcceptance: {
            status: "pending",
            acceptedAt: null,
            rejectedAt: null,
            rejectionReason: null,
          },
          assignedShipmentPartner: null,
          expectedDeliveryDate: null,
          isFulfillmentConfirmed: false,
        },
      ],
      vendorFulfillments: [
        {
          vendorId: vendorA._id,
          acceptanceStatus: "pending",
          rejectionReason: null,
          rejectedAt: null,
          assignedShipmentPartner: null,
          expectedDeliveryDate: null,
          isFulfillmentConfirmed: false,
          fulfillmentStatus: "unfulfilled",
          version: 1,
        },
        {
          vendorId: vendorB._id,
          acceptanceStatus: "pending",
          rejectionReason: null,
          rejectedAt: null,
          assignedShipmentPartner: null,
          expectedDeliveryDate: null,
          isFulfillmentConfirmed: false,
          fulfillmentStatus: "unfulfilled",
          version: 1,
        },
      ],
      fulfillmentVersion: 1,
      timeline: [
        {
          event: "order_created",
          title: "Order Placed",
          timestamp: new Date(),
          actor: { actorType: "customer", actorId: customer._id.toString() },
        },
      ],
    });
    orderSecureId = encodeSecureId("order", multiVendorOrder._id);
  });

  afterAll(async () => {
    try {
      await Promise.all([
        User.deleteMany({ email: /@buybox\.test$/ }),
        Customer.deleteMany({ email: /@buybox\.test$/ }),
        Vendor.deleteMany({ _id: { $in: [vendorA._id, vendorB._id] } }),
        Product.deleteMany({ _id: { $in: [productA._id, productB._id] } }),
        ProductVariant.deleteMany({ _id: { $in: [variantA._id, variantB._id] } }),
        Warehouse.deleteMany({ _id: warehouse._id }),
        Category.deleteMany({ _id: category._id }),
        Brand.deleteMany({ _id: brand._id }),
        Order.deleteMany({ orderNumber: /BB-VD05-/ }),
      ]);
      await mongoose.disconnect();
    } catch {}
  });

  describe("1. Shipment Partners Directory", () => {
    it("GET /api/v1/vendors/me/orders/shipment-partners returns active supported courier partners", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me/orders/shipment-partners")
        .set("Authorization", `Bearer ${vendorAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);

      const partnerIds = res.body.data.map((p) => p.id);
      expect(partnerIds).toContain("delhivery");
      expect(partnerIds).toContain("shiprocket");
      expect(partnerIds).toContain("bluedart");
      expect(partnerIds).toContain("custom");
    });
  });

  describe("2. Multi-Vendor Isolation & Order Projection", () => {
    it("Vendor A sees ONLY Vendor A items and subtotal (2999.00), not Vendor B items", async () => {
      const res = await request(app)
        .get(`/api/v1/vendors/me/orders/${orderSecureId}`)
        .set("Authorization", `Bearer ${vendorAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].sku).toBe(variantA.sku);
      expect(res.body.data.subtotal).toBe("2999.00");
      expect(res.body.data.vendorFulfillment).toBeDefined();
      expect(res.body.data.vendorFulfillment.acceptanceStatus).toBe("pending");
      expect(res.body.data.fulfillmentVersion).toBe(1);
    });

    it("Vendor B sees ONLY Vendor B items and subtotal (4999.00), not Vendor A items", async () => {
      const res = await request(app)
        .get(`/api/v1/vendors/me/orders/${orderSecureId}`)
        .set("Authorization", `Bearer ${vendorBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].sku).toBe(variantB.sku);
      expect(res.body.data.subtotal).toBe("4999.00");
      expect(res.body.data.vendorFulfillment).toBeDefined();
      expect(res.body.data.vendorFulfillment.acceptanceStatus).toBe("pending");
    });
  });

  describe("3. Vendor Acceptance & Rejection Workflow", () => {
    it("Vendor A can accept their assigned order items", async () => {
      const res = await request(app)
        .post(`/api/v1/vendors/me/orders/${orderSecureId}/accept`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({ notes: "Items verified in warehouse rack" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items[0].vendorAcceptance.status).toBe("accepted");
      expect(res.body.data.vendorFulfillment.acceptanceStatus).toBe("accepted");
      expect(res.body.data.fulfillmentVersion).toBe(2);

      // Verify in database: Vendor B's items must remain untouched (pending)
      const freshOrder = await Order.findById(multiVendorOrder._id);
      expect(freshOrder.items[0].vendorAcceptance.status).toBe("accepted");
      expect(freshOrder.items[1].vendorAcceptance.status).toBe("pending");
      expect(freshOrder.vendorFulfillments[0].acceptanceStatus).toBe("accepted");
      expect(freshOrder.vendorFulfillments[1].acceptanceStatus).toBe("pending");
    });

    it("Vendor B rejects assigned items with required reason WITHOUT cancelling parent order", async () => {
      // Rejection without reason fails with 400
      const failRes = await request(app)
        .post(`/api/v1/vendors/me/orders/${orderSecureId}/reject`)
        .set("Authorization", `Bearer ${vendorBToken}`)
        .send({ rejectionReason: "" });

      expect(failRes.status).toBe(400);

      // Rejection with valid reason
      const successRes = await request(app)
        .post(`/api/v1/vendors/me/orders/${orderSecureId}/reject`)
        .set("Authorization", `Bearer ${vendorBToken}`)
        .send({
          rejectionReason: "Inventory batch water damaged during transit to warehouse",
          notes: "Need replacement units from supplier",
        });

      expect(successRes.status).toBe(200);
      expect(successRes.body.success).toBe(true);
      expect(successRes.body.data.items[0].vendorAcceptance.status).toBe("rejected");
      expect(successRes.body.data.vendorFulfillment.acceptanceStatus).toBe("rejected");
      expect(successRes.body.data.vendorFulfillment.rejectionReason).toContain("water damaged");

      // NON-NEGOTIABLE CRITICAL RULE: Parent order MUST NOT be cancelled!
      const freshOrder = await Order.findById(multiVendorOrder._id);
      expect(freshOrder.status).not.toBe("cancelled");
      expect(freshOrder.status).toBe("confirmed");
      expect(freshOrder.paymentStatus).toBe("paid"); // No uncoordinated refund!

      // Timeline event recorded
      const rejectEvent = freshOrder.timeline.find((t) => t.event === "vendor_order_rejected");
      expect(rejectEvent).toBeDefined();
      expect(rejectEvent.metadata.rejectionReason).toContain("water damaged");
    });
  });

  describe("4. Shipment Partner Assignment & Expected Delivery Date Validation", () => {
    it("Rejects invalid shipment partner", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const res = await request(app)
        .patch(`/api/v1/vendors/me/orders/${orderSecureId}/fulfillment-details`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({
          partnerId: "non_existent_courier_xyz",
          expectedDeliveryDate: futureDate.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Unsupported shipment partner");
    });

    it("Rejects expected delivery date in the past", async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 2);

      const res = await request(app)
        .patch(`/api/v1/vendors/me/orders/${orderSecureId}/fulfillment-details`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({
          partnerId: "delhivery",
          expectedDeliveryDate: pastDate.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("future");
    });

    it("Accepts valid shipment partner and future delivery date", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 4);

      const res = await request(app)
        .patch(`/api/v1/vendors/me/orders/${orderSecureId}/fulfillment-details`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({
          partnerId: "delhivery",
          partnerName: "Delhivery Surface",
          serviceCode: "surface",
          expectedDeliveryDate: futureDate.toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items[0].assignedShipmentPartner.partnerId).toBe("delhivery");
      expect(res.body.data.items[0].expectedDeliveryDate).toBeDefined();
      expect(res.body.data.vendorFulfillment.assignedShipmentPartner.partnerId).toBe("delhivery");
    });
  });

  describe("5. Central Confirmation Guard", () => {
    it("BLOCKS confirmation if vendor has NOT accepted items", async () => {
      // Vendor B hasn't accepted (rejected earlier)
      const res = await request(app)
        .post(`/api/v1/vendors/me/orders/${orderSecureId}/confirm-fulfillment`)
        .set("Authorization", `Bearer ${vendorBToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Fulfillment confirmation is blocked");
    });

    it("BLOCKS confirmation if shipment partner has NOT been assigned", async () => {
      // Reset Vendor A items to accepted but NO partner
      await Order.updateOne(
        { _id: multiVendorOrder._id, "items.vendorId": vendorA._id },
        {
          $set: {
            "items.$.vendorAcceptance.status": "accepted",
            "items.$.assignedShipmentPartner": null,
            "items.$.expectedDeliveryDate": null,
            "vendorFulfillments.0.acceptanceStatus": "accepted",
            "vendorFulfillments.0.assignedShipmentPartner": null,
            "vendorFulfillments.0.expectedDeliveryDate": null,
          },
        }
      );

      const res = await request(app)
        .post(`/api/v1/vendors/me/orders/${orderSecureId}/confirm-fulfillment`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("shipment partner must be assigned");
    });

    it("BLOCKS confirmation if expected delivery date is missing", async () => {
      // First accept items, set partner, but NO delivery date
      await Order.updateOne(
        { _id: multiVendorOrder._id, "items.vendorId": vendorA._id },
        {
          $set: {
            "items.$.vendorAcceptance.status": "accepted",
            "items.$.assignedShipmentPartner": { partnerId: "delhivery", partnerName: "Delhivery" },
            "items.$.expectedDeliveryDate": null,
            "vendorFulfillments.0.acceptanceStatus": "accepted",
            "vendorFulfillments.0.assignedShipmentPartner": { partnerId: "delhivery", partnerName: "Delhivery" },
            "vendorFulfillments.0.expectedDeliveryDate": null,
          },
        }
      );

      const res = await request(app)
        .post(`/api/v1/vendors/me/orders/${orderSecureId}/confirm-fulfillment`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Expected delivery date must be set");
    });

    it("CONFIRMS fulfillment cleanly when ALL prerequisites (a)-(f) are satisfied", async () => {
      // 1. Accept order items first
      const acceptRes = await request(app)
        .post(`/api/v1/vendors/me/orders/${orderSecureId}/accept`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({});
      expect(acceptRes.status).toBe(200);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);

      // 2. Set partner and delivery date
      const detailsRes = await request(app)
        .patch(`/api/v1/vendors/me/orders/${orderSecureId}/fulfillment-details`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({
          partnerId: "delhivery",
          expectedDeliveryDate: futureDate.toISOString(),
        });
      expect(detailsRes.status).toBe(200);

      // 3. Confirm fulfillment
      const res = await request(app)
        .post(`/api/v1/vendors/me/orders/${orderSecureId}/confirm-fulfillment`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({ notes: "All units packed and sealed" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items[0].isFulfillmentConfirmed).toBe(true);
      expect(res.body.data.items[0].fulfillmentStatus).toBe("processing");
      expect(res.body.data.vendorFulfillment.isFulfillmentConfirmed).toBe(true);

      // Database state
      const freshOrder = await Order.findById(multiVendorOrder._id);
      expect(freshOrder.status).toBe("processing");
      expect(freshOrder.items[0].isFulfillmentConfirmed).toBe(true);
    });

    it("Blocks legacy /process and /ready-to-ship routes if confirmation prerequisites not met", async () => {
      // Create new fresh order with no acceptance, no partner
      const freshOrd = await Order.create({
        orderNumber: `BB-LEGACY-${Date.now()}`,
        customerId: customer._id,
        status: "confirmed",
        paymentStatus: "paid",
        fulfillmentStatus: "unfulfilled",
        currency: "INR",
        subtotal: mongoose.Types.Decimal128.fromString("2999.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("2999.00"),
        shippingAddress: multiVendorOrder.shippingAddress,
        items: [
          {
            productId: productA._id,
            productVariantId: variantA._id,
            warehouseId: warehouse._id,
            vendorId: vendorA._id,
            sku: variantA.sku,
            productName: "Alpha Wireless Headphones",
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("2999.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("2999.00"),
            currency: "INR",
            fulfillmentStatus: "unfulfilled",
            vendorAcceptance: { status: "pending" },
            assignedShipmentPartner: null,
            expectedDeliveryDate: null,
          },
        ],
      });
      const freshSecureId = encodeSecureId("order", freshOrd._id);

      const res = await request(app)
        .post(`/api/v1/vendors/me/orders/${freshSecureId}/process`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Fulfillment confirmation is blocked");
    });
  });

  describe("6. Superadmin Visibility & Controlled Override", () => {
    it("Superadmin retrieves order with full multi-vendor fulfillment dossier and rejection alert", async () => {
      // Mark Vendor B as rejected
      await Order.updateOne(
        { _id: multiVendorOrder._id, "items.vendorId": vendorB._id },
        {
          $set: {
            "items.$.vendorAcceptance.status": "rejected",
            "items.$.vendorAcceptance.rejectionReason": "Stock damaged",
            "vendorFulfillments.1.acceptanceStatus": "rejected",
            "vendorFulfillments.1.rejectionReason": "Stock damaged",
          },
        }
      );

      const res = await request(app)
        .get(`/api/v1/orders/admin/${multiVendorOrder._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vendorFulfillments).toHaveLength(2);
      expect(res.body.data.hasVendorRejection).toBe(true);
      expect(res.body.data.vendorRejections).toHaveLength(1);
      expect(res.body.data.vendorRejections[0].rejectionReason).toBe("Stock damaged");
    });

    it("Superadmin resolves vendor rejection via controlled override with mandatory audit reason", async () => {
      // Rejection without override reason fails
      const failRes = await request(app)
        .patch(`/api/v1/orders/admin/${multiVendorOrder._id}/override-fulfillment`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          action: "resolve_rejection",
          vendorId: vendorB._id.toString(),
          overrideReason: "",
        });

      expect(failRes.status).toBe(400);

      // Rejection resolution with detailed override reason succeeds
      const successRes = await request(app)
        .patch(`/api/v1/orders/admin/${multiVendorOrder._id}/override-fulfillment`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          action: "resolve_rejection",
          vendorId: vendorB._id.toString(),
          overrideReason: "Vendor B contacted; supplier sent expedited stock replacement",
        });

      expect(successRes.status).toBe(200);
      expect(successRes.body.success).toBe(true);
      expect(successRes.body.data.hasVendorRejection).toBe(false);

      // Verify audit timeline
      const freshOrder = await Order.findById(multiVendorOrder._id);
      const overrideEvent = freshOrder.timeline.find((t) =>
        t.event.includes("admin_fulfillment_override")
      );
      expect(overrideEvent).toBeDefined();
      expect(overrideEvent.metadata.overrideReason).toContain("expedited stock replacement");
    });
  });

  describe("7. Concurrency & Version Protection", () => {
    it("Rejects mutations with stale expectedVersion (409 CONCURRENT_MODIFICATION_CONFLICT)", async () => {
      const res = await request(app)
        .post(`/api/v1/vendors/me/orders/${multiVendorOrder._id}/accept`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({
          notes: "Attempt with stale version",
          expectedVersion: 99999, // Intentional stale version mismatch
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("conflict");
    });
  });
});
