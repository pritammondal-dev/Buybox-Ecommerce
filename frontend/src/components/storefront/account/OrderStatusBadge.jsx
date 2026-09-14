"use client";

import React from "react";
import PropTypes from "prop-types";
import {
  Clock,
  CheckCircle2,
  Package,
  Truck,
  XCircle,
  AlertCircle,
  CreditCard,
  RefreshCw,
} from "lucide-react";

/**
 * Reusable badge for authoritative backend order and payment statuses.
 */
export function OrderStatusBadge({ status, type = "order", size = "sm" }) {
  const normalized = (status || "pending").toLowerCase();

  const isSmall = size === "sm";
  const sizeClasses = isSmall
    ? "text-[11px] px-2.5 py-0.5"
    : "text-xs px-3 py-1";
  const iconSize = isSmall ? "size-3.5" : "size-4";

  if (type === "payment") {
    switch (normalized) {
      case "paid":
        return (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full font-extrabold bg-emerald-50 text-[#007A55] border border-emerald-200/80 ${sizeClasses}`}
          >
            <CheckCircle2 className={iconSize} />
            <span>Paid</span>
          </span>
        );
      case "authorized":
        return (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full font-extrabold bg-blue-50 text-blue-700 border border-blue-200/80 ${sizeClasses}`}
          >
            <CreditCard className={iconSize} />
            <span>Authorized</span>
          </span>
        );
      case "failed":
        return (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full font-extrabold bg-red-50 text-red-700 border border-red-200/80 ${sizeClasses}`}
          >
            <AlertCircle className={iconSize} />
            <span>Failed</span>
          </span>
        );
      case "refunded":
        return (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full font-extrabold bg-purple-50 text-purple-700 border border-purple-200/80 ${sizeClasses}`}
          >
            <RefreshCw className={iconSize} />
            <span>Refunded</span>
          </span>
        );
      case "partially_refunded":
        return (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full font-extrabold bg-purple-50 text-purple-700 border border-purple-200/80 ${sizeClasses}`}
          >
            <RefreshCw className={iconSize} />
            <span>Partially Refunded</span>
          </span>
        );
      case "pending":
      default:
        return (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full font-extrabold bg-amber-50 text-amber-800 border border-amber-200/80 ${sizeClasses}`}
          >
            <Clock className={iconSize} />
            <span>Pending</span>
          </span>
        );
    }
  }

  // Order status
  switch (normalized) {
    case "confirmed":
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-extrabold bg-sky-50 text-sky-700 border border-sky-200/80 ${sizeClasses}`}
        >
          <CheckCircle2 className={iconSize} />
          <span>Confirmed</span>
        </span>
      );
    case "processing":
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-extrabold bg-blue-50 text-blue-700 border border-blue-200/80 ${sizeClasses}`}
        >
          <Package className={iconSize} />
          <span>Processing</span>
        </span>
      );
    case "shipped":
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200/80 ${sizeClasses}`}
        >
          <Truck className={iconSize} />
          <span>Shipped</span>
        </span>
      );
    case "delivered":
    case "completed":
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-extrabold bg-emerald-50 text-[#007A55] border border-emerald-200/80 ${sizeClasses}`}
        >
          <CheckCircle2 className={iconSize} />
          <span>{normalized === "completed" ? "Completed" : "Delivered"}</span>
        </span>
      );
    case "cancelled":
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-extrabold bg-rose-50 text-rose-700 border border-rose-200/80 ${sizeClasses}`}
        >
          <XCircle className={iconSize} />
          <span>Cancelled</span>
        </span>
      );
    case "pending":
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-extrabold bg-amber-50 text-amber-800 border border-amber-200/80 ${sizeClasses}`}
        >
          <Clock className={iconSize} />
          <span>Pending</span>
        </span>
      );
  }
}

OrderStatusBadge.propTypes = {
  status: PropTypes.string,
  type: PropTypes.oneOf(["order", "payment"]),
  size: PropTypes.oneOf(["sm", "md"]),
};

export default OrderStatusBadge;
