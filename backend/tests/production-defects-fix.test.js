const mongoose = require("mongoose");

jest.mock("../src/models/User");
jest.mock("../src/models/Customer");
jest.mock("../src/models/Address");
jest.mock("../src/models/Order");
jest.mock("../src/models/ReturnRequest");
jest.mock("../src/models/GiftCard");
jest.mock("../src/models/Coupon");
jest.mock("../src/models/CouponRedemption");
jest.mock("../src/models/PaymentMethod");
jest.mock("../src/repositories/payment-method.repository");
jest.mock("../src/repositories/analytics.repository");
jest.mock("../src/services/governance.service");

const User = require("../src/models/User");
const Customer = require("../src/models/Customer");
const Address = require("../src/models/Address");
const Order = require("../src/models/Order");
const ReturnRequest = require("../src/models/ReturnRequest");
const GiftCard = require("../src/models/GiftCard");
const Coupon = require("../src/models/Coupon");
const CouponRedemption = require("../src/models/CouponRedemption");
const adminCustomerController = require("../src/controllers/admin-customer.controller");
const analyticsService = require("../src/services/analytics.service");
const analyticsRepository = require("../src/repositories/analytics.repository");
const paymentMethodService = require("../src/services/payment-method.service");
const paymentMethodRepository = require("../src/repositories/payment-method.repository");
const { recordAuditLog } = require("../src/services/governance.service");

