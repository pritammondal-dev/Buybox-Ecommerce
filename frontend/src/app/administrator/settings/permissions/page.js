"use client";

import React, { useEffect, useState } from "react";
import {
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Save,
  User,
  RefreshCw,
  Info,
} from "lucide-react";
import {
  staffService,
  permissionService,
} from "@/services/admin/admin.service.js";
import { useAuth } from "@/hooks/useAuth.js";

// Section 5 Master Permission Catalog Definitions
const PERMISSION_GROUPS = [
  {
    namespace: "Dashboard",
    permissions: [
      { slug: "dashboard.view", label: "Dashboard View", desc: "Access real-time platform metrics and KPIs" },
    ],
  },
  {
    namespace: "Customers",
    permissions: [
      { slug: "customers.view", label: "View Customers", desc: "View customer lists and details" },
      { slug: "customers.create", label: "Create Customers", desc: "Provision customer accounts manually" },
      { slug: "customers.edit", label: "Edit Customers", desc: "Update customer records" },
      { slug: "customers.suspend", label: "Suspend Customers", desc: "Deactivate or suspend customer accounts" },
      { slug: "customers.export", label: "Export Customers", desc: "Export customer datasets" },
    ],
  },
  {
    namespace: "Vendors",
    permissions: [
      { slug: "vendors.view", label: "View Vendors", desc: "View vendor accounts and onboarding queue" },
      { slug: "vendors.approve", label: "Approve Vendors", desc: "Authorize vendor onboarding applications" },
      { slug: "vendors.reject", label: "Reject Vendors", desc: "Decline vendor onboarding applications" },
      { slug: "vendors.request_changes", label: "Request Changes", desc: "Request onboarding corrections from vendor" },
      { slug: "vendors.suspend", label: "Suspend Vendors", desc: "Suspend active vendors" },
      { slug: "vendors.edit", label: "Edit Vendors", desc: "Update vendor details and settings" },
      { slug: "vendors.export", label: "Export Vendors", desc: "Export vendor lists" },
    ],
  },
  {
    namespace: "Products & Catalog",
    permissions: [
      { slug: "products.view", label: "View Products", desc: "Browse catalog and product details" },
      { slug: "products.create", label: "Create Products", desc: "Add new product listings" },
      { slug: "products.edit", label: "Edit Products", desc: "Modify product pricing, descriptions, and variants" },
      { slug: "products.delete", label: "Delete Products", desc: "Remove products from catalog" },
      { slug: "products.approve", label: "Approve Products", desc: "Moderate and approve vendor products" },
      { slug: "products.reject", label: "Reject Products", desc: "Reject submitted vendor products" },
      { slug: "products.export", label: "Export Products", desc: "Export catalog records" },
      { slug: "categories.view", label: "View Categories", desc: "Browse category hierarchy" },
      { slug: "categories.create", label: "Create Categories", desc: "Add new category nodes" },
      { slug: "categories.edit", label: "Edit Categories", desc: "Update categories" },
      { slug: "categories.delete", label: "Delete Categories", desc: "Delete category nodes" },
      { slug: "brands.view", label: "View Brands", desc: "View brand list" },
      { slug: "brands.create", label: "Create Brands", desc: "Add new brands" },
      { slug: "brands.edit", label: "Edit Brands", desc: "Update brand details" },
      { slug: "brands.delete", label: "Delete Brands", desc: "Remove brands" },
    ],
  },
  {
    namespace: "Inventory & Warehouses",
    permissions: [
      { slug: "inventory.view", label: "View Inventory", desc: "Inspect inventory levels across warehouses" },
      { slug: "inventory.adjust", label: "Adjust Stock", desc: "Perform manual stock adjustments" },
      { slug: "inventory.transfer", label: "Transfer Stock", desc: "Initiate stock transfers" },
      { slug: "warehouses.view", label: "View Warehouses", desc: "View warehouse facilities" },
      { slug: "warehouses.create", label: "Create Warehouses", desc: "Add new warehouse locations" },
      { slug: "warehouses.edit", label: "Edit Warehouses", desc: "Update warehouse details" },
      { slug: "warehouses.manage_inventory", label: "Manage Inventory", desc: "Allocate warehouse stock" },
    ],
  },
  {
    namespace: "Orders & Returns",
    permissions: [
      { slug: "orders.view", label: "View Orders", desc: "Inspect customer orders and details" },
      { slug: "orders.edit", label: "Edit Orders", desc: "Update delivery notes and customer details" },
      { slug: "orders.cancel", label: "Cancel Orders", desc: "Cancel unfulfilled orders" },
      { slug: "returns.view", label: "View Returns", desc: "Inspect return requests queue" },
      { slug: "returns.approve", label: "Approve Returns", desc: "Authorize returns" },
      { slug: "returns.reject", label: "Reject Returns", desc: "Decline returns" },
    ],
  },
  {
    namespace: "Finance & Settlements",
    permissions: [
      { slug: "refunds.view", label: "View Refunds", desc: "View refund records" },
      { slug: "refunds.create", label: "Create Refunds", desc: "Initiate payment gateway refunds" },
      { slug: "refunds.approve", label: "Approve Refunds", desc: "Authorize refunds" },
      { slug: "payments.view", label: "View Payments", desc: "View payment gateway transactions" },
      { slug: "payments.reconcile", label: "Reconcile Payments", desc: "Reconcile payment balances" },
      { slug: "settlements.view", label: "View Settlements", desc: "View vendor settlements" },
      { slug: "settlements.manage", label: "Manage Settlements", desc: "Process payouts and finalize settlements" },
    ],
  },
  {
    namespace: "Shipping & Fulfillment",
    permissions: [
      { slug: "shipping.view", label: "View Shipping", desc: "View shipments and tracking" },
      { slug: "shipping.manage", label: "Manage Shipping", desc: "Dispatch or reassign courier shipments" },
    ],
  },
  {
    namespace: "Marketing & CMS",
    permissions: [
      { slug: "campaigns.view", label: "View Campaigns", desc: "View campaigns" },
      { slug: "campaigns.create", label: "Create Campaigns", desc: "Create promotional campaigns" },
      { slug: "campaigns.edit", label: "Edit Campaigns", desc: "Update campaigns" },
      { slug: "campaigns.delete", label: "Delete Campaigns", desc: "Remove campaigns" },
      { slug: "coupons.view", label: "View Coupons", desc: "View coupons" },
      { slug: "coupons.create", label: "Create Coupons", desc: "Create coupon codes" },
      { slug: "coupons.edit", label: "Edit Coupons", desc: "Update coupons" },
      { slug: "coupons.delete", label: "Delete Coupons", desc: "Deactivate coupons" },
      { slug: "cms.view", label: "View CMS", desc: "View CMS content and banners" },
      { slug: "cms.create", label: "Create CMS", desc: "Draft banners and pages" },
      { slug: "cms.edit", label: "Edit CMS", desc: "Modify pages and navigation" },
      { slug: "cms.publish", label: "Publish CMS", desc: "Publish CMS content live" },
    ],
  },
  {
    namespace: "Support & Reviews",
    permissions: [
      { slug: "reviews.view", label: "View Reviews", desc: "View product reviews" },
      { slug: "reviews.moderate", label: "Moderate Reviews", desc: "Approve or flag reviews" },
      { slug: "support.view", label: "View Support", desc: "View support tickets" },
      { slug: "support.respond", label: "Respond to Support", desc: "Answer customer/vendor tickets" },
      { slug: "support.assign", label: "Assign Support", desc: "Reassign support tickets" },
    ],
  },
  {
    namespace: "Analytics & Tasks",
    permissions: [
      { slug: "analytics.view", label: "View Analytics", desc: "Access reports and analytics" },
      { slug: "analytics.export", label: "Export Analytics", desc: "Export analytics datasets" },
      { slug: "tasks.view", label: "View Tasks", desc: "View team tasks" },
      { slug: "tasks.create", label: "Create Tasks", desc: "Create new tasks" },
      { slug: "tasks.assign", label: "Assign Tasks", desc: "Assign tasks to employees" },
      { slug: "tasks.edit", label: "Edit Tasks", desc: "Update tasks and notes" },
      { slug: "tasks.complete", label: "Complete Tasks", desc: "Mark tasks completed" },
    ],
  },
  {
    namespace: "Activity Logs & Governance",
    permissions: [
      { slug: "activity_logs.view", label: "View Activity Logs", desc: "Inspect immutable audit logs" },
      { slug: "activity_logs.export", label: "Export Activity Logs", desc: "Export audit trails" },
      { slug: "staff.view", label: "View Staff", desc: "View staff list" },
      { slug: "staff.create", label: "Create Staff", desc: "Provision staff members" },
      { slug: "staff.edit", label: "Edit Staff", desc: "Modify staff records" },
      { slug: "staff.suspend", label: "Suspend Staff", desc: "Suspend staff access" },
      { slug: "permissions.view", label: "View Permissions", desc: "View permission matrix" },
      { slug: "permissions.manage", label: "Manage Permissions", desc: "Manage employee permissions" },
      { slug: "platform_settings.view", label: "View Platform Settings", desc: "Inspect system configurations" },
      { slug: "platform_settings.manage", label: "Manage Platform Settings", desc: "Modify marketplace settings" },
      { slug: "platform_credentials.view", label: "View Platform Credentials", desc: "View credential statuses" },
      { slug: "platform_credentials.manage", label: "Manage Platform Credentials", desc: "Update encrypted credentials" },
    ],
  },
];

