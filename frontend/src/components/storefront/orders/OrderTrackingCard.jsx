"use client";

import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Truck,
  ExternalLink,
  Copy,
  Check,
  Calendar,
  AlertCircle,
  Package,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { getOrderDeliveryEstimate } from "../../../constants/order.constants.js";
import { STOREFRONT_BUSINESS_POLICIES } from "../../../config/business-policies.config.js";

export function OrderTrackingCard({ order, shipment }) {
  const [copied, setCopied] = useState(false);

  // Compute authoritative delivery estimate following strict 3-tier hierarchy
  const estimate = getOrderDeliveryEstimate({
    order,
    shipment,
    policy: STOREFRONT_BUSINESS_POLICIES,
  });

  const handleCopyTrackingNumber = () => {
    if (!shipment?.trackingNumber) return;
    navigator.clipboard.writeText(shipment.trackingNumber);
    setCopied(true);
    toast.success("Tracking number copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const hasShipment = Boolean(shipment && shipment.trackingNumber);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
          <Truck className="size-4 text-slate-400" />
          Shipment & Logistics
        </h3>
        {hasShipment ? (
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-black uppercase text-indigo-700">
            {shipment.status?.replace(/_/g, " ") || "In Transit"}
          </span>
        ) : (
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-black uppercase text-amber-800">
            Fulfillment in progress
          </span>
        )}
      </div>

      {/* Delivery Estimate Box - Sourced from strict priority */}
      <div
        className={`rounded-xl p-3.5 border ${
          estimate.isGenericPolicy
            ? "bg-slate-50/80 border-slate-200/80 text-slate-700"
            : "bg-emerald-50/80 border-emerald-200/80 text-[#004D38]"
        }`}
      >
        <div className="flex items-start gap-2.5">
          <Calendar className="size-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="text-[10px] font-black uppercase tracking-wider block opacity-75">
              {estimate.label}
            </span>
            <p className="text-xs sm:text-sm font-bold leading-snug">
              {estimate.formatted}
            </p>
            {estimate.isGenericPolicy && (
              <p className="text-[10px] text-slate-500 pt-0.5">
                Note: This is a general storefront policy guideline. Your verified delivery date will be issued once the logistics partner accepts the package.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Real Shipment Details or Truthful Fulfillment Status */}
      {hasShipment ? (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {shipment.carrier && (
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Logistics Carrier
                </span>
                <span className="font-bold text-slate-900 mt-0.5 block">
                  {shipment.carrier}
                  {shipment.serviceLevel ? ` (${shipment.serviceLevel})` : ""}
                </span>
              </div>
            )}

            <div className="rounded-xl bg-slate-50 p-3">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Tracking Number / AWB
              </span>
              <div className="flex items-center justify-between mt-0.5">
                <span className="font-mono font-bold text-slate-900">
                  {shipment.trackingNumber}
                </span>
                <button
                  type="button"
                  onClick={handleCopyTrackingNumber}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#004D38] hover:underline cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="size-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {shipment.trackingUrl && (
            <div className="pt-2">
              <a
                href={shipment.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full rounded-xl border border-slate-200 bg-white hover:bg-slate-50 py-2.5 px-4 text-xs font-bold text-slate-800 transition-colors shadow-2xs"
              >
                Track on Carrier Website
                <ExternalLink className="size-3.5 text-slate-500" />
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Package className="size-4 text-[#004D38]" />
            <span>Fulfillment Center Processing</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Your items are being inspected, packed, and prepared for carrier handover. As soon as the shipment is assigned an Air Waybill (AWB) number, live tracking milestones will activate here.
          </p>
        </div>
      )}
    </div>
  );
}

OrderTrackingCard.propTypes = {
  order: PropTypes.object,
  shipment: PropTypes.object,
};

export default OrderTrackingCard;
