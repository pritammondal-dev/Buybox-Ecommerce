"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Warehouse,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  MapPin,
  Phone,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { adminInventoryService } from "@/services/admin/admin.service.js";

export default function AdminWarehousesPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [search, setSearch] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [form, setForm] = useState({
    name: "",
    code: "",
    address: {
      street: "",
      city: "",
      state: "",
      country: "India",
      postalCode: "",
    },
    contactPhone: "",
    contactEmail: "",
    capacity: 10000,
  });

  const fetchWarehouses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminInventoryService.listWarehouses();
      const items = res?.items || res || [];
      setWarehouses(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load warehouses"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await adminInventoryService.createWarehouse({
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        address: form.address,
        contactPhone: form.contactPhone.trim(),
        contactEmail: form.contactEmail.trim(),
        capacity: Number(form.capacity) || 10000,
      });
      setShowCreateModal(false);
      setSuccess("Warehouse created successfully");
      setTimeout(() => setSuccess(null), 4000);
      fetchWarehouses();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to create warehouse"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingWarehouse) return;
    setSubmitting(true);
    setError(null);
    try {
      await adminInventoryService.updateWarehouse(editingWarehouse._id, {
        name: form.name.trim(),
        address: form.address,
        contactPhone: form.contactPhone.trim(),
        contactEmail: form.contactEmail.trim(),
        capacity: Number(form.capacity) || 10000,
      });
      setEditingWarehouse(null);
      setSuccess("Warehouse updated successfully");
      setTimeout(() => setSuccess(null), 4000);
      fetchWarehouses();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to update warehouse"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (w) => {
    setEditingWarehouse(w);
    setForm({
      name: w.name,
      code: w.code,
      address: {
        street: w.address?.street || "",
        city: w.address?.city || "",
        state: w.address?.state || "",
        country: w.address?.country || "India",
        postalCode: w.address?.postalCode || "",
      },
      contactPhone: w.contactPhone || "",
      contactEmail: w.contactEmail || "",
      capacity: w.capacity || 10000,
    });
  };

  const filtered = warehouses.filter((w) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      w.name?.toLowerCase().includes(s) ||
      w.code?.toLowerCase().includes(s) ||
      w.address?.city?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Warehouse className="size-6 text-[#004D38]" />
            <span>Fulfillment Warehouses</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage multi-location physical fulfillment centers, storage zones, and hub allocation
          </p>
        </div>

        <button
          onClick={() => {
            setForm({
              name: "",
              code: "",
              address: { street: "", city: "", state: "", country: "India", postalCode: "" },
              contactPhone: "",
              contactEmail: "",
              capacity: 10000,
            });
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#004D38] hover:bg-[#003829] rounded-xl shadow-xs transition-colors"
        >
          <Plus className="size-4" />
          <span>New Warehouse</span>
        </button>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle className="size-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Warehouses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-12 text-center text-xs text-slate-400 bg-white rounded-3xl">
            Loading warehouses...
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-400 bg-white rounded-3xl">
            No warehouses registered.
          </div>
        ) : (
          filtered.map((w) => (
            <div
              key={w._id}
              className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#004D38] bg-emerald-50 px-2 py-0.5 rounded-md">
                      {w.code}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        w.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {w.isActive ? "Operational" : "Inactive"}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-2">
                    {w.name}
                  </h3>
                </div>

                <button
                  onClick={() => openEditModal(w)}
                  className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Edit2 className="size-3.5" />
                </button>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex items-start gap-2">
                  <MapPin className="size-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    {w.address?.street ? `${w.address.street}, ` : ""}
                    {w.address?.city || ""}, {w.address?.state || ""}{" "}
                    {w.address?.postalCode || ""}
                  </span>
                </div>
                {w.contactPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="size-3.5 text-slate-400" />
                    <span>{w.contactPhone}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Capacity</span>
                <span className="font-bold text-slate-800">
                  {w.capacity ? w.capacity.toLocaleString() : "10,000"} units
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {(showCreateModal || editingWarehouse) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900">
              {editingWarehouse ? "Edit Warehouse" : "Register New Warehouse"}
            </h3>

            <form
              onSubmit={editingWarehouse ? handleEditSubmit : handleCreateSubmit}
              className="space-y-4 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Warehouse Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g., Central Mumbai Hub"
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Code (Unique Identifier) *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingWarehouse)}
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="e.g., BOM-01"
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#004D38] focus:outline-hidden font-mono uppercase disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  value={form.address.street}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      address: { ...form.address, street: e.target.value },
                    })
                  }
                  placeholder="Street / Unit address"
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={form.address.city}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        address: { ...form.address, city: e.target.value },
                      })
                    }
                    placeholder="City"
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={form.address.state}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        address: { ...form.address, state: e.target.value },
                      })
                    }
                    placeholder="State"
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    value={form.address.postalCode}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        address: { ...form.address, postalCode: e.target.value },
                      })
                    }
                    placeholder="PIN Code"
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    placeholder="+91..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Capacity (Units)
                  </label>
                  <input
                    type="number"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    placeholder="10000"
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingWarehouse(null);
                  }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-white bg-[#004D38] hover:bg-[#003829] rounded-xl font-semibold shadow-xs transition-colors disabled:opacity-50"
                >
                  {submitting
                    ? "Saving..."
                    : editingWarehouse
                    ? "Save Changes"
                    : "Create Warehouse"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
