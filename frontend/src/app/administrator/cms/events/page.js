"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Sparkles,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Eye,
  Trash2,
  Copy,
  Layers,
  Calendar,
  Globe,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUp,
  ArrowDown,
  X,
  Upload,
  ShoppingBag,
  Grid,
  Image as ImageIcon,
  Tag,
  Sliders,
  Check,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import { adminEventPageService } from "@/services/admin/admin.service.js";
import { productService } from "@/services/product.service.js";
import { categoryService } from "@/services/category.service.js";
import apiClient from "@/lib/api/axios.js";

const SECTION_TYPE_CONFIG = {
  hero_banner: {
    label: "Hero Showcase Banner",
    desc: "Large full-width visual hero with heading, badge, and CTA link",
    icon: ImageIcon,
    defaultConfig: {
      imageUrl: "",
      mobileImageUrl: "",
      linkUrl: "/shop",
      ctaText: "Shop The Event",
    },
  },
  banner_slider: {
    label: "Banner Carousel / Slider",
    desc: "Multi-slide rotating showcase for event specials and flash offers",
    icon: Layers,
    defaultConfig: {
      slides: [
        { imageUrl: "", title: "Event Exclusive Deals", subtitle: "Limited stocks available", linkUrl: "/shop", ctaText: "Explore Now" }
      ],
    },
  },
  promo_banner: {
    label: "Promotional Banner",
    desc: "Mid-page marketing banner with boxed or full-width layouts",
    icon: Megaphone,
    defaultConfig: {
      imageUrl: "",
      linkUrl: "/shop",
      ctaText: "Discover Deals",
      layout: "boxed",
    },
  },
  ad_banner: {
    label: "Advertisement / Sponsored Block",
    desc: "Clearly marked partner advertisement or sponsor spotlight",
    icon: Tag,
    defaultConfig: {
      imageUrl: "",
      linkUrl: "",
      sponsorName: "Featured Partner",
      trackingTag: "event-sponsor",
      isSponsored: true,
    },
  },
  category_grid: {
    label: "Event Category Grid",
    desc: "Quick-navigation grid linking to participating sale categories",
    icon: Grid,
    defaultConfig: {
      categoryIds: [],
    },
  },
  product_collection: {
    label: "Selected Products Collection",
    desc: "Curated hand-picked catalog products with real live pricing and ratings",
    icon: ShoppingBag,
    defaultConfig: {
      productIds: [],
      layout: "grid",
    },
  },
  category_products: {
    label: "Category-Targeted Products",
    desc: "Automatically display top products from a selected category",
    icon: ShoppingBag,
    defaultConfig: {
      categoryId: "",
      limit: 8,
      layout: "grid",
    },
  },
  brand_showcase: {
    label: "Brand Showcase",
    desc: "Logos and links of participating brands in this event",
    icon: Sparkles,
    defaultConfig: {
      brands: [
        { name: "Sony", linkUrl: "/brand/sony" },
        { name: "Bose", linkUrl: "/brand/bose" },
        { name: "Sennheiser", linkUrl: "/brand/sennheiser" },
      ],
    },
  },
  deals_collection: {
    label: "Blockbuster Deals Showcase",
    desc: "Spotlight discounted items with high markdown percentages",
    icon: Tag,
    defaultConfig: {
      productIds: [],
      layout: "grid",
    },
  },
  countdown: {
    label: "Event Countdown Clock",
    desc: "Ticking urgency countdown timer with announcement headline",
    icon: Clock,
    defaultConfig: {
      targetDate: "",
      headline: "Deals Expire Soon!",
      linkUrl: "/shop",
      ctaText: "Shop Before It Ends",
    },
  },
  rich_text: {
    label: "Event Information / Terms",
    desc: "Rich text block for announcements, terms, and sale highlights",
    icon: Sliders,
    defaultConfig: {
      content: "All discounts are automatically applied at checkout. Free shipping on orders over ₹999.",
      alignment: "center",
    },
  },
};

