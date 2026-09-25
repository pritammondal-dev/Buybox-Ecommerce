const mongoose = require("mongoose");
const orderService = require("../src/services/order.service");
const paymentService = require("../src/services/payment.service");
const { DELIVERY_OPTIONS, resolveDeliveryOption } = orderService;

describe("Checkout Redesign & Payment Lifecycle Backend Unit Tests", () => {
  describe("1. Delivery Option Resolution & Pricing", () => {
    it("should resolve standard delivery as free when subtotal >= ₹499", () => {
      const option = resolveDeliveryOption("standard", 50000); // 50000 minor units = ₹500
      expect(option.id).toBe("standard");
      expect(option.feeMinorUnits).toBe(0);
      expect(option.cost).toBe("0.00");
    });

    it("should resolve standard delivery with ₹40 fee when subtotal < ₹499", () => {
      const option = resolveDeliveryOption("standard", 35000); // ₹350
      expect(option.id).toBe("standard");
      expect(option.feeMinorUnits).toBe(4000);
      expect(option.cost).toBe("40.00");
    });

    it("should resolve express delivery with ₹99 fee regardless of subtotal", () => {
      const option1 = resolveDeliveryOption("express", 100000);
      expect(option1.id).toBe("express");
      expect(option1.feeMinorUnits).toBe(9900);
      expect(option1.cost).toBe("99.00");

      const option2 = resolveDeliveryOption("express", 10000);
      expect(option2.id).toBe("express");
      expect(option2.feeMinorUnits).toBe(9900);
      expect(option2.cost).toBe("99.00");
    });

    it("should default to standard delivery if unrecognized option provided", () => {
      const option = resolveDeliveryOption("unknown_carrier", 60000);
      expect(option.id).toBe("standard");
      expect(option.feeMinorUnits).toBe(0);
    });
  });

  describe("2. Authoritative Order Totals Calculation", () => {
    it("should calculate grandTotal dynamically including shipping fee", () => {
      const orderItems = [
        {
          lineTotal: mongoose.Types.Decimal128.fromString("1000.00"),
          quantity: 1,
        },
      ];
      // 1000 subtotal + 99 shipping (9900 minor units) = 1099
      const totals = orderService.calculateOrderTotals(
        orderItems,
        "INR",
        0,
        null,
        9900
      );
      expect(totals.subtotal).toBe("1000.00");
      expect(totals.shippingTotal).toBe("99.00");
      expect(totals.grandTotal).toBe("1099.00");
    });

    it("should calculate grandTotal with coupon discount and shipping fee", () => {
      const orderItems = [
        {
          lineTotal: mongoose.Types.Decimal128.fromString("2000.00"),
          quantity: 1,
        },
      ];
      // 2000 subtotal - 200 coupon (20000 minor units) + 40 shipping (4000 minor units) = 1840
      const totals = orderService.calculateOrderTotals(
        orderItems,
        "INR",
        20000,
        null,
        4000
      );
      expect(totals.subtotal).toBe("2000.00");
      expect(totals.discountTotal).toBe("200.00");
      expect(totals.shippingTotal).toBe("40.00");
      expect(totals.grandTotal).toBe("1840.00");
    });
  });

  describe("3. Order Model Schema & Lifecycle Extensions", () => {
    it("should export calculateCheckoutQuote and getOrderActivity from order.service", () => {
      expect(typeof orderService.calculateCheckoutQuote).toBe("function");
      expect(typeof orderService.getOrderActivity).toBe("function");
    });

    it("should export recordPaymentCancellation from payment.service", () => {
      expect(typeof paymentService.recordPaymentCancellation).toBe("function");
    });
  });
});
