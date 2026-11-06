"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../hooks/useAuth.js";
import { useCart } from "../../../hooks/useCart.js";
import { useStorefrontSettings } from "../../../hooks/useStorefrontSettings.js";
import { addressService } from "../../../services/address.service.js";
import { useAddressStore } from "../../../stores/address.store.js";
import { orderService } from "../../../services/order.service.js";
import { paymentService } from "../../../services/payment.service.js";
import { couponService } from "../../../services/coupon.service.js";
import { customerService } from "../../../services/customer.service.js";
import {
  STOREFRONT_BUSINESS_POLICIES,
  calculateDeliveryFee,
  evaluateCodEligibility,
} from "../../../config/business-policies.config.js";
import { formatCurrency, parsePrice } from "../../../utils/formatCurrency.js";
import { CheckoutStepIndicator } from "./CheckoutStepIndicator.jsx";
import { CheckoutAddressSection } from "./CheckoutAddressSection.jsx";
import { CheckoutDeliveryOptions } from "./CheckoutDeliveryOptions.jsx";
import { CheckoutPaymentSection } from "./CheckoutPaymentSection.jsx";
import { CheckoutCouponSection } from "./CheckoutCouponSection.jsx";
import { CheckoutOrderSummary } from "./CheckoutOrderSummary.jsx";
import { CheckoutSkeleton } from "./CheckoutSkeleton.jsx";
import { CheckoutEmptyCart } from "./CheckoutEmptyCart.jsx";
import { useCheckoutStore } from "../../../stores/checkout.store.js";
import { PriceChangeConfirmationModal } from "./PriceChangeConfirmationModal.jsx";

