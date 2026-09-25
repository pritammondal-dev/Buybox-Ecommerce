"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  Boxes,
  Edit,
  Save,
  Send,
  ExternalLink,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";

export default function VendorProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id;

  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form edit states
  const [form, setForm] = useState({
    name: "",
    price: "",
    compareAtPrice: "",
    shortDescription: "",
    description: "",
    status: "draft",
  });

  const refetchProductData = async () => {
    try {
      const res = await vendorService.getProductById(productId);
      const prd = res?.data?.data?.product || res?.data?.product || res?.data;
      setProduct(prd);
      setForm({
        name: prd?.name || prd?.title || "",
        price: prd?.price?.toString() || "",
        compareAtPrice: prd?.compareAtPrice?.toString() || "",
        shortDescription: prd?.shortDescription || "",
        description: prd?.description || "",
        status: prd?.status || "draft",
      });
      try {
        const varRes = await vendorService.getProductVariants(prd?._id || productId);
        const varList = varRes?.data?.data?.variants || varRes?.data?.variants || varRes?.data || [];
        setVariants(Array.isArray(varList) ? varList : []);
      } catch {
        setVariants([]);
      }
    } catch {
      // silent
    }
  };

  useEffect(() => {
    if (!productId) return;
    let isMounted = true;

    vendorService
      .getProductById(productId)
      .then(async (res) => {
        if (!isMounted) return;
        const prd = res?.data?.data?.product || res?.data?.product || res?.data;
        setProduct(prd);
        setForm({
          name: prd?.name || prd?.title || "",
          price: prd?.price?.toString() || "",
          compareAtPrice: prd?.compareAtPrice?.toString() || "",
          shortDescription: prd?.shortDescription || "",
          description: prd?.description || "",
          status: prd?.status || "draft",
        });

        try {
          const varRes = await vendorService.getProductVariants(prd?._id || productId);
          if (!isMounted) return;
          const varList = varRes?.data?.data?.variants || varRes?.data?.variants || varRes?.data || [];
          setVariants(Array.isArray(varList) ? varList : []);
        } catch {
          if (isMounted) setVariants([]);
        }
      })
      .catch((err) => {
        toast.error("Failed to load product details", {
          description: err.response?.data?.message || err.message,
        });
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [productId]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await vendorService.updateProduct(productId, {
        name: form.name.trim(),
        title: form.name.trim(),
        price: Number(form.price),
        compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
        shortDescription: form.shortDescription.trim(),
        description: form.description.trim(),
      });
      toast.success("Product updated successfully");
      refetchProductData();
    } catch (err) {
      toast.error("Failed to update product", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitApproval = async () => {
    setIsSubmitting(true);
    try {
      await vendorService.submitProductForApproval(productId);
      toast.success("Product submitted for marketplace approval");
      refetchProductData();
    } catch (err) {
      toast.error("Failed to submit for approval", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-32 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-44 bg-slate-200 rounded-3xl animate-pulse" />
        <div className="h-96 bg-slate-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
        <AlertTriangle className="size-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900">Product Not Found</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          The requested product could not be found or does not belong to your vendor account.
        </p>
        <Link
          href="/vendor/products"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] text-white text-xs font-semibold"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Products</span>
        </Link>
      </div>
    );
  }

  const isListingActive = product.status === "active";
  const isDraft = product.status === "draft";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back link */}
      <div>
        <Link
          href="/vendor/products"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Product Catalog</span>
        </Link>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {product.name || product.title}
              </h2>
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isListingActive
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : isDraft
                    ? "bg-slate-100 text-slate-700 border border-slate-200"
                    : product.status === "pending_review"
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {product.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              SKU: {product.sku} • ID: {product.secureId || product._id}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isDraft && (
              <button
                type="button"
                onClick={handleSubmitApproval}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                <Send className="size-3.5" />
                <span>Submit for Approval</span>
              </button>
            )}

            {isListingActive && product.slug && (
              <Link
                href={`/products/${product.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors"
              >
                <ExternalLink className="size-3.5" />
                <span>View Storefront</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Product Details Form */}
      <form onSubmit={handleUpdate} className="space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            Listing Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Title
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Compare-at Price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                value={form.compareAtPrice}
                onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Short Description
              </label>
              <input
                type="text"
                value={form.shortDescription}
                onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Description
              </label>
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              <Save className="size-4" />
              <span>{isSaving ? "Saving..." : "Update Product"}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Variants Section */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200/80 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Product Variants</h3>
            <p className="text-xs text-slate-500">
              Manage SKU options, variant-level pricing, and stock distribution.
            </p>
          </div>
        </div>

        {variants.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-xs">
            <Boxes className="size-8 text-slate-300 mx-auto mb-2" />
            <span>No extra variants configured. Base product SKU acts as default SKU.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-3.5">SKU</th>
                  <th className="px-6 py-3.5">Attributes</th>
                  <th className="px-6 py-3.5">Price</th>
                  <th className="px-6 py-3.5">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {variants.map((v) => (
                  <tr key={v._id} className="hover:bg-slate-50/60">
                    <td className="px-6 py-3.5 font-mono font-bold text-slate-900">
                      {v.sku}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600">
                      {v.attributes?.map((a) => `${a.name}: ${a.value}`).join(", ") || "Standard"}
                    </td>
                    <td className="px-6 py-3.5 font-bold text-slate-900">
                      ₹{Number(v.price || product.price || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-3.5 text-slate-700">
                      {v.stockQuantity ?? v.inventory?.onHand ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
