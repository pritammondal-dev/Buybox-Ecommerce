import { create } from "zustand";
import { persist } from "zustand/middleware";
import { orderService } from "../services/order.service.js";

/**
 * Checkout State Store
 *
 * Manages customer checkout progress, selections, and authoritative financial quote
 * across the 3 marketplace checkout stages (/checkout/address -> /checkout/summary -> /checkout/payment).
 */
export const useCheckoutStore = create(
  persist(
    (set, get) => ({
      selectedAddressId: null,
      selectedDeliveryOption: "standard",
      appliedCoupon: null,
      selectedPaymentMethod: "razorpay",
      paymentSubtype: null,
      currentOrderId: null,
      checkoutCustomerId: null,
      isPaymentCancelled: false,

      // Authoritative backend quote
      quote: null,
      isLoadingQuote: false,
      quoteError: null,

      setSelectedAddressId: (id) => set({ selectedAddressId: id }),

      setSelectedDeliveryOption: (optionId) => {
        set({ selectedDeliveryOption: optionId });
        // Re-fetch authoritative quote whenever delivery option changes
        const { selectedAddressId, appliedCoupon } = get();
        get().fetchQuote({
          shippingAddressId: selectedAddressId,
          couponCode: appliedCoupon?.code || null,
          deliveryOptionId: optionId,
        });
      },

      setAppliedCoupon: (coupon) => {
        set({ appliedCoupon: coupon });
        const { selectedAddressId, selectedDeliveryOption } = get();
        get().fetchQuote({
          shippingAddressId: selectedAddressId,
          couponCode: coupon?.code || null,
          deliveryOptionId: selectedDeliveryOption,
        });
      },

      setSelectedPaymentMethod: (method, subtype = null) => {
        set({ selectedPaymentMethod: method, paymentSubtype: subtype });
      },

      setCheckoutCustomerId: (id) => set({ checkoutCustomerId: id ? String(id) : null }),

      setCurrentOrderId: (orderId, customerId = null) =>
        set((state) => ({
          currentOrderId: orderId,
          checkoutCustomerId: customerId ? String(customerId) : state.checkoutCustomerId,
        })),

      setIsPaymentCancelled: (flag) => set({ isPaymentCancelled: flag }),

      /**
       * Validate customer identity against persisted checkout state.
       * If switching customers or unauthenticated, purges stale customer-scoped orders.
       */
      validateAndSyncCustomer: (authenticatedCustomerId) => {
        const authId = authenticatedCustomerId ? String(authenticatedCustomerId) : null;
        const { checkoutCustomerId, currentOrderId } = get();

        if (!authId) {
          if (currentOrderId || checkoutCustomerId) {
            set({
              currentOrderId: null,
              isPaymentCancelled: false,
              checkoutCustomerId: null,
            });
          }
          return;
        }

        if (checkoutCustomerId && checkoutCustomerId !== authId) {
          // Cross-customer boundary: reset stale order and customer-bound selections
          set({
            currentOrderId: null,
            isPaymentCancelled: false,
            checkoutCustomerId: authId,
            selectedAddressId: null,
            quote: null,
            quoteError: null,
          });
        } else if (!checkoutCustomerId) {
          set({ checkoutCustomerId: authId });
        }
      },

      setQuote: (quoteData) => set({ quote: quoteData, quoteError: null }),

      /**
       * Check if the currently held authoritative quote has expired.
       */
      isQuoteExpired: () => {
        const currentQuote = get().quote;
        if (!currentQuote?.quoteExpiresAt) return false;
        return new Date(currentQuote.quoteExpiresAt).getTime() <= Date.now();
      },

      /**
       * Fetch authoritative financial quote from backend.
       * Deduplicates concurrent fetch requests.
       */
      fetchQuote: async ({
        shippingAddressId = null,
        couponCode = null,
        deliveryOptionId = "standard",
        force = false,
      } = {}) => {
        if (!force && get().isLoadingQuote && get()._activeQuotePromise) {
          return get()._activeQuotePromise;
        }

        set({ isLoadingQuote: true, quoteError: null });

        const quotePromise = (async () => {
          try {
            const res = await orderService.getCheckoutQuote({
              shippingAddressId: shippingAddressId || get().selectedAddressId,
              couponCode: couponCode || get().appliedCoupon?.code || null,
              deliveryOptionId: deliveryOptionId || get().selectedDeliveryOption || "standard",
            });
            const quoteData = res?.data || res;
            set({ quote: quoteData, isLoadingQuote: false, _activeQuotePromise: null });
            return quoteData;
          } catch (err) {
            set({
              quoteError: err?.message || "Failed to calculate checkout quote",
              isLoadingQuote: false,
              _activeQuotePromise: null,
            });
            return null;
          }
        })();

        set({ _activeQuotePromise: quotePromise });
        return quotePromise;
      },

      /**
       * Reset checkout state after order completion
       */
      resetCheckout: () => {
        set({
          selectedAddressId: null,
          selectedDeliveryOption: "standard",
          appliedCoupon: null,
          selectedPaymentMethod: "razorpay",
          paymentSubtype: null,
          currentOrderId: null,
          checkoutCustomerId: null,
          isPaymentCancelled: false,
          quote: null,
          isLoadingQuote: false,
          quoteError: null,
        });
      },
    }),
    {
      name: "buybox_checkout_state",
      version: 2,
      migrate: (persistedState, version) => {
        // Safe migration: sanitize legacy v1 or unverified persisted state
        if (!version || version < 2 || !persistedState?.checkoutCustomerId) {
          return {
            ...persistedState,
            currentOrderId: null,
            isPaymentCancelled: false,
            checkoutCustomerId: null,
          };
        }
        return persistedState;
      },
      partialize: (state) => ({
        selectedAddressId: state.selectedAddressId,
        selectedDeliveryOption: state.selectedDeliveryOption,
        appliedCoupon: state.appliedCoupon,
        selectedPaymentMethod: state.selectedPaymentMethod,
        paymentSubtype: state.paymentSubtype,
        currentOrderId: state.currentOrderId,
        checkoutCustomerId: state.checkoutCustomerId,
      }),
    }
  )
);

export default useCheckoutStore;

