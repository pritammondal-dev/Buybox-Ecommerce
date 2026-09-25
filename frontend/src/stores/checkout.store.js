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

      setCurrentOrderId: (orderId) => set({ currentOrderId: orderId }),

      setIsPaymentCancelled: (flag) => set({ isPaymentCancelled: flag }),

      /**
       * Fetch authoritative financial quote from backend
       */
      fetchQuote: async ({
        shippingAddressId = null,
        couponCode = null,
        deliveryOptionId = "standard",
      } = {}) => {
        set({ isLoadingQuote: true, quoteError: null });
        try {
          const res = await orderService.getCheckoutQuote({
            shippingAddressId: shippingAddressId || get().selectedAddressId,
            couponCode: couponCode || get().appliedCoupon?.code || null,
            deliveryOptionId: deliveryOptionId || get().selectedDeliveryOption || "standard",
          });
          const quoteData = res?.data || res;
          set({ quote: quoteData, isLoadingQuote: false });
          return quoteData;
        } catch (err) {
          set({
            quoteError: err?.message || "Failed to calculate checkout quote",
            isLoadingQuote: false,
          });
          return null;
        }
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
          isPaymentCancelled: false,
          quote: null,
          isLoadingQuote: false,
          quoteError: null,
        });
      },
    }),
    {
      name: "buybox_checkout_state",
      partialize: (state) => ({
        selectedAddressId: state.selectedAddressId,
        selectedDeliveryOption: state.selectedDeliveryOption,
        appliedCoupon: state.appliedCoupon,
        selectedPaymentMethod: state.selectedPaymentMethod,
        paymentSubtype: state.paymentSubtype,
        currentOrderId: state.currentOrderId,
      }),
    }
  )
);

export default useCheckoutStore;
