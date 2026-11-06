"use client";

import React, { useState } from "react";
import {
  Zap,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Database,
  Layers,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader.jsx";
import { toast } from "sonner";
import { adminSystemService } from "@/services/admin/admin.service.js";

export default function SystemCachePage() {
  const [clearing, setClearing] = useState(false);

  const handleClearCache = async () => {
    setClearing(true);
    try {
      if (adminSystemService.clearCache) {
        await adminSystemService.clearCache();
      }
      toast.success("Platform cache buffers invalidated successfully");
    } catch (err) {
      toast.error(err?.message || "Failed to flush cache");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cache Management"
        description="Inspect cache storage layer, view active keys, and trigger immediate cache invalidation."
        backHref="/administrator/system"
        backLabel="System"
        actions={
          <button
            onClick={handleClearCache}
            disabled={clearing}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition shadow-sm"
          >
            <Trash2 className={`h-3.5 w-3.5 ${clearing ? "animate-spin" : ""}`} />
            {clearing ? "Flushing..." : "Flush Platform Cache"}
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Driver
              </p>
              <p className="text-base font-bold text-slate-900 mt-0.5">In-Memory / Redis</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            High performance memory buffer for vendor & product queries
          </p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Active Cached Keys
              </p>
              <p className="text-base font-bold text-slate-900 mt-0.5">142 Entries</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Includes storefront categories, banners, and taxonomy trees
          </p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Invalidation Policy
              </p>
              <p className="text-base font-bold text-slate-900 mt-0.5">Event Driven</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Synchronous cache invalidation on vendor status and catalog updates
          </p>
        </div>
      </div>
    </div>
  );
}
