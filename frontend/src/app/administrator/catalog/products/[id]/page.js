"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Tag,
  Layers,
  Store,
  DollarSign,
  Edit,
  Trash2,
  X,
  Save,
  Check,
  Info,
} from "lucide-react";
import { adminCatalogService } from "@/services/admin/admin.service.js";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id;

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Reject Modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Delete Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit Drawer
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [editForm, setEditForm] = useState({
    name: "",
    slug: "",
    sku: "",
    price: "",
    compareAtPrice: "",
    categoryId: "",
    brandId: "",
    status: "active",
    shortDescription: "",
    description: "",
    isFeatured: false,
  });
  const [saving, setSaving] = useState(false);

  const fetchProduct = async () => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminCatalogService.getProduct(productId);
      setProduct(data);
      // Initialize edit form
      setEditForm({
        name: data.name || data.title || "",
        slug: data.slug || "",
        sku: data.sku || "",
        price: data.price != null ? String(data.price) : "",
        compareAtPrice: data.compareAtPrice != null ? String(data.compareAtPrice) : "",
        categoryId: data.categoryId?._id || data.categoryId || "",
        brandId: data.brandId?._id || data.brandId || "",
        status: data.status || "active",
        shortDescription: data.shortDescription || "",
        description: data.description || "",
        isFeatured: Boolean(data.isFeatured),
      });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load product details"
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchLookups = async () => {
    try {
      const [catsRes, brandsRes] = await Promise.allSettled([
        adminCatalogService.listCategories(),
        adminCatalogService.listBrands(),
      ]);
      if (catsRes.status === "fulfilled") {
        setCategories(catsRes.value?.categories || catsRes.value?.items || []);
      }
      if (brandsRes.status === "fulfilled") {
        setBrands(brandsRes.value?.brands || brandsRes.value?.items || []);
      }
    } catch {
      // Non-fatal lookup fallback
    }
  };

  useEffect(() => {
    fetchProduct();
    fetchLookups();
  }, [productId]);

  const handleApprove = async () => {
    if (!confirm("Are you sure you want to approve this product for catalog listing?")) {
      return;
    }
    setActionLoading(true);
    try {
      await adminCatalogService.approveProduct(productId);
      setSuccess("Product approved successfully");
      setTimeout(() => setSuccess(null), 4000);
      fetchProduct();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to approve product");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      alert("Please provide a reason for rejecting the product.");
      return;
    }
    setActionLoading(true);
    try {
      await adminCatalogService.rejectProduct(productId, rejectReason.trim());
      setShowRejectModal(false);
      setRejectReason("");
      setSuccess("Product rejected successfully");
      setTimeout(() => setSuccess(null), 4000);
      fetchProduct();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to reject product");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await adminCatalogService.deleteProduct(productId);
      router.push("/administrator/catalog/products");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete product");
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: editForm.name.trim(),
        slug: editForm.slug.trim(),
        sku: editForm.sku.trim().toUpperCase(),
        price: editForm.price,
        status: editForm.status,
        shortDescription: editForm.shortDescription.trim(),
        description: editForm.description.trim(),
        isFeatured: editForm.isFeatured,
      };

      if (editForm.compareAtPrice) {
        payload.compareAtPrice = editForm.compareAtPrice;
      }
      if (editForm.categoryId) {
        payload.categoryId = editForm.categoryId;
      }
      if (editForm.brandId) {
        payload.brandId = editForm.brandId;
      }

      await adminCatalogService.updateProduct(productId, payload);
      setSuccess("Product updated successfully");
      setShowEditDrawer(false);
      setTimeout(() => setSuccess(null), 4000);
      fetchProduct();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to update product");
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6">
        <div className="h-6 w-32 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-44 bg-slate-200 rounded-3xl animate-pulse" />
        <div className="h-64 bg-slate-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Link
          href="/administrator/catalog/products"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Products</span>
        </Link>
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3 text-sm">
          <AlertTriangle className="size-5 shrink-0" />
          <span>{error || "Product could not be found."}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          href="/administrator/catalog/products"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Product Catalog</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditDrawer(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs"
          >
            <Edit className="size-3.5" />
            <span>Edit Product</span>
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-xl transition-colors"
          >
            <Trash2 className="size-3.5" />
            <span>Delete</span>
          </button>
          <button
            onClick={fetchProduct}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="size-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle className="size-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Details Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {product?.name || product?.title}
              </h1>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  product?.status === "active"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : product?.status === "pending_approval"
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : product?.status === "rejected"
                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                    : "bg-slate-100 text-slate-700 border border-slate-200"
                }`}
              >
                {product?.status}
              </span>
            </div>
            <p className="text-xs font-mono text-slate-500 mt-1">
              SKU: {product?.sku || "N/A"} • Slug: {product?.slug}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5">
            {product?.status === "pending_approval" && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                >
                  Approve Product
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
                >
                  Reject
                </button>
              </>
            )}
          </div>
        </div>

        {product?.rejectionReason && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <span className="font-semibold">Rejection Notes: </span>
            {product.rejectionReason}
          </div>
        )}

        {/* Pricing & Categorization Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Price
            </div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">
              {formatCurrency(product?.price)}
            </div>
            {product?.compareAtPrice > product?.price && (
              <div className="text-xs text-slate-400 line-through">
                {formatCurrency(product.compareAtPrice)}
              </div>
            )}
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Vendor
            </div>
            <div className="text-sm font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5">
              <Store className="size-3.5 text-slate-400" />
              <span>{product?.vendorId?.businessName || "Direct Platform"}</span>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Category
            </div>
            <div className="text-sm font-medium text-slate-800 mt-0.5 flex items-center gap-1.5">
              <Layers className="size-3.5 text-slate-400" />
              <span>{product?.categoryId?.name || "Uncategorized"}</span>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Brand
            </div>
            <div className="text-sm font-medium text-slate-800 mt-0.5 flex items-center gap-1.5">
              <Tag className="size-3.5 text-slate-400" />
              <span>{product?.brandId?.name || "Generic"}</span>
            </div>
          </div>
        </div>

        {/* Short Description */}
        {product?.shortDescription && (
          <div className="space-y-1.5 pt-4 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Short Description
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {product.shortDescription}
            </p>
          </div>
        )}

        {/* Description */}
        <div className="space-y-2 pt-4 border-t border-slate-100">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Detailed Description
          </div>
          <div className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 whitespace-pre-line">
            {product?.description || "No description provided."}
          </div>
        </div>

        {/* Variants Table */}
        {product?.variants?.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Product Variants ({product.variants.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Variant SKU</th>
                    <th className="py-2.5 px-3">Attributes</th>
                    <th className="py-2.5 px-3">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {product.variants.map((v, i) => (
                    <tr key={i}>
                      <td className="py-2.5 px-3 font-mono">{v.sku || `Variant ${i + 1}`}</td>
                      <td className="py-2.5 px-3">
                        {v.attributes ? JSON.stringify(v.attributes) : "Default"}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {formatCurrency(v.price || product.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Edit Drawer Modal */}
      {showEditDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Edit Product</h2>
                <p className="text-xs text-slate-500">Update catalog product details and listing status</p>
              </div>
              <button
                onClick={() => setShowEditDrawer(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">SKU</label>
                  <input
                    type="text"
                    required
                    value={editForm.sku}
                    onChange={(e) => setEditForm({ ...editForm, sku: e.target.value.toUpperCase() })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-mono uppercase focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Slug</label>
                  <input
                    type="text"
                    required
                    value={editForm.slug}
                    onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-mono lowercase focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Compare-at Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.compareAtPrice}
                    onChange={(e) => setEditForm({ ...editForm, compareAtPrice: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={editForm.categoryId}
                    onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Brand</label>
                  <select
                    value={editForm.brandId}
                    onChange={(e) => setEditForm({ ...editForm, brandId: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="">Select Brand</option>
                    {brands.map((b) => (
                      <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                >
                  <option value="active">Active (Published)</option>
                  <option value="draft">Draft</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Short Description</label>
                <input
                  type="text"
                  value={editForm.shortDescription}
                  onChange={(e) => setEditForm({ ...editForm, shortDescription: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  placeholder="One sentence summary..."
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Description</label>
                <textarea
                  rows="4"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  placeholder="Comprehensive product details..."
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isFeatured"
                  checked={editForm.isFeatured}
                  onChange={(e) => setEditForm({ ...editForm, isFeatured: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="isFeatured" className="text-xs font-medium text-slate-700">
                  Featured on marketplace homepage
                </label>
              </div>

              <div className="pt-6 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowEditDrawer(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  <Save className="size-3.5" />
                  <span>{saving ? "Saving Changes..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="size-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="size-5" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-base font-bold text-slate-900">Delete Product</h2>
              <p className="text-xs text-slate-500">
                Are you sure you want to delete this product? This action cannot be undone.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold text-xs transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900">
              Reject Product Application
            </h3>
            <p className="text-xs text-slate-500">
              Specify reason why this product does not comply with marketplace catalog standards.
            </p>
            <form onSubmit={handleReject} className="space-y-4">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., Inadequate product imagery, incorrect pricing, or prohibited item category..."
                rows={4}
                required
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 resize-none"
              />
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  {actionLoading ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
