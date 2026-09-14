"use client";

import React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "../../ui/Button.jsx";

export function ClearCartModal({
  isOpen,
  onClose,
  onConfirm,
  isClearing = false,
}) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="clear-cart-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 border border-red-100">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <h3 id="clear-cart-modal-title" className="text-base font-bold text-slate-950">
              Clear Shopping Cart?
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              This will remove all items currently in your cart.
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Are you sure you want to remove all items? This action cannot be undone.
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={isClearing}
            onClick={onClose}
            className="rounded-full text-xs font-semibold px-4 py-2"
          >
            Cancel
          </Button>

          <Button
            type="button"
            disabled={isClearing}
            onClick={onConfirm}
            className="rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-5 py-2 shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isClearing && <Loader2 className="size-3.5 animate-spin" />}
            <span>Clear All Items</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ClearCartModal;
