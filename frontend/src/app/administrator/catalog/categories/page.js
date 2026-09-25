"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Layers,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  FolderTree,
  ChevronRight,
  Upload,
  Image as ImageIcon,
  X,
  Loader2,
} from "lucide-react";
import { adminCatalogService, adminMediaService } from "@/services/admin/admin.service.js";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [search, setSearch] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  // Form State
  const [form, setForm] = useState({
    name: "",
    slug: "",
    parentId: "",
    description: "",
    imageUrl: "",
    imageAlt: "",
  });

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminCatalogService.listCategories({ limit: 100 });
      const items = res?.items || res || [];
      setCategories(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load catalog categories"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleNameChange = (name) => {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-");
    setForm((prev) => ({ ...prev, name, slug }));
  };

  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setError(null);
    try {
      const res = await adminMediaService.uploadMedia(file);
      const url = res?.url || res?.data?.url || res;
      setForm((prev) => ({
        ...prev,
        imageUrl: url,
        imageAlt: prev.imageAlt || prev.name || file.name,
      }));
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
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
        image: {
          url: form.imageUrl?.trim() || null,
          altText: form.imageAlt?.trim() || form.name.trim(),
        },
      };
      if (form.parentId) {
        payload.parentId = form.parentId;
      }
      await adminCatalogService.createCategory(payload);
      setShowCreateModal(false);
      setForm({ name: "", slug: "", parentId: "", description: "", imageUrl: "", imageAlt: "" });
      setSuccess("Category created successfully");
      setTimeout(() => setSuccess(null), 4000);
      fetchCategories();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to create category"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingCategory) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim(),
        image: {
          url: form.imageUrl?.trim() || null,
          altText: form.imageAlt?.trim() || form.name.trim(),
        },
      };
      if (form.parentId) {
        payload.parentId = form.parentId;
      } else {
        payload.parentId = null;
      }
      await adminCatalogService.updateCategory(editingCategory._id, payload);
      setEditingCategory(null);
      setSuccess("Category updated successfully");
      setTimeout(() => setSuccess(null), 4000);
      fetchCategories();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to update category"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (cat) => {
    if (!confirm(`Are you sure you want to delete category "${cat.name}"?`)) return;
    try {
      await adminCatalogService.deleteCategory(cat._id);
      setSuccess("Category deleted successfully");
      setTimeout(() => setSuccess(null), 4000);
      fetchCategories();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to delete category"
      );
    }
  };

  const openEditModal = (cat) => {
    setEditingCategory(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId?._id || cat.parentId || "",
      description: cat.description || "",
      imageUrl: cat.image?.url || "",
      imageAlt: cat.image?.altText || "",
    });
  };

  const filtered = categories.filter((c) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return c.name?.toLowerCase().includes(s) || c.slug?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Layers className="size-6 text-[#004D38]" />
            <span>Category Hierarchy</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage marketplace catalog categories, taxonomy trees, and product classifications
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setForm({ name: "", slug: "", parentId: "", description: "", imageUrl: "", imageAlt: "" });
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#004D38] hover:bg-[#003829] rounded-xl shadow-xs transition-colors"
          >
            <Plus className="size-4" />
            <span>New Category</span>
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
              placeholder="Search categories by name or slug..."
              className="w-full text-xs pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#004D38]"
            />
          </div>
          <div className="text-xs text-slate-500 font-semibold">
            {filtered.length} categories
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Loading catalog categories...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <FolderTree className="size-8 mx-auto text-slate-300" />
            <p className="text-sm">No categories found matching criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Slug</th>
                  <th className="py-3.5 px-4">Parent Category</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filtered.map((cat) => {
                  const parent = categories.find(
                    (c) => c._id === (cat.parentId?._id || cat.parentId)
                  );
                  return (
                    <tr key={cat._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-3">
                          {cat.image?.url ? (
                            <img
                              src={cat.image.url}
                              alt={cat.name}
                              className="size-9 rounded-xl object-cover border border-slate-200 shadow-2xs"
                            />
                          ) : (
                            <div className="size-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                              <ImageIcon className="size-4" />
                            </div>
                          )}
                          <div>
                            <div>{cat.name}</div>
                            {cat.description && (
                              <div className="text-[11px] font-normal text-slate-400 truncate max-w-xs">
                                {cat.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {cat.slug}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {parent ? (
                          <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                            {parent.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Root Category</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            cat.isActive
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {cat.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(cat)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit Category"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(cat)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Category"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {(showCreateModal || editingCategory) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900">
              {editingCategory ? "Edit Category" : "Create New Category"}
            </h3>

            <form
              onSubmit={editingCategory ? handleEditSubmit : handleCreateSubmit}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Audio & Sound"
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
                  placeholder="e.g., audio-sound"
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#004D38] focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Parent Category (Optional)
                </label>
                <select
                  value={form.parentId}
                  onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                >
                  <option value="">None (Top-Level Category)</option>
                  {categories
                    .filter((c) => !editingCategory || c._id !== editingCategory._id)
                    .map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Category Image / Media */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Category Image / Thumbnail
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageFileChange}
                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                  className="hidden"
                />

                {form.imageUrl ? (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <img
                      src={form.imageUrl}
                      alt={form.imageAlt || "Category Preview"}
                      className="size-14 rounded-xl object-cover border border-slate-200 shadow-2xs"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-slate-700 truncate">
                        {form.imageUrl}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <button
                          type="button"
                          disabled={uploadingImage}
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                        >
                          {uploadingImage ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Upload className="size-3" />
                          )}
                          <span>Replace</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, imageUrl: "", imageAlt: "" }))}
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
                      disabled={uploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 p-3.5 border-2 border-dashed border-slate-200 hover:border-[#004D38] rounded-2xl text-slate-500 hover:text-[#004D38] hover:bg-emerald-50/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {uploadingImage ? (
                        <>
                          <Loader2 className="size-4 animate-spin text-[#004D38]" />
                          <span className="font-semibold text-slate-700">Uploading media...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="size-4" />
                          <span className="font-semibold">Upload Category Image (PNG, JPG, WEBP, SVG)</span>
                        </>
                      )}
                    </button>
                    <input
                      type="text"
                      value={form.imageUrl}
                      onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                      placeholder="Or enter direct image URL (https://...)"
                      className="w-full p-2 rounded-xl border border-slate-200 text-[11px] focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Short description for storefront category browsing..."
                  rows={3}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#004D38] focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingCategory(null);
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
                    : editingCategory
                    ? "Save Changes"
                    : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
