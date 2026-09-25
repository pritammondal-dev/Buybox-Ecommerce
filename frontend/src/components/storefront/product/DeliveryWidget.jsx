"use client";

import React, { useState } from "react";
import {
  Truck,
  ShieldCheck,
  MapPin,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Banknote,
} from "lucide-react";
import {
  STOREFRONT_BUSINESS_POLICIES,
  extractProductWarranty,
} from "../../../config/business-policies.config.js";
import { formatCurrency } from "../../../utils/formatCurrency.js";

const ICON_MAP = {
  Truck,
  RotateCcw,
  ShieldCheck,
  Banknote,
};

export function DeliveryWidget({ product = null }) {
  const [pinCode, setPinCode] = useState("");
  const [validationState, setValidationState] = useState(null); // null | "valid" | "invalid"

  const shippingPolicy = STOREFRONT_BUSINESS_POLICIES.shipping;
  const rawTrustBadges = STOREFRONT_BUSINESS_POLICIES.trustBadges || [];

  // Check if product specifies an authentic warranty in its specifications
  const authenticWarranty = extractProductWarranty(product);

  // Overlay product-specific warranty on the warranty trust badge if present
  const trustBadges = rawTrustBadges.map((badge) => {
    if (badge.key === "warranty" && authenticWarranty) {
      return {
        ...badge,
        label: authenticWarranty,
      };
    }
    return badge;
  });

  const handleCheck = (e) => {
    e.preventDefault();
    const clean = pinCode.trim();

    // 6-digit Indian PIN code validation pattern (cannot begin with 0)
    if (/^[1-9][0-9]{5}$/.test(clean)) {
      setValidationState("valid");
    } else {
      setValidationState("invalid");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
        <MapPin className="size-4 text-[#004D38]" />
        <span>Delivery & Serviceability Check</span>
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
            placeholder="Enter 6-digit Indian PIN code"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-[#004D38] font-mono shadow-2xs"
          />
        </div>

        <button
          type="submit"
          className="rounded-xl bg-[#004D38] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#003D2C] active:scale-95 transition-all cursor-pointer shrink-0 shadow-2xs"
        >
          Check
        </button>
      </form>

      {/* Validation Feedback */}
      {validationState === "valid" && (
        <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 p-3 text-xs text-emerald-950 leading-relaxed">
          <CheckCircle2 className="size-4 shrink-0 text-[#004D38] mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-emerald-900">
              Serviceable to PIN code {pinCode}
            </p>
            <p className="text-[11px] text-emerald-800">
              Estimated delivery in <strong>{shippingPolicy?.standardEstimatedDays || "2–4 business days"}</strong>. Free shipping available on orders above {formatCurrency(shippingPolicy?.freeShippingThreshold || 499)}. {shippingPolicy?.deliveryDisclaimer || "Final delivery carrier options and schedules are confirmed during checkout."}
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

      {/* Dynamic Trust Badges */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200/70 text-xs text-slate-600">
        {trustBadges.map((badge) => {
          const IconComp = ICON_MAP[badge.icon] || ShieldCheck;
          return (
            <div key={badge.id} className="flex items-center gap-2 min-w-0">
              <IconComp className="size-4 text-[#004D38] shrink-0" />
              <span className="line-clamp-1">{badge.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DeliveryWidget;