export default function AdminSpecialEventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Catalog items for section builder
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogCategories, setCatalogCategories] = useState([]);

  // Create / Edit Event Metadata Modal
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [submittingEvent, setSubmittingEvent] = useState(false);
  const [eventForm, setEventForm] = useState({
    name: "",
    slug: "",
    description: "",
    badge: "Special Event",
    status: "draft",
    startsAt: "",
    endsAt: "",
    timezone: "Asia/Kolkata",
    bannerUrl: "",
    mobileBannerUrl: "",
    primaryColor: "#004D38",
    accentColor: "#E6A800",
    isDark: false,
    seoTitle: "",
    seoDescription: "",
    seoKeywords: "",
  });

  // Section Builder Modal
  const [builderEvent, setBuilderEvent] = useState(null);
  const [builderSections, setBuilderSections] = useState([]);
  const [savingSections, setSavingSections] = useState(false);
  const [activeEditingSectionId, setActiveEditingSectionId] = useState(null);
  const [productSearch, setProductSearch] = useState("");

  // Preview Modal
  const [previewEvent, setPreviewEvent] = useState(null);

  // Uploading media state
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Fetch Event Pages
  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter && statusFilter !== "all") params.status = statusFilter;
      if (search && search.trim()) params.search = search.trim();
      const res = await adminEventPageService.list(params);
      const items = Array.isArray(res) ? res : res?.items || res?.data || [];
      setEvents(items);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load special event pages");
    } finally {
      setLoading(false);
    }
  };

  // Load catalog products & categories for section pickers
  useEffect(() => {
    async function loadCatalog() {
      try {
        const [prodRes, catRes] = await Promise.all([
          productService.getProducts({ limit: 100 }),
          categoryService.getCategories(),
        ]);
        const prods = prodRes?.data?.products || prodRes?.data?.data || prodRes?.data || [];
        const cats = catRes?.data?.categories || catRes?.data?.data || catRes?.data || [];
        setCatalogProducts(Array.isArray(prods) ? prods : []);
        setCatalogCategories(Array.isArray(cats) ? cats : []);
      } catch (e) {
        console.warn("Could not pre-load catalog items for event builder:", e);
      }
    }
    loadCatalog();
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [statusFilter]);

  // Open Create Modal
  const openCreateModal = () => {
    setEditingEvent(null);
    setEventForm({
      name: "",
      slug: "",
      description: "",
      badge: "Special Event",
      status: "draft",
      startsAt: "",
      endsAt: "",
      timezone: "Asia/Kolkata",
      bannerUrl: "",
      mobileBannerUrl: "",
      primaryColor: "#004D38",
      accentColor: "#E6A800",
      isDark: false,
      seoTitle: "",
      seoDescription: "",
      seoKeywords: "",
    });
    setShowEventModal(true);
  };

  // Open Edit Modal
  const openEditModal = (ev) => {
    setEditingEvent(ev);
    setEventForm({
      name: ev.name || "",
      slug: ev.slug || "",
      description: ev.description || "",
      badge: ev.badge || "Special Event",
      status: ev.status || "draft",
      startsAt: ev.startsAt ? new Date(ev.startsAt).toISOString().slice(0, 16) : "",
      endsAt: ev.endsAt ? new Date(ev.endsAt).toISOString().slice(0, 16) : "",
      timezone: ev.timezone || "Asia/Kolkata",
      bannerUrl: ev.bannerUrl || "",
      mobileBannerUrl: ev.mobileBannerUrl || "",
      primaryColor: ev.theme?.primaryColor || "#004D38",
      accentColor: ev.theme?.accentColor || "#E6A800",
      isDark: Boolean(ev.theme?.isDark),
      seoTitle: ev.seo?.title || "",
      seoDescription: ev.seo?.description || "",
      seoKeywords: Array.isArray(ev.seo?.keywords) ? ev.seo.keywords.join(", ") : "",
    });
    setShowEventModal(true);
  };

  // Auto-generate slug from name
  const handleNameChange = (val) => {
    setEventForm((prev) => ({
      ...prev,
      name: val,
      slug:
        !editingEvent || !prev.slug
          ? val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
          : prev.slug,
    }));
  };

  // Banner image file upload
  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setUploadingBanner(true);
    try {
      const res = await apiClient.post("/storefront/media/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res?.data?.data?.url || res?.data?.url;
      if (url) {
        setEventForm((prev) => ({ ...prev, [field]: url }));
        toast.success("Image uploaded successfully!");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to upload banner image");
    } finally {
      setUploadingBanner(false);
    }
  };

  // Save Event Metadata
  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!eventForm.name.trim() || !eventForm.slug.trim()) {
      toast.error("Event name and unique URL slug are required.");
      return;
    }

    setSubmittingEvent(true);
    try {
      const payload = {
        name: eventForm.name.trim(),
        slug: eventForm.slug.trim().toLowerCase(),
        description: eventForm.description.trim() || null,
        badge: eventForm.badge.trim() || null,
        status: eventForm.status,
        startsAt: eventForm.startsAt ? new Date(eventForm.startsAt).toISOString() : null,
        endsAt: eventForm.endsAt ? new Date(eventForm.endsAt).toISOString() : null,
        timezone: eventForm.timezone,
        bannerUrl: eventForm.bannerUrl.trim() || null,
        mobileBannerUrl: eventForm.mobileBannerUrl.trim() || null,
        theme: {
          primaryColor: eventForm.primaryColor,
          accentColor: eventForm.accentColor,
          isDark: eventForm.isDark,
        },
        seo: {
          title: eventForm.seoTitle.trim() || null,
          description: eventForm.seoDescription.trim() || null,
          keywords: eventForm.seoKeywords
            ? eventForm.seoKeywords.split(",").map((k) => k.trim()).filter(Boolean)
            : [],
        },
      };

      if (editingEvent) {
        await adminEventPageService.update(editingEvent._id, payload);
        toast.success("Special event page updated successfully!");
      } else {
        await adminEventPageService.create(payload);
        toast.success("Special event page created successfully!");
      }

      setShowEventModal(false);
      fetchEvents();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save event page");
    } finally {
      setSubmittingEvent(false);
    }
  };

  // Section Builder: Open for Event
  const openSectionBuilder = (ev) => {
    setBuilderEvent(ev);
    setBuilderSections(Array.isArray(ev.sections) ? JSON.parse(JSON.stringify(ev.sections)) : []);
    setActiveEditingSectionId(ev.sections?.[0]?.id || null);
  };

  // Section Builder: Add Section
  const handleAddSection = (type) => {
    const configTemplate = SECTION_TYPE_CONFIG[type]?.defaultConfig || {};
    const newSec = {
      id: `sec_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type,
      title: `New ${SECTION_TYPE_CONFIG[type]?.label || "Section"}`,
      subtitle: "",
      displayOrder: builderSections.length,
      isActive: true,
      config: JSON.parse(JSON.stringify(configTemplate)),
    };
    const updated = [...builderSections, newSec];
    setBuilderSections(updated);
    setActiveEditingSectionId(newSec.id);
    toast.info(`Added ${SECTION_TYPE_CONFIG[type]?.label}`);
  };

  // Section Builder: Move Section Up/Down
  const handleMoveSection = (idx, direction) => {
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= builderSections.length) return;

    const list = [...builderSections];
    const temp = list[idx];
    list[idx] = list[newIdx];
    list[newIdx] = temp;

    // re-assign display orders
    list.forEach((s, i) => {
      s.displayOrder = i;
    });

    setBuilderSections(list);
  };

  // Section Builder: Delete Section
  const handleDeleteSection = (id) => {
    const filtered = builderSections
      .filter((s) => s.id !== id)
      .map((s, idx) => ({ ...s, displayOrder: idx }));
    setBuilderSections(filtered);
    if (activeEditingSectionId === id) {
      setActiveEditingSectionId(filtered[0]?.id || null);
    }
    toast.info("Section removed");
  };

  // Section Builder: Save All Sections
  const handleSaveSections = async () => {
    if (!builderEvent) return;
    setSavingSections(true);
    try {
      const updated = await adminEventPageService.update(builderEvent._id, {
        sections: builderSections,
      });
      toast.success("Page sections saved and updated successfully!");
      setBuilderEvent(updated);
      fetchEvents();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save sections");
    } finally {
      setSavingSections(false);
    }
  };

  // Lifecycle Transitions
  const handlePublish = async (ev) => {
    try {
      await adminEventPageService.publish(ev._id);
      toast.success(`Published "${ev.name}" live to storefront!`);
      fetchEvents();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to publish event page");
    }
  };

  const handleUnpublish = async (ev) => {
    try {
      await adminEventPageService.unpublish(ev._id);
      toast.info(`Unpublished "${ev.name}". Page moved to draft.`);
      fetchEvents();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to unpublish event page");
    }
  };

  const handleDuplicate = async (ev) => {
    try {
      await adminEventPageService.duplicate(ev._id);
      toast.success(`Duplicated "${ev.name}" as a new draft!`);
      fetchEvents();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to duplicate event page");
    }
  };

  const handleArchive = async (ev) => {
    if (!window.confirm(`Are you sure you want to archive "${ev.name}"?`)) return;
    try {
      await adminEventPageService.archive(ev._id);
      toast.info(`Archived "${ev.name}".`);
      fetchEvents();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to archive event page");
    }
  };

  const handleDelete = async (ev) => {
    if (!window.confirm(`Permanently delete event page "${ev.name}"? This action cannot be undone.`)) return;
    try {
      await adminEventPageService.delete(ev._id);
      toast.success(`Deleted "${ev.name}".`);
      fetchEvents();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete event page");
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    return {
      total: events.length,
      published: events.filter((e) => e.status === "published").length,
      draft: events.filter((e) => e.status === "draft").length,
      scheduled: events.filter((e) => e.status === "scheduled").length,
      archived: events.filter((e) => e.status === "archived").length,
    };
  }, [events]);

  const activeEditingSection = builderSections.find((s) => s.id === activeEditingSectionId);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-[#004D38] to-emerald-600 text-white shadow-xs">
              <Sparkles className="size-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Special Event Page Builder
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Build, curate, schedule, and publish high-converting sale event landing pages with reusable dynamic sections.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchEvents}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer"
            title="Refresh event list"
          >
            <RefreshCw className="size-4" />
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-[#004D38] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-[#003B2B] active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="size-4" />
            <span>New Special Event</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Events</p>
          <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{stats.total}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Published Live</p>
          <p className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">{stats.published}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Drafts</p>
          <p className="text-xl sm:text-2xl font-black text-amber-700 mt-1">{stats.draft}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Scheduled</p>
          <p className="text-xl sm:text-2xl font-black text-blue-700 mt-1">{stats.scheduled}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs col-span-2 sm:col-span-1">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Archived</p>
          <p className="text-xl sm:text-2xl font-black text-slate-600 mt-1">{stats.archived}</p>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {["all", "published", "draft", "scheduled", "archived"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === st
                  ? "bg-[#004D38] text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchEvents()}
            placeholder="Search by event name or slug..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#004D38]/20 focus:border-[#004D38]"
          />
        </div>
      </div>

      {/* Event Pages List Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs sm:text-sm">
            <RefreshCw className="size-6 animate-spin mx-auto text-[#004D38] mb-2" />
            Loading special event pages...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-xs sm:text-sm">
            <AlertTriangle className="size-6 mx-auto mb-2 text-rose-500" />
            {error}
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
              <Sparkles className="size-6" />
            </div>
            <p className="font-bold text-slate-800 text-sm">No Special Event Pages Found</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Create your first sale event page (e.g. Diwali Dhamaka, Summer Electronics Festival) to curate deals and banners.
            </p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] text-white text-xs font-bold hover:bg-[#003B2B] cursor-pointer"
            >
              <Plus className="size-4" /> Create Event Page
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Event &amp; Badge</th>
                  <th className="py-3.5 px-4">URL Route</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Sections</th>
                  <th className="py-3.5 px-4">Schedule</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {events.map((ev) => {
                  const sectionCount = Array.isArray(ev.sections) ? ev.sections.length : 0;
                  const previewUrl = `/events/${ev.slug}?preview=true&token=${ev.previewToken}`;
                  const publicUrl = `/events/${ev.slug}`;

                  return (
                    <tr key={ev._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{ev.name}</span>
                            {ev.badge && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                {ev.badge}
                              </span>
                            )}
                          </div>
                          {ev.description && (
                            <p className="text-slate-500 text-[11px] line-clamp-1 max-w-xs">{ev.description}</p>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 font-mono text-[11px] text-emerald-800 font-semibold">
                          <span>/events/{ev.slug}</span>
                          {ev.status === "published" && (
                            <Link href={publicUrl} target="_blank" className="hover:text-emerald-950">
                              <ExternalLink className="size-3" />
                            </Link>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            ev.status === "published"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : ev.status === "draft"
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : ev.status === "scheduled"
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              ev.status === "published"
                                ? "bg-emerald-600"
                                : ev.status === "draft"
                                ? "bg-amber-600"
                                : ev.status === "scheduled"
                                ? "bg-blue-600"
                                : "bg-slate-400"
                            }`}
                          />
                          {ev.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                          {sectionCount} {sectionCount === 1 ? "section" : "sections"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-[11px] text-slate-500 space-y-0.5">
                          {ev.startsAt || ev.endsAt ? (
                            <>
                              <div>Starts: {ev.startsAt ? new Date(ev.startsAt).toLocaleDateString() : "Immediate"}</div>
                              <div>Ends: {ev.endsAt ? new Date(ev.endsAt).toLocaleDateString() : "Indefinite"}</div>
                            </>
                          ) : (
                            <span className="text-slate-400">Always active</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Section Builder Button */}
                          <button
                            onClick={() => openSectionBuilder(ev)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-[#004D38] border border-emerald-200 font-bold hover:bg-emerald-100 cursor-pointer text-xs"
                            title="Open Section Builder"
                          >
                            <Layers className="size-3.5" />
                            <span>Builder</span>
                          </button>

                          {/* Preview Link */}
                          <Link
                            href={previewUrl}
                            target="_blank"
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                            title="Live Storefront Preview (Admin/Token Authorized)"
                          >
                            <Eye className="size-3.5" />
                          </Link>

                          {/* Edit Details */}
                          <button
                            onClick={() => openEditModal(ev)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                            title="Edit Event Details"
                          >
                            <Edit2 className="size-3.5" />
                          </button>

                          {/* Duplicate */}
                          <button
                            onClick={() => handleDuplicate(ev)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                            title="Duplicate Event Page"
                          >
                            <Copy className="size-3.5" />
                          </button>

                          {/* Publish / Unpublish */}
                          {ev.status === "published" ? (
                            <button
                              onClick={() => handleUnpublish(ev)}
                              className="px-2 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-[11px] font-bold hover:bg-amber-100 cursor-pointer"
                              title="Unpublish event"
                            >
                              Unpublish
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePublish(ev)}
                              className="px-2 py-1.5 rounded-lg bg-[#004D38] text-white text-[11px] font-bold hover:bg-[#003B2B] cursor-pointer"
                              title="Publish event live"
                            >
                              Publish
                            </button>
                          )}

                          {/* Delete (if not published) */}
                          {ev.status !== "published" && (
                            <button
                              onClick={() => handleDelete(ev)}
                              className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                              title="Delete Event Page"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
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

      {/* ========================================================= */}
      {/* MODAL 1: Create / Edit Event Metadata & Theme             */}
      {/* ========================================================= */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingEvent ? "Edit Special Event Page" : "Create Special Event Page"}
                </h2>
                <p className="text-xs text-slate-500">
                  Define event title, route slug, badge, theme styling, and schedule.
                </p>
              </div>
              <button
                onClick={() => setShowEventModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-4 text-xs">
              {/* Event Name & Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Event Name *</label>
                  <input
                    type="text"
                    required
                    value={eventForm.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Diwali Dhamaka 2026"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#004D38]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Unique URL Slug *</label>
                  <div className="flex items-center">
                    <span className="bg-slate-100 border border-r-0 border-slate-200 text-slate-500 px-3 py-2 rounded-l-xl text-xs font-mono">
                      /events/
                    </span>
                    <input
                      type="text"
                      required
                      value={eventForm.slug}
                      onChange={(e) =>
                        setEventForm((prev) => ({
                          ...prev,
                          slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ""),
                        }))
                      }
                      placeholder="diwali-dhamaka"
                      className="w-full px-3 py-2 rounded-r-xl border border-slate-200 font-mono text-xs focus:outline-none focus:border-[#004D38]"
                    />
                  </div>
                </div>
              </div>

              {/* Badge & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1 sm:col-span-1">
                  <label className="font-bold text-slate-700">Event Badge</label>
                  <input
                    type="text"
                    value={eventForm.badge}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, badge: e.target.value }))}
                    placeholder="e.g. Grand Festive Sale"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#004D38]"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-slate-700">Description</label>
                  <input
                    type="text"
                    value={eventForm.description}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Short catchphrase or overview for the event"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#004D38]"
                  />
                </div>
              </div>

              {/* Theme Colors & Dark Mode */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <p className="font-bold text-slate-800">Event Theme &amp; Styling</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-600 font-medium">Primary Brand Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={eventForm.primaryColor}
                        onChange={(e) => setEventForm((prev) => ({ ...prev, primaryColor: e.target.value }))}
                        className="size-8 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={eventForm.primaryColor}
                        onChange={(e) => setEventForm((prev) => ({ ...prev, primaryColor: e.target.value }))}
                        className="w-full px-2 py-1 font-mono text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-600 font-medium">Accent Highlight Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={eventForm.accentColor}
                        onChange={(e) => setEventForm((prev) => ({ ...prev, accentColor: e.target.value }))}
                        className="size-8 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={eventForm.accentColor}
                        onChange={(e) => setEventForm((prev) => ({ ...prev, accentColor: e.target.value }))}
                        className="w-full px-2 py-1 font-mono text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="isDark"
                      checked={eventForm.isDark}
                      onChange={(e) => setEventForm((prev) => ({ ...prev, isDark: e.target.checked }))}
                      className="size-4 rounded text-[#004D38] focus:ring-[#004D38] cursor-pointer"
                    />
                    <label htmlFor="isDark" className="font-bold text-slate-700 cursor-pointer">
                      Dark Hero Theme
                    </label>
                  </div>
                </div>
              </div>

              {/* Header Banner Uploads */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700">Event Header Artwork (Desktop Banner)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={eventForm.bannerUrl}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, bannerUrl: e.target.value }))}
                    placeholder="/uploads/diwali-banner.png or URL"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs focus:outline-none focus:border-[#004D38]"
                  />
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200 cursor-pointer font-bold shrink-0">
                    <Upload className="size-3.5" />
                    <span>{uploadingBanner ? "Uploading..." : "Upload"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, "bannerUrl")}
                      disabled={uploadingBanner}
                    />
                  </label>
                </div>
              </div>

              {/* Scheduling Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Starts At (Optional)</label>
                  <input
                    type="datetime-local"
                    value={eventForm.startsAt}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, startsAt: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#004D38]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Ends At (Optional)</label>
                  <input
                    type="datetime-local"
                    value={eventForm.endsAt}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, endsAt: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#004D38]"
                  />
                </div>
              </div>

              {/* Status Selection */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Publication Status</label>
                <select
                  value={eventForm.status}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#004D38]"
                >
                  <option value="draft">Draft (Restricted to Authorized Admins)</option>
                  <option value="scheduled">Scheduled (Visible once start time arrives)</option>
                  <option value="published">Published (Live to all shoppers)</option>
                  <option value="archived">Archived (Ended / Archived)</option>
                </select>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEvent}
                  className="px-5 py-2 rounded-xl bg-[#004D38] text-white font-bold hover:bg-[#003B2B] shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {submittingEvent ? "Saving..." : editingEvent ? "Save Changes" : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: Section Builder Studio                           */}
      {/* ========================================================= */}
      {builderEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-6xl bg-white rounded-3xl shadow-2xl border border-slate-200 p-4 sm:p-6 space-y-4 my-auto max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-100 text-[#004D38] font-bold text-xs">
                    Page Builder
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    {builderEvent.name}
                  </h2>
                  <span className="text-xs font-mono text-slate-500">(/events/{builderEvent.slug})</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Add, reorder, configure, and customize reusable sections for this event page.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBuilderEvent(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveSections}
                  disabled={savingSections}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#004D38] text-white font-bold text-xs hover:bg-[#003B2B] shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="size-4" />
                  <span>{savingSections ? "Saving..." : "Save Sections"}</span>
                </button>
              </div>
            </div>

            {/* Builder Split Layout: Section Order List (Left) + Active Section Configurator (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 overflow-hidden min-h-0">
              {/* Left Column: Section List & Add Section Palette */}
              <div className="lg:col-span-5 flex flex-col gap-3 overflow-y-auto pr-1">
                {/* Add Section Dropdown / Palette */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 shrink-0">
                  <p className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Plus className="size-3.5 text-[#004D38]" /> Add New Section
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                    {Object.entries(SECTION_TYPE_CONFIG).map(([type, cfg]) => {
                      const IconComp = cfg.icon;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleAddSection(type)}
                          className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-[#004D38] hover:text-[#004D38] hover:bg-emerald-50/50 text-[11px] font-bold text-left transition-all cursor-pointer"
                        >
                          <IconComp className="size-3.5 shrink-0 text-slate-500" />
                          <span className="truncate">{cfg.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section Reorder Stack */}
                <div className="space-y-2 flex-1 overflow-y-auto">
                  <p className="font-bold text-slate-700 text-xs">
                    Page Sections ({builderSections.length})
                  </p>
                  {builderSections.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                      No sections added yet. Click any component above to add.
                    </div>
                  ) : (
                    builderSections.map((sec, idx) => {
                      const isSelected = sec.id === activeEditingSectionId;
                      const cfg = SECTION_TYPE_CONFIG[sec.type] || { label: sec.type, icon: Layers };
                      const IconComp = cfg.icon;

                      return (
                        <div
                          key={sec.id}
                          onClick={() => setActiveEditingSectionId(sec.id)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? "bg-emerald-50/60 border-[#004D38] shadow-xs"
                              : "bg-white border-slate-200 hover:border-slate-300"
                          } ${!sec.isActive ? "opacity-60" : ""}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="size-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-mono text-[10px] font-bold shrink-0">
                              {idx + 1}
                            </span>
                            <IconComp className="size-4 text-[#004D38] shrink-0" />
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 text-xs truncate">
                                {sec.title || cfg.label}
                              </p>
                              <p className="text-[10px] text-slate-500 capitalize">{cfg.label}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveSection(idx, "up")}
                              className="p-1 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-20 cursor-pointer"
                              title="Move Up"
                            >
                              <ArrowUp className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === builderSections.length - 1}
                              onClick={() => handleMoveSection(idx, "down")}
                              className="p-1 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-20 cursor-pointer"
                              title="Move Down"
                            >
                              <ArrowDown className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSection(sec.id)}
                              className="p-1 rounded-md text-rose-500 hover:bg-rose-100 cursor-pointer"
                              title="Delete Section"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Active Section Configurator Form */}
              <div className="lg:col-span-7 bg-slate-50/70 p-4 rounded-2xl border border-slate-200 overflow-y-auto">
                {activeEditingSection ? (
                  <div className="space-y-4 text-xs">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div>
                        <span className="font-mono text-[10px] text-[#004D38] uppercase font-bold">
                          Configuring: {SECTION_TYPE_CONFIG[activeEditingSection.type]?.label}
                        </span>
                        <h3 className="font-bold text-slate-900 text-sm">
                          {activeEditingSection.title || "Section Settings"}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={activeEditingSection.isActive !== false}
                            onChange={(e) => {
                              const updated = builderSections.map((s) =>
                                s.id === activeEditingSection.id ? { ...s, isActive: e.target.checked } : s
                              );
                              setBuilderSections(updated);
                            }}
                            className="size-4 rounded text-[#004D38] focus:ring-[#004D38]"
                          />
                          Active
                        </label>
                      </div>
                    </div>

                    {/* Common Section Heading & Subtitle */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-bold text-slate-700">Section Title</label>
                        <input
                          type="text"
                          value={activeEditingSection.title}
                          onChange={(e) => {
                            const updated = builderSections.map((s) =>
                              s.id === activeEditingSection.id ? { ...s, title: e.target.value } : s
                            );
                            setBuilderSections(updated);
                          }}
                          placeholder="e.g. Featured Blockbuster Deals"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#004D38]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-slate-700">Section Subtitle</label>
                        <input
                          type="text"
                          value={activeEditingSection.subtitle}
                          onChange={(e) => {
                            const updated = builderSections.map((s) =>
                              s.id === activeEditingSection.id ? { ...s, subtitle: e.target.value } : s
                            );
                            setBuilderSections(updated);
                          }}
                          placeholder="e.g. Handpicked electronics with verified warranties"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#004D38]"
                        />
                      </div>
                    </div>

                    {/* Section-Specific Configurations */}

                    {/* 1. Hero Banner Config */}
                    {(activeEditingSection.type === "hero_banner" ||
                      activeEditingSection.type === "promo_banner" ||
                      activeEditingSection.type === "ad_banner") && (
                      <div className="space-y-3 p-3 bg-white rounded-xl border border-slate-200">
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700">Banner Artwork Image URL</label>
                          <input
                            type="text"
                            value={activeEditingSection.config?.imageUrl || ""}
                            onChange={(e) => {
                              const config = { ...activeEditingSection.config, imageUrl: e.target.value };
                              const updated = builderSections.map((s) =>
                                s.id === activeEditingSection.id ? { ...s, config } : s
                              );
                              setBuilderSections(updated);
                            }}
                            placeholder="/uploads/festive-hero.png or external URL"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="font-bold text-slate-700">Destination Link URL</label>
                            <input
                              type="text"
                              value={activeEditingSection.config?.linkUrl || ""}
                              onChange={(e) => {
                                const config = { ...activeEditingSection.config, linkUrl: e.target.value };
                                const updated = builderSections.map((s) =>
                                  s.id === activeEditingSection.id ? { ...s, config } : s
                                );
                                setBuilderSections(updated);
                              }}
                              placeholder="/shop or /category/audio"
                              className="w-full px-3 py-2 rounded-xl border border-slate-200"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="font-bold text-slate-700">CTA Button Text</label>
                            <input
                              type="text"
                              value={activeEditingSection.config?.ctaText || ""}
                              onChange={(e) => {
                                const config = { ...activeEditingSection.config, ctaText: e.target.value };
                                const updated = builderSections.map((s) =>
                                  s.id === activeEditingSection.id ? { ...s, config } : s
                                );
                                setBuilderSections(updated);
                              }}
                              placeholder="Shop Now"
                              className="w-full px-3 py-2 rounded-xl border border-slate-200"
                            />
                          </div>
                        </div>

                        {activeEditingSection.type === "ad_banner" && (
                          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                            <div className="space-y-1">
                              <label className="font-bold text-slate-700">Sponsor / Brand Name</label>
                              <input
                                type="text"
                                value={activeEditingSection.config?.sponsorName || ""}
                                onChange={(e) => {
                                  const config = { ...activeEditingSection.config, sponsorName: e.target.value };
                                  const updated = builderSections.map((s) =>
                                    s.id === activeEditingSection.id ? { ...s, config } : s
                                  );
                                  setBuilderSections(updated);
                                }}
                                placeholder="e.g. Sony Electronics"
                                className="w-full px-3 py-2 rounded-xl border border-slate-200"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="font-bold text-slate-700">Tracking / Campaign Tag</label>
                              <input
                                type="text"
                                value={activeEditingSection.config?.trackingTag || ""}
                                onChange={(e) => {
                                  const config = { ...activeEditingSection.config, trackingTag: e.target.value };
                                  const updated = builderSections.map((s) =>
                                    s.id === activeEditingSection.id ? { ...s, config } : s
                                  );
                                  setBuilderSections(updated);
                                }}
                                placeholder="ad-partner-tag"
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2. Product Picker (for product_collection or deals_collection) */}
                    {(activeEditingSection.type === "product_collection" ||
                      activeEditingSection.type === "deals_collection") && (
                      <div className="space-y-3 p-3 bg-white rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-800">
                            Included Catalog Products (
                            {Array.isArray(activeEditingSection.config?.productIds)
                              ? activeEditingSection.config.productIds.length
                              : 0}{" "}
                            selected)
                          </label>
                          <input
                            type="text"
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            placeholder="Filter products..."
                            className="px-2.5 py-1 text-[11px] rounded-lg border border-slate-200"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pt-1">
                          {catalogProducts
                            .filter((p) =>
                              productSearch
                                ? p.name?.toLowerCase().includes(productSearch.toLowerCase())
                                : true
                            )
                            .map((prod) => {
                              const pId = prod._id || prod.id;
                              const isSelected = (
                                activeEditingSection.config?.productIds || []
                              ).includes(pId);

                              return (
                                <button
                                  key={pId}
                                  type="button"
                                  onClick={() => {
                                    const currentIds = activeEditingSection.config?.productIds || [];
                                    const nextIds = isSelected
                                      ? currentIds.filter((id) => id !== pId)
                                      : [...currentIds, pId];

                                    const config = { ...activeEditingSection.config, productIds: nextIds };
                                    const updated = builderSections.map((s) =>
                                      s.id === activeEditingSection.id ? { ...s, config } : s
                                    );
                                    setBuilderSections(updated);
                                  }}
                                  className={`p-2 rounded-xl text-left border flex items-center justify-between transition-colors cursor-pointer text-[11px] ${
                                    isSelected
                                      ? "bg-[#004D38]/10 border-[#004D38] text-[#004D38] font-bold"
                                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                                  }`}
                                >
                                  <span className="truncate pr-2">{prod.name}</span>
                                  <span className="font-mono text-slate-500 shrink-0">₹{prod.price}</span>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* 3. Category Grid Picker */}
                    {activeEditingSection.type === "category_grid" && (
                      <div className="space-y-3 p-3 bg-white rounded-xl border border-slate-200">
                        <label className="font-bold text-slate-800">
                          Select Displayed Categories (
                          {Array.isArray(activeEditingSection.config?.categoryIds)
                            ? activeEditingSection.config.categoryIds.length
                            : 0}{" "}
                          selected)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pt-1">
                          {catalogCategories.map((cat) => {
                            const cId = cat._id || cat.id;
                            const isSelected = (
                              activeEditingSection.config?.categoryIds || []
                            ).includes(cId);

                            return (
                              <button
                                key={cId}
                                type="button"
                                onClick={() => {
                                  const currentIds = activeEditingSection.config?.categoryIds || [];
                                  const nextIds = isSelected
                                    ? currentIds.filter((id) => id !== cId)
                                    : [...currentIds, cId];

                                  const config = { ...activeEditingSection.config, categoryIds: nextIds };
                                  const updated = builderSections.map((s) =>
                                    s.id === activeEditingSection.id ? { ...s, config } : s
                                  );
                                  setBuilderSections(updated);
                                }}
                                className={`p-2 rounded-xl text-left border transition-colors cursor-pointer text-[11px] truncate ${
                                  isSelected
                                    ? "bg-[#004D38]/10 border-[#004D38] text-[#004D38] font-bold"
                                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                {cat.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 4. Category-Targeted Products */}
                    {activeEditingSection.type === "category_products" && (
                      <div className="space-y-3 p-3 bg-white rounded-xl border border-slate-200">
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700">Target Category</label>
                          <select
                            value={activeEditingSection.config?.categoryId || ""}
                            onChange={(e) => {
                              const config = { ...activeEditingSection.config, categoryId: e.target.value };
                              const updated = builderSections.map((s) =>
                                s.id === activeEditingSection.id ? { ...s, config } : s
                              );
                              setBuilderSections(updated);
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                          >
                            <option value="">Select a Category...</option>
                            {catalogCategories.map((c) => (
                              <option key={c._id || c.id} value={c._id || c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-slate-700">Maximum Display Limit</label>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={activeEditingSection.config?.limit || 8}
                            onChange={(e) => {
                              const config = {
                                ...activeEditingSection.config,
                                limit: parseInt(e.target.value, 10) || 8,
                              };
                              const updated = builderSections.map((s) =>
                                s.id === activeEditingSection.id ? { ...s, config } : s
                              );
                              setBuilderSections(updated);
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                          />
                        </div>
                      </div>
                    )}

                    {/* 5. Countdown Clock Config */}
                    {activeEditingSection.type === "countdown" && (
                      <div className="space-y-3 p-3 bg-white rounded-xl border border-slate-200">
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700">Target Expiry Date &amp; Time *</label>
                          <input
                            type="datetime-local"
                            value={
                              activeEditingSection.config?.targetDate
                                ? new Date(activeEditingSection.config.targetDate).toISOString().slice(0, 16)
                                : ""
                            }
                            onChange={(e) => {
                              const config = {
                                ...activeEditingSection.config,
                                targetDate: e.target.value ? new Date(e.target.value).toISOString() : "",
                              };
                              const updated = builderSections.map((s) =>
                                s.id === activeEditingSection.id ? { ...s, config } : s
                              );
                              setBuilderSections(updated);
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="font-bold text-slate-700">Urgency Headline</label>
                            <input
                              type="text"
                              value={activeEditingSection.config?.headline || ""}
                              onChange={(e) => {
                                const config = { ...activeEditingSection.config, headline: e.target.value };
                                const updated = builderSections.map((s) =>
                                  s.id === activeEditingSection.id ? { ...s, config } : s
                                );
                                setBuilderSections(updated);
                              }}
                              placeholder="Midnight Flash Sale Ends Soon!"
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="font-bold text-slate-700">Action Link</label>
                            <input
                              type="text"
                              value={activeEditingSection.config?.linkUrl || ""}
                              onChange={(e) => {
                                const config = { ...activeEditingSection.config, linkUrl: e.target.value };
                                const updated = builderSections.map((s) =>
                                  s.id === activeEditingSection.id ? { ...s, config } : s
                                );
                                setBuilderSections(updated);
                              }}
                              placeholder="/shop"
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 6. Rich Text Block Config */}
                    {activeEditingSection.type === "rich_text" && (
                      <div className="space-y-3 p-3 bg-white rounded-xl border border-slate-200">
                        <label className="font-bold text-slate-700">Event Text / Terms Content</label>
                        <textarea
                          rows={4}
                          value={activeEditingSection.config?.content || ""}
                          onChange={(e) => {
                            const config = { ...activeEditingSection.config, content: e.target.value };
                            const updated = builderSections.map((s) =>
                              s.id === activeEditingSection.id ? { ...s, config } : s
                            );
                            setBuilderSections(updated);
                          }}
                          placeholder="Write terms, conditions, warranty guarantees, or sale highlights..."
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center p-8 text-center text-slate-400">
                    Select a section on the left to configure its properties.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
