"use client";

import React, { useState, useMemo, useRef } from "react";
import Image from "next/image";
import {
  Package,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Warehouse,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Boxes,
  RefreshCw,
  Layers,
  ChevronDown,
  Tag,
  Percent,
  DollarSign,
  UploadCloud,
  Check,
  X,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { productService } from "@/services/product.service";
import { vendorService } from "@/services/vendor.service";
import { formatAttributesString, getAttributeEntries } from "@/utils/attribute.util";

export default function VariantTable({
  productId,
  variants = [],
  onRefresh,
  onOpenEdit,
  onOpenStockAdjustment,
  onOpenAddSingle,
  onOpenStorefrontPreview,
  isLoading = false,
  portal = "vendor", // "vendor" | "admin"
  onUpdateVariants,
  onDeleteVariant,
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "active" | "inactive"
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Bulk Price Modal State
  const [bulkPriceModalOpen, setBulkPriceModalOpen] = useState(false);
  const [bulkPriceMode, setBulkPriceMode] = useState("fixed"); // "fixed" | "percentage" | "amount"
  const [bulkPriceInput, setBulkPriceInput] = useState("");
  const [bulkComparePriceInput, setBulkComparePriceInput] = useState("");
  const [bulkPercentageInput, setBulkPercentageInput] = useState("");
  const [bulkAmountInput, setBulkAmountInput] = useState("");

  // Bulk SKU Modal State
  const [bulkSkuModalOpen, setBulkSkuModalOpen] = useState(false);
  const [bulkSkuPrefix, setBulkSkuPrefix] = useState("");
  const [bulkSkuSuffix, setBulkSkuSuffix] = useState("");

  // Bulk Image Modal State
  const [bulkImageModalOpen, setBulkImageModalOpen] = useState(false);
  const [bulkImageUrl, setBulkImageUrl] = useState("");
  const [bulkImageAlt, setBulkImageAlt] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  // Deletion Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Inline Editing State
  const [inlineEditingId, setInlineEditingId] = useState(null);
  const [inlineForm, setInlineForm] = useState({ sku: "", price: "", compareAtPrice: "", isActive: true });
  const [isSavingInline, setIsSavingInline] = useState(false);

  // Service helper
  const apiService = portal === "admin" ? productService : vendorService;

  // Filtered variants
  const filteredVariants = useMemo(() => {
    return variants.filter((v) => {
      if (statusFilter === "active" && v.isActive === false) return false;
      if (statusFilter === "inactive" && v.isActive !== false) return false;

      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const skuMatch = (v.sku || "").toLowerCase().includes(query);
        const nameMatch = (v.name || "").toLowerCase().includes(query);
        const attrMatch = formatAttributesString(v.attributes).toLowerCase().includes(query);
        return skuMatch || nameMatch || attrMatch;
      }
      return true;
    });
  }, [variants, search, statusFilter]);

  // Selection handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredVariants.map((v) => v._id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Helper to determine if a variant is staged in-memory
  const isVariantStaged = (v) =>
    !productId ||
    Boolean(v?.isStaged) ||
    String(v?._id || "").startsWith("staged-") ||
    String(v?._id || "").startsWith("temp-");

  // Toggle active status for single variant
  const handleToggleActive = async (variant) => {
    const newStatus = !variant.isActive;
    if (isVariantStaged(variant)) {
      const updated = variants.map((v) =>
        v._id === variant._id ? { ...v, isActive: newStatus } : v
      );
      if (onUpdateVariants) onUpdateVariants(updated);
      toast.success(`Variant ${variant.sku} ${newStatus ? "activated" : "deactivated"}`);
      return;
    }
    try {
      if (apiService.updateProductVariant) {
        await apiService.updateProductVariant(variant._id, { isActive: newStatus });
      } else {
        await productService.updateVariant(variant._id, { isActive: newStatus });
      }
      toast.success(`Variant ${variant.sku} ${newStatus ? "activated" : "deactivated"}`);
      onRefresh();
    } catch (err) {
      toast.error("Failed to update status", {
        description: err.response?.data?.message || err.message,
      });
    }
  };

  // Bulk Status Update
  const handleBulkStatus = async (isActive) => {
    if (selectedIds.size === 0) return;
    if (!productId || variants.some((v) => selectedIds.has(v._id) && isVariantStaged(v))) {
      const updated = variants.map((v) =>
        selectedIds.has(v._id) ? { ...v, isActive } : v
      );
      if (onUpdateVariants) onUpdateVariants(updated);
      toast.success(
        `${selectedIds.size} variants ${isActive ? "activated" : "deactivated"} successfully`
      );
      setSelectedIds(new Set());
      return;
    }
    setIsBulkUpdating(true);
    try {
      const updates = Array.from(selectedIds).map((id) => ({
        id,
        variantId: id,
        isActive,
      }));
      await productService.updateBulkVariants(productId, { updates });
      toast.success(
        `${selectedIds.size} variants ${isActive ? "activated" : "deactivated"} successfully`
      );
      setSelectedIds(new Set());
      onRefresh();
    } catch (err) {
      toast.error("Bulk status update failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Bulk Price Update Submit (Fixed, Percentage, or Fixed Amount)
  const handleBulkPriceSubmit = async (e) => {
    e.preventDefault();
    setIsBulkUpdating(true);
    try {
      let updates = [];

      if (bulkPriceMode === "fixed") {
        const priceVal = parseFloat(bulkPriceInput);
        if (isNaN(priceVal) || priceVal < 0) {
          toast.error("Please enter a valid positive price");
          setIsBulkUpdating(false);
          return;
        }

        updates = Array.from(selectedIds).map((id) => ({
          id,
          variantId: id,
          price: priceVal,
          compareAtPrice: bulkComparePriceInput ? parseFloat(bulkComparePriceInput) : null,
        }));
      } else if (bulkPriceMode === "percentage") {
        const pct = parseFloat(bulkPercentageInput);
        if (isNaN(pct)) {
          toast.error("Please enter a valid percentage adjustment");
          setIsBulkUpdating(false);
          return;
        }

        updates = Array.from(selectedIds).map((id) => {
          const original = variants.find((v) => v._id === id);
          const currentPrice = Number(original?.price || 0);
          const newPrice = Math.max(0, currentPrice * (1 + pct / 100));

          let newComparePrice = original?.compareAtPrice ? Number(original.compareAtPrice) : null;
          if (newComparePrice != null) {
            newComparePrice = Math.max(0, newComparePrice * (1 + pct / 100));
          }

          return {
            id,
            variantId: id,
            price: Number(newPrice.toFixed(2)),
            compareAtPrice: newComparePrice != null ? Number(newComparePrice.toFixed(2)) : null,
          };
        });
      } else if (bulkPriceMode === "amount") {
        const amt = parseFloat(bulkAmountInput);
        if (isNaN(amt)) {
          toast.error("Please enter a valid amount adjustment");
          setIsBulkUpdating(false);
          return;
        }

        updates = Array.from(selectedIds).map((id) => {
          const original = variants.find((v) => v._id === id);
          const currentPrice = Number(original?.price || 0);
          const newPrice = Math.max(0, currentPrice + amt);

          return {
            id,
            variantId: id,
            price: Number(newPrice.toFixed(2)),
          };
        });
      }

      if (!productId || variants.some((v) => selectedIds.has(v._id) && isVariantStaged(v))) {
        const updateMap = new Map(updates.map((u) => [u.id, u]));
        const updated = variants.map((v) => {
          const u = updateMap.get(v._id);
          if (!u) return v;
          return {
            ...v,
            price: u.price,
            ...(u.compareAtPrice !== undefined ? { compareAtPrice: u.compareAtPrice } : {}),
          };
        });
        if (onUpdateVariants) onUpdateVariants(updated);
        toast.success(`Updated pricing for ${selectedIds.size} variants`);
        setBulkPriceModalOpen(false);
        setSelectedIds(new Set());
        setBulkPriceInput("");
        setBulkComparePriceInput("");
        setBulkPercentageInput("");
        setBulkAmountInput("");
        setIsBulkUpdating(false);
        return;
      }

      await productService.updateBulkVariants(productId, { updates });
      toast.success(`Updated pricing for ${selectedIds.size} variants`);
      setBulkPriceModalOpen(false);
      setSelectedIds(new Set());
      setBulkPriceInput("");
      setBulkComparePriceInput("");
      setBulkPercentageInput("");
      setBulkAmountInput("");
      onRefresh();
    } catch (err) {
      toast.error("Bulk price update failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Bulk SKU Update Submit
  const handleBulkSkuSubmit = async (e) => {
    e.preventDefault();
    if (!bulkSkuPrefix.trim() && !bulkSkuSuffix.trim()) {
      toast.error("Please specify a prefix or suffix to append to SKUs");
      return;
    }

    setIsBulkUpdating(true);
    try {
      const updates = Array.from(selectedIds).map((id) => {
        const original = variants.find((v) => v._id === id);
        const originalSku = original?.sku || "SKU";
        const newSku = `${bulkSkuPrefix.trim()}${originalSku}${bulkSkuSuffix.trim()}`.toUpperCase();

        return {
          id,
          variantId: id,
          sku: newSku,
        };
      });

      if (!productId || variants.some((v) => selectedIds.has(v._id) && isVariantStaged(v))) {
        const updateMap = new Map(updates.map((u) => [u.id, u]));
        const updated = variants.map((v) => {
          const u = updateMap.get(v._id);
          return u ? { ...v, sku: u.sku } : v;
        });
        if (onUpdateVariants) onUpdateVariants(updated);
        toast.success(`Updated SKUs for ${selectedIds.size} variants`);
        setBulkSkuModalOpen(false);
        setBulkSkuPrefix("");
        setBulkSkuSuffix("");
        setSelectedIds(new Set());
        setIsBulkUpdating(false);
        return;
      }

      await productService.updateBulkVariants(productId, { updates });
      toast.success(`Updated SKUs for ${selectedIds.size} variants`);
      setBulkSkuModalOpen(false);
      setBulkSkuPrefix("");
      setBulkSkuSuffix("");
      setSelectedIds(new Set());
      onRefresh();
    } catch (err) {
      toast.error("Bulk SKU update failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Bulk Image Assignment
  const handleBulkImageSubmit = async (e) => {
    e.preventDefault();
    if (!bulkImageUrl.trim()) {
      toast.error("Please provide or upload a valid image URL");
      return;
    }

    setIsBulkUpdating(true);
    try {
      const updates = Array.from(selectedIds).map((id) => ({
        id,
        variantId: id,
        image: {
          url: bulkImageUrl.trim(),
          altText: bulkImageAlt.trim() || "Variant Image",
          publicId: null,
        },
      }));

      if (!productId || variants.some((v) => selectedIds.has(v._id) && isVariantStaged(v))) {
        const imgObj = {
          url: bulkImageUrl.trim(),
          altText: bulkImageAlt.trim() || "Variant Image",
          publicId: null,
        };
        const updated = variants.map((v) =>
          selectedIds.has(v._id) ? { ...v, image: imgObj } : v
        );
        if (onUpdateVariants) onUpdateVariants(updated);
        toast.success(`Assigned image to ${selectedIds.size} variants`);
        setBulkImageModalOpen(false);
        setBulkImageUrl("");
        setBulkImageAlt("");
        setSelectedIds(new Set());
        setIsBulkUpdating(false);
        return;
      }

      await productService.updateBulkVariants(productId, { updates });
      toast.success(`Assigned image to ${selectedIds.size} variants`);
      setBulkImageModalOpen(false);
      setBulkImageUrl("");
      setBulkImageAlt("");
      setSelectedIds(new Set());
      onRefresh();
    } catch (err) {
      toast.error("Bulk image assignment failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Image upload in bulk modal
  const handleImageFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await productService.uploadProductImage(formData);
      const data = res?.data?.data || res?.data || {};
      if (data.url) {
        setBulkImageUrl(data.url);
        if (!bulkImageAlt) {
          setBulkImageAlt(data.altText || file.name.replace(/\.[^/.]+$/, ""));
        }
        toast.success("Image uploaded successfully");
      }
    } catch (err) {
      toast.error("Image upload failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Inline Quick Edit Handlers
  const handleStartInlineEdit = (v) => {
    setInlineEditingId(v._id);
    setInlineForm({
      sku: v.sku || "",
      price: v.price?.toString() || "0",
      compareAtPrice: v.compareAtPrice?.toString() || "",
      isActive: v.isActive !== false,
    });
  };

  const handleSaveInlineEdit = async (id) => {
    if (!inlineForm.sku.trim()) {
      toast.error("SKU identifier is required");
      return;
    }
    const priceNum = parseFloat(inlineForm.price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Valid positive price is required");
      return;
    }

    const payload = {
      sku: inlineForm.sku.trim().toUpperCase(),
      price: priceNum,
      compareAtPrice: inlineForm.compareAtPrice ? parseFloat(inlineForm.compareAtPrice) : null,
      isActive: Boolean(inlineForm.isActive),
    };

    const targetVar = variants.find((v) => v._id === id);
    if (isVariantStaged(targetVar)) {
      const updated = variants.map((v) => (v._id === id ? { ...v, ...payload } : v));
      if (onUpdateVariants) onUpdateVariants(updated);
      toast.success("Variant updated successfully");
      setInlineEditingId(null);
      return;
    }

    setIsSavingInline(true);
    try {
      if (apiService.updateProductVariant) {
        await apiService.updateProductVariant(id, payload);
      } else {
        await productService.updateVariant(id, payload);
      }

      toast.success("Variant updated successfully");
      setInlineEditingId(null);
      onRefresh();
    } catch (err) {
      toast.error("Failed to save variant", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSavingInline(false);
    }
  };

  // Delete Variant Confirmation
  const confirmDelete = async () => {
    if (!deleteTarget) return;

    const reserved = deleteTarget.reserved ?? 0;
    if (reserved > 0) {
      toast.error(
        `Cannot delete variant ${deleteTarget.sku}: It has ${reserved} active order reservation(s).`
      );
      setDeleteTarget(null);
      return;
    }

    if (isVariantStaged(deleteTarget)) {
      if (onDeleteVariant) {
        onDeleteVariant(deleteTarget._id);
      } else if (onUpdateVariants) {
        onUpdateVariants(variants.filter((v) => v._id !== deleteTarget._id));
      }
      toast.success(`Variant ${deleteTarget.sku} removed`);
      setDeleteTarget(null);
      return;
    }

    setIsDeleting(true);
    try {
      if (apiService.deleteProductVariant) {
        await apiService.deleteProductVariant(deleteTarget._id);
      } else {
        await productService.deleteVariant(deleteTarget._id);
      }
      toast.success(`Variant ${deleteTarget.sku} archived successfully`);
      setDeleteTarget(null);
      onRefresh();
    } catch (err) {
      toast.error("Failed to archive variant", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const isAllSelected =
    filteredVariants.length > 0 && selectedIds.size === filteredVariants.length;

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden space-y-0">
      {/* Table Header Bar */}
      <div className="p-5 border-b border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="size-4 text-emerald-700" />
            <h3 className="text-sm font-bold text-slate-900">
              Purchasable Variants Matrix & Bulk Control
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 font-mono">
              {variants.length} total
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage variant SKUs, individual pricing tiers, gallery swatches, and physical inventory allocations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {onOpenStorefrontPreview && (
            <button
              type="button"
              onClick={onOpenStorefrontPreview}
              disabled={variants.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all disabled:opacity-40"
            >
              <Eye className="size-3.5" />
              <span>Preview Customer View</span>
            </button>
          )}

          {onOpenAddSingle && (
            <button
              type="button"
              onClick={onOpenAddSingle}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#007A55] hover:bg-[#006346] active:scale-95 text-white text-xs font-bold shadow-xs transition-all"
            >
              <Plus className="size-3.5" />
              <span>Add Single Variation</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRefresh}
            className="p-1.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
            title="Refresh variants"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 bg-slate-50 border-b border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by SKU, attributes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-[11px] font-semibold text-slate-500">Status:</span>
          <div className="inline-flex p-0.5 bg-white border border-slate-200 rounded-xl">
            {["all", "active", "inactive"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition-all ${
                  statusFilter === st
                    ? "bg-[#007A55] text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk Operations Action Bar (shown when items are selected) */}
      {selectedIds.size > 0 && (
        <div className="p-3 bg-emerald-50/80 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-100">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#004D38]">
              {selectedIds.size} of {filteredVariants.length} selected
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setBulkPriceModalOpen(true)}
              disabled={isBulkUpdating}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-emerald-300 text-emerald-900 font-bold hover:bg-emerald-100/60 shadow-2xs active:scale-95 transition-all"
            >
              <DollarSign className="size-3.5" />
              <span>Bulk Price / Discount</span>
            </button>

            <button
              type="button"
              onClick={() => setBulkSkuModalOpen(true)}
              disabled={isBulkUpdating}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-emerald-300 text-emerald-900 font-bold hover:bg-emerald-100/60 shadow-2xs active:scale-95 transition-all"
            >
              <Tag className="size-3.5" />
              <span>Bulk SKU</span>
            </button>

            <button
              type="button"
              onClick={() => setBulkImageModalOpen(true)}
              disabled={isBulkUpdating}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-emerald-300 text-emerald-900 font-bold hover:bg-emerald-100/60 shadow-2xs active:scale-95 transition-all"
            >
              <UploadCloud className="size-3.5" />
              <span>Assign Image</span>
            </button>

            <button
              type="button"
              onClick={() => handleBulkStatus(true)}
              disabled={isBulkUpdating}
              className="px-3 py-1.5 rounded-full bg-white border border-emerald-300 text-emerald-900 font-bold hover:bg-emerald-100/60 shadow-2xs"
            >
              Activate
            </button>

            <button
              type="button"
              onClick={() => handleBulkStatus(false)}
              disabled={isBulkUpdating}
              className="px-3 py-1.5 rounded-full bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 shadow-2xs"
            >
              Deactivate
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-slate-500 hover:text-slate-800 text-[11px] underline ml-2"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Variants Table */}
      {isLoading ? (
        <div className="p-8 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredVariants.length === 0 ? (
        <div className="p-12 text-center text-slate-500 text-xs space-y-3">
          <Boxes className="size-8 text-slate-300 mx-auto" />
          <div>
            <h4 className="font-bold text-slate-800 text-sm">No Product Variations Added Yet</h4>
            <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
              {search || statusFilter !== "all"
                ? "No variants match the current search filters."
                : "Generate combinations using the Attribute Builder above (e.g. Size, Color) or click below to add a variation manually."}
            </p>
          </div>
          {onOpenAddSingle && !search && statusFilter === "all" && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onOpenAddSingle}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white font-bold text-xs shadow-xs transition-colors"
              >
                <Plus className="size-3.5" />
                <span>Add Single Variation Manually</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="px-4 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="size-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                </th>
                <th className="px-3 py-3 w-14">Image</th>
                <th className="px-4 py-3">Variant SKU</th>
                <th className="px-4 py-3">Attributes</th>
                <th className="px-4 py-3">Price (₹)</th>
                <th className="px-4 py-3">Warehouse Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVariants.map((v) => {
                const isSelected = selectedIds.has(v._id);
                const isInlineEditing = inlineEditingId === v._id;
                const onHand = v.onHand ?? v.stockQuantity ?? 0;
                const reserved = v.reserved ?? 0;
                const available = v.availableQuantity ?? Math.max(0, onHand - reserved);
                const hasReservations = reserved > 0;
                const isLow = available > 0 && available <= 5;
                const isOut = available <= 0;

                return (
                  <tr
                    key={v._id}
                    className={`transition-colors ${
                      isSelected ? "bg-emerald-50/40" : "hover:bg-slate-50/60"
                    }`}
                  >
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(v._id)}
                        className="size-4 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                    </td>

                    {/* Image */}
                    <td className="px-3 py-3">
                      <div className="size-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 text-slate-400">
                        {v.image?.url ? (
                          <Image
                            src={v.image.url}
                            alt={v.sku}
                            width={40}
                            height={40}
                            className="size-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <Package className="size-4" />
                        )}
                      </div>
                    </td>

                    {/* SKU */}
                    <td className="px-4 py-3">
                      {isInlineEditing ? (
                        <input
                          type="text"
                          value={inlineForm.sku}
                          onChange={(e) => setInlineForm({ ...inlineForm, sku: e.target.value })}
                          className="w-32 px-2 py-1 rounded-lg border border-slate-300 font-mono text-[11px] uppercase bg-white"
                        />
                      ) : (
                        <>
                          <div className="font-mono font-bold text-slate-900">{v.sku}</div>
                          {v.isDefault && (
                            <span className="text-[10px] text-emerald-700 font-semibold">
                              Canonical Default
                            </span>
                          )}
                        </>
                      )}
                    </td>

                    {/* Attributes */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {getAttributeEntries(v.attributes).map(({ name, value }) => (
                          <span
                            key={name}
                            className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-700 shadow-2xs"
                          >
                            <span className="text-slate-400">{name}:</span> {value}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3">
                      {isInlineEditing ? (
                        <div className="space-y-1">
                          <input
                            type="number"
                            step="0.01"
                            value={inlineForm.price}
                            onChange={(e) => setInlineForm({ ...inlineForm, price: e.target.value })}
                            placeholder="Price"
                            className="w-24 px-2 py-1 rounded-lg border border-slate-300 font-bold bg-white"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={inlineForm.compareAtPrice}
                            onChange={(e) => setInlineForm({ ...inlineForm, compareAtPrice: e.target.value })}
                            placeholder="MRP"
                            className="w-24 px-2 py-0.5 rounded-lg border border-slate-200 text-[10px] bg-white text-slate-500"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="font-bold text-slate-900">
                            ₹{Number(v.price || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </div>
                          {v.compareAtPrice && (
                            <div className="text-[10px] text-slate-400 line-through">
                              ₹{Number(v.compareAtPrice).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </div>
                          )}
                        </>
                      )}
                    </td>

                    {/* Warehouse Stock */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isOut
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : isLow
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}
                          >
                            {isOut ? "Out of Stock" : isLow ? `Low (${available})` : `${available} Available`}
                          </span>
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            {onHand} on-hand {hasReservations ? `• ${reserved} reserved` : ""}
                          </div>
                        </div>

                        {onOpenStockAdjustment && (
                          <button
                            type="button"
                            onClick={() => onOpenStockAdjustment(v)}
                            className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors shadow-2xs"
                            title="Adjust physical warehouse stock"
                          >
                            <Warehouse className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(v)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition-colors ${
                          v.isActive !== false
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-500 border border-slate-200"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            v.isActive !== false ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        <span>{v.isActive !== false ? "Active" : "Inactive"}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      {isInlineEditing ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSaveInlineEdit(v._id)}
                            disabled={isSavingInline}
                            className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs"
                            title="Save inline changes"
                          >
                            <Check className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setInlineEditingId(null)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                            title="Cancel inline edit"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartInlineEdit(v)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="Quick Inline Edit"
                          >
                            <Edit className="size-3.5 text-slate-500" />
                          </button>

                          {onOpenEdit && (
                            <button
                              type="button"
                              onClick={() => onOpenEdit(v)}
                              className="px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                              title="Full variation edit modal"
                            >
                              Details
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(v)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete variant"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 1. Bulk Price Modal (Fixed / Percentage / Amount) */}
      {bulkPriceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="size-4 text-emerald-600" />
                <span>Bulk Price Adjustment ({selectedIds.size} variants)</span>
              </h3>
              <button
                type="button"
                onClick={() => setBulkPriceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Price Adjustment Mode Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-2xl">
              <button
                type="button"
                onClick={() => setBulkPriceMode("fixed")}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  bulkPriceMode === "fixed"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Fixed Price
              </button>
              <button
                type="button"
                onClick={() => setBulkPriceMode("percentage")}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  bulkPriceMode === "percentage"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Percentage (%)
              </button>
              <button
                type="button"
                onClick={() => setBulkPriceMode("amount")}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  bulkPriceMode === "amount"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Adjustment (₹)
              </button>
            </div>

            <form onSubmit={handleBulkPriceSubmit} className="space-y-4 text-xs">
              {bulkPriceMode === "fixed" ? (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      New Selling Price (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={bulkPriceInput}
                      onChange={(e) => setBulkPriceInput(e.target.value)}
                      placeholder="e.g. 799.00"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      New Compare-at / MRP (₹) (Optional)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={bulkComparePriceInput}
                      onChange={(e) => setBulkComparePriceInput(e.target.value)}
                      placeholder="e.g. 1199.00"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </>
              ) : bulkPriceMode === "percentage" ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Price Change Percentage (%)
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Enter positive value to increase prices (e.g. <code>10</code> for +10%), or negative value for discounts (e.g. <code>-15</code> for 15% off).
                  </p>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={bulkPercentageInput}
                      onChange={(e) => setBulkPercentageInput(e.target.value)}
                      placeholder="e.g. 10 or -15"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      required
                    />
                    <Percent className="size-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Fixed Amount Shift (₹)
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Add or subtract a fixed rupee amount across all selected variants (e.g. <code>+50</code> or <code>-50</code>).
                  </p>
                  <input
                    type="number"
                    step="0.01"
                    value={bulkAmountInput}
                    onChange={(e) => setBulkAmountInput(e.target.value)}
                    placeholder="e.g. 50 or -50"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    required
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setBulkPriceModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBulkUpdating}
                  className="px-4 py-1.5 rounded-full bg-[#007A55] text-white font-bold hover:bg-[#006346] shadow-xs disabled:opacity-50"
                >
                  {isBulkUpdating ? "Applying..." : `Apply to ${selectedIds.size} Variants`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Bulk SKU Modal */}
      {bulkSkuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Tag className="size-4 text-emerald-600" />
                <span>Bulk SKU Pattern ({selectedIds.size} variants)</span>
              </h3>
              <button
                type="button"
                onClick={() => setBulkSkuModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleBulkSkuSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Prefix (Prepend to SKU)
                </label>
                <input
                  type="text"
                  placeholder="e.g. IN-"
                  value={bulkSkuPrefix}
                  onChange={(e) => setBulkSkuPrefix(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Suffix (Append to SKU)
                </label>
                <input
                  type="text"
                  placeholder="e.g. -2026"
                  value={bulkSkuSuffix}
                  onChange={(e) => setBulkSkuSuffix(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setBulkSkuModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBulkUpdating}
                  className="px-4 py-1.5 rounded-full bg-[#007A55] text-white font-bold hover:bg-[#006346] shadow-xs disabled:opacity-50"
                >
                  {isBulkUpdating ? "Updating..." : "Apply SKU Pattern"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Bulk Image Modal */}
      {bulkImageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageFileUpload}
              className="hidden"
            />

            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UploadCloud className="size-4 text-emerald-600" />
                <span>Assign Image ({selectedIds.size} variants)</span>
              </h3>
              <button
                type="button"
                onClick={() => setBulkImageModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleBulkImageSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Image File or URL *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={bulkImageUrl}
                    onChange={(e) => setBulkImageUrl(e.target.value)}
                    placeholder="https://... or upload"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-bold shrink-0"
                  >
                    {isUploadingImage ? "..." : "Upload"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Alt Text
                </label>
                <input
                  type="text"
                  value={bulkImageAlt}
                  onChange={(e) => setBulkImageAlt(e.target.value)}
                  placeholder="e.g. Emerald Green swatch angle"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {bulkImageUrl && (
                <div className="size-16 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden relative mx-auto">
                  <Image
                    src={bulkImageUrl}
                    alt="Preview"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setBulkImageModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBulkUpdating}
                  className="px-4 py-1.5 rounded-full bg-[#007A55] text-white font-bold hover:bg-[#006346] shadow-xs disabled:opacity-50"
                >
                  {isBulkUpdating ? "Assigning..." : "Assign to Selected"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Archive Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Archive Variant: {deleteTarget.sku}?
                </h3>
                <p className="text-xs text-slate-500">
                  Attributes: {formatAttributesString(deleteTarget.attributes)}
                </p>
              </div>
            </div>

            {deleteTarget.reserved > 0 ? (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
                <strong>Cannot archive:</strong> This variant has {deleteTarget.reserved} unit(s) reserved by pending customer orders. Fulfill or cancel the active orders before archiving.
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                Are you sure you want to archive this variant? It will be archived and removed from the active marketplace catalog while historical order and shipment records remain preserved.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
              >
                Cancel
              </button>
              {deleteTarget.reserved === 0 && (
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
                >
                  {isDeleting ? "Archiving..." : "Archive Variant"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
