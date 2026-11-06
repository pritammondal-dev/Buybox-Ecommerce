"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Sliders,
  Sparkles,
  Star,
  Award,
  Flame,
  Zap,
  Plus,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Check,
  X,
  Search,
  Move,
  RefreshCw,
  Palette,
  ExternalLink,
  AlertCircle,
  ShoppingBag,
  Layers,
  LayoutGrid,
  Info,
  Calendar,
  ShieldAlert,
  Pin,
  Ban,
  Tag,
  Briefcase,
  SlidersHorizontal,
  GripVertical,
  CheckSquare,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { storefrontService } from "../../../services/storefront.service.js";
import { productService } from "../../../services/product.service.js";
import { categoryService } from "../../../services/category.service.js";
import { brandService } from "../../../services/brand.service.js";
import { cn } from "../../../utils/cn.js";
import { formatCurrency } from "../../../utils/formatCurrency.js";

const PRESET_THEMES = [
  {
    name: "Buybox Default",
    theme: {
      backgroundColor: null,
      borderColor: null,
      headingColor: null,
      textColor: null,
      accentColor: null,
      badgeColor: null,
      buttonBgColor: null,
      buttonTextColor: null,
    },
  },
  {
    name: "Emerald Light",
    theme: {
      backgroundColor: "#F0FDF4",
      borderColor: "#BBF7D0",
      headingColor: "#065F46",
      textColor: "#374151",
      accentColor: "#007A55",
      badgeColor: "#059669",
      buttonBgColor: "#007A55",
      buttonTextColor: "#FFFFFF",
    },
  },
  {
    name: "Warm Cream",
    theme: {
      backgroundColor: "#FFFDF0",
      borderColor: "#FDE68A",
      headingColor: "#78350F",
      textColor: "#451A03",
      accentColor: "#D97706",
      badgeColor: "#B45309",
      buttonBgColor: "#B45309",
      buttonTextColor: "#FFFFFF",
    },
  },
  {
    name: "Rose Deals",
    theme: {
      backgroundColor: "#FFF1F2",
      borderColor: "#FECDD3",
      headingColor: "#9F1239",
      textColor: "#4C0519",
      accentColor: "#E11D48",
      badgeColor: "#BE123C",
      buttonBgColor: "#BE123C",
      buttonTextColor: "#FFFFFF",
    },
  },
  {
    name: "Amber Flash",
    theme: {
      backgroundColor: "#FFFBEB",
      borderColor: "#FDE68A",
      headingColor: "#92400E",
      textColor: "#78350F",
      accentColor: "#D97706",
      badgeColor: "#B45309",
      buttonBgColor: "#D97706",
      buttonTextColor: "#FFFFFF",
    },
  },
  {
    name: "Tech Violet",
    theme: {
      backgroundColor: "#FAF5FF",
      borderColor: "#E9D5FF",
      headingColor: "#581C87",
      textColor: "#3B0764",
      accentColor: "#7E22CE",
      badgeColor: "#6B21A8",
      buttonBgColor: "#7E22CE",
      buttonTextColor: "#FFFFFF",
    },
  },
  {
    name: "Dark Luxury",
    theme: {
      backgroundColor: "#0F172A",
      borderColor: "#334155",
      headingColor: "#F8FAFC",
      textColor: "#CBD5E1",
      accentColor: "#38BDF8",
      badgeColor: "#0284C7",
      buttonBgColor: "#38BDF8",
      buttonTextColor: "#0F172A",
    },
  },
];

// WCAG relative luminance & contrast ratio calculation
function getLuminance(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#")) return 0.5;
  const cleanHex = hex.replace("#", "");
  if (cleanHex.length !== 3 && cleanHex.length !== 6) return 0.5;
  const fullHex =
    cleanHex.length === 3
      ? cleanHex.split("").map((c) => c + c).join("")
      : cleanHex;
  const r = parseInt(fullHex.substring(0, 2), 16) / 255;
  const g = parseInt(fullHex.substring(2, 4), 16) / 255;
  const b = parseInt(fullHex.substring(4, 6), 16) / 255;
  if (isNaN(r) || isNaN(g) || isNaN(b)) return 0.5;
  const [aR, aG, aB] = [r, g, b].map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * aR + 0.7152 * aG + 0.0722 * aB;
}

function calculateContrastRatio(hex1, hex2) {
  const lum1 = getLuminance(hex1 || "#FFFFFF");
  const lum2 = getLuminance(hex2 || "#0F172A");
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  const ratio = (brightest + 0.05) / (darkest + 0.05);
  return Number(ratio.toFixed(1));
}

