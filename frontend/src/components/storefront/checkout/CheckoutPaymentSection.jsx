"use client";

import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Banknote,
  Zap,
  Building2,
  Wallet,
  Globe,
} from "lucide-react";
import {
  STOREFRONT_BUSINESS_POLICIES,
  evaluateCodEligibility,
} from "../../../config/business-policies.config.js";
import { formatCurrency } from "../../../utils/formatCurrency.js";
import { Button } from "../../ui/Button.jsx";
import { paymentMethodService } from "../../../services/payment-method.service.js";

const ICON_COMPONENTS = {
  Zap: Zap,
  CreditCard: CreditCard,
  Building2: Building2,
  Wallet: Wallet,
  Globe: Globe,
  Banknote: Banknote,
};

export function CheckoutPaymentSection({
  selectedMethod = "razorpay",
  onSelectMethod,
  subtotal = 0,
  onContinue,
}) {
  const [methods, setMethods] = useState([]);
  const [isLoadingMethods, setIsLoadingMethods] = useState(true);

  const codEligibility = evaluateCodEligibility(subtotal);

  useEffect(() => {
    let isCancelled = false;

    paymentMethodService
      .getAvailablePaymentMethods({
        country: "IN",
        currency: "INR",
        orderAmount: Number(subtotal) || 0,
      })
      .then((res) => {
        if (isCancelled) return;
        const list = res?.data || [];
        setMethods(list);
      })
      .catch(() => {
        if (isCancelled) return;
        setMethods([]);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingMethods(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [subtotal]);

  // Group razorpay methods vs paypal if dynamic methods are configured
  const hasDynamicMethods = methods.length > 0;
  const paypalMethod = methods.find((m) => m.gateway === "paypal");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-full bg-[#004D38] text-white text-xs font-black">
            4
          </span>
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-950">
            Payment Method
          </h2>
        </div>

        <span className="text-[11px] font-semibold text-slate-500">
          Step 4 of 5
        </span>
      </div>

      <div className="space-y-3">
        {/* Default / Razorpay Online Payment Card */}
        <div
          role="radio"
          aria-checked={selectedMethod === "razorpay" || selectedMethod === "card" || selectedMethod === "upi"}
          tabIndex={0}
          onClick={() => onSelectMethod && onSelectMethod("razorpay")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (onSelectMethod) onSelectMethod("razorpay");
            }
          }}
          className={`relative flex items-start justify-between rounded-xl border p-4 transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#004D38] ${
            selectedMethod === "razorpay" || selectedMethod === "card" || selectedMethod === "upi"
              ? "border-[#004D38] bg-emerald-50/30 ring-1 ring-[#004D38]"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {selectedMethod === "razorpay" || selectedMethod === "card" || selectedMethod === "upi" ? (
                <CheckCircle2 className="size-5 text-[#004D38]" />
              ) : (
                <div className="size-5 rounded-full border-2 border-slate-300" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-sm text-slate-900">
                  Online Payment (UPI, Cards, Net Banking)
                </span>
                <span className="inline-block rounded-md bg-[#004D38]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#004D38]">
                  Instant &amp; Verified
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Pay securely using UPI (Google Pay, PhonePe, Paytm, BHIM), Credit &amp; Debit Cards, Net Banking (50+ Banks), or Wallets.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px] font-semibold text-slate-500">
                <span className="rounded bg-white px-2 py-0.5 border border-slate-200">UPI</span>
                <span className="rounded bg-white px-2 py-0.5 border border-slate-200">Visa / Mastercard / RuPay</span>
                <span className="rounded bg-white px-2 py-0.5 border border-slate-200">Net Banking</span>
                <span className="rounded bg-white px-2 py-0.5 border border-slate-200">Wallets</span>
              </div>
            </div>
          </div>
        </div>

        {/* PayPal Option if active */}
        {paypalMethod && (
          <div
            role="radio"
            aria-checked={selectedMethod === "paypal"}
            tabIndex={0}
            onClick={() => onSelectMethod && onSelectMethod("paypal")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (onSelectMethod) onSelectMethod("paypal");
              }
            }}
            className={`relative flex items-start justify-between rounded-xl border p-4 transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#004D38] ${
              selectedMethod === "paypal"
                ? "border-[#004D38] bg-emerald-50/30 ring-1 ring-[#004D38]"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {selectedMethod === "paypal" ? (
                  <CheckCircle2 className="size-5 text-[#004D38]" />
                ) : (
                  <div className="size-5 rounded-full border-2 border-slate-300" />
                )}
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">
                    {paypalMethod.name || "PayPal & International Cards"}
                  </span>
                  <span className="inline-block rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-700">
                    International Safe
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {paypalMethod.description ||
                    "Pay securely using your PayPal account balance or linked international credit/debit cards."}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px] font-semibold text-slate-500">
                  <span className="rounded bg-white px-2 py-0.5 border border-slate-200">PayPal Checkout</span>
                  <span className="rounded bg-white px-2 py-0.5 border border-slate-200">International Cards</span>
                  <span className="rounded bg-white px-2 py-0.5 border border-slate-200">Multi-Currency (Billed in INR)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cash on Delivery Option (Governed by policy & backend gateway capability) */}
        <div
          role="radio"
          aria-checked={selectedMethod === "cod"}
          aria-disabled={true}
          className="relative flex items-start justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-4 opacity-80 cursor-not-allowed"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              <div className="size-5 rounded-full border-2 border-slate-300 bg-slate-100" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-700">
                  Cash on Delivery (COD)
                </span>
                <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase">
                  Pre-Paid Required
                </span>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                {codEligibility.reason ||
                  "To protect customer orders and guarantee express courier dispatch, verified digital payment is required for checkout on Buybox."}
              </p>
            </div>
          </div>
        </div>

        {/* Security & Encryption Trust Badge */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="size-4 text-[#004D38] shrink-0" />
          <span>All transactions are encrypted with 256-Bit SSL and verified server-side.</span>
        </div>
      </div>

      {/* Continue CTA */}
      {onContinue && (
        <div className="pt-2 flex justify-end border-t border-slate-100">
          <Button
            type="button"
            onClick={onContinue}
            className="rounded-full bg-[#004D38] hover:bg-[#003D2C] text-white text-xs font-bold px-6 py-2.5 shadow-xs active:scale-95 transition-all"
          >
            Continue to Order Review
          </Button>
        </div>
      )}
    </div>
  );
}

CheckoutPaymentSection.propTypes = {
  selectedMethod: PropTypes.string,
  onSelectMethod: PropTypes.func,
  subtotal: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onContinue: PropTypes.func,
};

export default CheckoutPaymentSection;
