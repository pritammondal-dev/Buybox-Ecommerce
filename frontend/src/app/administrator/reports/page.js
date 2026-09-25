"use client";

import React, { useState, useEffect } from "react";
import { adminAnalyticsService } from "@/services/admin/admin.service";

export default function ReportsAndAnalyticsPage() {
  const [period, setPeriod] = useState("last_30_days");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [overview, setOverview] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [salesTrend, setSalesTrend] = useState([]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { period };
      if (period === "custom") {
        if (!startDate || !endDate) {
          setError("Please select both Start Date and End Date for custom period.");
          setLoading(false);
          return;
        }
        params.startDate = startDate;
        params.endDate = endDate;
      }

      const [resOverview, resTop, resTrend] = await Promise.all([
        adminAnalyticsService.getOverview(params),
        adminAnalyticsService.getTopProducts(params),
        adminAnalyticsService.getSalesTrend(params),
      ]);

      setOverview(resOverview?.metrics || resOverview || null);
      setTopProducts(resTop?.items || resTop || []);
      setSalesTrend(resTrend?.trend || resTrend || []);
    } catch (err) {
      console.error("Failed to load reports/analytics:", err);
      setError(err?.response?.data?.message || err?.message || "Failed to load reports data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (period !== "custom") {
      fetchAnalytics();
    }
  }, [period]);

  const handleExportCSV = () => {
    if (!salesTrend || salesTrend.length === 0) return;
    const headers = ["Date", "Orders", "Units Sold", "Gross Sales (INR)", "Discounts (INR)", "Tax (INR)", "Net Merchandise Sales (INR)"];
    const rows = salesTrend.map((t) => [
      t.date || t._id,
      t.orderCount || 0,
      t.unitsSold || 0,
      t.grossSales || "0.00",
      t.discounts || "0.00",
      t.tax || "0.00",
      t.merchandiseSales || "0.00",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `buybox_sales_report_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reports & Operational Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            Authoritative platform revenue, order volumes, product sales, and financial trends.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={loading || salesTrend.length === 0}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#004D38] hover:bg-[#003829] rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV Report
          </button>
          <button
            onClick={fetchAnalytics}
            className="px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
        <span className="text-xs font-semibold text-gray-700">Period:</span>
        <div className="flex flex-wrap gap-1 p-1 bg-gray-100 rounded-lg">
          {[
            { id: "today", label: "Today" },
            { id: "last_7_days", label: "Last 7 Days" },
            { id: "last_30_days", label: "Last 30 Days" },
            { id: "custom", label: "Custom Range" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPeriod(item.id)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                period === item.id
                  ? "bg-white text-[#004D38] shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#004D38]"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#004D38]"
            />
            <button
              onClick={fetchAnalytics}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-[#004D38] hover:bg-[#003829] rounded-lg"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center text-sm text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#004D38] mx-auto mb-3"></div>
          Computing operational report data...
        </div>
      ) : (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gross Sales</span>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ₹{overview?.grossSales || "0.00"}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">Pre-discount order volume</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Merchandise</span>
              <p className="text-2xl font-bold text-[#004D38] mt-2">
                ₹{overview?.merchandiseSales || "0.00"}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">After customer discounts (₹{overview?.discounts || "0.00"})</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Orders</span>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {overview?.orderCount || 0}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">Units Sold: {overview?.unitsSold || 0}</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Average Order Value</span>
              <p className="text-2xl font-bold text-indigo-700 mt-2">
                ₹{overview?.averageOrderValue || "0.00"}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">Platform Refunds: ₹{overview?.refunds || "0.00"}</p>
            </div>
          </div>

          {/* Daily Trend Table */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-sm font-bold text-gray-900">Sales Trend Breakdown ({salesTrend.length} periods)</h2>
              <span className="text-xs text-gray-500">UTC Authoritative Boundaries</span>
            </div>
            {salesTrend.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">No sales transactions recorded for this period.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600 divide-y divide-gray-200">
                  <thead className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Orders</th>
                      <th className="px-4 py-3">Units Sold</th>
                      <th className="px-4 py-3">Gross Sales</th>
                      <th className="px-4 py-3">Discounts</th>
                      <th className="px-4 py-3">Taxes</th>
                      <th className="px-4 py-3 text-right">Net Sales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {salesTrend.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                          {row.date || row._id}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{row.orderCount || 0}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{row.unitsSold || 0}</td>
                        <td className="px-4 py-3 whitespace-nowrap">₹{row.grossSales || "0.00"}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-red-600">-₹{row.discounts || "0.00"}</td>
                        <td className="px-4 py-3 whitespace-nowrap">₹{row.tax || "0.00"}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-[#004D38]">
                          ₹{row.merchandiseSales || "0.00"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Top Selling Products */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50/50">
              <h2 className="text-sm font-bold text-gray-900">Top Performing Catalog Products</h2>
            </div>
            {topProducts.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">No product sales logged in this timeframe.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600 divide-y divide-gray-200">
                  <thead className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Product Name</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Units Sold</th>
                      <th className="px-4 py-3 text-right">Net Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {topProducts.map((p, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {p.productName}
                          {p.variantName && <span className="text-[11px] text-gray-400 ml-1.5">({p.variantName})</span>}
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-500">{p.sku || "N/A"}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{p.unitsSold}</td>
                        <td className="px-4 py-3 text-right font-bold text-[#004D38]">₹{p.revenue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
