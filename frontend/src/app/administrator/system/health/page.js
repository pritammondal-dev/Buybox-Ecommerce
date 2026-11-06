"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  Server,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  HardDrive,
  Radio,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader.jsx";
import { adminSystemService } from "@/services/admin/admin.service.js";

export default function SystemHealthPage() {
  const [health, setHealth] = useState(null);
  const [latency, setLatency] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkHealth = async () => {
    setLoading(true);
    const start = Date.now();
    try {
      const res = await adminSystemService.getHealth();
      const elapsed = Date.now() - start;
      setHealth(res);
      setLatency(elapsed);
    } catch (err) {
      setHealth({ status: "degraded", message: err.message });
      setLatency(Date.now() - start);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const isHealthy = health?.status === "healthy" || health?.status === "ok" || health?.success;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service Health & Diagnostics"
        description="Real-time connectivity monitoring, latency metrics, and API gateway telemetry."
        backHref="/administrator/system"
        backLabel="System"
        actions={
          <button
            onClick={checkHealth}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Run Diagnostic Ping
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                isHealthy ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
              }`}
            >
              <Server className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                API Endpoint
              </p>
              <p className="text-base font-bold text-slate-900 mt-0.5">
                {isHealthy ? "Healthy" : "Degraded"}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {health?.message || "All core controllers responsive"}
          </p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Round-Trip Latency
              </p>
              <p className="text-base font-bold text-slate-900 mt-0.5">
                {latency !== null ? `${latency} ms` : "Measuring..."}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Internal gateway latency to backend API service
          </p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Timestamp
              </p>
              <p className="text-base font-bold text-slate-900 mt-0.5">
                {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : "Live"}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Authoritative server UTC synchronization
          </p>
        </div>
      </div>
    </div>
  );
}
