"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  Check,
  AlertTriangle,
  Warehouse,
  Tag,
  DollarSign,
  Boxes,
  Trash2,
} from "lucide-react";
import {
  formatAttributesString,
  suggestVariantSku,
  getCombinationFingerprint,
} from "@/utils/attribute.util";
import { toast } from "sonner";

export default function CombinationReviewModal({
  isOpen,
  onClose,
  combinations = [],
  parentProduct = {},
  warehouses = [],
  onSubmit,
  isSubmitting = false,
  existingVariants = [],
}) {
  const parentSku = parentProduct?.sku || "SKU";
  const defaultPrice = parentProduct?.price?.toString() || "0.00";
  const defaultComparePrice = parentProduct?.compareAtPrice?.toString() || "";

  const [rows, setRows] = useState([]);
  const [batchPrice, setBatchPrice] = useState(defaultPrice);
  const [batchComparePrice, setBatchComparePrice] = useState(defaultComparePrice);
  const [batchStock, setBatchStock] = useState("10");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");

  // Sync / initialize rows whenever modal opens or combinations update
  useEffect(() => {
    if (!isOpen) return;

    setBatchPrice(defaultPrice);
    setBatchComparePrice(defaultComparePrice);
    if (!selectedWarehouseId && warehouses.length > 0) {
      setSelectedWarehouseId(warehouses[0]._id);
    }

    // Build fingerprint map of existing variants to preserve user edits upon regeneration
    const existingMap = new Map();
    for (const v of existingVariants || []) {
      if (v.attributes) {
        const fp = getCombinationFingerprint(v.attributes);
        existingMap.set(fp, v);
      }
    }

    const usedSkus = new Set();
    const newRows = combinations.map((combo, idx) => {
      const fp = getCombinationFingerprint(combo);
      const existing = existingMap.get(fp);

      let initialSku = "";
      if (existing && existing.sku) {
        initialSku = existing.sku;
      } else {
        const baseSuggested = suggestVariantSku(parentSku, combo);
        initialSku = baseSuggested;
        let suffix = 1;
        while (usedSkus.has(initialSku)) {
          initialSku = `${baseSuggested}-${suffix}`;
          suffix++;
        }
      }
      usedSkus.add(initialSku);

      return {
        id: existing?._id || `row-${idx}`,
        selected: true,
        attributes: combo,
        sku: initialSku,
        price: existing?.price != null ? String(existing.price) : defaultPrice,
        compareAtPrice:
          existing?.compareAtPrice != null
            ? String(existing.compareAtPrice)
            : defaultComparePrice,
        initialStock:
          existing?.stockQuantity != null
            ? String(existing.stockQuantity)
            : existing?.availableQuantity != null
            ? String(existing.availableQuantity)
            : "10",
        image: existing?.image || null,
      };
    });

    setRows(newRows);
  }, [isOpen, combinations, parentSku, defaultPrice, defaultComparePrice, existingVariants, warehouses]);

  if (!isOpen) return null;

  // Apply batch price to all active rows
  const handleApplyBatchPrice = () => {
    if (!batchPrice) return;
    setRows((prev) =>
      prev.map((r) => (r.selected ? { ...r, price: batchPrice } : r))
    );
  };

  const handleApplyBatchComparePrice = () => {
    setRows((prev) =>
      prev.map((r) => (r.selected ? { ...r, compareAtPrice: batchComparePrice } : r))
    );
  };

  const handleApplyBatchStock = () => {
    setRows((prev) =>
      prev.map((r) => (r.selected ? { ...r, initialStock: batchStock } : r))
    );
  };

  const handleToggleRow = (idx) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r))
    );
  };

  const handleRemoveRow = (idx) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleRowChange = (idx, field, value) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    );
  };

  const selectedCount = rows.filter((r) => r.selected).length;

  const handleSubmit = (e) => {
    e.preventDefault();
    const activeRows = rows.filter((r) => r.selected);
    if (activeRows.length === 0) {
      toast.error("Please select at least one variation combination");
      return;
    }

    // Check for empty or duplicate SKUs
    const skuSet = new Set();
    for (const r of activeRows) {
      const cleanSku = (r.sku || "").trim().toUpperCase();
      if (!cleanSku) {
        toast.error("All selected variants must have a non-empty SKU");
        return;
      }
      if (skuSet.has(cleanSku)) {
        toast.error(`Duplicate SKU detected: "${cleanSku}". Each variant must have a unique SKU.`);
        return;
      }
      skuSet.add(cleanSku);

      const priceNum = parseFloat(r.price);
      if (isNaN(priceNum) || priceNum < 0) {
        toast.error(`Variant ${cleanSku} has an invalid price`);
        return;
      }
    }

    const payload = activeRows.map((r) => ({
      sku: r.sku.trim().toUpperCase(),
      attributes: r.attributes,
      price: Number(r.price),
      compareAtPrice: r.compareAtPrice ? Number(r.compareAtPrice) : null,
      stockQuantity: Number(r.initialStock) || 0,
      warehouseId: selectedWarehouseId || null,
      image: r.image || null,
      isActive: true,
    }));

    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-emerald-700" />
              <h3 className="text-base font-bold text-slate-900">
                Review &amp; Configure Variant Combinations
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Review generated SKUs, apply batch pricing/stock, and exclude any variations before provisioning.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Batch Defaults Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs shrink-0">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Batch Selling Price (₹)
            </label>
            <div className="flex gap-1">
              <input
                type="number"
                step="0.01"
                min="0"
                value={batchPrice}
                onChange={(e) => setBatchPrice(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-bold"
              />
              <button
                type="button"
                onClick={handleApplyBatchPrice}
                className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 font-bold shrink-0"
              >
                Apply
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Batch MRP / Compare (₹)
            </label>
            <div className="flex gap-1">
              <input
                type="number"
                step="0.01"
                min="0"
                value={batchComparePrice}
                onChange={(e) => setBatchComparePrice(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white"
              />
              <button
                type="button"
                onClick={handleApplyBatchComparePrice}
                className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 font-bold shrink-0"
              >
                Apply
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Default Initial Stock
            </label>
            <div className="flex gap-1">
              <input
                type="number"
                min="0"
                value={batchStock}
                onChange={(e) => setBatchStock(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-bold"
              />
              <button
                type="button"
                onClick={handleApplyBatchStock}
                className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 font-bold shrink-0"
              >
                Apply
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Fulfillment Warehouse
            </label>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-medium"
            >
              {warehouses.length === 0 ? (
                <option value="">No active warehouse</option>
              ) : (
                warehouses.map((wh) => (
                  <option key={wh._id} value={wh._id}>
                    {wh.name || wh.code}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Combinations Table */}
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5 w-10 text-center">Include</th>
                <th className="px-3 py-2.5">Attribute Combination</th>
                <th className="px-3 py-2.5">Variant SKU</th>
                <th className="px-3 py-2.5">Selling Price (₹)</th>
                <th className="px-3 py-2.5">MRP Price (₹)</th>
                <th className="px-3 py-2.5">Initial Stock</th>
                <th className="px-3 py-2.5 text-right">Exclude</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  className={`transition-colors ${
                    row.selected ? "hover:bg-slate-50/60" : "bg-slate-50 opacity-40"
                  }`}
                >
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={() => handleToggleRow(idx)}
                      className="size-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-800">
                    <span className="bg-white px-2 py-0.5 rounded-lg border border-slate-200 font-semibold shadow-2xs">
                      {formatAttributesString(row.attributes)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.sku}
                      onChange={(e) => handleRowChange(idx, "sku", e.target.value)}
                      disabled={!row.selected}
                      className="w-36 px-2 py-1 rounded-lg border border-slate-200 font-mono text-[11px] uppercase bg-white"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.price}
                      onChange={(e) => handleRowChange(idx, "price", e.target.value)}
                      disabled={!row.selected}
                      className="w-24 px-2 py-1 rounded-lg border border-slate-200 font-bold bg-white"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Optional"
                      value={row.compareAtPrice}
                      onChange={(e) => handleRowChange(idx, "compareAtPrice", e.target.value)}
                      disabled={!row.selected}
                      className="w-24 px-2 py-1 rounded-lg border border-slate-200 bg-white"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      value={row.initialStock}
                      onChange={(e) =>
                        handleRowChange(idx, "initialStock", e.target.value)
                      }
                      disabled={!row.selected}
                      className="w-20 px-2 py-1 rounded-lg border border-slate-200 font-bold bg-white"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(idx)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Exclude combination"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between shrink-0 bg-slate-50">
          <div className="text-xs text-slate-600">
            <strong>{selectedCount}</strong> of {rows.length} combinations selected.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={selectedCount === 0 || isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-bold shadow-xs disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Creating Variants..." : `Commit ${selectedCount} Variants`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