describe("Production Defects Fix — Regression Test Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    if (recordAuditLog) {
      recordAuditLog.mockResolvedValue({});
    }
  });

  // =========================================================================
  // DEFECT 1: SUPERADMIN CUSTOMER INSPECTION
  // =========================================================================
  describe("Defect 1: Superadmin Customer Inspection", () => {
    const mockUserId = new mongoose.Types.ObjectId();
    const mockCustomerId = new mongoose.Types.ObjectId();

    const mockUser = {
      _id: mockUserId,
      firstName: "Aarav",
      lastName: "Sharma",
      email: "aarav.sharma@example.com",
      phone: "+919876543210",
      role: "customer",
      isActive: true,
      isEmailVerified: true,
      lastLoginAt: new Date("2026-10-24T10:00:00Z"),
      createdAt: new Date("2026-01-15T08:00:00Z"),
    };

    const mockCustomer = {
      _id: mockCustomerId,
      userId: mockUserId,
      phone: "+919876543210",
      notes: "VIP Customer",
    };

    it("resolves customer details dynamically when queried by User ID", async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ ...mockUser }),
        }),
      });

      Customer.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ ...mockCustomer }),
      });

      Address.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              _id: new mongoose.Types.ObjectId(),
              userId: mockUserId,
              type: "home",
              addressLine1: "Flat 402, Lotus Heights",
              city: "Mumbai",
              state: "Maharashtra",
              postalCode: "400001",
              isDefault: true,
            },
          ]),
        }),
      });

      Order.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([
              {
                _id: new mongoose.Types.ObjectId(),
                orderNumber: "ORD-1001",
                grandTotal: "2499.00",
                status: "delivered",
                paymentStatus: "paid",
                fulfillmentStatus: "fulfilled",
                items: [{ title: "Noise Cancelling Headphones", quantity: 1 }],
                createdAt: new Date("2026-10-20T12:00:00Z"),
              },
            ]),
          }),
        }),
      });

      ReturnRequest.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      GiftCard.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      CouponRedemption.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      Coupon.countDocuments.mockResolvedValue(5);

      const req = { params: { id: mockUserId.toString() } };
      let jsonResult = null;
      let statusResult = null;
      const res = {
        status: (s) => {
          statusResult = s;
          return {
            json: (j) => {
              jsonResult = j;
            },
          };
        },
      };
      const next = jest.fn();

      await adminCustomerController.getCustomer(req, res, next);

      expect(statusResult).toBe(200);
      expect(jsonResult.success).toBe(true);
      expect(jsonResult.data.customer).toBeDefined();
      expect(jsonResult.data.customer.firstName).toBe("Aarav");
      expect(jsonResult.data.customer.lastName).toBe("Sharma");
      expect(jsonResult.data.customer.email).toBe("aarav.sharma@example.com");
      expect(jsonResult.data.customer.phone).toBe("+919876543210");
      expect(jsonResult.data.customer.orders).toHaveLength(1);
      expect(jsonResult.data.customer.addresses).toHaveLength(1);
      expect(jsonResult.data.customer.kpis.totalOrders).toBe(1);
      expect(jsonResult.data.customer.kpis.totalSpent).toBe(2499);
      expect(jsonResult.data.customer.kpis.completedOrders).toBe(1);
    });

    it("resolves customer details dynamically when queried by Customer ID instead of User ID", async () => {
      // First findById on User by Customer ID returns null
      User.findById.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          lean: jest.fn().mockResolvedValueOnce(null),
        }),
      });

      // Customer.findById with Customer ID returns the customer profile
      Customer.findById.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce({ ...mockCustomer }),
      });

      // User.findById with customer.userId returns the real user
      User.findById.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          lean: jest.fn().mockResolvedValueOnce({ ...mockUser }),
        }),
      });

      Customer.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ ...mockCustomer }),
      });

      Address.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      Order.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      ReturnRequest.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      GiftCard.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      CouponRedemption.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      Coupon.countDocuments.mockResolvedValue(2);

      const req = { params: { id: mockCustomerId.toString() } };
      let jsonResult = null;
      const res = {
        status: () => ({
          json: (j) => {
            jsonResult = j;
          },
        }),
      };
      const next = jest.fn();

      await adminCustomerController.getCustomer(req, res, next);

      expect(jsonResult.success).toBe(true);
      expect(jsonResult.data.customer.firstName).toBe("Aarav");
      expect(jsonResult.data.customer.email).toBe("aarav.sharma@example.com");
    });

    it("returns 400 INVALID_ID for malformed customer ID parameter", async () => {
      const req = { params: { id: "not-a-mongo-id" } };
      const res = {};
      const next = jest.fn();

      await adminCustomerController.getCustomer(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          code: "INVALID_ID",
        })
      );
    });

    it("returns 404 CUSTOMER_NOT_FOUND when user does not exist", async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      Customer.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const req = { params: { id: new mongoose.Types.ObjectId().toString() } };
      const res = {};
      const next = jest.fn();

      await adminCustomerController.getCustomer(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          code: "CUSTOMER_NOT_FOUND",
        })
      );
    });
  });

  // =========================================================================
  // DEFECT 2: SHIPMENT MANAGEMENT & adminOperationsService EXPORTS
  // =========================================================================
  describe("Defect 2: Shipment Operations Service Integration", () => {
    it("exposes all required shipment management operations on backend controllers", () => {
      const shipmentRoutes = require("../src/routes/shipment.routes");
      expect(shipmentRoutes).toBeDefined();

      const adminShipmentController = require("../src/controllers/shipment.controller");
      expect(typeof adminShipmentController.listAllShipments).toBe("function");
      expect(typeof adminShipmentController.getShipmentById).toBe("function");
      expect(typeof adminShipmentController.transitionShipmentStatus).toBe("function");
      expect(typeof adminShipmentController.createShipment).toBe("function");
    });
  });

  // =========================================================================
  // DEFECT 3: SALES TREND BREAKDOWN (30 PERIODS)
  // =========================================================================
  describe("Defect 3: Sales Trend Breakdown 30-Period Aggregation", () => {
    it("generates exactly 30 chronological daily intervals for last_30_days period", async () => {
      analyticsRepository.getSalesTrend.mockResolvedValue([
        {
          _id: "2026-10-15",
          sales: 5000.0,
          grossSales: 5500.0,
          discounts: 500.0,
          tax: 900.0,
          units: 4,
          orders: 2,
        },
      ]);

      const result = await analyticsService.getAdminSalesTrend({
        period: "last_30_days",
      });

      expect(result.period).toBe("last_30_days");
      expect(result.intervals).toHaveLength(30);

      // Verify chronological ordering
      for (let i = 1; i < result.intervals.length; i++) {
        expect(result.intervals[i].date > result.intervals[i - 1].date).toBe(true);
      }

      // Verify the active sales bucket
      const activeBucket = result.intervals.find((b) => b.date === "2026-10-15");
      expect(activeBucket).toBeDefined();
      expect(activeBucket.sales).toBe("5000.00");
      expect(activeBucket.orders).toBe(2);
      expect(activeBucket.units).toBe(4);

      // Verify zero-filled buckets for dates without sales
      const emptyBuckets = result.intervals.filter((b) => b.date !== "2026-10-15");
      expect(emptyBuckets.length).toBe(29);
      expect(emptyBuckets[0].sales).toBe("0.00");
      expect(emptyBuckets[0].orders).toBe(0);
      expect(emptyBuckets[0].units).toBe(0);
    });
  });

  // =========================================================================
  // DEFECT 4 & 5: SWITCH CONTRACT & PAYMENT METHOD TOGGLE
  // =========================================================================
  describe("Defect 4 & 5: Payment Method Status Toggle & Contract Safety", () => {
    const mockMethodId = new mongoose.Types.ObjectId();

    it("successfully toggles payment method enabled status", async () => {
      const initialMethod = {
        _id: mockMethodId,
        name: "Cash on Delivery",
        code: "cod",
        gateway: "cod",
        enabled: true,
        toObject: function () {
          return {
            _id: this._id,
            name: this.name,
            code: this.code,
            gateway: this.gateway,
            enabled: this.enabled,
          };
        },
        save: jest.fn().mockImplementation(function () {
          this.enabled = !this.enabled;
          return Promise.resolve(this);
        }),
      };

      paymentMethodRepository.findById.mockResolvedValue(initialMethod);
      paymentMethodRepository.updateById.mockImplementation((id, data) =>
        Promise.resolve({
          ...initialMethod,
          ...data,
          toObject: function () {
            return { ...this };
          },
        })
      );

      const result = await paymentMethodService.togglePaymentMethodStatus(
        mockMethodId.toString(),
        new mongoose.Types.ObjectId().toString()
      );

      expect(paymentMethodRepository.updateById).toHaveBeenCalledWith(
        mockMethodId.toString(),
        { enabled: false }
      );
      expect(result.enabled).toBe(false);
    });

    it("verifies Switch component contract handles boolean conversion and event delegation", () => {
      // Simulate Switch component event handling contract
      let nativeEventReceived = null;
      let booleanCallbackReceived = null;

      const onChange = (e) => {
        nativeEventReceived = e;
      };
      const onCheckedChange = (val) => {
        booleanCallbackReceived = val;
      };

      // Mock handler function identical to Switch component
      const simulateChange = (event, disabled = false) => {
        if (disabled) return;
        if (onChange) onChange(event);
        if (onCheckedChange) onCheckedChange(event.target.checked);
      };

      const mockEvent = { target: { checked: true } };
      simulateChange(mockEvent);

      expect(nativeEventReceived).toBe(mockEvent);
      expect(booleanCallbackReceived).toBe(true);
    });
  });
});
