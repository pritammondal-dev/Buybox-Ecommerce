"use client";

import React, { useState } from "react";
import {
  X,
  Save,
  Tag,
  DollarSign,
  Package,
  Scale,
  Ruler,
  Truck,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";
import { productService } from "@/services/product.service";
import { formatAttributesString } from "@/utils/attribute.util";

export default function VariantEditModal({
  isOpen,
  onClose,
  variant,
  onSuccess,
  onOpenStockAdjustment,
  portal = "vendor",
  onUpdateStagedVariant,
}) {
  const [form, setForm] = useState({
    sku: variant?.sku || "",
    name: variant?.name || "",
    price: variant?.price?.toString() || "0",
    compareAtPrice: variant?.compareAtPrice?.toString() || "",
    isActive: variant?.isActive !== false,
    imageUrl: variant?.image?.url || "",
    imageAlt: variant?.image?.altText || "",
    weightValue: variant?.weight?.value?.toString() || "",
    weightUnit: variant?.weight?.unit || "g",
    length: variant?.dimensions?.length?.toString() || "",
    width: variant?.dimensions?.width?.toString() || "",
    height: variant?.dimensions?.height?.toString() || "",
    dimensionUnit: variant?.dimensions?.unit || "cm",
    shippingClass: variant?.shippingClass || "",
  });

  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (variant) {
      setForm({
        sku: variant.sku || "",
        name: variant.name || "",
        price: variant.price?.toString() || "0",
        compareAtPrice: variant.compareAtPrice?.toString() || "",
        isActive: variant.isActive !== false,
        imageUrl: variant.image?.url || "",
        imageAlt: variant.image?.altText || "",
        weightValue: variant.weight?.value?.toString() || "",
        weightUnit: variant.weight?.unit || "g",
        length: variant.dimensions?.length?.toString() || "",
        width: variant.dimensions?.width?.toString() || "",
        height: variant.dimensions?.height?.toString() || "",
        dimensionUnit: variant.dimensions?.unit || "cm",
        shippingClass: variant.shippingClass || "",
      });
    }
  }, [variant]);

  if (!isOpen || !variant) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.sku.trim()) {
      toast.error("Variant SKU is required");
      return;
    }

    const priceNum = parseFloat(form.price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Valid positive price is required");
      return;
    }

    setIsSaving(true);
    const payload = {
        sku: form.sku.trim().toUpperCase(),
        name: form.name.trim() || undefined,
        price: priceNum,
        compareAtPrice: form.compareAtPrice ? parseFloat(form.compareAtPrice) : null,
        isActive: form.isActive,
        image: form.imageUrl
          ? {
              url: form.imageUrl.trim(),
              altText: form.imageAlt.trim(),
            }
          : undefined,
        weight: form.weightValue
          ? {
              value: parseFloat(form.weightValue),
              unit: form.weightUnit,
            }
          : undefined,
        dimensions:
          form.length || form.width || form.height
            ? {
                length: form.length ? parseFloat(form.length) : null,
                width: form.width ? parseFloat(form.width) : null,
                height: form.height ? parseFloat(form.height) : null,
                unit: form.dimensionUnit,
              }
            : undefined,
        shippingClass: form.shippingClass.trim() || null,
      };

    // In-memory staged variant handling (create mode)
    if (variant.isStaged || String(variant._id || "").startsWith("staged-") || String(variant._id || "").startsWith("temp-") || onUpdateStagedVariant) {
      if (onUpdateStagedVariant) {
        onUpdateStagedVariant(variant._id, payload);
      }
      toast.success("Variant updated");
      if (onSuccess) onSuccess();
      onClose();
      setIsSaving(false);
      return;
    }

    try {
      const apiService = portal === "admin" ? productService : vendorService;
      if (apiService.updateProductVariant) {
        await apiService.updateProductVariant(variant._id, payload);
      } else {
        await productService.updateVariant(variant._id, payload);
      }
      toast.success("Variant updated successfully");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error("Failed to update variant", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const onHand = variant.onHand ?? variant.stockQuantity ?? 0;
  const reserved = variant.reserved ?? 0;
  const available = variant.availableQuantity ?? Math.max(0, onHand - reserved);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Package className="size-4 text-emerald-700" />
              <h3 className="text-base font-bold text-slate-900">
                Edit Variant: {variant.sku}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Attributes: <strong>{formatAttributesString(variant.attributes)}</strong>
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Authoritative Inventory Pill & Action */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-2xs">
                <Warehouse className="size-4" />
              </div>
              <div>
                <span className="block text-[11px] font-bold text-slate-800">
                  Authoritative Stock: {available} Available ({onHand} on hand, {reserved} reserved)
                </span>
                <span className="text-[10px] text-slate-500">
                  Managed via warehouse inventory.
                </span>
              </div>
            </div>
            {onOpenStockAdjustment && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenStockAdjustment(variant);
                }}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold shadow-2xs text-[11px]"
              >
                Adjust Stock
              </button>
            )}
          </div>

          {/* Pricing & SKU */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Variant SKU *
              </label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs uppercase focus:outline-none focus:ring-2 focus:ring-emerald-600"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Regular Price (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Compare-at Price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.compareAtPrice}
                onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Display Name and Active Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Variant Display Label (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Midnight Black / XL"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="size-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-semibold text-slate-800">
                  Active (Available for purchase on storefront)
                </span>
              </label>
            </div>
          </div>

          {/* Image */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-700">
              Variant Image URL
            </label>
            <input
              type="url"
              placeholder="https://example.com/variant-image.jpg"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {/* Shipping & Physical Dimensions */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Shipping & Weight Specifications
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  Weight
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.weightValue}
                  onChange={(e) => setForm({ ...form, weightValue: e.target.value })}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  Weight Unit
                </label>
                <select
                  value={form.weightUnit}
                  onChange={(e) => setForm({ ...form, weightUnit: e.target.value })}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="g">Grams (g)</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="lb">Pounds (lb)</option>
                  <option value="oz">Ounces (oz)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  Shipping Class
                </label>
                <input
                  type="text"
                  placeholder="standard / bulky"
                  value={form.shippingClass}
                  onChange={(e) => setForm({ ...form, shippingClass: e.target.value })}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  Dimension Unit
                </label>
                <select
                  value={form.dimensionUnit}
                  onChange={(e) => setForm({ ...form, dimensionUnit: e.target.value })}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="cm">cm</option>
                  <option value="in">in</option>
                  <option value="m">m</option>
                  <option value="mm">mm</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  Length
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.length}
                  onChange={(e) => setForm({ ...form, length: e.target.value })}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  Width
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.width}
                  onChange={(e) => setForm({ ...form, width: e.target.value })}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  Height
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.height}
                  onChange={(e) => setForm({ ...form, height: e.target.value })}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Footer Save */}
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
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-bold shadow-xs disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Variant"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
