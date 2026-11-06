"use client";

import React, { useState } from "react";
import { X, Plus, Package, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";
import { productService } from "@/services/product.service";
import { suggestVariantSku } from "@/utils/attribute.util";

export default function AddVariantModal({
  isOpen,
  onClose,
  productId,
  parentSku = "SKU",
  attributes = [],
  warehouses = [],
  onSuccess,
  portal = "vendor",
  onAddStagedVariant,
}) {
  const [attrValues, setAttrValues] = useState(() => {
    const init = {};
    for (const a of attributes) {
      init[a.name] = a.values?.[0] || "";
    }
    return init;
  });

  const [sku, setSku] = useState(() => suggestVariantSku(parentSku, attrValues));
  const [price, setPrice] = useState("100.00");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("10");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?._id || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      const init = {};
      for (const a of attributes) {
        init[a.name] = a.values?.[0] || "";
      }
      setAttrValues(init);
      setSku(suggestVariantSku(parentSku, init));
      if (!warehouseId && warehouses.length > 0) {
        setWarehouseId(warehouses[0]._id);
      }
    }
  }, [isOpen, attributes, parentSku, warehouses]);

  if (!isOpen) return null;

  const handleAttrChange = (name, val) => {
    const updated = { ...attrValues, [name]: val };
    setAttrValues(updated);
    setSku(suggestVariantSku(parentSku, updated));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanSku = sku.trim().toUpperCase();
    if (!cleanSku) {
      toast.error("Variant SKU is required");
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Valid positive selling price is required");
      return;
    }

    const payload = {
      sku: cleanSku,
      attributes: attrValues,
      price: priceNum,
      compareAtPrice: compareAtPrice ? parseFloat(compareAtPrice) : null,
      stockQuantity: parseInt(stockQuantity, 10) || 0,
      warehouseId: warehouseId || null,
      isActive: true,
    };

    // In-memory staged variant (create mode before product persistence)
    if (!productId || onAddStagedVariant) {
      if (onAddStagedVariant) {
        onAddStagedVariant(payload);
        toast.success(`Variant ${cleanSku} added`);
        if (onSuccess) onSuccess();
        onClose();
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (portal === "admin") {
        await productService.createVariant(productId, payload);
      } else {
        await vendorService.createProductVariant(productId, payload);
      }
      toast.success("Variant created successfully");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error("Failed to create variant", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Plus className="size-4 text-emerald-700" />
            <h3 className="text-sm font-bold text-slate-900">
              Add Single Variation
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Attributes Selectors */}
          {attributes.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="block text-[11px] font-bold text-slate-700 uppercase">
                Variation Attributes
              </span>
              <div className="grid grid-cols-2 gap-2">
                {attributes.map((attr) => (
                  <div key={attr.name}>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      {attr.name}
                    </label>
                    <select
                      value={attrValues[attr.name] || ""}
                      onChange={(e) => handleAttrChange(attr.name, e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-medium"
                    >
                      {attr.values?.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pricing & SKU */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Variant SKU <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                placeholder="e.g. SHIRT-BLK-S"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 uppercase font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Selling Price (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                MRP / Compare Price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={compareAtPrice}
                onChange={(e) => setCompareAtPrice(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Initial Stock
              </label>
              <input
                type="number"
                min="0"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Fulfillment Warehouse
            </label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white"
            >
              {warehouses.length === 0 ? (
                <option value="">No warehouse configured</option>
              ) : (
                warehouses.map((wh) => (
                  <option key={wh._id} value={wh._id}>
                    {wh.name || wh.code}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white font-bold shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? "Adding..." : "Add Variation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
