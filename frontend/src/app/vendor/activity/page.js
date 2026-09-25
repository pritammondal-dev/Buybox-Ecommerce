"use client";

import React, { useState, useEffect } from "react";
import {
  History,
  Activity,
  ShieldCheck,
  Clock,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";

export default function VendorActivityPage() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    vendorService
      .getActivityLogs()
      .then((res) => {
        if (!isMounted) return;
        const data = res?.data?.data?.logs || res?.data?.logs || res?.data || [];
        setLogs(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err.status === 403 || err.status === 404 || err.response?.status === 403 || err.response?.status === 404) {
          setLogs([]);
          return;
        }
        toast.error("Failed to load activity logs", {
          description: err.response?.data?.message || err.message,
        });
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const res = await vendorService.getActivityLogs();
      const data = res?.data?.data?.logs || res?.data?.logs || res?.data || [];
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err.status === 403 || err.status === 404 || err.response?.status === 403 || err.response?.status === 404) {
        setLogs([]);
        return;
      }
      toast.error("Failed to load activity logs", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Activity Audit Trail
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Immutable log of catalog changes, inventory adjustments, and operational events executed by your account.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors"
        >
          <RefreshCw className="size-3.5" />
          <span>Refresh Logs</span>
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200">
          <History className="size-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-800">No Activity Recorded</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Audit logs tracking product updates, stock adjustments, and console logins will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-3.5">Action Event</th>
                  <th className="px-6 py-3.5">Module / Resource</th>
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-6 py-3.5 text-right">Security Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/60">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 capitalize">
                        {log.action?.replace(/_/g, " ") || "Merchant Action"}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {log.description || "Vendor console operation"}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-600">
                      {log.entity || log.module || "VendorConsole"}
                    </td>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString("en-IN") : "Recent"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                        <ShieldCheck className="size-3.5" /> Verified
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
