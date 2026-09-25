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
import { useAuth } from "@/hooks/useAuth.js";

export default function SecurityCenterPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const isSuperadmin =
    currentUser?.role === "super_admin" || currentUser?.role === "SUPERADMIN";

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Platform Security &amp; Governance
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              Active Security Layer
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Enforce the single Superadmin invariant, manage session invalidation versions, and audit administrative actions.
          </p>
        </div>

        <button
          onClick={fetchSecurityData}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Status
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="flex items-center gap-2 p-4 text-sm text-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 text-sm text-red-800 bg-red-50 dark:bg-red-950/40 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Platform Invariant Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-gray-500">
              Active Superadmin Invariant
            </span>
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {activeSuperadmins.length} / 1 Active
          </div>
          <p className="text-xs text-gray-400">
            Database partial unique index enforces active Superadmin count &le; 1 strictly.
          </p>
        </div>

        <div className="p-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-gray-500">
              Active Staff Accounts
            </span>
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {activeStaff.length}
          </div>
          <p className="text-xs text-gray-400">
            Employees authorized with granular PBAC permissions across the marketplace.
          </p>
        </div>

        <div className="p-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-gray-500">
              Dynamic Job Roles
            </span>
            <KeyRound className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {jobRoles.length}
          </div>
          <p className="text-xs text-gray-400">
            Database-backed authority tiers and management scopes configured.
          </p>
        </div>
      </div>

      {/* Governance & Transfer Section */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-600" />
              Superadmin Platform Transfer
            </h3>
            <p className="text-xs text-gray-500 mt-1">
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
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg text-white bg-red-600 hover:bg-red-700 shadow-sm transition-all focus:outline-none"
            >
              Initiate Superadmin Transfer
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600 dark:text-gray-300">
          <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-lg space-y-2">
            <span className="font-semibold text-gray-900 dark:text-white block">
              Current Platform Superadmin:
            </span>
            {activeSuperadmins.length > 0 ? (
              activeSuperadmins.map((sa) => (
                <div key={sa.id} className="space-y-0.5">
                  <div className="font-medium text-indigo-600 dark:text-indigo-400">
                    {sa.firstName} {sa.lastName}
                  </div>
                  <div className="text-gray-500 font-mono text-[11px]">{sa.email}</div>
                  <div className="text-gray-400 text-[10px]">
                    Employee: {sa.employee?.employeeNumber || "Superadmin Root"}
                  </div>
                </div>
              ))
            ) : (
              <span className="text-red-500">No active Superadmin found!</span>
            )}
          </div>

          <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg space-y-1.5 text-amber-900 dark:text-amber-200">
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
          className="p-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all flex items-center justify-between group"
        >
          <div>
            <h4 className="font-bold text-gray-900 dark:text-white text-sm group-hover:text-indigo-600 transition-colors">
              Job Roles &amp; Hierarchy
            </h4>
            <p className="text-xs text-gray-500 mt-1">Configure tiers &amp; scopes</p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
        </Link>

        <Link
          href="/administrator/security/audit-logs"
          className="p-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all flex items-center justify-between group"
        >
          <div>
            <h4 className="font-bold text-gray-900 dark:text-white text-sm group-hover:text-indigo-600 transition-colors">
              Immutable Audit Logs
            </h4>
            <p className="text-xs text-gray-500 mt-1">Inspect administrative actions</p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
        </Link>

        <Link
          href="/administrator/staff"
          className="p-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all flex items-center justify-between group"
        >
          <div>
            <h4 className="font-bold text-gray-900 dark:text-white text-sm group-hover:text-indigo-600 transition-colors">
              Staff Management
            </h4>
            <p className="text-xs text-gray-500 mt-1">Promote &amp; assign roles</p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
        </Link>
      </div>

      {/* Transfer Superadmin Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-gray-800 my-8">
            <div className="flex items-center gap-3 text-red-600 mb-2">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Superadmin Platform Transfer
              </h3>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
              This action transfers complete, unassailable platform governance authority to a successor.
              You will immediately surrender Superadmin status and be demoted to the selected replacement role.
            </p>

            <form onSubmit={handleTransferSuperadmin} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Select Successor Employee *
                </label>
                <select
                  required
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:outline-none"
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
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Outgoing Superadmin Replacement Role *
                </label>
                <select
                  required
                  value={replacementRoleId}
                  onChange={(e) => setReplacementRoleId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:outline-none"
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
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Type &quot;TRANSFER_SUPERADMIN&quot; to Confirm *
                </label>
                <input
                  type="text"
                  required
                  placeholder="TRANSFER_SUPERADMIN"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Your Current Superadmin Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Verify password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferSubmitting || confirmText !== "TRANSFER_SUPERADMIN"}
                  className="px-4 py-2 font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm disabled:opacity-50"
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
