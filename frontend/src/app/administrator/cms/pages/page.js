"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Eye,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Archive,
  Globe,
  X,
  ExternalLink,
  Calendar,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { cmsPageService } from "@/services/admin/admin.service.js";

export default function AdminCmsPagesPage() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingPage, setEditingPage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState({
    title: "",
    slug: "",
    content: "",
    status: "draft",
    seoTitle: "",
    seoDescription: "",
    seoKeywords: "",
  });

  // Preview Modal
  const [previewPage, setPreviewPage] = useState(null);

  const fetchPages = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter && statusFilter !== "all") params.status = statusFilter;
      const res = await cmsPageService.list(params);
      const items = Array.isArray(res) ? res : res?.pages || res?.items || [];
      setPages(items);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load platform CMS pages"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPages();
  }, [statusFilter]);

  const openCreateModal = () => {
    setEditingPage(null);
    setForm({
      title: "",
      slug: "",
      content: "",
      status: "draft",
      seoTitle: "",
      seoDescription: "",
      seoKeywords: "",
    });
    setShowModal(true);
  };

  const openEditModal = (p) => {
    setEditingPage(p);
    setForm({
      title: p.title || "",
      slug: p.slug || "",
      content: p.content || "",
      status: p.status || "draft",
      seoTitle: p.seo?.title || "",
      seoDescription: p.seo?.description || "",
      seoKeywords: Array.isArray(p.seo?.keywords) ? p.seo.keywords.join(", ") : "",
    });
    setShowModal(true);
  };

  const handleTitleChange = (val) => {
    setForm((prev) => ({
      ...prev,
      title: val,
      slug: editingPage ? prev.slug : val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.slug.trim() || !form.content.trim()) {
      toast.error("Title, slug, and page content are required.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim().toLowerCase(),
        content: form.content.trim(),
        status: form.status,
        seo: {
          title: form.seoTitle.trim() || undefined,
          description: form.seoDescription.trim() || undefined,
          keywords: form.seoKeywords ? form.seoKeywords.split(",").map((k) => k.trim()).filter(Boolean) : [],
        },
      };

      if (editingPage) {
        await cmsPageService.update(editingPage._id || editingPage.id, payload);
        toast.success(`Page '${form.title}' updated successfully`);
        setSuccess(`Page '${form.title}' updated successfully`);
      } else {
        await cmsPageService.create(payload);
        toast.success(`Page '${form.title}' created successfully`);
        setSuccess(`Page '${form.title}' created successfully`);
      }

      setShowModal(false);
      setTimeout(() => setSuccess(null), 4000);
      fetchPages();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save CMS page");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublish = async (page) => {
    const isPublishing = page.status !== "published";
    const action = isPublishing ? "publish" : "unpublish";

    try {
      if (isPublishing) {
        await cmsPageService.publish(page._id || page.id);
        toast.success(`Page '${page.title}' published`);
        setSuccess(`Page '${page.title}' published`);
      } else {
        await cmsPageService.unpublish(page._id || page.id);
        toast.success(`Page '${page.title}' unpublished`);
        setSuccess(`Page '${page.title}' unpublished`);
      }
      setTimeout(() => setSuccess(null), 4000);
      fetchPages();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || `Failed to ${action} page`);
    }
  };

  const handleArchive = async (page) => {
    try {
      await cmsPageService.archive(page._id || page.id);
      toast.success(`Page '${page.title}' archived`);
      setSuccess(`Page '${page.title}' archived`);
      setTimeout(() => setSuccess(null), 4000);
      fetchPages();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to archive page");
    }
  };

  const handleDelete = async (page) => {
    try {
      await cmsPageService.delete(page._id || page.id);
      toast.success(`Page '${page.title}' deleted`);
      setSuccess(`Page '${page.title}' deleted`);
      setTimeout(() => setSuccess(null), 4000);
      fetchPages();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to delete page");
    }
  };

  const filteredPages = pages.filter((p) => {
    const matchesSearch =
      !search ||
      p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.slug?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileText className="size-6 text-[#004D38]" />
            <span>Content Management (CMS) Pages</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Author and publish platform content: Terms of Service, Privacy Policy, Return &amp; Shipping Policies, About Us
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchPages}
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
            <span>Create Page</span>
          </button>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5">
          <CheckCircle className="size-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2.5">
          <AlertTriangle className="size-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: "all", label: "All Pages" },
            { id: "published", label: "Published" },
            { id: "draft", label: "Draft" },
            { id: "archived", label: "Archived" },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors ${
                statusFilter === st.id
                  ? "bg-[#004D38] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search pages by title or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
          />
        </div>
      </div>

      {/* CMS Pages Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Page Title</th>
                <th className="px-5 py-3.5">Public URL Slug</th>
                <th className="px-5 py-3.5">SEO Title</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Last Updated</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-400">
                    <RefreshCw className="size-4 animate-spin mx-auto mb-2 text-[#004D38]" />
                    <span>Loading platform pages...</span>
                  </td>
                </tr>
              ) : filteredPages.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-400">
                    No CMS pages found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredPages.map((p) => (
                  <tr key={p._id || p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{p.title}</div>
                      <div className="text-slate-400 text-[11px] truncate max-w-xs mt-0.5">
                        {p.content?.slice(0, 80)}...
                      </div>
                    </td>

                    <td className="px-5 py-3.5 font-mono text-[11px] text-[#004D38] font-semibold">
                      /{p.slug}
                    </td>

                    <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate">
                      {p.seo?.title || p.title}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          p.status === "published"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : p.status === "archived"
                            ? "bg-slate-100 text-slate-600 border border-slate-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            p.status === "published"
                              ? "bg-emerald-600"
                              : p.status === "archived"
                              ? "bg-slate-400"
                              : "bg-amber-500"
                          }`}
                        />
                        {p.status || "draft"}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-slate-500 text-[11px]">
                      {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString("en-IN") : "—"}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setPreviewPage(p)}
                          className="p-1 text-slate-500 hover:text-[#004D38] hover:bg-slate-100 rounded-lg transition-colors"
                          title="Preview Page"
                        >
                          <Eye className="size-4" />
                        </button>

                        <button
                          onClick={() => handleTogglePublish(p)}
                          className={`p-1 rounded-lg transition-colors ${
                            p.status === "published"
                              ? "text-amber-600 hover:bg-amber-50"
                              : "text-emerald-700 hover:bg-emerald-50"
                          }`}
                          title={p.status === "published" ? "Unpublish Page" : "Publish Page"}
                        >
                          <Globe className="size-4" />
                        </button>

                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Page"
                        >
                          <Edit2 className="size-4" />
                        </button>

                        <button
                          onClick={() => handleArchive(p)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Archive Page"
                        >
                          <Archive className="size-4" />
                        </button>

                        <button
                          onClick={() => handleDelete(p)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Page"
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

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-xl border border-slate-100 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {editingPage ? "Edit CMS Page" : "Create New CMS Page"}
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
                  <label className="block font-semibold text-slate-700 mb-1">Page Title *</label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="e.g. Return & Refund Policy"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">URL Slug *</label>
                  <input
                    type="text"
                    required
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().trim() })}
                    placeholder="e.g. return-policy"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Page Content *</label>
                <textarea
                  required
                  rows={8}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Enter page content, policy guidelines, HTML or markdown markup..."
                  className="w-full p-3 border border-slate-200 rounded-xl font-sans focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Publication Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                >
                  <option value="draft">Draft (Private)</option>
                  <option value="published">Published (Live on Storefront)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* SEO Meta Fields */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="font-bold text-slate-800">Search Engine Optimization (SEO)</div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">SEO Title Tag</label>
                  <input
                    type="text"
                    value={form.seoTitle}
                    onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
                    placeholder="e.g. Buybox Return & Refund Policy | Official Terms"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Meta Description</label>
                  <textarea
                    rows={2}
                    value={form.seoDescription}
                    onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
                    placeholder="Search snippet summary..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Keywords (Comma-separated)</label>
                  <input
                    type="text"
                    value={form.seoKeywords}
                    onChange={(e) => setForm({ ...form, seoKeywords: e.target.value })}
                    placeholder="e.g. return policy, refunds, cancellations, warranty"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  />
                </div>
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
                  {submitting ? "Saving..." : editingPage ? "Update Page" : "Create Page"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 space-y-4 shadow-2xl border border-slate-100 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="font-mono text-[10px] text-slate-400">/{previewPage.slug}</span>
                <h3 className="font-bold text-slate-900 text-xl">{previewPage.title}</h3>
              </div>
              <button
                onClick={() => setPreviewPage(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed text-sm">
              {previewPage.content}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-slate-500">
              <span className="text-[11px]">
                Status: <strong>{previewPage.status}</strong>
              </span>
              <button
                type="button"
                onClick={() => setPreviewPage(null)}
                className="px-5 py-2 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
