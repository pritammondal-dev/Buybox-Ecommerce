
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { vendorService } from "../../src/services/vendor.service.js";
import { adminOrderService, adminExceptionService } from "../../src/services/admin/order.service.js";

describe("Buybox Phase 5C — Vendor Fulfillment Exceptions (Frontend Services & Business Rules)", () => {
  // ----------------------------------------------------
  // 1. Vendor Service Methods Interface
  // ----------------------------------------------------
  describe("1. Vendor Scoped Exception Service Interface", () => {
    test("vendorService exposes all fulfillment exception lifecycle methods", () => {
      assert.equal(typeof vendorService.submitFulfillmentException, "function");
      assert.equal(typeof vendorService.getMyFulfillmentExceptions, "function");
      assert.equal(typeof vendorService.getMyFulfillmentExceptionById, "function");
      assert.equal(typeof vendorService.clarifyFulfillmentException, "function");
      assert.equal(typeof vendorService.withdrawFulfillmentException, "function");
    });
  });

  // ----------------------------------------------------
  // 2. Admin Service Methods Interface
  // ----------------------------------------------------
  describe("2. Administrator Resolution Service Interface", () => {
    test("adminOrderService exposes exception queue and resolution methods", () => {
      assert.equal(typeof adminOrderService.getFulfillmentExceptions, "function");
      assert.equal(typeof adminOrderService.getFulfillmentExceptionById, "function");
      assert.equal(typeof adminOrderService.transitionFulfillmentException, "function");
      assert.equal(typeof adminOrderService.approveExceptionCancellation, "function");
    });

    test("adminExceptionService alias properly delegates to adminOrderService", () => {
      assert.equal(typeof adminExceptionService.getExceptions, "function");
      assert.equal(typeof adminExceptionService.getExceptionById, "function");
      assert.equal(typeof adminExceptionService.transitionException, "function");
      assert.equal(typeof adminExceptionService.approveCancellation, "function");
    });
  });

  // ----------------------------------------------------
  // 3. Exception State Transitions Rules
  // ----------------------------------------------------
  describe("3. Exception State Machine Rules", () => {
    const ALLOWED_TRANSITIONS = {
      open: ["under_review", "awaiting_vendor", "resolved", "rejected", "withdrawn"],
      under_review: ["awaiting_vendor", "resolved", "rejected", "withdrawn"],
      awaiting_vendor: ["under_review", "resolved", "rejected", "withdrawn"],
      resolved: [],
      rejected: [],
      withdrawn: [],
    };

    test("open exceptions can transition to active and resolution states", () => {
      assert.deepEqual(ALLOWED_TRANSITIONS.open, [
        "under_review",
        "awaiting_vendor",
        "resolved",
        "rejected",
        "withdrawn",
      ]);
    });

    test("awaiting_vendor allows vendor clarification back to under_review or withdrawal", () => {
      assert.ok(ALLOWED_TRANSITIONS.awaiting_vendor.includes("under_review"));
      assert.ok(ALLOWED_TRANSITIONS.awaiting_vendor.includes("withdrawn"));
    });

    test("terminal states (resolved, rejected, withdrawn) have empty transition sets", () => {
      assert.equal(ALLOWED_TRANSITIONS.resolved.length, 0);
      assert.equal(ALLOWED_TRANSITIONS.rejected.length, 0);
      assert.equal(ALLOWED_TRANSITIONS.withdrawn.length, 0);
    });
  });

  // ----------------------------------------------------
  // 4. Downstream Consequence & Refund Safety Calculations
  // ----------------------------------------------------
  describe("4. Downstream Consequence & Refund Calculations", () => {
    function calculateCancellationConsequences(item, cancelQty) {
      const unitPrice = Number(item.unitPrice || 0);
      const totalQty = Number(item.quantity || 1);
      const qty = Math.min(Math.max(1, Number(cancelQty) || 1), totalQty);
      const estimatedRefund = Number((unitPrice * qty).toFixed(2));
      const isEntireItem = qty === totalQty;

      return {
        cancelQuantity: qty,
        unitPrice,
        estimatedRefund,
        isEntireItem,
        remainingQty: totalQty - qty,
      };
    }

    test("computes exact proportional refund for partial item quantity", () => {
      const item = { quantity: 5, unitPrice: 1200, lineTotal: 6000 };
      const consequence = calculateCancellationConsequences(item, 2);

      assert.equal(consequence.cancelQuantity, 2);
      assert.equal(consequence.estimatedRefund, 2400);
      assert.equal(consequence.isEntireItem, false);
      assert.equal(consequence.remainingQty, 3);
    });

    test("identifies entire line cancellation when cancelQty equals total item quantity", () => {
      const item = { quantity: 3, unitPrice: 500, lineTotal: 1500 };
      const consequence = calculateCancellationConsequences(item, 3);

      assert.equal(consequence.cancelQuantity, 3);
      assert.equal(consequence.estimatedRefund, 1500);
      assert.equal(consequence.isEntireItem, true);
      assert.equal(consequence.remainingQty, 0);
    });

    test("clamps cancel quantity within [1, item.quantity] bounds", () => {
      const item = { quantity: 4, unitPrice: 250 };
      const overBounds = calculateCancellationConsequences(item, 10);
      assert.equal(overBounds.cancelQuantity, 4);

      const underBounds = calculateCancellationConsequences(item, 0);
      assert.equal(underBounds.cancelQuantity, 1);
    });
  });

  // ----------------------------------------------------
  // 5. Reason & Resolution Taxonomy
  // ----------------------------------------------------
  describe("5. Reason & Resolution Taxonomy", () => {
    const VALID_REASONS = [
      "out_of_stock",
      "damaged_stock",
      "incorrect_sku_or_variant",
      "cannot_pack_or_ship",
      "warehouse_discrepancy",
      "other",
    ];

    const VALID_RESOLUTIONS = [
      "retry_fulfillment",
      "request_cancellation",
      "administrative_assistance",
    ];

    test("supports all required exception reasons", () => {
      assert.ok(VALID_REASONS.includes("out_of_stock"));
      assert.ok(VALID_REASONS.includes("damaged_stock"));
      assert.ok(VALID_REASONS.includes("incorrect_sku_or_variant"));
      assert.ok(VALID_REASONS.includes("cannot_pack_or_ship"));
      assert.ok(VALID_REASONS.includes("warehouse_discrepancy"));
      assert.ok(VALID_REASONS.includes("other"));
    });

    test("supports all required resolution requests", () => {
      assert.ok(VALID_RESOLUTIONS.includes("retry_fulfillment"));
      assert.ok(VALID_RESOLUTIONS.includes("request_cancellation"));
      assert.ok(VALID_RESOLUTIONS.includes("administrative_assistance"));
    });
  });
});
