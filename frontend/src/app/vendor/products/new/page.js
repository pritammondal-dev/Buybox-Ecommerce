"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  Plus,
  Save,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";
import { categoryService } from "@/services/category.service";
import { brandService } from "@/services/brand.service";
import { getVendorProductUrl } from "@/utils/secure-id.util";

export default function NewVendorProductPage() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categoryAttributes, setCategoryAttributes] = useState([]);
  const [attributesData, setAttributesData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    sku: "",
    price: "",
    compareAtPrice: "",
    categoryId: "",
    brandId: "",
    description: "",
    shortDescription: "",
    taxCategory: "standard",
    stockQuantity: "10",
  });

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [catRes, brandRes] = await Promise.all([
          categoryService.getCategories({ limit: 100 }),
          brandService.getBrands({ limit: 100 }),
        ]);
        const catList = catRes?.data?.data?.categories || catRes?.data?.categories || catRes?.data || [];
        const brandList = brandRes?.data?.data?.brands || brandRes?.data?.brands || brandRes?.data || [];

        setCategories(Array.isArray(catList) ? catList : []);
        setBrands(Array.isArray(brandList) ? brandList : []);
      } catch (err) {
        console.error("Failed to load categories/brands", err);
      }
    };
    loadLookups();
  }, []);

  // Dynamically load category-specific attributes when category changes
  useEffect(() => {
    if (!formData.categoryId) {
      setCategoryAttributes([]);
      setAttributesData({});
      return;
    }
    const loadCatAttrs = async () => {
      try {
        const res = await categoryService.getCategoryAttributes(formData.categoryId);
        const list = res?.data?.data || res?.data || [];
        setCategoryAttributes(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error("Failed to load category attributes", err);
      }
    };
    loadCatAttrs();
  }, [formData.categoryId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      // Auto-generate slug from name if slug hasn't been explicitly typed
      if (name === "name" && !prev.slug) {
        updated.slug = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (!formData.sku.trim()) {
      toast.error("SKU identifier is required");
      return;
    }
    // Validate required category attributes
    for (const attr of categoryAttributes) {
      if (attr.isRequired && (!attributesData[attr.name] || attributesData[attr.name].toString().trim() === "")) {
        toast.error(`Attribute "${attr.name}" is required for this category`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        title: formData.name.trim(),
        slug: formData.slug.trim() || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        sku: formData.sku.trim().toUpperCase(),
        price: Number(formData.price),
        compareAtPrice: formData.compareAtPrice ? Number(formData.compareAtPrice) : undefined,
        categoryId: formData.categoryId || undefined,
        brandId: formData.brandId || undefined,
        description: formData.description.trim(),
        shortDescription: formData.shortDescription.trim(),
        taxCategory: formData.taxCategory,
        stockQuantity: Number(formData.stockQuantity) || 0,
        specifications: attributesData,
        status: "draft",
      };

      const res = await vendorService.createProduct(payload);
      const created = res?.data?.data?.product || res?.data?.product || res?.data;

      toast.success("Product created successfully", {
        description: "Your product listing has been saved as a draft.",
      });

      const nextUrl = created?.secureId || created?._id
        ? getVendorProductUrl(created.secureId || created._id)
        : "/vendor/products";

      router.push(nextUrl);
    } catch (err) {
      toast.error("Failed to create product", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/vendor/products"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Product Catalog</span>
        </Link>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Create New Product Listing
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          List a new item for sale on Buybox Marketplace. Once configured, you can submit it for admin approval.
        </p>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            General Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Title / Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="e.g. Ergonomic Bluetooth Wireless Mouse"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                SKU (Stock Keeping Unit) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="sku"
                required
                placeholder="e.g. SKU-TECH-001"
                value={formData.sku}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                URL Slug
              </label>
              <input
                type="text"
                name="slug"
                placeholder="e.g. ergonomic-bluetooth-mouse"
                value={formData.slug}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category
              </label>
              <select
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Brand
              </label>
              <select
                name="brandId"
                value={formData.brandId}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="">Select Brand</option>
                {brands.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Dynamic Category Attributes */}
        {categoryAttributes.length > 0 && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Category Attributes & Specifications
                </h3>
                <p className="text-xs text-slate-500">
                  Platform-defined attributes for the selected category.
                </p>
              </div>
              <span className="text-[10px] uppercase font-semibold tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {categoryAttributes.length} Attribute{categoryAttributes.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categoryAttributes.map((attr) => {
                const value = attributesData[attr.name] ?? "";
                return (
                  <div key={attr._id || attr.name}>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {attr.name} {attr.unit ? `(${attr.unit})` : ""}
                      {attr.isRequired && <span className="text-rose-500 ml-0.5">*</span>}
                    </label>

                    {attr.type === "select" || attr.type === "size" ? (
                      <select
                        value={value}
                        onChange={(e) =>
                          setAttributesData((prev) => ({
                            ...prev,
                            [attr.name]: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      >
                        <option value="">Select {attr.name}</option>
                        {attr.values?.map((v, i) => {
                          const val = typeof v === "object" ? v.value || v.label : v;
                          const label = typeof v === "object" ? v.label || v.value : v;
                          return (
                            <option key={i} value={val}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    ) : attr.type === "boolean" ? (
                      <div className="flex items-center gap-4 pt-1.5">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-slate-700">
                          <input
                            type="radio"
                            name={`attr_${attr.name}`}
                            checked={value === "true" || value === true}
                            onChange={() =>
                              setAttributesData((prev) => ({
                                ...prev,
                                [attr.name]: "true",
                              }))
                            }
                            className="accent-emerald-600"
                          />
                          Yes
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-slate-700">
                          <input
                            type="radio"
                            name={`attr_${attr.name}`}
                            checked={value === "false" || value === false}
                            onChange={() =>
                              setAttributesData((prev) => ({
                                ...prev,
                                [attr.name]: "false",
                              }))
                            }
                            className="accent-emerald-600"
                          />
                          No
                        </label>
                      </div>
                    ) : attr.type === "color" ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={value && value.startsWith("#") ? value : "#004D38"}
                          onChange={(e) =>
                            setAttributesData((prev) => ({
                              ...prev,
                              [attr.name]: e.target.value,
                            }))
                          }
                          className="w-10 h-8 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          placeholder="e.g. Midnight Black or #004D38"
                          value={value}
                          onChange={(e) =>
                            setAttributesData((prev) => ({
                              ...prev,
                              [attr.name]: e.target.value,
                            }))
                          }
                          className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                      </div>
                    ) : attr.type === "number" ? (
                      <input
                        type="number"
                        placeholder={`Enter ${attr.name}`}
                        value={value}
                        onChange={(e) =>
                          setAttributesData((prev) => ({
                            ...prev,
                            [attr.name]: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    ) : attr.type === "date" ? (
                      <input
                        type="date"
                        value={value}
                        onChange={(e) =>
                          setAttributesData((prev) => ({
                            ...prev,
                            [attr.name]: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    ) : (
                      <input
                        type="text"
                        placeholder={`Enter ${attr.name}`}
                        value={value}
                        onChange={(e) =>
                          setAttributesData((prev) => ({
                            ...prev,
                            [attr.name]: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pricing & Stock */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            Pricing & Initial Inventory
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Selling Price (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                name="price"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                value={formData.price}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Compare-at / MRP (₹)
              </label>
              <input
                type="number"
                name="compareAtPrice"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.compareAtPrice}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tax Category
              </label>
              <select
                name="taxCategory"
                value={formData.taxCategory}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="standard">Standard GST (18%)</option>
                <option value="reduced">Reduced GST (12%)</option>
                <option value="essential">Essential GST (5%)</option>
                <option value="zero">Zero Rate (0%)</option>
                <option value="exempt">Exempt</option>
              </select>
            </div>

            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Initial Stock Quantity
              </label>
              <input
                type="number"
                name="stockQuantity"
                min="0"
                value={formData.stockQuantity}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Descriptions */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            Description & Highlights
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Short Summary (Brief snippet for search & cards)
              </label>
              <input
                type="text"
                name="shortDescription"
                placeholder="High-precision wireless optical sensor with ergonomic rubberized grip."
                value={formData.shortDescription}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Product Description
              </label>
              <textarea
                name="description"
                rows={5}
                placeholder="Provide detailed technical specifications, dimensions, features, and warranty details..."
                value={formData.description}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/vendor/products"
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
          >
            <Save className="size-4" />
            <span>{isSubmitting ? "Creating..." : "Save Product Listing"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
