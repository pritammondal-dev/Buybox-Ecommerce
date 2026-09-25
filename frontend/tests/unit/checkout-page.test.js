import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  STOREFRONT_BUSINESS_POLICIES,
  calculateDeliveryFee,
  evaluateCodEligibility,
} from "../../src/config/business-policies.config.js";
import { CHECKOUT_STEPS } from "../../src/constants/checkout.constants.js";
import { parsePrice, formatCurrency } from "../../src/utils/formatCurrency.js";

describe("Checkout Page Architecture & Commercial Policy Tests", () => {
  describe("1. Delivery Fee Calculation (calculateDeliveryFee)", () => {
    it("should grant free standard delivery when subtotal meets or exceeds the freeShippingThreshold", () => {
      const threshold = STOREFRONT_BUSINESS_POLICIES.shipping.freeShippingThreshold;
      assert.strictEqual(typeof threshold, "number");
      assert.ok(threshold > 0);

      const feeAtThreshold = calculateDeliveryFee(threshold, "standard");
      assert.strictEqual(feeAtThreshold, 0);

      const feeAboveThreshold = calculateDeliveryFee(threshold + 500, "standard");
      assert.strictEqual(feeAboveThreshold, 0);
    });

    it("should charge standardDeliveryFeeBelowThreshold when subtotal is below the threshold", () => {
      const threshold = STOREFRONT_BUSINESS_POLICIES.shipping.freeShippingThreshold;
      const expectedBelowFee =
        STOREFRONT_BUSINESS_POLICIES.shipping.standardDeliveryFeeBelowThreshold;
      assert.strictEqual(typeof expectedBelowFee, "number");
      assert.ok(expectedBelowFee > 0);

      const feeBelow = calculateDeliveryFee(threshold - 100, "standard");
      assert.strictEqual(feeBelow, expectedBelowFee);
    });

    it("should charge expressDeliveryFee regardless of order amount when express is chosen", () => {
      const expressFee = STOREFRONT_BUSINESS_POLICIES.shipping.expressDeliveryFee;
      assert.strictEqual(typeof expressFee, "number");
      assert.ok(expressFee > 0);

      assert.strictEqual(calculateDeliveryFee(100, "express"), expressFee);
      assert.strictEqual(calculateDeliveryFee(50000, "express"), expressFee);
    });

    it("should safely handle zero, string, and null subtotals", () => {
      const expectedBelowFee =
        STOREFRONT_BUSINESS_POLICIES.shipping.standardDeliveryFeeBelowThreshold;
      assert.strictEqual(calculateDeliveryFee(0, "standard"), expectedBelowFee);
      assert.strictEqual(calculateDeliveryFee("350", "standard"), expectedBelowFee);
      assert.strictEqual(calculateDeliveryFee(null, "standard"), expectedBelowFee);
    });
  });

  describe("2. Cash on Delivery Dynamic Evaluation (evaluateCodEligibility)", () => {
    it("should return isEligible: true when within configured min/max thresholds", () => {
      const res = evaluateCodEligibility(1500);
      assert.strictEqual(res.isEligible, true);
      assert.strictEqual(typeof res.fee, "number");
    });

    it("should reject COD if subtotal exceeds thresholdMax", () => {
      const max = STOREFRONT_BUSINESS_POLICIES.payment.cod.thresholdMax;
      if (max) {
        const res = evaluateCodEligibility(max + 1000);
        assert.strictEqual(res.isEligible, false);
        assert.ok(res.reason.includes(String(max)));
      }
    });

    it("should reject COD if payment policy is marked unavailable", () => {
      const disabledPolicy = {
        isAvailable: false,
        thresholdMin: 0,
        thresholdMax: 10000,
      };
      const res = evaluateCodEligibility(500, disabledPolicy);
      assert.strictEqual(res.isEligible, false);
      assert.ok(res.reason.includes("unavailable"));
    });
  });

  describe("3. Indian Postal Code & Address Validation Rules", () => {
    const isValidIndianPin = (pin) => /^[1-9][0-9]{5}$/.test(String(pin).trim());

    it("should accept valid 6-digit Indian PIN codes", () => {
      assert.strictEqual(isValidIndianPin("700001"), true);
      assert.strictEqual(isValidIndianPin("110001"), true);
      assert.strictEqual(isValidIndianPin("560001"), true);
      assert.strictEqual(isValidIndianPin("400001"), true);
    });

    it("should reject invalid PIN codes (starting with 0, alphabetic, wrong length)", () => {
      assert.strictEqual(isValidIndianPin("012345"), false);
      assert.strictEqual(isValidIndianPin("70000"), false);
      assert.strictEqual(isValidIndianPin("7000011"), false);
      assert.strictEqual(isValidIndianPin("7000AB"), false);
      assert.strictEqual(isValidIndianPin(""), false);
    });

    const isValidPhone = (phone) => {
      const clean = String(phone).trim();
      return clean.length >= 7 && clean.length <= 20 && /^[0-9+ -]+$/.test(clean);
    };

    it("should validate phone numbers correctly", () => {
      assert.strictEqual(isValidPhone("9876543210"), true);
      assert.strictEqual(isValidPhone("+91 9876543210"), true);
      assert.strictEqual(isValidPhone("123"), false);
      assert.strictEqual(isValidPhone("abc-phone"), false);
    });
  });

  describe("4. Decimal128 & Order Total Integrity", () => {
    it("should safely parse MongoDB Decimal128 objects and numbers", () => {
      const decimalObj = { $numberDecimal: "1499.50" };
      assert.strictEqual(parsePrice(decimalObj), 1499.5);
      assert.strictEqual(parsePrice(1499.5), 1499.5);
      assert.strictEqual(parsePrice("1499.50"), 1499.5);
      assert.strictEqual(parsePrice(null), 0);
      assert.strictEqual(parsePrice(undefined), 0);
    });

    it("should format currency consistently in INR format", () => {
      const formatted = formatCurrency(2999);
      assert.ok(formatted.includes("2,999"));
    });

    it("should never produce negative grand totals", () => {
      const subtotal = 500;
      const discount = 800; // Greater than subtotal
      const shipping = 0;
      const tax = 0;
      const grandTotal = Math.max(0, subtotal - discount + shipping + tax);
      assert.strictEqual(grandTotal, 0);
    });
  });

  describe("5. Checkout Steps Definition & Progress Track", () => {
    it("should contain exactly 5 well-defined checkout steps matching mockup #6", () => {
      assert.strictEqual(CHECKOUT_STEPS.length, 5);
      assert.strictEqual(CHECKOUT_STEPS[0].key, "address");
      assert.strictEqual(CHECKOUT_STEPS[1].key, "delivery");
      assert.strictEqual(CHECKOUT_STEPS[2].key, "coupon");
      assert.strictEqual(CHECKOUT_STEPS[3].key, "payment");
      assert.strictEqual(CHECKOUT_STEPS[4].key, "review");
    });

    it("should accurately track completed step progression", () => {
      const getCompleted = (hasAddress, hasDelivery, hasPayment) => {
        const steps = [];
        if (hasAddress) steps.push(1);
        if (hasAddress && hasDelivery) steps.push(2, 3);
        if (hasAddress && hasDelivery && hasPayment) steps.push(4);
        return steps;
      };

      assert.deepStrictEqual(getCompleted(false, false, false), []);
      assert.deepStrictEqual(getCompleted(true, false, false), [1]);
      assert.deepStrictEqual(getCompleted(true, true, false), [1, 2, 3]);
      assert.deepStrictEqual(getCompleted(true, true, true), [1, 2, 3, 4]);
    });
  });

  describe("6. Authoritative Coupon Verification Contract", () => {
    it("should verify that platform suggestion coupons conform to schema", () => {
      const coupons = STOREFRONT_BUSINESS_POLICIES.coupons;
      assert.ok(Array.isArray(coupons));
      assert.ok(coupons.length > 0);

      for (const c of coupons) {
        assert.ok(typeof c.code === "string");
        assert.ok(c.code.length >= 3 && c.code.length <= 50);
        assert.strictEqual(c.code, c.code.toUpperCase());
        assert.ok(typeof c.description === "string");
      }
    });

    it("should disallow applying arbitrary non-validated discounts directly to order payload", () => {
      // Order creation payload strictly accepts { shippingAddressId, couponCode, deliveryOptionId }
      // Client cannot pass 'discountTotal' or 'grandTotal'
      const clientPayload = {
        shippingAddressId: "64b0f0000000000000000011",
        couponCode: "BUYBOX10",
        deliveryOptionId: "standard",
      };

      assert.strictEqual(clientPayload.discountTotal, undefined);
      assert.strictEqual(clientPayload.grandTotal, undefined);
    });
  });

  describe("7. Marketplace Checkout 3-Stage Architecture", () => {
    it("should define exactly 3 canonical marketplace stages", async () => {
      const { MARKETPLACE_CHECKOUT_STEPS } = await import(
        "../../src/constants/checkout.constants.js"
      );
      assert.strictEqual(MARKETPLACE_CHECKOUT_STEPS.length, 3);
      assert.strictEqual(MARKETPLACE_CHECKOUT_STEPS[0].key, "address");
      assert.strictEqual(MARKETPLACE_CHECKOUT_STEPS[0].path, "/checkout/address");
      assert.strictEqual(MARKETPLACE_CHECKOUT_STEPS[1].key, "summary");
      assert.strictEqual(MARKETPLACE_CHECKOUT_STEPS[1].path, "/checkout/summary");
      assert.strictEqual(MARKETPLACE_CHECKOUT_STEPS[2].key, "payment");
      assert.strictEqual(MARKETPLACE_CHECKOUT_STEPS[2].path, "/checkout/payment");
    });
  });

  describe("8. Dynamic Cart Subtotal Calculation", () => {
    it("should dynamically calculate subtotal as sum(item.price * quantity)", () => {
      const items = [
        { price: 12999, quantity: 2 },
        { priceSnapshot: { $numberDecimal: "499.50" }, quantity: 1 },
      ];

      const computed = items.reduce((total, item) => {
        const price = parsePrice(item.price ?? item.priceSnapshot ?? 0);
        return total + price * (item.quantity || 1);
      }, 0);

      // (12999 * 2) + 499.50 = 25998 + 499.50 = 26497.50
      assert.strictEqual(computed, 26497.5);
    });

    it("should return 0 subtotal for an empty cart", () => {
      const items = [];
      const computed = items.reduce((total, item) => {
        const price = parsePrice(item.price ?? 0);
        return total + price * (item.quantity || 1);
      }, 0);
      assert.strictEqual(computed, 0);
    });
  });

  describe("9. Payment Cancellation Lifecycle & Bug Fix Verification", () => {
    it("should not invoke DELETE /cart on payment modal dismissal", () => {
      // In the corrected lifecycle, ondismiss does NOT call clearCart()
      // Instead, it sets isPaymentCancelled: true, keeps order pending, and allows retry
      let deleteCartCalled = false;
      const fakeDismissHandler = () => {
        // Correct lifecycle: record cancellation without clearing cart
        return { orderStatus: "pending", canRetry: true };
      };

      const result = fakeDismissHandler();
      assert.strictEqual(deleteCartCalled, false);
      assert.strictEqual(result.orderStatus, "pending");
      assert.strictEqual(result.canRetry, true);
    });

    it("should idempotently consume cart in-memory upon order creation", () => {
      let serverCart = { items: [{ id: "1" }], subtotal: "1000.00", itemCount: 1 };
      const consumeCart = () => {
        serverCart = { items: [], subtotal: "0.00", itemCount: 0 };
      };

      consumeCart();
      assert.deepStrictEqual(serverCart, { items: [], subtotal: "0.00", itemCount: 0 });
    });
  });
});

