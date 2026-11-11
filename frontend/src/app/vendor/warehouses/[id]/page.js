"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Warehouse,
  Boxes,
  MapPin,
  Phone,
  Mail,
  User,
  Clock,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Search,
  X,
  RotateCcw,
  Package,
  Layers,
  Filter,
  ArrowUpDown,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";
import { getVendorProductUrl } from "@/utils/secure-id.util";
import {
  VendorBreadcrumbs,
  VendorKpiCard,
  VendorStatusBadge,
  VendorEmptyState,
  VendorTablePagination,
} from "@/components/vendor";

export default function VendorWarehouseDetailPage() {
  const params = useParams();
  const warehouseId = params?.id;

  const [warehouse, setWarehouse] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Filter & Pagination States
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOption, setSortOption] = useState("updatedAt:desc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Parse sort option
  const [sortBy, sortOrder] = sortOption.split(":");

  // Main fetch function
  const fetchWarehouseData = useCallback(
    async (isInitial = false) => {
      if (!warehouseId) return;

      if (isInitial) {
        setIsLoading(true);
      } else {
        setIsTableLoading(true);
      }

      try {
        const queryParams = {
          search: debouncedSearch || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          sortBy: sortBy || "updatedAt",
          sortOrder: sortOrder || "desc",
          page,
          limit,
        };

        const res = await vendorService.getMyWarehouseById(warehouseId, queryParams);
        const data = res?.data?.data || res?.data?.warehouse || res?.data;

        if (data) {
          setWarehouse(data);
          if (data.meta) {
            setMeta(data.meta);
          } else if (data.items) {
            setMeta({
              page,
              limit,
              total: data.items.length,
              totalPages: Math.ceil(data.items.length / limit) || 1,
            });
          }
        }
      } catch (err) {
        toast.error("Failed to load warehouse details", {
          description: err.response?.data?.message || err.message,
        });
      } finally {
        if (isInitial) {
          setIsLoading(false);
        } else {
          setIsTableLoading(false);
        }
      }
    },
    [warehouseId, debouncedSearch, statusFilter, sortBy, sortOrder, page, limit]
  );

  // Trigger initial fetch on warehouseId change
  useEffect(() => {
    fetchWarehouseData(true);
  }, [warehouseId]);

  // Trigger table fetch on query param changes
  useEffect(() => {
    if (!isLoading && warehouse) {
      fetchWarehouseData(false);
    }
  }, [debouncedSearch, statusFilter, sortBy, sortOrder, page, limit]);

  // Copy warehouse ID to clipboard
  const handleCopyId = async () => {
    const idToCopy = warehouse?.secureId || warehouse?._id || warehouseId;
    if (!idToCopy) return;

    try {
      await navigator.clipboard.writeText(idToCopy);
      setCopiedId(true);
      toast.success("Warehouse ID copied to clipboard");
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      toast.error("Failed to copy ID");
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setSortOption("updatedAt:desc");
    setPage(1);
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Breadcrumb skeleton */}
        <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />

        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-8 w-80 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
        </div>

        {/* Facility Address card skeleton */}
        <div className="h-44 bg-slate-200 rounded-3xl animate-pulse" />

        {/* KPI Cards skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-3xl animate-pulse" />
          ))}
        </div>

        {/* Table skeleton */}
        <div className="h-96 bg-slate-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  // Not found state
  if (!warehouse) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs">
        <div className="size-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="size-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 tracking-tight">
          Fulfillment Center Not Found
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 mt-1.5 mb-6 max-w-md mx-auto">
          The requested fulfillment center could not be found or you do not have permission to access it.
        </p>
        <Link
          href="/vendor/warehouses"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-xs transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Fulfillment Centers</span>
        </Link>
      </div>
    );
  }

  const address = warehouse.address || {};
  const overview = warehouse.overview || {
    totalSkus: 0,
    totalOnHandUnits: 0,
    availableStock: 0,
    reservedStock: 0,
    lowStockSkus: 0,
  };
  const items = warehouse.items || warehouse.stockItems || [];
  const displayId = warehouse.secureId || warehouse._id || warehouseId;
  const shortId =
    displayId.length > 16
      ? `${displayId.slice(0, 8)}...${displayId.slice(-6)}`
      : displayId;

  const hasAnyStockAtWarehouse = (overview.totalSkus || 0) > 0 || (overview.totalOnHandUnits || 0) > 0;
  const isFiltered = Boolean(debouncedSearch || statusFilter !== "all");

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* SECTION A — WAREHOUSE IDENTITY HEADER */}
      <div className="space-y-3 pb-4 border-b border-slate-200/90">
        <VendorBreadcrumbs
          items={[
            { label: "Dashboard", href: "/vendor/dashboard" },
            { label: "Fulfillment Centers", href: "/vendor/warehouses" },
            { label: warehouse.name || "Warehouse Details" },
          ]}
        />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {warehouse.name}
              </h1>

              {warehouse.code && (
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                  {warehouse.code}
                </span>
              )}

              <VendorStatusBadge
                status={warehouse.status || (warehouse.isActive ? "active" : "inactive")}
                label={warehouse.isActive ? "Active" : "Inactive"}
                size="md"
              />

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
                <Building2 className="size-3.5 text-emerald-700" />
                <span>{warehouse.type || warehouse.warehouseType || "Regional Fulfillment Center"}</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-1.5 font-mono">
                <span>Facility ID:</span>
                <span className="font-semibold text-slate-700">{shortId}</span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  title="Copy Facility ID"
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  {copiedId ? (
                    <Check className="size-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </div>

              {warehouse.description && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-600">{warehouse.description}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-center">
            <Link
              href="/vendor/warehouses"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Fulfillment Centers</span>
            </Link>

            <button
              type="button"
              onClick={() => fetchWarehouseData(false)}
              disabled={isTableLoading}
              title="Refresh warehouse stock data"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              <RotateCcw className={`size-3.5 ${isTableLoading ? "animate-spin text-emerald-700" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION B — FACILITY ADDRESS & OPERATIONAL DETAILS */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        {/* Left Column: Physical Facility Location */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <MapPin className="size-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Physical Facility Address
            </h3>
          </div>

          <div className="pl-9 space-y-1 text-xs text-slate-700 leading-relaxed">
            <p className="font-semibold text-slate-900">
              {address.addressLine1 || "Address Line 1 not provided"}
            </p>
            {address.addressLine2 && <p>{address.addressLine2}</p>}
            <p>
              {[address.city, address.state, address.postalCode].filter(Boolean).join(", ") ||
                "City & State not provided"}
            </p>
            <p className="text-slate-500 font-medium">
              {address.country === "IN" || !address.country ? "India" : address.country}
            </p>
          </div>
        </div>

        {/* Right Column: Facility Operations & Contact Details */}
        <div className="space-y-3 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 lg:pl-8">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <User className="size-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Facility Management & Logistics
            </h3>
          </div>

          <div className="pl-9 grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
            <div>
              <span className="text-[11px] text-slate-400 block">Facility Manager</span>
              <span className="font-semibold text-slate-800">
                {warehouse.contactPerson || "Not provided"}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block">Operating Hours</span>
              <div className="flex items-center gap-1 text-slate-800 font-medium">
                <Clock className="size-3 text-slate-400" />
                <span>
                  {warehouse.operatingHours || "Mon – Sat (9:00 AM – 6:00 PM)"}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block">Contact Phone</span>
              <div className="flex items-center gap-1 text-slate-800 font-medium">
                <Phone className="size-3 text-slate-400" />
                <span>{warehouse.contactPhone || "Not provided"}</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block">Contact Email</span>
              <div className="flex items-center gap-1 text-slate-800 font-medium">
                <Mail className="size-3 text-slate-400" />
                <span className="truncate">{warehouse.contactEmail || "Not provided"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION C — WAREHOUSE OVERVIEW CARDS */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Your Inventory Overview</h3>
            <p className="text-xs text-slate-500">
              Authorized live stock aggregated specifically for your merchant account at this facility.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <VendorKpiCard
            title="Total SKUs"
            value={overview.totalSkus ?? 0}
            subtitle="Catalog variants stored"
            icon={Boxes}
            variant="indigo"
          />

          <VendorKpiCard
            title="Total On-Hand"
            value={(overview.totalOnHandUnits ?? overview.onHandUnits ?? 0).toLocaleString()}
            subtitle="Gross physical units"
            icon={Warehouse}
            variant="emerald"
          />

          <VendorKpiCard
            title="Available Stock"
            value={(overview.availableStock ?? 0).toLocaleString()}
            subtitle="Ready to fulfill orders"
            icon={CheckCircle2}
            variant="teal"
          />

          <VendorKpiCard
            title="Reserved Stock"
            value={(overview.reservedStock ?? 0).toLocaleString()}
            subtitle="Committed to orders"
            icon={Clock}
            variant="amber"
          />

          <VendorKpiCard
            title="Low-Stock SKUs"
            value={overview.lowStockSkus ?? 0}
            subtitle="At or below threshold"
            icon={AlertTriangle}
            variant={overview.lowStockSkus > 0 ? "rose" : "slate"}
          />
        </div>
      </div>

      {/* SECTION D & E — STORED PRODUCT VARIANTS TABLE & EMPTY STATES */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Header & Controls Bar */}
        <div className="p-5 sm:p-6 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Stored Product Variants</h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                {meta.total} {meta.total === 1 ? "variant" : "variants"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live units available at this regional facility partitioned to your account
            </p>
          </div>

          {/* Filter, Sort & Search Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Bar */}
            <div className="relative min-w-[200px] sm:min-w-[240px]">
              <Search className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search SKU or product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all text-slate-900"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="size-3.5 text-slate-400 hidden sm:inline" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="py-2 px-3 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="all">All Stock Levels</option>
                <option value="in_stock">In Stock</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="size-3.5 text-slate-400 hidden sm:inline" />
              <select
                value={sortOption}
                onChange={(e) => {
                  setSortOption(e.target.value);
                  setPage(1);
                }}
                className="py-2 px-3 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="updatedAt:desc">Recently Updated</option>
                <option value="available:desc">Highest Available Stock</option>
                <option value="available:asc">Lowest Available Stock</option>
                <option value="productName:asc">Product Name (A-Z)</option>
                <option value="variantSku:asc">Variant SKU (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Table or Empty States */}
        {!hasAnyStockAtWarehouse && !isFiltered ? (
          /* SECTION E1: Professional Zero-Stock Facility Empty State */
          <div className="p-12 sm:p-16 text-center">
            <div className="size-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <Warehouse className="size-8 text-slate-400" />
            </div>
            <h4 className="text-base font-bold text-slate-900 tracking-tight">
              No inventory recorded at this fulfillment center.
            </h4>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
              Products assigned to this warehouse will appear here once inventory is received or allocated.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
              <Link
                href="/vendor/inventory"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-bold shadow-xs transition-colors"
              >
                <Boxes className="size-3.5" />
                <span>Manage Inventory</span>
              </Link>
              <Link
                href="/vendor/products"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
              >
                <Package className="size-3.5" />
                <span>View Products</span>
              </Link>
            </div>
          </div>
        ) : items.length === 0 ? (
          /* SECTION E2: Filter / Search Empty State */
          <div className="p-12 sm:p-16 text-center">
            <div className="size-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <Search className="size-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">
              No product variants match your filter criteria
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              We couldn&apos;t find any inventory items matching your search or selected stock status.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
            >
              <RotateCcw className="size-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        ) : (
          /* SECTION D: Data Table */
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/90 text-slate-600 font-semibold border-b border-slate-200/80 select-none">
                  <tr>
                    <th className="px-6 py-3.5">Product</th>
                    <th className="px-6 py-3.5">Variant &amp; Attributes</th>
                    <th className="px-6 py-3.5 text-center">On Hand</th>
                    <th className="px-6 py-3.5 text-center">Reserved</th>
                    <th className="px-6 py-3.5 text-center">Available</th>
                    <th className="px-6 py-3.5 text-center">Status</th>
                    <th className="px-6 py-3.5 text-right">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => {
                    const productLink = item.productId
                      ? getVendorProductUrl(item.productSecureId || item.productId)
                      : "#";

                    const isOut = item.available === 0 || item.stockStatus === "out_of_stock";
                    const isLow = !isOut && (item.isLowStock || item.stockStatus === "low_stock");

                    return (
                      <tr
                        key={item._id || item.variantSku}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        {/* Product Thumbnail & Name */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-11 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0 overflow-hidden text-slate-400">
                              {item.productImage ? (
                                <Image
                                  src={item.productImage}
                                  alt={item.productName || item.productTitle}
                                  width={44}
                                  height={44}
                                  className="size-full object-cover"
                                  unoptimized
                                />
                              ) : (
                                <Package className="size-5 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0 max-w-xs">
                              <Link
                                href={productLink}
                                className="font-bold text-slate-900 hover:text-emerald-700 transition-colors truncate block group"
                              >
                                <span className="group-hover:underline">
                                  {item.productName || item.productTitle}
                                </span>
                              </Link>
                              <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                                SKU: {item.productSku || "N/A"}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Variant Name & SKU */}
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-800">
                            {item.variantName || "Standard"}
                          </div>
                          <div className="text-[11px] font-mono font-medium text-slate-500 mt-0.5">
                            {item.variantSku || item.sku || "N/A"}
                          </div>
                        </td>

                        {/* On Hand */}
                        <td className="px-6 py-4 text-center font-bold text-slate-900">
                          {Number(item.onHand || 0).toLocaleString()}
                        </td>

                        {/* Reserved */}
                        <td className="px-6 py-4 text-center text-slate-500">
                          {item.reserved > 0 ? (
                            <span className="font-semibold text-amber-700">
                              {Number(item.reserved).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Available */}
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`font-black text-sm ${
                              isOut
                                ? "text-rose-600"
                                : isLow
                                ? "text-amber-700"
                                : "text-emerald-700"
                            }`}
                          >
                            {Number(item.available || 0).toLocaleString()}
                          </span>
                        </td>

                        {/* Stock Status */}
                        <td className="px-6 py-4 text-center">
                          {isOut ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                              <span className="size-1.5 rounded-full bg-rose-500" />
                              <span>Out of Stock</span>
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <span className="size-1.5 rounded-full bg-amber-500" />
                              <span>Low Stock</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              <span>In Stock</span>
                            </span>
                          )}
                        </td>

                        {/* Last Updated */}
                        <td className="px-6 py-4 text-right text-slate-500 font-mono text-[11px]">
                          {item.lastStockUpdateAt || item.updatedAt
                            ? new Date(
                                item.lastStockUpdateAt || item.updatedAt
                              ).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "N/A"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-100">
              <VendorTablePagination
                page={meta.page}
                limit={meta.limit}
                total={meta.total}
                totalPages={meta.totalPages}
                onPageChange={(p) => setPage(p)}
                onLimitChange={(l) => {
                  setLimit(l);
                  setPage(1);
                }}
                isLoading={isTableLoading}
                itemLabel="variants"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
