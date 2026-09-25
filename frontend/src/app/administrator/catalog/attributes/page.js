"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sliders,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Tag,
  Layers,
  Sparkles,
  X,
  ListPlus,
} from "lucide-react";
import { adminCatalogService } from "@/services/admin/admin.service.js";

const ATTRIBUTE_TYPES = [
  { value: "select", label: "Single Select" },
  { value: "multiselect", label: "Multi Select" },
  { value: "text", label: "Text / String" },
  { value: "number", label: "Numeric" },
  { value: "boolean", label: "Boolean (Yes/No)" },
  { value: "size", label: "Size (Clothing/Footwear)" },
  { value: "color", label: "Color (Hex / Swatch)" },
  { value: "measurement", label: "Measurement (Dimensions/Weight)" },
  { value: "date", label: "Date" },
];

export default function AdminAttributesPage() {
  const [attributes, setAttributes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [variantFilter, setVariantFilter] = useState("all");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState({
    name: "",
    slug: "",
    type: "select",
    attributeGroup: "General",
    categoryIds: [],
    isRequired: false,
    isVariantAttribute: false,
    isFilterable: true,
    values: [],
  });

  const [newValueLabel, setNewValueLabel] = useState("");
  const [newValueVal, setNewValueVal] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [attrRes, catRes] = await Promise.all([
        adminCatalogService.listAttributes({ limit: 100 }),
        adminCatalogService.listCategories({ limit: 100 }),
      ]);
      const attrItems = attrRes?.items || attrRes || [];
      const catItems = catRes?.items || catRes || [];
      setAttributes(Array.isArray(attrItems) ? attrItems : []);
      setCategories(Array.isArray(catItems) ? catItems : []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load platform catalog attributes"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingAttribute(null);
    setForm({
      name: "",
      slug: "",
      type: "select",
      attributeGroup: "General",
      categoryIds: [],
      isRequired: false,
      isVariantAttribute: false,
      isFilterable: true,
      values: [],
    });
    setNewValueLabel("");
    setNewValueVal("");
    setShowModal(true);
  };

  const openEditModal = (attr) => {
    setEditingAttribute(attr);
    setForm({
      name: attr.name,
      slug: attr.slug,
      type: attr.type,
      attributeGroup: attr.attributeGroup || "General",
      categoryIds: (attr.categoryIds || []).map((c) => (c._id ? c._id : c)),
      isRequired: Boolean(attr.isRequired),
      isVariantAttribute: Boolean(attr.isVariantAttribute),
      isFilterable: Boolean(attr.isFilterable),
      values: attr.values || [],
    });
    setNewValueLabel("");
    setNewValueVal("");
    setShowModal(true);
  };

  const addValueOption = () => {
    if (!newValueLabel.trim()) return;
    const val = newValueVal.trim() || newValueLabel.trim().toLowerCase().replace(/\s+/g, "-");
    setForm((prev) => ({
      ...prev,
      values: [...prev.values, { label: newValueLabel.trim(), value: val, sortOrder: prev.values.length }],
    }));
    setNewValueLabel("");
    setNewValueVal("");
  };

  const removeValueOption = (index) => {
    setForm((prev) => ({
      ...prev,
      values: prev.values.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Attribute name is required");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        type: form.type,
        attributeGroup: form.attributeGroup.trim() || "General",
        categoryIds: form.categoryIds,
        isRequired: form.isRequired,
        isVariantAttribute: form.isVariantAttribute,
        isFilterable: form.isFilterable,
        values: form.values,
      };

      if (editingAttribute) {
        await adminCatalogService.updateAttribute(editingAttribute._id, payload);
        setSuccess(`Attribute '${form.name}' updated successfully`);
      } else {
        await adminCatalogService.createAttribute(payload);
        setSuccess(`Attribute '${form.name}' created successfully`);
      }

      setShowModal(false);
      fetchData();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to save attribute"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (attr) => {
    if (
      !window.confirm(
        `Are you sure you want to delete platform attribute '${attr.name}'?`
      )
    ) {
      return;
    }

    try {
      await adminCatalogService.deleteAttribute(attr._id);
      setSuccess(`Attribute '${attr.name}' deleted successfully`);
      fetchData();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to delete attribute"
      );
    }
  };

  const filteredAttributes = attributes.filter((a) => {
    const matchesSearch =
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.slug.toLowerCase().includes(search.toLowerCase()) ||
      (a.attributeGroup && a.attributeGroup.toLowerCase().includes(search.toLowerCase()));

    const matchesType = typeFilter === "all" || a.type === typeFilter;
    const matchesVariant =
      variantFilter === "all" ||
      (variantFilter === "variant" && a.isVariantAttribute) ||
      (variantFilter === "non-variant" && !a.isVariantAttribute);

    return matchesSearch && matchesType && matchesVariant;
  });

  const variantCount = attributes.filter((a) => a.isVariantAttribute).length;
  const requiredCount = attributes.filter((a) => a.isRequired).length;
  const filterableCount = attributes.filter((a) => a.isFilterable).length;

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-lg">
              <Sliders className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Platform Catalog Attributes & Sets
            </h1>
          </div>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Define dynamic attributes (RAM, storage, size, color, material, etc.) assigned to marketplace categories and variant axes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Attribute
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700/60 shadow-xs">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Total Attributes</p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{attributes.length}</p>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700/60 shadow-xs">
          <p className="text-xs font-medium text-purple-600 dark:text-purple-400">Variant Axes</p>
          <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">{variantCount}</p>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700/60 shadow-xs">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Required Attributes</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{requiredCount}</p>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700/60 shadow-xs">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Filterable on Store</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{filterableCount}</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-900/50">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-xs font-semibold hover:underline">Dismiss</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-900/50">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto text-xs font-semibold hover:underline">Dismiss</button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-neutral-800 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700/60">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search attributes by name, slug, or group..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg"
        >
          <option value="all">All Types</option>
          {ATTRIBUTE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={variantFilter}
          onChange={(e) => setVariantFilter(e.target.value)}
          className="px-3 py-1.5 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg"
        >
          <option value="all">All Attributes</option>
          <option value="variant">Variant Axes Only</option>
          <option value="non-variant">Non-Variant Only</option>
        </select>
      </div>

      {/* Attributes Table */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700/60 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900/50 text-neutral-600 dark:text-neutral-400 text-xs font-semibold uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-700">
              <tr>
                <th className="py-3 px-4">Attribute Name</th>
                <th className="py-3 px-4">Group</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Values / Options</th>
                <th className="py-3 px-4">Assigned Categories</th>
                <th className="py-3 px-4">Flags</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading platform catalog attributes...
                  </td>
                </tr>
              ) : filteredAttributes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    No attributes match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredAttributes.map((attr) => (
                  <tr key={attr._id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-700/20">
                    <td className="py-3.5 px-4 font-medium text-neutral-900 dark:text-neutral-100">
                      <div>{attr.name}</div>
                      <div className="text-xs text-neutral-400 font-mono mt-0.5">{attr.slug}</div>
                    </td>
                    <td className="py-3.5 px-4 text-neutral-600 dark:text-neutral-300">
                      <span className="px-2 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-700 rounded text-neutral-700 dark:text-neutral-300">
                        {attr.attributeGroup || "General"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
                        {attr.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-neutral-600 dark:text-neutral-300 max-w-xs truncate">
                      {attr.values && attr.values.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {attr.values.slice(0, 3).map((v, i) => (
                            <span key={i} className="text-xs px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-700 rounded">
                              {v.label}
                            </span>
                          ))}
                          {attr.values.length > 3 && (
                            <span className="text-xs text-neutral-400 self-center">
                              +{attr.values.length - 3} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400 italic">Open input</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-600 dark:text-neutral-300 max-w-xs truncate">
                      {attr.categoryIds && attr.categoryIds.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {attr.categoryIds.map((c, i) => (
                            <span key={i} className="text-xs px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 rounded">
                              {c.name || "Category"}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400">All Categories (Global)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {attr.isVariantAttribute && (
                          <span className="px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wider bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded">
                            Variant
                          </span>
                        )}
                        {attr.isRequired && (
                          <span className="px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded">
                            Required
                          </span>
                        )}
                        {attr.isFilterable && (
                          <span className="px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded">
                            Filter
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(attr)}
                          className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md text-neutral-600 dark:text-neutral-300"
                          title="Edit attribute"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(attr)}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md text-red-600"
                          title="Delete attribute"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                {editingAttribute ? `Edit Attribute: ${editingAttribute.name}` : "Create Platform Catalog Attribute"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Attribute Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Storage Capacity, Fit Type"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Attribute Slug (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. storage-capacity"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Type
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg"
                  >
                    {ATTRIBUTE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Attribute Group
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. General, Technical, Dimensions"
                    value={form.attributeGroup}
                    onChange={(e) => setForm({ ...form, attributeGroup: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg"
                  />
                </div>
              </div>

              {/* Category Assignment */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Assign to Categories (Leave empty for marketplace-wide global attribute)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs">
                  {categories.map((cat) => {
                    const checked = form.categoryIds.includes(cat._id);
                    return (
                      <label key={cat._id} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({ ...form, categoryIds: [...form.categoryIds, cat._id] });
                            } else {
                              setForm({ ...form, categoryIds: form.categoryIds.filter((id) => id !== cat._id) });
                            }
                          }}
                          className="rounded text-indigo-600"
                        />
                        <span className="truncate">{cat.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Flags */}
              <div className="flex flex-wrap gap-4 p-3 bg-neutral-50 dark:bg-neutral-900/60 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isVariantAttribute}
                    onChange={(e) => setForm({ ...form, isVariantAttribute: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <div>
                    <span className="font-semibold block">Variant Axis</span>
                    <span className="text-neutral-400">Can be used to generate distinct SKUs (size, color, etc.)</span>
                  </div>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isRequired}
                    onChange={(e) => setForm({ ...form, isRequired: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <div>
                    <span className="font-semibold block">Required for Products</span>
                    <span className="text-neutral-400">Vendors must specify this attribute before submission</span>
                  </div>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isFilterable}
                    onChange={(e) => setForm({ ...form, isFilterable: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <div>
                    <span className="font-semibold block">Storefront Filterable</span>
                    <span className="text-neutral-400">Appears in sidebar navigation filters</span>
                  </div>
                </label>
              </div>

              {/* Values Builder (for select, multiselect, size, color) */}
              {["select", "multiselect", "size", "color"].includes(form.type) && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Predefined Values / Choices
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Label (e.g. 128 GB, Navy Blue)"
                      value={newValueLabel}
                      onChange={(e) => setNewValueLabel(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Value/Code (e.g. 128gb, #000080)"
                      value={newValueVal}
                      onChange={(e) => setNewValueVal(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg font-mono"
                    />
                    <button
                      type="button"
                      onClick={addValueOption}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-neutral-50 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    {form.values.length === 0 ? (
                      <span className="text-xs text-neutral-400">No predefined values added yet.</span>
                    ) : (
                      form.values.map((v, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-white dark:bg-neutral-800 rounded border border-neutral-200 dark:border-neutral-700">
                          <span>{v.label}</span>
                          <span className="text-neutral-400 text-2xs font-mono">({v.value})</span>
                          <button
                            type="button"
                            onClick={() => removeValueOption(i)}
                            className="text-red-500 hover:text-red-700 ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 rounded-lg hover:bg-neutral-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingAttribute ? "Update Attribute" : "Create Attribute"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
