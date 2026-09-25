"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { adminSearchService } from "@/services/admin/admin.service";

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState({
    orders: [],
    products: [],
    customers: [],
    vendors: [],
    staff: [],
    shipments: [],
    support: [],
    totalResults: 0,
  });

  const performSearch = async (searchTerm) => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      setResults({
        orders: [],
        products: [],
        customers: [],
        vendors: [],
        staff: [],
        shipments: [],
        support: [],
        totalResults: 0,
      });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await adminSearchService.search(searchTerm.trim());
      setResults(data || {});
    } catch (err) {
      console.error("Search failed:", err);
      setError(err?.response?.data?.message || err?.message || "Search request failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/administrator/search?q=${encodeURIComponent(query.trim())}`);
      performSearch(query.trim());
    }
  };

  const tabs = [
    { id: "all", label: "All Results", count: results.totalResults || 0 },
    { id: "orders", label: "Orders", count: results.orders?.length || 0 },
    { id: "products", label: "Products", count: results.products?.length || 0 },
    { id: "customers", label: "Customers", count: results.customers?.length || 0 },
    { id: "vendors", label: "Vendors", count: results.vendors?.length || 0 },
    { id: "staff", label: "Staff", count: results.staff?.length || 0 },
    { id: "shipments", label: "Shipments", count: results.shipments?.length || 0 },
    { id: "support", label: "Support", count: results.support?.length || 0 },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-gray-200 pb-5">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Global Administrator Search</h1>
        <p className="text-sm text-gray-500 mt-1">
          Permission-scoped cross-entity lookup across orders, catalog, customers, vendors, and operations.
        </p>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by order #, SKU, customer name/email, vendor business, tracking #, or ticket..."
            className="w-full pl-10 pr-4 py-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004D38] bg-white text-gray-900 placeholder-gray-400 shadow-xs"
          />
          <svg
            className="w-5 h-5 absolute left-3.5 top-3.5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-6 py-3 text-sm font-semibold text-white bg-[#004D38] hover:bg-[#003829] rounded-xl shadow-xs transition-colors disabled:opacity-50"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {/* Tabs */}
      {query.trim().length >= 2 && (
        <div className="flex gap-1 overflow-x-auto pb-1 border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? "bg-[#004D38] text-white shadow-xs"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeTab === tab.id ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="p-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl">
          {error}
        </div>
      )}

      {/* Results Section */}
      {loading ? (
        <div className="py-24 text-center text-sm text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#004D38] mx-auto mb-3"></div>
          Scanning authorized records across platform collections...
        </div>
      ) : query.trim().length >= 2 && results.totalResults === 0 ? (
        <div className="py-20 text-center bg-white rounded-xl border border-gray-200">
          <p className="text-sm font-semibold text-gray-900">No matching records found</p>
          <p className="text-xs text-gray-500 mt-1">
            No entities match &quot;{query}&quot; or you lack permissions to view matching collections.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Orders Group */}
          {(activeTab === "all" || activeTab === "orders") && results.orders?.length > 0 && (
            <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50/70 border-b border-gray-200 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">Orders</span>
                <span className="text-[11px] text-gray-500">{results.orders.length} found</span>
              </div>
              <div className="divide-y divide-gray-100">
                {results.orders.map((o) => (
                  <Link
                    key={o._id}
                    href={`/administrator/operations/orders?id=${o._id}`}
                    className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-gray-50/80 transition-colors gap-2"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-900">Order #{o.orderNumber || o._id}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Placed on {new Date(o.createdAt).toLocaleDateString()} &bull; Total: ₹{o.grandTotal || 0}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 capitalize">
                        {o.status}
                      </span>
                      <span className="text-xs text-[#004D38] font-medium">View &rarr;</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Products Group */}
          {(activeTab === "all" || activeTab === "products") && results.products?.length > 0 && (
            <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50/70 border-b border-gray-200 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">Catalog Products</span>
                <span className="text-[11px] text-gray-500">{results.products.length} found</span>
              </div>
              <div className="divide-y divide-gray-100">
                {results.products.map((p) => (
                  <Link
                    key={p._id}
                    href={`/administrator/catalog/products/${p._id}`}
                    className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-gray-50/80 transition-colors gap-2"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-900">{p.title}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        SKU: <span className="font-mono">{p.sku || "N/A"}</span> &bull; Price: ₹{p.price || 0}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 capitalize">
                        {p.status}
                      </span>
                      <span className="text-xs text-[#004D38] font-medium">Review &rarr;</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Customers Group */}
          {(activeTab === "all" || activeTab === "customers") && results.customers?.length > 0 && (
            <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50/70 border-b border-gray-200 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">Customers</span>
                <span className="text-[11px] text-gray-500">{results.customers.length} found</span>
              </div>
              <div className="divide-y divide-gray-100">
                {results.customers.map((c) => (
                  <Link
                    key={c._id}
                    href={`/administrator/customers/${c._id}`}
                    className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-gray-50/80 transition-colors gap-2"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-900">{c.firstName} {c.lastName}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{c.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${c.isActive ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                        {c.isActive ? "Active" : "Suspended"}
                      </span>
                      <span className="text-xs text-[#004D38] font-medium">Profile &rarr;</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Vendors Group */}
          {(activeTab === "all" || activeTab === "vendors") && results.vendors?.length > 0 && (
            <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50/70 border-b border-gray-200 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">Vendors</span>
                <span className="text-[11px] text-gray-500">{results.vendors.length} found</span>
              </div>
              <div className="divide-y divide-gray-100">
                {results.vendors.map((v) => (
                  <Link
                    key={v._id}
                    href={`/administrator/vendors/${v._id}`}
                    className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-gray-50/80 transition-colors gap-2"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-900">{v.businessName}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{v.email} &bull; Slug: {v.businessSlug}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 capitalize">
                        {v.onboardingStatus}
                      </span>
                      <span className="text-xs text-[#004D38] font-medium">Inspect &rarr;</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Staff Group */}
          {(activeTab === "all" || activeTab === "staff") && results.staff?.length > 0 && (
            <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50/70 border-b border-gray-200 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">Internal Staff</span>
                <span className="text-[11px] text-gray-500">{results.staff.length} found</span>
              </div>
              <div className="divide-y divide-gray-100">
                {results.staff.map((s) => (
                  <Link
                    key={s._id}
                    href={`/administrator/staff/${s._id}`}
                    className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-gray-50/80 transition-colors gap-2"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-900">{s.firstName} {s.lastName}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{s.email} &bull; Role: {s.role}</p>
                    </div>
                    <span className="text-xs text-[#004D38] font-medium">Manage &rarr;</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Shipments Group */}
          {(activeTab === "all" || activeTab === "shipments") && results.shipments?.length > 0 && (
            <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50/70 border-b border-gray-200 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">Shipments</span>
                <span className="text-[11px] text-gray-500">{results.shipments.length} found</span>
              </div>
              <div className="divide-y divide-gray-100">
                {results.shipments.map((sh) => (
                  <div
                    key={sh._id}
                    className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-gray-50/80 transition-colors gap-2"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-900">
                        {sh.carrier?.toUpperCase() || "Courier"} &bull; Tracking: <span className="font-mono">{sh.trackingNumber || "N/A"}</span>
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Order Ref: {sh.orderId}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-800 capitalize">
                      {sh.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Support Group */}
          {(activeTab === "all" || activeTab === "support") && results.support?.length > 0 && (
            <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50/70 border-b border-gray-200 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">Support Tickets</span>
                <span className="text-[11px] text-gray-500">{results.support.length} found</span>
              </div>
              <div className="divide-y divide-gray-100">
                {results.support.map((tk) => (
                  <Link
                    key={tk._id}
                    href={`/administrator/support/tickets?id=${tk._id}`}
                    className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-gray-50/80 transition-colors gap-2"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-900">#{tk.ticketNumber || tk._id.slice(-6)} - {tk.subject}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Category: {tk.category} &bull; Priority: {tk.priority}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 capitalize">
                      {tk.status}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminSearchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-neutral-500">Loading search...</div>}>
      <SearchContent />
    </Suspense>
  );
}