export function StorefrontMerchandisingManager() {
  const [activeTab, setActiveTab] = useState("sections");
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  // Product Search State (shared for picker)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Custom Section Modal
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [editingCustomSection, setEditingCustomSection] = useState(null);

  // Custom section currently selected for deep configuration in Tab 6
  const [selectedCustomSectionId, setSelectedCustomSectionId] = useState(null);

  // Load sections from API
  const loadSections = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await storefrontService.getAllSections();
      const list = res?.data || (Array.isArray(res) ? res : []);
      const sorted = [...list].sort(
        (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
      );
      setSections(sorted);
    } catch {
      toast.error("Failed to load storefront sections");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load categories and brands
  useEffect(() => {
    categoryService
      .getCategories({ limit: 100 })
      .then((res) => {
        const cats = res?.data?.categories || res?.data || [];
        setCategories(Array.isArray(cats) ? cats : []);
      })
      .catch(() => {});

    brandService
      .getBrands({ limit: 100 })
      .then((res) => {
        const bList = res?.data?.brands || res?.data || [];
        setBrands(Array.isArray(bList) ? bList : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  // Debounced product search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await productService.getProducts({
          search: searchQuery.trim(),
          limit: 12,
          status: "active",
        });
        const prods =
          res?.data?.products || (Array.isArray(res?.data) ? res.data : []);
        setSearchResults(prods);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // System section accessors
  const featuredSection = useMemo(
    () =>
      sections.find(
        (s) => s.key === "featured_products" || s.type === "featured_products"
      ) || null,
    [sections]
  );

  const newArrivalsSection = useMemo(
    () =>
      sections.find(
        (s) => s.key === "new_arrivals" || s.type === "new_arrivals"
      ) || null,
    [sections]
  );

  const bestSellersSection = useMemo(
    () =>
      sections.find(
        (s) => s.key === "best_sellers" || s.type === "best_sellers"
      ) || null,
    [sections]
  );

  const hotDealsSection = useMemo(
    () =>
      sections.find(
        (s) => s.key === "flash_deal" || s.type === "flash_deal"
      ) || null,
    [sections]
  );

  const flashSaleSection = useMemo(
    () =>
      sections.find(
        (s) => s.key === "flash_sale" || s.type === "flash_sale"
      ) || null,
    [sections]
  );

  const customSections = useMemo(
    () =>
      sections.filter((s) =>
        [
          "carousel",
          "grid",
          "category_showcase",
          "brand_showcase",
          "mixed_collection",
          "promotional_banner",
        ].includes(s.type)
      ),
    [sections]
  );

  const activeCustomSection = useMemo(
    () =>
      customSections.find(
        (s) => (s._id || s.id) === selectedCustomSectionId
      ) || null,
    [customSections, selectedCustomSectionId]
  );

  // Bulk reorder handler
  const handleMoveSection = async (index, direction) => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;

    const updated = [...sections];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);

    const reordered = updated.map((sec, idx) => ({
      ...sec,
      displayOrder: idx + 1,
    }));
    setSections(reordered);

    try {
      await storefrontService.reorderSections(
        reordered.map((s) => ({
          id: s._id || s.id,
          displayOrder: s.displayOrder,
          isActive: s.isActive,
        }))
      );
      toast.success("Section display order updated");
    } catch {
      toast.error("Failed to persist section order");
      loadSections();
    }
  };

  // Toggle active status for section
  const handleToggleActive = async (section) => {
    const updatedStatus = !section.isActive;
    const sectionId = section._id || section.id;

    setSections((prev) =>
      prev.map((s) =>
        (s._id || s.id) === sectionId ? { ...s, isActive: updatedStatus } : s
      )
    );

    try {
      await storefrontService.updateSection(sectionId, {
        isActive: updatedStatus,
      });
      toast.success(
        `Section "${section.title}" ${
          updatedStatus ? "activated" : "deactivated"
        }`
      );
    } catch {
      toast.error("Failed to update section status");
      loadSections();
    }
  };

  // Seed / initialize default sections
  const handleSeedDefaults = async () => {
    setIsSaving(true);
    try {
      await storefrontService.initializeDefaults();
      toast.success("Standard system storefront sections initialized");
      await loadSections();
    } catch {
      toast.error("Could not initialize default sections");
    } finally {
      setIsSaving(false);
    }
  };

  // Generic section updater
  const handleSaveSection = async (sectionId, patchData) => {
    setIsSaving(true);
    try {
      const res = await storefrontService.updateSection(sectionId, patchData);
      const updated = res?.data || res;
      setSections((prev) =>
        prev.map((s) =>
          (s._id || s.id) === sectionId ? { ...s, ...updated } : s
        )
      );
      toast.success("Section updated successfully");
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to save section changes"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Custom section deletion
  const handleDeleteSection = async (sectionId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this custom section? Underlying products and categories will remain safe."
      )
    ) {
      return;
    }

    try {
      await storefrontService.deleteSection(sectionId);
      toast.success("Custom section deleted");
      setSections((prev) =>
        prev.filter((s) => (s._id || s.id) !== sectionId)
      );
      if (selectedCustomSectionId === sectionId) {
        setSelectedCustomSectionId(null);
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to delete custom section"
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-3xl bg-linear-to-r from-[#002C20] via-[#003829] to-[#0F172A] text-white shadow-sm border border-emerald-950">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <Sliders className="size-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Advanced Storefront Merchandising Builder
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-emerald-300 font-medium max-w-2xl">
            Central command for category and brand showcases, multi-group tabs,
            manual/automatic/hybrid product selection, independent discovery pagination, and scoped theme styling.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleSeedDefaults}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-950/80 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-900 hover:text-white transition-colors border border-emerald-800/60"
          >
            <RefreshCw className={cn("size-3.5", isSaving && "animate-spin")} />
            <span>Seed / Reset Defaults</span>
          </button>
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 transition-colors"
          >
            <ExternalLink className="size-3.5" />
            <span>View Live Store</span>
          </Link>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        {[
          { id: "sections", label: "All Sections & Order", icon: Sliders },
          { id: "featured", label: "Featured Products", icon: Star },
          { id: "new_arrivals", label: "New Arrivals", icon: Sparkles },
          { id: "best_sellers", label: "Best Sellers", icon: Award },
          { id: "deals", label: "Deals & Flash Sale", icon: Flame },
          { id: "custom", label: "Category & Brand Showcases", icon: LayoutGrid },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 whitespace-nowrap cursor-pointer",
                isActive
                  ? "bg-[#007A55] text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: All Sections & Ordering */}
      {activeTab === "sections" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Homepage Section Hierarchy & Ordering
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Reorder storefront sections, toggle visibility, and inspect
                dynamic product counts and selection modes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingCustomSection(null);
                setIsCustomModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#007A55] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#006346] transition-colors cursor-pointer"
            >
              <Plus className="size-4" />
              <span>New Showcase / Section</span>
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
            {sections.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <Info className="size-8 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-500 font-medium">
                  No storefront sections found. Click &quot;Seed / Reset Defaults&quot; above to initialize standard sections.
                </p>
              </div>
            ) : (
              sections.map((section, idx) => {
                const isSystem =
                  section.isSystem ||
                  [
                    "featured_products",
                    "new_arrivals",
                    "best_sellers",
                    "flash_deal",
                    "flash_sale",
                  ].includes(section.key);

                return (
                  <div
                    key={section._id || section.id || section.key}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex flex-col items-center justify-center size-8 rounded-xl bg-slate-100 text-slate-600 font-black text-xs shrink-0">
                        {idx + 1}
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-slate-900 truncate">
                            {section.title}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md",
                              isSystem
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-purple-100 text-purple-800"
                            )}
                          >
                            {isSystem ? "System Section" : "Custom Showcase"}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md uppercase">
                            {section.type?.replace(/_/g, " ")}
                          </span>
                          {section.selectionMode && (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md uppercase">
                              Mode: {section.selectionMode}
                            </span>
                          )}
                          {section.viewMoreEnabled && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              View More: Active
                            </span>
                          )}
                        </div>

                        {section.subtitle && (
                          <p className="text-xs text-slate-500 truncate">
                            {section.subtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      {/* Active toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(section)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer",
                          section.isActive
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        )}
                      >
                        {section.isActive ? (
                          <>
                            <Eye className="size-3.5" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="size-3.5" />
                            <span>Hidden</span>
                          </>
                        )}
                      </button>

                      {/* Move controls */}
                      <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden bg-white">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveSection(idx, "up")}
                          aria-label="Move section up"
                          className="p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors border-r border-slate-200 cursor-pointer"
                        >
                          <ArrowUp className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === sections.length - 1}
                          onClick={() => handleMoveSection(idx, "down")}
                          aria-label="Move section down"
                          className="p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          <ArrowDown className="size-3.5" />
                        </button>
                      </div>

                      {/* Edit or Delete */}
                      {!isSystem ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomSectionId(section._id || section.id);
                              setActiveTab("custom");
                            }}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Configure Showcase Builder"
                          >
                            <SlidersHorizontal className="size-3.5 text-emerald-600" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCustomSection(section);
                              setIsCustomModalOpen(true);
                            }}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Meta Info"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteSection(section._id || section.id)
                            }
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Section"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (section.key === "featured_products")
                              setActiveTab("featured");
                            else if (section.key === "new_arrivals")
                              setActiveTab("new_arrivals");
                            else if (section.key === "best_sellers")
                              setActiveTab("best_sellers");
                            else setActiveTab("deals");
                          }}
                          className="px-2.5 py-1 text-xs font-bold text-[#007A55] hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        >
                          Configure
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Featured Products */}
      {activeTab === "featured" && featuredSection && (
        <SectionEditorPanel
          section={featuredSection}
          categories={categories}
          brands={brands}
          onSave={handleSaveSection}
          isSaving={isSaving}
          allowModeChange={true}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchResults={searchResults}
          isSearching={isSearching}
        />
      )}

      {/* Tab 3: New Arrivals */}
      {activeTab === "new_arrivals" && newArrivalsSection && (
        <SectionEditorPanel
          section={newArrivalsSection}
          categories={categories}
          brands={brands}
          onSave={handleSaveSection}
          isSaving={isSaving}
          allowModeChange={true}
          modeDescription="In Automatic mode, Buybox ranks newly published active products by their creation timestamp. In Hybrid mode, pinned products appear first."
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchResults={searchResults}
          isSearching={isSearching}
        />
      )}

      {/* Tab 4: Best Sellers */}
      {activeTab === "best_sellers" && bestSellersSection && (
        <SectionEditorPanel
          section={bestSellersSection}
          categories={categories}
          brands={brands}
          onSave={handleSaveSection}
          isSaving={isSaving}
          allowModeChange={true}
          isBestSeller={true}
          modeDescription="In Automatic mode, Buybox aggregates authoritative completed and paid order-line data over the configured lookback period. Cancelled and refunded orders are excluded."
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchResults={searchResults}
          isSearching={isSearching}
        />
      )}

      {/* Tab 5: Deals & Flash Sale */}
      {activeTab === "deals" && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
            <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Authoritative Pricing Safeguard</p>
              <p className="mt-0.5 text-amber-800">
                Discount calculations, flash sale countdowns, and promotional
                floor prices are strictly calculated by the authoritative backend
                pricing engine. You can configure section visibility, independent listing limits, and theme
                styling below, or manage active deals in Marketing Campaigns.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {hotDealsSection && (
              <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <Flame className="size-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">
                        {hotDealsSection.title}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Today&apos;s Hot Deals Row
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(hotDealsSection)}
                    className={cn(
                      "text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer",
                      hotDealsSection.isActive
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {hotDealsSection.isActive ? "Active" : "Hidden"}
                  </button>
                </div>

                <SectionEditorPanel
                  section={hotDealsSection}
                  categories={categories}
                  brands={brands}
                  onSave={handleSaveSection}
                  isSaving={isSaving}
                  allowModeChange={true}
                  compact={true}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  searchResults={searchResults}
                  isSearching={isSearching}
                />
              </div>
            )}

            {flashSaleSection && (
              <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Zap className="size-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">
                        {flashSaleSection.title}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Flash Sale Row
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(flashSaleSection)}
                    className={cn(
                      "text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer",
                      flashSaleSection.isActive
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {flashSaleSection.isActive ? "Active" : "Hidden"}
                  </button>
                </div>

                <SectionEditorPanel
                  section={flashSaleSection}
                  categories={categories}
                  brands={brands}
                  onSave={handleSaveSection}
                  isSaving={isSaving}
                  allowModeChange={true}
                  compact={true}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  searchResults={searchResults}
                  isSearching={isSearching}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Custom Sections & Showcases */}
      {activeTab === "custom" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Category, Brand & Custom Showcases
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure dedicated brand showcases, multi-group category tabs (Flipkart style),
                mixed collections, and full discovery pages.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingCustomSection(null);
                setIsCustomModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#007A55] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#006346] transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Plus className="size-4" />
              <span>Create New Showcase</span>
            </button>
          </div>

          {/* Quick Selection Cards for Custom Showcases */}
          {customSections.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-3">
              <LayoutGrid className="size-8 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-500 font-medium">
                No custom special showcases created yet. Click above to add a
                category showcase, brand showcase, or custom carousel.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {customSections.map((sec) => {
                const isSelected =
                  (sec._id || sec.id) === selectedCustomSectionId;
                return (
                  <div
                    key={sec._id || sec.id}
                    onClick={() =>
                      setSelectedCustomSectionId(
                        isSelected ? null : sec._id || sec.id
                      )
                    }
                    className={cn(
                      "p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 text-left",
                      isSelected
                        ? "bg-emerald-50/60 border-emerald-600 ring-2 ring-emerald-600/20 shadow-xs"
                        : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-900 truncate">
                          {sec.title}
                        </span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                          {sec.type?.replace(/_/g, " ")}
                        </span>
                      </div>
                      {sec.subtitle && (
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-1">
                          {sec.subtitle}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                      <span>
                        {sec.groups?.length
                          ? `${sec.groups.length} Group Tabs`
                          : sec.type === "brand_showcase"
                          ? "Brand Showcase"
                          : `Limit: ${sec.limit || 12}`}
                      </span>
                      <span className="font-semibold text-emerald-700">
                        {isSelected ? "Editing Below ↓" : "Configure →"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Deep Editor Panel for Selected Custom Showcase */}
          {activeCustomSection ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-emerald-600" />
                  <span>Configuring Showcase: {activeCustomSection.title}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedCustomSectionId(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Close Editor
                </button>
              </div>

              <SectionEditorPanel
                section={activeCustomSection}
                categories={categories}
                brands={brands}
                onSave={handleSaveSection}
                isSaving={isSaving}
                allowModeChange={true}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchResults={searchResults}
                isSearching={isSearching}
              />
            </div>
          ) : (
            customSections.length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 text-center">
                Select a showcase card above to configure its groups, hybrid rules, pinned items, discovery limits, and scoped themes.
              </div>
            )
          )}
        </div>
      )}

      {/* Custom Section Form Modal */}
      {isCustomModalOpen && (
        <CustomSectionModal
          isOpen={isCustomModalOpen}
          onClose={() => {
            setIsCustomModalOpen(false);
            setEditingCustomSection(null);
          }}
          initialData={editingCustomSection}
          categories={categories}
          brands={brands}
          onSave={async (formData) => {
            if (editingCustomSection) {
              await handleSaveSection(
                editingCustomSection._id || editingCustomSection.id,
                formData
              );
            } else {
              try {
                await storefrontService.createSection(formData);
                toast.success("Custom showcase created successfully");
                await loadSections();
              } catch (err) {
                toast.error(
                  err?.response?.data?.message || "Failed to create showcase"
                );
              }
            }
            setIsCustomModalOpen(false);
            setEditingCustomSection(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Section Editor Panel for Title, Subtitle, Modes, Pinned/Excluded, Automatic Rules, Multi-Groups, Colors, and Limits
 */
function SectionEditorPanel({
  section,
  categories = [],
  brands = [],
  onSave,
  isSaving,
  allowModeChange = false,
  isBestSeller = false,
  modeDescription,
  compact = false,
  searchQuery,
  setSearchQuery,
  searchResults,
  isSearching,
}) {
  // Simple Mode is the default for creating and editing storefront sections
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);

  const [title, setTitle] = useState(section.title || "");
  const [subtitle, setSubtitle] = useState(section.subtitle || "");
  const [limit, setLimit] = useState(section.limit || 12);
  const [listingLimit, setListingLimit] = useState(section.listingLimit || 16);
  const [viewMoreEnabled, setViewMoreEnabled] = useState(
    section.viewMoreEnabled !== false
  );
  const [viewMoreTitle, setViewMoreTitle] = useState(
    section.viewMoreTitle || "View All"
  );
  const [viewMoreUrl, setViewMoreUrl] = useState(section.viewMoreUrl || "");
  const [selectionMode, setSelectionMode] = useState(
    section.selectionMode || "manual"
  );
  const [rankingMetric, setRankingMetric] = useState(
    section.rankingMetric || "units_sold"
  );
  const [lookbackDays, setLookbackDays] = useState(
    section.lookbackDays || 30
  );
  const [selectedProducts, setSelectedProducts] = useState(
    section.productIds || []
  );
  const [pinnedProducts, setPinnedProducts] = useState(
    section.pinnedProductIds || []
  );
  const [excludedProducts, setExcludedProducts] = useState(
    section.excludedProductIds || []
  );
  const [automaticRules, setAutomaticRules] = useState(
    section.automaticRules || {
      categoryIds: [],
      brandIds: [],
      minPrice: "",
      maxPrice: "",
      inStockOnly: false,
      hasDiscountOnly: false,
      minDiscountPercent: "",
      sortBy: "newest",
      maxPerBrand: "",
      maxPerCategory: "",
    }
  );
  const [groups, setGroups] = useState(section.groups || []);
  const [theme, setTheme] = useState(section.theme || {});

  // Determine initial simple selection method based on existing section configuration
  const determineInitialMethod = useCallback((sec) => {
    if (sec.selectionMode === "manual" || (sec.productIds && sec.productIds.length > 0)) {
      return "products";
    }
    if (
      sec.type === "category_showcase" ||
      (sec.automaticRules?.categoryIds && sec.automaticRules.categoryIds.length > 0) ||
      (sec.categoryIds && sec.categoryIds.length > 0)
    ) {
      return "category";
    }
    if (
      sec.type === "brand_showcase" ||
      (sec.automaticRules?.brandIds && sec.automaticRules.brandIds.length > 0)
    ) {
      return "brand";
    }
    if (
      sec.selectionMode === "automatic" ||
      sec.type === "new_arrivals" ||
      sec.type === "best_sellers"
    ) {
      return "preset";
    }
    return "products";
  }, []);

  const [selectionMethod, setSelectionMethod] = useState(() =>
    determineInitialMethod(section)
  );

  const [selectedCategoryId, setSelectedCategoryId] = useState(
    section.automaticRules?.categoryIds?.[0] || section.categoryIds?.[0] || ""
  );
  const [selectedBrandId, setSelectedBrandId] = useState(
    section.automaticRules?.brandIds?.[0] || ""
  );

  const [activePreset, setActivePreset] = useState(() => {
    if (section.type === "new_arrivals" || section.automaticRules?.sortBy === "newest") return "new_arrivals";
    if (section.type === "best_sellers" || section.rankingMetric === "units_sold" || section.automaticRules?.sortBy === "sales") return "best_sellers";
    if (section.automaticRules?.sortBy === "rating_desc") return "top_rated";
    if (section.automaticRules?.hasDiscountOnly || section.automaticRules?.sortBy === "discount_desc") return "deals_promotions";
    return "new_arrivals";
  });

  const [categoryProductCount, setCategoryProductCount] = useState(null);
  const [brandProductCount, setBrandProductCount] = useState(null);
  const [isLoadingCategoryCount, setIsLoadingCategoryCount] = useState(false);
  const [isLoadingBrandCount, setIsLoadingBrandCount] = useState(false);

  // Product picker target: "manual" | "pinned" | "excluded"
  const [pickerTarget, setPickerTarget] = useState("manual");
  const [selectedSearchIds, setSelectedSearchIds] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Authoritative list of products corresponding to current picker target
  const currentList = useMemo(() => {
    if (pickerTarget === "pinned") return pinnedProducts || [];
    if (pickerTarget === "excluded") return excludedProducts || [];
    return selectedProducts || [];
  }, [pickerTarget, pinnedProducts, excludedProducts, selectedProducts]);

  useEffect(() => {
    setTitle(section.title || "");
    setSubtitle(section.subtitle || "");
    setLimit(section.limit || 12);
    setListingLimit(section.listingLimit || 16);
    setViewMoreEnabled(section.viewMoreEnabled !== false);
    setViewMoreTitle(section.viewMoreTitle || "View All");
    setViewMoreUrl(section.viewMoreUrl || "");
    const mode = section.selectionMode || "manual";
    setSelectionMode(mode);
    setRankingMetric(section.rankingMetric || "units_sold");
    setLookbackDays(section.lookbackDays || 30);
    setSelectedProducts(section.productIds || []);
    setPinnedProducts(section.pinnedProductIds || []);
    setExcludedProducts(section.excludedProductIds || []);
    setAutomaticRules(
      section.automaticRules || {
        categoryIds: [],
        brandIds: [],
        minPrice: "",
        maxPrice: "",
        inStockOnly: false,
        hasDiscountOnly: false,
        minDiscountPercent: "",
        sortBy: "newest",
        maxPerBrand: "",
        maxPerCategory: "",
      }
    );
    setGroups(section.groups || []);
    setTheme(section.theme || {});
    setSelectedSearchIds([]);

    const method = determineInitialMethod(section);
    setSelectionMethod(method);

    const initialCat =
      section.automaticRules?.categoryIds?.[0] || section.categoryIds?.[0] || "";
    setSelectedCategoryId(initialCat);

    const initialBrand =
      section.automaticRules?.brandIds?.[0] || "";
    setSelectedBrandId(initialBrand);

    if (mode === "hybrid") {
      setPickerTarget("pinned");
    } else if (mode === "automatic") {
      setPickerTarget("excluded");
    } else {
      setPickerTarget("manual");
    }
  }, [section, determineInitialMethod]);

  // Live product counts for Category choice
  useEffect(() => {
    if (selectionMethod === "category" && selectedCategoryId) {
      let active = true;
      setIsLoadingCategoryCount(true);
      productService
        .getProducts({ categoryId: selectedCategoryId, limit: 1 })
        .then((res) => {
          if (active) {
            const count =
              res?.meta?.total ?? res?.data?.meta?.total ?? res?.data?.total ?? res?.data?.products?.length ?? null;
            setCategoryProductCount(count);
          }
        })
        .catch(() => {
          if (active) setCategoryProductCount(null);
        })
        .finally(() => {
          if (active) setIsLoadingCategoryCount(false);
        });
      return () => {
        active = false;
      };
    } else {
      setCategoryProductCount(null);
      setIsLoadingCategoryCount(false);
    }
  }, [selectionMethod, selectedCategoryId]);

  // Live product counts for Brand choice
  useEffect(() => {
    if (selectionMethod === "brand" && selectedBrandId) {
      let active = true;
      setIsLoadingBrandCount(true);
      productService
        .getProducts({ brandId: selectedBrandId, limit: 1 })
        .then((res) => {
          if (active) {
            const count =
              res?.meta?.total ?? res?.data?.meta?.total ?? res?.data?.total ?? res?.data?.products?.length ?? null;
            setBrandProductCount(count);
          }
        })
        .catch(() => {
          if (active) setBrandProductCount(null);
        })
        .finally(() => {
          if (active) setIsLoadingBrandCount(false);
        });
      return () => {
        active = false;
      };
    } else {
      setBrandProductCount(null);
      setIsLoadingBrandCount(false);
    }
  }, [selectionMethod, selectedBrandId]);

  // Switch selection method without silently wiping previously saved products or advanced settings
  const handleSelectMethod = (method) => {
    setSelectionMethod(method);
    if (method === "products") {
      setSelectionMode("manual");
      setPickerTarget("manual");
    } else if (method === "category") {
      setSelectionMode("automatic");
      const catId = selectedCategoryId || categories[0]?._id || categories[0]?.id || "";
      if (catId && !selectedCategoryId) {
        setSelectedCategoryId(catId);
        setAutomaticRules((prev) => ({
          ...prev,
          categoryIds: [catId],
        }));
      }
    } else if (method === "brand") {
      setSelectionMode("automatic");
      const bId = selectedBrandId || brands[0]?._id || brands[0]?.id || "";
      if (bId && !selectedBrandId) {
        setSelectedBrandId(bId);
        setAutomaticRules((prev) => ({
          ...prev,
          brandIds: [bId],
        }));
      }
    } else if (method === "preset") {
      setSelectionMode("automatic");
      handlePresetChange(activePreset || "new_arrivals");
    }
  };

  const handleCategoryChange = (catId) => {
    setSelectedCategoryId(catId);
    setAutomaticRules((prev) => ({
      ...prev,
      categoryIds: catId ? [catId] : [],
    }));
  };

  const handleBrandChange = (bId) => {
    setSelectedBrandId(bId);
    setAutomaticRules((prev) => ({
      ...prev,
      brandIds: bId ? [bId] : [],
    }));
  };

  const handlePresetChange = (presetKey) => {
    setActivePreset(presetKey);
    setAutomaticRules((prev) => {
      const updated = { ...prev };
      if (presetKey === "new_arrivals") {
        updated.sortBy = "newest";
        updated.hasDiscountOnly = false;
      } else if (presetKey === "best_sellers") {
        updated.sortBy = "sales";
        updated.hasDiscountOnly = false;
        setRankingMetric("units_sold");
        setLookbackDays(30);
      } else if (presetKey === "top_rated") {
        updated.sortBy = "rating_desc";
        updated.hasDiscountOnly = false;
      } else if (presetKey === "deals_promotions") {
        updated.hasDiscountOnly = true;
        updated.sortBy = "discount_desc";
      }
      return updated;
    });
  };

  // Reset checked search items when search query changes
  useEffect(() => {
    setSelectedSearchIds([]);
  }, [searchQuery]);

  // Product addition to targeted list
  const handleAddProduct = (prod) => {
    const id = prod._id || prod.id;
    if (pickerTarget === "pinned") {
      if (pinnedProducts.some((p) => (p._id || p.id || p) === id)) {
        toast.info("Product is already pinned");
        return;
      }
      setPinnedProducts((prev) => [...prev, prod]);
      // Remove from excluded if present
      setExcludedProducts((prev) =>
        prev.filter((p) => (p._id || p.id || p) !== id)
      );
      toast.success(`Pinned "${prod.name}"`);
    } else if (pickerTarget === "excluded") {
      if (excludedProducts.some((p) => (p._id || p.id || p) === id)) {
        toast.info("Product is already in exclusions");
        return;
      }
      setExcludedProducts((prev) => [...prev, prod]);
      // Remove from pinned and manual if present
      setPinnedProducts((prev) =>
        prev.filter((p) => (p._id || p.id || p) !== id)
      );
      setSelectedProducts((prev) =>
        prev.filter((p) => (p._id || p.id || p) !== id)
      );
      toast.success(`Excluded "${prod.name}"`);
    } else {
      if (selectedProducts.some((p) => (p._id || p.id || p) === id)) {
        toast.info("Product is already added");
        return;
      }
      setSelectedProducts((prev) => [...prev, prod]);
      toast.success(`Added "${prod.name}"`);
    }
  };

  // Batch addition of selected search items
  const handleBatchAdd = () => {
    if (!selectedSearchIds.length) return;
    const toAdd = searchResults.filter((p) =>
      selectedSearchIds.includes(p._id || p.id)
    );

    if (pickerTarget === "pinned") {
      const newItems = toAdd.filter(
        (p) => !pinnedProducts.some((x) => (x._id || x.id || x) === (p._id || p.id))
      );
      setPinnedProducts((prev) => [...prev, ...newItems]);
      const addedIds = new Set(newItems.map((p) => p._id || p.id));
      setExcludedProducts((prev) =>
        prev.filter((p) => !addedIds.has(p._id || p.id || p))
      );
      toast.success(`Pinned ${newItems.length} products`);
    } else if (pickerTarget === "excluded") {
      const newItems = toAdd.filter(
        (p) => !excludedProducts.some((x) => (x._id || x.id || x) === (p._id || p.id))
      );
      setExcludedProducts((prev) => [...prev, ...newItems]);
      const addedIds = new Set(newItems.map((p) => p._id || p.id));
      setPinnedProducts((prev) =>
        prev.filter((p) => !addedIds.has(p._id || p.id || p))
      );
      setSelectedProducts((prev) =>
        prev.filter((p) => !addedIds.has(p._id || p.id || p))
      );
      toast.success(`Excluded ${newItems.length} products`);
    } else {
      const newItems = toAdd.filter(
        (p) => !selectedProducts.some((x) => (x._id || x.id || x) === (p._id || p.id))
      );
      setSelectedProducts((prev) => [...prev, ...newItems]);
      toast.success(`Added ${newItems.length} products to selection`);
    }
    setSelectedSearchIds([]);
  };

  // Clear current list action with confirmation
  const handleClearCurrentList = () => {
    const listLabel =
      pickerTarget === "pinned"
        ? "pinned products"
        : pickerTarget === "excluded"
        ? "excluded products"
        : "selected products";

    if (
      window.confirm(
        `Are you sure you want to clear all ${listLabel}? This action can be cancelled before saving.`
      )
    ) {
      if (pickerTarget === "pinned") setPinnedProducts([]);
      else if (pickerTarget === "excluded") setExcludedProducts([]);
      else setSelectedProducts([]);
      toast.success(`Cleared all ${listLabel}`);
    }
  };

  const handleRemoveProduct = (index, target) => {
    if (target === "pinned") {
      setPinnedProducts((prev) => prev.filter((_, idx) => idx !== index));
    } else if (target === "excluded") {
      setExcludedProducts((prev) => prev.filter((_, idx) => idx !== index));
    } else {
      setSelectedProducts((prev) => prev.filter((_, idx) => idx !== index));
    }
  };

  const handleMoveProduct = (index, direction, target) => {
    const list = target === "pinned" ? [...pinnedProducts] : [...selectedProducts];
    const newIdx = direction === "up" ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= list.length) return;
    const [moved] = list.splice(index, 1);
    list.splice(newIdx, 0, moved);
    if (target === "pinned") setPinnedProducts(list);
    else setSelectedProducts(list);
  };

  // HTML5 Drag and drop reordering
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    if (pickerTarget === "pinned") {
      const updated = [...pinnedProducts];
      const [moved] = updated.splice(draggedIndex, 1);
      updated.splice(targetIndex, 0, moved);
      setPinnedProducts(updated);
    } else if (pickerTarget === "manual") {
      const updated = [...selectedProducts];
      const [moved] = updated.splice(draggedIndex, 1);
      updated.splice(targetIndex, 0, moved);
      setSelectedProducts(updated);
    }
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Group helpers
  const handleAddGroup = () => {
    const isBrandShowcase = section.type === "brand_showcase";
    const newGroup = {
      id: `grp_${Date.now()}`,
      title: isBrandShowcase ? "New Brand Group" : "New Category Group",
      subtitle: "",
      type: isBrandShowcase ? "brand" : "category",
      categoryId: categories[0]?._id || null,
      brandId: brands[0]?._id || null,
      limit: 8,
      sortBy: "newest",
      isActive: true,
    };
    setGroups((prev) => [...prev, newGroup]);
  };

  const handleUpdateGroup = (idx, field, value) => {
    setGroups((prev) =>
      prev.map((g, i) => (i === idx ? { ...g, [field]: value } : g))
    );
  };

  const handleRemoveGroup = (idx) => {
    setGroups((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleThemeColorChange = (key, val) => {
    setTheme((prev) => ({
      ...prev,
      [key]: val ? val : null,
    }));
  };

  const handleApplyPreset = (presetTheme) => {
    setTheme(presetTheme);
  };

  // Contrast Ratio Checker
  const contrastRatio = useMemo(() => {
    const bg = theme?.backgroundColor || "#FFFFFF";
    const heading = theme?.headingColor || "#0F172A";
    return calculateContrastRatio(bg, heading);
  }, [theme]);

  const isLowContrast = contrastRatio < 3.0;

  const handleSave = () => {
    const payload = {
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      limit: Number(limit),
      listingLimit: Number(listingLimit),
      viewMoreEnabled: Boolean(viewMoreEnabled),
      viewMoreTitle: viewMoreTitle.trim() || "View All",
      viewMoreUrl: viewMoreUrl.trim() || null,
      theme,
    };

    if (allowModeChange) {
      payload.selectionMode = selectionMode;
      if (isBestSeller || activePreset === "best_sellers") {
        payload.rankingMetric = rankingMetric;
        payload.lookbackDays = Number(lookbackDays);
      }
    }

    if (selectionMode === "manual") {
      payload.productIds = selectedProducts.map((p) => p._id || p.id || p);
      if (excludedProducts.length > 0) {
        payload.excludedProductIds = excludedProducts.map(
          (p) => p._id || p.id || p
        );
      }
    } else if (selectionMode === "hybrid") {
      payload.pinnedProductIds = pinnedProducts.map((p) => p._id || p.id || p);
      payload.excludedProductIds = excludedProducts.map(
        (p) => p._id || p.id || p
      );
      payload.automaticRules = {
        ...automaticRules,
        minPrice:
          automaticRules.minPrice !== "" && automaticRules.minPrice != null
            ? Number(automaticRules.minPrice)
            : null,
        maxPrice:
          automaticRules.maxPrice !== "" && automaticRules.maxPrice != null
            ? Number(automaticRules.maxPrice)
            : null,
        maxPerBrand:
          automaticRules.maxPerBrand !== "" && automaticRules.maxPerBrand != null
            ? Number(automaticRules.maxPerBrand)
            : null,
      };
    } else if (selectionMode === "automatic") {
      if (excludedProducts.length > 0) {
        payload.excludedProductIds = excludedProducts.map(
          (p) => p._id || p.id || p
        );
      }

      let activeRules = { ...automaticRules };
      if (selectionMethod === "category" && selectedCategoryId) {
        activeRules.categoryIds = [selectedCategoryId];
        if (section.type === "category_showcase") {
          payload.categoryIds = [selectedCategoryId];
        }
      } else if (selectionMethod === "brand" && selectedBrandId) {
        activeRules.brandIds = [selectedBrandId];
      }

      payload.automaticRules = {
        ...activeRules,
        minPrice:
          automaticRules.minPrice !== "" && automaticRules.minPrice != null
            ? Number(automaticRules.minPrice)
            : null,
        maxPrice:
          automaticRules.maxPrice !== "" && automaticRules.maxPrice != null
            ? Number(automaticRules.maxPrice)
            : null,
        maxPerBrand:
          automaticRules.maxPerBrand !== "" && automaticRules.maxPerBrand != null
            ? Number(automaticRules.maxPerBrand)
            : null,
      };
    }

    if (
      groups.length > 0 ||
      ["category_showcase", "brand_showcase"].includes(section.type)
    ) {
      payload.groups = groups.map((g) => ({
        id: g.id || g._id,
        title: g.title,
        subtitle: g.subtitle || null,
        type: g.type,
        categoryId: g.categoryId || null,
        brandId: g.brandId || null,
        limit: Number(g.limit || 8),
        sortBy: g.sortBy || "newest",
        isActive: g.isActive !== false,
      }));
    }

    onSave(section._id || section.id, payload);
  };

  const isMultiGroupShowcase =
    ["category_showcase", "brand_showcase"].includes(section.type) ||
    groups.length > 0;

  const PRESET_OPTIONS = [
    {
      id: "new_arrivals",
      label: "New Arrivals",
      description: "Newest active products sorted by publication date",
      icon: Sparkles,
      tag: "Dynamic Newest",
    },
    {
      id: "best_sellers",
      label: "Best Sellers",
      description:
        "Top-selling products based on completed paid orders (30-day window)",
      icon: Flame,
      tag: "Sales Volume",
    },
    {
      id: "top_rated",
      label: "Top Rated",
      description:
        "Products with the highest average customer ratings and reviews",
      icon: Star,
      tag: "Ratings",
    },
    {
      id: "deals_promotions",
      label: "Deals & Discounts",
      description:
        "Products with active promotional discounts and compare-at prices",
      icon: Tag,
      tag: "Promotions",
    },
  ];

  const selectedCatName = useMemo(() => {
    const catId = automaticRules?.categoryIds?.[0];
    if (!catId) return "";
    const found = categories.find((c) => (c._id || c.id) === catId);
    return found ? found.name : "";
  }, [automaticRules?.categoryIds, categories]);

  const selectedBrandName = useMemo(() => {
    const bId = automaticRules?.brandIds?.[0];
    if (!bId) return "";
    const found = brands.find((b) => (b._id || b.id) === bId);
    return found ? found.name : "";
  }, [automaticRules?.brandIds, brands]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-7 space-y-6">
      {/* Mode Switcher Banner: Simple Mode (Default) vs Advanced Settings */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-slate-50 via-emerald-50/20 to-slate-50 border border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-[#007A55] text-white flex items-center justify-center font-bold text-xs shadow-xs">
            {isAdvancedMode ? <Sliders className="size-4" /> : <Sparkles className="size-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">
                {isAdvancedMode ? "Advanced Configuration Mode" : "Simple Mode (Recommended)"}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-emerald-100 text-emerald-800">
                {isAdvancedMode ? "Advanced" : "Default"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {isAdvancedMode
                ? "Full control over hybrid pinning, catalog exclusion filters, brand diversity caps, and custom queries."
                : "Create and publish storefront showcases quickly with 4 straightforward selection methods."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => setIsAdvancedMode(false)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
              !isAdvancedMode
                ? "bg-[#007A55] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Sparkles className="size-3.5" />
            <span>Simple Mode</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAdvancedMode(true)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
              isAdvancedMode
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Sliders className="size-3.5" />
            <span>Advanced Settings</span>
          </button>
        </div>
      </div>

      {/* Title & Subtitle */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
            Section Display Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-[#007A55] focus:outline-hidden"
            placeholder="e.g. Featured Products"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
            Section Subtitle
          </label>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-[#007A55] focus:outline-hidden"
            placeholder="e.g. Handpicked for you, only the best."
          />
        </div>
      </div>

      {/* Product Selection Method: 4 Clear Choices */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
            Product Selection Method
          </label>
          <p className="text-[11px] text-slate-500">
            Select how products will be populated in this storefront section.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card A: Choose Products */}
          <button
            type="button"
            onClick={() => handleSelectMethod("products")}
            className={cn(
              "p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between relative",
              selectionMethod === "products"
                ? "border-[#007A55] bg-emerald-50/40 ring-2 ring-[#007A55]/20 shadow-xs"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
            )}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div
                  className={cn(
                    "size-8 rounded-xl flex items-center justify-center font-bold text-xs",
                    selectionMethod === "products"
                      ? "bg-[#007A55] text-white"
                      : "bg-slate-100 text-slate-600"
                  )}
                >
                  <ShoppingBag className="size-4" />
                </div>
                {selectionMethod === "products" && (
                  <span className="size-2 rounded-full bg-[#007A55]" />
                )}
              </div>
              <h4 className="text-xs font-bold text-slate-900">Choose Products</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                Handpick products from catalog with drag-and-drop ordering.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[10px] font-semibold text-slate-600">
              <span>Explicit Selection</span>
              <span className="font-bold text-emerald-700">{selectedProducts.length} Selected</span>
            </div>
          </button>

          {/* Card B: Choose a Category */}
          <button
            type="button"
            onClick={() => handleSelectMethod("category")}
            className={cn(
              "p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between relative",
              selectionMethod === "category"
                ? "border-[#007A55] bg-emerald-50/40 ring-2 ring-[#007A55]/20 shadow-xs"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
            )}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div
                  className={cn(
                    "size-8 rounded-xl flex items-center justify-center font-bold text-xs",
                    selectionMethod === "category"
                      ? "bg-[#007A55] text-white"
                      : "bg-slate-100 text-slate-600"
                  )}
                >
                  <Layers className="size-4" />
                </div>
                {selectionMethod === "category" && (
                  <span className="size-2 rounded-full bg-[#007A55]" />
                )}
              </div>
              <h4 className="text-xs font-bold text-slate-900">Choose a Category</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                Automatically show eligible products from a specific category.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[10px] font-semibold text-slate-600">
              <span>Category Source</span>
              <span className="font-bold text-emerald-700">
                {isLoadingCategoryCount
                  ? "Loading..."
                  : categoryProductCount !== null
                  ? `${categoryProductCount} Available`
                  : "Auto-resolved"}
              </span>
            </div>
          </button>

          {/* Card C: Choose a Brand */}
          <button
            type="button"
            onClick={() => handleSelectMethod("brand")}
            className={cn(
              "p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between relative",
              selectionMethod === "brand"
                ? "border-[#007A55] bg-emerald-50/40 ring-2 ring-[#007A55]/20 shadow-xs"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
            )}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div
                  className={cn(
                    "size-8 rounded-xl flex items-center justify-center font-bold text-xs",
                    selectionMethod === "brand"
                      ? "bg-[#007A55] text-white"
                      : "bg-slate-100 text-slate-600"
                  )}
                >
                  <Sparkles className="size-4" />
                </div>
                {selectionMethod === "brand" && (
                  <span className="size-2 rounded-full bg-[#007A55]" />
                )}
              </div>
              <h4 className="text-xs font-bold text-slate-900">Choose a Brand</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                Showcase top products from a specific brand or manufacturer.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[10px] font-semibold text-slate-600">
              <span>Brand Source</span>
              <span className="font-bold text-emerald-700">
                {isLoadingBrandCount
                  ? "Loading..."
                  : brandProductCount !== null
                  ? `${brandProductCount} Available`
                  : "Auto-resolved"}
              </span>
            </div>
          </button>

          {/* Card D: Automatic Preset */}
          <button
            type="button"
            onClick={() => handleSelectMethod("preset")}
            className={cn(
              "p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between relative",
              selectionMethod === "preset"
                ? "border-[#007A55] bg-emerald-50/40 ring-2 ring-[#007A55]/20 shadow-xs"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
            )}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div
                  className={cn(
                    "size-8 rounded-xl flex items-center justify-center font-bold text-xs",
                    selectionMethod === "preset"
                      ? "bg-[#007A55] text-white"
                      : "bg-slate-100 text-slate-600"
                  )}
                >
                  <Flame className="size-4" />
                </div>
                {selectionMethod === "preset" && (
                  <span className="size-2 rounded-full bg-[#007A55]" />
                )}
              </div>
              <h4 className="text-xs font-bold text-slate-900">Automatic Preset</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                Dynamic algorithms like New Arrivals, Best Sellers & Deals.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[10px] font-semibold text-slate-600">
              <span>Catalog Preset</span>
              <span className="font-bold text-emerald-700">Algorithmic</span>
            </div>
          </button>
        </div>
      </div>

      {/* Category Selection Configuration */}
      {selectionMethod === "category" && (
        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Target Category
              </label>
              <p className="text-[11px] text-slate-500">
                Products belonging to this category will automatically populate this section.
              </p>
            </div>
            {selectedCatName && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                {isLoadingCategoryCount
                  ? "Resolving count..."
                  : categoryProductCount !== null
                  ? `${categoryProductCount} Eligible Products in "${selectedCatName}"`
                  : `Selected: ${selectedCatName}`}
              </span>
            )}
          </div>

          <select
            value={automaticRules.categoryIds?.[0] || ""}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-[#007A55] focus:outline-hidden cursor-pointer"
          >
            <option value="">-- Select a Category --</option>
            {categories.map((c) => (
              <option key={c._id || c.id} value={c._id || c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Brand Selection Configuration */}
      {selectionMethod === "brand" && (
        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Target Brand
              </label>
              <p className="text-[11px] text-slate-500">
                Products manufactured by this brand will automatically populate this section.
              </p>
            </div>
            {selectedBrandName && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                {isLoadingBrandCount
                  ? "Resolving count..."
                  : brandProductCount !== null
                  ? `${brandProductCount} Eligible Products from "${selectedBrandName}"`
                  : `Selected: ${selectedBrandName}`}
              </span>
            )}
          </div>

          <select
            value={automaticRules.brandIds?.[0] || ""}
            onChange={(e) => handleBrandChange(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-[#007A55] focus:outline-hidden cursor-pointer"
          >
            <option value="">-- Select a Brand --</option>
            {brands.map((b) => (
              <option key={b._id || b.id} value={b._id || b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Preset Selection Configuration */}
      {selectionMethod === "preset" && (
        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
              Automatic Preset Selection
            </label>
            <p className="text-[11px] text-slate-500">
              Choose an automated algorithmic preset powered by the storefront ranking engine.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {PRESET_OPTIONS.map((preset) => {
              const IconComp = preset.icon;
              const isSelected =
                (preset.id === "new_arrivals" && (section.key === "new_arrivals" || automaticRules.sortBy === "newest")) ||
                (preset.id === "best_sellers" && (section.key === "best_sellers" || automaticRules.sortBy === "bestselling")) ||
                (preset.id === "top_rated" && automaticRules.sortBy === "rating_desc") ||
                (preset.id === "deals_promotions" && (section.key === "deals" || automaticRules.hasDiscountOnly));

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetChange(preset.id)}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                    isSelected
                      ? "border-[#007A55] bg-emerald-50 text-emerald-950 ring-1 ring-[#007A55]"
                      : "border-slate-200 bg-white hover:bg-slate-50 text-slate-800"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <IconComp className={cn("size-4 shrink-0", isSelected ? "text-[#007A55]" : "text-slate-500")} />
                    <span className="text-xs font-bold">{preset.label}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    {preset.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Sales Lookback Period for Best Sellers */}
          {(isBestSeller || automaticRules.sortBy === "bestselling") && (
            <div className="pt-2 border-t border-slate-200/60">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Sales Lookback Period
              </label>
              <select
                value={lookbackDays}
                onChange={(e) => setLookbackDays(Number(e.target.value))}
                className="mt-1.5 w-full sm:w-1/2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-[#007A55] focus:outline-hidden cursor-pointer"
              >
                <option value={7}>Last 7 Days</option>
                <option value={14}>Last 14 Days</option>
                <option value={30}>Last 30 Days (Standard)</option>
                <option value={60}>Last 60 Days</option>
                <option value={90}>Last 90 Days</option>
                <option value={180}>Last 180 Days</option>
                <option value={365}>Last 1 Year</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* 1. Live Selected Product Counter & Summary */}
      {!compact && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                <ShoppingBag className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {selectionMode === "manual"
                    ? `Selected Products (${selectedProducts.length})`
                    : selectionMode === "hybrid"
                    ? `Hybrid Merchandising (${pinnedProducts.length} Pinned + Auto-fill)`
                    : `Automatic Selection (${limit} Products)`}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {selectionMode === "manual"
                    ? "Manually selected products in exact showcase display order"
                    : selectionMode === "hybrid"
                    ? "Pinned hero products appear first, remaining slots filled automatically"
                    : "Automatically resolved from catalog based on sorting & filter rules"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-white border border-slate-200 text-slate-700 shadow-2xs">
                Mode: {selectionMode}
              </span>
            </div>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                {selectionMode === "hybrid" ? "Pinned Products" : "Selected Products"}
              </span>
              <span className="text-base font-black text-slate-900">
                {selectionMode === "hybrid"
                  ? `${pinnedProducts.length} products`
                  : selectionMode === "manual"
                  ? `${selectedProducts.length} products`
                  : `${limit} products (Limit)`}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {selectionMode === "manual"
                  ? `${selectedProducts.length} products chosen`
                  : selectionMode === "hybrid"
                  ? `${pinnedProducts.length} pinned guaranteed top`
                  : "Resolved by catalog rules"}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Display Limit
              </span>
              <span className="text-base font-black text-emerald-700">
                {limit} products
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Configured display capacity
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Remaining Slots
              </span>
              <span className="text-base font-black text-blue-700">
                {selectionMode === "manual"
                  ? Math.max(0, limit - selectedProducts.length)
                  : selectionMode === "hybrid"
                  ? Math.max(0, limit - pinnedProducts.length)
                  : 0}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {selectionMode === "manual"
                  ? selectedProducts.length >= limit
                    ? "Display slots full"
                    : `${Math.max(0, limit - selectedProducts.length)} slots open`
                  : selectionMode === "hybrid"
                  ? `${Math.max(0, limit - pinnedProducts.length)} slots auto-filled`
                  : "Filled by rules"}
              </span>
            </div>
          </div>

          {/* Over-Limit Warning Banner */}
          {((selectionMode === "manual" && selectedProducts.length > limit) ||
            (selectionMode === "hybrid" && pinnedProducts.length > limit)) && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
              <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Display Limit Warning: </span>
                <span>
                  You have {selectionMode === "hybrid" ? pinnedProducts.length : selectedProducts.length} products selected, which exceeds the current display limit of {limit}. Only the first {limit} items will appear on the storefront. All selections are preserved and will be accessible via the View More discovery page.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Product Search & Assignment Controls (for Choose Products or Advanced Hybrid/Excluded) */}
      {!compact && (selectionMethod === "products" || selectionMode === "manual" || isAdvancedMode || selectionMode === "hybrid") && (
        <div className="space-y-4 pt-3 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Product Selection & Assignment
              </label>
              <p className="text-[11px] text-slate-500">
                Search the active catalog and add products individually or in batch.
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {(selectionMode === "manual" || selectionMethod === "products") && (
                <button
                  type="button"
                  onClick={() => setPickerTarget("manual")}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    pickerTarget === "manual"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Selected Products ({selectedProducts.length})
                </button>
              )}
              {selectionMode === "hybrid" && (
                <button
                  type="button"
                  onClick={() => setPickerTarget("pinned")}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                    pickerTarget === "pinned"
                      ? "bg-white text-emerald-800 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <Pin className="size-3" />
                  <span>Pinned Products ({pinnedProducts.length})</span>
                </button>
              )}
              {(selectionMode === "hybrid" || selectionMode === "automatic" || isAdvancedMode) && (
                <button
                  type="button"
                  onClick={() => setPickerTarget("excluded")}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                    pickerTarget === "excluded"
                      ? "bg-white text-rose-800 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <Ban className="size-3" />
                  <span>Excluded Products ({excludedProducts.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Search Box & Add Products Action */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="size-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search active products to add to ${
                    pickerTarget === "pinned"
                      ? "Pinned Products"
                      : pickerTarget === "excluded"
                      ? "Exclusions"
                      : "Selected Products"
                  }...`}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-4 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-[#007A55] focus:outline-hidden"
                />
                {isSearching && (
                  <div className="absolute right-3 top-2.5 text-[10px] text-slate-400">
                    Searching catalog...
                  </div>
                )}
              </div>

              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  Clear Search
                </button>
              )}
            </div>

            {/* Dropdown / Drawer of Search Results with Batch Selection */}
            {searchResults.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden animate-in fade-in">
                {/* Batch Actions Bar */}
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const eligible = searchResults
                          .filter(
                            (p) =>
                              !currentList.some(
                                (x) => (x._id || x.id || x) === (p._id || p.id)
                              )
                          )
                          .map((p) => p._id || p.id);
                        setSelectedSearchIds(
                          selectedSearchIds.length === eligible.length ? [] : eligible
                        );
                      }}
                      className="text-xs font-bold text-slate-700 hover:text-emerald-700 cursor-pointer"
                    >
                      {selectedSearchIds.length > 0
                        ? `Deselect All (${selectedSearchIds.length})`
                        : "Select All Eligible"}
                    </button>
                  </div>

                  {selectedSearchIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleBatchAdd}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow-xs hover:bg-emerald-500 cursor-pointer"
                    >
                      <Plus className="size-3.5" />
                      <span>Add Selected ({selectedSearchIds.length})</span>
                    </button>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {searchResults.map((prod) => {
                    const pId = prod._id || prod.id;
                    const isAlreadyInCurrent = currentList.some(
                      (x) => (x._id || x.id || x) === pId
                    );
                    const isChecked = selectedSearchIds.includes(pId);

                    return (
                      <div
                        key={pId}
                        className={cn(
                          "p-2.5 flex items-center justify-between transition-colors",
                          isAlreadyInCurrent
                            ? "bg-slate-50/60 opacity-60"
                            : isChecked
                            ? "bg-emerald-50/40"
                            : "hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {!isAlreadyInCurrent ? (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSearchIds((prev) => [...prev, pId]);
                                } else {
                                  setSelectedSearchIds((prev) =>
                                    prev.filter((id) => id !== pId)
                                  );
                                }
                              }}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                            />
                          ) : (
                            <div className="w-4 shrink-0" />
                          )}

                          {prod.images?.[0]?.url ? (
                            <img
                              src={prod.images[0].url}
                              alt={prod.name}
                              className="size-8 rounded-lg object-contain bg-slate-100 shrink-0"
                            />
                          ) : (
                            <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                              <ShoppingBag className="size-4" />
                            </div>
                          )}

                          <div className="truncate flex-1">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {prod.name}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {prod.sku && <span className="mr-2">SKU: {prod.sku}</span>}
                              Price: {formatCurrency(prod.price)}
                            </p>
                          </div>
                        </div>

                        <div className="ml-2 shrink-0">
                          {isAlreadyInCurrent ? (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              Already Added
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddProduct(prod)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-[#007A55] hover:bg-emerald-100 transition-colors cursor-pointer"
                            >
                              <Plus className="size-3" />
                              <span>Add</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 3. Dedicated Selected Products Panel with Drag & Drop */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <GripVertical className="size-4 text-slate-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  {pickerTarget === "pinned"
                    ? `Pinned Products (${pinnedProducts.length})`
                    : pickerTarget === "excluded"
                    ? `Excluded Products (${excludedProducts.length})`
                    : `Selected Products (${selectedProducts.length})`}
                </h4>
              </div>

              {currentList.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCurrentList}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Clear all items in this list"
                >
                  <Trash2 className="size-3.5" />
                  <span>Clear Selection</span>
                </button>
              )}
            </div>

            {/* List of items */}
            {pickerTarget === "pinned" && (
              <div className="space-y-1.5">
                {pinnedProducts.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">No products pinned yet. Search above to pin items to the top.</p>
                ) : (
                  pinnedProducts.map((prod, idx) => (
                    <ProductRowItem
                      key={prod._id || prod.id || idx}
                      prod={prod}
                      idx={idx}
                      total={pinnedProducts.length}
                      onMove={(dir) => handleMoveProduct(idx, dir, "pinned")}
                      onRemove={() => handleRemoveProduct(idx, "pinned")}
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                    />
                  ))
                )}
              </div>
            )}

            {pickerTarget === "excluded" && (
              <div className="space-y-1.5">
                {excludedProducts.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">No products excluded. Search above to exclude items from this showcase.</p>
                ) : (
                  excludedProducts.map((prod, idx) => (
                    <ProductRowItem
                      key={prod._id || prod.id || idx}
                      prod={prod}
                      idx={idx}
                      total={excludedProducts.length}
                      hideOrder={true}
                      onRemove={() => handleRemoveProduct(idx, "excluded")}
                    />
                  ))
                )}
              </div>
            )}

            {pickerTarget === "manual" && (
              <div className="space-y-1.5">
                {selectedProducts.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">No products selected yet. Search above to add items.</p>
                ) : (
                  selectedProducts.map((prod, idx) => (
                    <ProductRowItem
                      key={prod._id || prod.id || idx}
                      prod={prod}
                      idx={idx}
                      total={selectedProducts.length}
                      onMove={(dir) => handleMoveProduct(idx, dir, "manual")}
                      onRemove={() => handleRemoveProduct(idx, "manual")}
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Display Limit & View More Link Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
            Homepage Product Limit ({limit})
          </label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-[#007A55] focus:outline-hidden cursor-pointer"
          >
            {[4, 5, 6, 8, 10, 12, 16, 20, 24].map((n) => (
              <option key={n} value={n}>
                {n} Products (Homepage)
              </option>
            ))}
          </select>
        </div>

        {/* View More Link Controls */}
        <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                id={`vm-check-${section._id || section.id}`}
                type="checkbox"
                checked={viewMoreEnabled}
                onChange={(e) => setViewMoreEnabled(e.target.checked)}
                className="rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
              />
              <label
                htmlFor={`vm-check-${section._id || section.id}`}
                className="text-xs font-bold text-slate-800 cursor-pointer"
              >
                Enable &quot;View More&quot; Discovery Page Link
              </label>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              /sections/{section.key}
            </span>
          </div>

          {viewMoreEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block uppercase">
                  Button Text
                </label>
                <input
                  type="text"
                  value={viewMoreTitle}
                  onChange={(e) => setViewMoreTitle(e.target.value)}
                  placeholder="View All"
                  className="mt-1 w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block uppercase">
                  Custom Destination URL Override (Optional)
                </label>
                <input
                  type="text"
                  value={viewMoreUrl}
                  onChange={(e) => setViewMoreUrl(e.target.value)}
                  placeholder={`/sections/${section.key}`}
                  className="mt-1 w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-800"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {modeDescription && (
        <div className="p-3 rounded-xl bg-slate-50 text-slate-600 text-xs flex items-center gap-2 border border-slate-200/60">
          <Info className="size-4 text-slate-400 shrink-0" />
          <span>{modeDescription}</span>
        </div>
      )}

      {/* Scoped Theme Customizer with WCAG Contrast Warning */}
      <div className="space-y-3 pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-[#007A55]" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Scoped Section Colors & Visual Styling
            </h3>
          </div>
          <button
            type="button"
            onClick={() => handleApplyPreset(PRESET_THEMES[0].theme)}
            className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
          >
            Reset to Default
          </button>
        </div>

        {/* Preset Badges */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {PRESET_THEMES.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handleApplyPreset(preset.theme)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 shrink-0 transition-colors cursor-pointer"
            >
              {preset.name}
            </button>
          ))}
        </div>

        {/* Live Scoped Preview Box with WCAG Contrast Badge */}
        <div
          style={{
            backgroundColor: theme?.backgroundColor || "#FFFFFF",
            borderColor: theme?.borderColor || "#E2E8F0",
          }}
          className="p-4 rounded-2xl border shadow-2xs space-y-2 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4
                style={{ color: theme?.headingColor || "#0F172A" }}
                className="text-sm font-black"
              >
                {title || "Live Section Header"}
              </h4>
              <span
                style={{
                  backgroundColor: theme?.badgeColor || "#007A55",
                  color: "#FFFFFF",
                }}
                className="px-2 py-0.5 rounded text-[10px] font-bold"
              >
                PREVIEW
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-bold",
                  isLowContrast
                    ? "bg-rose-100 text-rose-800 border border-rose-300"
                    : "bg-emerald-100 text-emerald-800"
                )}
              >
                Contrast: {contrastRatio}:1 {isLowContrast ? "(WCAG Fail)" : "(WCAG Pass)"}
              </span>
            </div>
          </div>
          <p
            style={{ color: theme?.textColor || "#64748B" }}
            className="text-xs"
          >
            {subtitle || "Preview of subtitle text under scoped colors."}
          </p>

          {isLowContrast && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
              <AlertCircle className="size-3.5 text-amber-600 shrink-0" />
              <span>
                Low contrast warning: Background and text contrast ({contrastRatio}:1) is below WCAG 2.1 AA recommendation of 3:1.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Settings Toggle / Collapsible Area */}
      {!isAdvancedMode ? (
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-dashed border-slate-300 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Sliders className="size-4 text-slate-500" />
            <span>Need hybrid pinning, exclusions, custom sort criteria, or multi-tab groups?</span>
          </div>
          <button
            type="button"
            onClick={() => setIsAdvancedMode(true)}
            className="text-xs font-bold text-[#007A55] hover:underline cursor-pointer flex items-center gap-1"
          >
            <span>Open Advanced Settings</span>
            <ChevronDown className="size-3.5" />
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-slate-200 bg-slate-50/40 p-5 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Sliders className="size-4 text-slate-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Advanced Settings & Fine-Grained Controls
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsAdvancedMode(false)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer flex items-center gap-1"
            >
              <span>Collapse Advanced Settings</span>
              <ChevronUp className="size-3.5" />
            </button>
          </div>

          {/* Raw Selection Mode Toggle */}
          {allowModeChange && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Product Selection Mode
              </label>
              <div className="mt-1.5 flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1 max-w-sm">
                {[
                  { id: "automatic", label: "Auto" },
                  { id: "hybrid", label: "Hybrid" },
                  { id: "manual", label: "Manual" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectionMode(m.id);
                      if (m.id === "hybrid" && pickerTarget === "manual") {
                        setPickerTarget("pinned");
                      } else if (m.id === "automatic" && pickerTarget !== "excluded") {
                        setPickerTarget("excluded");
                      } else if (m.id === "manual" && pickerTarget !== "manual") {
                        setPickerTarget("manual");
                      }
                    }}
                    className={cn(
                      "flex-1 rounded-lg py-1 text-xs font-bold transition-all cursor-pointer",
                      selectionMode === m.id
                        ? "bg-[#007A55] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Discovery Page Size */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
              Discovery Page Size ({listingLimit})
            </label>
            <select
              value={listingLimit}
              onChange={(e) => setListingLimit(Number(e.target.value))}
              className="mt-1.5 w-full sm:w-1/2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-[#007A55] focus:outline-hidden cursor-pointer"
            >
              {[12, 16, 20, 24, 32, 48].map((n) => (
                <option key={n} value={n}>
                  {n} Products (View More)
                </option>
              ))}
            </select>
          </div>

          {/* Automatic & Hybrid Rules Subform */}
          {(selectionMode === "automatic" || selectionMode === "hybrid") && !compact && (
            <div className="space-y-4 pt-3 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <Sliders className="size-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Automatic Sorting & Selection Criteria
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block uppercase">
                    Catalog Sorting Rule
                  </label>
                  <select
                    value={automaticRules.sortBy || "newest"}
                    onChange={(e) =>
                      setAutomaticRules((prev) => ({ ...prev, sortBy: e.target.value }))
                    }
                    className="mt-1 w-full text-xs rounded-xl border border-slate-200 bg-white p-2 font-semibold"
                  >
                    <option value="newest">Newest Published First</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="rating_desc">Highest Customer Rating</option>
                    <option value="discount_desc">Deepest Discount Percentage</option>
                    <option value="bestselling">Most Units Sold (Sales Aggregate)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block uppercase">
                    Max Products Per Brand
                  </label>
                  <select
                    value={automaticRules.maxPerBrand || ""}
                    onChange={(e) =>
                      setAutomaticRules((prev) => ({
                        ...prev,
                        maxPerBrand: e.target.value ? Number(e.target.value) : "",
                      }))
                    }
                    className="mt-1 w-full text-xs rounded-xl border border-slate-200 bg-white p-2 font-semibold"
                  >
                    <option value="">No Brand Diversity Cap</option>
                    <option value={1}>1 Product Per Brand (Max Diversity)</option>
                    <option value={2}>2 Products Per Brand</option>
                    <option value={3}>3 Products Per Brand</option>
                    <option value={4}>4 Products Per Brand</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block uppercase">
                    Availability & Deals
                  </label>
                  <div className="mt-2 flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={automaticRules.inStockOnly || false}
                        onChange={(e) =>
                          setAutomaticRules((prev) => ({
                            ...prev,
                            inStockOnly: e.target.checked,
                          }))
                        }
                        className="rounded text-emerald-600"
                      />
                      <span>In Stock Only</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={automaticRules.hasDiscountOnly || false}
                        onChange={(e) =>
                          setAutomaticRules((prev) => ({
                            ...prev,
                            hasDiscountOnly: e.target.checked,
                          }))
                        }
                        className="rounded text-emerald-600"
                      />
                      <span>Discounted Only</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Multi-Group Manager for Category and Brand Showcases */}
          {isMultiGroupShowcase && !compact && (
            <div className="space-y-4 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="size-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Showcase Group Tabs ({groups.length} configured)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleAddGroup}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>Add Tab Group</span>
                </button>
              </div>

              {groups.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
                  No tabs defined yet. Add tab groups to allow customers to switch between categories or brands inside this showcase!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {groups.map((grp, idx) => (
                    <div
                      key={grp.id || idx}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 flex-1">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block">
                            Tab Title *
                          </label>
                          <input
                            type="text"
                            value={grp.title}
                            onChange={(e) =>
                              handleUpdateGroup(idx, "title", e.target.value)
                            }
                            className="mt-1 w-full text-xs font-semibold rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
                            placeholder="e.g. Wireless Audio"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block">
                            Subtitle / Tag
                          </label>
                          <input
                            type="text"
                            value={grp.subtitle || ""}
                            onChange={(e) =>
                              handleUpdateGroup(idx, "subtitle", e.target.value)
                            }
                            className="mt-1 w-full text-xs font-medium rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
                            placeholder="Min 30% Off"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block">
                            Target {grp.type === "brand" ? "Brand" : "Category"}
                          </label>
                          {grp.type === "brand" ? (
                            <select
                              value={grp.brandId || ""}
                              onChange={(e) =>
                                handleUpdateGroup(idx, "brandId", e.target.value)
                              }
                              className="mt-1 w-full text-xs font-medium rounded-lg border border-slate-200 bg-white px-2 py-1.5"
                            >
                              <option value="">Select Brand</option>
                              {brands.map((b) => (
                                <option key={b._id || b.id} value={b._id || b.id}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <select
                              value={grp.categoryId || ""}
                              onChange={(e) =>
                                handleUpdateGroup(idx, "categoryId", e.target.value)
                              }
                              className="mt-1 w-full text-xs font-medium rounded-lg border border-slate-200 bg-white px-2 py-1.5"
                            >
                              <option value="">Select Category</option>
                              {categories.map((c) => (
                                <option key={c._id || c.id} value={c._id || c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block">
                            Display Limit
                          </label>
                          <select
                            value={grp.limit || 8}
                            onChange={(e) =>
                              handleUpdateGroup(idx, "limit", Number(e.target.value))
                            }
                            className="mt-1 w-full text-xs font-medium rounded-lg border border-slate-200 bg-white px-2 py-1.5"
                          >
                            {[4, 6, 8, 10, 12, 16].map((n) => (
                              <option key={n} value={n}>
                                {n} Products
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveGroup(idx)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Remove Group"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Custom Hex Color Overrides */}
          <div className="space-y-3 pt-3 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Custom Hex Color Overrides
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block">
                  Background Color
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={theme?.backgroundColor || "#FFFFFF"}
                    onChange={(e) =>
                      handleThemeColorChange("backgroundColor", e.target.value)
                    }
                    className="size-7 rounded border border-slate-300 cursor-pointer p-0"
                  />
                  <input
                    type="text"
                    value={theme?.backgroundColor || ""}
                    onChange={(e) =>
                      handleThemeColorChange("backgroundColor", e.target.value)
                    }
                    placeholder="Default"
                    className="w-full text-xs font-mono rounded-lg border border-slate-200 px-2 py-1 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block">
                  Heading Color
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={theme?.headingColor || "#0F172A"}
                    onChange={(e) =>
                      handleThemeColorChange("headingColor", e.target.value)
                    }
                    className="size-7 rounded border border-slate-300 cursor-pointer p-0"
                  />
                  <input
                    type="text"
                    value={theme?.headingColor || ""}
                    onChange={(e) =>
                      handleThemeColorChange("headingColor", e.target.value)
                    }
                    placeholder="Default"
                    className="w-full text-xs font-mono rounded-lg border border-slate-200 px-2 py-1 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block">
                  Border Color
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={theme?.borderColor || "#E2E8F0"}
                    onChange={(e) =>
                      handleThemeColorChange("borderColor", e.target.value)
                    }
                    className="size-7 rounded border border-slate-300 cursor-pointer p-0"
                  />
                  <input
                    type="text"
                    value={theme?.borderColor || ""}
                    onChange={(e) =>
                      handleThemeColorChange("borderColor", e.target.value)
                    }
                    placeholder="Default"
                    className="w-full text-xs font-mono rounded-lg border border-slate-200 px-2 py-1 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block">
                  Badge / Accent
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={theme?.badgeColor || "#007A55"}
                    onChange={(e) =>
                      handleThemeColorChange("badgeColor", e.target.value)
                    }
                    className="size-7 rounded border border-slate-300 cursor-pointer p-0"
                  />
                  <input
                    type="text"
                    value={theme?.badgeColor || ""}
                    onChange={(e) =>
                      handleThemeColorChange("badgeColor", e.target.value)
                    }
                    placeholder="Default"
                    className="w-full text-xs font-mono rounded-lg border border-slate-200 px-2 py-1 uppercase"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-xl bg-[#007A55] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#006346] transition-colors disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? (
            <RefreshCw className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          <span>Save Changes</span>
        </button>
      </div>
    </div>
  );
}

function ProductRowItem({
  prod,
  idx,
  total,
  hideOrder = false,
  onMove,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) {
  const name = prod?.name || `Product ID: ${prod?._id || prod}`;
  const sku = prod?.sku || "";
  const price =
    prod?.price !== undefined && prod?.price !== null
      ? formatCurrency(prod.price)
      : "";
  const imgUrl = prod?.images?.[0]?.url || prod?.images?.[0] || prod?.image || null;

  return (
    <div
      draggable={!hideOrder}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`p-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex items-center justify-between gap-3 shadow-xs ${
        !hideOrder ? "cursor-move" : ""
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {!hideOrder && (
          <div className="flex items-center gap-1 shrink-0">
            <GripVertical className="size-3.5 text-slate-400 cursor-grab active:cursor-grabbing hover:text-slate-600" />
            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 min-w-[20px] text-center">
              #{idx + 1}
            </span>
          </div>
        )}
        <div className="size-8 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
          {imgUrl ? (
            <img
              src={imgUrl}
              alt={name}
              className="size-full object-contain bg-white"
            />
          ) : (
            <ShoppingBag className="size-4 text-slate-400" />
          )}
        </div>
        <div className="min-w-0 flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
          <span
            className="text-xs font-bold text-slate-900 truncate max-w-[220px] sm:max-w-[300px]"
            title={name}
          >
            {name}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {sku && (
              <span className="text-[10px] text-slate-500 font-mono bg-slate-50 border border-slate-200 px-1 rounded">
                SKU: {sku}
              </span>
            )}
            {price && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 rounded">
                {price}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {!hideOrder && onMove && (
          <>
            <button
              type="button"
              disabled={idx === 0}
              onClick={() => onMove("up")}
              title="Move Up"
              aria-label="Move Up"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-20 cursor-pointer transition-colors"
            >
              <ArrowUp className="size-3.5" />
            </button>
            <button
              type="button"
              disabled={idx === total - 1}
              onClick={() => onMove("down")}
              title="Move Down"
              aria-label="Move Down"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-20 cursor-pointer transition-colors"
            >
              <ArrowDown className="size-3.5" />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onRemove}
          title="Remove product"
          aria-label="Remove product"
          className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}


/**
 * Custom Section Builder Modal (Enhanced for SM2)
 */
function CustomSectionModal({
  isOpen,
  onClose,
  initialData,
  categories = [],
  brands = [],
  onSave,
}) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [subtitle, setSubtitle] = useState(initialData?.subtitle || "");
  const [key, setKey] = useState(initialData?.key || "");
  const [type, setType] = useState(initialData?.type || "carousel");
  const [limit, setLimit] = useState(initialData?.limit || 10);
  const [listingLimit, setListingLimit] = useState(initialData?.listingLimit || 16);
  const [viewMoreEnabled, setViewMoreEnabled] = useState(
    initialData?.viewMoreEnabled !== false
  );
  const [viewMoreTitle, setViewMoreTitle] = useState(
    initialData?.viewMoreTitle || "View All"
  );
  const [selectionMode, setSelectionMode] = useState(
    initialData?.selectionMode || "automatic"
  );
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(
    initialData?.categoryIds || []
  );
  const [selectedBrandIds, setSelectedBrandIds] = useState(
    initialData?.automaticRules?.brandIds || []
  );
  const [bannerHeadline, setBannerHeadline] = useState(
    initialData?.bannerData?.headline || ""
  );
  const [bannerImageUrl, setBannerImageUrl] = useState(
    initialData?.bannerData?.imageUrl || ""
  );
  const [bannerLinkUrl, setBannerLinkUrl] = useState(
    initialData?.bannerData?.linkUrl || ""
  );
  const [bannerCtaText, setBannerCtaText] = useState(
    initialData?.bannerData?.ctaText || "Shop Now"
  );
  const [theme, setTheme] = useState(initialData?.theme || {});

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const safeKey =
      key.trim() ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    const payload = {
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      key: safeKey,
      type,
      limit: Number(limit),
      listingLimit: Number(listingLimit),
      viewMoreEnabled: Boolean(viewMoreEnabled),
      viewMoreTitle: viewMoreTitle.trim() || "View All",
      selectionMode,
      theme,
    };

    if (type === "category_showcase") {
      payload.categoryIds = selectedCategoryIds;
    } else if (type === "brand_showcase") {
      payload.automaticRules = {
        brandIds: selectedBrandIds,
      };
    } else if (type === "promotional_banner") {
      payload.bannerData = {
        headline: bannerHeadline.trim() || null,
        imageUrl: bannerImageUrl.trim() || null,
        linkUrl: bannerLinkUrl.trim() || null,
        ctaText: bannerCtaText.trim() || "Shop Now",
      };
    }

    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-3xl bg-white border border-slate-200 shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="font-black text-base text-slate-900">
            {initialData ? "Edit Showcase Meta" : "Create New Storefront Showcase"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-800 cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">
              Section Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Premium Audio Brands"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">
              Section Subtitle
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="e.g. Official warranty, high-fidelity engineering"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Showcase Type *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-hidden cursor-pointer"
              >
                <option value="brand_showcase">Brand Showcase</option>
                <option value="category_showcase">Category Showcase</option>
                <option value="mixed_collection">Mixed Collection</option>
                <option value="carousel">Product Carousel</option>
                <option value="grid">Product Grid</option>
                <option value="promotional_banner">Promotional Banner</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Selection Mode
              </label>
              <select
                value={selectionMode}
                onChange={(e) => setSelectionMode(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-hidden cursor-pointer"
              >
                <option value="automatic">Automatic Rules</option>
                <option value="hybrid">Hybrid (Pinned + Auto)</option>
                <option value="manual">Manual Selection</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Homepage Limit
              </label>
              <input
                type="number"
                min={4}
                max={24}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Discovery Page Size
              </label>
              <input
                type="number"
                min={12}
                max={48}
                value={listingLimit}
                onChange={(e) => setListingLimit(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          {type === "category_showcase" && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Include Categories
              </label>
              <div className="mt-1 max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1">
                {categories.map((cat) => {
                  const id = cat._id || cat.id;
                  const isChecked = selectedCategoryIds.includes(id);
                  return (
                    <label
                      key={id}
                      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCategoryIds((prev) => [...prev, id]);
                          } else {
                            setSelectedCategoryIds((prev) =>
                              prev.filter((c) => c !== id)
                            );
                          }
                        }}
                      />
                      <span className="font-medium text-slate-800">
                        {cat.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {type === "brand_showcase" && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Include Brands
              </label>
              <div className="mt-1 max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1">
                {brands.map((b) => {
                  const id = b._id || b.id;
                  const isChecked = selectedBrandIds.includes(id);
                  return (
                    <label
                      key={id}
                      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBrandIds((prev) => [...prev, id]);
                          } else {
                            setSelectedBrandIds((prev) =>
                              prev.filter((item) => item !== id)
                            );
                          }
                        }}
                      />
                      <span className="font-medium text-slate-800">
                        {b.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {type === "promotional_banner" && (
            <div className="space-y-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block uppercase">
                  Banner Headline
                </label>
                <input
                  type="text"
                  value={bannerHeadline}
                  onChange={(e) => setBannerHeadline(e.target.value)}
                  placeholder="e.g. Elevate Your Audio Setup"
                  className="mt-1 w-full text-xs rounded-lg border border-slate-200 p-2"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block uppercase">
                  Artwork Image URL
                </label>
                <input
                  type="text"
                  value={bannerImageUrl}
                  onChange={(e) => setBannerImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="mt-1 w-full text-xs rounded-lg border border-slate-200 p-2"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block uppercase">
                  Destination Link
                </label>
                <input
                  type="text"
                  value={bannerLinkUrl}
                  onChange={(e) => setBannerLinkUrl(e.target.value)}
                  placeholder="/shop?category=audio"
                  className="mt-1 w-full text-xs rounded-lg border border-slate-200 p-2"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#007A55] hover:bg-[#006346] shadow-xs transition-colors cursor-pointer"
            >
              Save Showcase
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default StorefrontMerchandisingManager;
