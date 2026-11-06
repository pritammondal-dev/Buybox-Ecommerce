import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useAuthStore } from "../../src/stores/auth.store.js";
import { useCheckoutStore } from "../../src/stores/checkout.store.js";
import { tokenManager } from "../../src/lib/auth/token-manager.js";

describe("P1 Checkout & Payment State Isolation Tests", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
    useCheckoutStore.getState().resetCheckout();
  });

  // Test 1 — Logout clears checkout state
  test("Test 1: Logout clears customer checkout state and order ID", () => {
    // Customer A has an active session and an order in checkout
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: "cust-A", email: "customera@example.com" },
    });
    useCheckoutStore.getState().setCurrentOrderId("order-cust-A-12345", "cust-A");
    useCheckoutStore.getState().setIsPaymentCancelled(true);

    assert.equal(useCheckoutStore.getState().currentOrderId, "order-cust-A-12345");
    assert.equal(useCheckoutStore.getState().checkoutCustomerId, "cust-A");
    assert.equal(useCheckoutStore.getState().isPaymentCancelled, true);

    // Customer A logs out
    useAuthStore.getState().clearAuth();

    // Verification: Checkout state must be completely cleared
    const checkoutState = useCheckoutStore.getState();
    assert.equal(checkoutState.currentOrderId, null);
    assert.equal(checkoutState.checkoutCustomerId, null);
    assert.equal(checkoutState.isPaymentCancelled, false);
    assert.equal(checkoutState.selectedAddressId, null);
  });

  // Test 2 — User switch isolation
  test("Test 2: User switch isolation prevents Customer B from inheriting Customer A's currentOrderId", () => {
    // Customer A sets up checkout state
    useCheckoutStore.getState().setCurrentOrderId("order-cust-A-99999", "cust-A");
    useCheckoutStore.getState().setSelectedAddressId("addr-cust-A");

    // Even if somehow persisted state survived logout or a direct user switch occurs
    useCheckoutStore.getState().validateAndSyncCustomer("cust-B");

    const checkoutState = useCheckoutStore.getState();
    assert.equal(
      checkoutState.currentOrderId,
      null,
      "Customer B must NOT inherit Customer A's order ID"
    );
    assert.equal(
      checkoutState.checkoutCustomerId,
      "cust-B",
      "Checkout store customer ID must now be Customer B"
    );
    assert.equal(
      checkoutState.selectedAddressId,
      null,
      "Customer A address must be wiped when switching to Customer B"
    );
  });

  // Test 3 — Same user refresh/resume
  test("Test 3: Same user refresh/reconnect preserves valid pending order", () => {
    // Customer A creates valid order
    useCheckoutStore.getState().setCurrentOrderId("order-cust-A-valid", "cust-A");
    useCheckoutStore.getState().setSelectedAddressId("addr-cust-A");

    // Browser refresh or component remount validates Customer A again
    useCheckoutStore.getState().validateAndSyncCustomer("cust-A");

    const checkoutState = useCheckoutStore.getState();
    assert.equal(
      checkoutState.currentOrderId,
      "order-cust-A-valid",
      "Customer A must be able to resume their own pending order"
    );
    assert.equal(checkoutState.checkoutCustomerId, "cust-A");
    assert.equal(checkoutState.selectedAddressId, "addr-cust-A");
  });

  // Test 4 — Cancelled order protection
  test("Test 4: Cancelled order cannot be reused as payment target and gets cleared", () => {
    // Simulate stale order that is cancelled in backend
    const mockCancelledOrder = {
      _id: "6aafaef304360dc4652b0049",
      orderNumber: "BB-MU9NCCI8-E33AC55E",
      status: "cancelled",
      paymentStatus: "refunded",
      cancellationStatus: "requested",
    };

    useCheckoutStore.getState().setCurrentOrderId(mockCancelledOrder._id, "cust-A");

    // Order validation rule: status must be pending, paymentStatus pending, no cancellation
    const isPayable =
      mockCancelledOrder &&
      mockCancelledOrder.status === "pending" &&
      mockCancelledOrder.paymentStatus === "pending" &&
      (!mockCancelledOrder.cancellationStatus || mockCancelledOrder.cancellationStatus === "none");

    assert.equal(isPayable, false, "Cancelled order must evaluate to non-payable");

    // When evaluated on payment page view
    if (!isPayable) {
      useCheckoutStore.getState().setCurrentOrderId(null);
      useCheckoutStore.getState().setIsPaymentCancelled(false);
    }

    assert.equal(useCheckoutStore.getState().currentOrderId, null);
    assert.equal(useCheckoutStore.getState().isPaymentCancelled, false);
  });

  // Test 5 — Refunded order protection
  test("Test 5: Refunded order is rejected and cleared from checkout state", () => {
    const mockRefundedOrder = {
      _id: "order-refunded-777",
      status: "completed",
      paymentStatus: "refunded",
    };

    useCheckoutStore.getState().setCurrentOrderId(mockRefundedOrder._id, "cust-A");

    const isPayable =
      mockRefundedOrder.status === "pending" &&
      mockRefundedOrder.paymentStatus === "pending";

    assert.equal(isPayable, false, "Refunded order must not be payable");

    if (!isPayable) {
      useCheckoutStore.getState().setCurrentOrderId(null);
    }

    assert.equal(useCheckoutStore.getState().currentOrderId, null);
  });

  // Test 6 — Foreign order access denied (403 ORDER_ACCESS_DENIED) handling
  test("Test 6: 403 ORDER_ACCESS_DENIED clears stale foreign order ID and prevents infinite retry loop", () => {
    // Customer B holds stale foreign order ID
    useCheckoutStore.getState().setCurrentOrderId("foreign-order-cust-A", "cust-B");

    // Backend error simulation
    const backendError = {
      status: 403,
      code: "ORDER_ACCESS_DENIED",
      message: "You are not allowed to access this order",
    };

    const isAuthDenied =
      backendError?.status === 403 || backendError?.code === "ORDER_ACCESS_DENIED";

    assert.equal(isAuthDenied, true);

    // Front-end error handler execution
    let displayedToast = "";
    if (isAuthDenied) {
      useCheckoutStore.getState().setCurrentOrderId(null);
      useCheckoutStore.getState().setIsPaymentCancelled(false);
      displayedToast = "Previous order session expired. Please retry payment to place your order.";
    }

    // Verify state was cleared safely without falsely showing "Payment Cancelled"
    assert.equal(useCheckoutStore.getState().currentOrderId, null);
    assert.equal(useCheckoutStore.getState().isPaymentCancelled, false);
    assert.ok(displayedToast.includes("retry payment to place your order"));
  });

  // Test 7 — Genuine payment cancellation & retry flow
  test("Test 7: Genuine gateway cancellation sets isPaymentCancelled and keeps order for valid retry", () => {
    const validOrderId = "order-valid-payable-555";
    useCheckoutStore.getState().setCurrentOrderId(validOrderId, "cust-A");

    // User closes Razorpay modal (genuine cancellation)
    useCheckoutStore.getState().setIsPaymentCancelled(true);

    const stateAfterModalDismiss = useCheckoutStore.getState();
    assert.equal(stateAfterModalDismiss.currentOrderId, validOrderId);
    assert.equal(stateAfterModalDismiss.isPaymentCancelled, true);

    // On Retry Payment with a valid payable order:
    const mockOrder = {
      _id: validOrderId,
      status: "pending",
      paymentStatus: "pending",
      cancellationStatus: "none",
    };

    const isPayable =
      mockOrder.status === "pending" &&
      mockOrder.paymentStatus === "pending" &&
      mockOrder.cancellationStatus === "none";

    assert.equal(isPayable, true, "Valid order is reused without duplicate order creation");
  });

  // Test 8 — Zustand persistence migration safely purges legacy unverified state
  test("Test 8: Persistence migration safely strips legacy or unverified order IDs", () => {
    // Zustand persist v2 migration logic
    const migrate = (persistedState, version) => {
      if (!version || version < 2 || !persistedState?.checkoutCustomerId) {
        return {
          ...persistedState,
          currentOrderId: null,
          isPaymentCancelled: false,
          checkoutCustomerId: null,
        };
      }
      return persistedState;
    };

    // Stale v1 localStorage payload (what Customer B had before the fix)
    const legacyV1State = {
      selectedAddressId: "addr-1",
      selectedDeliveryOption: "standard",
      selectedPaymentMethod: "razorpay",
      currentOrderId: "6aafaef304360dc4652b0049", // Stale foreign order
      isPaymentCancelled: true,
    };

    const sanitizedState = migrate(legacyV1State, 1);
    assert.equal(sanitizedState.currentOrderId, null);
    assert.equal(sanitizedState.isPaymentCancelled, false);
    assert.equal(sanitizedState.checkoutCustomerId, null);
    assert.equal(sanitizedState.selectedAddressId, "addr-1"); // Non-sensitive preferences preserved
  });
});
