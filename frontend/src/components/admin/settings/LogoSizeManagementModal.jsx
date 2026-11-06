"use client";

import React, { useState, useEffect } from "react";
import {
  Sliders,
  Monitor,
  Smartphone,
  PanelBottom,
  RotateCcw,
  Check,
  X,
  Loader2,
  ShoppingBag,
  Search,
  ShoppingCart,
  User,
  Menu,
} from "lucide-react";

const DEFAULT_DIMENSIONS = {
  desktopWidth: 160,
  desktopMaxHeight: 48,
  mobileWidth: 120,
  mobileMaxHeight: 36,
  footerMaxHeight: 40,
};

export function LogoSizeManagementModal({
  isOpen,
  onClose,
  logoUrl,
  storeName,
  currentDimensions,
  onSave,
}) {
  const [dimensions, setDimensions] = useState(DEFAULT_DIMENSIONS);
  const [activeTab, setActiveTab] = useState("desktop");
  const [saving, setSaving] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    if (currentDimensions) {
      setDimensions({
        desktopWidth: currentDimensions.desktopWidth ?? DEFAULT_DIMENSIONS.desktopWidth,
        desktopMaxHeight: currentDimensions.desktopMaxHeight ?? DEFAULT_DIMENSIONS.desktopMaxHeight,
        mobileWidth: currentDimensions.mobileWidth ?? DEFAULT_DIMENSIONS.mobileWidth,
        mobileMaxHeight: currentDimensions.mobileMaxHeight ?? DEFAULT_DIMENSIONS.mobileMaxHeight,
        footerMaxHeight: currentDimensions.footerMaxHeight ?? DEFAULT_DIMENSIONS.footerMaxHeight,
      });
    }
  }, [currentDimensions, isOpen]);

  useEffect(() => {
    setLogoError(false);
  }, [logoUrl]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    const num = Math.round(Number(value));
    if (!isNaN(num)) {
      setDimensions((prev) => ({ ...prev, [field]: num }));
    }
  };

  const handleReset = () => {
    setDimensions({ ...DEFAULT_DIMENSIONS });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(dimensions);
      onClose();
    } catch {
      // Handled by caller
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-emerald-50 text-[#007A55] flex items-center justify-center font-bold">
              <Sliders className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Logo Size Management
              </h2>
              <p className="text-xs text-slate-500">
                Tune responsive dimensions for desktop header, mobile drawer, and footer.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Sizing Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Desktop Controls */}
            <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 border-b border-slate-200/60 pb-2">
                <Monitor className="size-4 text-[#007A55]" />
                <span>Desktop Header Sizing</span>
              </div>

              {/* Desktop Width */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="dim-desk-width" className="text-slate-600 font-medium">
                    Max Width
                  </label>
                  <span className="font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {dimensions.desktopWidth}px
                  </span>
                </div>
                <input
                  id="dim-desk-width"
                  type="range"
                  min="40"
                  max="400"
                  step="2"
                  value={dimensions.desktopWidth}
                  onChange={(e) => handleChange("desktopWidth", e.target.value)}
                  className="w-full accent-[#007A55] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>40px</span>
                  <span>Default: 160px</span>
                  <span>400px</span>
                </div>
              </div>

              {/* Desktop Max Height */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="dim-desk-height" className="text-slate-600 font-medium">
                    Max Height
                  </label>
                  <span className="font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {dimensions.desktopMaxHeight}px
                  </span>
                </div>
                <input
                  id="dim-desk-height"
                  type="range"
                  min="20"
                  max="120"
                  step="2"
                  value={dimensions.desktopMaxHeight}
                  onChange={(e) => handleChange("desktopMaxHeight", e.target.value)}
                  className="w-full accent-[#007A55] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>20px</span>
                  <span>Default: 48px</span>
                  <span>120px</span>
                </div>
              </div>
            </div>

            {/* Mobile & Footer Controls */}
            <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 border-b border-slate-200/60 pb-2">
                <Smartphone className="size-4 text-[#007A55]" />
                <span>Mobile &amp; Footer Sizing</span>
              </div>

              {/* Mobile Width */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="dim-mob-width" className="text-slate-600 font-medium">
                    Mobile Max Width
                  </label>
                  <span className="font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {dimensions.mobileWidth}px
                  </span>
                </div>
                <input
                  id="dim-mob-width"
                  type="range"
                  min="30"
                  max="250"
                  step="2"
                  value={dimensions.mobileWidth}
                  onChange={(e) => handleChange("mobileWidth", e.target.value)}
                  className="w-full accent-[#007A55] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>30px</span>
                  <span>Default: 120px</span>
                  <span>250px</span>
                </div>
              </div>

              {/* Mobile Max Height */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="dim-mob-height" className="text-slate-600 font-medium">
                    Mobile Max Height
                  </label>
                  <span className="font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {dimensions.mobileMaxHeight}px
                  </span>
                </div>
                <input
                  id="dim-mob-height"
                  type="range"
                  min="16"
                  max="80"
                  step="2"
                  value={dimensions.mobileMaxHeight}
                  onChange={(e) => handleChange("mobileMaxHeight", e.target.value)}
                  className="w-full accent-[#007A55] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>16px</span>
                  <span>Default: 36px</span>
                  <span>80px</span>
                </div>
              </div>

              {/* Footer Max Height */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="dim-foot-height" className="text-slate-600 font-medium flex items-center gap-1">
                    <PanelBottom className="size-3 text-slate-500" />
                    <span>Footer Max Height</span>
                  </label>
                  <span className="font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {dimensions.footerMaxHeight}px
                  </span>
                </div>
                <input
                  id="dim-foot-height"
                  type="range"
                  min="16"
                  max="100"
                  step="2"
                  value={dimensions.footerMaxHeight}
                  onChange={(e) => handleChange("footerMaxHeight", e.target.value)}
                  className="w-full accent-[#007A55] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>16px</span>
                  <span>Default: 40px</span>
                  <span>100px</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Live Preview Box */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50">
              <span className="text-xs font-bold text-slate-800">
                Live Responsive Preview
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("desktop")}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === "desktop"
                      ? "bg-[#007A55] text-white"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <Monitor className="size-3.5" />
                  <span>Desktop Header</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("mobile")}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === "mobile"
                      ? "bg-[#007A55] text-white"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <Smartphone className="size-3.5" />
                  <span>Mobile Drawer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("footer")}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === "footer"
                      ? "bg-[#007A55] text-white"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <PanelBottom className="size-3.5" />
                  <span>Footer Bar</span>
                </button>
              </div>
            </div>

            {/* Preview Frame Container */}
            <div className="p-6 flex items-center justify-center min-h-[160px] bg-slate-100/60">
              {activeTab === "desktop" && (
                <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Menu className="size-4 text-slate-400" />
                    {logoUrl && !logoError ? (
                      <img
                        src={logoUrl}
                        alt={storeName || "Buybox"}
                        style={{
                          maxWidth: `${dimensions.desktopWidth}px`,
                          maxHeight: `${dimensions.desktopMaxHeight}px`,
                        }}
                        className="w-auto h-auto object-contain transition-all"
                        onError={() => setLogoError(true)}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 items-center justify-center rounded-lg bg-[#007A55] text-white">
                          <ShoppingBag className="size-4" />
                        </div>
                        <span className="font-bold text-sm text-[#007A55]">
                          {storeName || "Buybox"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 max-w-xs flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg text-xs text-slate-400">
                    <Search className="size-3.5" />
                    <span>Search products...</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <User className="size-4" />
                    <ShoppingCart className="size-4" />
                  </div>
                </div>
              )}

              {activeTab === "mobile" && (
                <div className="w-64 bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    {logoUrl && !logoError ? (
                      <img
                        src={logoUrl}
                        alt={storeName || "Buybox"}
                        style={{
                          maxWidth: `${dimensions.mobileWidth}px`,
                          maxHeight: `${dimensions.mobileMaxHeight}px`,
                        }}
                        className="w-auto h-auto object-contain transition-all"
                        onError={() => setLogoError(true)}
                      />
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <div className="flex size-6 items-center justify-center rounded bg-[#007A55] text-white">
                          <ShoppingBag className="size-3.5" />
                        </div>
                        <span className="font-bold text-xs text-[#007A55]">
                          {storeName || "Buybox"}
                        </span>
                      </div>
                    )}
                    <X className="size-4 text-slate-400" />
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-500">
                    <div className="py-1 px-2 rounded bg-slate-50">Home</div>
                    <div className="py-1 px-2 rounded">Shop Catalog</div>
                  </div>
                </div>
              )}

              {activeTab === "footer" && (
                <div className="w-full max-w-2xl bg-[#081A14] text-white border border-emerald-950 rounded-xl p-4 shadow-xs flex items-center justify-between">
                  <div className="space-y-1">
                    {logoUrl && !logoError ? (
                      <img
                        src={logoUrl}
                        alt={storeName || "Buybox"}
                        style={{
                          maxWidth: `${dimensions.desktopWidth}px`,
                          maxHeight: `${dimensions.footerMaxHeight}px`,
                        }}
                        className="w-auto h-auto object-contain transition-all"
                        onError={() => setLogoError(true)}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 items-center justify-center rounded-lg bg-[#007A55] text-white">
                          <ShoppingBag className="size-4" />
                        </div>
                        <span className="font-bold text-sm text-white">
                          {storeName || "Buybox"}
                        </span>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400">
                      © {new Date().getFullYear()} {storeName || "Buybox"}. High-Performance Gear.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-300">
                    <span>Privacy</span>
                    <span>Terms</span>
                    <span>Support</span>
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Aspect ratio is preserved with object-contain. Zero distortion or stretching.</span>
              <span className="font-semibold text-slate-700">
                Desktop: {dimensions.desktopWidth}×{dimensions.desktopMaxHeight}px | Mobile: {dimensions.mobileWidth}×{dimensions.mobileMaxHeight}px
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 px-3 py-2 rounded-xl transition-colors cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            <span>Reset to Defaults</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-4 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#007A55] hover:bg-[#006346] px-4 py-2 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  <span>Apply &amp; Save Sizing</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
