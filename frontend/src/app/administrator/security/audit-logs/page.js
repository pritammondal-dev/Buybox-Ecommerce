"use client";

import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  FileCode,
} from "lucide-react";
import { securityService } from "@/services/admin/admin.service.js";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [expandedLogId, setExpandedLogId] = useState(null);

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 20 };
      if (actionFilter) params.action = actionFilter;
      if (entityFilter) params.entityType = entityFilter;

      const result = await securityService.listAuditLogs(params);
      setLogs(result?.logs || []);
      setPagination({
        page: result?.page || 1,
        total: result?.total || 0,
        totalPages: result?.totalPages || 1,
      });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load audit trail");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [actionFilter, entityFilter]);

  const toggleExpand = (id) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="size-6 text-emerald-600" />
            <span>Immutable Audit Trail</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Tamper-evident logs of administrative actions, permission mutations, and operational changes
          </p>
        </div>

        <div className="text-xs text-slate-500 font-semibold bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
          Total Logged Events: <span className="text-slate-900 font-bold">{pagination.total}</span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder="Filter action (e.g. staff.created)..."
            className="text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 min-w-[200px]"
          />

          <input
            type="text"
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            placeholder="Filter entity (e.g. staff, task)..."
            className="text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 min-w-[180px]"
          />
        </div>

        <button
          onClick={() => fetchLogs(pagination.page)}
          className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-xl"
          title="Refresh"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Actor</th>
                <th className="px-6 py-3.5">Action</th>
                <th className="px-6 py-3.5">Target Entity</th>
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5">IP Address</th>
                <th className="px-6 py-3.5 text-right">State Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length > 0 ? (
                logs.map((log) => {
                  const isExpanded = expandedLogId === log._id;

                  return (
                    <React.Fragment key={log._id}>
                      <tr className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">
                            {log.actorId?.firstName} {log.actorId?.lastName}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {log.actorId?.email} ({log.actorId?.role})
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                            {log.action}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-slate-700 capitalize font-medium">
                          {log.entityType}
                        </td>

                        <td className="px-6 py-4 text-slate-500 text-[11px]">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>

                        <td className="px-6 py-4 font-mono text-[11px] text-slate-500">
                          {log.ipAddress || "Internal"}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => toggleExpand(log._id)}
                            className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold px-2 py-1 rounded bg-slate-100"
                          >
                            <span>Diff</span>
                            {isExpanded ? (
                              <ChevronUp className="size-3.5" />
                            ) : (
                              <ChevronDown className="size-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* State Diff Row */}
                      {isExpanded && (
                        <tr className="bg-slate-950 text-slate-200">
                          <td colSpan="6" className="p-4 font-mono text-[11px]">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-rose-400 font-bold block mb-1">
                                  --- BEFORE STATE ---
                                </span>
                                <pre className="bg-slate-900 p-3 rounded-lg overflow-x-auto text-[10px] text-slate-300 max-h-48">
                                  {JSON.stringify(log.beforeState, null, 2) || "None"}
                                </pre>
                              </div>
                              <div>
                                <span className="text-emerald-400 font-bold block mb-1">
                                  +++ AFTER STATE +++
                                </span>
                                <pre className="bg-slate-900 p-3 rounded-lg overflow-x-auto text-[10px] text-slate-300 max-h-48">
                                  {JSON.stringify(log.afterState, null, 2) || "None"}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400 text-xs">
                    {loading ? "Loading audit logs..." : "No audit entries recorded yet."}
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
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1 || loading}
                onClick={() => fetchLogs(pagination.page - 1)}
                className="px-3 py-1 bg-slate-100 rounded-lg disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => fetchLogs(pagination.page + 1)}
                className="px-3 py-1 bg-slate-100 rounded-lg disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
