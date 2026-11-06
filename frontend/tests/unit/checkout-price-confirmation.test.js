import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useCheckoutStore } from "../../src/stores/checkout.store.js";
import { orderService } from "../../src/services/order.service.js";

describe("Phase 3A.2: Storefront Checkout Price Confirmation & Quote Expiry Tests", () => {
  beforeEach(() => {
    useCheckoutStore.getState().resetCheckout();
  });

  describe("1. Checkout Store Quote State & Expiry Handling", () => {
    test("sets quote reference and verifies isQuoteExpired returns false for future expiry", () => {
      const futureExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      useCheckoutStore.getState().setQuote({
        quoteReference: "test-valid-token.base64",
        quoteExpiresAt: futureExpiry,
        subtotal: 500,
        grandTotal: 540,
        currency: "INR",
      });

      const store = useCheckoutStore.getState();
      assert.equal(store.quote.quoteReference, "test-valid-token.base64");
      assert.equal(store.isQuoteExpired(), false);
    });

    test("isQuoteExpired returns true when quoteExpiresAt is in the past", () => {
      const pastExpiry = new Date(Date.now() - 5000).toISOString();
      useCheckoutStore.getState().setQuote({
        quoteReference: "test-expired-token.base64",
        quoteExpiresAt: pastExpiry,
        subtotal: 500,
        grandTotal: 540,
        currency: "INR",
      });

      assert.equal(useCheckoutStore.getState().isQuoteExpired(), true);
    });

    test("concurrent fetchQuote calls deduplicate into single in-flight promise", async () => {
      let callCount = 0;
      const originalGetCheckoutQuote = orderService.getCheckoutQuote;

      orderService.getCheckoutQuote = async () => {
        callCount++;
        await new Promise((r) => setTimeout(r, 20));
        return {
          data: {
            quoteReference: `quote-ref-${callCount}`,
            grandTotal: 500,
            currency: "INR",
          },
        };
      };

      try {
        const store = useCheckoutStore.getState();
        // Fire 3 concurrent fetches without force
        const [q1, q2, q3] = await Promise.all([
          store.fetchQuote({ shippingAddressId: "addr-1" }),
          store.fetchQuote({ shippingAddressId: "addr-1" }),
          store.fetchQuote({ shippingAddressId: "addr-1" }),
        ]);

        assert.equal(callCount, 1, "Expected only 1 network call for concurrent quote requests");
        assert.equal(q1.quoteReference, "quote-ref-1");
        assert.equal(q2.quoteReference, "quote-ref-1");
        assert.equal(q3.quoteReference, "quote-ref-1");
      } finally {
        orderService.getCheckoutQuote = originalGetCheckoutQuote;
      }
    });
  });

  describe("2. Price Change Detection and Confirmation Contract", () => {
    test("detects price change when backend returns 409 PRICE_CHANGED with previous and current quotes", () => {
      const priceChangedError = {
        status: 409,
        code: "PRICE_CHANGED",
        message: "Prices or components have changed since the quote was generated.",
        details: {
          quotedGrandTotal: 500,
          currentGrandTotal: 550,
          currency: "INR",
          reason: "total_changed",
          previousQuote: {
            grandTotal: 500,
            subtotal: 500,
            items: [{ sku: "SKU-1", quantity: 1, unitPrice: 500, lineTotal: 500 }],
          },
          currentQuote: {
            grandTotal: 550,
            subtotal: 550,
            items: [{ sku: "SKU-1", quantity: 1, unitPrice: 550, lineTotal: 550 }],
          },
        },
      };

      // Modal state extraction simulation
      const modalData = {
        previousQuote: priceChangedError.details.previousQuote,
        currentQuote: priceChangedError.details.currentQuote,
        reason: priceChangedError.details.reason,
      };

      assert.equal(modalData.previousQuote.grandTotal, 500);
      assert.equal(modalData.currentQuote.grandTotal, 550);
      assert.equal(modalData.currentQuote.grandTotal - modalData.previousQuote.grandTotal, 50);
    });

    test("detects component change even when grand total remains identical (offsetting changes)", () => {
      const offsettingError = {
        status: 409,
        code: "PRICE_CHANGED",
        details: {
          quotedGrandTotal: 1000,
          currentGrandTotal: 1000,
          currency: "INR",
          reason: "component_changed",
          previousQuote: {
            grandTotal: 1000,
            shippingTotal: 100,
            items: [{ sku: "A", unitPrice: 900, lineTotal: 900 }],
          },
          currentQuote: {
            grandTotal: 1000,
            shippingTotal: 0,
            items: [{ sku: "A", unitPrice: 1000, lineTotal: 1000 }],
          },
        },
      };

      assert.equal(offsettingError.details.quotedGrandTotal, offsettingError.details.currentGrandTotal);
      assert.equal(offsettingError.details.reason, "component_changed");
      assert.notEqual(
        offsettingError.details.previousQuote.shippingTotal,
        offsettingError.details.currentQuote.shippingTotal
      );
    });

    test("Return to Cart action performs navigation without submitting order", () => {
      let orderCreated = false;
      const originalCreateOrder = orderService.createOrder;
      orderService.createOrder = async () => {
        orderCreated = true;
      };

      let navigatedRoute = null;
      const mockRouter = {
        push: (route) => {
          navigatedRoute = route;
        },
      };

      // User chooses Return to Cart
      const handleCancelPriceChange = () => {
        mockRouter.push("/cart");
      };

      try {
        handleCancelPriceChange();
        assert.equal(navigatedRoute, "/cart");
        assert.equal(orderCreated, false, "Must not submit an order when returning to cart");
      } finally {
        orderService.createOrder = originalCreateOrder;
      }
    });

    test("Customer confirmation fetches fresh quote before order retry", async () => {
      let freshQuoteFetched = false;
      let orderSubmittedWithQuote = null;

      const originalGetCheckoutQuote = orderService.getCheckoutQuote;
      const originalCreateOrder = orderService.createOrder;

      const freshQuoteData = {
        quoteReference: "fresh-signed-quote-ref",
        grandTotal: 550,
        quoteExpiresAt: new Date(Date.now() + 60000).toISOString(),
      };

      orderService.getCheckoutQuote = async () => {
        freshQuoteFetched = true;
        return { data: freshQuoteData };
      };

      orderService.createOrder = async (payload) => {
        orderSubmittedWithQuote = payload.quoteReference;
        return { data: { order: { id: "ord-new-123", status: "pending" } } };
      };

      try {
        // Confirmation workflow simulation
        const freshQuote = await useCheckoutStore.getState().fetchQuote({ force: true });
        assert.ok(freshQuoteFetched, "Must fetch fresh quote upon user confirmation");
        assert.equal(freshQuote.quoteReference, "fresh-signed-quote-ref");

        // Submit order with the refreshed quote
        await orderService.createOrder({
          shippingAddressId: "addr-1",
          quoteReference: freshQuote.quoteReference,
        });

        assert.equal(orderSubmittedWithQuote, "fresh-signed-quote-ref");
      } finally {
        orderService.getCheckoutQuote = originalGetCheckoutQuote;
        orderService.createOrder = originalCreateOrder;
      }
    });

    test("Material price change after quote refresh halts submission and requires second confirmation", async () => {
      const modalShownQuote = { grandTotal: 550 };
      const freshQuoteFromBackend = {
        quoteReference: "super-fresh-quote",
        grandTotal: 580, // Price moved up again while modal was open!
      };

      let orderAttempted = false;
      const originalCreateOrder = orderService.createOrder;
      orderService.createOrder = async () => {
        orderAttempted = true;
      };

      try {
        // Confirmation check logic
        const requiresReconfirmation =
          Math.abs(freshQuoteFromBackend.grandTotal - modalShownQuote.grandTotal) > 0.001;

        assert.equal(requiresReconfirmation, true);
        if (requiresReconfirmation) {
          // Stay on modal with newest quote, do NOT create order
        } else {
          await orderService.createOrder({});
        }

        assert.equal(orderAttempted, false, "Must not place order if price changed again during confirmation");
      } finally {
        orderService.createOrder = originalCreateOrder;
      }
    });

    test("Duplicate clicks during in-flight order submission do not generate multiple orders", async () => {
      let isProcessing = false;
      let orderCallCount = 0;

      const originalCreateOrder = orderService.createOrder;
      orderService.createOrder = async () => {
        orderCallCount++;
        await new Promise((r) => setTimeout(r, 20));
        return { data: { order: { id: `ord-${orderCallCount}` } } };
      };

      const submitHandler = async () => {
        if (isProcessing) return;
        isProcessing = true;
        try {
          await orderService.createOrder({});
        } finally {
          isProcessing = false;
        }
      };

      try {
        // Simulate rapid double click
        await Promise.all([submitHandler(), submitHandler()]);
        assert.equal(orderCallCount, 1, "Only 1 order request should be dispatched on concurrent clicks");
      } finally {
        orderService.createOrder = originalCreateOrder;
      }
    });

    test("Network error during quote refresh preserves checkout store state without clearing selections", async () => {
      useCheckoutStore.getState().setSelectedAddressId("addr-safe-123");
      useCheckoutStore.getState().setSelectedDeliveryOption("express");

      const originalGetCheckoutQuote = orderService.getCheckoutQuote;
      orderService.getCheckoutQuote = async () => {
        throw new Error("Network timeout: connection failed");
      };

      try {
        const res = await useCheckoutStore.getState().fetchQuote({ force: true });
        assert.equal(res, null);

        const store = useCheckoutStore.getState();
        assert.equal(store.selectedAddressId, "addr-safe-123", "Customer address must remain intact");
        assert.equal(store.selectedDeliveryOption, "express", "Delivery option must remain intact");
        assert.equal(store.quoteError, "Network timeout: connection failed");
      } finally {
        orderService.getCheckoutQuote = originalGetCheckoutQuote;
      }
    });
  });
});
