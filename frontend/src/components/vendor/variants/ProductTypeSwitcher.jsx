"use client";

import React, { useState } from "react";
import {
  Layers,
  Package,
  AlertTriangle,
  ArrowRight,
  Check,
  FileText,
  Boxes,
  CheckCircle2,
  Sparkles,
  DownloadCloud,
} from "lucide-react";

/**
 * ProductTypeSwitcher
 * Handles choosing between Simple, Variable, and Virtual/Downloadable product types.
 * Enforces transition safety and displays blocking validation reasons when switching.
 */
export default function ProductTypeSwitcher({
  currentType = "simple",
  activeVariantsCount = 0,
  hasActiveReservations = false,
  onTypeChange,
  isUpdating = false,
  isVirtual = false,
  isDownloadable = false,
  onVirtualChange,
  onDownloadableChange,
  onOpenVariations,
}) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [targetType, setTargetType] = useState(null);

  const canSwitchToSimple = activeVariantsCount <= 1 && !hasActiveReservations;

  const handleSelectType = (newType) => {
    if (newType === "virtual") {
      // Configure virtual/downloadable
      if (onVirtualChange) onVirtualChange(true);
      if (onDownloadableChange) onDownloadableChange(true);
      return;
    }

    if (newType === currentType) return;

    if (newType === "simple" && !canSwitchToSimple) {
      // Open modal showing blocking error explanation
      setTargetType("simple");
      setShowConfirmModal(true);
      return;
    }

    setTargetType(newType);
    setShowConfirmModal(true);
  };

  const handleConfirm = () => {
    if (targetType === "simple" && !canSwitchToSimple) {
      setShowConfirmModal(false);
      return;
    }
    onTypeChange(targetType);
    setShowConfirmModal(false);
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Product Structure &amp; Type Selection
          </h4>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
              currentType === "variable"
                ? "bg-purple-50 text-purple-700 border border-purple-200"
                : isVirtual || isDownloadable
                ? "bg-blue-50 text-blue-700 border border-blue-200"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            }`}
          >
            {currentType === "variable"
              ? "Variable Product"
              : isVirtual || isDownloadable
              ? "Virtual / Digital"
              : "Simple Product"}
          </span>
        </div>
        <p className="text-xs text-slate-600 mt-1">
          Select the product structure that aligns with your merchandise and customer fulfillment model.
        </p>
      </div>

      {/* 3 Selectable Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* 1. Simple Product */}
        <div
          onClick={() => handleSelectType("simple")}
          className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
            currentType === "simple" && !isVirtual && !isDownloadable
              ? "border-emerald-600 bg-emerald-50/20 shadow-2xs"
              : "border-slate-200 hover:border-slate-300 bg-white"
          }`}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`size-7 rounded-xl flex items-center justify-center ${
                    currentType === "simple" && !isVirtual && !isDownloadable
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Package className="size-4" />
                </div>
                <span className="text-xs font-bold text-slate-900">Simple Product</span>
              </div>
              {currentType === "simple" && !isVirtual && !isDownloadable && (
                <CheckCircle2 className="size-4 text-emerald-600" />
              )}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Standalone physical product with a single canonical SKU, price, and inventory count.
            </p>
          </div>
          <span className="text-[10px] font-semibold text-slate-400">
            e.g. Standard Book, Cable, Mug
          </span>
        </div>

        {/* 2. Variable Product */}
        <div
          onClick={() => handleSelectType("variable")}
          className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
            currentType === "variable"
              ? "border-[#004D38] bg-emerald-50/40 shadow-xs ring-1 ring-[#004D38]/20"
              : "border-slate-200 hover:border-slate-300 bg-white"
          }`}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`size-7 rounded-xl flex items-center justify-center ${
                    currentType === "variable"
                      ? "bg-[#004D38] text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Layers className="size-4" />
                </div>
                <span className="text-xs font-bold text-slate-900">Variable Product</span>
              </div>
              {currentType === "variable" && (
                <CheckCircle2 className="size-4 text-[#004D38]" />
              )}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Multi-variant product with selectable attributes (Size, Color, Material) and individual SKUs.
            </p>
          </div>
          <span className="text-[10px] font-semibold text-[#004D38]">
            e.g. Apparel, Shoes, Electronics
          </span>
        </div>

        {/* 3. Virtual / Downloadable Product */}
        <div
          onClick={() => handleSelectType("virtual")}
          className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
            isVirtual || isDownloadable
              ? "border-blue-600 bg-blue-50/20 shadow-2xs"
              : "border-slate-200 hover:border-slate-300 bg-white"
          }`}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`size-7 rounded-xl flex items-center justify-center ${
                    isVirtual || isDownloadable
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <FileText className="size-4" />
                </div>
                <span className="text-xs font-bold text-slate-900">Virtual / Digital</span>
              </div>
              {(isVirtual || isDownloadable) && (
                <CheckCircle2 className="size-4 text-blue-600" />
              )}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Digital downloads, services, or licenses with no physical delivery requirement.
            </p>
          </div>
          <span className="text-[10px] font-semibold text-blue-600">
            e.g. PDF Guides, Software, Music
          </span>
        </div>
      </div>

      {/* Prominent Variable Product Notice & Direct Variations Link */}
      {currentType === "variable" && (
        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-[#004D38] text-white flex items-center justify-center shrink-0">
              <Boxes className="size-4" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-slate-900">
                Variations Matrix Enabled
              </h5>
              <p className="text-[11px] text-slate-600">
                Define product attributes (Size, Color, Material, Storage) and generate purchasable variant combinations.
              </p>
            </div>
          </div>

          {onOpenVariations && (
            <button
              type="button"
              onClick={onOpenVariations}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-bold shadow-xs shrink-0 transition-colors"
            >
              <span>Configure Variants &amp; Attributes</span>
              <ArrowRight className="size-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Additional Digital / Physical Characteristics Toggles */}
      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-6 text-xs">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(isVirtual)}
            onChange={(e) => onVirtualChange && onVirtualChange(e.target.checked)}
            className="size-4 rounded text-emerald-600 focus:ring-emerald-600 border-slate-300"
          />
          <span className="font-semibold text-slate-700">Virtual (No physical shipping required)</span>
        </label>

        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(isDownloadable)}
            onChange={(e) => onDownloadableChange && onDownloadableChange(e.target.checked)}
            className="size-4 rounded text-emerald-600 focus:ring-emerald-600 border-slate-300"
          />
          <span className="font-semibold text-slate-700">Downloadable (Digital assets attached)</span>
        </label>
      </div>

      {/* Confirmation / Blocking Dialog */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`size-10 rounded-2xl flex items-center justify-center ${
                  targetType === "simple" && !canSwitchToSimple
                    ? "bg-rose-50 text-rose-600"
                    : "bg-amber-50 text-amber-600"
                }`}
              >
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {targetType === "simple" && !canSwitchToSimple
                    ? "Product Type Transition Blocked"
                    : `Convert to ${targetType === "variable" ? "Variable" : "Simple"} Product?`}
                </h3>
                <p className="text-xs text-slate-500">
                  {targetType === "simple"
                    ? "Transition from Variable to Simple product"
                    : "Transition from Simple to Variable product"}
                </p>
              </div>
            </div>

            {targetType === "simple" && !canSwitchToSimple ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-2">
                  <p className="font-semibold">
                    Cannot transition to a Simple Product due to existing dependencies:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px]">
                    {activeVariantsCount > 1 && (
                      <li>
                        Product currently has <strong>{activeVariantsCount} active variants</strong>.
                        A simple product can only have at most one canonical variant. Deactivate or delete extra variants first.
                      </li>
                    )}
                    {hasActiveReservations && (
                      <li>
                        Variants have <strong>active order reservations</strong>. Converting to simple would orphan reserved customer stock.
                      </li>
                    )}
                  </ul>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                  >
                    Understood
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-600">
                  {targetType === "variable"
                    ? "Converting to a Variable Product will enable the Variation Matrix. You will be able to define custom attributes (Size, Color, etc.) and generate sellable SKU combinations."
                    : "Converting back to a Simple Product will retain your canonical default variant and disable the variation matrix."}
                </p>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isUpdating}
                    className="px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-xs"
                  >
                    Confirm Transition
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
