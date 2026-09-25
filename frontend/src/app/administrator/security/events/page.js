"use client";

import React, { useEffect, useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Clock,
  User,
  Key,
  Lock,
} from "lucide-react";
import { securityService } from "@/services/admin/admin.service.js";

export default function SecurityEventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  const fetchEvents = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const result = await securityService.listEvents({ page, limit: 20 });
      setEvents(result?.events || []);
      setPagination({
        page: result?.page || 1,
        total: result?.total || 0,
        totalPages: result?.totalPages || 1,
      });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load security events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents(1);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="size-6 text-amber-600" />
            <span>Security Events Monitor</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Privileged permission updates, staff suspensions, password resets, and authentication events
          </p>
        </div>

        <button
          onClick={() => fetchEvents(pagination.page)}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Events List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {events.length > 0 ? (
          events.map((ev) => (
            <div key={ev._id} className="p-5 flex items-start justify-between gap-4 hover:bg-slate-50/50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  <Lock className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {ev.action}
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {ev.entityType}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-1">
                    Triggered by{" "}
                    <strong className="text-slate-700">
                      {ev.actorId?.firstName} {ev.actorId?.lastName}
                    </strong>{" "}
                    ({ev.actorId?.email})
                  </p>

                  <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-4">
                    <span>IP: {ev.ipAddress || "Internal System"}</span>
                    <span>•</span>
                    <span>Timestamp: {new Date(ev.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <span className="text-xs font-mono text-slate-400 shrink-0">
                #{ev._id?.slice(-8)}
              </span>
            </div>
          ))
        ) : (
          <div className="p-12 text-center text-slate-400 text-xs">
            {loading ? "Loading security events..." : "No recent security events recorded."}
          </div>
        )}
      </div>
    </div>
  );
}
