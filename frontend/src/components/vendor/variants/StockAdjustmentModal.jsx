"use client";

import React, { useState } from "react";
import {
  X,
  Warehouse,
  Plus,
  Minus,
  AlertCircle,
  CheckCircle2,
  Boxes,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";
import { formatAttributesString } from "@/utils/attribute.util";

export default function StockAdjustmentModal({
  isOpen,
  onClose,
  variant,
  onSuccess,
}) {
  const [adjustmentType, setAdjustmentType] = useState("add"); // "add" | "subtract" | "set"
  const [quantity, setQuantity] = useState("5");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !variant) return null;

  // Find active inventory record for this variant
  const inventories = variant.inventories || [];
  const primaryInventory = inventories[0] || null;

  const onHand = primaryInventory?.onHand ?? variant.onHand ?? variant.stockQuantity ?? 0;
  const reserved = primaryInventory?.reserved ?? variant.reserved ?? 0;
  const available = primaryInventory?.availableQuantity ?? Math.max(0, onHand - reserved);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qtyVal = parseInt(quantity, 10);
    if (isNaN(qtyVal) || qtyVal <= 0) {
      toast.error("Please provide a valid positive quantity number");
      return;
    }

    let delta = 0;
    if (adjustmentType === "add") {
      delta = qtyVal;
    } else if (adjustmentType === "subtract") {
      delta = -qtyVal;
      if (onHand + delta < reserved) {
        toast.error(
          `Cannot reduce physical stock below currently reserved stock (${reserved} units reserved by customer orders).`
        );
        return;
      }
    } else if (adjustmentType === "set") {
      delta = qtyVal - onHand;
      if (qtyVal < reserved) {
        toast.error(
          `Cannot set physical stock below currently reserved stock (${reserved} units).`
        );
        return;
      }
    }

    if (delta === 0) {
      toast.info("Stock quantity is unchanged");
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      if (primaryInventory?._id) {
        // Authoritative adjustment via inventoryService
        await vendorService.adjustInventory(primaryInventory._id, {
          quantity: delta,
          notes: notes.trim() || `Manual adjustment via vendor console (${adjustmentType})`,
        });
      } else {
        // Fallback for variants without prior inventory record: update variant stockQuantity mirror
        const newStock = Math.max(0, onHand + delta);
        await vendorService.updateProductVariant(variant._id, {
          stockQuantity: newStock,
        });
      }

      toast.success("Authoritative warehouse stock adjusted successfully");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error("Failed to adjust warehouse stock", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Warehouse className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Authoritative Stock Adjustment
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                SKU: {variant.sku}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Current Authoritative Breakdown */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-center">
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-500">
              On Hand
            </span>
            <span className="text-base font-black text-slate-900 font-mono">
              {onHand}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-amber-600">
              Reserved
            </span>
            <span className="text-base font-black text-amber-700 font-mono">
              {reserved}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-emerald-600">
              Available
            </span>
            <span className="text-base font-black text-emerald-700 font-mono">
              {available}
            </span>
          </div>
        </div>

        {/* Adjustment Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
              Adjustment Operation
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setAdjustmentType("add")}
                className={`py-1.5 rounded-lg font-bold transition-all ${
                  adjustmentType === "add"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                + Receive
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentType("subtract")}
                className={`py-1.5 rounded-lg font-bold transition-all ${
                  adjustmentType === "subtract"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                - Reduce
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentType("set")}
                className={`py-1.5 rounded-lg font-bold transition-all ${
                  adjustmentType === "set"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Set Total
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              {adjustmentType === "set"
                ? "New Total On-Hand Physical Stock"
                : "Quantity to Adjust"}
            </label>
            <input
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Audit Notes / Reason (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Received new shipment batch, damaged in transit"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-bold shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? "Adjusting..." : "Record Adjustment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
