"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
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
  Upload,
  Download,
  Star,
  FileSpreadsheet,
  X,
  Check,
  Edit,
  RotateCcw,
  Layers,
  CheckSquare,
  Square,
  Send,
} from "lucide-react";
import apiClient from "@/lib/api/axios.js";
import { toast } from "sonner";
import { adminCatalogService } from "@/services/admin/admin.service.js";
import { normalizeBulkValidationReport } from "@/utils/bulk-import-normalizer.js";
import { extractProductThumbnailUrl } from "@/utils/product-image.util.js";

export { extractProductThumbnailUrl };

export function ProductThumbnail({ src, alt }) {
  const [imgError, setImgError] = useState(false);

  // Strictly guard src against objects, undefined, empty strings, whitespace
  const safeSrc = typeof src === "string" && src.trim().length > 0 ? src.trim() : null;

  if (!safeSrc || imgError) {
    return <Package className="size-5 text-slate-400" aria-label="No image available" />;
  }

  return (
    <NextImage
      src={safeSrc}
      alt={alt || "Product thumbnail"}
      width={44}
      height={44}
      className="size-full object-cover"
      unoptimized
      onError={() => setImgError(true)}
    />
  );
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Selection for bulk operations
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [bulkActionType, setBulkActionType] = useState(null);
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState(false);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkExecuting, setBulkExecuting] = useState(false);
  const [bulkReport, setBulkReport] = useState(null);
  const [showBulkReportModal, setShowBulkReportModal] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [productTypeFilter, setProductTypeFilter] = useState("all");
  const [stockStatusFilter, setStockStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  // Reject Modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Delete / Archive Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [reservationErrors, setReservationErrors] = useState(null);

  // Restore Modal
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [productToRestore, setProductToRestore] = useState(null);
  const [restoring, setRestoring] = useState(false);

  // Bulk Upload Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [validating, setValidating] = useState(false);
  const [validationReport, setValidationReport] = useState(null);
  const [committing, setCommitting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchProducts = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 20 };
      if (search.trim()) params.search = search.trim();
      if (statusFilter && statusFilter !== "all") params.status = statusFilter;
      if (statusFilter === "all") params.status = "all";
      if (productTypeFilter && productTypeFilter !== "all") params.productType = productTypeFilter;
      if (stockStatusFilter) params.stockStatus = stockStatusFilter;
      if (sortBy) params.sort = sortBy;

      const res = await apiClient.get("/products", { params });
      
      // Robustly extract items and meta from backend API response
      const items = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.data)
        ? res.data.data
        : Array.isArray(res?.data?.items)
        ? res.data.items
        : Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res)
        ? res
        : [];

      const meta = res?.meta || res?.data?.meta || res?.pagination || res?.data?.pagination || {
        page,
        total: items.length,
        totalPages: 1,
      };

      setProducts(items);
      setPagination({
        page: meta.page || page,
        total: meta.total !== undefined ? meta.total : items.length,
        totalPages: meta.totalPages || 1,
      });
      // Clear selections when products page changes
      setSelectedProductIds([]);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(1);
  }, [statusFilter, productTypeFilter, stockStatusFilter, sortBy]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchProducts(1);
  };

  const handleToggleSelect = (id) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = products.map((p) => p._id || p.id).filter(Boolean);
      setSelectedProductIds(allIds);
    } else {
      setSelectedProductIds([]);
    }
  };

  const handleApprove = async (productId) => {
    try {
      await adminCatalogService.approveProduct(productId);
      setSuccess("Product listing approved and activated successfully");
      setTimeout(() => setSuccess(null), 4000);
      fetchProducts(pagination.page);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to approve product");
    }
  };

  const handleSubmitForApproval = async (productId) => {
    try {
      await adminCatalogService.submitProduct(productId);
      setSuccess("Product listing submitted for review successfully");
      setTimeout(() => setSuccess(null), 4000);
      fetchProducts(pagination.page);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to submit product for review");
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
      setSuccess("Product listing rejected and returned to vendor");
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
    setReservationErrors(null);
    try {
      await adminCatalogService.deleteProduct(productToDelete._id || productToDelete.id);
      setShowDeleteModal(false);
      setProductToDelete(null);
      setSuccess("Product archived successfully");
      setTimeout(() => setSuccess(null), 4000);
      fetchProducts(pagination.page);
    } catch (err) {
      const errDetails = err?.response?.data?.details;
      if (Array.isArray(errDetails) && errDetails.length > 0) {
        setReservationErrors(errDetails);
      }
      setError(err?.response?.data?.message || "Failed to archive product");
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async () => {
    if (!productToRestore) return;
    setRestoring(true);
    try {
      await adminCatalogService.restoreProduct(productToRestore._id || productToRestore.id);
      setShowRestoreModal(false);
      setProductToRestore(null);
      setSuccess("Product and variants restored successfully");
      setTimeout(() => setSuccess(null), 4000);
      fetchProducts(pagination.page);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to restore product");
    } finally {
      setRestoring(false);
    }
  };

  const openBulkAction = (action) => {
    setBulkActionType(action);
    setBulkReason("");
    setShowBulkConfirmModal(true);
  };

  const handleExecuteBulkAction = async () => {
    if (!bulkActionType || selectedProductIds.length === 0) return;
    setBulkExecuting(true);
    try {
      const res = await adminCatalogService.bulkOperations({
        productIds: selectedProductIds,
        action: bulkActionType,
        reason: bulkReason.trim() || undefined,
      });

      setShowBulkConfirmModal(false);
      setBulkReport(res?.data || res);
      setShowBulkReportModal(true);
      setSelectedProductIds([]);
      fetchProducts(pagination.page);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Bulk operation failed");
      setError(err?.response?.data?.message || err?.message || "Bulk operation failed");
    } finally {
      setBulkExecuting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await adminCatalogService.downloadImportTemplate("xlsx");
      const blob = res instanceof Blob ? res : (res?.data instanceof Blob ? res.data : new Blob([res?.data || res], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }));
      if (blob.size < 1000) {
        throw new Error("Downloaded Excel template is corrupt or empty");
      }
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "buybox_product_import_template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Import template downloaded");
    } catch (err) {
      toast.error("Failed to download import template: " + (err?.response?.data?.message || err.message));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {};
      if (statusFilter && statusFilter !== "all") params.status = statusFilter;
      const res = await adminCatalogService.exportProducts(params);
      const blob = res instanceof Blob ? res : (res?.data instanceof Blob ? res.data : new Blob([res?.data || res]));
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `products_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Product catalog exported successfully");
      setSuccess("Product catalog exported successfully");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      toast.error("Failed to export products: " + (err?.response?.data?.message || err.message));
      setError("Failed to export products: " + (err?.response?.data?.message || err.message));
    } finally {
      setExporting(false);
    }
  };

  const handleValidateBulk = async (e) => {
    e.preventDefault();
    if (!bulkFile) {
      toast.error("Please select an Excel or CSV file to validate.");
      return;
    }
    setValidating(true);
    setValidationReport(null);
    try {
      const formData = new FormData();
      formData.append("file", bulkFile);
      const report = await adminCatalogService.validateBulkImport(formData);
      const normalized = normalizeBulkValidationReport(report);
      setValidationReport(normalized);
      if (normalized.validCount > 0) {
        toast.success(`Validated: ${normalized.validCount} valid row(s) ready`);
      } else {
        toast.error(`Validation found ${normalized.errorCount} row(s) with errors`);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Validation failed");
    } finally {
      setValidating(false);
    }
  };

  const handleCommitBulk = async () => {
    if (!validationReport?.validRows?.length) {
      toast.error("No valid rows available to import.");
      return;
    }
    setCommitting(true);
    try {
      await adminCatalogService.commitBulkImport(validationReport.validRows);
      setShowBulkModal(false);
      setBulkFile(null);
      setValidationReport(null);
      toast.success("Bulk products imported successfully!");
      setSuccess("Bulk products imported successfully!");
      setTimeout(() => setSuccess(null), 5000);
      fetchProducts(1);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to commit import");
    } finally {
      setCommitting(false);
    }
  };

  const formatCurrency = (val) => {
    const num = typeof val === "object" && val?.$numberDecimal ? Number(val.$numberDecimal) : Number(val) || 0;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Package className="size-6 text-[#004D38]" />
            <span>Product Catalog &amp; Master Management</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review vendor listings, moderate submissions, inspect stock, and manage platform products
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="text-xs text-slate-500 font-semibold bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
            Products Found: <span className="text-slate-900 font-bold">{pagination.total}</span>
          </div>

          <button
            onClick={() => setShowBulkModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors"
          >
            <Upload className="size-3.5 text-[#004D38]" />
            <span>Bulk Upload</span>
          </button>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors disabled:opacity-50"
          >
            <Download className="size-3.5 text-blue-600" />
            <span>{exporting ? "Exporting..." : "Export"}</span>
          </button>

          <button
            onClick={() => fetchProducts(pagination.page)}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-xl transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <Link
            href="/administrator/catalog/products/create"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
          >
            <Plus className="size-4" />
            <span>Add Product</span>
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

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: "all", label: "All Products" },
              { id: "active", label: "Active" },
              { id: "pending_approval", label: "Pending Moderation" },
              { id: "draft", label: "Draft" },
              { id: "rejected", label: "Rejected" },
              { id: "inactive", label: "Inactive" },
              { id: "archived", label: "Archived / Deleted" },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  statusFilter === st.id
                    ? "bg-[#004D38] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-xs">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by SKU, title, slug..."
              className="text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38] w-full"
            />
            <Search className="size-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </form>
        </div>

        {/* Secondary Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Type:</span>
            <select
              value={productTypeFilter}
              onChange={(e) => setProductTypeFilter(e.target.value)}
              className="py-1 px-2.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="simple">Simple</option>
              <option value="variable">Variable</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Stock:</span>
            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value)}
              className="py-1 px-2.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
            >
              <option value="">All Stock</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="py-1 px-2.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
              <option value="popularity">Most Popular / Reviewed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={products.length > 0 && selectedProductIds.length === products.length}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-[#004D38] focus:ring-[#004D38] size-4 cursor-pointer"
                    aria-label="Select all products on page"
                  />
                </th>
                <th className="px-5 py-3.5">Product</th>
                <th className="px-5 py-3.5">Type &amp; SKU</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Brand</th>
                <th className="px-5 py-3.5">Vendor</th>
                <th className="px-5 py-3.5">Price</th>
                <th className="px-5 py-3.5">Stock</th>
                <th className="px-5 py-3.5">Rating</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length > 0 ? (
                products.map((p) => {
                  const pId = p._id || p.id;
                  const categoryName = p.categoryId?.name || p.category?.name || "General";
                  const brandName = p.brandId?.name || p.brand?.name || "—";
                  const vendorName = p.vendorId?.businessName || p.vendorId?.name || p.vendor?.businessName || "Platform";
                  const imageUrl = extractProductThumbnailUrl(p);
                  const priceVal = p.price;
                  const isSelected = selectedProductIds.includes(pId);
                  const isArchived = Boolean(p.deletedAt || p.status === "archived");

                  return (
                    <tr key={pId} className={`transition-colors ${isSelected ? "bg-emerald-50/40" : "hover:bg-slate-50/60"}`}>
                      {/* Checkbox */}
                      <td className="px-3 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(pId)}
                          className="rounded border-slate-300 text-[#004D38] focus:ring-[#004D38] size-4 cursor-pointer"
                          aria-label={`Select ${p.name}`}
                        />
                      </td>

                      {/* Product Image & Title */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3 max-w-xs">
                          <div className="size-11 rounded-xl bg-slate-100 border border-slate-200/80 overflow-hidden shrink-0 flex items-center justify-center">
                            <ProductThumbnail src={imageUrl} alt={p.name} />
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/administrator/catalog/products/${pId}`}
                              className="font-semibold text-slate-900 hover:text-[#004D38] truncate block"
                              title={p.name}
                            >
                              {p.name}
                            </Link>
                            <div className="text-slate-400 text-[11px] truncate">
                              /{p.slug}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Type & SKU */}
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                              p.productType === "variable"
                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {p.productType === "variable" ? "Variable" : "Simple"}
                          </span>
                          <div className="font-mono text-[11px] text-slate-600 font-semibold truncate max-w-[130px]">
                            {p.sku}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-5 py-3.5 text-slate-700">
                        {categoryName}
                      </td>

                      {/* Brand */}
                      <td className="px-5 py-3.5 text-slate-600">
                        {brandName}
                      </td>

                      {/* Vendor */}
                      <td className="px-5 py-3.5 text-slate-700 font-medium">
                        {vendorName}
                      </td>

                      {/* Price */}
                      <td className="px-5 py-3.5 font-bold text-slate-900">
                        {p.productType === "variable" && p.priceRange ? (
                          <div>
                            <div>
                              {formatCurrency(p.priceRange.min)}
                              {p.priceRange.max > p.priceRange.min && ` – ${formatCurrency(p.priceRange.max)}`}
                            </div>
                            <div className="text-[10px] text-slate-400 font-normal">
                              {p.variantCount !== undefined ? `${p.variantCount} variants` : "Variable"}
                            </div>
                          </div>
                        ) : (
                          <div>{formatCurrency(priceVal)}</div>
                        )}
                      </td>

                      {/* Stock */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            p.stockStatus === "in_stock" || (p.stockQuantity > 5)
                              ? "bg-emerald-50 text-emerald-700"
                              : p.stockStatus === "low_stock" || (p.stockQuantity > 0 && p.stockQuantity <= 5)
                              ? "bg-amber-50 text-amber-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {p.stockStatus ? p.stockStatus.replace("_", " ") : `${p.stockQuantity || 0} in stock`}
                        </span>
                      </td>

                      {/* Rating */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 text-slate-700 font-semibold">
                          <Star className="size-3 text-amber-400 fill-amber-400" />
                          <span>{p.ratingAverage || 0}</span>
                          <span className="text-slate-400 font-normal text-[10px]">
                            ({p.ratingCount || 0})
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-semibold uppercase text-[10px] ${
                            isArchived
                              ? "bg-rose-100 text-rose-800 border border-rose-300"
                              : p.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : p.status === "pending_approval"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : p.status === "rejected"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {isArchived ? "Archived" : (p.status ? p.status.replace("_", " ") : "draft")}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(p.status === "draft" || p.status === "rejected") && !isArchived && (
                            <button
                              onClick={() => handleSubmitForApproval(pId)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Submit for Approval"
                            >
                              <Send className="size-4" />
                            </button>
                          )}

                          {p.status === "pending_approval" && !isArchived && (
                            <>
                              <button
                                onClick={() => handleApprove(pId)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Approve Listing"
                              >
                                <Check className="size-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedProduct(p);
                                  setShowRejectModal(true);
                                }}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Reject Listing"
                              >
                                <X className="size-4" />
                              </button>
                            </>
                          )}

                          {isArchived ? (
                            <button
                              onClick={() => {
                                setProductToRestore(p);
                                setShowRestoreModal(true);
                              }}
                              className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Restore Product"
                            >
                              <RotateCcw className="size-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setProductToDelete(p);
                                setReservationErrors(null);
                                setShowDeleteModal(true);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Archive Product"
                              aria-label={`Archive ${p.name}`}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}

                          <Link
                            href={`/administrator/catalog/products/${pId}`}
                            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Inspect Product"
                            aria-label={`Inspect ${p.name}`}
                            data-testid="product-inspect-button"
                          >
                            <Eye className="size-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="11" className="text-center py-12 text-slate-400 text-xs">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="size-4 animate-spin text-[#004D38]" />
                        <span>Loading product catalog...</span>
                      </div>
                    ) : (
                      "No products found matching the criteria."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} products)
            </span>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1 || loading}
                onClick={() => fetchProducts(pagination.page - 1)}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-40 font-semibold"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => fetchProducts(pagination.page + 1)}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-40 font-semibold"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Reject Product Listing</h3>
              <button
                onClick={() => setShowRejectModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleReject} className="space-y-4 text-xs">
              <p className="text-slate-600">
                Please provide a rejection reason for <strong>{selectedProduct?.name}</strong>. This feedback will be sent to the merchant.
              </p>
              <textarea
                required
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection (e.g. Inappropriate images, inaccurate SKU or pricing, incomplete specifications)..."
                className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500"
              />

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs disabled:opacity-50"
                >
                  {submitting ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base text-rose-600">Archive Product</h3>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setReservationErrors(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to archive <strong>{productToDelete?.name}</strong> ({productToDelete?.sku})?
              The product and all child variants will be hidden from the active storefront. Historical orders, receipts, and financial ledger entries remain strictly preserved.
            </p>

            {reservationErrors && reservationErrors.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-2 text-xs">
                <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                  <span>Active Reservations Blocking Archival ({reservationErrors.length})</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  The following variants have customer reservations. Outstanding order commitments must be fulfilled or cancelled first:
                </p>
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {reservationErrors.map((r, idx) => (
                    <div key={idx} className="bg-white p-2.5 rounded-xl border border-amber-200/80 text-[11px] text-slate-700">
                      <div className="flex items-center justify-between font-mono font-bold text-slate-900">
                        <span>{r.sku}</span>
                        <span className="text-amber-700 font-semibold">{r.reservedQuantity} reserved</span>
                      </div>
                      <div className="text-slate-500 text-[10px]">
                        Warehouse: {r.warehouseName} {r.warehouseCode ? `(${r.warehouseCode})` : ""}
                      </div>
                      <div className="text-slate-400 text-[10px] mt-0.5">{r.resolution}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 text-xs">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setReservationErrors(null);
                }}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || (reservationErrors && reservationErrors.length > 0)}
                className="px-5 py-2 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs disabled:opacity-50"
              >
                {deleting ? "Archiving..." : "Archive Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-[#004D38] rounded-xl">
                  <FileSpreadsheet className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Bulk Product Import</h3>
                  <p className="text-xs text-slate-500">Upload products via XLSX spreadsheet with validation</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowBulkModal(false);
                  setValidationReport(null);
                  setBulkFile(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Template Download Step */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <div className="font-bold text-slate-800">Need the official import template?</div>
                <div className="text-slate-500 mt-0.5">Use the standardized template with preconfigured columns</div>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-[#004D38] font-semibold rounded-xl hover:bg-slate-100 shadow-xs"
              >
                <Download className="size-3.5" />
                <span>Download Template</span>
              </button>
            </div>

            {/* Upload & Validate Form */}
            <form onSubmit={handleValidateBulk} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Select Spreadsheet (.xlsx, .csv)
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  required
                  onChange={(e) => {
                    setBulkFile(e.target.files?.[0] || null);
                    setValidationReport(null);
                  }}
                  className="w-full p-2 border border-slate-200 rounded-xl bg-white text-xs file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-[#004D38]"
                />
              </div>

              {!validationReport && (
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={validating || !bulkFile}
                    className="px-5 py-2 font-semibold text-white bg-[#004D38] hover:bg-[#003828] rounded-xl shadow-xs transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {validating && <RefreshCw className="size-3.5 animate-spin" />}
                    <span>{validating ? "Validating Spreadsheet..." : "Validate File"}</span>
                  </button>
                </div>
              )}
            </form>

            {/* Validation Report & Commit Step */}
            {validationReport && (
              <div className="space-y-4 pt-3 border-t border-slate-100 text-xs">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                    <div className="text-slate-400 font-medium">Total Rows</div>
                    <div className="text-lg font-bold text-slate-900 mt-1">
                      {validationReport.totalRows}
                    </div>
                  </div>

                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-center">
                    <div className="text-emerald-700 font-medium">Valid Rows</div>
                    <div className="text-lg font-bold text-emerald-800 mt-1">
                      {validationReport.validCount}
                    </div>
                  </div>

                  <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-center">
                    <div className="text-rose-700 font-medium">Invalid Rows</div>
                    <div className="text-lg font-bold text-rose-800 mt-1">
                      {validationReport.errorCount}
                    </div>
                  </div>
                </div>

                {/* Breakdown summary if valid items present */}
                {validationReport.validCount > 0 && (
                  <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3 text-[11px] text-emerald-900 flex items-center justify-between">
                    <span>Ready to import: <strong>{validationReport.validCount}</strong> valid row(s)</span>
                    {(validationReport.newProductsCount > 0 || validationReport.updateCount > 0) && (
                      <span className="text-emerald-700">
                        ({validationReport.newProductsCount} new product(s), {validationReport.updateCount} update(s))
                      </span>
                    )}
                  </div>
                )}

                {/* Errors Table if any */}
                {validationReport.detailedErrors.length > 0 ? (
                  <div className="space-y-2">
                    <div className="font-bold text-rose-700 flex items-center justify-between">
                      <span>Row Errors ({validationReport.detailedErrors.length}):</span>
                      <span className="text-[10px] font-normal text-rose-600">Please review issues before importing</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto border border-rose-200 rounded-xl bg-rose-50/30 p-2.5 text-[11px] space-y-1.5 divide-y divide-rose-100/80">
                      {validationReport.detailedErrors.map((err, idx) => (
                        <div key={idx} className="text-rose-900 flex items-start gap-1.5 pt-1.5 first:pt-0">
                          <span className="font-semibold text-rose-700 shrink-0 bg-rose-100/80 px-1.5 py-0.5 rounded text-[10px]">
                            Row {err.rowNumber}:
                          </span>
                          <div className="min-w-0 flex-1">
                            {err.field && (
                              <span className="font-semibold text-slate-800 mr-1">
                                [{err.field}]
                              </span>
                            )}
                            <span>{err.message}</span>
                            {err.sku && <span className="text-slate-500 text-[10px] ml-1 font-mono">(SKU: {err.sku})</span>}
                            {err.suggestedAction && (
                              <p className="text-slate-500 text-[10px] mt-0.5 italic">
                                Action: {err.suggestedAction}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : validationReport.validCount > 0 ? (
                  <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] flex items-center gap-2">
                    <CheckCircle className="size-4 text-emerald-600 shrink-0" />
                    <span>All {validationReport.validCount} rows passed schema and reference validation with zero errors.</span>
                  </div>
                ) : null}

                {/* Commit Action */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setValidationReport(null);
                      setBulkFile(null);
                    }}
                    className="font-semibold text-slate-600 hover:underline"
                  >
                    Reset &amp; Upload Another File
                  </button>

                  <button
                    type="button"
                    onClick={handleCommitBulk}
                    disabled={committing || validationReport.validCount === 0 || validationReport.validRows.length === 0}
                    className="px-6 py-2.5 font-bold text-white bg-[#004D38] hover:bg-[#003828] rounded-xl shadow-xs transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {committing && <RefreshCw className="size-4 animate-spin" />}
                    <span>
                      {committing
                        ? "Importing Products..."
                        : `Commit Import (${validationReport.validCount} Products)`}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Bulk Operations Toolbar */}
      {selectedProductIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-4 text-xs animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 border-r border-slate-700 pr-3">
            <CheckSquare className="size-4 text-emerald-400" />
            <span className="font-bold">{selectedProductIds.length}</span>
            <span className="text-slate-300">selected</span>
          </div>

          {(() => {
            const selectedItems = products.filter((p) => selectedProductIds.includes(p._id || p.id));
            const countDraft = selectedItems.filter((p) => p.status === "draft" || p.status === "rejected").length;
            const countPending = selectedItems.filter((p) => p.status === "pending_approval").length;
            const canApprove = countPending > 0 && countDraft === 0;
            const canSubmit = countDraft > 0;

            return (
              <div className="flex items-center gap-1.5 flex-wrap">
                {canSubmit && (
                  <button
                    onClick={() => openBulkAction("submit")}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition-colors flex items-center gap-1 text-white shadow-xs"
                    title={`Submit ${countDraft} draft/rejected item(s) for moderation`}
                  >
                    <Send className="size-3.5" />
                    <span>Submit for Review ({countDraft})</span>
                  </button>
                )}

                <button
                  onClick={() => openBulkAction("approve")}
                  disabled={!canApprove}
                  className={`px-3 py-1.5 rounded-xl font-semibold transition-colors flex items-center gap-1 text-white shadow-xs ${
                    canApprove
                      ? "bg-emerald-600 hover:bg-emerald-500 cursor-pointer"
                      : "bg-slate-700/60 text-slate-400 cursor-not-allowed border border-slate-600"
                  }`}
                  title={
                    countDraft > 0
                      ? "Draft products must be submitted for review before approval"
                      : "Approve pending listings"
                  }
                >
                  <Check className="size-3.5" />
                  <span>Approve{countPending > 0 ? ` (${countPending})` : ""}</span>
                </button>

                <button
                  onClick={() => openBulkAction("reject")}
                  disabled={countPending === 0}
                  className={`px-3 py-1.5 rounded-xl font-semibold transition-colors flex items-center gap-1 text-white shadow-xs ${
                    countPending > 0
                      ? "bg-rose-600 hover:bg-rose-500 cursor-pointer"
                      : "bg-slate-700/60 text-slate-400 cursor-not-allowed border border-slate-600"
                  }`}
                  title="Reject pending listings with reason"
                >
                  <X className="size-3.5" />
                  <span>Reject</span>
                </button>

                <button
                  onClick={() => openBulkAction("activate")}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold transition-colors text-white"
                  title="Direct administrative activation"
                >
                  Activate
                </button>
                <button
                  onClick={() => openBulkAction("deactivate")}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold transition-colors text-white"
                >
                  Deactivate
                </button>
                <button
                  onClick={() => openBulkAction("delete")}
                  className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-200 rounded-xl font-semibold transition-colors flex items-center gap-1"
                >
                  <Trash2 className="size-3.5" />
                  <span>Delete</span>
                </button>
                <button
                  onClick={() => openBulkAction("restore")}
                  className="px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700 text-emerald-200 rounded-xl font-semibold transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Restore</span>
                </button>
              </div>
            );
          })()}

          <button
            onClick={() => setSelectedProductIds([])}
            className="text-slate-400 hover:text-white p-1 ml-1"
            title="Clear Selection"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Bulk Action Confirm Modal */}
      {showBulkConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base capitalize">
                Confirm Bulk {bulkActionType}
              </h3>
              <button
                onClick={() => setShowBulkConfirmModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            <p className="text-slate-600">
              Are you sure you want to <strong>{bulkActionType}</strong>{" "}
              <strong>{selectedProductIds.length}</strong> selected product(s)?
              This operation processes each product independently and reports per-item results.
            </p>

            {bulkActionType === "reject" && (
              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">Rejection Reason</label>
                <textarea
                  required
                  rows={3}
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  placeholder="Reason for rejecting these products..."
                  className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowBulkConfirmModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkAction}
                disabled={bulkExecuting || (bulkActionType === "reject" && !bulkReason.trim())}
                className="px-5 py-2 font-semibold text-white bg-[#004D38] hover:bg-[#003828] rounded-xl shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {bulkExecuting && <RefreshCw className="size-3.5 animate-spin" />}
                <span>{bulkExecuting ? "Processing..." : `Confirm ${bulkActionType}`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Results Report Modal */}
      {showBulkReportModal && bulkReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-100 text-xs max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Bulk Operation Results</h3>
              <button
                onClick={() => setShowBulkReportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 py-2">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <div className="text-slate-500 text-[10px] uppercase font-semibold">Total</div>
                <div className="text-lg font-bold text-slate-900 mt-0.5">{bulkReport.summary?.total ?? bulkReport.total ?? 0}</div>
              </div>
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-center">
                <div className="text-emerald-700 text-[10px] uppercase font-semibold">Succeeded</div>
                <div className="text-lg font-bold text-emerald-800 mt-0.5">{bulkReport.summary?.succeeded ?? bulkReport.succeeded ?? 0}</div>
              </div>
              <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-center">
                <div className="text-rose-700 text-[10px] uppercase font-semibold">Failed</div>
                <div className="text-lg font-bold text-rose-800 mt-0.5">{bulkReport.summary?.failed ?? bulkReport.failed ?? 0}</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 border border-slate-100 rounded-xl p-3 bg-slate-50/50">
              <div className="font-semibold text-slate-700 mb-1">Per-Item Status:</div>
              {bulkReport.results?.map((res, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-lg border text-[11px] flex items-start justify-between gap-2 ${
                    res.success
                      ? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
                      : "bg-rose-50/60 border-rose-200 text-rose-900"
                  }`}
                >
                  <div>
                    <span className="font-mono font-bold">{res.id || res.productId || (res.sku ? `SKU: ${res.sku}` : `Item #${i + 1}`)}</span>
                    {res.message && <p className="text-slate-600 mt-0.5 text-[10px]">{res.message}</p>}
                    {res.error && <p className="text-rose-700 mt-0.5 text-[10px]">{res.error}</p>}
                  </div>
                  <span
                    className={`font-semibold shrink-0 uppercase text-[9px] px-2 py-0.5 rounded-full ${
                      res.success ? "bg-emerald-200/60 text-emerald-800" : "bg-rose-200/60 text-rose-800"
                    }`}
                  >
                    {res.success ? "Success" : "Failed"}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end border-t border-slate-100 pt-3">
              <button
                onClick={() => setShowBulkReportModal(false)}
                className="px-5 py-2 font-bold text-white bg-[#004D38] hover:bg-[#003828] rounded-xl shadow-xs"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base text-emerald-700 flex items-center gap-2">
                <RotateCcw className="size-4" />
                <span>Restore Product</span>
              </h3>
              <button
                onClick={() => setShowRestoreModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            <p className="text-slate-600">
              Are you sure you want to restore <strong>{productToRestore?.name}</strong> ({productToRestore?.sku})?
              This will re-verify SKU availability, restore the product and its associated variants to draft status.
            </p>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowRestoreModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestore}
                disabled={restoring}
                className="px-5 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {restoring && <RefreshCw className="size-3.5 animate-spin" />}
                <span>{restoring ? "Restoring..." : "Confirm Restore"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
