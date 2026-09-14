"use client";

import React, { useState } from "react";
import { Truck, ShieldCheck, MapPin, CheckCircle2, AlertCircle } from "lucide-react";

export function DeliveryWidget() {
  const [pinCode, setPinCode] = useState("");
  const [validationState, setValidationState] = useState(null); // null | "valid" | "invalid"

  const handleCheck = (e) => {
    e.preventDefault();
    const clean = pinCode.trim();

    // 6-digit Indian PIN code validation pattern
    if (/^[1-9][0-9]{5}$/.test(clean)) {
      setValidationState("valid");
    } else {
      setValidationState("invalid");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
        <MapPin className="size-4 text-[#007A55]" />
        <span>Delivery & Serviceability</span>
      </div>

      <form onSubmit={handleCheck} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            maxLength={6}
            value={pinCode}
            onChange={(e) => {
              setPinCode(e.target.value.replace(/\D/g, ""));
              if (validationState) setValidationState(null);
            }}
            placeholder="Enter 6-digit PIN code"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-[#007A55] font-mono"
          />
        </div>

        <button
          type="submit"
          className="rounded-xl bg-[#007A55] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#006346] active:scale-95 transition-all cursor-pointer shrink-0"
        >
          Check
        </button>
      </form>

      {/* Honest Validation Feedback — No Fake Backend Promises */}
      {validationState === "valid" && (
        <div className="flex items-start gap-2 rounded-xl bg-emerald-50/80 border border-emerald-200/60 p-3 text-xs text-emerald-900 leading-relaxed">
          <CheckCircle2 className="size-4 shrink-0 text-[#007A55] mt-0.5" />
          <div>
            <p className="font-bold">Postal code format valid ({pinCode})</p>
            <p className="text-[11px] text-emerald-800 mt-0.5">
              Live delivery timeline and courier serviceability estimation is unavailable in the current backend. Final shipping options and fees are determined during checkout based on your full address.
            </p>
          </div>
        </div>
      )}

      {validationState === "invalid" && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200/60 p-3 text-xs text-red-700">
          <AlertCircle className="size-4 shrink-0 text-red-500" />
          <span>Please enter a valid 6-digit Indian PIN code.</span>
        </div>
      )}

      {/* Verified Platform Guarantees */}
      <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-slate-600 border-t border-slate-200/60">
        <div className="flex items-center gap-2">
          <Truck className="size-4 text-[#007A55] shrink-0" />
          <span>Courier Dispatch</span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-[#007A55] shrink-0" />
          <span>Genuine Products</span>
        </div>
      </div>
    </div>
  );
}

export default DeliveryWidget;
