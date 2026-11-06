"use client";

import React, { useState, useEffect } from "react";
import {
  Percent,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  X,
  RefreshCw,
  Search,
  Scale,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader.jsx";
import { toast } from "sonner";
import { adminTaxService } from "@/services/admin/admin.service.js";
import { formatTaxDecimal, normalizeTaxRules, normalizeTaxRule } from "@/utils/tax.util.js";

export default function TaxesSettingsPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState({
    name: "",
    country: "IN",
    state: "*",
    taxCategory: "standard",
    rate: "18",
    priority: "0",
    isShippingTaxable: true,
    isActive: true,
    description: "",
  });

  const fetchRules = async () => {
    setLoading(true);
    try {
      const data = await adminTaxService.getRules();
      const list = Array.isArray(data) ? data : data?.rules || [];
      setRules(normalizeTaxRules(list));
    } catch (err) {
      setFeedback({
        type: "error",
        message: err?.response?.data?.message || err?.message || "Failed to load tax rules.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const openCreateModal = () => {
    setEditingRule(null);
    setForm({
      name: "Standard GST (18%)",
      country: "IN",
      state: "*",
      taxCategory: "standard",
      rate: "18",
      priority: "0",
      isShippingTaxable: true,
      isActive: true,
      description: "Standard nationwide goods and services tax rate",
    });
    setShowModal(true);
  };

  const openEditModal = (r) => {
    const normalized = normalizeTaxRule(r);
    setEditingRule(normalized);
    setForm({
      name: normalized.name || "",
      country: normalized.country || "IN",
      state: normalized.state || "*",
      taxCategory: normalized.taxCategory || "standard",
      rate: formatTaxDecimal(normalized.rate, "18"),
      priority: String(normalized.priority ?? "0"),
      isShippingTaxable: Boolean(normalized.isShippingTaxable ?? normalized.shippingTaxable),
      isActive: normalized.isActive !== false,
      description: normalized.description || "",
    });
    setShowModal(true);
  };

  const handleDeleteRule = async (r) => {
    try {
      await adminTaxService.deleteRule(r._id || r.id);
      toast.success(`Tax rule "${r.name}" deleted successfully.`);
      setFeedback({
        type: "success",
        message: `Tax rule "${r.name}" deleted successfully.`,
      });
      setTimeout(() => setFeedback(null), 4000);
      fetchRules();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to delete tax rule");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      name: form.name.trim(),
      country: form.country.trim().toUpperCase(),
      taxCategory: form.taxCategory || "standard",
      rate: parseFloat(form.rate) || 0,
      priority: parseInt(form.priority, 10) || 0,
      isShippingTaxable: Boolean(form.isShippingTaxable),
      isActive: Boolean(form.isActive),
      ...(form.state && form.state.trim() !== "*"
        ? { state: form.state.trim().toUpperCase() }
        : { state: null }),
      ...(form.description?.trim() ? { description: form.description.trim() } : {}),
    };

    try {
      if (editingRule) {
        await adminTaxService.updateRule(editingRule._id || editingRule.id, payload);
        toast.success(`Tax rule "${payload.name}" updated successfully.`);
        setFeedback({
          type: "success",
          message: `Tax rule "${payload.name}" updated successfully.`,
        });
      } else {
        await adminTaxService.createRule(payload);
        toast.success(`Tax rule "${payload.name}" created successfully.`);
        setFeedback({
          type: "success",
          message: `Tax rule "${payload.name}" created successfully.`,
        });
      }

      setShowModal(false);
      setTimeout(() => setFeedback(null), 4000);
      fetchRules();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save tax rule");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRules = rules.filter((r) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      r.name?.toLowerCase().includes(term) ||
      r.country?.toLowerCase().includes(term) ||
      r.state?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      <PageHeader
        title="Authoritative Tax Rules & Rates"
        description="Configure GST, VAT, state-level overrides, and compound tax rules enforced across checkout and billing."
        backHref="/administrator/settings"
        backLabel="Settings"
      />

      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-start gap-2.5 border ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Control bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1 max-w-xs">
          <Search className="size-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by rule name or state..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:border-[#007A55]"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchRules}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-xl transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#007A55] hover:bg-[#006346] rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Create Tax Rule</span>
          </button>
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <Loader2 className="size-8 animate-spin mx-auto text-[#007A55] mb-2" />
            <p className="text-xs">Loading tax rules...</p>
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Percent className="size-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No tax rules configured yet</p>
            <p className="text-xs text-slate-400 mt-1">Create a tax rule to automatically apply GST/tax rates at checkout</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Tax Name</th>
                  <th className="px-5 py-3.5">Jurisdiction</th>
                  <th className="px-5 py-3.5">Rate</th>
                  <th className="px-5 py-3.5">Priority</th>
                  <th className="px-5 py-3.5">Applies To Shipping</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredRules.map((r) => (
                  <tr key={r._id || r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-900 flex items-center gap-2">
                      <Percent className="size-4 text-[#007A55]" />
                      <span>{r.name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono font-semibold text-slate-900">{r.country}</span>
                      {r.state && r.state !== "*" && <span className="text-slate-500 ml-1">({r.state})</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {formatTaxDecimal(r.rate)}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      Tier {r.priority ?? 0}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${(r.isShippingTaxable ?? r.shippingTaxable) ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-slate-100 text-slate-500"}`}>
                        {(r.isShippingTaxable ?? r.shippingTaxable) ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(r)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Tax Rule"
                        >
                          <Edit2 className="size-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(r)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Tax Rule"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {editingRule ? "Edit Tax Rule" : "Create Tax Rule"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rule Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Standard GST (18%)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#007A55]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Country (ISO) *</label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
                    placeholder="IN"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-1 focus:ring-[#007A55]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">State / Region</label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
                    placeholder="* (All States)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-1 focus:ring-[#007A55]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tax Rate (%) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    required
                    value={form.rate}
                    onChange={(e) => setForm({ ...form, rate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#007A55]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tax Category</label>
                  <select
                    value={form.taxCategory}
                    onChange={(e) => setForm({ ...form, taxCategory: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#007A55] bg-white"
                  >
                    <option value="standard">Standard (Default)</option>
                    <option value="reduced">Reduced Rate</option>
                    <option value="zero_rated">Zero Rated (0%)</option>
                    <option value="exempt">Tax Exempt</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <input
                    type="number"
                    min={0}
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#007A55]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. Standard GST applied across India"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#007A55]"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isShippingTaxable}
                    onChange={(e) => setForm({ ...form, isShippingTaxable: e.target.checked })}
                    className="rounded text-[#007A55] focus:ring-[#007A55]"
                  />
                  <span className="font-semibold text-slate-700">Apply tax rate to shipping fees</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="rounded text-[#007A55] focus:ring-[#007A55]"
                  />
                  <span className="font-semibold text-slate-700">Rule is active immediately</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 font-semibold text-white bg-[#007A55] hover:bg-[#006346] rounded-xl shadow-xs disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingRule ? "Update Tax Rule" : "Create Tax Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