export default function PermissionSettingsPage() {
  const { user: currentUser } = useAuth();
  const isSuperadmin = currentUser?.role === "super_admin";

  const [staffList, setStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedStaffDetails, setSelectedStaffDetails] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Load staff list
  useEffect(() => {
    async function loadStaff() {
      setLoading(true);
      try {
        const result = await staffService.list({ limit: 100 });
        const list = result?.staff || [];
        setStaffList(list);

        // Auto-select first non-superadmin staff member
        const firstEditable = list.find((s) => s.role !== "super_admin");
        if (firstEditable) {
          setSelectedStaffId(firstEditable.id);
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
      } catch (err) {
        setError("Failed to load employee permissions");
      } finally {
        setLoading(false);
      }
    }
    loadDetails();
  }, [selectedStaffId]);

  const togglePermission = (slug) => {
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

  const handleSelectAllGroup = (permissions) => {
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

  const handleSavePermissions = async () => {
    if (!selectedStaffDetails?.employee?.id) {
      setError("Selected staff member lacks an employee profile");
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
      setSuccess("Permissions updated atomically. Immediate session invalidation applied.");
      setTimeout(() => setSuccess(null), 5000);
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
            <span>Permission Settings</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Superadmin-controlled granular permission matrix with immediate session revocation
          </p>
        </div>

        <button
          onClick={handleSavePermissions}
          disabled={saving || loading || selectedStaffDetails?.role === "super_admin"}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-xs disabled:opacity-50"
        >
          <Save className={`size-4 ${saving ? "animate-spin" : ""}`} />
          <span>{saving ? "Saving Changes..." : "Save Permissions"}</span>
        </button>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5">
          <CheckCircle2 className="size-5 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2.5">
          <AlertTriangle className="size-5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Staff Member Selector */}
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

        {selectedStaffDetails && (
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              Role: <strong className="text-slate-800 uppercase">{selectedStaffDetails.role}</strong>
            </span>
            <span>•</span>
            <span>
              Effective permissions:{" "}
              <strong className="text-emerald-700">{selectedPermissions.size}</strong>
            </span>
          </div>
        )}
      </div>

      {selectedStaffDetails?.role === "super_admin" && (
        <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-800 text-xs flex items-center gap-3">
          <ShieldCheck className="size-5 text-purple-600 shrink-0" />
          <span>
            Superadmin holds platform-level authority and unconditionally possesses all permissions. Superadmin permissions cannot be modified.
          </span>
        </div>
      )}

      {/* Permission Checklists by Namespace */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {PERMISSION_GROUPS.map((group) => {
          const allSelected = group.permissions.every((p) =>
            selectedPermissions.has(p.slug)
          );

          return (
            <div
              key={group.namespace}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    {group.namespace}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleSelectAllGroup(group.permissions)}
                    disabled={selectedStaffDetails?.role === "super_admin"}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 transition-colors disabled:opacity-40"
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
                            ? "bg-emerald-50/60 text-slate-900"
                            : "hover:bg-slate-50 text-slate-700"
                        } ${
                          selectedStaffDetails?.role === "super_admin"
                            ? "cursor-not-allowed opacity-60"
                            : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={selectedStaffDetails?.role === "super_admin"}
                          onChange={() => togglePermission(p.slug)}
                          className="size-4 mt-0.5 rounded-md text-emerald-600 border-slate-300 focus:ring-emerald-500"
                        />
                        <div className="text-xs">
                          <div className="font-semibold">{p.label}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {p.desc}
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
    </div>
  );
}
