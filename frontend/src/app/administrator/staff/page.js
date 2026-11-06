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
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  Check,
  X,
  Phone,
  Edit2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { staffService, jobRoleService } from "@/services/admin/admin.service.js";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog.jsx";
import { useAdminAuth } from "@/hooks/useAdminAuth.js";

export default function StaffManagementPage() {
  const { user: currentUser } = useAdminAuth();
  const isSuperadmin =
    ["super_admin", "SUPER_ADMIN", "superadmin"].includes(currentUser?.role) ||
    currentUser?.isSuperadmin;

  const [staff, setStaff] = useState([]);
  const [availableJobRoles, setAvailableJobRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);

  // Role Change / Pre-flight Diff State
  const [targetRoleId, setTargetRoleId] = useState("");
  const [roleChangeReason, setRoleChangeReason] = useState("");
  const [rolePreview, setRolePreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
    role: "editor",
    jobRoleId: "",
    jobTitle: "",
    department: "",
  });
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    jobTitle: "",
    department: "",
  });
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [staffToToggle, setStaffToToggle] = useState(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  const fetchStaff = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;

      const [staffRes, rolesRes] = await Promise.all([
        staffService.list(params),
        jobRoleService.list().catch(() => ({ roles: [] })),
      ]);

      setStaff(staffRes?.staff || []);
      const activeRoles = (rolesRes?.roles || []).filter((r) => r.isActive);
      activeRoles.sort((a, b) => a.tier - b.tier);
      setAvailableJobRoles(activeRoles);
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
        phone: "",
        email: "",
        password: "",
        role: "editor",
        jobRoleId: "",
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

  const handleToggleSuspend = (member) => {
    if (!isSuperadmin) return;
    setStaffToToggle(member);
  };

  const handleConfirmToggleSuspend = async () => {
    if (!isSuperadmin || !staffToToggle) return;
    const isCurrentlySuspended =
      staffToToggle.employee?.status === "suspended" || !staffToToggle.isActive;
    const action = isCurrentlySuspended ? "reactivate" : "suspend";

    setToggleLoading(true);
    try {
      if (isCurrentlySuspended) {
        await staffService.reactivate(staffToToggle.id);
        setActionSuccess("Staff member reactivated successfully");
      } else {
        await staffService.suspend(staffToToggle.id);
        setActionSuccess("Staff member suspended successfully");
      }
      setTimeout(() => setActionSuccess(null), 4000);
      fetchStaff();
      setStaffToToggle(null);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          `Failed to ${action} staff member`
      );
    } finally {
      setToggleLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setSubmitting(true);
    try {
      await staffService.resetPassword(selectedStaff.id, newPassword);
      setShowPasswordModal(false);
      setSelectedStaff(null);
      setNewPassword("");
      setActionSuccess("Password successfully updated. Sessions invalidated.");
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

  // Open Role Change Modal
  const handleOpenRoleModal = (member) => {
    setSelectedStaff(member);
    setTargetRoleId("");
    setRoleChangeReason("");
    setRolePreview(null);
    setShowRoleModal(true);
  };

  // Target role selection calculates pre-flight diff
  const handleTargetRoleSelect = async (newRoleId) => {
    setTargetRoleId(newRoleId);
    if (!newRoleId || !selectedStaff) return;
    setPreviewLoading(true);
    try {
      const empId = selectedStaff.employee?.id || selectedStaff.employee?._id || selectedStaff.id;
      const preview = await jobRoleService.previewRoleChange(empId, newRoleId);
      setRolePreview(preview);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to calculate role preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  // Confirm role change
  const handleConfirmRoleChange = async () => {
    if (!selectedStaff || !targetRoleId) return;
    setSubmitting(true);
    setError(null);
    try {
      const empId = selectedStaff.employee?.id || selectedStaff.employee?._id || selectedStaff.id;
      await jobRoleService.changeRole(empId, targetRoleId, roleChangeReason);
      setShowRoleModal(false);
      setSelectedStaff(null);
      setTargetRoleId("");
      setRolePreview(null);
      setActionSuccess("Staff role updated successfully! Authorization re-evaluated.");
      setTimeout(() => setActionSuccess(null), 4000);
      fetchStaff();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to change staff role"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditModal = (member) => {
    setSelectedStaff(member);
    setEditForm({
      firstName: member.firstName || "",
      lastName: member.lastName || "",
      phone: member.phone || "",
      jobTitle: member.employee?.jobTitle || "",
      department: member.employee?.department || "",
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setSubmitting(true);
    setError(null);
    try {
      await staffService.update(selectedStaff.id, editForm);
      setShowEditModal(false);
      setSelectedStaff(null);
      setActionSuccess("Staff member profile updated successfully.");
      setTimeout(() => setActionSuccess(null), 4000);
      fetchStaff();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update staff member"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Staff Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage marketplace administrators, editors, and operational staff with dynamic Job Role authority.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-all focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
        >
          <Plus className="w-4 h-4" />
          Provision Staff Member
        </button>
      </div>

      {/* Action Success / Error Notifications */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, or employee number..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </form>

        <div className="flex items-center gap-3">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs font-semibold py-2 px-3 border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-hidden"
          >
            <option value="">All Security Roles</option>
            <option value="super_admin">Superadmin</option>
            <option value="admin">Administrator</option>
            <option value="editor">Editor</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold py-2 px-3 border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-hidden"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>

          <button
            onClick={fetchStaff}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
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
                <th className="px-6 py-3.5">Job Role &amp; Tier</th>
                <th className="px-6 py-3.5">Security Role</th>
                <th className="px-6 py-3.5">Employee ID &amp; Dept</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Permissions</th>
                <th className="px-6 py-3.5">Last Login</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.length > 0 ? (
                staff.map((member) => {
                  const jobRole = member.employee?.jobRole;
                  const tier = jobRole?.tier;

                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/administrator/staff/${member.id}`}
                          className="font-semibold text-slate-900 hover:text-emerald-700 transition-colors inline-flex items-center gap-1.5"
                        >
                          <span>{member.firstName} {member.lastName}</span>
                        </Link>
                        <div className="text-slate-500 text-[11px]">{member.email}</div>
                        {member.phone && (
                          <div className="text-slate-500 text-[11px] font-mono flex items-center gap-1 mt-0.5">
                            <Phone className="size-3 text-slate-400" />
                            <span>{member.phone}</span>
                          </div>
                        )}
                      </td>

                      {/* Job Role & Tier */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                              tier === 1
                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                : tier <= 3
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-slate-100 text-slate-800 border border-slate-200"
                            }`}
                          >
                            Tier {tier || "—"}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {jobRole?.name || "Unassigned"}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {member.employee?.jobTitle || "Operations"}
                        </div>
                      </td>

                      {/* Security Role */}
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

                      <td className="px-6 py-4">
                        <div className="font-mono text-[11px] text-slate-700 font-semibold">
                          {member.employee?.employeeNumber || "—"}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {member.employee?.department || "Operations"}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-medium text-[11px] ${
                            member.isActive && member.employee?.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
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

                      <td className="px-6 py-4 text-slate-600">
                        {member.role === "super_admin"
                          ? "Full Platform (*)"
                          : `${member.permissionsCount || 0} permissions`}
                      </td>

                      <td className="px-6 py-4 text-slate-500 text-[11px]">
                        {member.lastLoginAt
                          ? new Date(member.lastLoginAt).toLocaleDateString()
                          : "Never"}
                      </td>

                      <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEditModal(member)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1"
                          title="Edit Profile"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        {member.role !== "super_admin" && (
                          <>
                            <button
                              onClick={() => handleOpenRoleModal(member)}
                              className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                              title="Promote, Demote, or Change Job Role"
                            >
                              Role
                            </button>

                            {isSuperadmin && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedStaff(member);
                                    setShowPasswordModal(true);
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                >
                                  Reset PW
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
                            )}
                          </>
                        )}

                        <Link
                          href={`/administrator/staff/${member.id}`}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg inline-flex items-center"
                          title="View Profile and Active Sessions"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-400">
                    No staff members match the specified criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Change & Pre-Flight Diff Modal */}
      {showRoleModal && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-600" />
                Change Job Role (Promotion / Demotion)
              </h3>
              <button
                onClick={() => {
                  setShowRoleModal(false);
                  setSelectedStaff(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-semibold text-slate-900 text-sm">
                  {selectedStaff.firstName} {selectedStaff.lastName}
                </div>
                <div className="text-slate-500">{selectedStaff.email}</div>
                {selectedStaff.phone && (
                  <div className="text-slate-500 text-xs mt-0.5">
                    Phone: {selectedStaff.phone}
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Current Role:</span>
                  <strong className="text-slate-800">
                    {selectedStaff.employee?.jobRole?.name || "Unassigned"}
                  </strong>
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                    Tier {selectedStaff.employee?.jobRole?.tier || 999}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Select New Job Role *
                </label>
                <select
                  value={targetRoleId}
                  onChange={(e) => handleTargetRoleSelect(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-xl bg-white border-slate-200 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  <option value="">-- Choose New Job Role --</option>
                  {availableJobRoles
                    .filter((r) => !r.isSuperadminRole)
                    .map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.name} (Tier {r.tier})
                      </option>
                    ))}
                </select>
              </div>

              {/* Pre-Flight Diff Display */}
              {previewLoading ? (
                <div className="p-4 text-center text-slate-400 italic">
                  Calculating authority diff...
                </div>
              ) : rolePreview ? (
                <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">
                      Change Evaluation:
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        rolePreview.changeType === "PROMOTION"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : rolePreview.changeType === "DEMOTION"
                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                          : "bg-blue-100 text-blue-800 border border-blue-200"
                      }`}
                    >
                      {rolePreview.changeType}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Hierarchy Transition:</span>
                    <strong className="text-slate-900">
                      Tier {rolePreview.oldTier || "—"} → Tier {rolePreview.newTier}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Authority Decision:</span>
                    <span
                      className={`font-semibold ${
                        rolePreview.allowed ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      {rolePreview.allowed
                        ? "✓ Authorized by Hierarchy & Management Scope"
                        : `✕ Denied: ${rolePreview.denialReason}`}
                    </span>
                  </div>

                  {/* Permissions Added / Removed Diff */}
                  {rolePreview.permissionsDiff && (
                    <div className="space-y-1.5 pt-2 border-t border-emerald-100">
                      <div className="font-semibold text-[11px] text-slate-600">
                        Permissions Delta:
                      </div>
                      {rolePreview.permissionsDiff.added?.length > 0 && (
                        <div className="text-[11px] text-emerald-700">
                          <strong>+ Granted ({rolePreview.permissionsDiff.added.length}):</strong>{" "}
                          {rolePreview.permissionsDiff.added.slice(0, 5).join(", ")}
                          {rolePreview.permissionsDiff.added.length > 5 && "..."}
                        </div>
                      )}
                      {rolePreview.permissionsDiff.removed?.length > 0 && (
                        <div className="text-[11px] text-rose-600">
                          <strong>- Revoked ({rolePreview.permissionsDiff.removed.length}):</strong>{" "}
                          {rolePreview.permissionsDiff.removed.slice(0, 5).join(", ")}
                          {rolePreview.permissionsDiff.removed.length > 5 && "..."}
                        </div>
                      )}
                      {rolePreview.permissionsDiff.added?.length === 0 &&
                        rolePreview.permissionsDiff.removed?.length === 0 && (
                          <div className="text-[11px] text-slate-400 italic">
                            No permission differences.
                          </div>
                        )}
                    </div>
                  )}
                </div>
              ) : null}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason for Role Change (Audit Trail)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Demonstrated operations leadership"
                  value={roleChangeReason}
                  onChange={(e) => setRoleChangeReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-xl bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRoleModal(false);
                    setSelectedStaff(null);
                  }}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting || !targetRoleId || (rolePreview && !rolePreview.allowed)}
                  onClick={handleConfirmRoleChange}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold disabled:opacity-50 shadow-xs transition-colors"
                >
                  {submitting ? "Updating Role..." : "Confirm Role Change"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Profile Modal */}
      {showEditModal && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-600" />
                <span>Edit Staff Member</span>
              </h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedStaff(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    First Name *
                  </label>
                  <input
                    required
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) =>
                      setEditForm({ ...editForm, firstName: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Last Name *
                  </label>
                  <input
                    required
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) =>
                      setEditForm({ ...editForm, lastName: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                  placeholder="+91 98765 43210"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={editForm.jobTitle}
                    onChange={(e) =>
                      setEditForm({ ...editForm, jobTitle: e.target.value })
                    }
                    placeholder="e.g. Senior Catalog Manager"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={editForm.department}
                    onChange={(e) =>
                      setEditForm({ ...editForm, department: e.target.value })
                    }
                    placeholder="e.g. Operations"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedStaff(null);
                  }}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold disabled:opacity-50 shadow-xs transition-colors"
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Provision Staff Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCog className="w-5 h-5 text-emerald-600" />
                <span>Provision New Staff Member</span>
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    First Name *
                  </label>
                  <input
                    required
                    type="text"
                    value={createForm.firstName}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, firstName: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Last Name *
                  </label>
                  <input
                    required
                    type="text"
                    value={createForm.lastName}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, lastName: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Email Address *
                  </label>
                  <input
                    required
                    type="email"
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, email: e.target.value })
                    }
                    placeholder="employee@buybox.test"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={createForm.phone}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, phone: e.target.value })
                    }
                    placeholder="+91 98765 43210"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Initial Password *
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
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Dynamic Job Role Selector */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Dynamic Job Role *
                </label>
                <select
                  required
                  value={createForm.jobRoleId}
                  onChange={(e) => {
                    const selected = availableJobRoles.find((r) => r._id === e.target.value);
                    setCreateForm({
                      ...createForm,
                      jobRoleId: e.target.value,
                      role: selected?.slug?.includes("editor") ? "editor" : "admin",
                    });
                  }}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  <option value="">-- Choose Job Role --</option>
                  {availableJobRoles
                    .filter((r) => !r.isSuperadminRole)
                    .map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.name} (Tier {r.tier})
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Authority, permissions, and management scope resolve dynamically from the selected Job Role.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                    placeholder="e.g. Catalog Specialist"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={createForm.department}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, department: e.target.value })
                    }
                    placeholder="e.g. Operations"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold disabled:opacity-50 shadow-xs transition-colors"
                >
                  {submitting ? "Provisioning..." : "Provision Staff Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>Reset Staff Password</span>
              </h2>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setSelectedStaff(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Resetting password for{" "}
              <strong className="text-slate-900">
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
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setSelectedStaff(null);
                  }}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold disabled:opacity-50 shadow-xs transition-colors"
                >
                  {submitting ? "Resetting..." : "Confirm Reset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Toggle Suspend Dialog */}
      <ConfirmDialog
        isOpen={Boolean(staffToToggle)}
        onClose={() => setStaffToToggle(null)}
        onConfirm={handleConfirmToggleSuspend}
        title={
          staffToToggle?.employee?.status === "suspended" || !staffToToggle?.isActive
            ? "Reactivate Staff Member"
            : "Suspend Staff Member"
        }
        description={`Are you sure you want to ${
          staffToToggle?.employee?.status === "suspended" || !staffToToggle?.isActive
            ? "reactivate"
            : "suspend"
        } ${staffToToggle?.firstName || ""} ${staffToToggle?.lastName || ""}?`}
        confirmLabel={
          staffToToggle?.employee?.status === "suspended" || !staffToToggle?.isActive
            ? "Reactivate"
            : "Suspend"
        }
        variant={
          staffToToggle?.employee?.status === "suspended" || !staffToToggle?.isActive
            ? "default"
            : "destructive"
        }
        isLoading={toggleLoading}
      />
    </div>
  );
}
