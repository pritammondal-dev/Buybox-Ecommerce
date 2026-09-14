const mongoose = require("mongoose");
const shipmentService = require("../src/services/shipment.service");
const shipmentRepository = require("../src/repositories/shipment.repository");
const Customer = require("../src/models/Customer");

jest.mock("../src/repositories/shipment.repository");
jest.mock("../src/models/Customer");

describe("Shipment Tracking Authorization & Sanitization Contract (Phase 7)", () => {
  const mockTrackingNumber = "TRACK-BUYBOX-12345";
  const mockCustomerId = new mongoose.Types.ObjectId();
  const mockOtherCustomerId = new mongoose.Types.ObjectId();
  const mockCustomerUserId = new mongoose.Types.ObjectId().toString();
  const mockOtherUserId = new mongoose.Types.ObjectId().toString();
  const mockAdminUserId = new mongoose.Types.ObjectId().toString();

  const mockShipment = {
    _id: new mongoose.Types.ObjectId(),
    shipmentNumber: "SHP-2026-001",
    trackingNumber: mockTrackingNumber,
    customerId: mockCustomerId,
    vendorId: new mongoose.Types.ObjectId(),
    warehouseId: new mongoose.Types.ObjectId(),
    idempotencyKey: "secret-internal-idempotency-key",
    inventoryStatus: "deducted",
    inventoryReleasedAt: null,
    status: "in_transit",
    carrier: "BlueDart",
    serviceLevel: "Express",
    trackingUrl: "https://bluedart.com/track/12345",
    metadata: { internalDispatchNotes: "Gate 4 priority package" },
    shippingAddress: {
      fullName: "Pritam Mondal",
      city: "Kolkata",
      state: "West Bengal",
      postalCode: "700001",
      country: "India",
    },
    items: [
      {
        name: "Buybox Wireless Headphones",
        sku: "WH-1000XM4-BLK",
        quantity: 1,
      },
    ],
    shippedAt: new Date("2026-09-10T10:00:00Z"),
    deliveredAt: null,
    cancelledAt: null,
    returnedAt: null,
    createdAt: new Date("2026-09-09T08:00:00Z"),
    updatedAt: new Date("2026-09-10T10:00:00Z"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("1. admin / privileged user retrieves full shipment details including internal metadata", async () => {
    shipmentRepository.findByTrackingNumber.mockResolvedValue(mockShipment);

    const adminUser = {
      id: mockAdminUserId,
      role: "admin",
    };

    const result = await shipmentService.getShipmentByTrackingNumber(
      mockTrackingNumber,
      adminUser
    );

    expect(result.trackingNumber).toBe(mockTrackingNumber);
    expect(result.idempotencyKey).toBe("secret-internal-idempotency-key");
    expect(result.inventoryStatus).toBe("deducted");
    expect(result.metadata).toBeDefined();
  });

  it("2. customer owner retrieves tracking with internal operational metadata sanitized", async () => {
    shipmentRepository.findByTrackingNumber.mockResolvedValue(mockShipment);
    Customer.findOne.mockResolvedValue({
      _id: mockCustomerId,
      userId: mockCustomerUserId,
      isActive: true,
    });

    const customerUser = {
      id: mockCustomerUserId,
      role: "customer",
    };

    const result = await shipmentService.getShipmentByTrackingNumber(
      mockTrackingNumber,
      customerUser
    );

    expect(result.trackingNumber).toBe(mockTrackingNumber);
    expect(result.status).toBe("in_transit");
    expect(result.carrier).toBe("BlueDart");
    expect(result.shippingAddress.fullName).toBe("Pritam Mondal");
    // Internal metadata MUST be stripped
    expect(result.idempotencyKey).toBeUndefined();
    expect(result.inventoryStatus).toBeUndefined();
    expect(result.metadata).toBeUndefined();
    expect(result.warehouseId).toBeUndefined();
    expect(result.vendorId).toBeUndefined();
  });

  it("3. customer requesting someone else's shipment gets 404 SHIPMENT_NOT_FOUND", async () => {
    shipmentRepository.findByTrackingNumber.mockResolvedValue(mockShipment);
    Customer.findOne.mockResolvedValue({
      _id: mockOtherCustomerId, // Does NOT match mockShipment.customerId
      userId: mockOtherUserId,
      isActive: true,
    });

    const otherUser = {
      id: mockOtherUserId,
      role: "customer",
    };

    await expect(
      shipmentService.getShipmentByTrackingNumber(mockTrackingNumber, otherUser)
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "SHIPMENT_NOT_FOUND",
    });
  });

  it("4. rejects empty or invalid tracking number with 400 INVALID_TRACKING_NUMBER", async () => {
    await expect(
      shipmentService.getShipmentByTrackingNumber("   ", { role: "customer" })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "INVALID_TRACKING_NUMBER",
    });
  });
});
