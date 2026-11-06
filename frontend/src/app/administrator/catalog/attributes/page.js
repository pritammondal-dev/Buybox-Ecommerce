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
  Shield,
  ArrowUp,
  ArrowDown,
  Check,
  Power,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
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

const PREDEFINED_SETS = [
  { name: "Electronics", description: "Consumer electronics, computers, appliances, and smart devices" },
  { name: "Fashion", description: "Apparel, clothing, fabrics, and accessories" },
  { name: "Shoes", description: "Footwear, athletic shoes, boots, and sandals" },
  { name: "Mobile", description: "Smartphones, tablets, wearables, and mobile accessories" },
  { name: "Furniture", description: "Home, office furniture, decor, and fixtures" },
  { name: "General", description: "Standard marketplace products across general categories" },
];

export default function AdminAttributesPage() {
  const [activeTab, setActiveTab] = useState("attributes"); // 'attributes' | 'sets'
  const [attributes, setAttributes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [variantFilter, setVariantFilter] = useState("all");
  const [setFilter, setSetFilter] = useState("all");

  // Create / Edit Attribute Modal
  const [showModal, setShowModal] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Attribute Form State
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

  // Value Management Modal
  const [showValueModal, setShowValueModal] = useState(false);
  const [selectedAttrForValues, setSelectedAttrForValues] = useState(null);
  const [managedValues, setManagedValues] = useState([]);
  const [newValueLabel, setNewValueLabel] = useState("");
  const [newValueVal, setNewValueVal] = useState("");
  const [savingValues, setSavingValues] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [attrRes, catRes] = await Promise.all([
        adminCatalogService.listAttributes({ limit: 100 }),
        adminCatalogService.listCategories({ limit: 100 }),
      ]);
      const attrItems = attrRes?.items || attrRes?.data || attrRes || [];
      const catItems = catRes?.items || catRes?.data || catRes || [];
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
    setShowModal(true);
  };

  const openValueManager = (attr) => {
    setSelectedAttrForValues(attr);
    setManagedValues(
      (attr.values || []).map((v, idx) => ({
        label: v.label || v.name || "",
        value: v.value || "",
        sortOrder: v.sortOrder !== undefined ? v.sortOrder : idx,
        isActive: v.isActive !== undefined ? v.isActive : true,
      }))
    );
    setNewValueLabel("");
    setNewValueVal("");
    setShowValueModal(true);
  };

  const handleAddValue = () => {
    if (!newValueLabel.trim()) return;
    const val = newValueVal.trim() || newValueLabel.trim().toLowerCase().replace(/\s+/g, "-");
    setManagedValues((prev) => [
      ...prev,
      {
        label: newValueLabel.trim(),
        value: val,
        sortOrder: prev.length,
        isActive: true,
      },
    ]);
    setNewValueLabel("");
    setNewValueVal("");
  };

  const handleMoveValue = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= managedValues.length) return;
    const updated = [...managedValues];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    // update sort orders
    updated.forEach((v, i) => (v.sortOrder = i));
    setManagedValues(updated);
  };

  const handleToggleValueStatus = (index) => {
    const updated = [...managedValues];
    updated[index].isActive = !updated[index].isActive;
    setManagedValues(updated);
  };

  const handleRemoveValue = (index) => {
    setManagedValues((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveValues = async () => {
    if (!selectedAttrForValues) return;
    setSavingValues(true);
    try {
      await adminCatalogService.updateAttribute(selectedAttrForValues._id, {
        values: managedValues,
      });
      setShowValueModal(false);
      toast.success(`Attribute values for '${selectedAttrForValues.name}' updated successfully`);
      setSuccess(`Attribute values for '${selectedAttrForValues.name}' updated successfully`);
      setTimeout(() => setSuccess(null), 4000);
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update values");
    } finally {
      setSavingValues(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Attribute name is required");
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
        toast.success(`Attribute '${form.name}' updated successfully`);
        setSuccess(`Attribute '${form.name}' updated successfully`);
      } else {
        await adminCatalogService.createAttribute(payload);
        toast.success(`Attribute '${form.name}' created successfully`);
        setSuccess(`Attribute '${form.name}' created successfully`);
      }

      setShowModal(false);
      setTimeout(() => setSuccess(null), 4000);
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save attribute");
      setError(err?.response?.data?.message || err?.message || "Failed to save attribute");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (attr) => {
    try {
      await adminCatalogService.deleteAttribute(attr._id);
      toast.success(`Attribute '${attr.name}' deleted successfully`);
      setSuccess(`Attribute '${attr.name}' deleted successfully`);
      setTimeout(() => setSuccess(null), 4000);
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to delete attribute");
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

    const matchesSet = setFilter === "all" || a.attributeGroup === setFilter;

    return matchesSearch && matchesType && matchesVariant && matchesSet;
  });

  const variantCount = attributes.filter((a) => a.isVariantAttribute).length;
  const requiredCount = attributes.filter((a) => a.isRequired).length;
  const filterableCount = attributes.filter((a) => a.isFilterable).length;

  return (
    <div className="space-y-6">
      {/* Platform Ownership Notice Banner */}
      <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#004D38] text-white rounded-xl">
            <Shield className="size-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">Platform Taxonomy &amp; Attribute Control Plane</div>
            <div className="text-[11px] text-slate-600 mt-0.5">
              Categories, brands, dynamic attributes, and attribute sets are strictly platform-controlled. Vendors have read-only consumption rights when listing products.
            </div>
          </div>
        </div>
        <div className="text-xs font-semibold px-3 py-1 bg-white border border-emerald-200 rounded-xl text-[#004D38] shrink-0">
          Superadmin Authorized
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Sliders className="size-6 text-[#004D38]" />
            <span>Attribute &amp; Specification Sets</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage global product specifications, variant axes (Color, Size, RAM, Storage), and attribute set groupings
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-xl transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#004D38] hover:bg-[#003828] rounded-xl shadow-xs transition-colors"
          >
            <Plus className="size-4" />
            <span>Add Attribute</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-slate-400">Total Attributes</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{attributes.length}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-purple-600">Variant Axes</div>
          <div className="text-2xl font-bold text-purple-700 mt-1">{variantCount}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-amber-600">Required Attributes</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{requiredCount}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-emerald-600">Storefront Filters</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{filterableCount}</div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2.5">
          <AlertTriangle className="size-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5">
          <CheckCircle className="size-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Primary Section Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("attributes")}
          className={`pb-3 px-4 text-xs font-bold transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "attributes"
              ? "border-[#004D38] text-[#004D38]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Sliders className="size-4" />
          <span>Attributes Directory ({attributes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("sets")}
          className={`pb-3 px-4 text-xs font-bold transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "sets"
              ? "border-[#004D38] text-[#004D38]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Layers className="size-4" />
          <span>Attribute Sets ({PREDEFINED_SETS.length})</span>
        </button>
      </div>

      {/* TAB 1: ATTRIBUTES DIRECTORY */}
      {activeTab === "attributes" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search attributes by name, slug, or set..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={setFilter}
                onChange={(e) => setSetFilter(e.target.value)}
                className="py-1.5 px-3 border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none"
              >
                <option value="all">All Attribute Sets</option>
                {PREDEFINED_SETS.map((s) => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="py-1.5 px-3 border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none"
              >
                <option value="all">All Types</option>
                {ATTRIBUTE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              <select
                value={variantFilter}
                onChange={(e) => setVariantFilter(e.target.value)}
                className="py-1.5 px-3 border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none"
              >
                <option value="all">All Attributes</option>
                <option value="variant">Variant Axes Only</option>
                <option value="non-variant">Non-Variant Only</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Attribute Name</th>
                    <th className="px-5 py-3.5">Attribute Set</th>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5">Allowed Values</th>
                    <th className="px-5 py-3.5">Category Association</th>
                    <th className="px-5 py-3.5">Flags</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="text-center py-12 text-slate-400">
                        <RefreshCw className="size-4 animate-spin mx-auto mb-2 text-[#004D38]" />
                        <span>Loading platform attributes...</span>
                      </td>
                    </tr>
                  ) : filteredAttributes.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-12 text-slate-400">
                        No attributes found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAttributes.map((attr) => (
                      <tr key={attr._id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-900">{attr.name}</div>
                          <div className="text-slate-400 font-mono text-[11px]">/{attr.slug}</div>
                        </td>

                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                            {attr.attributeGroup || "General"}
                          </span>
                        </td>

                        <td className="px-5 py-3.5">
                          <span className="capitalize text-slate-700 font-medium">
                            {attr.type}
                          </span>
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                            {attr.values?.slice(0, 3).map((v, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-md text-[10px]"
                              >
                                {v.label || v.name || v.value}
                              </span>
                            ))}
                            {attr.values?.length > 3 && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                +{attr.values.length - 3} more
                              </span>
                            )}
                            <button
                              onClick={() => openValueManager(attr)}
                              className="text-[11px] text-[#004D38] hover:underline font-semibold ml-1"
                            >
                              Manage
                            </button>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate">
                          {attr.categoryIds?.length
                            ? `${attr.categoryIds.length} categories`
                            : "Global (All categories)"}
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1">
                            {attr.isVariantAttribute && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                Variant
                              </span>
                            )}
                            {attr.isRequired && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                Required
                              </span>
                            )}
                            {attr.isFilterable && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Filterable
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openValueManager(attr)}
                              className="p-1 text-slate-500 hover:text-[#004D38] hover:bg-slate-100 rounded-lg transition-colors"
                              title="Manage Allowed Values"
                            >
                              <ListPlus className="size-4" />
                            </button>
                            <button
                              onClick={() => openEditModal(attr)}
                              className="p-1 text-slate-500 hover:text-[#004D38] hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit Attribute"
                            >
                              <Edit2 className="size-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(attr)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete Attribute"
                            >
                              <Trash2 className="size-4" />
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
        </div>
      )}

      {/* TAB 2: ATTRIBUTE SETS */}
      {activeTab === "sets" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PREDEFINED_SETS.map((set) => {
            const setAttrs = attributes.filter(
              (a) => (a.attributeGroup || "General").toLowerCase() === set.name.toLowerCase()
            );

            return (
              <div
                key={set.name}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900">{set.name}</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-[#004D38]">
                      {setAttrs.length} Attributes
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{set.description}</p>

                  <div className="mt-4 space-y-2">
                    <div className="text-[11px] font-semibold uppercase text-slate-400">Assigned Attributes:</div>
                    {setAttrs.length === 0 ? (
                      <div className="text-xs text-slate-400 italic">No attributes assigned to this set yet.</div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {setAttrs.map((a) => (
                          <span
                            key={a._id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
                          >
                            <span>{a.name}</span>
                            {a.isVariantAttribute && (
                              <span className="size-1.5 rounded-full bg-purple-600" title="Variant Axis" />
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    onClick={() => {
                      setSetFilter(set.name);
                      setActiveTab("attributes");
                    }}
                    className="text-[#004D38] font-semibold hover:underline"
                  >
                    View in Directory →
                  </button>

                  <button
                    onClick={() => {
                      setEditingAttribute(null);
                      setForm({
                        name: "",
                        slug: "",
                        type: "select",
                        attributeGroup: set.name,
                        categoryIds: [],
                        isRequired: false,
                        isVariantAttribute: false,
                        isFilterable: true,
                        values: [],
                      });
                      setShowModal(true);
                    }}
                    className="font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                  >
                    <Plus className="size-3.5" />
                    <span>Add to Set</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT ATTRIBUTE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {editingAttribute ? "Edit Platform Attribute" : "Create Platform Attribute"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Attribute Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Color, Storage, Size"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Slug (Optional)</label>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="e.g. color, storage"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Attribute Set *</label>
                  <select
                    value={form.attributeGroup}
                    onChange={(e) => setForm({ ...form, attributeGroup: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  >
                    {PREDEFINED_SETS.map((s) => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Input Type *</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  >
                    {ATTRIBUTE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Flags */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isVariantAttribute}
                    onChange={(e) => setForm({ ...form, isVariantAttribute: e.target.checked })}
                    className="rounded text-[#004D38] focus:ring-[#004D38]"
                  />
                  <div>
                    <span className="font-semibold text-slate-800">Variant Defining Axis</span>
                    <p className="text-[11px] text-slate-500">Creates variant matrices for products (e.g. Color, Size, RAM)</p>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isRequired}
                    onChange={(e) => setForm({ ...form, isRequired: e.target.checked })}
                    className="rounded text-[#004D38] focus:ring-[#004D38]"
                  />
                  <div>
                    <span className="font-semibold text-slate-800">Mandatory Specification</span>
                    <p className="text-[11px] text-slate-500">Must be provided when adding products in associated categories</p>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isFilterable}
                    onChange={(e) => setForm({ ...form, isFilterable: e.target.checked })}
                    className="rounded text-[#004D38] focus:ring-[#004D38]"
                  />
                  <div>
                    <span className="font-semibold text-slate-800">Storefront Filterable</span>
                    <p className="text-[11px] text-slate-500">Appears as a faceted filter in search and category pages</p>
                  </div>
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
                  className="px-5 py-2 font-semibold text-white bg-[#004D38] hover:bg-[#003828] rounded-xl shadow-xs disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingAttribute ? "Update Attribute" : "Create Attribute"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEDICATED VALUE MANAGEMENT MODAL */}
      {showValueModal && selectedAttrForValues && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Manage Values: {selectedAttrForValues.name}
                </h3>
                <p className="text-slate-500 text-[11px]">
                  Add, edit, reorder, or disable allowed value options
                </p>
              </div>
              <button
                onClick={() => setShowValueModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Add New Value Input */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
              <div className="font-semibold text-slate-800">Add New Value Option</div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newValueLabel}
                  onChange={(e) => setNewValueLabel(e.target.value)}
                  placeholder="Label (e.g. Midnight Black)"
                  className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                />
                <input
                  type="text"
                  value={newValueVal}
                  onChange={(e) => setNewValueVal(e.target.value)}
                  placeholder="Code/Value (e.g. midnight-black)"
                  className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                />
              </div>
              <button
                type="button"
                onClick={handleAddValue}
                disabled={!newValueLabel.trim()}
                className="w-full py-1.5 font-semibold text-xs text-white bg-[#004D38] hover:bg-[#003828] rounded-xl disabled:opacity-50"
              >
                + Add Option to List
              </button>
            </div>

            {/* List of Managed Values */}
            <div className="space-y-2">
              <div className="font-semibold text-slate-700">Configured Values ({managedValues.length}):</div>
              {managedValues.length === 0 ? (
                <div className="py-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No values defined yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl max-h-56 overflow-y-auto bg-white">
                  {managedValues.map((val, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 flex items-center justify-between gap-2 ${
                        !val.isActive ? "bg-slate-50/60 opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[10px] text-slate-400 w-4">{idx + 1}.</span>
                        <div className="truncate">
                          <span className="font-semibold text-slate-900">{val.label}</span>
                          <span className="text-slate-400 font-mono text-[10px] ml-1.5">({val.value})</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveValue(idx, -1)}
                          className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 text-slate-500"
                          title="Move Up"
                        >
                          <ArrowUp className="size-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === managedValues.length - 1}
                          onClick={() => handleMoveValue(idx, 1)}
                          className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 text-slate-500"
                          title="Move Down"
                        >
                          <ArrowDown className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleValueStatus(idx)}
                          className={`p-1 rounded text-xs ${
                            val.isActive ? "text-emerald-700 hover:bg-emerald-50" : "text-amber-700 hover:bg-amber-50"
                          }`}
                          title={val.isActive ? "Disable Value" : "Enable Value"}
                        >
                          <Power className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveValue(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Remove Value"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowValueModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveValues}
                disabled={savingValues}
                className="px-5 py-2 font-semibold text-white bg-[#004D38] hover:bg-[#003828] rounded-xl shadow-xs disabled:opacity-50"
              >
                {savingValues ? "Saving..." : "Save Values"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
