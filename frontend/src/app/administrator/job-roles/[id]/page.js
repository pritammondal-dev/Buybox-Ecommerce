"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Shield,
  ShieldCheck,
  ArrowLeft,
  Users,
  KeyRound,
  Sliders,
  CheckCircle,
  AlertTriangle,
  Save,
  Search,
  Check,
  X,
  History,
} from "lucide-react";
import { jobRoleService, permissionService } from "@/services/admin/admin.service.js";
import { useAuth } from "@/hooks/useAuth.js";

export default function JobRoleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const roleId = params?.id;

  const { user: currentUser } = useAuth();
  const isSuperadmin =
    currentUser?.role === "super_admin" || currentUser?.role === "SUPERADMIN";

  const [role, setRole] = useState(null);
  const [allRoles, setAllRoles] = useState([]);
  const [permissionsCatalog, setPermissionsCatalog] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState(new Set());
  const [selectedScope, setSelectedScope] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [permissionSearch, setPermissionSearch] = useState("");
  const [activeTab, setActiveTab] = useState("permissions"); // 'permissions' | 'scope' | 'employees'

  const fetchRoleData = async () => {
    if (!roleId) return;
    setLoading(true);
    setError(null);
    try {
      const [roleData, allRolesData, catalogData] = await Promise.all([
        jobRoleService.get(roleId),
        jobRoleService.list(),
        permissionService.list(),
      ]);

      const fetchedRole = roleData?.role || roleData;
      setRole(fetchedRole);
      setAllRoles(allRolesData?.roles || []);
      setPermissionsCatalog(catalogData || []);

      setSelectedPermissions(new Set(fetchedRole.permissions || []));
      setSelectedScope(
        new Set(
          (fetchedRole.managementScope || []).map((s) => (s._id ? s._id : s))
        )
      );
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to load Job Role details"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoleData();
  }, [roleId]);

  const togglePermission = (permSlug) => {
    if (role?.isSuperadminRole) return;
    const next = new Set(selectedPermissions);
    if (next.has(permSlug)) {
      next.delete(permSlug);
    } else {
      next.add(permSlug);
    }
    setSelectedPermissions(next);
  };

  const toggleScope = (targetRoleId) => {
    if (role?.isSuperadminRole) return;
    const next = new Set(selectedScope);
    if (next.has(targetRoleId)) {
      next.delete(targetRoleId);
    } else {
      next.add(targetRoleId);
    }
    setSelectedScope(next);
  };

  const handleSaveChanges = async () => {
    if (!role) return;
    setSaving(true);
    setError(null);
    try {
      await jobRoleService.update(role._id, {
        permissions: Array.from(selectedPermissions),
        managementScope: Array.from(selectedScope),
      });
      setSuccessMsg("Job Role permissions and management scope updated successfully!");
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchRoleData();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to update Job Role"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-4">
        <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded w-1/4 animate-pulse" />
        <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error && !role) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Role Not Found</h2>
        <p className="text-sm text-gray-500">{error}</p>
        <Link
          href="/administrator/job-roles"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Job Roles
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Back button & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/administrator/job-roles"
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {role.name}
              </h1>
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                Tier {role.tier}
              </span>
              {role.isSuperadminRole && (
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  Superadmin
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1 font-mono">{role.slug}</p>
          </div>
        </div>

        <button
          onClick={handleSaveChanges}
          disabled={saving || role.isSuperadminRole}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Role Settings"}
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

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">
            Organizational Tier
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            Tier {role.tier}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {role.tier === 1
              ? "Highest Authority (Platform Superadmin)"
              : `Authority position #${role.tier} in the dynamic hierarchy`}
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">
            Assigned Staff
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {role.employeeCount || 0}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Active marketplace employees possessing this Job Role
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">
            Configured Permissions
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {role.isSuperadminRole ? "All (*)" : selectedPermissions.size}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {role.isSuperadminRole
              ? "Superadmin bypasses all operational permission checks"
              : "Granular capabilities authorized for this role"}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("permissions")}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === "permissions"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Granular Permissions ({selectedPermissions.size})
        </button>

        <button
          onClick={() => setActiveTab("scope")}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === "scope"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Management Scope ({selectedScope.size})
        </button>
      </div>

      {/* Permissions Tab */}
      {activeTab === "permissions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Filter permissions..."
                value={permissionSearch}
                onChange={(e) => setPermissionSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {!role.isSuperadminRole && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allSlugs = (permissionsCatalog || []).flatMap((c) =>
                      (c.permissions || []).map((p) => p.slug || p)
                    );
                    setSelectedPermissions(new Set(allSlugs));
                  }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Select All
                </button>
                <span className="text-gray-300 dark:text-gray-700">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedPermissions(new Set())}
                  className="text-xs text-gray-500 hover:underline"
                >
                  Deselect All
                </button>
              </div>
            )}
          </div>

          {role.isSuperadminRole && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-900 dark:text-amber-200">
              Platform Superadmin possesses unrestricted authority across all operational and
              governance capabilities. Permissions for Superadmin cannot be restricted.
            </div>
          )}

          {/* Grouped Permissions Grid */}
          <div className="space-y-6">
            {(permissionsCatalog || []).map((categoryGroup) => {
              const categoryName = categoryGroup.category || categoryGroup.name || "General";
              const perms = (categoryGroup.permissions || []).filter(
                (p) =>
                  (p.slug || p).toLowerCase().includes(permissionSearch.toLowerCase()) ||
                  (p.name || "").toLowerCase().includes(permissionSearch.toLowerCase())
              );

              if (perms.length === 0) return null;

              return (
                <div
                  key={categoryName}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4"
                >
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center justify-between">
                    <span>{categoryName}</span>
                    <span className="text-xs font-normal text-gray-400">
                      {perms.filter((p) => selectedPermissions.has(p.slug || p)).length} /{" "}
                      {perms.length} enabled
                    </span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {perms.map((p) => {
                      const slug = p.slug || p;
                      const isChecked = selectedPermissions.has(slug);

                      return (
                        <label
                          key={slug}
                          className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                            isChecked
                              ? "bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/60 text-gray-900 dark:text-white"
                              : "bg-gray-50/50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"
                          } ${role.isSuperadminRole ? "cursor-not-allowed opacity-75" : ""}`}
                        >
                          <input
                            type="checkbox"
                            disabled={role.isSuperadminRole}
                            checked={isChecked}
                            onChange={() => togglePermission(slug)}
                            className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div>
                            <div className="font-semibold">{p.name || slug}</div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                              {slug}
                            </div>
                            {p.description && (
                              <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                                {p.description}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scope Tab */}
      {activeTab === "scope" && (
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300">
            <strong>Two-Layer Hierarchy Rule:</strong> Even if an employee possesses{" "}
            <code>employee.create</code> or <code>employee.assign_role</code>, they can ONLY manage
            or assign Job Roles that are (1) at a strictly lower authority tier than themselves,
            AND (2) explicitly enabled in this management scope.
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
              Subordinate Roles in Scope
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allRoles
                .filter((r) => r._id !== role._id && !r.isSuperadminRole)
                .map((targetRole) => {
                  const isChecked = selectedScope.has(targetRole._id);
                  const isLowerAuthority = targetRole.tier > role.tier;

                  return (
                    <label
                      key={targetRole._id}
                      className={`flex items-start justify-between p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? "bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/60"
                          : "bg-gray-50/50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-800"
                      } ${role.isSuperadminRole ? "cursor-not-allowed opacity-75" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          disabled={role.isSuperadminRole}
                          checked={isChecked}
                          onChange={() => toggleScope(targetRole._id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {targetRole.name}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {targetRole.description || targetRole.slug}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                          Tier {targetRole.tier}
                        </span>
                        {!isLowerAuthority && (
                          <span
                            className="text-[10px] text-red-500 font-semibold"
                            title="Same or higher tier roles cannot be managed even if selected"
                          >
                            (Tier Conflict)
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
