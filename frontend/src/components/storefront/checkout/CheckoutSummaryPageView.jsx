"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Truck,
  Tag,
  ArrowRight,
  ShieldCheck,
  ImageOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../hooks/useAuth.js";
import { useCart } from "../../../hooks/useCart.js";
import { useCheckoutStore } from "../../../stores/checkout.store.js";
import { addressService } from "../../../services/address.service.js";
import { couponService } from "../../../services/coupon.service.js";
import { customerService } from "../../../services/customer.service.js";
import { formatCurrency, parsePrice } from "../../../utils/formatCurrency.js";
import { CheckoutStepIndicator } from "./CheckoutStepIndicator.jsx";
import { CheckoutEmptyCart } from "./CheckoutEmptyCart.jsx";
import { Button } from "../../ui/Button.jsx";

export function CheckoutSummaryPageView() {
  const router = useRouter();
  const { isAuthenticated, isInitialized } = useAuth();
  const { items = [], subtotal = 0, isHydrated } = useCart();
  const {
    selectedAddressId,
    selectedDeliveryOption,
    setSelectedDeliveryOption,
    appliedCoupon,
    setAppliedCoupon,
    fetchQuote,
    quote,
    isLoadingQuote,
  } = useCheckoutStore();

  const [selectedAddress, setSelectedAddress] = useState(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(true);
  const [couponInput, setCouponInput] = useState("");
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  // 1. Guard: If no address selected, redirect back to /checkout/address
  useEffect(() => {
    if (isInitialized && isAuthenticated && !selectedAddressId) {
      toast.info("Please select a delivery address first.");
      router.replace("/checkout/address");
    }
  }, [isInitialized, isAuthenticated, selectedAddressId, router]);

  // 2. Load the selected address details
  useEffect(() => {
    let isCancelled = false;
    if (!isAuthenticated || !selectedAddressId) return;

    addressService
      .getAddresses()
      .then((res) => {
        if (isCancelled) return;
        const list = res?.data?.addresses || (Array.isArray(res?.data) ? res.data : []);
        const found = list.find((a) => (a._id || a.id) === selectedAddressId);
        setSelectedAddress(found || null);
      })
      .catch(() => {
        if (isCancelled) return;
        setSelectedAddress(null);
      })
      .finally(() => {
        if (isCancelled) return;
        setIsLoadingAddress(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, selectedAddressId]);

  // 3. Fetch authoritative quote from backend
  useEffect(() => {
    if (isAuthenticated && selectedAddressId) {
      fetchQuote({
        shippingAddressId: selectedAddressId,
        couponCode: appliedCoupon?.code || null,
        deliveryOptionId: selectedDeliveryOption || "standard",
      });
    }
  }, [isAuthenticated, selectedAddressId, appliedCoupon, selectedDeliveryOption, fetchQuote]);

  // Coupon Handlers
  const handleApplyCoupon = async (e) => {
    if (e) e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      toast.error("Please enter a coupon code.");
      return;
    }

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
          orderAmount: Number(quote?.subtotal || subtotal),
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
        setCouponInput("");
        toast.success(`Coupon "${code}" applied successfully!`);
      } else {
        setAppliedCoupon({ code, discountAmount: 0 });
        setCouponInput("");
        toast.success(`Coupon "${code}" staged for server calculation.`);
      }
    } catch (err) {
      toast.error(err?.message || "Invalid or ineligible coupon code.");
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    toast.info("Coupon removed.");
  };

  const handleContinue = () => {
    if (!selectedAddressId) {
      toast.error("Please select a delivery address.");
      router.push("/checkout/address");
      return;
    }
    router.push("/checkout/payment");
  };

  if (isHydrated && items.length === 0) {
    return <CheckoutEmptyCart />;
  }

  // Financial figures from authoritative backend quote or fallback
  const numericSubtotal = quote?.subtotal ? parsePrice(quote.subtotal) : parsePrice(subtotal);
  const numericDiscount = quote?.couponDiscount ? parsePrice(quote.couponDiscount) : (appliedCoupon?.discountAmount || 0);
  const numericShipping = quote?.shippingTotal !== undefined
    ? parsePrice(quote.shippingTotal)
    : (selectedDeliveryOption === "express" ? 99 : (numericSubtotal >= 499 ? 0 : 40));
  const numericTax = quote?.taxTotal ? parsePrice(quote.taxTotal) : 0;
  const numericGrandTotal = quote?.grandTotal
    ? parsePrice(quote.grandTotal)
    : Math.max(0, numericSubtotal - numericDiscount + numericShipping + numericTax);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Checkout Progress Indicator */}
      <CheckoutStepIndicator currentStep={2} completedSteps={[1]} />

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Left Column: Order Summary Content (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Selected Delivery Address Recap */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-[#004D38]" />
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Delivering to:
                </h2>
              </div>
              <Link
                href="/checkout/address"
                className="text-xs font-bold text-[#004D38] hover:text-[#003D2C] underline underline-offset-4"
              >
                Change Address
              </Link>
            </div>

            {isLoadingAddress ? (
              <div className="h-14 bg-slate-100 rounded-xl animate-pulse" />
            ) : selectedAddress ? (
              <div className="text-xs space-y-1 text-slate-700">
                <p className="font-bold text-slate-900">
                  {[selectedAddress.firstName, selectedAddress.lastName].filter(Boolean).join(" ")}
                  <span className="ml-2 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-slate-600">
                    {selectedAddress.addressType || "Home"}
                  </span>
                </p>
                <p>
                  {selectedAddress.addressLine1}
                  {selectedAddress.addressLine2 ? `, ${selectedAddress.addressLine2}` : ""}
                </p>
                <p>
                  {selectedAddress.city}, {selectedAddress.state} - {selectedAddress.postalCode}
                </p>
                <p className="text-slate-500">Phone: {selectedAddress.phone}</p>
              </div>
            ) : (
              <p className="text-xs text-amber-600 font-semibold">
                No delivery address selected. Please click &quot;Change Address&quot;.
              </p>
            )}
          </div>

          {/* 2. Products in Order */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-950">
                Products in Order ({items.length})
              </h2>
              <Link
                href="/cart"
                className="text-xs font-bold text-[#004D38] hover:text-[#003D2C] underline underline-offset-4"
              >
                Edit Cart
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {items.map((item, idx) => {
                const itemKey = item.productVariantId || item.id || item._id || idx;
                const itemPrice = parsePrice(item.priceSnapshot || item.price || item.unitPrice || 0);
                const itemQty = Number(item.quantity) || 1;
                const lineTotal = itemPrice * itemQty;
                const displayName = item.name || item.title || "Product details unavailable";

                return (
                  <div key={itemKey} className="py-3 flex items-center gap-4 first:pt-0 last:pb-0">
                    <div className="relative size-16 shrink-0 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={displayName}
                          fill
                          sizes="64px"
                          className="object-contain p-1.5"
                        />
                      ) : (
                        <ImageOff className="size-5 text-slate-400 stroke-[1.5]" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="text-xs font-bold text-slate-900 truncate">
                        {displayName}
                      </h3>
                      {item.variantName && (
                        <p className="text-[11px] text-slate-500 truncate">
                          Variant: {item.variantName}
                        </p>
                      )}
                      <p className="text-xs text-slate-600">
                        Qty: <span className="font-bold text-slate-900">{itemQty}</span> × {formatCurrency(itemPrice)}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-slate-900">
                        {formatCurrency(lineTotal)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Delivery Options */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Truck className="size-4 text-[#004D38]" />
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-950">
                Select Delivery Speed
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Standard Delivery */}
              <label
                onClick={() => setSelectedDeliveryOption("standard")}
                className={`relative flex flex-col justify-between p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedDeliveryOption === "standard"
                    ? "border-[#004D38] bg-[#004D38]/5 shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-slate-900">
                      Standard Delivery
                    </span>
                    {numericSubtotal >= 499 ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        FREE
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-slate-900">₹40</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600">3–5 business days</p>
                  <p className="text-[11px] text-slate-500">
                    Surface logistics via verified shipping partners.
                  </p>
                </div>
              </label>

              {/* Express Delivery */}
              <label
                onClick={() => setSelectedDeliveryOption("express")}
                className={`relative flex flex-col justify-between p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedDeliveryOption === "express"
                    ? "border-[#004D38] bg-[#004D38]/5 shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-slate-900">
                      Express Delivery
                    </span>
                    <span className="text-xs font-black text-[#004D38]">₹99</span>
                  </div>
                  <p className="text-xs text-slate-600">1–2 business days</p>
                  <p className="text-[11px] text-slate-500">
                    Priority air express dispatch within 24 hours.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* 4. Offers & Coupons */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Tag className="size-4 text-[#004D38]" />
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-950">
                Offers & Coupons
              </h2>
            </div>

            {appliedCoupon ? (
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-3.5">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs font-black text-emerald-950">
                      Coupon &quot;{appliedCoupon.code}&quot; Applied
                    </p>
                    <p className="text-[11px] text-emerald-700">
                      You are saving {formatCurrency(numericDiscount)} on this order!
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100 transition-colors"
                  title="Remove coupon"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="Enter Coupon Code (e.g. BUYBOX10)"
                  className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:border-[#004D38] focus:outline-hidden"
                />
                <Button
                  type="submit"
                  disabled={isValidatingCoupon || !couponInput.trim()}
                  className="rounded-xl bg-[#004D38] hover:bg-[#003D2C] text-white text-xs font-bold px-5 py-2.5 disabled:opacity-50"
                >
                  {isValidatingCoupon ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
                </Button>
              </form>
            )}
          </div>

          {/* Single Primary CTA */}
          <div className="pt-2 flex justify-end">
            <Button
              type="button"
              onClick={handleContinue}
              disabled={isLoadingQuote || !selectedAddressId}
              className="rounded-full bg-[#004D38] hover:bg-[#003D2C] text-white text-xs font-black uppercase tracking-wider px-8 py-3.5 shadow-md active:scale-98 transition-all gap-2 disabled:opacity-50 cursor-pointer"
            >
              <span>Continue to Payment</span>
              <ArrowRight className="size-4" />
            </Button>
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
              onClick={handleContinue}
              disabled={isLoadingQuote || !selectedAddressId}
              className="w-full rounded-full bg-[#004D38] hover:bg-[#003D2C] text-white text-xs font-black uppercase tracking-wider py-3.5 shadow-md active:scale-98 transition-all gap-2 disabled:opacity-50 cursor-pointer"
            >
              <span>Continue to Payment</span>
              <ArrowRight className="size-4" />
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

export default CheckoutSummaryPageView;
