"use client";

import React, { useEffect, useState } from "react";
import {
  UserCog,
  Plus,
  Search,
  Filter,
  Shield,
  Key,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  MoreVertical,
  Lock,
} from "lucide-react";
import { staffService } from "@/services/admin/admin.service.js";
import { useAuth } from "@/hooks/useAuth.js";

export default function StaffManagementPage() {
  const { user: currentUser } = useAuth();
  const isSuperadmin = currentUser?.role === "super_admin";

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "editor",
    jobTitle: "",
    department: "",
  });
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);

  const fetchStaff = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;

      const result = await staffService.list(params);
      setStaff(result?.staff || []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load staff list"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [roleFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchStaff();
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await staffService.create(createForm);
      setShowCreateModal(false);
      setCreateForm({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        role: "editor",
        jobTitle: "",
        department: "",
      });
      setActionSuccess("Staff member provisioned successfully");
      setTimeout(() => setActionSuccess(null), 4000);
      fetchStaff();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to create staff account"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSuspend = async (member) => {
    if (!isSuperadmin) return;
    const isCurrentlySuspended =
      member.employee?.status === "suspended" || !member.isActive;
    const action = isCurrentlySuspended ? "reactivate" : "suspend";

    if (
      !confirm(
        `Are you sure you want to ${action} ${member.firstName} ${member.lastName}?`
      )
    ) {
      return;
    }

    try {
      if (isCurrentlySuspended) {
        await staffService.reactivate(member.id);
        setActionSuccess("Staff account reactivated");
      } else {
        await staffService.suspend(member.id);
        setActionSuccess("Staff account suspended");
      }
      setTimeout(() => setActionSuccess(null), 4000);
      fetchStaff();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          `Failed to ${action} staff`
      );
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!selectedStaff || !newPassword) return;
    setSubmitting(true);
    try {
      await staffService.resetPassword(selectedStaff.id, newPassword);
      setShowPasswordModal(false);
      setSelectedStaff(null);
      setNewPassword("");
      setActionSuccess("Password reset successfully. Active sessions revoked.");
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to reset password"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <UserCog className="size-6 text-emerald-600" />
            <span>Staff Administration</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Privileged roles, operators, and staff access controls
          </p>
        </div>

        {isSuperadmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-xs"
          >
            <Plus className="size-4" />
            <span>Create Staff Member</span>
          </button>
        )}
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5">
          <CheckCircle className="size-4 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2.5">
          <AlertTriangle className="size-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </form>

        <div className="flex items-center gap-3">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs font-semibold py-2 px-3 border border-slate-200 rounded-xl bg-white focus:outline-none"
          >
            <option value="">All Roles</option>
            <option value="super_admin">Superadmin</option>
            <option value="admin">Administrator</option>
            <option value="editor">Editor</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold py-2 px-3 border border-slate-200 rounded-xl bg-white focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>

          <button
            onClick={fetchStaff}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-xl"
            title="Refresh"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Staff Member</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Employee ID</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Assigned Tasks</th>
                <th className="px-6 py-3.5">Permissions</th>
                <th className="px-6 py-3.5">Last Login</th>
                {isSuperadmin && <th className="px-6 py-3.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.length > 0 ? (
                staff.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">
                        {member.firstName} {member.lastName}
                      </div>
                      <div className="text-slate-400 text-[11px]">{member.email}</div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full font-semibold uppercase text-[10px] ${
                          member.role === "super_admin"
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : member.role === "admin"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {member.role}
                      </span>
                    </td>

                    <td className="px-6 py-4 font-mono text-[11px] text-slate-600">
                      {member.employee?.employeeNumber || "—"}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-medium text-[11px] ${
                          member.isActive && member.employee?.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            member.isActive && member.employee?.status === "active"
                              ? "bg-emerald-600"
                              : "bg-rose-600"
                          }`}
                        />
                        {member.isActive && member.employee?.status === "active"
                          ? "Active"
                          : "Suspended"}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-slate-700 font-semibold">
                      {member.activeTasksCount} active
                    </td>

                    <td className="px-6 py-4 text-slate-600">
                      {member.permissionsCount} effective
                    </td>

                    <td className="px-6 py-4 text-slate-500 text-[11px]">
                      {member.lastLoginAt
                        ? new Date(member.lastLoginAt).toLocaleDateString()
                        : "Never"}
                    </td>

                    {isSuperadmin && (
                      <td className="px-6 py-4 text-right space-x-2">
                        {member.role !== "super_admin" ? (
                          <>
                            <button
                              onClick={() => {
                                setSelectedStaff(member);
                                setShowPasswordModal(true);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                              Reset Password
                            </button>

                            <button
                              onClick={() => handleToggleSuspend(member)}
                              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                                member.isActive && member.employee?.status === "active"
                                  ? "text-rose-600 hover:bg-rose-50"
                                  : "text-emerald-700 hover:bg-emerald-50"
                              }`}
                            >
                              {member.isActive && member.employee?.status === "active"
                                ? "Suspend"
                                : "Reactivate"}
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Protected
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-10 text-slate-400 text-xs">
                    {loading ? "Loading staff..." : "No staff members matching criteria."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Staff Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                Provision New Staff Account
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    First Name
                  </label>
                  <input
                    required
                    type="text"
                    value={createForm.firstName}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, firstName: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Last Name
                  </label>
                  <input
                    required
                    type="text"
                    value={createForm.lastName}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, lastName: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Email Address
                </label>
                <input
                  required
                  type="email"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, email: e.target.value })
                  }
                  placeholder="employee@buybox.com"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Initial Password
                </label>
                <input
                  required
                  type="password"
                  minLength="8"
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, password: e.target.value })
                  }
                  placeholder="At least 8 characters"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Role
                </label>
                <select
                  value={createForm.role}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, role: e.target.value })
                  }
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none"
                >
                  <option value="editor">Editor (Catalog &amp; Moderation)</option>
                  <option value="admin">Administrator (Operations)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Note: Superadmin accounts cannot be provisioned via API.
                </p>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Job Title
                </label>
                <input
                  type="text"
                  value={createForm.jobTitle}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, jobTitle: e.target.value })
                  }
                  placeholder="e.g. Catalog Associate"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Lock className="size-4 text-emerald-600" />
                <span>Reset Staff Password</span>
              </h2>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setSelectedStaff(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Resetting password for{" "}
              <strong className="text-slate-800">
                {selectedStaff.firstName} {selectedStaff.lastName}
              </strong>
              . All active login sessions will be immediately terminated.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  New Password
                </label>
                <input
                  required
                  type="password"
                  minLength="8"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setSelectedStaff(null);
                  }}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold disabled:opacity-50"
                >
                  {submitting ? "Resetting..." : "Confirm Reset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
