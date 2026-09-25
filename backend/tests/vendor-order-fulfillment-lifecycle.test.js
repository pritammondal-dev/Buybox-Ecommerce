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
const Inventory = require("../src/models/Inventory");
const Warehouse = require("../src/models/Warehouse");
const Order = require("../src/models/Order");
const Shipment = require("../src/models/Shipment");
const ReturnRequest = require("../src/models/ReturnRequest");
const { VendorSettlement } = require("../src/models/VendorSettlement");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const RolePermission = require("../src/models/RolePermission");
const Employee = require("../src/models/Employee");
const EmployeeRole = require("../src/models/EmployeeRole");

const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");
const { encodeSecureId } = require("../src/utils/secure-id.util");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_fulfillment_test?")
  : "mongodb://127.0.0.1:27017/buybox_fulfillment_test?replicaSet=rs0";

jest.setTimeout(45000);

describe("Buybox End-to-End Vendor Fulfillment, Return & Settlement Suite", () => {
  let vendorUser, vendor, vendorToken;
  let customerUser, customer, customerToken;
  let adminUser, adminEmployee, adminToken;
  let warehouse, category, brand, product, variant, inventory;
  let createdPermissions = new Map();

  async function getOrCreatePermission(slug) {
    if (createdPermissions.has(slug)) return createdPermissions.get(slug);
    let perm = await Permission.findOne({ slug });
    if (!perm) {
      perm = await Permission.create({
        name: slug,
        slug,
        module: slug.split(":")[0] || "general",
        action: slug.split(":")[1] || "manage",
        accessLevel: "write",
      });
    }
    createdPermissions.set(slug, perm);
    return perm;
  }

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(TEST_MONGODB_URI);
    try {
      await Promise.all([
        User.deleteMany({ email: /@buybox\.test$/ }),
        Customer.deleteMany({}),
        Vendor.deleteMany({}),
        Warehouse.deleteMany({}),
        Category.deleteMany({}),
        Brand.deleteMany({}),
        Product.deleteMany({}),
        ProductVariant.deleteMany({}),
        Inventory.deleteMany({}),
        Order.deleteMany({}),
        Shipment.deleteMany({}),
        ReturnRequest.deleteMany({}),
        VendorSettlement.deleteMany({}),
      ]);
    } catch {}

    // 1. Setup Admin
    adminUser = await User.create({
      firstName: "Super",
      lastName: "Admin",
      email: `admin_flow_${Date.now()}@buybox.test`,
      password: "Password123!",
      role: ROLES.SUPER_ADMIN,
      isEmailVerified: true,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    adminToken = generateAccessToken({
      sub: adminUser._id.toString(),
      id: adminUser._id.toString(),
      email: adminUser.email,
      role: ROLES.SUPER_ADMIN,
      roles: [ROLES.SUPER_ADMIN],
      permissions: [
        PERMISSIONS.ORDERS_READ,
        PERMISSIONS.ORDERS_MANAGE,
        PERMISSIONS.FINANCE_READ,
        PERMISSIONS.FINANCE_MANAGE,
        PERMISSIONS.SHIPMENTS_READ,
        PERMISSIONS.SHIPMENTS_MANAGE,
      ],
      authVersion: 1,
      permissionVersion: 1,
    });

    const adminRole = await Role.create({
      name: `Fulfillment Admin ${Date.now()}`,
      slug: `admin_fulfill_${Date.now()}`,
      isActive: true,
    });

    const neededPerms = [
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.ORDERS_MANAGE,
      PERMISSIONS.FINANCE_READ,
      PERMISSIONS.FINANCE_MANAGE,
      PERMISSIONS.SHIPMENTS_READ,
      PERMISSIONS.SHIPMENTS_MANAGE,
    ];
    for (const slug of neededPerms) {
      const p = await getOrCreatePermission(slug);
      await RolePermission.create({ roleId: adminRole._id, permissionId: p._id });
    }

    adminEmployee = await Employee.create({
      userId: adminUser._id,
      employeeNumber: `EMP-${Date.now().toString().slice(-5)}`,
      department: "Marketplace Operations",
      status: "active",
      jobTitle: "Operations Admin",
    });
    await EmployeeRole.create({ employeeId: adminEmployee._id, roleId: adminRole._id });

    // 2. Setup Vendor
    vendorUser = await User.create({
      firstName: "Apex",
      lastName: "Vendor",
      email: `apex_vendor_${Date.now()}@buybox.test`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isEmailVerified: true,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendorToken = generateAccessToken({
      sub: vendorUser._id.toString(),
      id: vendorUser._id.toString(),
      email: vendorUser.email,
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      authVersion: 1,
      permissionVersion: 1,
    });

    vendor = await Vendor.create({
      userId: vendorUser._id,
      businessName: "Apex Retailers Ltd",
      storeName: "Apex Store",
      businessSlug: `apex-store-${Date.now()}`,
      email: vendorUser.email,
      phone: "+919876543210",
      status: "approved",
      onboardingStatus: "approved",
      isActive: true,
      commissionRate: mongoose.Types.Decimal128.fromString("0.10"),
    });

    // 3. Setup Customer
    customerUser = await User.create({
      firstName: "Jane",
      lastName: "Buyer",
      email: `buyer_${Date.now()}@buybox.test`,
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isEmailVerified: true,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    customerToken = generateAccessToken({
      sub: customerUser._id.toString(),
      id: customerUser._id.toString(),
      email: customerUser.email,
      role: ROLES.CUSTOMER,
      roles: [ROLES.CUSTOMER],
      authVersion: 1,
      permissionVersion: 1,
    });
    customer = await Customer.create({
      userId: customerUser._id,
      firstName: "Jane",
      lastName: "Buyer",
      email: customerUser.email,
    });

    // 4. Warehouse & Catalog Setup
    warehouse = await Warehouse.create({
      name: "Mumbai Regional Hub",
      code: `WH-BOM-${Date.now().toString().slice(-4)}`,
      address: {
        addressLine1: "Hub Complex, Andheri East",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400069",
        country: "IN",
      },
      isActive: true,
    });

    category = await Category.create({
      name: "Audio & Headphones",
      slug: `audio-${Date.now()}`,
      isActive: true,
    });

    brand = await Brand.create({
      name: "SoundMaster",
      slug: `soundmaster-${Date.now()}`,
      isActive: true,
    });

    product = await Product.create({
      name: "Wireless ANC Headphones",
      slug: `wireless-anc-headphones-${Date.now()}`,
      sku: `PROD-ANC-${Date.now().toString().slice(-5)}`,
      vendorId: vendor._id,
      categoryId: category._id,
      brandId: brand._id,
      price: mongoose.Types.Decimal128.fromString("5000.00"),
      currency: "INR",
      status: "active",
      approvalStatus: "approved",
      publishedAt: new Date(),
    });

    variant = await ProductVariant.create({
      productId: product._id,
      name: "Midnight Black",
      sku: `ANC-BLK-${Date.now().toString().slice(-5)}`,
      price: mongoose.Types.Decimal128.fromString("5000.00"),
      compareAtPrice: mongoose.Types.Decimal128.fromString("6999.00"),
      currency: "INR",
      status: "active",
    });

    inventory = await Inventory.create({
      warehouseId: warehouse._id,
      productId: product._id,
      productVariantId: variant._id,
      sku: variant.sku,
      onHand: 100,
      reserved: 10,
    });
  });

  afterAll(async () => {
    try {
      await Promise.all([
        User.deleteMany({ email: /@buybox\.test$/ }),
        Customer.deleteMany({}),
        Vendor.deleteMany({}),
        Warehouse.deleteMany({}),
        Category.deleteMany({}),
        Brand.deleteMany({}),
        Product.deleteMany({}),
        ProductVariant.deleteMany({}),
        Inventory.deleteMany({}),
        Order.deleteMany({}),
        Shipment.deleteMany({}),
        ReturnRequest.deleteMany({}),
        VendorSettlement.deleteMany({}),
      ]);
    } catch {}
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  let createdOrder;
  let createdReturn;
  let createdSettlement;

  test("Step 1: Create paid order containing vendor's item", async () => {
    const orderNumber = `ORD-${Date.now()}`;
    createdOrder = await Order.create({
      orderNumber,
      customerId: customer._id,
      userId: customerUser._id,
      status: "confirmed",
      paymentStatus: "paid",
      fulfillmentStatus: "unfulfilled",
      subtotal: mongoose.Types.Decimal128.fromString("10000.00"),
      grandTotal: mongoose.Types.Decimal128.fromString("10000.00"),
      discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
      taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
      currency: "INR",
      shippingAddress: {
        fullName: "Jane Buyer",
        phone: "+919876543210",
        addressLine1: "Flat 402, Highrise Tower",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400050",
        country: "IN",
      },
      items: [
        {
          productId: product._id,
          productVariantId: variant._id,
          vendorId: vendor._id,
          warehouseId: warehouse._id,
          productName: product.name,
          sku: variant.sku,
          quantity: 2,
          unitPrice: mongoose.Types.Decimal128.fromString("5000.00"),
          discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
          taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("10000.00"),
          currency: "INR",
          inventoryStatus: "reserved",
          fulfillmentStatus: "unfulfilled",
        },
      ],
      pricing: {
        itemsTotal: 10000,
        subtotal: 10000,
        grandTotal: 10000,
      },
      placedAt: new Date(),
    });

    expect(createdOrder).toBeDefined();
    expect(createdOrder.paymentStatus).toBe("paid");
  });

  test("Step 2: Vendor accesses orders and transitions to processing and ready_to_ship", async () => {
    const secureOrderId = encodeSecureId("order", createdOrder._id);

    // Get vendor orders list
    const listRes = await request(app)
      .get("/api/v1/vendors/me/orders")
      .set("Authorization", `Bearer ${vendorToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);

    // Get single vendor order
    const detailRes = await request(app)
      .get(`/api/v1/vendors/me/orders/${secureOrderId}`)
      .set("Authorization", `Bearer ${vendorToken}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.orderNumber).toBe(createdOrder.orderNumber);

    // Vendor processes order
    const processRes = await request(app)
      .post(`/api/v1/vendors/me/orders/${secureOrderId}/process`)
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({ notes: "Accepted by merchant" });

    if (processRes.status !== 200) {
      console.log("processRes ERROR JSON:", JSON.stringify(processRes.body));
    }
    expect(processRes.status).toBe(200);
    expect(processRes.body.data.status).toBe("processing");

    // Vendor marks ready to ship
    const readyRes = await request(app)
      .post(`/api/v1/vendors/me/orders/${secureOrderId}/ready-to-ship`)
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({ notes: "Items packaged in tamper-evident bag" });

    expect(readyRes.status).toBe(200);
  });

  test("Step 3: Vendor generates shipment and courier delivers the order", async () => {
    const secureOrderId = encodeSecureId("order", createdOrder._id);

    // Vendor creates shipment
    const shipRes = await request(app)
      .post(`/api/v1/vendors/me/orders/${secureOrderId}/shipments`)
      .set("Authorization", `Bearer ${vendorToken}`)
      .set("Idempotency-Key", require("crypto").randomUUID())
      .send({
        carrier: "Delhivery",
        warehouseId: warehouse._id.toString(),
        trackingNumber: "DLV99283741",
        trackingUrl: "https://www.delhivery.com/track/DLV99283741",
        notes: "Pickup scheduled for 2 PM",
      });

    if (shipRes.status !== 201) {
      console.log("shipRes ERROR:", shipRes.status, shipRes.body);
    }
    expect(shipRes.status).toBe(201);
    const shipment = shipRes.body.data;
    expect(shipment).toBeDefined();
    expect(shipment.shipmentNumber).toMatch(/^SHP-/);

    // Verify order item has shipmentId linked
    const reloadedOrder = await Order.findById(createdOrder._id);
    expect(reloadedOrder.items[0].shipmentId.toString()).toBe(shipment._id.toString());

    // Courier / vendor transitions shipment through valid lifecycle
    const shipmentService = require("../src/services/shipment.service");
    await shipmentService.transitionShipmentStatus({
      shipmentId: shipment._id,
      nextStatus: "ready_to_ship",
    });

    await shipmentService.transitionShipmentStatus({
      shipmentId: shipment._id,
      nextStatus: "picked_up",
    });

    await shipmentService.transitionShipmentStatus({
      shipmentId: shipment._id,
      nextStatus: "in_transit",
    });

    const deliveredShipment = await shipmentService.transitionShipmentStatus({
      shipmentId: shipment._id,
      nextStatus: "delivered",
    });

    expect(deliveredShipment.status).toBe("delivered");

    // Check order synchronization
    const finalOrder = await Order.findById(createdOrder._id);
    expect(finalOrder.status).toBe("delivered");
    expect(finalOrder.deliveredAt).toBeDefined();
    expect(finalOrder.items[0].fulfillmentStatus).toBe("delivered");
  });

  test("Step 4: Customer files return request and vendor reviews, restocks & refunds", async () => {
    // Customer submits return
    const returnRes = await request(app)
      .post("/api/v1/returns")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        orderId: createdOrder._id.toString(),
        type: "return",
        items: [
          {
            productId: product._id.toString(),
            productVariantId: variant._id.toString(),
            quantity: 1,
            reason: "defective",
            condition: "unopened",
          },
        ],
        customerNotes: "Please accept return for 1 unit.",
      });

    if (returnRes.status !== 201) {
      console.log("returnRes ERROR:", returnRes.status, returnRes.body);
    }
    expect(returnRes.status).toBe(201);
    createdReturn = returnRes.body.data;
    expect(createdReturn.returnNumber).toMatch(/^RET-/);
    expect(createdReturn.status).toBe("requested");

    const secureReturnId = encodeSecureId("return", createdReturn._id);

    // Vendor approves return
    const approveRes = await request(app)
      .post(`/api/v1/vendors/me/returns/${secureReturnId}/approve`)
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({ notes: "Return approved by merchant partner." });

    if (approveRes.status !== 200) {
      console.log("approveRes ERROR:", approveRes.status, approveRes.body);
    }
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe("approved");

    // Check inventory before restock
    const invBefore = await Inventory.findById(inventory._id);

    // Vendor receives and restocks return
    const restockRes = await request(app)
      .post(`/api/v1/vendors/me/returns/${secureReturnId}/receive`)
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({ warehouseId: warehouse._id.toString(), notes: "Unit checked and restocked" });

    expect(restockRes.status).toBe(200);
    expect(restockRes.body.data.status).toBe("received");

    const invAfter = await Inventory.findById(inventory._id);
    expect(invAfter.onHand).toBe(invBefore.onHand + 1);

    // Process customer refund
    const refundRes = await request(app)
      .post(`/api/v1/vendors/me/returns/${secureReturnId}/refund`)
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({ notes: "Full line refund issued" });

    expect(refundRes.status).toBe(200);
    expect(refundRes.body.data.status).toBe("refunded");
  });

  test("Step 5: Settlement engine calculates metrics, generates cycle & records payout", async () => {
    // Fast-forward order delivery date past 7 days to make remaining 1 item eligible
    await Order.updateOne(
      { _id: createdOrder._id },
      { $set: { deliveredAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) } }
    );

    // Vendor checks finance summary
    const financeRes = await request(app)
      .get("/api/v1/vendors/me/finance")
      .set("Authorization", `Bearer ${vendorToken}`);

    expect(financeRes.status).toBe(200);
    expect(financeRes.body.data.currency).toBe("INR");
    expect(Number(financeRes.body.data.eligibleForSettlement)).toBeGreaterThan(0);

    // Admin generates settlements
    const genRes = await request(app)
      .post("/api/v1/vendor-settlements/generate")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ vendorId: vendor._id.toString() });

    if (genRes.status !== 200) {
      console.log("genRes ERROR:", genRes.status, genRes.body);
    }
    expect(genRes.status).toBe(200);
    const settlements = genRes.body.data;
    expect(settlements.length).toBeGreaterThanOrEqual(1);
    createdSettlement = settlements[0];

    expect(createdSettlement.settlementNumber).toMatch(/^SET-/);
    const netAmount = Number(createdSettlement.netPayable?.$numberDecimal || createdSettlement.netPayable);
    expect(netAmount).toBeGreaterThan(0);

    // Verify order item has settlementId tagged
    const settledOrder = await Order.findById(createdOrder._id);
    expect(settledOrder.items[0].settlementId.toString()).toBe(createdSettlement._id.toString());

    // Admin records payout
    const payRes = await request(app)
      .post(`/api/v1/vendor-settlements/${createdSettlement._id}/pay`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ payoutReference: "NEFT-BOM-99281726" });

    expect(payRes.status).toBe(200);
    expect(payRes.body.data.status).toBe("paid");
    expect(payRes.body.data.payoutReference).toBe("NEFT-BOM-99281726");

    // Vendor checks settlement details
    const secureSettlementId = encodeSecureId("settlement", createdSettlement._id);
    const vendorSettlementRes = await request(app)
      .get(`/api/v1/vendors/me/settlements/${secureSettlementId}`)
      .set("Authorization", `Bearer ${vendorToken}`);

    expect(vendorSettlementRes.status).toBe(200);
    expect(vendorSettlementRes.body.data.settlementNumber).toBe(createdSettlement.settlementNumber);
    expect(vendorSettlementRes.body.data.status).toBe("paid");
  });

  test("Step 6: Admin Order Listing & Inspection", async () => {
    // Admin orders list
    const adminOrdersRes = await request(app)
      .get("/api/v1/orders/admin")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(adminOrdersRes.status).toBe(200);
    expect(adminOrdersRes.body.data.length).toBeGreaterThanOrEqual(1);

    // Admin order detail
    const adminOrderDetailRes = await request(app)
      .get(`/api/v1/orders/admin/${createdOrder._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(adminOrderDetailRes.status).toBe(200);
    expect(adminOrderDetailRes.body.data.orderNumber).toBe(createdOrder.orderNumber);
    expect(adminOrderDetailRes.body.data.items[0].vendorId.businessName).toBe("Apex Retailers Ltd");
  });
});
