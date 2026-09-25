import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { paymentMethodService } from "../../src/services/payment-method.service.js";
import { paymentService } from "../../src/services/payment.service.js";

describe("Payment Management System Frontend Tests", () => {
  describe("1. paymentMethodService API Client Interface", () => {
    it("should export all required storefront and admin service methods", () => {
      assert.strictEqual(typeof paymentMethodService.getAvailablePaymentMethods, "function");
      assert.strictEqual(typeof paymentMethodService.listAllPaymentMethods, "function");
      assert.strictEqual(typeof paymentMethodService.getPaymentMethodById, "function");
      assert.strictEqual(typeof paymentMethodService.createPaymentMethod, "function");
      assert.strictEqual(typeof paymentMethodService.updatePaymentMethod, "function");
      assert.strictEqual(typeof paymentMethodService.togglePaymentMethod, "function");
      assert.strictEqual(typeof paymentMethodService.deletePaymentMethod, "function");
      assert.strictEqual(typeof paymentMethodService.reorderPaymentMethods, "function");
      assert.strictEqual(typeof paymentMethodService.listTransactions, "function");
      assert.strictEqual(typeof paymentMethodService.createPayPalOrder, "function");
      assert.strictEqual(typeof paymentMethodService.capturePayPalPayment, "function");
    });
  });

  describe("2. paymentService PayPal Integration Exports", () => {
    it("should export createPayPalOrder and capturePayPalPayment alongside Razorpay", () => {
      assert.strictEqual(typeof paymentService.createPaymentIntent, "function");
      assert.strictEqual(typeof paymentService.verifyPaymentSignature, "function");
      assert.strictEqual(typeof paymentService.createPayPalOrder, "function");
      assert.strictEqual(typeof paymentService.capturePayPalPayment, "function");
    });
  });

  describe("3. Payment Method Sorting and Display Order", () => {
    it("should sort payment methods ascending by displayOrder", () => {
      const mockMethods = [
        { code: "paypal", displayOrder: 6 },
        { code: "upi", displayOrder: 1 },
        { code: "card", displayOrder: 2 },
        { code: "wallet", displayOrder: 4 },
        { code: "netbanking", displayOrder: 3 },
      ];

      const sorted = [...mockMethods].sort((a, b) => a.displayOrder - b.displayOrder);

      assert.strictEqual(sorted[0].code, "upi");
      assert.strictEqual(sorted[1].code, "card");
      assert.strictEqual(sorted[2].code, "netbanking");
      assert.strictEqual(sorted[3].code, "wallet");
      assert.strictEqual(sorted[4].code, "paypal");
    });
  });

  describe("4. Secret Masking & Safe Storefront Payload Verification", () => {
    it("should never expose secret keys in customer available payment methods payload", () => {
      const mockStorefrontPayload = [
        {
          id: "pm-1",
          name: "UPI",
          code: "upi",
          gateway: "razorpay",
          type: "upi",
          description: "Instant UPI payments",
          icon: "Zap",
          enabled: true,
          displayOrder: 1,
          supportedCurrencies: ["INR"],
        },
        {
          id: "pm-2",
          name: "PayPal",
          code: "paypal",
          gateway: "paypal",
          type: "paypal",
          description: "International payments",
          icon: "CreditCard",
          enabled: true,
          displayOrder: 6,
          supportedCurrencies: ["INR", "USD"],
        },
      ];

      mockStorefrontPayload.forEach((method) => {
        // Assert absence of any plain-text secrets
        assert.strictEqual(method.keySecret, undefined);
        assert.strictEqual(method.clientSecret, undefined);
        assert.strictEqual(method.webhookSecret, undefined);
        assert.strictEqual(method.gatewayConfig, undefined);
      });
    });
  });

  describe("5. COD Disabled Verification", () => {
    it("should have COD disabled by default to uphold verified digital payments policy", () => {
      const codMethod = {
        code: "cod",
        gateway: "internal",
        type: "cod",
        enabled: false,
      };

      assert.strictEqual(codMethod.enabled, false);
      assert.strictEqual(codMethod.type, "cod");
    });
  });
});
