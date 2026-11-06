"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  Users,
  History,
  Lock,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Send,
} from "lucide-react";
import {
  staffService,
  jobRoleService,
  securityService,
} from "@/services/admin/admin.service.js";
import { useAdminAuth } from "@/hooks/useAdminAuth.js";

export default function SecurityCenterPage() {
  const router = useRouter();
  const { user: currentUser } = useAdminAuth();
  const isSuperadmin =
    ["super_admin", "SUPER_ADMIN", "superadmin"].includes(currentUser?.role) ||
    currentUser?.isSuperadmin;

  const [staff, setStaff] = useState([]);
  const [jobRoles, setJobRoles] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Transfer Superadmin Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [targetUserId, setTargetUserId] = useState("");
  const [replacementRoleId, setReplacementRoleId] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const fetchSecurityData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [staffRes, rolesRes, logsRes] = await Promise.all([
        staffService.list({ limit: 100 }),
        jobRoleService.list(),
        securityService.listAuditLogs({ limit: 5 }).catch(() => ({ logs: [] })),
      ]);

      setStaff(staffRes?.staff || []);
      setJobRoles(rolesRes?.roles || []);
      setRecentLogs(logsRes?.logs || logsRes || []);
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to load security state"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const handleTransferSuperadmin = async (e) => {
    e.preventDefault();
    if (confirmText !== "TRANSFER_SUPERADMIN") {
      setError("Please type exactly 'TRANSFER_SUPERADMIN' to confirm platform transfer.");
      return;
    }
    setTransferSubmitting(true);
    setError(null);
    try {
      await jobRoleService.transferSuperadmin({
        targetUserId,
        replacementRoleId,
        confirmText,
        password,
      });
      setShowTransferModal(false);
      setSuccessMsg(
        "Platform Superadmin authority successfully transferred. All active sessions have been invalidated."
      );
      setTimeout(() => {
        router.push("/administrator/login");
      }, 3000);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to transfer Superadmin authority"
      );
    } finally {
      setTransferSubmitting(false);
    }
  };

  const activeSuperadmins = staff.filter((s) => s.role === "super_admin");
  const activeStaff = staff.filter((s) => s.isActive);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Platform Security &amp; Governance
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Active Security Layer
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Enforce the single Superadmin invariant, manage session invalidation versions, and audit administrative actions.
          </p>
        </div>

        <button
          onClick={fetchSecurityData}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Status
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="flex items-center gap-2 p-4 text-sm text-emerald-800 bg-emerald-50 rounded-xl border border-emerald-200">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 text-sm text-rose-800 bg-rose-50 rounded-xl border border-rose-200">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Platform Invariant Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-slate-500">
              Active Superadmin Invariant
            </span>
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {activeSuperadmins.length} / 1 Active
          </div>
          <p className="text-xs text-slate-400">
            Database partial unique index enforces active Superadmin count &le; 1 strictly.
          </p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-slate-500">
              Active Staff Accounts
            </span>
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {activeStaff.length}
          </div>
          <p className="text-xs text-slate-400">
            Employees authorized with granular PBAC permissions across the marketplace.
          </p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-slate-500">
              Dynamic Job Roles
            </span>
            <KeyRound className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {jobRoles.length}
          </div>
          <p className="text-xs text-slate-400">
            Database-backed authority tiers and management scopes configured.
          </p>
        </div>
      </div>

      {/* Governance & Transfer Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-600" />
              Superadmin Platform Transfer
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Atomically transition primary platform governance authority to a qualified successor.
            </p>
          </div>

          {isSuperadmin && (
            <button
              onClick={() => {
                setTargetUserId("");
                setReplacementRoleId("");
                setConfirmText("");
                setPassword("");
                setShowTransferModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl text-white bg-rose-600 hover:bg-rose-700 shadow-xs transition-all focus:outline-none"
            >
              Initiate Superadmin Transfer
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
            <span className="font-semibold text-slate-900 block">
              Current Platform Superadmin:
            </span>
            {activeSuperadmins.length > 0 ? (
              activeSuperadmins.map((sa) => (
                <div key={sa.id} className="space-y-0.5">
                  <div className="font-semibold text-indigo-700">
                    {sa.firstName} {sa.lastName}
                  </div>
                  <div className="text-slate-500 font-mono text-[11px]">{sa.email}</div>
                  <div className="text-slate-400 text-[10px]">
                    Employee: {sa.employee?.employeeNumber || "Superadmin Root"}
                  </div>
                </div>
              ))
            ) : (
              <span className="text-rose-500 font-semibold">No active Superadmin found!</span>
            )}
          </div>

          <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1.5 text-amber-900">
            <span className="font-semibold block">Protected Transfer Protocol:</span>
            <p>1. Target must be an active, verified administrator employee.</p>
            <p>2. Outgoing Superadmin is atomically demoted to a configured replacement role.</p>
            <p>3. All active sessions for both parties are immediately invalidated via <code>authVersion</code>.</p>
          </div>
        </div>
      </div>

      {/* Security Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/administrator/job-roles"
          className="p-5 bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-300 shadow-xs transition-all flex items-center justify-between group"
        >
          <div>
            <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
              Job Roles &amp; Hierarchy
            </h4>
            <p className="text-xs text-slate-500 mt-1">Configure tiers &amp; scopes</p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-1 transition-all" />
        </Link>

        <Link
          href="/administrator/security/audit-logs"
          className="p-5 bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-300 shadow-xs transition-all flex items-center justify-between group"
        >
          <div>
            <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
              Immutable Audit Logs
            </h4>
            <p className="text-xs text-slate-500 mt-1">Inspect administrative actions</p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-1 transition-all" />
        </Link>

        <Link
          href="/administrator/staff"
          className="p-5 bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-300 shadow-xs transition-all flex items-center justify-between group"
        >
          <div>
            <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
              Staff Management
            </h4>
            <p className="text-xs text-slate-500 mt-1">Promote &amp; assign roles</p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-1 transition-all" />
        </Link>
      </div>

      {/* Transfer Superadmin Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 my-8">
            <div className="flex items-center gap-3 text-rose-600 mb-2">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-lg font-bold text-slate-900">
                Superadmin Platform Transfer
              </h3>
            </div>

            <p className="text-xs text-slate-600 mt-2">
              This action transfers complete, unassailable platform governance authority to a successor.
              You will immediately surrender Superadmin status and be demoted to the selected replacement role.
            </p>

            <form onSubmit={handleTransferSuperadmin} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Select Successor Employee *
                </label>
                <select
                  required
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-white border-slate-200 text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                >
                  <option value="">-- Choose Successor --</option>
                  {staff
                    .filter((s) => s.role !== "super_admin" && s.isActive)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName} ({s.email}) — Tier{" "}
                        {s.employee?.jobRole?.tier || 3}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Outgoing Superadmin Replacement Role *
                </label>
                <select
                  required
                  value={replacementRoleId}
                  onChange={(e) => setReplacementRoleId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-white border-slate-200 text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                >
                  <option value="">-- Choose New Role For Yourself --</option>
                  {jobRoles
                    .filter((r) => !r.isSuperadminRole && r.isActive)
                    .map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.name} (Tier {r.tier})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Type &quot;TRANSFER_SUPERADMIN&quot; to Confirm *
                </label>
                <input
                  type="text"
                  required
                  placeholder="TRANSFER_SUPERADMIN"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-rose-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Your Current Superadmin Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Verify password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferSubmitting || confirmText !== "TRANSFER_SUPERADMIN"}
                  className="px-4 py-2 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs disabled:opacity-50 transition-colors"
                >
                  {transferSubmitting ? "Executing Atomic Transfer..." : "Confirm & Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
