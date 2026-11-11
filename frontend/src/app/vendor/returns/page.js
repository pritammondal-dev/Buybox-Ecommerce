"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  RotateCcw,
  Search,
  Filter,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";
import { getVendorReturnUrl } from "@/utils/secure-id.util";
import { formatCurrency, parsePrice } from "@/utils/formatCurrency";
import VendorTablePagination from "@/components/vendor/VendorTablePagination";
import {
  VendorPageHeader,
  VendorStatusBadge,
  VendorEmptyState,
} from "@/components/vendor";

export default function VendorReturnsPage() {
  const [returns, setReturns] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [status, setStatus] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const params = { page, limit };
    if (status !== "all") params.status = status;

    vendorService
      .getMyReturns(params)
      .then((res) => {
        if (!isMounted) return;
        const data = res?.data?.data || res?.data?.returnRequests || res?.data || [];
        const items = Array.isArray(data) ? data : data.items || [];
        const paginationMeta = res?.data?.meta || {
          page,
          limit,
          total: items.length,
          totalPages: Math.ceil(items.length / limit) || 1,
        };
        setReturns(items);
        setMeta(paginationMeta);
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err.status === 403 || err.status === 404 || err.response?.status === 403 || err.response?.status === 404) {
          setReturns([]);
          setMeta({ page: 1, limit: 20, total: 0, totalPages: 1 });
          return;
        }
        toast.error("Failed to load return requests", {
          description: err.response?.data?.message || err.message,
        });
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [status, page, limit]);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const params = { page, limit };
      if (status !== "all") params.status = status;

      const res = await vendorService.getMyReturns(params);
      const data = res?.data?.data || res?.data?.returnRequests || res?.data || [];
      const items = Array.isArray(data) ? data : data.items || [];
      const paginationMeta = res?.data?.meta || {
        page,
        limit,
        total: items.length,
        totalPages: Math.ceil(items.length / limit) || 1,
      };
      setReturns(items);
      setMeta(paginationMeta);
    } catch (err) {
      if (err.status === 403 || err.status === 404 || err.response?.status === 403 || err.response?.status === 404) {
        setReturns([]);
        setMeta({ page: 1, limit: 20, total: 0, totalPages: 1 });
        return;
      }
      toast.error("Failed to load return requests", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <VendorPageHeader
        title="Customer Returns & RMA"
        subtitle="Inspect returned merchandise, verify customer return reasons, and issue return approvals."
        breadcrumbs={[{ label: "Returns" }]}
        actions={
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors"
          >
            <RefreshCw className="size-3.5" />
            <span>Refresh Returns</span>
          </button>
        }
      />

      {/* Controls */}
      <div className="flex items-center gap-1.5 overflow-x-auto bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        {[
          { id: "all", label: "All Returns" },
          { id: "requested", label: "Pending Inspection" },
          { id: "approved", label: "Approved" },
          { id: "completed", label: "Completed" },
          { id: "rejected", label: "Rejected" },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setStatus(s.id);
              setPage(1);
            }}
            className={`px-3 py-1 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
              status === s.id
                ? "bg-[#004D38] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : returns.length === 0 ? (
          <VendorEmptyState
            icon={RotateCcw}
            title={status !== "all" ? "No Return Requests Found" : "No Return Requests"}
            description={
              status !== "all"
                ? "No customer return requests match the selected status filter."
                : "You have zero pending customer returns for your products."
            }
            action={
              status !== "all"
                ? {
                    label: "Clear Filters",
                    onClick: () => {
                      setStatus("all");
                      setPage(1);
                    },
                  }
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-3.5">Return #</th>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Reason</th>
                  <th className="px-6 py-3.5 text-right">Refund Amount</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {returns.map((ret) => {
                  const secureUrl = getVendorReturnUrl(ret.secureId || ret._id);
                  return (
                    <tr key={ret._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">
                        <Link href={secureUrl} className="hover:text-emerald-700 hover:underline">
                          {ret.returnNumber || ret.secureId}
                        </Link>
                      </td>
                      <td className="px-6 py-4 font-semibold capitalize text-slate-700">
                        {ret.type || "refund"}
                      </td>
                      <td className="px-6 py-4">
                        <VendorStatusBadge status={ret.status} entityType="return" />
                      </td>
                      <td className="px-6 py-4 text-slate-600 max-w-xs truncate">
                        {ret.reason || "Customer Return Request"}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900">
                        {formatCurrency(parsePrice(ret.refundAmount))}
                      </td>
                      <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                        {ret.createdAt ? new Date(ret.createdAt).toLocaleDateString("en-IN") : "N/A"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={secureUrl}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                        >
                          <span>Inspect</span>
                          <ChevronRight className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <VendorTablePagination
              page={page}
              limit={limit}
              total={meta?.total ?? returns.length}
              totalPages={meta?.totalPages}
              onPageChange={(newPage) => setPage(newPage)}
              onLimitChange={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
              isLoading={isLoading}
              itemLabel="returns"
            />
          </div>
        )}
      </div>
    </div>
  );
}
