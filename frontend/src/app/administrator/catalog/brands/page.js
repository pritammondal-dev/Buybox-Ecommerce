"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Tag,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Globe,
  Upload,
  Image as ImageIcon,
  X,
  Loader2,
} from "lucide-react";
import { adminCatalogService, adminMediaService } from "@/services/admin/admin.service.js";

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [search, setSearch] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef(null);

  // Form State
  const [form, setForm] = useState({
    name: "",
    slug: "",
    website: "",
    description: "",
    logoUrl: "",
    logoAlt: "",
  });

  const fetchBrands = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminCatalogService.listBrands({ limit: 100 });
      const items = res?.items || res || [];
      setBrands(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load catalog brands"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  const handleNameChange = (name) => {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-");
    setForm((prev) => ({ ...prev, name, slug }));
  };

  const handleLogoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setError(null);
    try {
      const res = await adminMediaService.uploadMedia(file);
      const url = res?.url || res?.data?.url || res;
      setForm((prev) => ({
        ...prev,
        logoUrl: url,
        logoAlt: prev.logoAlt || prev.name || file.name,
      }));
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim(),
        website: form.website.trim() || null,
        logo: {
          url: form.logoUrl?.trim() || null,
          altText: form.logoAlt?.trim() || form.name.trim(),
        },
      };
      await adminCatalogService.createBrand(payload);
      setShowCreateModal(false);
      setForm({ name: "", slug: "", website: "", description: "", logoUrl: "", logoAlt: "" });
      setSuccess("Brand created successfully");
      setTimeout(() => setSuccess(null), 4000);
      fetchBrands();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to create brand"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingBrand) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim(),
        website: form.website.trim() || null,
        logo: {
          url: form.logoUrl?.trim() || null,
          altText: form.logoAlt?.trim() || form.name.trim(),
        },
      };
      await adminCatalogService.updateBrand(editingBrand._id, payload);
      setEditingBrand(null);
      setSuccess("Brand updated successfully");
      setTimeout(() => setSuccess(null), 4000);
      fetchBrands();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to update brand"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (brand) => {
    if (!confirm(`Are you sure you want to delete brand "${brand.name}"?`)) return;
    try {
      await adminCatalogService.deleteBrand(brand._id);
      setSuccess("Brand deleted successfully");
      setTimeout(() => setSuccess(null), 4000);
      fetchBrands();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to delete brand"
      );
    }
  };

  const openEditModal = (brand) => {
    setEditingBrand(brand);
    setForm({
      name: brand.name,
      slug: brand.slug,
      website: brand.website || "",
      description: brand.description || "",
      logoUrl: brand.logo?.url || "",
      logoAlt: brand.logo?.altText || "",
    });
  };

  const filtered = brands.filter((b) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return b.name?.toLowerCase().includes(s) || b.slug?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Tag className="size-6 text-[#004D38]" />
            <span>Brand Directory</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage marketplace verified manufacturer and retail brand profiles
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setForm({ name: "", slug: "", website: "", description: "", logoUrl: "", logoAlt: "" });
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#004D38] hover:bg-[#003829] rounded-xl shadow-xs transition-colors"
          >
            <Plus className="size-4" />
            <span>New Brand</span>
          </button>
        </div>
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

      {/* Search & List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search brands by name or slug..."
              className="w-full text-xs pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#004D38]"
            />
          </div>
          <div className="text-xs text-slate-500 font-semibold">
            {filtered.length} brands
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Loading brands...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Tag className="size-8 mx-auto text-slate-300" />
            <p className="text-sm">No brands found matching criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Brand</th>
                  <th className="py-3.5 px-4">Slug</th>
                  <th className="py-3.5 px-4">Website</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filtered.map((b) => (
                  <tr key={b._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-3">
                        {b.logo?.url ? (
                          <img
                            src={b.logo.url}
                            alt={b.name}
                            className="size-9 rounded-xl object-contain bg-white border border-slate-200 p-0.5 shadow-2xs"
                          />
                        ) : (
                          <div className="size-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                            <Tag className="size-4" />
                          </div>
                        )}
                        <div>
                          <div>{b.name}</div>
                          {b.description && (
                            <div className="text-[11px] font-normal text-slate-400 truncate max-w-xs">
                              {b.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">
                      {b.slug}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {b.website ? (
                        <a
                          href={b.website.startsWith("http") ? b.website : `https://${b.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[#004D38] hover:underline"
                        >
                          <Globe className="size-3" />
                          <span>{b.website.replace(/^https?:\/\//, "")}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          b.isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {b.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(b)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Brand"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(b)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Brand"
                        >
                          <Trash2 className="size-3.5" />
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

      {/* Create / Edit Modal */}
      {(showCreateModal || editingBrand) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900">
              {editingBrand ? "Edit Brand" : "Create New Brand"}
            </h3>

            <form
              onSubmit={editingBrand ? handleEditSubmit : handleCreateSubmit}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Brand Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Apple, Nike, Sony"
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  URL Slug *
                </label>
                <input
                  type="text"
                  required
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="e.g., apple"
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#004D38] focus:outline-hidden font-mono"
                />
              </div>

              {/* Brand Logo / Media */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Brand Logo
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoFileChange}
                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                  className="hidden"
                />

                {form.logoUrl ? (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <img
                      src={form.logoUrl}
                      alt={form.logoAlt || "Brand Logo"}
                      className="size-14 rounded-xl object-contain bg-white border border-slate-200 p-1 shadow-2xs"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-slate-700 truncate">
                        {form.logoUrl}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <button
                          type="button"
                          disabled={uploadingLogo}
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                        >
                          {uploadingLogo ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Upload className="size-3" />
                          )}
                          <span>Replace</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, logoUrl: "", logoAlt: "" }))}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors"
                        >
                          <X className="size-3" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={uploadingLogo}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 p-3.5 border-2 border-dashed border-slate-200 hover:border-[#004D38] rounded-2xl text-slate-500 hover:text-[#004D38] hover:bg-emerald-50/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {uploadingLogo ? (
                        <>
                          <Loader2 className="size-4 animate-spin text-[#004D38]" />
                          <span className="font-semibold text-slate-700">Uploading logo...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="size-4" />
                          <span className="font-semibold">Upload Brand Logo (PNG, JPG, WEBP, SVG)</span>
                        </>
                      )}
                    </button>
                    <input
                      type="text"
                      value={form.logoUrl}
                      onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                      placeholder="Or enter direct logo image URL (https://...)"
                      className="w-full p-2 rounded-xl border border-slate-200 text-[11px] focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Official Website (Optional)
                </label>
                <input
                  type="text"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brand story or summary..."
                  rows={3}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#004D38] focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingBrand(null);
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
                    : editingBrand
                    ? "Save Changes"
                    : "Create Brand"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
