"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Wallet,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  Sparkles,
  CreditCard,
  Building2,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { adminFinanceService } from "@/services/admin/finance.service";

export default function AdminSettlementsPage() {
  const [settlements, setSettlements] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Pay Modal
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [payoutReference, setPayoutReference] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  const loadSettlements = async (page = 1) => {
    setIsLoading(true);
    try {
      const res = await adminFinanceService.getSettlements({
        page,
        limit: 20,
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: searchQuery.trim() || undefined,
      });

      const list = res?.data || res?.items || [];
      setSettlements(Array.isArray(list) ? list : []);
      if (res?.meta) {
        setMeta(res.meta);
      }
    } catch (err) {
      toast.error("Failed to load settlements", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettlements(1);
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadSettlements(1);
  };

  const handleGenerateSettlements = async () => {
    setIsGenerating(true);
    try {
      const res = await adminFinanceService.generateSettlements();
      const generatedList = res?.data || res || [];
      const count = Array.isArray(generatedList) ? generatedList.length : 1;
      toast.success(`Generated ${count} eligible vendor settlement statement(s)`);
      await loadSettlements(1);
    } catch (err) {
      toast.error("Settlement generation failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const openPayModal = (settlement) => {
    setSelectedSettlement(settlement);
    setPayoutReference(`NEFT-${Date.now().toString().slice(-8)}`);
    setPayModalOpen(true);
  };

  const handleMarkPaid = async (e) => {
    e.preventDefault();
    if (!selectedSettlement) return;

    setIsPaying(true);
    try {
      await adminFinanceService.markSettlementPaid(selectedSettlement.secureId || selectedSettlement._id, {
        payoutReference: payoutReference.trim(),
      });
      toast.success(`Settlement ${selectedSettlement.settlementNumber} marked as paid`);
      setPayModalOpen(false);
      await loadSettlements(meta.page);
    } catch (err) {
      toast.error("Failed to record payout", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsPaying(false);
    }
  };

  const totalGMV = settlements.reduce((sum, s) => sum + Number(s.grossSales || 0), 0);
  const totalCommission = settlements.reduce((sum, s) => sum + Number(s.platformCommission || 0), 0);
  const totalPayout = settlements.reduce((sum, s) => sum + Number(s.netPayable || 0), 0);

  return (
    <div className="space-y-6 p-4 sm:p-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Vendor Settlements & Payouts
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Marketplace billing cycles, automated 7-day return reconciliations, commission deduction, and banking dispatches.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadSettlements(meta.page)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors"
          >
            <RefreshCw className="size-3.5" />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleGenerateSettlements}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            <span>Generate Eligible Cycle</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Total Statements
          </div>
          <div className="text-2xl font-black text-slate-900">{meta.total}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Total Gross Volume
          </div>
          <div className="text-2xl font-black text-slate-900">
            ₹{totalGMV.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Platform Commissions
          </div>
          <div className="text-2xl font-black text-emerald-700">
            ₹{totalCommission.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Net Vendor Payouts
          </div>
          <div className="text-2xl font-black text-blue-700">
            ₹{totalPayout.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="size-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search statement number..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {["all", "pending", "eligible", "processing", "payable", "paid"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? "bg-[#004D38] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {st}
            </button>
          ))}
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
        ) : settlements.length === 0 ? (
          <div className="p-16 text-center">
            <Wallet className="size-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-800">No Settlement Statements</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Click &quot;Generate Eligible Cycle&quot; to batch reconcile orders past the 7-day return window.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-3.5">Statement #</th>
                  <th className="px-6 py-3.5">Vendor / Merchant</th>
                  <th className="px-6 py-3.5">Billing Period</th>
                  <th className="px-6 py-3.5 text-right">Gross GMV</th>
                  <th className="px-6 py-3.5 text-right">Commission</th>
                  <th className="px-6 py-3.5 text-right">Net Payable</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settlements.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">
                      {s.settlementNumber || s.secureId}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">
                        {s.vendorId?.storeName || s.vendorId?.businessName || "Vendor"}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {s.vendorId?.email || ""}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                      {s.periodStart ? new Date(s.periodStart).toLocaleDateString("en-IN") : "Start"} —{" "}
                      {s.periodEnd ? new Date(s.periodEnd).toLocaleDateString("en-IN") : "End"}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-800">
                      ₹{Number(s.grossSales || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right text-emerald-700 font-medium">
                      +₹{Number(s.platformCommission || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-900">
                      ₹{Number(s.netPayable || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        s.status === "paid"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : s.status === "processing"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {s.status !== "paid" && (
                        <button
                          type="button"
                          onClick={() => openPayModal(s)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors"
                        >
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pay Modal */}
      {payModalOpen && selectedSettlement && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Record Payout Disbursement</h3>
              <button
                type="button"
                onClick={() => setPayModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleMarkPaid} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Statement:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedSettlement.settlementNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Vendor:</span>
                  <span className="font-bold text-slate-900">
                    {selectedSettlement.vendorId?.storeName || selectedSettlement.vendorId?.businessName}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-black pt-1 border-t border-slate-200">
                  <span className="text-slate-700">Net Payable:</span>
                  <span className="text-emerald-700">₹{Number(selectedSettlement.netPayable || 0).toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bank Payout / UTR Reference <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={payoutReference}
                  onChange={(e) => setPayoutReference(e.target.value)}
                  placeholder="e.g. UTR-98213891823"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPaying}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                >
                  {isPaying && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Confirm Payout</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
