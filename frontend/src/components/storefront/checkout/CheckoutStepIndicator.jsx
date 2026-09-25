"use client";

import React from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import { Check, MapPin, ClipboardList, CreditCard } from "lucide-react";
import { MARKETPLACE_CHECKOUT_STEPS } from "../../../constants/checkout.constants.js";

const STEP_ICONS = {
  address: MapPin,
  summary: ClipboardList,
  payment: CreditCard,
};

export function CheckoutStepIndicator({
  currentStep = 1,
  completedSteps = [],
  onStepClick,
  steps = MARKETPLACE_CHECKOUT_STEPS,
}) {
  return (
    <nav
      aria-label="Checkout Progress"
      className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs"
    >
      <ol className="flex items-center justify-between gap-1 sm:gap-4 max-w-2xl mx-auto">
        {steps.map((step, idx) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = currentStep === step.id;
          const isClickable = isCompleted || isCurrent || (onStepClick !== undefined);
          const StepIcon = STEP_ICONS[step.key] || CreditCard;

          const content = (
            <div
              onClick={() => {
                if (isClickable && onStepClick) onStepClick(step.id);
              }}
              className={`flex items-center gap-2.5 transition-all ${
                isClickable ? "cursor-pointer group" : "cursor-default"
              }`}
            >
              {/* Step Circle / Badge */}
              <div
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-black transition-all ${
                  isCompleted
                    ? "bg-[#004D38] text-white shadow-xs group-hover:bg-[#003D2C]"
                    : isCurrent
                    ? "bg-[#004D38] text-white ring-4 ring-[#004D38]/20 shadow-xs"
                    : "bg-slate-100 text-slate-400 border border-slate-200"
                }`}
              >
                {isCompleted ? (
                  <Check className="size-4 stroke-[3]" />
                ) : (
                  <span>{step.id}</span>
                )}
              </div>

              {/* Step Label */}
              <div className="flex flex-col min-w-0 text-left">
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-wider ${
                    isCurrent
                      ? "text-[#004D38]"
                      : isCompleted
                      ? "text-slate-600 group-hover:text-[#004D38]"
                      : "text-slate-400"
                  }`}
                >
                  Step {step.id}
                </span>
                <span
                  className={`text-xs font-bold truncate ${
                    isCurrent
                      ? "text-slate-950 font-black"
                      : isCompleted
                      ? "text-slate-800"
                      : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </div>
          );

          return (
            <li
              key={step.id}
              className="flex-1 flex items-center min-w-0"
              aria-current={isCurrent ? "step" : undefined}
            >
              {isCompleted && step.path && !onStepClick ? (
                <Link href={step.path} className="flex items-center min-w-0">
                  {content}
                </Link>
              ) : (
                content
              )}

              {/* Connector line between steps */}
              {idx < steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`h-0.5 flex-1 shrink mx-2 sm:mx-4 transition-colors ${
                    completedSteps.includes(step.id) &&
                    (completedSteps.includes(steps[idx + 1].id) ||
                      currentStep === steps[idx + 1].id)
                      ? "bg-[#004D38]"
                      : "bg-slate-200"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Mobile Current Step Subtitle */}
      <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 sm:hidden text-xs">
        <span className="font-extrabold text-[#004D38] uppercase tracking-wider">
          Step {currentStep} of {steps.length}
        </span>
        <span className="font-black text-slate-900">
          {steps.find((s) => s.id === currentStep)?.label}
        </span>
      </div>
    </nav>
  );
}

CheckoutStepIndicator.propTypes = {
  currentStep: PropTypes.number,
  completedSteps: PropTypes.arrayOf(PropTypes.number),
  onStepClick: PropTypes.func,
  steps: PropTypes.array,
};

export default CheckoutStepIndicator;
