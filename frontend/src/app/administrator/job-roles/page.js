"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  Plus,
  Search,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Save,
  CheckCircle,
  AlertTriangle,
  Users,
  KeyRound,
  Edit2,
  Trash2,
  RefreshCw,
  Eye,
  Sliders,
  X,
  HelpCircle,
} from "lucide-react";
import { jobRoleService, permissionService } from "@/services/admin/admin.service.js";
import { useAdminAuth } from "@/hooks/useAdminAuth.js";

export default function JobRolesPage() {
  const { user: currentUser } = useAdminAuth();
  const isSuperadmin =
    ["super_admin", "SUPER_ADMIN", "superadmin"].includes(currentUser?.role) ||
    currentUser?.isSuperadmin;

  const [roles, setRoles] = useState([]);
  const [originalOrder, setOriginalOrder] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingOrder, setSavingOrder] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivatingRole, setDeactivatingRole] = useState(null);
  const [replacementRoleId, setReplacementRoleId] = useState("");
  const [migrationPreview, setMigrationPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Available permissions & catalogs
  const [allPermissions, setAllPermissions] = useState([]);

  // Create/Edit form state
  const [roleForm, setRoleForm] = useState({
    name: "",
    slug: "",
    description: "",
    permissions: [],
    managementScope: [],
  });
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Drag and Drop State
  const draggedIndexRef = useRef(null);

  const fetchRoles = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await jobRoleService.list();
      const fetchedRoles = res?.roles || [];
      // Sort by tier ascending
      fetchedRoles.sort((a, b) => a.tier - b.tier);
      setRoles(fetchedRoles);
      setOriginalOrder(fetchedRoles.map((r) => r._id));
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load Job Roles");
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissionsCatalog = async () => {
    try {
      const perms = await permissionService.list();
      setAllPermissions(perms || []);
    } catch (err) {
      console.warn("Failed to load permissions catalog:", err);
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchPermissionsCatalog();
  }, []);

  const hasOrderChanged = () => {
    if (roles.length !== originalOrder.length) return true;
    return roles.some((r, idx) => r._id !== originalOrder[idx]);
  };

  // Reordering handlers
  const handleDragStart = (e, index) => {
    draggedIndexRef.current = index;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    const sourceIndex = draggedIndexRef.current;
    if (sourceIndex === null || sourceIndex === targetIndex) return;

    // Superadmin (index 0) cannot be dragged or displaced from Tier 1
    if (sourceIndex === 0 || targetIndex === 0) {
      setError("Superadmin must permanently remain at Tier 1 priority.");
      setTimeout(() => setError(null), 4000);
      return;
    }

    const updated = [...roles];
    const [moved] = updated.splice(sourceIndex, 1);
    updated.splice(targetIndex, 0, moved);

    // Recalculate tiers live
    const withNewTiers = updated.map((r, idx) => ({
      ...r,
      tier: idx + 1,
    }));

    setRoles(withNewTiers);
    draggedIndexRef.current = null;
  };

  const moveRole = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 1 || targetIndex >= roles.length) return; // Prevent displacing Superadmin at index 0

    const updated = [...roles];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    const withNewTiers = updated.map((r, idx) => ({
      ...r,
      tier: idx + 1,
    }));

    setRoles(withNewTiers);
  };

  const handleSaveOrder = async () => {
    setSavingOrder(true);
    setError(null);
    try {
      const orderedIds = roles.map((r) => r._id);
      await jobRoleService.reorder(orderedIds);
      setOriginalOrder(orderedIds);
      setSuccessMsg("Role hierarchy priority updated successfully! Tiers recalculated.");
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchRoles();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to save hierarchy");
    } finally {
      setSavingOrder(false);
    }
  };

  // Create Role handlers
  const handleOpenCreateModal = () => {
    setRoleForm({
      name: "",
      slug: "",
      description: "",
      permissions: [],
      managementScope: [],
    });
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setError(null);
    try {
      await jobRoleService.create(roleForm);
      setShowCreateModal(false);
      setSuccessMsg(`Custom Job Role "${roleForm.name}" created successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchRoles();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to create Job Role");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Edit Role handlers
  const handleOpenEditModal = (role) => {
    setEditingRole(role);
    setRoleForm({
      name: role.name,
      slug: role.slug,
      description: role.description || "",
      permissions: role.permissions || [],
      managementScope: (role.managementScope || []).map((s) => (s._id ? s._id : s)),
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setError(null);
    try {
      await jobRoleService.update(editingRole._id, roleForm);
      setShowEditModal(false);
      setSuccessMsg(`Job Role "${roleForm.name}" updated successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchRoles();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to update Job Role");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Deactivation & Migration Handlers
  const handleOpenDeactivateModal = async (role) => {
    setDeactivatingRole(role);
    setReplacementRoleId("");
    setMigrationPreview(null);
    setShowDeactivateModal(true);
  };

  const handleReplacementRoleChange = async (targetRoleId) => {
    setReplacementRoleId(targetRoleId);
    if (!targetRoleId || !deactivatingRole) return;
    setPreviewLoading(true);
    try {
      const preview = await jobRoleService.previewMigration(
        deactivatingRole._id,
        targetRoleId
      );
      setMigrationPreview(preview);
    } catch (err) {
      console.warn("Failed migration preview:", err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (deactivatingRole?.employeeCount > 0 && !replacementRoleId) {
      setError("Please select a replacement Job Role for active employees.");
      return;
    }
    setFormSubmitting(true);
    setError(null);
    try {
      await jobRoleService.deactivate(
        deactivatingRole._id,
        replacementRoleId || undefined
      );
      setShowDeactivateModal(false);
      setSuccessMsg(
        `Job Role "${deactivatingRole.name}" deactivated and ${
          migrationPreview?.employeeCount || 0
        } employees migrated successfully.`
      );
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchRoles();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to deactivate role");
    } finally {
      setFormSubmitting(false);
    }
  };

  const filteredRoles = roles.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Job Roles &amp; Hierarchy
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Superadmin Only
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Dynamic database-backed organizational authority. Reorder roles to adjust
            authority tiers, define management scopes, and configure granular permissions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hasOrderChanged() && (
            <button
              onClick={handleSaveOrder}
              disabled={savingOrder}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-all focus:ring-2 focus:ring-emerald-500 focus:outline-hidden disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {savingOrder ? "Saving..." : "Save Hierarchy Priority"}
            </button>
          )}

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-[#004D38] hover:bg-[#003828] shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Job Role
          </button>
        </div>
      </div>

      {/* Alert Banners */}
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

      {/* Reorder Helper Banner */}
      <div className="p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-start gap-3 text-sm text-amber-900 shadow-2xs">
        <HelpCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
        <div>
          <span className="font-semibold">Draggable Role Priority &amp; Tier System:</span> Lower
          tier numbers indicate higher authority (e.g. Tier 1 is top authority). Drag a role or
          use the up/down arrows to change priority. A role can only manage roles positioned at a
          lower authority tier and included in its database-backed management scope.
        </div>
      </div>

      {/* Toolbar / Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search roles by name or slug..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
          />
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-4">
          <span>Total Roles: <strong className="text-slate-900">{roles.length}</strong></span>
          <span>Active: <strong className="text-emerald-700">{roles.filter((r) => r.isActive).length}</strong></span>
        </div>
      </div>

      {/* Role Hierarchy List / Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-20 bg-slate-100 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : filteredRoles.length === 0 ? (
        <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <ShieldAlert className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900">
            No Job Roles Found
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {searchTerm ? "No roles match your search term." : "Create your first Job Role to begin."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRoles.map((role, idx) => {
            const isProtected = role.isSuperadminRole;
            const isTopTier = role.tier === 1;

            return (
              <div
                key={role._id}
                draggable={!isProtected}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                className={`flex flex-col md:flex-row md:items-center justify-between p-5 bg-white border rounded-2xl shadow-xs transition-all duration-200 gap-4 ${
                  isTopTier
                    ? "border-emerald-300 bg-emerald-50/25"
                    : "border-slate-200/80 hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                {/* Left: Drag Handle, Tier, Role Info */}
                <div className="flex items-center gap-3">
                  {/* Drag Handle / Reorder Controls */}
                  <div className="flex items-center gap-1">
                    <div
                      className={`p-1.5 rounded text-gray-400 ${
                        isProtected
                          ? "cursor-not-allowed opacity-30"
                          : "cursor-grab active:cursor-grabbing hover:text-gray-600"
                      }`}
                      title={isProtected ? "Superadmin Tier 1 is immutable" : "Drag to reorder hierarchy"}
                    >
                      <GripVertical className="w-5 h-5" />
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveRole(idx, -1)}
                        disabled={idx <= 1 || isProtected}
                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                        title="Move up in hierarchy"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveRole(idx, 1)}
                        disabled={idx === 0 || idx === roles.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                        title="Move down in hierarchy"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Tier Badge */}
                  <div
                    className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl font-bold text-sm ${
                      isTopTier
                        ? "bg-amber-50 text-amber-800 border border-amber-200"
                        : role.tier <= 3
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-slate-50 text-slate-800 border border-slate-200"
                    }`}
                  >
                    <span className="text-[10px] uppercase font-semibold leading-tight">Tier</span>
                    <span className="text-base">{role.tier}</span>
                  </div>

                  {/* Role Name & Meta */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-base">
                        {role.name}
                      </h4>

                      {role.isSuperadminRole && (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-50 text-amber-800 border border-amber-200">
                          Superadmin
                        </span>
                      )}

                      {role.isSystemRole && !role.isSuperadminRole && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-100 text-slate-700 border border-slate-200">
                          System Role
                        </span>
                      )}

                      {!role.isActive && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-rose-50 text-rose-800 border border-rose-200">
                          Inactive
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                      {role.description || "No description provided"}
                    </p>
                  </div>
                </div>

                {/* Middle: Metrics & Scope */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pl-16 md:pl-0">
                  <div className="flex items-center gap-1.5" title="Assigned Employees">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span>
                      <strong className="text-slate-900">
                        {role.employeeCount || 0}
                      </strong>{" "}
                      employees
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5" title="Configured Permissions">
                    <KeyRound className="w-4 h-4 text-slate-400" />
                    <span>
                      <strong className="text-slate-900">
                        {role.isSuperadminRole ? "Full Authority (*)" : (role.permissions || []).length}
                      </strong>{" "}
                      permissions
                    </span>
                  </div>

                  {/* Management Scope summary */}
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-500">Scope:</span>
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {role.isSuperadminRole ? (
                        <span className="text-[11px] font-semibold text-emerald-700">
                          All lower tiers
                        </span>
                      ) : !role.managementScope || role.managementScope.length === 0 ? (
                        <span className="text-[11px] text-slate-400 italic">None</span>
                      ) : (
                        role.managementScope.map((scopeItem) => (
                          <span
                            key={scopeItem._id || scopeItem}
                            className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-md text-[10px] font-medium"
                          >
                            {scopeItem.name || scopeItem.slug || "Role"}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 justify-end pl-16 md:pl-0">
                  <Link
                    href={`/administrator/job-roles/${role._id}`}
                    className="p-2 text-slate-600 hover:text-emerald-700 rounded-xl hover:bg-slate-100 transition-colors"
                    title="View Role Details & Full Permissions"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>

                  <button
                    onClick={() => handleOpenEditModal(role)}
                    className="p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
                    title="Edit Role"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {!role.isSuperadminRole && (
                    <button
                      onClick={() => handleOpenDeactivateModal(role)}
                      className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors"
                      title="Deactivate Role & Migrate Employees"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Job Role Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                Create Dynamic Job Role
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Role Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Catalog Specialist"
                    value={roleForm.name}
                    onChange={(e) =>
                      setRoleForm({
                        ...roleForm,
                        name: e.target.value,
                        slug: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-|-$/g, ""),
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Slug Identifier *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. catalog-specialist"
                    value={roleForm.slug}
                    onChange={(e) => setRoleForm({ ...roleForm, slug: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Outline responsibilities and operational expectations..."
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Management Scope Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Database-Backed Management Scope
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Select which lower-tier Job Roles employees with this role are authorized to manage:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-40 overflow-y-auto">
                  {roles
                    .filter((r) => !r.isSuperadminRole)
                    .map((targetRole) => (
                      <label
                        key={targetRole._id}
                        className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={roleForm.managementScope.includes(targetRole._id)}
                          onChange={(e) => {
                            const current = [...roleForm.managementScope];
                            if (e.target.checked) {
                              setRoleForm({
                                ...roleForm,
                                managementScope: [...current, targetRole._id],
                              });
                            } else {
                              setRoleForm({
                                ...roleForm,
                                managementScope: current.filter((id) => id !== targetRole._id),
                              });
                            }
                          }}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>{targetRole.name} (Tier {targetRole.tier})</span>
                      </label>
                    ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs disabled:opacity-50"
                >
                  {formSubmitting ? "Creating..." : "Create Job Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Job Role Modal */}
      {showEditModal && editingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                Edit Job Role: {editingRole.name}
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Role Name
                </label>
                <input
                  type="text"
                  required
                  disabled={editingRole.isSuperadminRole}
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Management Scope Selection */}
              {!editingRole.isSuperadminRole && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Management Scope
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    Authorized subordinate roles (only lower tiers can be managed):
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-40 overflow-y-auto">
                    {roles
                      .filter((r) => r._id !== editingRole._id && !r.isSuperadminRole)
                      .map((targetRole) => (
                        <label
                          key={targetRole._id}
                          className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={roleForm.managementScope.includes(targetRole._id)}
                            onChange={(e) => {
                              const current = [...roleForm.managementScope];
                              if (e.target.checked) {
                                setRoleForm({
                                  ...roleForm,
                                  managementScope: [...current, targetRole._id],
                                });
                              } else {
                                setRoleForm({
                                  ...roleForm,
                                  managementScope: current.filter((id) => id !== targetRole._id),
                                });
                              }
                            }}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>
                            {targetRole.name} (Tier {targetRole.tier})
                          </span>
                        </label>
                      ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <Link
                  href={`/administrator/job-roles/${editingRole._id}`}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  Configure Granular Permissions →
                </Link>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs disabled:opacity-50"
                  >
                    {formSubmitting ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate & Migrate Modal */}
      {showDeactivateModal && deactivatingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 my-8">
            <div className="flex items-center gap-3 text-rose-600 mb-2">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-lg font-bold text-slate-900">
                Deactivate Job Role
              </h3>
            </div>

            <p className="text-sm text-slate-600 mt-2">
              Are you sure you want to deactivate{" "}
              <strong className="text-slate-900">{deactivatingRole.name}</strong>?
            </p>

            {deactivatingRole.employeeCount > 0 ? (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-3 text-amber-900">
                <p className="font-semibold">
                  MANDATORY EMPLOYEE MIGRATION: This role currently has{" "}
                  <strong>{deactivatingRole.employeeCount}</strong> active employee(s) assigned.
                </p>
                <p>
                  To preserve authorization safety, all assigned employees must be atomically
                  migrated to an active replacement Job Role before deactivation:
                </p>

                <div>
                  <label className="block font-semibold mb-1">
                    Select Replacement Job Role *
                  </label>
                  <select
                    value={replacementRoleId}
                    onChange={(e) => handleReplacementRoleChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    <option value="">-- Choose replacement role --</option>
                    {roles
                      .filter((r) => r._id !== deactivatingRole._id && r.isActive)
                      .map((r) => (
                        <option key={r._id} value={r._id}>
                          {r.name} (Tier {r.tier})
                        </option>
                      ))}
                  </select>
                </div>

                {previewLoading ? (
                  <p className="text-slate-500 italic">Calculating migration preview...</p>
                ) : migrationPreview ? (
                  <div className="p-2.5 bg-white rounded-xl border border-amber-300 space-y-1">
                    <p>
                      <strong>Affected Employees:</strong> {migrationPreview.employeeCount}
                    </p>
                    <p>
                      <strong>Target Role:</strong> {migrationPreview.replacementRole?.name} (Tier{" "}
                      {migrationPreview.replacementRole?.tier})
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-slate-500 mt-2">
                No active employees are currently assigned to this role. It can be safely
                deactivated without migration.
              </p>
            )}

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeactivateModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={formSubmitting || (deactivatingRole.employeeCount > 0 && !replacementRoleId)}
                onClick={handleConfirmDeactivate}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs disabled:opacity-50"
              >
                {formSubmitting ? "Migrating & Deactivating..." : "Confirm Deactivation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
