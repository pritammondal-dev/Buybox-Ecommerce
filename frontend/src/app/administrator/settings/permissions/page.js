"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Save,
  RotateCcw,
  RefreshCw,
  Search,
  Table,
  Grid,
  CheckSquare,
  Square,
  Lock,
  UserCheck,
} from "lucide-react";
import {
  staffService,
  permissionService,
} from "@/services/admin/admin.service.js";
import { useAdminAuth } from "@/hooks/useAdminAuth.js";
import { SECTION5_CATALOG } from "@/constants/permissions.js";

// Map SECTION5_CATALOG into UI permission groups
const PERMISSION_GROUPS = SECTION5_CATALOG.map((group) => ({
  namespace: group.category,
  permissions: group.permissions.map((p) => ({
    slug: p.slug,
    label: p.name,
    desc: p.description,
  })),
}));

// Comprehensive matrix definition covering all platform domains and features
const MATRIX_MODULES = [
  { module: "Dashboard", view: "dashboard.view", create: null, edit: null, delete: null, approve: null, export: null },
  { module: "Customers", view: "customers.view", create: "customers.create", edit: "customers.edit", delete: "customers.suspend", approve: null, export: "customers.export" },
  { module: "Vendors", view: "vendors.view", create: null, edit: "vendors.edit", delete: "vendors.suspend", approve: "vendors.approve", export: "vendors.export" },
  { module: "Vendor Bank Accounts", view: "vendors.bank_accounts.view", create: "vendors.bank_accounts.review", edit: "vendors.bank_accounts.manage", delete: "vendors.bank_accounts.reject", approve: "vendors.bank_accounts.approve", export: "vendors.bank_accounts.view_unmasked" },
  { module: "Partner Banks", view: "partner_banks.view", create: null, edit: "partner_banks.manage", delete: null, approve: null, export: null },
  { module: "Vendor KYC & Compliance", view: "vendors.kyc.view", create: "vendors.kyc.review", edit: null, delete: "vendors.kyc.reject", approve: "vendors.kyc.approve", export: null },
  { module: "Products", view: "products.view", create: "products.create", edit: "products.edit", delete: "products.delete", approve: "products.approve", export: "products.export" },
  { module: "Categories", view: "categories.view", create: "categories.create", edit: "categories.edit", delete: "categories.delete", approve: null, export: null },
  { module: "Brands", view: "brands.view", create: "brands.create", edit: "brands.edit", delete: "brands.delete", approve: null, export: null },
  { module: "Attributes", view: "attributes.view", create: "attributes.create", edit: "attributes.edit", delete: "attributes.delete", approve: null, export: null },
  { module: "Inventory", view: "inventory.view", create: "inventory.create", edit: "inventory.manage", delete: null, approve: "inventory.adjust", export: "inventory.export" },
  { module: "Warehouses", view: "warehouses.view", create: "warehouses.create", edit: "warehouses.manage", delete: "warehouses.delete", approve: "warehouses.manage_inventory", export: null },
  { module: "Orders", view: "orders.view", create: null, edit: "orders.edit", delete: "orders.cancel", approve: "orders.manage", export: "orders.export" },
  { module: "Returns", view: "returns.view", create: null, edit: null, delete: "returns.reject", approve: "returns.approve", export: null },
  { module: "Refunds", view: "refunds.view", create: "refunds.create", edit: null, delete: null, approve: "refunds.approve", export: null },
  { module: "Payments", view: "payments.view", create: null, edit: "payments.manage", delete: null, approve: "payments.reconcile", export: null },
  { module: "Settlements", view: "settlements.view", create: null, edit: "settlements.manage", delete: null, approve: null, export: null },
  { module: "Finance & Ledgers", view: "finance.view", create: null, edit: "finance.manage", delete: null, approve: null, export: null },
  { module: "Shipping", view: "shipping.view", create: null, edit: "shipping.manage", delete: null, approve: null, export: null },
  { module: "Coupons", view: "coupons.view", create: "coupons.create", edit: "coupons.edit", delete: "coupons.delete", approve: null, export: null },
  { module: "Discounts", view: "discounts.view", create: null, edit: "discounts.manage", delete: null, approve: "promotions.override_floor", export: null },
  { module: "Campaigns", view: "campaigns.view", create: "campaigns.create", edit: "campaigns.edit", delete: "campaigns.delete", approve: null, export: null },
  { module: "CMS Content", view: "cms.view", create: "cms.create", edit: "cms.edit", delete: "cms.delete", approve: "cms.publish", export: null },
  { module: "CMS Special Events", view: "cms.events.view", create: null, edit: "cms.events.manage", delete: null, approve: null, export: null },
  { module: "Reviews", view: "reviews.view", create: null, edit: "reviews.moderate", delete: null, approve: null, export: null },
  { module: "Support Tickets", view: "support.view", create: null, edit: "support.respond", delete: null, approve: "support.assign", export: null },
  { module: "Analytics", view: "analytics.view", create: null, edit: null, delete: null, approve: null, export: "analytics.export" },
  { module: "Tasks", view: "tasks.view", create: "tasks.create", edit: "tasks.edit", delete: null, approve: "tasks.complete", export: null },
  { module: "Activity Logs", view: "activity_logs.view", create: null, edit: null, delete: null, approve: null, export: "activity_logs.export" },
  { module: "Staff", view: "staff.view", create: "staff.create", edit: "staff.edit", delete: "staff.suspend", approve: null, export: null },
  { module: "Job Roles", view: "job_roles.view", create: "job_roles.create", edit: "job_roles.edit", delete: "job_roles.delete", approve: "job_roles.reorder", export: "job_roles.migrate" },
  { module: "Employee Governance", view: "employee.view", create: "employee.create", edit: "employee.edit", delete: "employee.delete", approve: "employee.assign_role", export: "governance.superadmin_transfer" },
  { module: "Permissions", view: "permissions.view", create: null, edit: "permissions.manage", delete: null, approve: null, export: null },
  { module: "Tax Rules", view: "tax.view", create: null, edit: "tax.manage", delete: null, approve: null, export: null },
  { module: "Platform Settings", view: "platform_settings.view", create: null, edit: "platform_settings.manage", delete: null, approve: null, export: null },
  { module: "Platform Credentials", view: "platform_credentials.view", create: null, edit: "platform_credentials.manage", delete: null, approve: null, export: null },
  { module: "Authentication Methods", view: "authentication.login_methods.read", create: null, edit: "authentication.login_methods.manage", delete: null, approve: null, export: null },
];

