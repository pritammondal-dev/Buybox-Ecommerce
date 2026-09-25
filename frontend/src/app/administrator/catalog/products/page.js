"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  Eye,
  Trash2,
  Filter,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import apiClient from "@/lib/api/axios.js";
import { adminCatalogService } from "@/services/admin/admin.service.js";

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  // Reject Modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Delete Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProducts = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;

      const res = await apiClient.get("/products", { params });
      const data = res?.data?.data || res?.data || {};
      setProducts(data?.products || []);
      setPagination({
        page: data?.pagination?.page || page,
        total: data?.pagination?.total || 0,
        totalPages: data?.pagination?.totalPages || 1,
      });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(1);
  }, [statusFilter]);

  const handleApprove = async (productId) => {
    try {
      await adminCatalogService.approveProduct(productId);
      setSuccess("Product listing approved successfully");
      setTimeout(() => setSuccess(null), 4000);
      fetchProducts(pagination.page);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to approve product");
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!selectedProduct || !rejectReason.trim()) return;
    setSubmitting(true);
    try {
      await adminCatalogService.rejectProduct(selectedProduct._id, rejectReason.trim());
      setShowRejectModal(false);
      setSelectedProduct(null);
      setRejectReason("");
      setSuccess("Product listing rejected");
      setTimeout(() => setSuccess(null), 4000);
      fetchProducts(pagination.page);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to reject product");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    setDeleting(true);
    try {
      await adminCatalogService.deleteProduct(productToDelete._id);
      setShowDeleteModal(false);
      setProductToDelete(null);
      setSuccess("Product deleted successfully");
      setTimeout(() => setSuccess(null), 4000);
      fetchProducts(pagination.page);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete product");
    } finally {
      setDeleting(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Package className="size-6 text-emerald-600" />
            <span>Product Catalog &amp; Moderation</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review merchant product submissions, manage master catalog, and adjust product status
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500 font-semibold bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
            Products Found: <span className="text-slate-900 font-bold">{pagination.total}</span>
          </div>
          <Link
            href="/administrator/catalog/products/create"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
          >
            <Plus className="size-4" />
            <span>Create New Product</span>
          </Link>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5">
          <CheckCircle className="size-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2.5">
          <AlertTriangle className="size-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: "", label: "All Products" },
            { id: "pending_approval", label: "Pending Moderation" },
            { id: "active", label: "Active" },
            { id: "draft", label: "Draft" },
            { id: "rejected", label: "Rejected" },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === st.id
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchProducts(1)}
              placeholder="Search by SKU or title..."
              className="text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 w-48 sm:w-64"
            />
            <Search className="size-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
          <button
            onClick={() => fetchProducts(pagination.page)}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-xl transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Product</th>
                <th className="px-6 py-3.5">SKU</th>
                <th className="px-6 py-3.5">Price</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Submitted</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length > 0 ? (
                products.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <Link
                        href={`/administrator/catalog/products/${p._id}`}
                        className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline block"
                      >
                        {p.name}
                      </Link>
                      <div className="text-slate-400 text-[11px] font-mono">/{p.slug}</div>
                    </td>

                    <td className="px-6 py-4 font-mono text-[11px] text-slate-600">
                      {p.sku}
                    </td>

                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {formatCurrency(p.price)}
                    </td>

                    <td className="px-6 py-4 text-slate-600">
                      {p.categoryId?.name || "General"}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full font-semibold uppercase text-[10px] ${
                          p.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : p.status === "pending_approval"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : p.status === "rejected"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {p.status?.replace("_", " ")}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-slate-500 text-[11px]">
                      {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}
                    </td>

                    <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                      {p.status === "pending_approval" && (
                        <>
                          <button
                            onClick={() => handleApprove(p._id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs transition-colors"
                            title="Approve Listing"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setSelectedProduct(p);
                              setShowRejectModal(true);
                            }}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-semibold text-xs transition-colors"
                            title="Reject Listing"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      <Link
                        href={`/administrator/catalog/products/${p._id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium text-xs transition-colors"
                        title="View Details"
                      >
                        <Eye className="size-3.5" />
                        <span>View</span>
                      </Link>

                      <button
                        onClick={() => {
                          setProductToDelete(p);
                          setShowDeleteModal(true);
                        }}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors inline-flex items-center"
                        title="Delete Product"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-400 text-xs">
                    {loading ? "Loading products..." : "No products found matching criteria."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <div className="text-xs text-slate-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total items)
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchProducts(pagination.page - 1)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="size-4 text-slate-600" />
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchProducts(pagination.page + 1)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="size-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <h2 className="text-base font-bold text-slate-900">
              Reject Product Submission
            </h2>
            <p className="text-xs text-slate-500">
              State the reason for rejecting <strong>{selectedProduct.name}</strong>. The vendor will be notified.
            </p>

            <form onSubmit={handleReject} className="space-y-3 text-xs">
              <textarea
                required
                rows="3"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Incomplete product specifications or invalid imagery."
                className="w-full border border-slate-200 rounded-xl p-3 text-xs focus:ring-1 focus:ring-rose-500 focus:outline-none"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
                >
                  {submitting ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="size-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="size-5" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-base font-bold text-slate-900">Delete Product</h2>
              <p className="text-xs text-slate-500">
                Are you sure you want to delete <strong>{productToDelete.name}</strong>? This will remove it from the catalog.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium text-xs"
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
    </div>
  );
}
