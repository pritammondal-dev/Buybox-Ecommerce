"use client";

import React from "react";
import PropTypes from "prop-types";
import { CreditCard, ShieldCheck, CheckCircle2, Lock } from "lucide-react";

export function CheckoutPaymentSection({
  selectedMethod = "razorpay",
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-7 items-center justify-center rounded-full bg-[#007A55] text-white text-xs font-black">
          2
        </span>
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-950">
          Payment Method
        </h2>
      </div>

      <div className="space-y-3">
        {/* Razorpay Online Payment Card */}
        <div className="relative flex items-start justify-between rounded-xl border border-[#007A55] bg-emerald-50/40 p-4 ring-1 ring-[#007A55] transition-all">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              <CheckCircle2 className="size-5 text-[#007A55]" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">
                  Online Payment (Razorpay Secure)
                </span>
                <span className="inline-block rounded-md bg-[#007A55]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#007A55]">
                  Instant & Secure
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Pay securely using UPI (Google Pay, PhonePe, Paytm), Credit & Debit Cards, Net Banking, or Digital Wallets.
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

        {/* Honest Disclosure Regarding Cash on Delivery */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 flex items-start gap-2.5 text-xs text-slate-500">
          <Lock className="size-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-slate-700">Notice:</strong> Cash on Delivery (COD) is currently unavailable. All orders are fulfilled through verified digital payment processing backed by industry-standard 256-Bit SSL encryption.
          </p>
        </div>
      </div>
    </div>
  );
}

CheckoutPaymentSection.propTypes = {
  selectedMethod: PropTypes.string,
};

export default CheckoutPaymentSection;
