"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  User,
  ArrowLeft,
  Shield,
  KeyRound,
  CheckCircle,
  AlertTriangle,
  Lock,
  Sliders,
  CheckSquare,
  Clock,
  Building,
  RefreshCw,
  LogOut,
  Laptop,
  Ban,
  UserCheck,
} from "lucide-react";
import { staffService, jobRoleService } from "@/services/admin/admin.service.js";
import { useAuth } from "@/hooks/useAuth.js";

export default function StaffDetailPage() {
  const params = useParams();
  const router = useRouter();
  const staffId = params?.id;

  const { user: currentUser } = useAuth();
  const isSuperadmin =
    currentUser?.role === "super_admin" || currentUser?.role === "SUPERADMIN";

  const [staffMember, setStaffMember] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Modals & Action Loaders
  const [revoking, setRevoking] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const fetchStaffDetails = async () => {
    if (!staffId) return;
    setLoading(true);
    setError(null);
    try {
      const [staffData, sessionsData] = await Promise.allSettled([
        staffService.get(staffId),
        staffService.getSessions(staffId),
      ]);

      if (staffData.status === "fulfilled") {
        setStaffMember(staffData.value);
      } else {
        throw staffData.reason;
      }

      if (sessionsData.status === "fulfilled") {
        const s = sessionsData.value?.sessions || sessionsData.value || [];
        setSessions(Array.isArray(s) ? s : []);
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to load staff details"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffDetails();
  }, [staffId]);

  const handleToggleStatus = async () => {
    const action = staffMember.isActive ? "suspend" : "reactivate";
    if (!confirm(`Are you sure you want to ${action} this staff member?`)) return;

    setStatusLoading(true);
    setError(null);
    try {
      if (staffMember.isActive) {
        await staffService.suspend(staffId);
        setSuccess("Staff member suspended successfully");
      } else {
        await staffService.reactivate(staffId);
        setSuccess("Staff member reactivated successfully");
      }
      setTimeout(() => setSuccess(null), 4000);
      fetchStaffDetails();
    } catch (err) {
      setError(err?.response?.data?.message || `Failed to ${action} staff member`);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleRevokeSessions = async () => {
    if (
      !confirm(
        "Are you sure you want to revoke all active sessions for this staff member? Their access tokens will be immediately invalidated."
      )
    ) {
      return;
    }

    setRevoking(true);
    setError(null);
    try {
      await staffService.revokeSessions(staffId);
      setSuccess("All active sessions revoked. The user must authenticate again.");
      setTimeout(() => setSuccess(null), 4500);
      fetchStaffDetails();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to revoke active sessions");
    } finally {
      setRevoking(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      alert("Password must be at least 8 characters");
      return;
    }

    setPasswordLoading(true);
    setError(null);
    try {
      await staffService.resetPassword(staffId, newPassword);
      setSuccess("Staff password has been reset securely");
      setShowPasswordModal(false);
      setNewPassword("");
      setTimeout(() => setSuccess(null), 4000);
      fetchStaffDetails();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to reset password");
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        <div className="h-8 bg-slate-100 rounded w-1/4 animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error && !staffMember) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">
          Staff Member Not Found
        </h2>
        <p className="text-sm text-slate-500">{error}</p>
        <Link
          href="/administrator/staff"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl text-white bg-emerald-600 hover:bg-emerald-700"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Staff List</span>
        </Link>
      </div>
    );
  }

  const employee = staffMember.employee;
  const jobRole = employee?.jobRole;
  const tier = jobRole?.tier;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/administrator/staff"
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">
                {staffMember.firstName} {staffMember.lastName}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  staffMember.isActive
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {staffMember.isActive ? "Active" : "Suspended"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{staffMember.email}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isSuperadmin && (
            <>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Reset Password</span>
              </button>

              <button
                onClick={handleToggleStatus}
                disabled={statusLoading}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors shadow-2xs ${
                  staffMember.isActive
                    ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                }`}
              >
                {staffMember.isActive ? (
                  <>
                    <Ban className="w-3.5 h-3.5" />
                    <span>Suspend Staff</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Reactivate Staff</span>
                  </>
                )}
              </button>
            </>
          )}

          <Link
            href="/administrator/staff"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-2xs transition-all"
          >
            Staff Directory
          </Link>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5">
          <CheckCircle className="size-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2.5">
          <AlertTriangle className="size-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Profile Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
            Job Role &amp; Tier
          </div>
          <div className="text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
            <span>{jobRole?.name || "Unassigned"}</span>
            {tier && (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Tier {tier}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Dynamic database-backed organizational authority
          </p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
            Security Role
          </div>
          <div className="text-lg font-bold text-slate-900 mt-1 uppercase">
            {staffMember.role}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Platform boundary security classification
          </p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
            Employee Number
          </div>
          <div className="text-lg font-bold font-mono text-slate-900 mt-1">
            {employee?.employeeNumber || "—"}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Department: {employee?.department || "Operations"}
          </p>
        </div>
      </div>

      {/* Effective Permissions */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-emerald-600" />
            <span>Effective Permissions ({staffMember.permissions?.length || 0})</span>
          </h3>
          <span className="text-xs text-slate-500">
            Resolved dynamically from Job Role + explicit grants
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {staffMember.permissions && staffMember.permissions.length > 0 ? (
            staffMember.permissions.map((perm) => (
              <span
                key={perm}
                className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-mono"
              >
                {perm}
              </span>
            ))
          ) : (
            <p className="text-xs text-slate-400 italic">
              No effective permissions assigned.
            </p>
          )}
        </div>
      </div>

      {/* Active Sessions & Security Governance */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Laptop className="w-4 h-4 text-emerald-600" />
              <span>Active Sessions &amp; Security Tokens</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Active sessions authenticated with token context: <strong>administrator</strong>
            </p>
          </div>

          {isSuperadmin && (
            <button
              onClick={handleRevokeSessions}
              disabled={revoking}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl transition-colors shadow-2xs disabled:opacity-50"
            >
              <LogOut className="size-3.5" />
              <span>{revoking ? "Revoking..." : "Revoke All Sessions"}</span>
            </button>
          )}
        </div>

        {sessions.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {sessions.map((sess, idx) => (
              <div
                key={sess._id || idx}
                className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                    <Laptop className="size-3.5 text-slate-400" />
                    <span>{sess.device || sess.userAgent || "Desktop Browser"}</span>
                    {sess.isCurrent && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    IP: {sess.ipAddress || "127.0.0.1"} • Auth Version: {sess.authVersion || staffMember.authVersion || 1}
                  </div>
                </div>

                <div className="text-slate-500 text-[11px]">
                  Last Active: {sess.lastActiveAt ? new Date(sess.lastActiveAt).toLocaleString("en-IN") : "Just now"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
            <span>
              Token version: <strong>v{staffMember.authVersion || 1}</strong> • Permission version:{" "}
              <strong>v{staffMember.permissionVersion || 1}</strong>
            </span>
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle className="size-3.5" />
              Standard Platform Session
            </span>
          </div>
        )}
      </div>

      {/* Active Work Tasks */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <CheckSquare className="w-4 h-4 text-emerald-600" />
          <span>Assigned Tasks ({staffMember.activeTasks?.length || 0})</span>
        </h3>

        {staffMember.activeTasks && staffMember.activeTasks.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {staffMember.activeTasks.map((t) => (
              <div key={t._id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-slate-900">
                    {t.title}
                  </span>
                  <span className="text-slate-400 ml-2 font-mono">{t.priority}</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No tasks currently assigned.</p>
        )}
      </div>

      {/* Reset Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <h2 className="text-base font-bold text-slate-900">
              Reset Staff Password
            </h2>
            <p className="text-xs text-slate-500">
              Set a temporary or new secure password for <strong>{staffMember.firstName} {staffMember.lastName}</strong>.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters with numbers & symbols"
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-xs disabled:opacity-50 transition-colors"
                >
                  {passwordLoading ? "Resetting..." : "Save Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