export default function PermissionSettingsPage() {
  const { user: currentUser } = useAdminAuth();
  const isSuperadmin =
    ["super_admin", "SUPER_ADMIN", "superadmin"].includes(currentUser?.role) ||
    currentUser?.isSuperadmin;

  const [staffList, setStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedStaffDetails, setSelectedStaffDetails] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState(new Set());
  const [persistedPermissions, setPersistedPermissions] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [viewMode, setViewMode] = useState("matrix");
  const [searchFilter, setSearchFilter] = useState("");

  // Load staff list
  useEffect(() => {
    async function loadStaff() {
      setLoading(true);
      try {
        const result = await staffService.list({ limit: 100 });
        const list = result?.staff || [];
        setStaffList(list);

        // Auto-select first non-superadmin staff member if available
        const firstEditable = list.find((s) => s.role !== "super_admin");
        if (firstEditable) {
          setSelectedStaffId(firstEditable.id);
        } else if (list.length > 0) {
          setSelectedStaffId(list[0].id);
        }
      } catch (err) {
        setError("Failed to load staff list");
      } finally {
        setLoading(false);
      }
    }
    loadStaff();
  }, []);

  // Load selected staff details and permissions
  useEffect(() => {
    if (!selectedStaffId) return;

    async function loadDetails() {
      setLoading(true);
      setError(null);
      try {
        const details = await staffService.get(selectedStaffId);
        setSelectedStaffDetails(details);
        const perms = new Set(details?.permissions || []);
        setSelectedPermissions(perms);
        setPersistedPermissions(new Set(perms));
      } catch (err) {
        setError("Failed to load employee permissions");
      } finally {
        setLoading(false);
      }
    }
    loadDetails();
  }, [selectedStaffId]);

  // Compute dirty state and diff counts
  const { isDirty, addedCount, removedCount } = useMemo(() => {
    let added = 0;
    let removed = 0;

    for (const p of selectedPermissions) {
      if (!persistedPermissions.has(p)) added++;
    }
    for (const p of persistedPermissions) {
      if (!selectedPermissions.has(p)) removed++;
    }

    const dirty = added > 0 || removed > 0;
    return { isDirty: dirty, addedCount: added, removedCount: removed };
  }, [selectedPermissions, persistedPermissions]);

  const isSelectedUserSuperadmin = useMemo(() => {
    const role = (selectedStaffDetails?.role || "").toLowerCase();
    return role === "super_admin" || role === "superadmin";
  }, [selectedStaffDetails]);

  const togglePermission = (slug) => {
    if (!slug || isSelectedUserSuperadmin) return;
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  // Row-level selection toggle for matrix view
  const handleToggleRow = (row) => {
    if (isSelectedUserSuperadmin) return;
    const rowSlugs = [row.view, row.create, row.edit, row.delete, row.approve, row.export].filter(Boolean);
    if (rowSlugs.length === 0) return;

    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      const allSelected = rowSlugs.every((slug) => next.has(slug));
      rowSlugs.forEach((slug) => {
        if (allSelected) {
          next.delete(slug);
        } else {
          next.add(slug);
        }
      });
      return next;
    });
  };

  // Group toggle for card view
  const handleSelectAllGroup = (permissions) => {
    if (isSelectedUserSuperadmin) return;
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      const allSelected = permissions.every((p) => next.has(p.slug));
      permissions.forEach((p) => {
        if (allSelected) {
          next.delete(p.slug);
        } else {
          next.add(p.slug);
        }
      });
      return next;
    });
  };

  // Get all visible permission slugs based on current view and search filter
  const getVisibleSlugs = () => {
    const slugs = new Set();
    const filter = searchFilter.toLowerCase();

    if (viewMode === "matrix") {
      MATRIX_MODULES.filter((m) => m.module.toLowerCase().includes(filter)).forEach((row) => {
        [row.view, row.create, row.edit, row.delete, row.approve, row.export].forEach((s) => {
          if (s) slugs.add(s);
        });
      });
    } else {
      PERMISSION_GROUPS.filter(
        (g) =>
          g.namespace.toLowerCase().includes(filter) ||
          g.permissions.some((p) => p.label.toLowerCase().includes(filter) || p.slug.toLowerCase().includes(filter))
      ).forEach((group) => {
        group.permissions.forEach((p) => slugs.add(p.slug));
      });
    }
    return Array.from(slugs);
  };

  const handleSelectAllVisible = () => {
    if (isSelectedUserSuperadmin) return;
    const visibleSlugs = getVisibleSlugs();
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      visibleSlugs.forEach((s) => next.add(s));
      return next;
    });
  };

  const handleClearAllVisible = () => {
    if (isSelectedUserSuperadmin) return;
    const visibleSlugs = getVisibleSlugs();
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      visibleSlugs.forEach((s) => next.delete(s));
      return next;
    });
  };

  const handleResetChanges = () => {
    setSelectedPermissions(new Set(persistedPermissions));
    setError(null);
    setSuccess(null);
  };

  const handleSavePermissions = async () => {
    if (!selectedStaffDetails?.employee?.id) {
      setError("Selected staff member lacks an employee profile record");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const permissionArray = Array.from(selectedPermissions);
      await permissionService.updateEmployeePermissions(
        selectedStaffDetails.employee.id,
        permissionArray
      );

      // Reload authoritative persisted state from server to guarantee sync
      const freshDetails = await staffService.get(selectedStaffId);
      setSelectedStaffDetails(freshDetails);
      const freshPerms = new Set(freshDetails?.permissions || []);
      setSelectedPermissions(freshPerms);
      setPersistedPermissions(new Set(freshPerms));

      setSuccess(
        `Permissions updated for ${selectedStaffDetails.firstName || "employee"}. ${freshPerms.size} active permissions saved with immediate session version bump.`
      );
      setTimeout(() => setSuccess(null), 6000);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update employee permissions"
      );
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadge = (roleName) => {
    const r = (roleName || "").toLowerCase();
    if (r === "super_admin" || r === "superadmin") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200 uppercase">
          <ShieldCheck className="size-3 text-purple-700" />
          Superadmin
        </span>
      );
    }
    if (r === "admin") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200 uppercase">
          <UserCheck className="size-3 text-blue-700" />
          Admin
        </span>
      );
    }
    if (r === "manager") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase">
          Manager
        </span>
      );
    }
    if (r === "editor") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase">
          Editor
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 uppercase">
        {roleName || "Staff"}
      </span>
    );
  };

  if (!isSuperadmin) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <AlertTriangle className="size-8 text-amber-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Access Restricted</h2>
        <p className="text-xs text-slate-500 mt-1">
          Only Superadmin has authorization to manage the staff permission matrix.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <KeyRound className="size-6 text-emerald-600" />
            <span>Role &amp; Permission Governance</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Superadmin-controlled granular permission matrix across all 35+ platform modules with instant session revocation
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("matrix")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === "matrix" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Table className="size-3.5" />
              <span>Matrix Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === "cards" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Grid className="size-3.5" />
              <span>Category Cards</span>
            </button>
          </div>

          {/* Reset Changes Button */}
          {isDirty && (
            <button
              type="button"
              onClick={handleResetChanges}
              disabled={saving || loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all shadow-xs"
            >
              <RotateCcw className="size-3.5" />
              <span>Reset</span>
            </button>
          )}

          {/* Save Button */}
          <button
            onClick={handleSavePermissions}
            disabled={saving || loading || !isDirty || isSelectedUserSuperadmin}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className={`size-4 ${saving ? "animate-spin" : ""}`} />
            <span>{saving ? "Saving Changes..." : "Save Permissions"}</span>
          </button>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5">
          <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2.5">
          <AlertTriangle className="size-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Staff Member Selector & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
            Employee:
          </label>
          <select
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            className="w-full md:w-80 px-3.5 py-2 text-sm font-semibold text-slate-800 border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName} ({s.role?.toUpperCase()}) — {s.email}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Quick Select Actions */}
          {!isSelectedUserSuperadmin && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                title="Select all visible permissions"
              >
                <CheckSquare className="size-3 text-emerald-600" />
                <span>Select All Visible</span>
              </button>
              <button
                type="button"
                onClick={handleClearAllVisible}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                title="Clear all visible permissions"
              >
                <Square className="size-3 text-rose-600" />
                <span>Clear All Visible</span>
              </button>
            </div>
          )}

          <div className="relative flex-1 md:w-60">
            <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search module or permission..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {selectedStaffDetails && (
            <div className="flex items-center gap-2.5 text-xs text-slate-600 whitespace-nowrap">
              {getRoleBadge(selectedStaffDetails.role)}
              <span>•</span>
              <span>
                Effective: <strong className="text-emerald-700 font-bold">{selectedPermissions.size}</strong>
              </span>
              {isDirty && (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Unsaved ({addedCount > 0 ? `+${addedCount}` : ""}{addedCount > 0 && removedCount > 0 ? ", " : ""}{removedCount > 0 ? `-${removedCount}` : ""})
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {isSelectedUserSuperadmin && (
        <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs flex items-center gap-3">
          <ShieldCheck className="size-5 text-purple-600 shrink-0" />
          <div>
            <strong className="font-bold">Protected Superadmin Role:</strong> Superadmin holds platform-level root authority and unconditionally possesses all permissions. Superadmin permissions cannot be modified, restricted, or revoked via this interface.
          </div>
        </div>
      )}

      {/* MATRIX TABLE VIEW */}
      {viewMode === "matrix" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Module Name</th>
                  <th className="px-3 py-4 text-center">Row Quick Toggle</th>
                  <th className="px-4 py-4 text-center">View</th>
                  <th className="px-4 py-4 text-center">Create</th>
                  <th className="px-4 py-4 text-center">Edit</th>
                  <th className="px-4 py-4 text-center">Delete</th>
                  <th className="px-4 py-4 text-center">Approve</th>
                  <th className="px-4 py-4 text-center">Export / Special</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {MATRIX_MODULES.filter((m) =>
                  m.module.toLowerCase().includes(searchFilter.toLowerCase()) ||
                  [m.view, m.create, m.edit, m.delete, m.approve, m.export].some(
                    (s) => s && s.toLowerCase().includes(searchFilter.toLowerCase())
                  )
                ).map((row) => {
                  const rowSlugs = [row.view, row.create, row.edit, row.delete, row.approve, row.export].filter(Boolean);
                  const activeInRow = rowSlugs.filter((s) => selectedPermissions.has(s)).length;
                  const allInRow = rowSlugs.length > 0 && activeInRow === rowSlugs.length;

                  const renderCell = (slug) => {
                    if (!slug) {
                      return <span className="text-slate-200 text-sm select-none">—</span>;
                    }
                    const isChecked = selectedPermissions.has(slug);
                    return (
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isSelectedUserSuperadmin}
                        onChange={() => togglePermission(slug)}
                        title={slug}
                        className="size-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                      />
                    );
                  };

                  return (
                    <tr key={row.module} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="font-bold text-slate-900">{row.module}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {activeInRow}/{rowSlugs.length} permissions
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleRow(row)}
                          disabled={isSelectedUserSuperadmin}
                          className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            allInRow
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : activeInRow > 0
                              ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                          title={`Toggle all ${rowSlugs.length} permissions for ${row.module}`}
                        >
                          {allInRow ? "Deselect" : "Select All"}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-center">{renderCell(row.view)}</td>
                      <td className="px-4 py-3.5 text-center">{renderCell(row.create)}</td>
                      <td className="px-4 py-3.5 text-center">{renderCell(row.edit)}</td>
                      <td className="px-4 py-3.5 text-center">{renderCell(row.delete)}</td>
                      <td className="px-4 py-3.5 text-center">{renderCell(row.approve)}</td>
                      <td className="px-4 py-3.5 text-center">{renderCell(row.export)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CATEGORY CARDS VIEW */}
      {viewMode === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {PERMISSION_GROUPS.filter(
            (g) =>
              g.namespace.toLowerCase().includes(searchFilter.toLowerCase()) ||
              g.permissions.some(
                (p) =>
                  p.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
                  p.slug.toLowerCase().includes(searchFilter.toLowerCase())
              )
          ).map((group) => {
            const allSelected = group.permissions.every((p) =>
              selectedPermissions.has(p.slug)
            );
            const selectedInGroup = group.permissions.filter((p) =>
              selectedPermissions.has(p.slug)
            ).length;

            return (
              <div
                key={group.namespace}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                        {group.namespace}
                      </h3>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {selectedInGroup} of {group.permissions.length} selected
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectAllGroup(group.permissions)}
                      disabled={isSelectedUserSuperadmin}
                      className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {allSelected ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  <div className="mt-3 space-y-2.5">
                    {group.permissions.map((p) => {
                      const isChecked = selectedPermissions.has(p.slug);

                      return (
                        <label
                          key={p.slug}
                          className={`flex items-start gap-3 p-2 rounded-xl transition-colors cursor-pointer ${
                            isChecked
                              ? "bg-emerald-50/60 text-slate-900 font-medium"
                              : "hover:bg-slate-50 text-slate-700"
                          } ${
                            isSelectedUserSuperadmin
                              ? "cursor-not-allowed opacity-60"
                              : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isSelectedUserSuperadmin}
                            onChange={() => togglePermission(p.slug)}
                            className="size-4 mt-0.5 rounded-md text-emerald-600 border-slate-300 focus:ring-emerald-500"
                          />
                          <div className="text-xs">
                            <div className="font-semibold text-slate-900">{p.label}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {p.desc}
                            </div>
                            <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                              {p.slug}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
