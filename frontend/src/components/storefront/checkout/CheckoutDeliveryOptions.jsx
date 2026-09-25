"use client";

import React from "react";
import PropTypes from "prop-types";
import { Truck, Zap, CheckCircle2, ShieldCheck, Clock } from "lucide-react";
import {
  STOREFRONT_BUSINESS_POLICIES,
  calculateDeliveryFee,
} from "../../../config/business-policies.config.js";
import { formatCurrency } from "../../../utils/formatCurrency.js";
import { Button } from "../../ui/Button.jsx";

export function CheckoutDeliveryOptions({
  selectedOptionId = "standard",
  onSelectOption,
  subtotal = 0,
  onContinue,
}) {
  const shippingConfig = STOREFRONT_BUSINESS_POLICIES.shipping;
  const options = shippingConfig?.options || [
    {
      id: "standard",
      name: "Standard Delivery",
      estimatedDays: shippingConfig.standardEstimatedDays,
      badge: "Free Delivery Eligible",
      description: "Standard ground shipping via verified courier partners.",
    },
    {
      id: "express",
      name: "Express Delivery",
      estimatedDays: shippingConfig.expressEstimatedDays,
      badge: shippingConfig.expressDispatchLabel,
      description: shippingConfig.dispatchDescription,
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-full bg-[#004D38] text-white text-xs font-black">
            2
          </span>
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-950">
            Delivery Options
          </h2>
        </div>

        <span className="text-[11px] font-semibold text-slate-500">
          Step 2 of 5
        </span>
      </div>

      <div className="space-y-3">
        {options.map((option) => {
          const isSelected = selectedOptionId === option.id;
          const fee = calculateDeliveryFee(subtotal, option.id);
          const isStandard = option.id === "standard";
          const isFree = fee === 0;

          return (
            <div
              key={option.id}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onClick={() => onSelectOption(option.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectOption(option.id);
                }
              }}
              className={`group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#004D38] ${
                isSelected
                  ? "border-[#004D38] bg-emerald-50/30 ring-1 ring-[#004D38]"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {isSelected ? (
                    <CheckCircle2 className="size-5 text-[#004D38]" />
                  ) : (
                    <div className="size-5 rounded-full border-2 border-slate-300 group-hover:border-slate-400" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">
                      {option.name}
                    </span>

                    {option.badge && (
                      <span className="inline-block rounded-md bg-[#004D38]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#004D38]">
                        {option.badge}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <Clock className="size-3.5 text-slate-400 shrink-0" />
                    <span>Estimated: <strong className="text-slate-800 font-semibold">{option.estimatedDays}</strong></span>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed max-w-md">
                    {option.description}
                  </p>
                </div>
              </div>

              {/* Fee badge / Price tag */}
              <div className="sm:text-right shrink-0 pl-8 sm:pl-0">
                {isFree ? (
                  <div className="flex sm:flex-col items-baseline sm:items-end gap-1">
                    <span className="text-sm font-black text-[#004D38] uppercase">
                      FREE
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {shippingConfig.freeShippingLabel}
                    </span>
                  </div>
                ) : (
                  <div className="flex sm:flex-col items-baseline sm:items-end gap-1">
                    <span className="text-sm font-black text-slate-900">
                      {formatCurrency(fee)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Delivery Charge
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Logistics Notice */}
      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 flex items-start gap-2.5 text-xs text-slate-500">
        <ShieldCheck className="size-4 text-[#004D38] shrink-0 mt-0.5" />
        <p className="leading-relaxed text-[11px]">
          {shippingConfig.deliveryDisclaimer}
        </p>
      </div>

      {/* Continue CTA */}
      {onContinue && (
        <div className="pt-2 flex justify-end">
          <Button
            type="button"
            onClick={onContinue}
            className="rounded-full bg-[#004D38] hover:bg-[#003D2C] text-white text-xs font-bold px-6 py-2.5 shadow-sm active:scale-95 transition-all"
          >
            Continue to Offers & Payment
          </Button>
        </div>
      )}
    </div>
  );
}

CheckoutDeliveryOptions.propTypes = {
  selectedOptionId: PropTypes.string,
  onSelectOption: PropTypes.func.isRequired,
  subtotal: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onContinue: PropTypes.func,
};

export default CheckoutDeliveryOptions;
