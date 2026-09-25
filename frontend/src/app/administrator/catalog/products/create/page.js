"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  Save,
  AlertTriangle,
  Layers,
  Tag,
  Store,
  DollarSign,
  FileText,
  CheckCircle2,
  Sparkles,
  Info,
} from "lucide-react";
import { adminCatalogService, adminVendorService } from "@/services/admin/admin.service.js";

export default function AdminProductCreatePage() {
  const router = useRouter();

  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loadingLookups, setLoadingLookups] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form State
  const [form, setForm] = useState({
    name: "",
    slug: "",
    sku: "",
    description: "",
    shortDescription: "",
    price: "",
    compareAtPrice: "",
    currency: "INR",
    isTaxable: true,
    taxCategory: "standard_gst",
    categoryId: "",
    brandId: "",
    vendorId: "",
    status: "active",
    isFeatured: false,
    tagInput: "",
    tags: [],
  });

  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [catRes, brandRes, venRes] = await Promise.all([
          adminCatalogService.listCategories({ limit: 100 }),
          adminCatalogService.listBrands({ limit: 100 }),
          adminVendorService.list({ limit: 100 }),
        ]);

        const catList = catRes?.items || catRes?.categories || catRes || [];
        const brandList = brandRes?.items || brandRes?.brands || brandRes || [];
        const venList = venRes?.vendors || venRes?.items || venRes || [];

        setCategories(Array.isArray(catList) ? catList : []);
        setBrands(Array.isArray(brandList) ? brandList : []);
        setVendors(Array.isArray(venList) ? venList : []);

        if (catList.length > 0) {
          setForm((prev) => ({ ...prev, categoryId: catList[0]._id || catList[0].id }));
        }
        if (venList.length > 0) {
          setForm((prev) => ({ ...prev, vendorId: venList[0]._id || venList[0].id }));
        }
      } catch (err) {
        console.error("Failed to load catalog lookups:", err);
      } finally {
        setLoadingLookups(false);
      }
    };

    fetchLookups();
  }, []);

  const handleNameChange = (e) => {
    const name = e.target.value;
    const updates = { name };
    if (!slugManuallyEdited) {
      updates.slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
    }
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const handleAddTag = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = form.tagInput.trim().replace(/^,+|,+$/g, "");
      if (val && !form.tags.includes(val)) {
        setForm((prev) => ({
          ...prev,
          tags: [...prev.tags, val],
          tagInput: "",
        }));
      }
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tagToRemove),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.name.trim()) return setError("Product name is required.");
    if (!form.sku.trim()) return setError("SKU is required.");
    if (!form.price || isNaN(form.price) || Number(form.price) < 0) {
      return setError("A valid positive price is required.");
    }
    if (!form.categoryId) return setError("Please select a product category.");

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        sku: form.sku.trim().toUpperCase(),
        description: form.description.trim(),
        shortDescription: form.shortDescription.trim(),
        price: Number(form.price).toFixed(2),
        currency: form.currency,
        isTaxable: Boolean(form.isTaxable),
        taxCategory: form.taxCategory,
        categoryId: form.categoryId,
        status: form.status,
        isFeatured: Boolean(form.isFeatured),
        tags: form.tags,
      };

      if (form.compareAtPrice && !isNaN(form.compareAtPrice) && Number(form.compareAtPrice) > 0) {
        payload.compareAtPrice = Number(form.compareAtPrice).toFixed(2);
      }
      if (form.brandId) {
        payload.brandId = form.brandId;
      }
      if (form.vendorId) {
        payload.vendorId = form.vendorId;
      }

      await adminCatalogService.createProduct(payload);

      setSuccess("Product created successfully! Redirecting to catalog...");
      setTimeout(() => {
        router.push("/administrator/catalog/products");
      }, 1500);
    } catch (err) {
      console.error("Create product failed:", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to create product listing. Please check required fields."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <Link
            href="/administrator/catalog/products"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-1"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Products</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Package className="size-6 text-emerald-600" />
            <span>Create New Catalog Product</span>
          </h1>
          <p className="text-xs text-slate-500">
            Provision and publish an authoritative product listing to the marketplace storefront
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5">
          <AlertTriangle className="size-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Core Information */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileText className="size-4 text-emerald-600" />
            <span>Basic Product Information</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Product Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={handleNameChange}
                placeholder="e.g. Sony WH-1000XM5 Wireless Headphones"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Slug (URL Identifier) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.slug}
                onChange={(e) => {
                  setSlugManuallyEdited(true);
                  setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") });
                }}
                placeholder="sony-wh-1000xm5-wireless-headphones"
                className="w-full text-xs p-3 font-mono rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                SKU (Stock Keeping Unit) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
                placeholder="SNY-WH1000XM5-BLK"
                className="w-full text-xs p-3 font-mono rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Short Summary</label>
              <input
                type="text"
                value={form.shortDescription}
                onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
                placeholder="Industry-leading noise canceling with dual processors"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Full Description</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detailed specifications, features, warranty, and package contents..."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 resize-none"
            />
          </div>
        </div>

        {/* Section 2: Pricing & Taxation */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="size-4 text-emerald-600" />
            <span>Pricing &amp; Taxation</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Selling Price (INR) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-xs text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="24999.00"
                  className="w-full text-xs pl-7 pr-3 py-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-mono font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Compare At (MRP)</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-xs text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.compareAtPrice}
                  onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })}
                  placeholder="29990.00"
                  className="w-full text-xs pl-7 pr-3 py-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Tax Category</label>
              <select
                value={form.taxCategory}
                onChange={(e) => setForm({ ...form, taxCategory: e.target.value })}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-medium"
              >
                <option value="standard_gst">Standard GST (18%)</option>
                <option value="reduced_gst">Reduced GST (12%)</option>
                <option value="zero_gst">Zero GST (0%)</option>
                <option value="exempt_gst">Exempt GST</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Classification & Merchant Attribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="size-4 text-emerald-600" />
            <span>Category, Brand &amp; Merchant Attribution</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-medium"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c._id || c.id} value={c._id || c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Brand</label>
              <select
                value={form.brandId}
                onChange={(e) => setForm({ ...form, brandId: e.target.value })}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-medium"
              >
                <option value="">No Brand / Generic</option>
                {brands.map((b) => (
                  <option key={b._id || b.id} value={b._id || b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Fulfilling Merchant / Vendor</label>
              <select
                value={form.vendorId}
                onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-medium"
              >
                {vendors.map((v) => (
                  <option key={v._id || v.id} value={v._id || v.id}>
                    {v.businessName || v.name || "Vendor"}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 4: Publishing & Tags */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="size-4 text-emerald-600" />
            <span>Publishing &amp; Tags</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Publication Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-medium"
              >
                <option value="active">Active (Published to Storefront)</option>
                <option value="draft">Draft (Unpublished)</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Product Tags (press Enter)</label>
              <input
                type="text"
                value={form.tagInput}
                onChange={(e) => setForm({ ...form, tagInput: e.target.value })}
                onKeyDown={handleAddTag}
                placeholder="audio, wireless, bluetooth"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              />
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {form.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                    >
                      <span>{t}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="hover:text-rose-600 font-bold ml-1"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isFeatured"
              checked={form.isFeatured}
              onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
              className="size-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
            />
            <label htmlFor="isFeatured" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Feature this product on homepage collections and storefront carousels
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/administrator/catalog/products"
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            <Save className="size-4" />
            <span>{submitting ? "Saving Product..." : "Save and Publish Product"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
