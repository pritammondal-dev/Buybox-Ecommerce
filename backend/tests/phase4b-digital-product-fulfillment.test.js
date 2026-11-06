const request = require("supertest");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const app = require("../src/app");
const User = require("../src/models/User");
const Customer = require("../src/models/Customer");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Order = require("../src/models/Order");
const DigitalEntitlement = require("../src/models/DigitalEntitlement");
const Permission = require("../src/models/Permission");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");
const digitalStorageService = require("../src/services/digital-storage.service");
const digitalEntitlementService = require("../src/services/digital-entitlement.service");
const orderService = require("../src/services/order.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/\/buybox(_test)?(\?|$)/, "/buybox_phase4b_test$2")
  : "mongodb://127.0.0.1:27017/buybox_phase4b_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Buybox Phase 4B — Digital Product Management & Secure Download Fulfillment Tests", () => {
  let customerUser1, customerProfile1, customerToken1;
  let customerUser2, customerProfile2, customerToken2;
  let vendorA, vendorB, adminUser;
  let testCategory, testBrand;
  let sampleDigitalAsset;

  async function getOrCreatePermission(slug) {
    let perm = await Permission.findOne({ slug });
    if (!perm) {
      perm = await Permission.create({
        slug,
        name: `Perm ${slug}`,
        module: slug.split(":")[0],
        description: `Description for ${slug}`,
        isActive: true,
      });
    }
    return perm;
  }

  async function createTestCustomer(label = "cust") {
    const rand = Math.random().toString(36).substring(7);
    const user = await User.create({
      firstName: "Customer",
      lastName: label,
      email: `${label}_${Date.now()}_${rand}@phase4b-test.com`,
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const customer = await Customer.create({
      userId: user._id,
      name: `Customer ${label}`,
      email: user.email,
      phone: "+919876543210",
    });

    const token = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
    });

    return { user, customer, token };
  }

  async function createTestVendor(label = "vendor") {
    const rand = Math.random().toString(36).substring(7);
    const user = await User.create({
      firstName: "Vendor",
      lastName: label,
      email: `${label}_${Date.now()}_${rand}@phase4b-test.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const vendor = await Vendor.create({
      userId: user._id,
      businessName: `Store ${label} ${Date.now()}`,
      businessSlug: `store-${label}-${Date.now()}-${rand}`,
      isActive: true,
      onboardingStatus: "approved",
    });

    const token = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
    });

    return { user, vendor, token };
  }

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    await Product.syncIndexes();
    await ProductVariant.syncIndexes();
    await DigitalEntitlement.syncIndexes();

    const permSlugs = [
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.PRODUCTS_CREATE,
      PERMISSIONS.PRODUCTS_UPDATE,
      PERMISSIONS.PRODUCTS_DELETE,
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.ORDERS_MANAGE,
    ];
    for (const slug of permSlugs) {
      await getOrCreatePermission(slug);
    }

    const c1 = await createTestCustomer("c1");
    customerUser1 = c1.user;
    customerProfile1 = c1.customer;
    customerToken1 = c1.token;

    const c2 = await createTestCustomer("c2");
    customerUser2 = c2.user;
    customerProfile2 = c2.customer;
    customerToken2 = c2.token;

    vendorA = await createTestVendor("vendorA");
    vendorB = await createTestVendor("vendorB");

    const adminDoc = await User.create({
      firstName: "Super",
      lastName: "Admin",
      email: `admin_${Date.now()}_${Math.random().toString(36).substring(7)}@phase4b-test.com`,
      password: "Password123!",
      role: ROLES.ADMIN,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    const adminToken = generateAccessToken({
      sub: adminDoc._id.toString(),
      role: adminDoc.role,
      authVersion: adminDoc.authVersion,
      permissionVersion: adminDoc.permissionVersion,
    });
    adminUser = { user: adminDoc, token: adminToken };

    testCategory = await Category.create({
      name: `Digital Cat ${Date.now()}`,
      slug: `dgt-cat-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
    });

    testBrand = await Brand.create({
      name: `Digital Brand ${Date.now()}`,
      slug: `dgt-brand-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
    });

    // Save a sample digital asset directly into private storage
    const sampleBuffer = Buffer.from("Buybox Exclusive Digital Product Content - 2026 E-Book");
    sampleDigitalAsset = await digitalStorageService.saveDigitalAsset(
      {
        originalname: "guide_masterclass.pdf",
        buffer: sampleBuffer,
        mimetype: "application/pdf",
        size: sampleBuffer.length,
      },
      { version: "1.0" }
    );
  });

  afterAll(async () => {
    if (sampleDigitalAsset?.storageKey) {
      await digitalStorageService.deleteDigitalAsset(sampleDigitalAsset.storageKey);
    }
  });

  // ----------------------------------------------------
  // TEST SUITE 1: Product Creation & Editing (Virtual & Downloadable)
  // ----------------------------------------------------
  describe("1. Virtual & Downloadable Product Management", () => {
    let createdProduct;

    test("creates a combined virtual and downloadable product with digital assets and limits", async () => {
      const payload = {
        name: "Full-Stack Development Masterclass E-Book",
        slug: `full-stack-development-masterclass-${Date.now()}`,
        sku: `DGT-SKU-${Date.now()}`,
        categoryId: testCategory._id.toString(),
        brandId: testBrand._id.toString(),
        price: 499.0,
        currency: "INR",
        productType: "simple",
        isVirtual: true,
        isDownloadable: true,
        downloadLimit: 5,
        downloadExpiryDays: 30,
        downloadableFiles: [
          {
            id: sampleDigitalAsset.id,
            name: "Masterclass PDF",
            fileUrl: `digital://${sampleDigitalAsset.storageKey}`,
            storageKey: sampleDigitalAsset.storageKey,
            fileSize: sampleDigitalAsset.fileSize,
            mimeType: sampleDigitalAsset.mimeType,
            version: "1.0",
          },
        ],
      };

      const res = await request(app)
        .post("/api/v1/products")
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send(payload);

      expect(res.status).toBe(201);
      const prd = res.body?.data?.product;
      expect(prd).toBeDefined();
      expect(prd.isVirtual).toBe(true);
      expect(prd.isDownloadable).toBe(true);
      expect(prd.downloadLimit).toBe(5);
      expect(prd.downloadExpiryDays).toBe(30);
      expect(prd.downloadableFiles).toHaveLength(1);
      expect(prd.downloadableFiles[0].name).toBe("Masterclass PDF");
      createdProduct = prd;
    });

    test("updates digital settings on existing product while preserving unrelated fields", async () => {
      const res = await request(app)
        .patch(`/api/v1/products/${createdProduct._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          downloadLimit: 10,
          downloadExpiryDays: 60,
        });

      expect(res.status).toBe(200);
      const updated = await Product.findById(createdProduct._id);
      expect(updated.downloadLimit).toBe(10);
      expect(updated.downloadExpiryDays).toBe(60);
      expect(updated.isVirtual).toBe(true);
      expect(updated.isDownloadable).toBe(true);
      expect(updated.downloadableFiles).toHaveLength(1);
    });

    test("supports pure virtual products (no downloadable files, no physical shipping)", async () => {
      const res = await request(app)
        .post("/api/v1/products")
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          name: "Annual Cloud Consultation Service",
          slug: `annual-cloud-consultation-service-${Date.now()}`,
          sku: `VRT-SRV-${Date.now()}`,
          categoryId: testCategory._id.toString(),
          brandId: testBrand._id.toString(),
          price: 2999.0,
          currency: "INR",
          productType: "simple",
          isVirtual: true,
          isDownloadable: false,
        });

      expect(res.status).toBe(201);
      const prd = res.body?.data?.product;
      expect(prd.isVirtual).toBe(true);
      expect(prd.isDownloadable).toBe(false);
      expect(prd.downloadableFiles).toHaveLength(0);
    });
  });

  // ----------------------------------------------------
  // TEST SUITE 2: Secure Digital File Storage & Validation
  // ----------------------------------------------------
  describe("2. Secure Digital File Storage & Path Traversal Safeguards", () => {
    test("rejects dangerous executable files during upload", async () => {
      const res = await request(app)
        .post("/api/v1/products/digital-assets/upload")
        .set("Authorization", `Bearer ${vendorA.token}`)
        .attach("file", Buffer.from("malicious payload"), "script.exe");

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("DISALLOWED_FILE_TYPE");
    });

    test("rejects upload without authorization token", async () => {
      const res = await request(app)
        .post("/api/v1/products/digital-assets/upload")
        .attach("file", Buffer.from("legit content"), "book.pdf");

      expect(res.status).toBe(401);
    });

    test("accepts valid digital file upload and stores securely outside public directory", async () => {
      const res = await request(app)
        .post("/api/v1/products/digital-assets/upload")
        .set("Authorization", `Bearer ${vendorA.token}`)
        .attach("file", Buffer.from("%PDF-1.4 test document content"), "sample_guide.pdf");

      expect(res.status).toBe(201);
      const fileData = res.body?.data?.file;
      expect(fileData).toBeDefined();
      expect(fileData.storageKey).toMatch(/^dgt_\d+_[a-f0-9]+\.pdf$/);
      expect(fileData.fileUrl).toBe(`digital://${fileData.storageKey}`);

      // Verify file exists in backend/storage/digital-assets and NOT public/uploads
      const publicPath = path.resolve(__dirname, "../public/uploads", fileData.storageKey);
      expect(fs.existsSync(publicPath)).toBe(false);

      const privatePath = digitalStorageService.resolveSafePath(fileData.storageKey);
      expect(fs.existsSync(privatePath)).toBe(true);

      // Clean up
      await digitalStorageService.deleteDigitalAsset(fileData.storageKey);
    });

    test("prevents path traversal attempts when resolving storage paths", () => {
      expect(() => {
        digitalStorageService.resolveSafePath("../../etc/passwd");
      }).not.toThrow(); // path.basename strips directory components

      const safe = digitalStorageService.resolveSafePath("../../etc/passwd");
      expect(path.basename(safe)).toBe("passwd");
      expect(safe.startsWith(digitalStorageService.STORAGE_DIR)).toBe(true);
    });
  });

  // ----------------------------------------------------
  // TEST SUITE 3: Payment Capture & Entitlement Creation
  // ----------------------------------------------------
  describe("3. Payment Capture & Entitlement Creation Lifecycle", () => {
    let paidOrder;
    let digitalProduct;

    beforeAll(async () => {
      digitalProduct = await Product.create({
        name: "Cloud Architecture Blueprint 2026",
        slug: `blueprint-2026-${Date.now()}`,
        sku: `BLU-SKU-${Date.now()}`,
        categoryId: testCategory._id,
        brandId: testBrand._id,
        vendorId: vendorA.vendor._id,
        price: 999.0,
        currency: "INR",
        productType: "simple",
        isVirtual: true,
        isDownloadable: true,
        downloadLimit: 3,
        downloadExpiryDays: 14,
        status: "active",
        downloadableFiles: [
          {
            id: sampleDigitalAsset.id,
            name: "Architecture Blueprint PDF",
            fileUrl: `digital://${sampleDigitalAsset.storageKey}`,
            storageKey: sampleDigitalAsset.storageKey,
            fileSize: sampleDigitalAsset.fileSize,
            mimeType: sampleDigitalAsset.mimeType,
            version: "2.0",
          },
        ],
      });
    });

    function createTestOrderData(overrides = {}) {
      const variantId = overrides.variantId || new mongoose.Types.ObjectId();
      const vId = overrides.vendorId || vendorA.vendor._id;
      const pId = overrides.productId || digitalProduct._id;
      const itemTitle = overrides.productName || (digitalProduct ? digitalProduct.name : "Digital Product");
      const itemSku = overrides.sku || (digitalProduct ? digitalProduct.sku : `SKU-${Date.now()}`);

      return {
        orderNumber: `ORD-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
        customerId: customerProfile1._id,
        status: "pending",
        paymentStatus: "pending",
        currency: "INR",
        subtotal: "999.00",
        grandTotal: "999.00",
        shippingAddress: {
          fullName: "Customer c1",
          phone: "+919876543210",
          addressLine1: "42 Silicon Avenue",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
          country: "IN",
        },
        items: [
          {
            productId: pId,
            productVariantId: variantId,
            vendorId: vId,
            productName: itemTitle,
            sku: itemSku,
            quantity: 1,
            unitPrice: "999.00",
            lineTotal: "999.00",
            currency: "INR",
            isVirtual: true,
            isDownloadable: true,
            inventoryStatus: "not_required",
          },
        ],
        ...overrides,
      };
    }

    test("does not grant digital entitlements for unpaid or pending orders", async () => {
      const unpaidOrder = await Order.create(
        createTestOrderData({
          orderNumber: `ORD-UNPAID-${Date.now()}`,
          status: "pending",
          paymentStatus: "pending",
        })
      );

      const entitlements = await DigitalEntitlement.find({ orderId: unpaidOrder._id });
      expect(entitlements).toHaveLength(0);
    });

    test("idempotently creates digital download entitlements once payment is captured", async () => {
      paidOrder = await Order.create(
        createTestOrderData({
          orderNumber: `ORD-PAID-${Date.now()}`,
          status: "pending",
          paymentStatus: "pending",
        })
      );

      // Capture payment via authoritative order service
      const capturedOrder = await orderService.markOrderPaymentCaptured(paidOrder._id);
      expect(capturedOrder.paymentStatus).toBe("paid");
      expect(capturedOrder.status).toBe("confirmed");

      // Verify entitlement creation
      const entitlements = await DigitalEntitlement.find({ orderId: paidOrder._id });
      expect(entitlements).toHaveLength(1);

      const ent = entitlements[0];
      expect(ent.customerId.toString()).toBe(customerProfile1._id.toString());
      expect(ent.status).toBe("active");
      expect(ent.downloadLimit).toBe(3);
      expect(ent.downloadCount).toBe(0);
      expect(ent.asset.name).toBe("Architecture Blueprint PDF");
      expect(ent.expiresAt).toBeDefined();

      // Idempotency: Re-invoking capture must NOT create duplicate entitlements
      await orderService.markOrderPaymentCaptured(paidOrder._id);
      const afterDuplicate = await DigitalEntitlement.find({ orderId: paidOrder._id });
      expect(afterDuplicate).toHaveLength(1);
    });
  });

  // ----------------------------------------------------
  // TEST SUITE 4: Secure Download Delivery & Access Control
  // ----------------------------------------------------
  describe("4. Secure Download Delivery, Ownership & Limits", () => {
    let customer1Entitlement;

    beforeEach(async () => {
      // Find the latest entitlement created for customer 1
      customer1Entitlement = await DigitalEntitlement.findOne({
        customerId: customerProfile1._id,
      }).sort({ createdAt: -1 });
    });

    test("customer can list their own digital entitlements", async () => {
      const res = await request(app)
        .get("/api/v1/digital-downloads/my")
        .set("Authorization", `Bearer ${customerToken1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);

      const item = res.body.data.items[0];
      expect(item.id.toString()).toBe(customer1Entitlement._id.toString());
      expect(item.isAvailable).toBe(true);
      expect(item.downloadLimit).toBe(3);
      expect(item.downloadCount).toBe(0);
      expect(item.remainingDownloads).toBe(3);
    });

    test("cross-customer access is strictly rejected (customer 2 cannot download customer 1 file)", async () => {
      const res = await request(app)
        .get(`/api/v1/digital-downloads/${customer1Entitlement._id}`)
        .set("Authorization", `Bearer ${customerToken2}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN_DOWNLOAD_ACCESS");
    });

    test("unauthenticated download request is rejected", async () => {
      const res = await request(app).get(
        `/api/v1/digital-downloads/${customer1Entitlement._id}`
      );
      expect(res.status).toBe(401);
    });

    test("authorized customer successfully streams digital file and increments downloadCount", async () => {
      const res = await request(app)
        .get(`/api/v1/digital-downloads/${customer1Entitlement._id}`)
        .set("Authorization", `Bearer ${customerToken1}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
      expect(res.headers["content-disposition"]).toContain("attachment;");
      expect(res.headers["cache-control"]).toContain("no-store");

      // Verify atomic download count increment
      const updated = await DigitalEntitlement.findById(customer1Entitlement._id);
      expect(updated.downloadCount).toBe(1);
      expect(updated.downloadLogs).toHaveLength(1);
      expect(updated.downloadLogs[0].success).toBe(true);
    });

    test("enforces download limits atomically when limit is reached", async () => {
      // Entitlement has limit 3, currently at 1. Make 2 more downloads to reach 3.
      await request(app)
        .get(`/api/v1/digital-downloads/${customer1Entitlement._id}`)
        .set("Authorization", `Bearer ${customerToken1}`);

      await request(app)
        .get(`/api/v1/digital-downloads/${customer1Entitlement._id}`)
        .set("Authorization", `Bearer ${customerToken1}`);

      const exhaustedEntitlement = await DigitalEntitlement.findById(
        customer1Entitlement._id
      );
      expect(exhaustedEntitlement.downloadCount).toBe(3);
      expect(exhaustedEntitlement.status).toBe("exhausted");

      // 4th attempt must be rejected
      const blockedRes = await request(app)
        .get(`/api/v1/digital-downloads/${customer1Entitlement._id}`)
        .set("Authorization", `Bearer ${customerToken1}`);

      expect(blockedRes.status).toBe(403);
      expect(blockedRes.body.code).toBe("DOWNLOAD_LIMIT_EXHAUSTED");
    });

    test("enforces download expiration date", async () => {
      // Create an expired entitlement
      const expiredEntitlement = await DigitalEntitlement.create({
        customerId: customerProfile1._id,
        orderId: customer1Entitlement.orderId,
        orderItemId: customer1Entitlement.orderItemId,
        productId: customer1Entitlement.productId,
        productTitle: "Expired Masterclass",
        asset: customer1Entitlement.asset,
        downloadLimit: 10,
        downloadCount: 0,
        expiresAt: new Date(Date.now() - 10000), // Expired 10 seconds ago
        status: "active",
      });

      const res = await request(app)
        .get(`/api/v1/digital-downloads/${expiredEntitlement._id}`)
        .set("Authorization", `Bearer ${customerToken1}`);

      expect(res.status).toBe(410);
      expect(res.body.code).toBe("ENTITLEMENT_EXPIRED");
    });
  });

  // ----------------------------------------------------
  // TEST SUITE 5: Refund & Cancellation Revocation Policy
  // ----------------------------------------------------
  describe("5. Refund & Order Cancellation Revocation Policy", () => {
    let refundableOrder, refundableEntitlement;

    beforeAll(async () => {
      const varId = new mongoose.Types.ObjectId();
      const pId = new mongoose.Types.ObjectId();
      refundableOrder = await Order.create({
        orderNumber: `ORD-REFUND-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
        customerId: customerProfile1._id,
        status: "confirmed",
        paymentStatus: "paid",
        currency: "INR",
        subtotal: "499.00",
        grandTotal: "499.00",
        shippingAddress: {
          fullName: "Customer c1",
          phone: "+919876543210",
          addressLine1: "42 Silicon Avenue",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
          country: "IN",
        },
        items: [
          {
            productId: pId,
            productVariantId: varId,
            vendorId: vendorA.vendor._id,
            productName: "Refundable Guide",
            sku: `REF-${Date.now()}`,
            quantity: 1,
            unitPrice: "499.00",
            lineTotal: "499.00",
            currency: "INR",
            isVirtual: true,
            isDownloadable: true,
            inventoryStatus: "not_required",
          },
        ],
      });

      refundableEntitlement = await DigitalEntitlement.create({
        customerId: customerProfile1._id,
        orderId: refundableOrder._id,
        orderItemId: refundableOrder.items[0]._id,
        productId: refundableOrder.items[0].productId,
        productTitle: "Refundable Guide",
        asset: sampleDigitalAsset,
        downloadLimit: 5,
        downloadCount: 0,
        status: "active",
      });
    });

    test("order cancellation revokes all associated download entitlements", async () => {
      await orderService.transitionOrderStatus(refundableOrder._id, "cancelled", {
        cancellationReason: "Customer requested cancellation",
      });

      const revoked = await DigitalEntitlement.findById(refundableEntitlement._id);
      expect(revoked.status).toBe("revoked");
      expect(revoked.revokedAt).toBeDefined();
      expect(revoked.revocationReason).toBe("Customer requested cancellation");

      // Future download attempts must be rejected with 403
      const res = await request(app)
        .get(`/api/v1/digital-downloads/${refundableEntitlement._id}`)
        .set("Authorization", `Bearer ${customerToken1}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ENTITLEMENT_REVOKED");
    });

    test("administrator can inspect and manage digital entitlements", async () => {
      const listRes = await request(app)
        .get("/api/v1/digital-downloads/admin/all")
        .set("Authorization", `Bearer ${adminUser.token}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.items).toBeDefined();

      // Admin resets the revoked entitlement
      const resetRes = await request(app)
        .post(`/api/v1/digital-downloads/admin/${refundableEntitlement._id}/reset`)
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({ addDownloads: 5, extendDays: 30 });

      expect(resetRes.status).toBe(200);
      const restored = await DigitalEntitlement.findById(refundableEntitlement._id);
      expect(restored.status).toBe("active");
      expect(restored.downloadLimit).toBe(10);
    });

    test("unauthorized user cannot access administrator entitlement endpoints", async () => {
      const res = await request(app)
        .get("/api/v1/digital-downloads/admin/all")
        .set("Authorization", `Bearer ${customerToken1}`);

      expect(res.status).toBe(403);
    });
  });
});
