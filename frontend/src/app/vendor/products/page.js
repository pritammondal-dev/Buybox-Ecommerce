"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Package,
  Plus,
  Search,
  Filter,
  ChevronRight,
  ExternalLink,
  Edit,
  Tag,
  Boxes,
  RefreshCw,
  UploadCloud,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";
import { getVendorProductUrl } from "@/utils/secure-id.util";

export default function VendorProductsPage() {
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const params = { page: 1, limit: 20 };
    if (status !== "all") params.status = status;
    if (search.trim()) params.search = search.trim();

    vendorService
      .getMyProducts(params)
      .then((res) => {
        if (!isMounted) return;
        const data = res?.data?.data || res?.data?.products || res?.data || [];
        const items = Array.isArray(data) ? data : data.items || [];
        const paginationMeta = res?.data?.meta || { page: 1, limit: 20, total: items.length };
        setProducts(items);
        setMeta(paginationMeta);
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err.status === 403 || err.status === 404 || err.response?.status === 403 || err.response?.status === 404) {
          setProducts([]);
          setMeta({ page: 1, limit: 20, total: 0 });
          return;
        }
        toast.error("Failed to fetch product catalog", {
          description: err.response?.data?.message || err.message,
        });
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [status, search]);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const params = { page: 1, limit: 20 };
      if (status !== "all") params.status = status;
      if (search.trim()) params.search = search.trim();

      const res = await vendorService.getMyProducts(params);
      const data = res?.data?.data || res?.data?.products || res?.data || [];
      const items = Array.isArray(data) ? data : data.items || [];
      const paginationMeta = res?.data?.meta || { page: 1, limit: 20, total: items.length };
      setProducts(items);
      setMeta(paginationMeta);
    } catch (err) {
      if (err.status === 403 || err.status === 404 || err.response?.status === 403 || err.response?.status === 404) {
        setProducts([]);
        setMeta({ page: 1, limit: 20, total: 0 });
        return;
      }
      toast.error("Failed to fetch product catalog", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (format = "csv") => {
    setIsExporting(true);
    setExportMenuOpen(false);
    try {
      const params = { format };
      if (status !== "all") params.status = status;
      if (search.trim()) params.search = search.trim();

      const res = await vendorService.exportProducts(params);
      const blob = new Blob([res.data], {
        type:
          format === "xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "text/csv;charset=utf-8;",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `vendor_products_${Date.now()}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Products exported (${format.toUpperCase()})`);
    } catch (err) {
      toast.error("Failed to export products", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Product Catalog
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Manage your marketplace listings, variants, pricing, and catalog approval statuses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
            title="Refresh product list"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
            >
              {isExporting ? (
                <RefreshCw className="size-3.5 animate-spin text-slate-500" />
              ) : (
                <Download className="size-3.5 text-slate-500" />
              )}
              <span>Export</span>
              <ChevronDown className="size-3 text-slate-400" />
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-44 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-20 text-xs">
                <button
                  onClick={() => handleExport("csv")}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                >
                  <FileText className="size-3.5 text-slate-400" />
                  <span>Export as CSV</span>
                </button>
                <button
                  onClick={() => handleExport("xlsx")}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                >
                  <FileSpreadsheet className="size-3.5 text-emerald-600" />
                  <span>Export as Excel (.xlsx)</span>
                </button>
              </div>
            )}
          </div>

          {/* Bulk Import */}
          <Link
            href="/vendor/products/import"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
          >
            <UploadCloud className="size-3.5 text-[#004D38]" />
            <span>Bulk Import</span>
          </Link>

          {/* Add New Product */}
          <Link
            href="/vendor/products/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="size-4" />
            <span>Add New Product</span>
          </Link>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title, SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-all"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: "all", label: "All" },
            { id: "active", label: "Active" },
            { id: "draft", label: "Draft" },
            { id: "pending_review", label: "Pending Review" },
            { id: "inactive", label: "Inactive" },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setStatus(s.id)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                status === s.id
                  ? "bg-[#004D38] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s.label}
            </button>
          ))}

          <button
            onClick={handleRefresh}
            className="p-1.5 ml-1 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            title="Refresh List"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="p-16 text-center">
            <Package className="size-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-800">No Products Found</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto mb-4">
              {search || status !== "all"
                ? "No listings match the current filters. Try changing your search query or status."
                : "You haven't listed any products yet. Create your first product to start selling on Buybox Marketplace."}
            </p>
            <Link
              href="/vendor/products/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] text-white text-xs font-semibold hover:bg-[#003828] transition-colors"
            >
              <Plus className="size-3.5" />
              <span>Create Product</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-3.5">Product</th>
                  <th className="px-6 py-3.5">SKU</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5">Price</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((prd) => {
                  const secureUrl = getVendorProductUrl(prd.secureId || prd._id);
                  const isListingActive = prd.status === "active";

                  return (
                    <tr key={prd._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden text-slate-400">
                            {prd.images?.[0]?.url || prd.thumbnail ? (
                              <Image
                                src={prd.images?.[0]?.url || prd.thumbnail}
                                alt={prd.name || prd.title}
                                width={40}
                                height={40}
                                className="size-full object-cover"
                                unoptimized
                              />
                            ) : (
                              <Package className="size-5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={secureUrl}
                              className="font-bold text-slate-900 hover:text-emerald-700 truncate block max-w-xs"
                            >
                              {prd.name || prd.title}
                            </Link>
                            <span className="text-[11px] text-slate-400 block truncate">
                              {prd.slug || "no-slug"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-600">
                        {prd.sku || "N/A"}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {prd.categoryId?.name || prd.category || "General"}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        ₹{Number(prd.price || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isListingActive
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : prd.status === "draft"
                              ? "bg-slate-100 text-slate-700 border border-slate-200"
                              : prd.status === "pending_review"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {prd.status || "draft"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            href={secureUrl}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="Edit Product"
                          >
                            <Edit className="size-3.5" />
                          </Link>
                          {isListingActive && prd.slug && (
                            <Link
                              href={`/products/${prd.slug}`}
                              target="_blank"
                              className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 transition-colors"
                              title="View on Storefront"
                            >
                              <ExternalLink className="size-3.5" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
