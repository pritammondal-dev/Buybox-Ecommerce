"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Smartphone,
  Building2,
  Wallet,
  Globe,
  Banknote,
  Lock,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../hooks/useAuth.js";
import { useCart } from "../../../hooks/useCart.js";
import { useCheckoutStore } from "../../../stores/checkout.store.js";
import { orderService } from "../../../services/order.service.js";
import { paymentService } from "../../../services/payment.service.js";
import { paymentMethodService } from "../../../services/payment-method.service.js";
import { formatCurrency, parsePrice } from "../../../utils/formatCurrency.js";
import { CheckoutStepIndicator } from "./CheckoutStepIndicator.jsx";
import { CheckoutEmptyCart } from "./CheckoutEmptyCart.jsx";
import { Button } from "../../ui/Button.jsx";

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

const POPULAR_BANKS = [
  { id: "HDFC", name: "HDFC Bank" },
  { id: "ICIC", name: "ICICI Bank" },
  { id: "SBIN", name: "State Bank of India" },
  { id: "UTIB", name: "Axis Bank" },
  { id: "KKBK", name: "Kotak Mahindra Bank" },
];

export function CheckoutPaymentPageView() {
  const router = useRouter();
  const { isAuthenticated, isInitialized } = useAuth();
  const { items = [], subtotal = 0, isHydrated, consumeCart } = useCart();
  const {
    selectedAddressId,
    selectedDeliveryOption,
    appliedCoupon,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    currentOrderId,
    setCurrentOrderId,
    isPaymentCancelled,
    setIsPaymentCancelled,
    fetchQuote,
    quote,
    isLoadingQuote,
    resetCheckout,
  } = useCheckoutStore();

  const [methods, setMethods] = useState([]);
  const [isLoadingMethods, setIsLoadingMethods] = useState(true);
  const [selectedGatewayType, setSelectedGatewayType] = useState("upi"); // upi, card, netbanking, wallet, paypal, cod
  const [selectedBank, setSelectedBank] = useState("HDFC");
  const [upiId, setUpiId] = useState("");

  const availableMethods = useMemo(() => {
    if (!methods || methods.length === 0) {
      return [
        { _id: "upi", code: "upi", name: "UPI", description: "Google Pay, PhonePe, Paytm, BHIM & UPI ID", gateway: "razorpay", displayOrder: 1 },
        { _id: "card", code: "card", name: "Credit / Debit Card", description: "Visa, Mastercard, RuPay, Maestro & American Express", gateway: "razorpay", displayOrder: 2 },
        { _id: "netbanking", code: "netbanking", name: "Net Banking", description: "All Indian banks supported (HDFC, SBI, ICICI, Axis, etc.)", gateway: "razorpay", displayOrder: 3 },
        { _id: "wallet", code: "wallet", name: "Wallets", description: "Paytm Wallet, PhonePe, Mobikwik, Airtel Money", gateway: "razorpay", displayOrder: 4 },
      ];
    }
    return [...methods].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }, [methods]);

  const effectiveSelectedGatewayType = availableMethods.some((m) => m.code === selectedGatewayType)
    ? selectedGatewayType
    : (availableMethods[0]?.code || "upi");

  const [isProcessing, setIsProcessing] = useState(false);
  const idempotencyKeyRef = useRef(null);

  // 1. Guards
  useEffect(() => {
    if (isInitialized && isAuthenticated && !selectedAddressId) {
      toast.info("Please select a delivery address first.");
      router.replace("/checkout/address");
    }
  }, [isInitialized, isAuthenticated, selectedAddressId, router]);

  // 2. Fetch authoritative quote
  useEffect(() => {
    if (isAuthenticated && selectedAddressId) {
      fetchQuote({
        shippingAddressId: selectedAddressId,
        couponCode: appliedCoupon?.code || null,
        deliveryOptionId: selectedDeliveryOption || "standard",
      });
    }
  }, [isAuthenticated, selectedAddressId, appliedCoupon, selectedDeliveryOption, fetchQuote]);

  // 3. Fetch active payment methods from backend
  useEffect(() => {
    let isCancelled = false;
    paymentMethodService
      .getAvailablePaymentMethods()
      .then((res) => {
        if (isCancelled) return;
        const list = res?.data?.methods || (Array.isArray(res?.data) ? res.data : []);
        setMethods(list);
        if (list.length > 0) {
          const sorted = [...list].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
          setSelectedGatewayType((curr) => (sorted.some((m) => m.code === curr) ? curr : sorted[0].code));
        }
      })
      .catch(() => {
        if (isCancelled) return;
        setMethods([]);
      })
      .finally(() => {
        if (isCancelled) return;
        setIsLoadingMethods(false);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  if (isHydrated && items.length === 0 && !currentOrderId) {
    return <CheckoutEmptyCart />;
  }

  // Authoritative financial values
  const numericSubtotal = quote?.subtotal ? parsePrice(quote.subtotal) : parsePrice(subtotal);
  const numericDiscount = quote?.couponDiscount ? parsePrice(quote.couponDiscount) : (appliedCoupon?.discountAmount || 0);
  const numericShipping = quote?.shippingTotal !== undefined
    ? parsePrice(quote.shippingTotal)
    : (selectedDeliveryOption === "express" ? 99 : (numericSubtotal >= 499 ? 0 : 40));
  const numericTax = quote?.taxTotal ? parsePrice(quote.taxTotal) : 0;
  const numericGrandTotal = quote?.grandTotal
    ? parsePrice(quote.grandTotal)
    : Math.max(0, numericSubtotal - numericDiscount + numericShipping + numericTax);

  // Handle Pay / Place Order
  const handlePay = async () => {
    if (!selectedAddressId) {
      toast.error("Please select a delivery address.");
      router.push("/checkout/address");
      return;
    }

    setIsProcessing(true);
    setIsPaymentCancelled(false);

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = `bb-ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
    const idempotencyKey = idempotencyKeyRef.current;

    try {
      let orderId = currentOrderId;

      // If we don't have an existing pending order, create one
      if (!orderId) {
        const orderRes = await orderService.createOrder({
          shippingAddressId: selectedAddressId,
          couponCode: appliedCoupon?.code || null,
          deliveryOptionId: selectedDeliveryOption || "standard",
          idempotencyKey,
        });

        const created = orderRes?.data?.order || orderRes?.data;
        orderId = created?._id || created?.id;
        if (!orderId) {
          throw new Error("Could not create order. Please check stock and try again.");
        }
        setCurrentOrderId(orderId);
        // Cart has been converted by backend order creation: idempotently consume local cart
        consumeCart();
      }

      // Branch 1: PayPal selected
      const selectedMethodObj = availableMethods.find((m) => m.code === effectiveSelectedGatewayType);
      const isPayPal = selectedMethodObj?.gateway === "paypal" || effectiveSelectedGatewayType === "paypal";

      if (isPayPal) {
        try {
          const paypalRes = await paymentService.createPayPalOrder(orderId, idempotencyKey);
          const paypalData = paypalRes?.data;
          const approveLink = paypalData?.links?.find?.((l) => l.rel === "approve")?.href;

          idempotencyKeyRef.current = null;
          if (approveLink) {
            toast.success("Redirecting to PayPal for secure checkout...");
            window.location.href = approveLink;
            return;
          }

          resetCheckout();
          router.push(`/order/success/${orderId}`);
          return;
        } catch (payErr) {
          setIsPaymentCancelled(true);
          toast.error(payErr?.message || "Order created, but PayPal payment could not be initiated.");
          return;
        }
      }

      // Branch 2: Razorpay (Cards, UPI, NetBanking, Wallets)
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || typeof window === "undefined" || !window.Razorpay) {
        setIsPaymentCancelled(true);
        toast.error("Payment gateway could not be loaded. Please check your internet connection.");
        return;
      }

      let paymentRes;
      try {
        paymentRes = await paymentService.createPaymentIntent(orderId, idempotencyKey);
      } catch (payErr) {
        setIsPaymentCancelled(true);
        toast.error(payErr?.message || "Payment initiation failed.");
        return;
      }

      const payment = paymentRes?.data?.payment || paymentRes?.data;
      const gatewayOrderId = payment?.gatewayOrderId;
      const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || payment?.keyId;

      if (!gatewayOrderId || !razorpayKey) {
        setIsPaymentCancelled(true);
        toast.error("Payment gateway configuration error. Please try again.");
        return;
      }

      const rzpOptions = {
        key: razorpayKey,
        amount: Math.round(Number(numericGrandTotal) * 100),
        currency: "INR",
        name: "Buybox Store",
        description: `Order #${orderId.slice(-8).toUpperCase()}`,
        order_id: gatewayOrderId,
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
            idempotencyKeyRef.current = null;
            resetCheckout();
            toast.success("Payment verified! Your order is confirmed.");
            router.push(`/order/success/${orderId}`);
          } catch (verifyErr) {
            setIsPaymentCancelled(true);
            toast.error(
              verifyErr?.message || "Payment verification failed. Your order is saved in pending status."
            );
          }
        },
        modal: {
          ondismiss: async function () {
            setIsProcessing(false);
            setIsPaymentCancelled(true);
            try {
              await paymentService.recordPaymentCancellation(orderId);
            } catch {
              // Non-blocking background cancellation log
            }
            toast.info("Payment was cancelled. Your order is saved and you can retry payment anytime.");
          },
        },
      };

      const rzp = new window.Razorpay(rzpOptions);
      rzp.on("payment.failed", async function (response) {
        setIsProcessing(false);
        setIsPaymentCancelled(true);
        toast.error(response?.error?.description || "Payment failed. You can retry with another method.");
      });
      rzp.open();
    } catch (err) {
      setIsProcessing(false);
      setIsPaymentCancelled(true);
      toast.error(err?.message || "Failed to proceed to payment.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Checkout Progress Indicator */}
      <CheckoutStepIndicator currentStep={3} completedSteps={[1, 2]} />

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Left Column: Payment Options (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Payment Cancellation / Retry Banner */}
          {isPaymentCancelled && currentOrderId && (
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 shadow-xs space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="size-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-amber-950">Payment Cancelled</h3>
                  <p className="text-xs text-amber-800">
                    Your order #{currentOrderId.slice(-8).toUpperCase()} has not been charged. Your items and order details are safely saved.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <Button
                  type="button"
                  size="sm"
                  onClick={handlePay}
                  disabled={isProcessing}
                  className="rounded-full bg-[#004D38] hover:bg-[#003D2C] text-white text-xs font-bold px-5 py-2"
                >
                  <RefreshCw className={`size-3.5 mr-1.5 ${isProcessing ? "animate-spin" : ""}`} />
                  Retry Payment
                </Button>
                <Link
                  href={`/orders/${currentOrderId}`}
                  className="text-xs font-bold text-slate-700 hover:text-slate-900 underline underline-offset-4"
                >
                  View Order Details
                </Link>
              </div>
            </div>
          )}

          {/* Payment Method Selection Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-4">
              <h1 className="text-base font-black uppercase tracking-wider text-slate-950">
                Choose Payment Method
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                All transactions are safe and encrypted. Choose your preferred payment option below.
              </p>
            </div>

            {/* Payment Method Accordion / List */}
            <div className="space-y-3">
              {availableMethods.map((method) => {
                const isSelected = effectiveSelectedGatewayType === method.code;
                const isCod = method.code === "cod";
                const isCodDisabled = isCod && !method.enabled;

                if (isCodDisabled) {
                  return (
                    <div
                      key={method._id || method.code}
                      className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 opacity-75"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-lg bg-slate-200 text-slate-500">
                            <Banknote className="size-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                                {method.name || "Cash on Delivery (COD)"}
                              </span>
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-900 uppercase">
                                Temporarily Unavailable
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500">
                              {method.description || "Pre-paid digital orders only. Verified cashless delivery policy in effect."}
                            </span>
                          </div>
                        </div>
                        <input type="radio" disabled checked={false} className="size-4 cursor-not-allowed" />
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={method._id || method.code}
                    className={`rounded-xl border-2 transition-all overflow-hidden ${
                      isSelected
                        ? "border-[#004D38] bg-slate-50/50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedGatewayType(method.code)}
                      className="w-full flex items-center justify-between p-4 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex size-9 items-center justify-center rounded-lg ${
                            method.code === "upi"
                              ? "bg-emerald-50 text-[#004D38]"
                              : method.code === "card" || method.code === "international_card"
                              ? "bg-blue-50 text-blue-700"
                              : method.code === "netbanking"
                              ? "bg-indigo-50 text-indigo-700"
                              : method.code === "wallet"
                              ? "bg-purple-50 text-purple-700"
                              : method.code === "paypal"
                              ? "bg-sky-50 text-sky-700"
                              : "bg-emerald-50 text-[#004D38]"
                          }`}
                        >
                          {method.code === "upi" && <Smartphone className="size-5" />}
                          {(method.code === "card" || method.code === "international_card") && (
                            <CreditCard className="size-5" />
                          )}
                          {method.code === "netbanking" && <Building2 className="size-5" />}
                          {method.code === "wallet" && <Wallet className="size-5" />}
                          {method.code === "paypal" && <Globe className="size-5" />}
                          {method.code === "cod" && <Banknote className="size-5" />}
                          {!["upi", "card", "international_card", "netbanking", "wallet", "paypal", "cod"].includes(
                            method.code
                          ) && <CreditCard className="size-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-900 block">
                              {method.name}
                            </span>
                            {method.code === "paypal" && (
                              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                                International Cards
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500">
                            {method.description}
                          </span>
                        </div>
                      </div>
                      <input
                        type="radio"
                        checked={isSelected}
                        onChange={() => setSelectedGatewayType(method.code)}
                        className="accent-[#004D38] size-4 cursor-pointer"
                      />
                    </button>

                    {isSelected && method.code === "upi" && (
                      <div className="border-t border-slate-200/60 bg-white p-4 space-y-3">
                        <p className="text-xs text-slate-600 font-semibold">
                          Pay using any UPI App or enter your Virtual Payment Address (VPA):
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value)}
                            placeholder="e.g. yourname@okhdfcbank"
                            className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:border-[#004D38] focus:outline-hidden"
                          />
                        </div>
                        <p className="text-[11px] text-slate-500">
                          You will be prompted to approve the request on your UPI app.
                        </p>
                      </div>
                    )}

                    {isSelected && (method.code === "card" || method.code === "international_card") && (
                      <div className="border-t border-slate-200/60 bg-white p-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#004D38]">
                          <ShieldCheck className="size-4" />
                          <span>256-Bit SSL Encrypted Card Processing</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Pay securely using any Credit or Debit Card (Visa, Mastercard, RuPay, Maestro, American Express). Card credentials are encrypted and entered directly in Razorpay&apos;s PCI-DSS certified gateway modal.
                        </p>
                      </div>
                    )}

                    {isSelected && method.code === "netbanking" && (
                      <div className="border-t border-slate-200/60 bg-white p-4 space-y-3">
                        <p className="text-xs text-slate-600 font-semibold">Select your bank:</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {POPULAR_BANKS.map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => setSelectedBank(b.id)}
                              className={`rounded-xl border p-2.5 text-xs font-bold text-center transition-all ${
                                selectedBank === b.id
                                  ? "border-[#004D38] bg-[#004D38]/5 text-[#004D38] font-black"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                              }`}
                            >
                              {b.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {isSelected && method.code === "wallet" && (
                      <div className="border-t border-slate-200/60 bg-white p-4 space-y-2">
                        <p className="text-xs text-slate-600">
                          Supports Paytm Wallet, PhonePe Wallet, Mobikwik, and Airtel Money. You will be able to select your wallet inside the checkout popup.
                        </p>
                      </div>
                    )}

                    {isSelected && method.code === "paypal" && (
                      <div className="border-t border-slate-200/60 bg-white p-4 space-y-2">
                        <p className="text-xs text-slate-600">
                          You will be securely redirected to PayPal to complete your payment with your PayPal balance or international credit card.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Single Primary CTA */}
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <Button
                type="button"
                onClick={handlePay}
                disabled={isProcessing || !selectedAddressId || items.length === 0}
                className="rounded-full bg-[#004D38] hover:bg-[#003D2C] text-white text-xs font-black uppercase tracking-wider px-8 py-3.5 shadow-md active:scale-98 transition-all gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Processing Payment...</span>
                  </>
                ) : selectedGatewayType === "paypal" ? (
                  <>
                    <Globe className="size-4" />
                    <span>Continue with PayPal</span>
                  </>
                ) : (
                  <>
                    <Lock className="size-4" />
                    <span>Pay {formatCurrency(numericGrandTotal)}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Authoritative Price Details (5 cols) */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-black text-slate-950 uppercase tracking-wider border-b border-slate-100 pb-3">
              Price Details ({items.length} {items.length === 1 ? "Item" : "Items"})
            </h2>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal</span>
                <span className="font-semibold text-slate-900">{formatCurrency(numericSubtotal)}</span>
              </div>

              {numericDiscount > 0 && (
                <div className="flex justify-between text-[#004D38] font-semibold">
                  <span>Coupon Discount</span>
                  <span>-{formatCurrency(numericDiscount)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600">
                <span>Delivery Charges</span>
                <span className="font-semibold text-slate-900">
                  {numericShipping === 0 ? (
                    <span className="text-[#004D38] font-bold uppercase">FREE</span>
                  ) : (
                    formatCurrency(numericShipping)
                  )}
                </span>
              </div>

              {numericTax > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Estimated Taxes (GST)</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(numericTax)}</span>
                </div>
              )}

              <div className="flex items-baseline justify-between border-t border-slate-200 pt-3 text-sm">
                <span className="font-black text-slate-950">Total Payable</span>
                <span className="text-xl font-black text-[#004D38] tracking-tight">
                  {formatCurrency(numericGrandTotal)}
                </span>
              </div>
            </div>

            <Button
              type="button"
              onClick={handlePay}
              disabled={isProcessing || !selectedAddressId || items.length === 0}
              className="w-full rounded-full bg-[#004D38] hover:bg-[#003D2C] text-white text-xs font-black uppercase tracking-wider py-3.5 shadow-md active:scale-98 transition-all gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Processing Payment...</span>
                </>
              ) : selectedGatewayType === "paypal" ? (
                <>
                  <Globe className="size-4" />
                  <span>Continue with PayPal</span>
                </>
              ) : (
                <>
                  <Lock className="size-4" />
                  <span>Pay {formatCurrency(numericGrandTotal)}</span>
                </>
              )}
            </Button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-1">
              <ShieldCheck className="size-4 text-[#004D38]" />
              <span>Safe 256-Bit SSL Encrypted Checkout</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CheckoutPaymentPageView;
