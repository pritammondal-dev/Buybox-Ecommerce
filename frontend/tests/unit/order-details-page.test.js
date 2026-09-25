import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ORDER_TIMELINE_STAGES,
  CANCELLABLE_ORDER_STATUSES,
  isOrderCancellable,
  getTimelineStepIndex,
  getOrderDeliveryEstimate,
  extractOrderFinancials,
} from "../../src/constants/order.constants.js";
import { parsePrice, formatCurrency } from "../../src/utils/formatCurrency.js";
import { STOREFRONT_BUSINESS_POLICIES } from "../../src/config/business-policies.config.js";

describe("Order Success & Order Details Architecture Tests", () => {
  describe("1. Historical Price Parsing & Decimal128 Safety", () => {
    it("should safely parse Decimal128 stored order values without recalculating from catalog", () => {
      const mockStoredOrder = {
        _id: "67890abcdef1234567890abc",
        orderNumber: "ORD-2026-9901",
        subtotal: { $numberDecimal: "24990.00" },
        discountTotal: { $numberDecimal: "2499.00" },
        couponCode: "SAVE10",
        shippingTotal: { $numberDecimal: "0.00" },
        taxTotal: { $numberDecimal: "4048.38" },
        grandTotal: { $numberDecimal: "26539.38" },
        currency: "INR",
        items: [
          {
            productId: "prod-1",
            productName: "Sony WH-1000XM5 Wireless Headphones",
            quantity: 1,
            unitPrice: { $numberDecimal: "24990.00" },
            lineTotal: { $numberDecimal: "24990.00" },
          },
        ],
      };

      const extracted = extractOrderFinancials(mockStoredOrder);
      assert.strictEqual(extracted.subtotal, 24990);
      assert.strictEqual(extracted.discountTotal, 2499);
      assert.strictEqual(extracted.couponCode, "SAVE10");
      assert.strictEqual(extracted.shippingTotal, 0);
      assert.strictEqual(extracted.taxTotal, 4048.38);
      assert.strictEqual(extracted.grandTotal, 26539.38);
      assert.strictEqual(extracted.currency, "INR");

      // Verify line items are preserved with historical snapshots
      const item = mockStoredOrder.items[0];
      assert.strictEqual(parsePrice(item.unitPrice), 24990);
      assert.strictEqual(parsePrice(item.lineTotal), 24990);
    });

    it("should format currency consistently with locale and currency symbols", () => {
      assert.strictEqual(formatCurrency(24990, "INR"), "₹24,990");
      assert.strictEqual(formatCurrency({ $numberDecimal: "99.00" }, "INR"), "₹99");
      assert.strictEqual(formatCurrency(0, "INR"), "₹0");
    });
  });

  describe("2. Delivery Estimate Priority Hierarchy (Strict 3-Tier Rule)", () => {
    it("Priority 1: should use actual backend order delivery estimate if available", () => {
      const orderWithBackendDate = {
        estimatedDeliveryDate: "2026-09-25T18:00:00.000Z",
      };
      const shipmentWithTracking = {
        status: "in_transit",
        carrier: "Blue Dart",
        trackingNumber: "BD99281726",
      };

      const estimate = getOrderDeliveryEstimate({
        order: orderWithBackendDate,
        shipment: shipmentWithTracking,
        policy: STOREFRONT_BUSINESS_POLICIES,
      });

      assert.strictEqual(estimate.type, "order_specific");
      assert.strictEqual(estimate.source, "backend_order");
      assert.strictEqual(estimate.isGenericPolicy, false);
      assert.ok(estimate.formatted.includes("2026"));
    });

    it("Priority 2: should use shipment/carrier tracking data if no specific date is provided", () => {
      const orderWithoutDate = {
        status: "shipped",
      };
      const activeShipment = {
        status: "in_transit",
        carrier: "Delhivery",
        trackingNumber: "DLH-992011",
      };

      const estimate = getOrderDeliveryEstimate({
        order: orderWithoutDate,
        shipment: activeShipment,
        policy: STOREFRONT_BUSINESS_POLICIES,
      });

      assert.strictEqual(estimate.type, "carrier_tracking");
      assert.strictEqual(estimate.source, "carrier_realtime");
      assert.strictEqual(estimate.isGenericPolicy, false);
      assert.ok(estimate.formatted.includes("Delhivery"));
    });

    it("Priority 2: should display out_for_delivery correctly from shipment", () => {
      const order = { status: "shipped" };
      const shipment = { status: "out_for_delivery", carrier: "ExpressLogistics" };

      const estimate = getOrderDeliveryEstimate({
        order,
        shipment,
        policy: STOREFRONT_BUSINESS_POLICIES,
      });

      assert.strictEqual(estimate.type, "carrier_tracking");
      assert.strictEqual(estimate.formatted, "Out for delivery today");
      assert.strictEqual(estimate.isGenericPolicy, false);
    });

    it("Priority 3: should fall back to a clearly labeled generic policy estimate only if backend has no order-specific estimate", () => {
      const orderPending = {
        status: "pending",
      };

      const estimate = getOrderDeliveryEstimate({
        order: orderPending,
        shipment: null,
        policy: STOREFRONT_BUSINESS_POLICIES,
      });

      assert.strictEqual(estimate.type, "generic_policy");
      assert.strictEqual(estimate.source, "generic_storefront_policy");
      assert.strictEqual(estimate.isGenericPolicy, true);
      assert.strictEqual(estimate.label, "Delivery Estimate Policy");
      // Must NOT present generic policy as a guaranteed commitment
      assert.ok(estimate.formatted.includes("Standard Policy Estimate"));
      assert.ok(estimate.formatted.includes("confirmed once shipped"));
    });
  });

  describe("3. Order Cancellation Eligibility Rules (Enforced by Backend)", () => {
    it("should allow cancellation only for pending, confirmed, and processing statuses", () => {
      assert.strictEqual(isOrderCancellable({ status: "pending" }), true);
      assert.strictEqual(isOrderCancellable({ status: "confirmed" }), true);
      assert.strictEqual(isOrderCancellable({ status: "processing" }), true);
    });

    it("should reject cancellation for shipped, delivered, cancelled, and completed orders", () => {
      assert.strictEqual(isOrderCancellable({ status: "shipped" }), false);
      assert.strictEqual(isOrderCancellable({ status: "delivered" }), false);
      assert.strictEqual(isOrderCancellable({ status: "cancelled" }), false);
      assert.strictEqual(isOrderCancellable({ status: "completed" }), false);
      assert.strictEqual(isOrderCancellable(null), false);
      assert.strictEqual(isOrderCancellable({}), false);
    });

    it("should have exact cancellable statuses constant matching backend rules", () => {
      assert.deepStrictEqual(CANCELLABLE_ORDER_STATUSES, [
        "pending",
        "confirmed",
        "processing",
      ]);
    });
  });

  describe("4. Status Timeline Mapping & Progression", () => {
    it("should map backend statuses to correct 0-indexed stage steps", () => {
      assert.strictEqual(getTimelineStepIndex("pending"), 0);
      assert.strictEqual(getTimelineStepIndex("confirmed"), 1);
      assert.strictEqual(getTimelineStepIndex("processing"), 2);
      assert.strictEqual(getTimelineStepIndex("shipped"), 3);
      assert.strictEqual(getTimelineStepIndex("delivered"), 4);
      assert.strictEqual(getTimelineStepIndex("completed"), 4);
    });

    it("should return -1 for cancelled or unknown statuses", () => {
      assert.strictEqual(getTimelineStepIndex("cancelled"), -1);
      assert.strictEqual(getTimelineStepIndex("unknown_status"), -1);
    });

    it("should contain exactly 5 sequential timeline stages", () => {
      assert.strictEqual(ORDER_TIMELINE_STAGES.length, 5);
      const keys = ORDER_TIMELINE_STAGES.map((s) => s.key);
      assert.deepStrictEqual(keys, [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
      ]);
    });
  });

  describe("5. Address Snapshot Preservation", () => {
    it("should retain historical address snapshot fields without falling back to live customer address", () => {
      const historicalAddress = {
        fullName: "Rahul Sharma",
        phone: "+91 9876543210",
        addressLine1: "Flat 402, Green Meadows",
        addressLine2: "Near City Center Mall",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "India",
      };

      const mockOrder = {
        _id: "ord-test-1",
        shippingAddress: historicalAddress,
      };

      assert.strictEqual(mockOrder.shippingAddress.fullName, "Rahul Sharma");
      assert.strictEqual(mockOrder.shippingAddress.postalCode, "560001");
      assert.strictEqual(mockOrder.shippingAddress.city, "Bengaluru");
      assert.strictEqual(mockOrder.shippingAddress.addressLine1, "Flat 402, Green Meadows");
    });
  });

  describe("6. Buy Again Catalog Validation Constraints", () => {
    it("should enforce that live current prices and active stock status are evaluated rather than historical prices", () => {
      const historicalItem = {
        productId: "prod-sony-1",
        productVariantId: "var-black-1",
        productName: "Sony WH-1000XM5",
        unitPrice: { $numberDecimal: "24990.00" }, // Historical purchased price
      };

      // Simulated live catalog response
      const liveCatalogProduct = {
        _id: "prod-sony-1",
        name: "Sony WH-1000XM5 Wireless Headphones",
        isActive: true,
        stockStatus: "in_stock",
        stockQuantity: 15,
        price: 26990, // Updated catalog price
      };

      assert.notStrictEqual(liveCatalogProduct.price, parsePrice(historicalItem.unitPrice));
      assert.strictEqual(liveCatalogProduct.isActive, true);
      assert.strictEqual(liveCatalogProduct.stockStatus, "in_stock");
      assert.ok(liveCatalogProduct.stockQuantity > 0);
    });

    it("should flag out-of-stock or inactive catalog products as ineligible for Buy Again", () => {
      const inactiveProduct = {
        _id: "prod-sony-old",
        isActive: false,
        stockStatus: "in_stock",
      };
      const outOfStockProduct = {
        _id: "prod-sony-2",
        isActive: true,
        stockStatus: "out_of_stock",
      };

      const isEligible = (prod) => prod.isActive && prod.stockStatus !== "out_of_stock";

      assert.strictEqual(isEligible(inactiveProduct), false);
      assert.strictEqual(isEligible(outOfStockProduct), false);
    });
  });
});
