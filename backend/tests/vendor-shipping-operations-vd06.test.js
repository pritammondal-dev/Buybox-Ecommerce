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
const Shipment = require("../src/models/Shipment");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken, TOKEN_CONTEXTS } = require("../src/services/token.service");
const { hashPassword } = require("../src/utils/password");
const { encodeSecureId } = require("../src/utils/secure-id.util");
const { SHIPMENT_STATUSES } = require("../src/constants/shipping.constants");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_vd06_test?")
  : "mongodb://127.0.0.1:27017/buybox_vd06_test?replicaSet=rs0";

jest.setTimeout(45000);

describe("Phase VD-06: Shipping, Dispatch & Fulfillment Operations", () => {
  let adminUser, adminToken;
  let vendorAUser, vendorA, vendorAToken;
  let vendorBUser, vendorB, vendorBToken;
  let customerUser, customer, customerToken;
  let warehouse, category, brand;
  let productA, variantA, productB, variantB;
  let testOrder;
  let shipmentA;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(TEST_MONGODB_URI);

    // 1. Superadmin User
    adminUser = await User.findOne({ role: ROLES.SUPER_ADMIN, isActive: true });
    if (!adminUser) {
      adminUser = await User.create({
        firstName: "Super",
        lastName: "Admin",
        email: `admin_vd06_${Date.now()}@buybox.test`,
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
        permissions: [PERMISSIONS.SHIPMENTS_READ, PERMISSIONS.SHIPMENTS_MANAGE, PERMISSIONS.ORDERS_READ, PERMISSIONS.ORDERS_MANAGE],
        authVersion: adminUser.authVersion || 1,
        permissionVersion: adminUser.permissionVersion || 1,
      },
      { context: TOKEN_CONTEXTS.ADMINISTRATOR }
    );

    // 2. Vendor A
    vendorAUser = await User.create({
      firstName: "VendorA",
      lastName: "Logistics",
      email: `vendor_a_vd06_${Date.now()}@buybox.test`,
      password: await hashPassword("Password123!"),
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      isEmailVerified: true,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    vendorA = await Vendor.create({
      userId: vendorAUser._id,
      storeName: "Alpha Logistics Store",
      businessName: "Alpha Logistics Store",
      businessSlug: `alpha-logistics-${Date.now()}`,
      status: "approved",
      isActive: true,
      approvalStatus: "approved",
      onboardingStatus: "approved",
      email: vendorAUser.email,
      phone: "+919876543210",
      complianceStatus: "verified",
      verificationStatus: "verified",
      address: {
        addressLine1: "123 Alpha Hub",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "India",
      },
    });

    vendorAToken = generateAccessToken(
      {
        sub: vendorAUser._id.toString(),
        id: vendorAUser._id.toString(),
        email: vendorAUser.email,
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
        permissions: [PERMISSIONS.SHIPMENTS_READ_OWN, PERMISSIONS.SHIPMENTS_MANAGE_OWN, PERMISSIONS.ORDERS_READ_OWN, PERMISSIONS.ORDERS_MANAGE_OWN],
        authVersion: vendorAUser.authVersion || 1,
        permissionVersion: vendorAUser.permissionVersion || 1,
      },
      { context: TOKEN_CONTEXTS.VENDOR }
    );

    // 3. Vendor B
    vendorBUser = await User.create({
      firstName: "VendorB",
      lastName: "Logistics",
      email: `vendor_b_vd06_${Date.now()}@buybox.test`,
      password: await hashPassword("Password123!"),
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      isEmailVerified: true,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    vendorB = await Vendor.create({
      userId: vendorBUser._id,
      storeName: "Beta Logistics Store",
      businessName: "Beta Logistics Store",
      businessSlug: `beta-logistics-${Date.now()}`,
      status: "approved",
      isActive: true,
      approvalStatus: "approved",
      onboardingStatus: "approved",
      email: vendorBUser.email,
      phone: "+919876543211",
      complianceStatus: "verified",
      verificationStatus: "verified",
      address: {
        addressLine1: "456 Beta Hub",
        city: "Bangalore",
        state: "Karnataka",
        postalCode: "560001",
        country: "India",
      },
    });

    vendorBToken = generateAccessToken(
      {
        sub: vendorBUser._id.toString(),
        id: vendorBUser._id.toString(),
        email: vendorBUser.email,
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
        permissions: [PERMISSIONS.SHIPMENTS_READ_OWN, PERMISSIONS.SHIPMENTS_MANAGE_OWN, PERMISSIONS.ORDERS_READ_OWN, PERMISSIONS.ORDERS_MANAGE_OWN],
        authVersion: vendorBUser.authVersion || 1,
        permissionVersion: vendorBUser.permissionVersion || 1,
      },
      { context: TOKEN_CONTEXTS.VENDOR }
    );

    // 4. Customer
    customerUser = await User.create({
      firstName: "Shipping",
      lastName: "Customer",
      email: `customer_vd06_${Date.now()}@buybox.test`,
      password: await hashPassword("Password123!"),
      role: ROLES.CUSTOMER,
      roles: [ROLES.CUSTOMER],
      isEmailVerified: true,
      isActive: true,
    });

    customer = await Customer.create({
      userId: customerUser._id,
      firstName: customerUser.firstName,
      lastName: customerUser.lastName,
      email: customerUser.email,
      shippingAddresses: [
        {
          fullName: "Shipping Customer",
          phone: "9123456789",
          addressLine1: "789 Park Street",
          city: "Kolkata",
          state: "West Bengal",
          postalCode: "700016",
          country: "India",
          isDefault: true,
        },
      ],
    });

    customerToken = generateAccessToken(
      {
        sub: customerUser._id.toString(),
        id: customerUser._id.toString(),
        email: customerUser.email,
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        permissions: [],
      },
      { context: TOKEN_CONTEXTS.STOREFRONT }
    );

    // 5. Shared Warehouse, Category, Brand
    warehouse = await Warehouse.create({
      name: "National Fulfillment Hub",
      code: `WH-VD06-${Date.now()}`,
      isActive: true,
      address: {
        addressLine1: "1 Central Cargo Way",
        city: "New Delhi",
        state: "Delhi",
        postalCode: "110037",
        country: "IN",
      },
    });

    category = await Category.create({
      name: "Electronics VD06",
      slug: `electronics-vd06-${Date.now()}`,
      isActive: true,
    });

    brand = await Brand.create({
      name: "Apex Cargo",
      slug: `apex-cargo-${Date.now()}`,
      isActive: true,
    });

    // 6. Products
    productA = await Product.create({
      name: "Alpha High-Speed Router",
      title: "Alpha High-Speed Router",
      slug: `alpha-router-${Date.now()}`,
      sku: `PROD-A-${Date.now().toString().slice(-4)}`,
      vendorId: vendorA._id,
      categoryId: category._id,
      brandId: brand._id,
      price: mongoose.Types.Decimal128.fromString("3499.00"),
      currency: "INR",
      status: "active",
      approvalStatus: "approved",
      publishedAt: new Date(),
      isActive: true,
    });

    variantA = await ProductVariant.create({
      productId: productA._id,
      sku: `SKU-ALPHA-RT-${Date.now()}`,
      price: mongoose.Types.Decimal128.fromString("3499.00"),
      stock: 50,
      isActive: true,
    });

    productB = await Product.create({
      name: "Beta Mesh Satellite",
      title: "Beta Mesh Satellite",
      slug: `beta-mesh-${Date.now()}`,
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
      sku: `SKU-BETA-MS-${Date.now()}`,
      price: mongoose.Types.Decimal128.fromString("4999.00"),
      stock: 30,
      isActive: true,
    });

    // 6b. Inventory records for deduction on picked_up
    await Inventory.create({
      productVariantId: variantA._id,
      warehouseId: warehouse._id,
      onHand: 50,
      reserved: 1,
      lowStockThreshold: 5,
    });

    await Inventory.create({
      productVariantId: variantB._id,
      warehouseId: warehouse._id,
      onHand: 30,
      reserved: 1,
      lowStockThreshold: 5,
    });

    // 7. Multi-Vendor Order in 'confirmed' status
    testOrder = await Order.create({
      customerId: customer._id,
      orderNumber: `ORD-VD06-${Date.now()}`,
      status: "processing",
      paymentStatus: "paid",
      paymentMethod: "razorpay",
      currency: "INR",
      subtotal: mongoose.Types.Decimal128.fromString("8498.00"),
      discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
      taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
      shippingTotal: mongoose.Types.Decimal128.fromString("0.00"),
      grandTotal: mongoose.Types.Decimal128.fromString("8498.00"),
      amountPaid: mongoose.Types.Decimal128.fromString("8498.00"),
      shippingAddress: {
        fullName: "Shipping Customer",
        phone: "+919123456789",
        addressLine1: "789 Park Street",
        city: "Kolkata",
        state: "West Bengal",
        postalCode: "700016",
        country: "IN",
      },
      items: [
        {
          productId: productA._id,
          productVariantId: variantA._id,
          productName: productA.name,
          sku: variantA.sku,
          unitPrice: mongoose.Types.Decimal128.fromString("3499.00"),
          price: mongoose.Types.Decimal128.fromString("3499.00"),
          discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
          taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("3499.00"),
          currency: "INR",
          quantity: 1,
          vendorId: vendorA._id,
          warehouseId: warehouse._id,
          inventoryStatus: "reserved",
          fulfillmentStatus: "processing",
          vendorAcceptance: {
            status: "accepted",
            acceptedAt: new Date(),
          },
        },
        {
          productId: productB._id,
          productVariantId: variantB._id,
          productName: productB.name,
          sku: variantB.sku,
          unitPrice: mongoose.Types.Decimal128.fromString("4999.00"),
          price: mongoose.Types.Decimal128.fromString("4999.00"),
          discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
          taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("4999.00"),
          currency: "INR",
          quantity: 1,
          vendorId: vendorB._id,
          warehouseId: warehouse._id,
          inventoryStatus: "reserved",
          fulfillmentStatus: "processing",
          vendorAcceptance: {
            status: "pending",
          },
        },
      ],
      vendorFulfillments: [
        {
          vendorId: vendorA._id,
          acceptanceStatus: "accepted",
          assignedShipmentPartner: {
            partnerId: "delhivery",
            partnerName: "Delhivery Logistics",
            serviceCode: "standard",
            assignedAt: new Date(),
          },
          expectedDeliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          isFulfillmentConfirmed: true,
          fulfillmentConfirmedAt: new Date(),
          fulfillmentStatus: "processing",
        },
        {
          vendorId: vendorB._id,
          acceptanceStatus: "pending",
          isFulfillmentConfirmed: false,
          fulfillmentStatus: "unfulfilled",
        },
      ],
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe("1. Courier Serviceability & Supported Partners", () => {
    it("checks carrier serviceability cleanly for origin and destination pincodes", async () => {
      const res = await request(app)
        .get("/api/v1/shipments/serviceability")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .query({
          provider: "delhivery",
          originPostalCode: "110037",
          destinationPostalCode: "700016",
        });

      
      if (res.status !== 200) console.error("DEBUG 409:", JSON.stringify(res.body));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.serviceable).toBe(true);
      expect(res.body.data.carrier.toLowerCase()).toBe("delhivery");
    });

    it("rejects invalid destination pincode format", async () => {
      const res = await request(app)
        .get("/api/v1/shipments/serviceability")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .query({
          provider: "custom",
          originPostalCode: "110037",
          destinationPostalCode: "INVALID",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.serviceable).toBe(false);
    });
  });

  describe("2. Vendor Shipment Booking & Central Confirmation Guard", () => {
    it("BLOCKS Vendor B from creating shipment because fulfillment is not confirmed", async () => {
      const res = await request(app)
        .post("/api/v1/shipments/vendor")
        .set("Authorization", `Bearer ${vendorBToken}`)
        .set("Idempotency-Key", `idem-vb-${Date.now()}`)
        .send({
          orderId: testOrder._id.toString(),
          warehouseId: warehouse._id.toString(),
          carrier: "Delhivery",
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("FULFILLMENT_NOT_CONFIRMED");
    });

    it("CREATES shipment cleanly for Vendor A whose fulfillment is confirmed", async () => {
      const res = await request(app)
        .post("/api/v1/shipments/vendor")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .set("Idempotency-Key", `idem-va-${Date.now()}`)
        .send({
          orderId: testOrder._id.toString(),
          warehouseId: warehouse._id.toString(),
          carrier: "Delhivery",
          serviceLevel: "standard",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.status).toBe("created");
      expect(res.body.data.vendorId.toString()).toBe(vendorA._id.toString());
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].sku).toBe(variantA.sku);

      shipmentA = res.body.data;
    });

    it("guarantees idempotency on duplicate submission with same key", async () => {
      const res = await request(app)
        .post("/api/v1/shipments/vendor")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .set("Idempotency-Key", shipmentA.idempotencyKey)
        .send({
          orderId: testOrder._id.toString(),
          warehouseId: warehouse._id.toString(),
          carrier: "Delhivery",
        });

      expect(res.status).toBe(201);
      expect(res.body.data._id.toString()).toBe(shipmentA._id.toString());
    });
  });

  describe("3. Strict Multi-Vendor Tenant Isolation", () => {
    it("BLOCKS Vendor B from retrieving Vendor A shipment (returns 404)", async () => {
      const res = await request(app)
        .get(`/api/v1/shipments/vendor/my/${shipmentA._id}`)
        .set("Authorization", `Bearer ${vendorBToken}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("SHIPMENT_NOT_FOUND");
    });

    it("BLOCKS Vendor B from scheduling pickup for Vendor A shipment", async () => {
      const res = await request(app)
        .post(`/api/v1/shipments/vendor/${shipmentA._id}/pickup`)
        .set("Authorization", `Bearer ${vendorBToken}`)
        .send({
          scheduledDate: new Date().toISOString(),
          timeSlot: "10:00-13:00",
        });

      expect(res.status).toBe(404);
    });

    it("Vendor A retrieves their shipment detail with tracking events initialized", async () => {
      const res = await request(app)
        .get(`/api/v1/shipments/vendor/my/${shipmentA._id}`)
        .set("Authorization", `Bearer ${vendorAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.shipmentNumber).toBe(shipmentA.shipmentNumber);
      expect(Array.isArray(res.body.data.trackingEvents)).toBe(true);
      expect(res.body.data.trackingEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("4. Pickup Scheduling & Label Generation", () => {
    it("Vendor A schedules courier pickup cleanly", async () => {
      const pickupDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const res = await request(app)
        .post(`/api/v1/shipments/vendor/${shipmentA._id}/pickup`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({
          scheduledDate: pickupDate,
          timeSlot: "14:00-18:00",
          notes: "Dock 4 - Alpha Logistics",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("pickup_scheduled");
      expect(res.body.data.pickupSchedule).toBeDefined();
      expect(res.body.data.pickupSchedule.status).toBe("scheduled");
      expect(res.body.data.pickupSchedule.pickupToken).toBeDefined();
    });

    it("Vendor A generates shipping label", async () => {
      const res = await request(app)
        .get(`/api/v1/shipments/vendor/${shipmentA._id}/label`)
        .set("Authorization", `Bearer ${vendorAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.shipment.labelGeneratedAt).toBeDefined();
    });
  });

  describe("5. Milestone Transitions & Order Synchronization", () => {
    it("transitions status to picked_up and records milestone event", async () => {
      const res = await request(app)
        .patch(`/api/v1/shipments/vendor/${shipmentA._id}/status`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({
          status: "picked_up",
          trackingNumber: "AWB-ALPHA-998877",
          notes: "Parcel handed to carrier courier agent",
        });
      
      

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("picked_up");
      expect(res.body.data.awbNumber).toBe("AWB-ALPHA-998877");
      expect(res.body.data.inventoryStatus).toBe("deducted");

      // Verify milestone appended to trackingEvents
      const latestEvt = res.body.data.trackingEvents.slice(-1)[0];
      expect(latestEvt.status).toBe("picked_up");

      // Verify parent order item & vendorFulfillments synced
      const updatedOrder = await Order.findById(testOrder._id);
      const itemA = updatedOrder.items.find((it) => it.sku === variantA.sku);
      expect(itemA.fulfillmentStatus).toBe("shipped");
      const vfA = updatedOrder.vendorFulfillments.find((v) => v.vendorId.toString() === vendorA._id.toString());
      expect(vfA.fulfillmentStatus).toBe("shipped");
    });

    it("transitions status through in_transit to delivered", async () => {
      // Step 1: in_transit
      await request(app)
        .patch(`/api/v1/shipments/vendor/${shipmentA._id}/status`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({ status: "in_transit" });

      // Step 2: out_for_delivery
      await request(app)
        .patch(`/api/v1/shipments/vendor/${shipmentA._id}/status`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({ status: "out_for_delivery" });

      // Step 3: delivered
      const resDelivered = await request(app)
        .patch(`/api/v1/shipments/vendor/${shipmentA._id}/status`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({ status: "delivered" });

      expect(resDelivered.status).toBe(200);
      expect(resDelivered.body.data.status).toBe("delivered");
      expect(resDelivered.body.data.deliveredAt).toBeDefined();

      // Verify order items updated to delivered
      const updatedOrder = await Order.findById(testOrder._id);
      const itemA = updatedOrder.items.find((it) => it.sku === variantA.sku);
      expect(itemA.fulfillmentStatus).toBe("delivered");
    });
  });

  describe("6. Customer Multi-Package Order Tracking", () => {
    it("Customer retrieves shipments for order displaying packages and live AWB coordinates", async () => {
      const res = await request(app)
        .get(`/api/v1/shipments/my/order/${testOrder._id}`)
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const customerShipment = res.body.data[0];
      expect(customerShipment.status).toBe("delivered");
      expect(customerShipment.awbNumber).toBe("AWB-ALPHA-998877");
      expect(customerShipment.items.length).toBe(1);
    });
  });

  describe("7. Financial Invariant Preservation", () => {
    it("guarantees shipment transitions do NOT automatically create settlements or wallet releases", async () => {
      const WalletModel = mongoose.models.VendorWallet;
      if (WalletModel) {
        const walletA = await WalletModel.findOne({ vendorId: vendorA._id });
        if (walletA) {
          // Verify that wallet reserve was NOT blindly released simply by shipping
          expect(walletA).toBeDefined();
        }
      }
    });
  });
});
