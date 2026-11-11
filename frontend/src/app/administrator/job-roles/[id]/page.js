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
import { useAdminAuth } from "@/hooks/useAdminAuth.js";
import { SECTION5_CATALOG } from "@/constants/permissions.js";

export default function JobRoleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const roleId = params?.id;

  const { user: currentUser } = useAdminAuth();
  const isSuperadmin =
    ["super_admin", "SUPER_ADMIN", "superadmin"].includes(currentUser?.role) ||
    currentUser?.isSuperadmin;

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

      // Normalize permissionsCatalog to ensure grouped structure:
      // [ { category: "...", permissions: [ { slug, name, description } ] } ]
      let normalizedCatalog = [];
      if (Array.isArray(catalogData) && catalogData.length > 0) {
        if (Array.isArray(catalogData[0]?.permissions)) {
          normalizedCatalog = catalogData;
        } else {
          const groupMap = new Map();
          for (const item of catalogData) {
            const catName =
              item.category ||
              (item.module
                ? item.module.charAt(0).toUpperCase() + item.module.slice(1).replace(/_/g, " ")
                : "General");
            if (!groupMap.has(catName)) {
              groupMap.set(catName, []);
            }
            groupMap.get(catName).push({
              slug: item.slug || item,
              name: item.name || item.slug || item,
              description: item.description || "",
            });
          }
          normalizedCatalog = Array.from(groupMap.entries()).map(
            ([category, permissions]) => ({ category, permissions })
          );
        }
      }

      if (normalizedCatalog.length === 0) {
        normalizedCatalog = Array.from(SECTION5_CATALOG);
      }

      setPermissionsCatalog(normalizedCatalog);

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
        <div className="h-8 bg-slate-100 rounded w-1/4 animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error && !role) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Role Not Found</h2>
        <p className="text-sm text-slate-500">{error}</p>
        <Link
          href="/administrator/job-roles"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs"
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
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">
                {role.name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Tier {role.tier}
              </span>
              {role.isSuperadminRole && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  Superadmin
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-mono">{role.slug}</p>
          </div>
        </div>

        <button
          onClick={handleSaveChanges}
          disabled={saving || role.isSuperadminRole}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Role Settings"}
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

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
            Organizational Tier
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            Tier {role.tier}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {role.tier === 1
              ? "Highest Authority (Platform Superadmin)"
              : `Authority position #${role.tier} in the dynamic hierarchy`}
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
            Assigned Staff
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {role.employeeCount || 0}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Active marketplace employees possessing this Job Role
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
            Configured Permissions
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {role.isSuperadminRole ? "All (*)" : selectedPermissions.size}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {role.isSuperadminRole
              ? "Superadmin bypasses all operational permission checks"
              : "Granular capabilities authorized for this role"}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("permissions")}
          className={`pb-3 border-b-2 font-semibold transition-colors ${
            activeTab === "permissions"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Granular Permissions ({selectedPermissions.size})
        </button>

        <button
          onClick={() => setActiveTab("scope")}
          className={`pb-3 border-b-2 font-semibold transition-colors ${
            activeTab === "scope"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
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
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filter permissions..."
                value={permissionSearch}
                onChange={(e) => setPermissionSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border rounded-xl bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
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
                  className="text-xs font-semibold text-emerald-600 hover:underline"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedPermissions(new Set())}
                  className="text-xs font-semibold text-slate-500 hover:underline"
                >
                  Deselect All
                </button>
              </div>
            )}
          </div>

          {role.isSuperadminRole && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
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
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs"
                >
                  <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
                    <span>{categoryName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-normal text-slate-400">
                        {perms.filter((p) => selectedPermissions.has(p.slug || p)).length} /{" "}
                        {perms.length} enabled
                      </span>
                      {!role.isSuperadminRole && (
                        <button
                          type="button"
                          onClick={() => {
                            const groupSlugs = perms.map((p) => p.slug || p);
                            const allGroupSelected = groupSlugs.every((s) => selectedPermissions.has(s));
                            setSelectedPermissions((prev) => {
                              const next = new Set(prev);
                              groupSlugs.forEach((s) => {
                                if (allGroupSelected) {
                                  next.delete(s);
                                } else {
                                  next.add(s);
                                }
                              });
                              return next;
                            });
                          }}
                          className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 transition-colors ml-2"
                        >
                          {perms.every((p) => selectedPermissions.has(p.slug || p)) ? "Deselect Group" : "Select Group"}
                        </button>
                      )}
                    </div>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {perms.map((p) => {
                      const slug = p.slug || p;
                      const isChecked = selectedPermissions.has(slug);

                      return (
                        <label
                          key={slug}
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                            isChecked
                              ? "bg-emerald-50/70 border-emerald-300 text-slate-900 shadow-2xs"
                              : "bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-50"
                          } ${role.isSuperadminRole ? "cursor-not-allowed opacity-75" : ""}`}
                        >
                          <input
                            type="checkbox"
                            disabled={role.isSuperadminRole}
                            checked={isChecked}
                            onChange={() => togglePermission(slug)}
                            className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div>
                            <div className="font-semibold">{p.name || slug}</div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                              {slug}
                            </div>
                            {p.description && (
                              <div className="text-[11px] text-slate-400 mt-1">
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
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
            <strong>Two-Layer Hierarchy Rule:</strong> Even if an employee possesses{" "}
            <code>employee.create</code> or <code>employee.assign_role</code>, they can ONLY manage
            or assign Job Roles that are (1) at a strictly lower authority tier than themselves,
            AND (2) explicitly enabled in this management scope.
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
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
                      className={`flex items-start justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? "bg-emerald-50/70 border-emerald-300 shadow-2xs"
                          : "bg-slate-50/50 border-slate-200 hover:bg-slate-50"
                      } ${role.isSuperadminRole ? "cursor-not-allowed opacity-75" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          disabled={role.isSuperadminRole}
                          checked={isChecked}
                          onChange={() => toggleScope(targetRole._id)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <div className="font-semibold text-slate-900">
                            {targetRole.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {targetRole.description || targetRole.slug}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          Tier {targetRole.tier}
                        </span>
                        {!isLowerAuthority && (
                          <span
                            className="text-[10px] text-rose-500 font-semibold"
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
