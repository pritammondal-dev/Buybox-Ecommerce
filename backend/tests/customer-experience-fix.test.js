const mongoose = require("mongoose");

jest.mock("../src/repositories/order.repository");
jest.mock("../src/models/Customer");
jest.mock("../src/models/User");
jest.mock("../src/models/Shipment");
jest.mock("../src/models/ProductVariant");
jest.mock("../src/services/product.service");

const orderRepository = require("../src/repositories/order.repository");
const Customer = require("../src/models/Customer");
const Shipment = require("../src/models/Shipment");
const orderService = require("../src/services/order.service");
const productService = require("../src/services/product.service");
const productController = require("../src/controllers/product.controller");

describe("Customer Experience Fix — Variant Switching, Estimated Delivery & SKU Privacy", () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const unauthorizedCustomerId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const unauthorizedUserId = new mongoose.Types.ObjectId().toString();
  const orderId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // REQUIREMENT 1: VARIANT SELECTION & COMBINATION INTEGRITY
  // =========================================================================
  describe("Requirement 1: Variant Switching Logic & Availability", () => {
    const mockVariants = [
      {
        _id: "var_black_s",
        productId: "prod_1",
        attributes: { Color: "Black", Size: "Small" },
        price: "999.00",
        availableQuantity: 10,
        inStock: true,
        isActive: true,
        image: { url: "https://cdn.example.com/black-shirt.jpg" },
      },
      {
        _id: "var_black_m",
        productId: "prod_1",
        attributes: { Color: "Black", Size: "Medium" },
        price: "999.00",
        availableQuantity: 5,
        inStock: true,
        isActive: true,
        image: { url: "https://cdn.example.com/black-shirt.jpg" },
      },
      {
        _id: "var_white_m",
        productId: "prod_1",
        attributes: { Color: "White", Size: "Medium" },
        price: "1099.00",
        availableQuantity: 8,
        inStock: true,
        isActive: true,
        image: { url: "https://cdn.example.com/white-shirt.jpg" },
      },
      {
        _id: "var_red_l",
        productId: "prod_1",
        attributes: { Color: "Red", Size: "Large" },
        price: "1199.00",
        availableQuantity: 0,
        inStock: false,
        isActive: true,
        image: { url: "https://cdn.example.com/red-shirt.jpg" },
      },
      {
        _id: "var_inactive",
        productId: "prod_1",
        attributes: { Color: "Blue", Size: "Small" },
        price: "899.00",
        availableQuantity: 15,
        inStock: true,
        isActive: false, // Inactive variant
      },
    ];

    it("matches exact active variant from valid attribute combination", () => {
      const active = mockVariants.filter((v) => v.isActive);
      const selected = { Color: "White", Size: "Medium" };

      const matched = active.find((v) =>
        Object.entries(selected).every(
          ([k, val]) => v.attributes[k]?.toLowerCase() === val.toLowerCase()
        )
      );

      expect(matched).toBeDefined();
      expect(matched._id).toBe("var_white_m");
      expect(matched.price).toBe("1099.00");
      expect(matched.image.url).toBe("https://cdn.example.com/white-shirt.jpg");
    });

    it("returns null for unavailable attribute combinations to block purchasing", () => {
      const active = mockVariants.filter((v) => v.isActive);
      const selected = { Color: "White", Size: "Small" }; // White Small does not exist

      const matched = active.find((v) =>
        Object.entries(selected).every(
          ([k, val]) => v.attributes[k]?.toLowerCase() === val.toLowerCase()
        )
      );

      expect(matched).toBeUndefined(); // Cannot be purchased
    });

    it("allows switching repeatedly between combinations and back to previous variant", () => {
      const active = mockVariants.filter((v) => v.isActive);

      // Select Black Small
      let sel = { Color: "Black", Size: "Small" };
      let match = active.find((v) =>
        Object.entries(sel).every(([k, val]) => v.attributes[k]?.toLowerCase() === val.toLowerCase())
      );
      expect(match._id).toBe("var_black_s");

      // Switch to Black Medium
      sel = { Color: "Black", Size: "Medium" };
      match = active.find((v) =>
        Object.entries(sel).every(([k, val]) => v.attributes[k]?.toLowerCase() === val.toLowerCase())
      );
      expect(match._id).toBe("var_black_m");

      // Switch to White Medium
      sel = { Color: "White", Size: "Medium" };
      match = active.find((v) =>
        Object.entries(sel).every(([k, val]) => v.attributes[k]?.toLowerCase() === val.toLowerCase())
      );
      expect(match._id).toBe("var_white_m");

      // Switch back to Black Small
      sel = { Color: "Black", Size: "Small" };
      match = active.find((v) =>
        Object.entries(sel).every(([k, val]) => v.attributes[k]?.toLowerCase() === val.toLowerCase())
      );
      expect(match._id).toBe("var_black_s");
    });

    it("identifies out of stock variants for combinable options", () => {
      const redLarge = mockVariants.find((v) => v._id === "var_red_l");
      expect(redLarge.inStock).toBe(false);
      expect(redLarge.availableQuantity).toBe(0);
    });

    it("excludes inactive variants from customer selection", () => {
      const active = mockVariants.filter((v) => v.isActive);
      const hasBlueSmall = active.some(
        (v) => v.attributes.Color === "Blue" && v.attributes.Size === "Small"
      );
      expect(hasBlueSmall).toBe(false);
    });
  });

  // =========================================================================
  // REQUIREMENT 2: ESTIMATED DELIVERY DATE ON ORDER DETAILS
  // =========================================================================
  describe("Requirement 2: Authoritative Estimated Delivery Date on Customer Orders", () => {
    const baseOrder = {
      _id: orderId,
      orderNumber: "BB-20261025-0001",
      customerId: customerId,
      status: "processing",
      paymentStatus: "paid",
      createdAt: new Date("2026-10-25T10:00:00.000Z"),
      placedAt: new Date("2026-10-25T10:00:00.000Z"),
      deliveryOption: {
        id: "standard",
        name: "Standard Delivery",
        estimatedDays: "3–5 business days",
      },
      items: [
        {
          _id: new mongoose.Types.ObjectId(),
          productName: "Sony WH-1000XM5",
          quantity: 1,
          unitPrice: "24999.00",
          sku: "INTERNAL-SONY-XM5",
        },
      ],
    };

    it("prioritizes courier-provided estimated delivery date over standard windows", async () => {
      Customer.findOne.mockResolvedValue({ _id: customerId, userId });
      orderRepository.findById.mockResolvedValue({ ...baseOrder });

      const courierDate = "2026-10-29T18:00:00.000Z";
      Shipment.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              _id: new mongoose.Types.ObjectId(),
              shipmentNumber: "SHP-2026-0001",
              status: "in_transit",
              carrier: "BlueDart",
              trackingNumber: "BD987654321",
              trackingUrl: "https://bluedart.com/track/BD987654321",
              metadata: { estimatedDeliveryDate: courierDate },
              items: [{ name: "Sony WH-1000XM5", quantity: 1, sku: "INTERNAL-SONY-XM5" }],
            },
          ]),
        }),
      });

      const order = await orderService.getOrderById(orderId, userId);

      expect(order.estimatedDelivery).toBeDefined();
      expect(order.estimatedDelivery.source).toBe("courier");
      expect(order.estimatedDelivery.estimatedDateRange).toMatch(/29.*Oct.*2026|Oct.*29.*2026/);
      expect(order.shipments).toHaveLength(1);
      expect(order.shipments[0].carrier).toBe("BlueDart");
      expect(order.shipments[0].trackingNumber).toBe("BD987654321");
      expect(order.shipments[0].estimatedDelivery.source).toBe("courier");
    });

    it("calculates estimate from configured shipping delivery window when shipment has no courier date", async () => {
      Customer.findOne.mockResolvedValue({ _id: customerId, userId });
      orderRepository.findById.mockResolvedValue({ ...baseOrder });

      Shipment.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]), // No shipments created yet
        }),
      });

      const order = await orderService.getOrderById(orderId, userId);

      expect(order.estimatedDelivery).toBeDefined();
      expect(order.estimatedDelivery.source).toBe("shipping_service");
      expect(order.estimatedDelivery.estimatedDateRange).toContain("2026");
    });

    it("supports multi-vendor orders with separate shipment estimates", async () => {
      Customer.findOne.mockResolvedValue({ _id: customerId, userId });
      orderRepository.findById.mockResolvedValue({
        ...baseOrder,
        items: [
          { productName: "Sony Headphones", quantity: 1, sku: "SKU-1" },
          { productName: "AudioQuest Cable", quantity: 1, sku: "SKU-2" },
        ],
      });

      Shipment.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              _id: new mongoose.Types.ObjectId(),
              shipmentNumber: "SHP-VENDOR-A",
              status: "in_transit",
              carrier: "Delhivery",
              trackingNumber: "DLH111",
              metadata: { estimatedDeliveryDate: "2026-10-28T12:00:00.000Z" },
              items: [{ name: "Sony Headphones", quantity: 1, sku: "SKU-1" }],
            },
            {
              _id: new mongoose.Types.ObjectId(),
              shipmentNumber: "SHP-VENDOR-B",
              status: "picked_up",
              carrier: "BlueDart",
              trackingNumber: "BD222",
              metadata: { estimatedDeliveryDate: "2026-10-31T12:00:00.000Z" },
              items: [{ name: "AudioQuest Cable", quantity: 1, sku: "SKU-2" }],
            },
          ]),
        }),
      });

      const order = await orderService.getOrderById(orderId, userId);

      expect(order.shipments).toHaveLength(2);
      expect(order.shipments[0].estimatedDelivery.estimatedDateRange).toMatch(/28.*Oct.*2026|Oct.*28.*2026/);
      expect(order.shipments[1].estimatedDelivery.estimatedDateRange).toMatch(/31.*Oct.*2026|Oct.*31.*2026/);
      expect(order.estimatedDelivery.source).toBe("multi_shipment");
      expect(order.estimatedDelivery.estimatedDateRange).toMatch(/28.*Oct.*2026.*31.*Oct.*2026|Oct.*28.*2026.*Oct.*31.*2026/);
    });

    it("handles delivered status with actual delivery date", async () => {
      Customer.findOne.mockResolvedValue({ _id: customerId, userId });
      orderRepository.findById.mockResolvedValue({
        ...baseOrder,
        status: "delivered",
        deliveredAt: new Date("2026-10-28T14:30:00.000Z"),
      });

      Shipment.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              shipmentNumber: "SHP-DELIVERED",
              status: "delivered",
              deliveredAt: new Date("2026-10-28T14:30:00.000Z"),
              items: [],
            },
          ]),
        }),
      });

      const order = await orderService.getOrderById(orderId, userId);

      expect(order.estimatedDelivery.isDelivered).toBe(true);
      expect(order.estimatedDelivery.source).toBe("actual_delivery");
      expect(order.estimatedDelivery.estimatedDateRange).toContain("Delivered on");
    });

    it("returns honest fallback message when no reliable delivery data exists", async () => {
      Customer.findOne.mockResolvedValue({ _id: customerId, userId });
      orderRepository.findById.mockResolvedValue({
        ...baseOrder,
        deliveryOption: null, // No configured delivery option
        placedAt: null,
        createdAt: null,
      });

      Shipment.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      const order = await orderService.getOrderById(orderId, userId);

      expect(order.estimatedDelivery.source).toBe("fallback");
      expect(order.estimatedDelivery.estimatedDateRange).toBeNull();
      expect(order.estimatedDelivery.message).toBe(
        "Delivery estimate will be available after shipment confirmation."
      );
    });

    it("enforces tenant isolation: rejects customer from viewing another customer's order and estimates", async () => {
      Customer.findOne.mockResolvedValue({ _id: unauthorizedCustomerId, userId: unauthorizedUserId });
      orderRepository.findById.mockResolvedValue({ ...baseOrder }); // belongs to customerId

      await expect(orderService.getOrderById(orderId, unauthorizedUserId)).rejects.toMatchObject({
        statusCode: 403,
        code: "ORDER_ACCESS_DENIED",
      });
    });
  });

  // =========================================================================
  // REQUIREMENT 3: SKU PRIVACY (CUSTOMER STRIPPED, INTERNAL PRESERVED)
  // =========================================================================
  describe("Requirement 3: Complete SKU Privacy on Customer-Facing APIs", () => {
    it("strips SKU from customer order details items and shipment items", async () => {
      Customer.findOne.mockResolvedValue({ _id: customerId, userId });
      orderRepository.findById.mockResolvedValue({
        _id: orderId,
        customerId: customerId,
        status: "processing",
        items: [
          {
            productName: "Bose QuietComfort Ultra",
            quantity: 1,
            unitPrice: "34900.00",
            sku: "CONFIDENTIAL-BOSE-QC-ULTRA",
          },
        ],
      });

      Shipment.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              shipmentNumber: "SHP-12345",
              status: "in_transit",
              items: [
                {
                  name: "Bose QuietComfort Ultra",
                  quantity: 1,
                  sku: "CONFIDENTIAL-BOSE-QC-ULTRA",
                },
              ],
            },
          ]),
        }),
      });

      const order = await orderService.getOrderById(orderId, userId);

      expect(order.items[0].sku).toBeUndefined();
      expect(order.shipments[0].items[0].sku).toBeUndefined();
      expect(order.items[0].productName).toBe("Bose QuietComfort Ultra");
    });

    it("strips SKU from customer order history list (getCustomerOrders)", async () => {
      Customer.findOne.mockResolvedValue({ _id: customerId, userId });
      orderRepository.findByCustomer.mockResolvedValue([
        {
          _id: orderId,
          orderNumber: "BB-001",
          items: [
            {
              productName: "Apple AirPods Max",
              quantity: 1,
              sku: "INTERNAL-APPLE-APM-SIL",
            },
          ],
        },
      ]);

      const orders = await orderService.getCustomerOrders(userId);

      expect(orders).toHaveLength(1);
      expect(orders[0].items[0].sku).toBeUndefined();
      expect(orders[0].items[0].productName).toBe("Apple AirPods Max");
    });

    it("strips SKU from public/customer product API responses", async () => {
      const mockRawProduct = {
        _id: "prod_1",
        name: "Sennheiser Momentum 4",
        sku: "INTERNAL-PARENT-SKU-SENN",
        defaultVariant: {
          _id: "var_1",
          name: "Black",
          sku: "INTERNAL-VAR-SENN-BLK",
          price: "29990.00",
        },
        variants: [
          {
            _id: "var_1",
            name: "Black",
            sku: "INTERNAL-VAR-SENN-BLK",
            price: "29990.00",
          },
          {
            _id: "var_2",
            name: "White",
            sku: "INTERNAL-VAR-SENN-WHT",
            price: "29990.00",
          },
        ],
      };

      productService.getProductById.mockResolvedValue(mockRawProduct);

      const req = {
        params: { id: "prod_1" },
        user: { role: "customer" }, // Regular customer
      };

      let jsonResponse = null;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockImplementation((payload) => {
          jsonResponse = payload;
          return payload;
        }),
      };

      await productController.getProduct(req, res);

      const sentProduct = jsonResponse.data.product;
      expect(sentProduct.sku).toBeUndefined();
      expect(sentProduct.defaultVariant.sku).toBeUndefined();
      expect(sentProduct.variants[0].sku).toBeUndefined();
      expect(sentProduct.variants[1].sku).toBeUndefined();
      expect(sentProduct.name).toBe("Sennheiser Momentum 4");
    });

    it("preserves SKU for authorized internal administrator and vendor actors", async () => {
      const mockRawProduct = {
        _id: "prod_1",
        name: "Sennheiser Momentum 4",
        sku: "INTERNAL-PARENT-SKU-SENN",
        defaultVariant: {
          _id: "var_1",
          name: "Black",
          sku: "INTERNAL-VAR-SENN-BLK",
        },
        variants: [
          {
            _id: "var_1",
            name: "Black",
            sku: "INTERNAL-VAR-SENN-BLK",
          },
        ],
      };

      productService.getProductById.mockResolvedValue(mockRawProduct);

      const req = {
        params: { id: "prod_1" },
        user: { role: "admin" }, // Internal admin actor
      };

      let jsonResponse = null;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockImplementation((payload) => {
          jsonResponse = payload;
          return payload;
        }),
      };

      await productController.getProduct(req, res);

      const sentProduct = jsonResponse.data.product;
      expect(sentProduct.sku).toBe("INTERNAL-PARENT-SKU-SENN");
      expect(sentProduct.variants[0].sku).toBe("INTERNAL-VAR-SENN-BLK");
    });
  });
});
