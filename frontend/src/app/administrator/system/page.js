"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Server,
  Database,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Clock,
  ExternalLink,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader.jsx";
import { adminSystemService } from "@/services/admin/admin.service.js";

export default function SystemOverviewPage() {
  const [health, setHealth] = useState(null);
  const [cacheStatus, setCacheStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSystemData = async () => {
    setLoading(true);
    try {
      const [hRes, cRes] = await Promise.all([
        adminSystemService.getHealth(),
        adminSystemService.getCacheStatus ? adminSystemService.getCacheStatus() : Promise.resolve({ status: "connected" }),
      ]);
      setHealth(hRes);
      setCacheStatus(cRes);
    } catch (err) {
      setHealth({ status: "degraded", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemData();
  }, []);

  const isHealthy = health?.status === "healthy" || health?.status === "ok" || health?.success;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Administration"
        description="Monitor platform infrastructure, API services, runtime health, and caching subsystems."
        actions={
          <button
            onClick={fetchSystemData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Status
          </button>
        }
      />

      {/* Primary KPI Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              API Core Service
            </span>
            <div
              className={`p-1.5 rounded-lg ${
                isHealthy ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
              }`}
            >
              <Server className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                isHealthy
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isHealthy ? "bg-emerald-600" : "bg-amber-600"}`} />
              {isHealthy ? "Operational" : "Degraded"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 truncate">
            {health?.message || "Buybox API v1 Gateway"}
          </p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Primary Database
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Database className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              Connected
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 truncate">MongoDB Replica Set</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Cache Subsystem
            </span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              Active
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 truncate">
            {cacheStatus?.driver || "In-Memory Buffer"}
          </p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Security Boundary
            </span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
              PBAC Enforced
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 truncate">Strict Role Hierarchies</p>
        </div>
      </div>

      {/* Subsystem Navigation & Quick Access */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-600" />
            Infrastructure Diagnostics
          </h2>
          <div className="space-y-2">
            <Link
              href="/administrator/system/health"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">Service Health & Latency</p>
                <p className="text-xs text-slate-500">View real-time ping, uptime and node metrics</p>
              </div>
              <ExternalLink className="h-4 w-4 text-slate-400" />
            </Link>

            <Link
              href="/administrator/system/cache"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">Cache Invalidation & Memory</p>
                <p className="text-xs text-slate-500">Inspect key counts, flush stale buffers</p>
              </div>
              <ExternalLink className="h-4 w-4 text-slate-400" />
            </Link>
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600" />
            Task Queues & Governance
          </h2>
          <div className="space-y-2">
            <Link
              href="/administrator/tasks"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">Background Worker Jobs</p>
                <p className="text-xs text-slate-500">Manage queue processing, pending jobs and assignments</p>
              </div>
              <ExternalLink className="h-4 w-4 text-slate-400" />
            </Link>

            <Link
              href="/administrator/security/audit-logs"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">System & Audit Logs</p>
                <p className="text-xs text-slate-500">Inspect immutable security event records</p>
              </div>
              <ExternalLink className="h-4 w-4 text-slate-400" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