/**
 * Dynamically load Razorpay SDK checkout script
 */
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function CheckoutPageView() {
  const router = useRouter();
  const { isAuthenticated, isInitialized } = useAuth();
  const { isFeatureEnabled } = useStorefrontSettings();
  const guestCheckoutEnabled = isFeatureEnabled("guestCheckout");
  const [isGuestMode, setIsGuestMode] = useState(false);
  const {
    items = [],
    subtotal = 0,
    shippingTotal = 0,
    taxTotal = 0,
    isHydrated,
    clearCart,
    fetchServerCart,
  } = useCart();

  // Multi-step state (Steps 1 to 5)
  const [currentStep, setCurrentStep] = useState(1);

  // Address state
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
  const [isMutatingAddress, setIsMutatingAddress] = useState(false);

  // Delivery options state
  const [selectedDeliveryOption, setSelectedDeliveryOption] = useState("standard");

  // Coupon state
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  // Payment method state
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("razorpay");

  // Checkout store quote integration
  const { quote, fetchQuote, isQuoteExpired } = useCheckoutStore();
  const [priceChangeData, setPriceChangeData] = useState(null);
  const [isRefreshingQuote, setIsRefreshingQuote] = useState(false);
  const [priceChangeError, setPriceChangeError] = useState(null);

  // Cart validation on mount status
  const [cartValidationNotice, setCartValidationNotice] = useState(null);

  // Order submission state
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const idempotencyKeyRef = useRef(null);

  // 1. Authoritative cart synchronization on load
  useEffect(() => {
    if (!isAuthenticated) return;

    fetchServerCart()
      .then((serverCart) => {
        if (!serverCart || !serverCart.items || serverCart.items.length === 0) {
          return;
        }
        // Check if any server values updated
        setCartValidationNotice(
          "Cart prices and inventory synchronized with live catalog."
        );
      })
      .catch((err) => {
        console.warn("Cart revalidation notice:", err?.message);
      });
  }, [isAuthenticated, fetchServerCart]);

  // 2. Load customer addresses
  useEffect(() => {
    let isCancelled = false;

    if (!isAuthenticated) return;

    addressService
      .getAddresses()
      .then((res) => {
        if (isCancelled) return;
        const list = res?.data?.addresses || (Array.isArray(res?.data) ? res.data : []);
        setAddresses(list);

        if (list.length > 0) {
          setSelectedAddressId((current) => {
            if (current && list.some((a) => (a._id || a.id) === current)) {
              return current;
            }
            const defaultAddr = list.find((a) => a.isDefault) || list[0];
            return defaultAddr._id || defaultAddr.id;
          });
        } else {
          setSelectedAddressId(null);
        }
      })
      .catch(() => {
        if (isCancelled) return;
        setAddresses([]);
        setSelectedAddressId(null);
      })
      .finally(() => {
        if (isCancelled) return;
        setIsLoadingAddresses(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated]);

  // Fetch authoritative quote when address, coupon, or delivery option changes
  useEffect(() => {
    if (isAuthenticated && selectedAddressId) {
      fetchQuote({
        shippingAddressId: selectedAddressId,
        couponCode: appliedCoupon?.code || null,
        deliveryOptionId: selectedDeliveryOption || "standard",
      });
    }
  }, [isAuthenticated, selectedAddressId, appliedCoupon, selectedDeliveryOption, fetchQuote]);

  // Calculate dynamic delivery fee from policy
  const effectiveDeliveryFee = useMemo(() => {
    return calculateDeliveryFee(subtotal, selectedDeliveryOption);
  }, [subtotal, selectedDeliveryOption]);

  // Compute completed steps
  const completedSteps = useMemo(() => {
    const steps = [];
    if (selectedAddressId) steps.push(1);
    if (selectedAddressId && selectedDeliveryOption) steps.push(2);
    if (selectedAddressId && selectedDeliveryOption) steps.push(3);
    if (selectedAddressId && selectedDeliveryOption && selectedPaymentMethod) steps.push(4);
    return steps;
  }, [selectedAddressId, selectedDeliveryOption, selectedPaymentMethod]);

  // Address CRUD Handlers
  const handleCreateAddress = async (payload) => {
    setIsMutatingAddress(true);
    try {
      const res = await addressService.createAddress(payload);
      const created = res?.data?.address || res?.data;
      if (created) {
        const id = created._id || created.id;
        setAddresses((prev) => [...prev, created]);
        setSelectedAddressId(id);
        toast.success("Delivery address added successfully");
        useAddressStore.getState().fetchAddresses(true).catch(() => {});
        return true;
      }
      return false;
    } catch (err) {
      toast.error(err?.message || "Failed to save address. Please verify your inputs.");
      return false;
    } finally {
      setIsMutatingAddress(false);
    }
  };

  const handleUpdateAddress = async (id, payload) => {
    setIsMutatingAddress(true);
    try {
      const res = await addressService.updateAddress(id, payload);
      const updated = res?.data?.address || res?.data;
      if (updated) {
        setAddresses((prev) =>
          prev.map((a) => ((a._id || a.id) === id ? updated : a))
        );
        toast.success("Address updated successfully");
        useAddressStore.getState().fetchAddresses(true).catch(() => {});
        return true;
      }
      return false;
    } catch (err) {
      toast.error(err?.message || "Failed to update address.");
      return false;
    } finally {
      setIsMutatingAddress(false);
    }
  };

  const handleDeleteAddress = async (id) => {
    setIsMutatingAddress(true);
    try {
      await addressService.deleteAddress(id);
      setAddresses((prev) => {
        const next = prev.filter((a) => (a._id || a.id) !== id);
        if (selectedAddressId === id) {
          const nextSelected = next[0]?._id || next[0]?.id || null;
          setSelectedAddressId(nextSelected);
        }
        return next;
      });
      toast.success("Address removed successfully");
      useAddressStore.getState().fetchAddresses(true).catch(() => {});
      return true;
    } catch (err) {
      toast.error(err?.message || "Failed to delete address.");
      return false;
    } finally {
      setIsMutatingAddress(false);
    }
  };

  // Coupon Handlers with strict backend authoritative validation
  const handleApplyCoupon = async (code) => {
    setIsValidatingCoupon(true);
    try {
      let customerId = null;
      try {
        const profileRes = await customerService.getProfile();
        customerId = profileRes?.data?.customer?._id || profileRes?.data?.customer?.id;
      } catch {
        // Fallback handled below
      }

      if (customerId) {
        const validateRes = await couponService.validateCoupon({
          code,
          customerId,
          orderAmount: Number(subtotal),
          items: items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
          })),
        });
        const couponData = validateRes?.data?.coupon || validateRes?.data;
        const discountAmount = validateRes?.data?.discountAmount || 0;
        setAppliedCoupon({
          code,
          coupon: couponData,
          discountAmount,
        });
        toast.success(`Coupon "${code}" applied successfully!`);
      } else {
        // Stage coupon to be validated and applied authoritatively by backend createOrder
        setAppliedCoupon({ code, discountAmount: 0 });
        toast.success(`Coupon "${code}" staged for authoritative server-side calculation.`);
      }
      return true;
    } catch (err) {
      toast.error(err?.message || "Invalid or ineligible coupon code.");
      return false;
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    toast.info("Coupon removed.");
  };

  // Authoritative financial totals
  const numericSubtotal = quote?.subtotal ? parsePrice(quote.subtotal) : parsePrice(subtotal);
  const numericDiscount = quote?.couponDiscount ? parsePrice(quote.couponDiscount) : (appliedCoupon?.discountAmount || 0);
  const numericShipping = quote?.shippingTotal !== undefined ? parsePrice(quote.shippingTotal) : effectiveDeliveryFee;
  const numericTax = quote?.taxTotal ? parsePrice(quote.taxTotal) : parsePrice(taxTotal);
  const finalPayableEstimate = quote?.grandTotal
    ? parsePrice(quote.grandTotal)
    : Math.max(0, numericSubtotal - numericDiscount + numericShipping + numericTax);

  // Place Order & Pay Handler
  const executeOrderPlacement = async (overrideQuote = null) => {
    if (isSubmittingOrder) return;

    if (!selectedAddressId) {
      toast.error("Please select or add a delivery address.");
      setCurrentStep(1);
      return;
    }

    if (items.length === 0) {
      toast.error("Your cart is empty.");
      router.push("/shop");
      return;
    }

    const selectedAddress = addresses.find(
      (a) => (a._id || a.id) === selectedAddressId
    );

    setIsSubmittingOrder(true);

    try {
      // 1. Obtain and verify authoritative quote
      let effectiveQuote = overrideQuote || quote;
      const quoteExpired = typeof isQuoteExpired === "function" ? isQuoteExpired() : false;

      if (!effectiveQuote?.quoteReference || quoteExpired) {
        try {
          effectiveQuote = await fetchQuote({
            shippingAddressId: selectedAddressId,
            couponCode: appliedCoupon?.code || null,
            deliveryOptionId: selectedDeliveryOption || "standard",
            force: true,
          });
        } catch {
          toast.error("Unable to obtain latest pricing quote. Please check your network.");
          setIsSubmittingOrder(false);
          return;
        }
      }

      if (!effectiveQuote?.quoteReference) {
        toast.error("Unable to obtain a valid quote reference. Please refresh.");
        setIsSubmittingOrder(false);
        return;
      }

      // Check for price changes upon refresh
      if (!overrideQuote) {
        const freshTotal = parsePrice(effectiveQuote.grandTotal);
        if (Math.abs(freshTotal - finalPayableEstimate) > 0.001) {
          setPriceChangeData({
            previousQuote: {
              grandTotal: finalPayableEstimate,
              subtotal: numericSubtotal,
              discountTotal: numericDiscount,
              shippingTotal: numericShipping,
              taxTotal: numericTax,
              currency: "INR",
              items,
            },
            currentQuote: effectiveQuote,
            reason: "quote_refreshed_changed",
          });
          setIsSubmittingOrder(false);
          return;
        }
      }

      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = `bb-ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      }
      const idempotencyKey = idempotencyKeyRef.current;

      // 2. Create order with authoritative backend calculation and bound quoteReference
      const orderRes = await orderService.createOrder({
        shippingAddressId: selectedAddressId,
        couponCode: appliedCoupon?.code || null,
        deliveryOptionId: selectedDeliveryOption || "standard",
        quoteReference: effectiveQuote.quoteReference,
        idempotencyKey,
      });

      const order = orderRes?.data?.order || orderRes?.data;
      const orderId = order?._id || order?.id;

      if (!orderId) {
        throw new Error("Order could not be created. Please try again.");
      }

      // 3. If PayPal is selected
      if (selectedPaymentMethod === "paypal") {
        try {
          const paypalRes = await paymentService.createPayPalOrder(orderId, idempotencyKey);
          const paypalData = paypalRes?.data;
          const approveLink = paypalData?.links?.find?.((l) => l.rel === "approve")?.href;

          await clearCart();
          idempotencyKeyRef.current = null;

          if (approveLink) {
            toast.success("Redirecting to PayPal for secure checkout...");
            window.location.href = approveLink;
            return;
          }

          toast.info(
            `Order #${order.orderNumber || orderId} created with PayPal. Please check your order details.`
          );
          router.push(`/order/success/${orderId}`);
          return;
        } catch (payErr) {
          await clearCart();
          toast.error(payErr?.message || "Order created, but PayPal payment could not be initiated.");
          router.push(`/order/success/${orderId}`);
          return;
        }
      }

      // 4. Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || typeof window === "undefined" || !window.Razorpay) {
        await clearCart();
        toast.info(
          `Order #${order.orderNumber || orderId} was created in pending status. Payment gateway could not be loaded.`
        );
        router.push(`/order/success/${orderId}`);
        return;
      }

      // 5. Create payment intent in backend
      let paymentRes;
      try {
        paymentRes = await paymentService.createPaymentIntent(orderId, idempotencyKey);
      } catch (payErr) {
        await clearCart();
        toast.error(payErr?.message || "Order created, but payment initiation could not complete.");
        router.push(`/order/success/${orderId}`);
        return;
      }

      const payment = paymentRes?.data?.payment || paymentRes?.data;
      const gatewayOrderId = payment?.gatewayOrderId;

      if (!gatewayOrderId) {
        await clearCart();
        toast.info(`Order #${order.orderNumber || orderId} created. Please complete payment from your orders.`);
        router.push(`/order/success/${orderId}`);
        return;
      }

      const razorpayKey =
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || payment?.keyId;

      if (!razorpayKey) {
        await clearCart();
        toast.error(
          "Payment gateway key is not configured. Your order was created with pending payment. Please complete payment from your orders."
        );
        router.push(`/order/success/${orderId}`);
        return;
      }

      // 6. Open Razorpay Checkout Modal
      const rzpOptions = {
        key: razorpayKey,
        amount: Math.round(Number(order.grandTotal) * 100),
        currency: order.currency || "INR",
        name: "Buybox Store",
        description: `Order #${order.orderNumber || orderId}`,
        order_id: gatewayOrderId,
        prefill: {
          name: selectedAddress
            ? [selectedAddress.firstName, selectedAddress.lastName].filter(Boolean).join(" ")
            : "",
          contact: selectedAddress?.phone || "",
        },
        theme: {
          color: "#004D38",
        },
        handler: async function (response) {
          try {
            await paymentService.verifyPaymentSignature({
              orderId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            await clearCart();
            idempotencyKeyRef.current = null;
            toast.success("Payment verified! Your order is confirmed.");
            router.push(`/order/success/${orderId}`);
          } catch (verifyErr) {
            await clearCart();
            toast.error(
              verifyErr?.message || "Payment verification failed. Your order is pending verification."
            );
            router.push(`/order/success/${orderId}`);
          }
        },
        modal: {
          ondismiss: async function () {
            await clearCart();
            toast.info(
              `Payment was not completed. Order #${order.orderNumber || orderId} is saved in pending status.`
            );
            router.push(`/order/success/${orderId}`);
          },
        },
      };

      const rzp = new window.Razorpay(rzpOptions);
      rzp.on("payment.failed", async function (response) {
        toast.error(response?.error?.description || "Payment failed. You can retry from your account.");
      });
      rzp.open();
    } catch (err) {
      if (err?.code === "PRICE_CHANGED") {
        idempotencyKeyRef.current = null;
        setPriceChangeData({
          previousQuote: err.details?.previousQuote || {
            grandTotal: err.details?.quotedGrandTotal ?? finalPayableEstimate,
            currency: err.details?.currency || "INR",
          },
          currentQuote: err.details?.currentQuote || {
            grandTotal: err.details?.currentGrandTotal,
            currency: err.details?.currency || "INR",
            subtotal: err.details?.subtotal,
            discountTotal: err.details?.discountTotal,
            shippingTotal: err.details?.shippingTotal,
            taxTotal: err.details?.taxTotal,
          },
          reason: err.details?.reason || "component_changed",
        });
        return;
      }

      if (err?.code === "QUOTE_EXPIRED") {
        idempotencyKeyRef.current = null;
        toast.info("Your checkout quote was refreshed to ensure the latest pricing.");
        setIsRefreshingQuote(true);
        try {
          const refreshedQuote = await fetchQuote({
            shippingAddressId: selectedAddressId,
            couponCode: appliedCoupon?.code || null,
            deliveryOptionId: selectedDeliveryOption || "standard",
            force: true,
          });
          if (refreshedQuote) {
            const refreshedTotal = parsePrice(refreshedQuote.grandTotal);
            if (Math.abs(refreshedTotal - finalPayableEstimate) > 0.001) {
              setPriceChangeData({
                previousQuote: err.details?.previousQuote || {
                  grandTotal: finalPayableEstimate,
                  currency: "INR",
                  items,
                },
                currentQuote: refreshedQuote,
                reason: "expired_refresh_change",
              });
            }
          }
        } catch {
          toast.error("Could not refresh quote. Please try again.");
        } finally {
          setIsRefreshingQuote(false);
        }
        return;
      }

      toast.error(err?.message || "Failed to place order. Please review your cart and stock.");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handlePlaceOrder = () => executeOrderPlacement();

  const handleConfirmPriceChange = async () => {
    setIsRefreshingQuote(true);
    setPriceChangeError(null);
    try {
      const freshQuote = await fetchQuote({
        shippingAddressId: selectedAddressId,
        couponCode: appliedCoupon?.code || null,
        deliveryOptionId: selectedDeliveryOption || "standard",
        force: true,
      });

      if (!freshQuote) {
        throw new Error("Unable to retrieve updated quote. Please check your connection.");
      }

      const modalCurrentTotal = parsePrice(
        priceChangeData?.currentQuote?.grandTotal ?? priceChangeData?.currentQuote?.currentGrandTotal ?? 0
      );
      const freshTotal = parsePrice(freshQuote.grandTotal);

      if (Math.abs(modalCurrentTotal - freshTotal) > 0.001) {
        setPriceChangeData({
          previousQuote: priceChangeData.currentQuote,
          currentQuote: freshQuote,
          reason: "re_updated",
        });
        toast.info("Pricing was updated again. Please review the updated total.");
        return;
      }

      setPriceChangeData(null);
      idempotencyKeyRef.current = `bb-ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      toast.success("Price confirmed. Proceeding to place order...");
      await executeOrderPlacement(freshQuote);
    } catch (err) {
      setPriceChangeError(err?.message || "Failed to confirm updated pricing. Please retry.");
    } finally {
      setIsRefreshingQuote(false);
    }
  };

  const handleCancelPriceChange = () => {
    setPriceChangeData(null);
    setPriceChangeError(null);
    router.push("/cart");
  };

  // Wait for initial auth check and cart hydration
  if (!isInitialized || !isHydrated) {
    return <CheckoutSkeleton />;
  }

  // Auth requirement gate
  if (!isAuthenticated && (!guestCheckoutEnabled || !isGuestMode)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center space-y-6">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-50 text-[#004D38] shadow-xs">
          <Lock className="size-8 stroke-[1.75]" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-950 tracking-tight">
            Sign In to Complete Checkout
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
            {guestCheckoutEnabled
              ? "Sign in to access your saved addresses and order history, or continue as guest to complete your order."
              : "Guest checkout is currently disabled. Please sign in or create an account to securely complete your order. Your cart items are preserved."}
          </p>
        </div>
        <div className="flex flex-col gap-3 pt-2">
          <Link
            href="/auth/login?redirect=/checkout"
            className="w-full rounded-full bg-[#004D38] hover:bg-[#003D2C] text-white font-bold text-sm py-3.5 shadow-md active:scale-95 transition-all text-center cursor-pointer"
          >
            Sign In to Checkout
          </Link>
          <Link
            href="/auth/register?redirect=/checkout"
            className="w-full rounded-full border border-slate-200 bg-white text-slate-800 font-bold text-sm py-3 hover:bg-slate-50 text-center transition-all cursor-pointer"
          >
            Create an Account
          </Link>
          {guestCheckoutEnabled && (
            <button
              type="button"
              onClick={() => setIsGuestMode(true)}
              className="w-full rounded-full border border-[#004D38] text-[#004D38] font-bold text-sm py-3 hover:bg-emerald-50 text-center transition-all cursor-pointer"
            >
              Continue as Guest
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400">
          Your cart items will be safely preserved across sessions.
        </p>
      </div>
    );
  }

  // Empty cart gate
  if (items.length === 0) {
    return <CheckoutEmptyCart />;
  }

  const finalPayableEstimate = Math.max(
    0,
    parsePrice(subtotal) -
      parsePrice(appliedCoupon?.discountAmount || 0) +
      parsePrice(effectiveDeliveryFee) +
      parsePrice(taxTotal)
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link href="/" className="hover:text-[#004D38] transition-colors">
          Home
        </Link>
        <span>/</span>
        <Link href="/cart" className="hover:text-[#004D38] transition-colors">
          Shopping Cart
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-900">Checkout</span>
      </nav>

      {/* Page Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
          Secure Checkout
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Select delivery location, choose logistics, apply coupons, and proceed to verified payment
        </p>
      </div>

      {/* Step Indicator */}
      <CheckoutStepIndicator
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={(stepId) => setCurrentStep(stepId)}
      />

      {/* Cart validation notification if synced */}
      {cartValidationNotice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-[#004D38] shrink-0" />
            <span>{cartValidationNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setCartValidationNotice(null)}
            className="text-[11px] font-bold text-[#004D38] hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Left Column: Checkout Steps (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step 1: Delivery Address */}
          <section aria-labelledby="step-address-heading">
            <CheckoutAddressSection
              addresses={addresses}
              selectedAddressId={selectedAddressId}
              onSelectAddress={(id) => setSelectedAddressId(id)}
              onCreateAddress={handleCreateAddress}
              onUpdateAddress={handleUpdateAddress}
              onDeleteAddress={handleDeleteAddress}
              isLoading={isLoadingAddresses}
              isMutating={isMutatingAddress}
              onContinue={() => setCurrentStep(2)}
            />
          </section>

          {/* Step 2: Delivery Options */}
          <section aria-labelledby="step-delivery-heading">
            <CheckoutDeliveryOptions
              selectedOptionId={selectedDeliveryOption}
              onSelectOption={(opt) => setSelectedDeliveryOption(opt)}
              subtotal={subtotal}
              onContinue={() => setCurrentStep(3)}
            />
          </section>

          {/* Step 3: Offers / Coupons */}
          <section aria-labelledby="step-coupons-heading">
            <CheckoutCouponSection
              appliedCoupon={appliedCoupon}
              onApplyCoupon={handleApplyCoupon}
              onRemoveCoupon={handleRemoveCoupon}
              isLoading={isValidatingCoupon}
              onContinue={() => setCurrentStep(4)}
            />
          </section>

          {/* Step 4: Payment Method */}
          <section aria-labelledby="step-payment-heading">
            <CheckoutPaymentSection
              selectedMethod={selectedPaymentMethod}
              onSelectMethod={(m) => setSelectedPaymentMethod(m)}
              subtotal={subtotal}
              onContinue={() => setCurrentStep(5)}
            />
          </section>
        </div>

        {/* Right Column: Order Summary (5 cols, sticky on desktop) */}
        <div className="lg:col-span-5">
          <CheckoutOrderSummary
            items={items}
            subtotal={subtotal}
            productDiscount={quote?.productDiscount || 0}
            discountTotal={appliedCoupon?.discountAmount || 0}
            shippingTotal={effectiveDeliveryFee}
            taxTotal={taxTotal}
            isSubmitting={isSubmittingOrder}
            selectedAddressId={selectedAddressId}
            onPlaceOrder={handlePlaceOrder}
          />
        </div>
      </div>

      {/* Mobile Sticky Bottom Pay Bar (visible on <lg screens) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 block lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md p-3 shadow-lg">
        <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">
              Total Payable
            </span>
            <span className="text-base font-black text-[#004D38] tracking-tight">
              {formatCurrency(finalPayableEstimate)}
            </span>
          </div>

          <button
            type="button"
            onClick={handlePlaceOrder}
            disabled={isSubmittingOrder || !selectedAddressId}
            className="flex-1 max-w-[220px] rounded-full bg-[#004D38] hover:bg-[#003D2C] text-white font-bold text-xs py-3 px-4 shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
          >
            {isSubmittingOrder ? (
              <span>Processing...</span>
            ) : (
              <>
                <Lock className="size-3.5" />
                <span>Place Order & Pay</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Authoritative Price Change Confirmation Dialog */}
      <PriceChangeConfirmationModal
        isOpen={Boolean(priceChangeData)}
        previousQuote={priceChangeData?.previousQuote}
        currentQuote={priceChangeData?.currentQuote}
        isRefreshing={isRefreshingQuote}
        error={priceChangeError}
        onConfirm={handleConfirmPriceChange}
        onCancel={handleCancelPriceChange}
      />
    </div>
  );
}

export default CheckoutPageView;
