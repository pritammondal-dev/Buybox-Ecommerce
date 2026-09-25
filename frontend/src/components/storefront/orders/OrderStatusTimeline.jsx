"use client";

import React from "react";
import PropTypes from "prop-types";
import {
  CheckCircle2,
  Clock,
  Package,
  Truck,
  Home,
  XCircle,
  AlertCircle,
} from "lucide-react";
import {
  ORDER_TIMELINE_STAGES,
  getTimelineStepIndex,
} from "../../../constants/order.constants.js";

const ICONS = {
  pending: Clock,
  confirmed: CheckCircle2,
  processing: Package,
  shipped: Truck,
  delivered: Home,
};

export function OrderStatusTimeline({ status, cancellationReason = null }) {
  const normalized = String(status || "pending").toLowerCase();
  const isCancelled = normalized === "cancelled";
  const currentStepIndex = getTimelineStepIndex(normalized);

  if (isCancelled) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <XCircle className="size-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-rose-900">Order Cancelled</h3>
              <span className="rounded-full bg-rose-200/80 px-2.5 py-0.5 text-[10px] font-black uppercase text-rose-800">
                Voided
              </span>
            </div>
            <p className="text-xs text-rose-700 leading-relaxed">
              This order has been cancelled. Reserved inventory was released back to the warehouse.
              {cancellationReason && ` Reason: "${cancellationReason}".`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
          Fulfillment Timeline
        </h3>
        <span className="text-xs font-semibold text-slate-500">
          Stage {Math.max(1, currentStepIndex + 1)} of {ORDER_TIMELINE_STAGES.length}
        </span>
      </div>

      {/* Progress Track */}
      <div className="relative">
        {/* Desktop / Tablet Horizontal Timeline */}
        <div className="hidden sm:grid grid-cols-5 gap-2 relative">
          {/* Connector Line Background */}
          <div className="absolute top-5 left-[10%] right-[10%] h-1 bg-slate-100 -z-0" />
          {/* Active Connector Progress */}
          {currentStepIndex > 0 && (
            <div
              className="absolute top-5 left-[10%] h-1 bg-[#004D38] -z-0 transition-all duration-500"
              style={{
                width: `${(Math.min(currentStepIndex, 4) / 4) * 80}%`,
              }}
            />
          )}

          {ORDER_TIMELINE_STAGES.map((stage, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            const isUpcoming = idx > currentStepIndex;
            const Icon = ICONS[stage.key] || Package;

            return (
              <div key={stage.key} className="flex flex-col items-center text-center z-10">
                <div
                  className={`flex size-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                    isCompleted
                      ? "border-[#004D38] bg-[#004D38] text-white shadow-xs"
                      : isCurrent
                      ? "border-[#004D38] bg-emerald-50 text-[#004D38] ring-4 ring-emerald-100"
                      : "border-slate-200 bg-white text-slate-400"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="size-5 stroke-[2.5]" />
                  ) : (
                    <Icon className="size-5" />
                  )}
                </div>

                <p
                  className={`mt-2.5 text-xs font-bold ${
                    isCurrent
                      ? "text-[#004D38]"
                      : isCompleted
                      ? "text-slate-900"
                      : "text-slate-400"
                  }`}
                >
                  {stage.label}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-2 px-1">
                  {stage.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Mobile Vertical Timeline */}
        <div className="sm:hidden space-y-4 relative pl-4 border-l-2 border-slate-200 ml-3">
          {ORDER_TIMELINE_STAGES.map((stage, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            const Icon = ICONS[stage.key] || Package;

            return (
              <div key={stage.key} className="relative pl-6">
                {/* Node Icon on Border */}
                <div
                  className={`absolute -left-[27px] top-0 flex size-8 items-center justify-center rounded-full border-2 ${
                    isCompleted
                      ? "border-[#004D38] bg-[#004D38] text-white"
                      : isCurrent
                      ? "border-[#004D38] bg-emerald-50 text-[#004D38] ring-4 ring-emerald-100"
                      : "border-slate-300 bg-white text-slate-400"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="size-4 stroke-[2.5]" />
                  ) : (
                    <Icon className="size-4" />
                  )}
                </div>

                <div className="pt-0.5">
                  <p
                    className={`text-xs font-bold ${
                      isCurrent
                        ? "text-[#004D38]"
                        : isCompleted
                        ? "text-slate-900"
                        : "text-slate-400"
                    }`}
                  >
                    {stage.label}
                    {isCurrent && (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-[#004D38]">
                        Current
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {stage.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

OrderStatusTimeline.propTypes = {
  status: PropTypes.string,
  cancellationReason: PropTypes.string,
};

export default OrderStatusTimeline;
