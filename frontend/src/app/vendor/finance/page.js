"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Wallet,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";

export default function VendorFinancePage() {
  const [settlements, setSettlements] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadFinanceData = React.useCallback(async (showToast = false) => {
    setIsLoading(true);
    try {
      const [settlementsRes, summaryRes] = await Promise.allSettled([
        vendorService.getMySettlements(),
        vendorService.getFinanceSummary(),
      ]);

      if (settlementsRes.status === "fulfilled") {
        const data = settlementsRes.value?.data?.data || settlementsRes.value?.data?.settlements || settlementsRes.value?.data || [];
        const items = Array.isArray(data) ? data : data.items || [];
        setSettlements(items);
      }

      if (summaryRes.status === "fulfilled") {
        const sumData = summaryRes.value?.data?.data || summaryRes.value?.data;
        setSummary(sumData);
      }

      if (showToast) {
        toast.success("Settlements updated");
      }
    } catch (err) {
      if (err.status !== 403 && err.status !== 404 && err.response?.status !== 403 && err.response?.status !== 404) {
        toast.error("Failed to load financial overview", {
          description: err.response?.data?.message || err.message,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const [settlementsRes, summaryRes] = await Promise.allSettled([
          vendorService.getMySettlements(),
          vendorService.getFinanceSummary(),
        ]);
        if (!isMounted) return;
        if (settlementsRes.status === "fulfilled") {
          const data = settlementsRes.value?.data?.data || settlementsRes.value?.data?.settlements || settlementsRes.value?.data || [];
          const items = Array.isArray(data) ? data : data.items || [];
          setSettlements(items);
        }
        if (summaryRes.status === "fulfilled") {
          const sumData = summaryRes.value?.data?.data || summaryRes.value?.data;
          setSummary(sumData);
        }
      } catch (err) {
        if (err.status !== 403 && err.status !== 404 && err.response?.status !== 403 && err.response?.status !== 404) {
          toast.error("Failed to load financial overview", {
            description: err.response?.data?.message || err.message,
          });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRefresh = () => {
    loadFinanceData(true);
  };

  const totalGross = settlements.reduce((sum, s) => sum + Number(s.grossSales || 0), 0);
  const totalCommission = settlements.reduce((sum, s) => sum + Number(s.platformCommission || 0), 0);
  const totalNet = Number(summary?.totalEarnings || settlements.filter(s => s.status === "paid").reduce((sum, s) => sum + Number(s.netPayable || 0), 0));
  const pendingAmount = Number(summary?.pendingSettlement || settlements.filter(s => s.status !== "paid").reduce((sum, s) => sum + Number(s.netPayable || 0), 0));
  const eligibleAmount = Number(summary?.eligibleForSettlement || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Settlements & Finance
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Marketplace billing cycles, platform commissions, net merchant earnings, and payout logs.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors"
        >
          <RefreshCw className="size-3.5" />
          <span>Refresh Settlements</span>
        </button>
      </div>

      {/* Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Settled Gross Sales
          </div>
          <div className="text-2xl font-black text-slate-900">
            ₹{totalGross.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Platform Fees
          </div>
          <div className="text-2xl font-black text-rose-600">
            -₹{totalCommission.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Settled Net Earnings
          </div>
          <div className="text-2xl font-black text-emerald-700">
            ₹{totalNet.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Disbursed to your merchant bank account</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Pending Statements
          </div>
          <div className="text-2xl font-black text-amber-600">
            ₹{pendingAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Statements generated awaiting payout</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Ready for Next Settlement
          </div>
          <div className="text-2xl font-black text-blue-600">
            ₹{eligibleAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Delivered orders past 7-day return window</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Total Statements
          </div>
          <div className="text-2xl font-black text-slate-900">
            {settlements.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Billing cycles generated</p>
        </div>
      </div>

      {/* Settlements Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200/80">
          <h3 className="text-sm font-bold text-slate-900">Settlement Statements</h3>
          <p className="text-xs text-slate-500">Bi-weekly billing cycle statements with automatic net payouts</p>
        </div>

        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : settlements.length === 0 ? (
          <div className="p-16 text-center">
            <Wallet className="size-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-800">No Settlements Recorded</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Statements are automatically generated at the end of each marketplace cycle for orders fulfilled.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-3.5">Statement #</th>
                  <th className="px-6 py-3.5">Period</th>
                  <th className="px-6 py-3.5 text-right">Gross Sales</th>
                  <th className="px-6 py-3.5 text-right">Fee / Commission</th>
                  <th className="px-6 py-3.5 text-right">Net Payout</th>
                  <th className="px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settlements.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <Link
                        href={`/vendor/finance/settlements/${s.secureId || s._id}`}
                        className="font-mono font-bold text-[#004D38] hover:underline"
                      >
                        {s.settlementNumber || s.secureId}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                      {s.periodStart ? new Date(s.periodStart).toLocaleDateString("en-IN") : "Start"} —{" "}
                      {s.periodEnd ? new Date(s.periodEnd).toLocaleDateString("en-IN") : "End"}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-800">
                      ₹{Number(s.grossSales || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right text-rose-600 font-medium">
                      -₹{Number(s.platformCommission || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-900">
                      ₹{Number(s.netPayable || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          s.status === "paid"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : s.status === "processing"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {s.status}
                      </span>
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
