"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  Tag,
  Clock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Layers,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { ProductCard } from "@/components/storefront/ProductCard.jsx";
import { useCart } from "@/hooks/useCart.js";
import { useWishlist } from "@/hooks/useWishlist.js";
import { cn } from "@/utils/cn.js";
import { getCategoryHref } from "@/utils/category.util.js";

function safeHref(url, fallback = "#") {
  if (!url || typeof url !== "string") return fallback;
  const trimmed = url.trim();
  if (/^(javascript|vbscript|data):/i.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    if (!targetDate) return;

    function calculate() {
      const difference = new Date(targetDate).getTime() - new Date().getTime();
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
    }

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}

export function EventPageDetailView({ event, isPreview = false }) {
  const { addItem: addCartItem } = useCart();
  const { isInWishlist, addItem: addWishlistItem, removeItem: removeWishlistItem } = useWishlist();

  // Active sorted sections
  const sections = (Array.isArray(event.sections) ? event.sections : [])
    .filter((s) => s.isActive !== false)
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  // Wishlist handler
  const handleWishlistToggle = async (product, isWishlisted) => {
    const id = product._id || product.id;
    try {
      if (isWishlisted) {
        await addWishlistItem(id);
        toast.success("Saved to wishlist", {
          description: `${product.name} was saved to your wishlist.`,
        });
      } else {
        await removeWishlistItem(id);
        toast.info("Removed from wishlist", {
          description: `${product.name} was removed from your wishlist.`,
        });
      }
    } catch {
      toast.error("Could not update wishlist");
    }
  };

  // Add to cart handler
  const handleAddToCart = async (product) => {
    try {
      const productId = product._id || product.id;
      const productVariantId = product.productVariantId || product.defaultVariantId || undefined;

      await addCartItem({
        ...(productVariantId ? { productVariantId } : {}),
        productId,
        quantity: 1,
        itemSnapshot: {
          name: product.name,
          price: product.price,
          image: product.images?.[0]?.url || product.image || product.thumbnail || null,
        },
      });

      toast.success("Added to cart", {
        description: `${product.name} added to your shopping cart.`,
      });
    } catch {
      toast.error("Could not add item to cart");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16">
      {/* Admin Preview Mode Floating Bar */}
      {isPreview && (
        <div className="bg-amber-500 text-slate-900 font-bold text-xs py-2 px-4 sticky top-0 z-50 shadow-md flex items-center justify-between">
          <div className="flex items-center gap-2 mx-auto">
            <span className="size-2 rounded-full bg-slate-900 animate-pulse" />
            <span>Authorized Event Preview Mode — Status: {event.status?.toUpperCase()}</span>
          </div>
        </div>
      )}

      {/* Main Event Header Banner */}
      <section
        className={cn(
          "relative overflow-hidden border-b",
          event.theme?.isDark ? "bg-[#043E2E] text-white" : "bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/60 text-slate-900"
        )}
        style={{
          borderBottomColor: event.theme?.primaryColor || "#004D38",
        }}
      >
        {event.bannerUrl && (
          <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.bannerUrl} alt={event.name} className="size-full object-cover" />
          </div>
        )}

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
          <div className="max-w-2xl space-y-4">
            {event.badge && (
              <div
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-xs"
                style={{
                  backgroundColor: event.theme?.accentColor || "#E6A800",
                  color: "#000",
                }}
              >
                <Sparkles className="size-3.5" />
                <span>{event.badge}</span>
              </div>
            )}

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
              {event.name}
            </h1>

            {event.description && (
              <p
                className={cn(
                  "text-sm sm:text-base font-medium leading-relaxed max-w-xl",
                  event.theme?.isDark ? "text-emerald-100/90" : "text-slate-600"
                )}
              >
                {event.description}
              </p>
            )}

            {/* Event Guarantees */}
            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-semibold">
              <span className="inline-flex items-center gap-1 text-emerald-800 bg-white/80 backdrop-blur-xs px-2.5 py-1 rounded-full border border-emerald-200">
                <ShieldCheck className="size-3.5" /> 100% Genuine Brands
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-800 bg-white/80 backdrop-blur-xs px-2.5 py-1 rounded-full border border-emerald-200">
                <CheckCircle2 className="size-3.5" /> Automatic Checkout Discounts
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Dynamic Sections Renderer */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        {sections.map((sec) => (
          <EventSectionComponent
            key={sec.id}
            section={sec}
            onAddToCart={handleAddToCart}
            onWishlistToggle={handleWishlistToggle}
            isInWishlist={isInWishlist}
            theme={event.theme}
          />
        ))}

        {sections.length === 0 && (
          <div className="py-20 text-center text-slate-500 space-y-3">
            <ShoppingBag className="size-10 mx-auto text-slate-300" />
            <h3 className="font-bold text-slate-700">Event Sections Coming Soon</h3>
            <p className="text-xs text-slate-500">Deals and collections are currently being curated for this event.</p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] text-white text-xs font-bold hover:bg-[#003B2B]"
            >
              <span>Explore Marketplace Catalog</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Individual Section Renderer Dispatcher
 */
function EventSectionComponent({ section, onAddToCart, onWishlistToggle, isInWishlist, theme }) {
  const { type, title, subtitle, config = {} } = section;

  switch (type) {
    case "hero_banner":
      return (
        <section className="relative overflow-hidden rounded-3xl bg-slate-900 text-white min-h-[260px] sm:min-h-[340px] flex items-center p-6 sm:p-10 shadow-sm border border-slate-200">
          {config.imageUrl && (
            <div className="absolute inset-0 z-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={config.imageUrl} alt={title || "Hero banner"} className="size-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-transparent" />
            </div>
          )}
          <div className="relative z-10 max-w-lg space-y-3">
            {title && <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{title}</h2>}
            {subtitle && <p className="text-xs sm:text-sm text-slate-300">{subtitle}</p>}
            {config.linkUrl && (
              <div className="pt-2">
                <Link
                  href={safeHref(config.linkUrl, "/shop")}
                  className="inline-flex items-center gap-2 rounded-full bg-[#004D38] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-[#003B2B] active:scale-95 transition-all"
                >
                  <span>{config.ctaText || "Shop Now"}</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            )}
          </div>
        </section>
      );

    case "banner_slider":
      return <EventBannerSliderSection section={section} />;

    case "promo_banner":
      return (
        <section className="overflow-hidden rounded-3xl border border-slate-200 shadow-2xs group hover:shadow-md transition-all block relative bg-slate-100">
          <Link href={safeHref(config.linkUrl, "/shop")} className="block relative h-48 sm:h-64">
            {config.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={config.imageUrl}
                alt={title || "Promotional banner"}
                className="size-full object-cover group-hover:scale-102 transition-transform duration-500"
              />
            ) : (
              <div className="size-full flex flex-col justify-center p-6 bg-gradient-to-r from-emerald-100 to-teal-50">
                {title && <h3 className="text-xl font-bold text-slate-900">{title}</h3>}
                {subtitle && <p className="text-xs text-slate-600 mt-1">{subtitle}</p>}
              </div>
            )}
          </Link>
        </section>
      );

    case "ad_banner":
      return (
        <section className="p-4 rounded-3xl bg-amber-50/60 border border-amber-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-200/80 text-amber-900">
              <Tag className="size-3" /> Sponsored Partner Spotlight
            </span>
            {config.sponsorName && (
              <span className="text-[11px] font-semibold text-amber-800">{config.sponsorName}</span>
            )}
          </div>
          <Link href={safeHref(config.linkUrl, "#")} className="block relative overflow-hidden rounded-2xl h-36 sm:h-48 group">
            {config.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={config.imageUrl}
                alt={title || "Sponsored Advertisement"}
                className="size-full object-cover group-hover:scale-102 transition-transform duration-500"
              />
            ) : (
              <div className="size-full bg-white flex items-center justify-center text-slate-400 font-bold text-xs">
                {title || "Sponsored Partner Advertisement"}
              </div>
            )}
          </Link>
        </section>
      );

    case "countdown":
      return <EventCountdownSection section={section} theme={theme} />;

    case "category_grid": {
      const categories = section.resolvedCategories || [];
      if (categories.length === 0) return null;

      return (
        <section className="space-y-4">
          <div className="border-b pb-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {title || "Shop By Event Category"}
            </h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {categories.map((cat) => (
              <Link
                key={cat._id || cat.slug}
                href={getCategoryHref(cat)}
                className="p-3 rounded-2xl border border-slate-200 bg-white hover:border-[#004D38] hover:shadow-sm text-center group transition-all block"
              >
                <div className="size-16 sm:size-20 rounded-2xl bg-emerald-50 mx-auto flex items-center justify-center overflow-hidden mb-2">
                  {cat.image?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cat.image.url}
                      alt={cat.name}
                      className="size-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <ShoppingBag className="size-7 text-[#004D38]" />
                  )}
                </div>
                <p className="font-bold text-slate-800 text-xs truncate group-hover:text-[#004D38]">
                  {cat.name}
                </p>
              </Link>
            ))}
          </div>
        </section>
      );
    }

    case "product_collection":
    case "category_products":
    case "deals_collection": {
      const products = section.resolvedProducts || [];
      if (products.length === 0) return null;

      return (
        <section className="space-y-4">
          <div className="border-b pb-2 flex items-end justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {title || (type === "deals_collection" ? "Blockbuster Event Deals" : "Featured Products")}
              </h2>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
            <Link href="/shop" className="text-xs font-bold text-[#004D38] hover:underline flex items-center gap-1">
              <span>View All</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {products.map((prod) => (
              <ProductCard
                key={prod._id || prod.id}
                product={prod}
                onAddToCart={onAddToCart}
                onWishlistToggle={onWishlistToggle}
                isWishlisted={isInWishlist(prod._id || prod.id)}
              />
            ))}
          </div>
        </section>
      );
    }

    case "brand_showcase": {
      const brands = config.brands || [];
      if (brands.length === 0) return null;

      return (
        <section className="p-6 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-2xs">
          <div className="text-center max-w-md mx-auto space-y-1">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">{title || "Participating Brands"}</h2>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
            {brands.map((b, idx) => (
              <Link
                key={idx}
                href={safeHref(b.linkUrl, "/shop")}
                className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-white hover:border-[#004D38] text-center font-bold text-xs text-slate-700 hover:text-[#004D38] shadow-2xs hover:shadow-xs transition-all"
              >
                {b.name}
              </Link>
            ))}
          </div>
        </section>
      );
    }

    case "rich_text":
      return (
        <section className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
          {title && <h2 className="text-lg font-bold text-slate-900">{title}</h2>}
          {config.content && (
            <div className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {config.content}
            </div>
          )}
        </section>
      );

    default:
      return null;
  }
}

/**
 * Dedicated Countdown Section Component
 */
function EventCountdownSection({ section, theme }) {
  const { title, subtitle, config = {} } = section;
  const countdown = useCountdown(config.targetDate);

  return (
    <section className="p-6 sm:p-8 rounded-3xl bg-gradient-to-tr from-[#004D38] to-[#043E2E] text-white shadow-md space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400 text-slate-950">
            <Clock className="size-3" /> Limited Time Event Clock
          </div>
          <h2 className="text-2xl font-black tracking-tight">{title || config.headline || "Sale Ends Soon!"}</h2>
          {subtitle && <p className="text-xs text-emerald-100/90">{subtitle}</p>}
        </div>

        {/* Ticking Clock Box */}
        <div className="flex items-center gap-2">
          <div className="p-2 sm:p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 text-center min-w-[50px] sm:min-w-[60px]">
            <span className="block text-xl sm:text-2xl font-black font-mono">{countdown.days}</span>
            <span className="text-[9px] uppercase font-bold text-emerald-200">Days</span>
          </div>
          <span className="text-xl font-bold font-mono text-emerald-300">:</span>
          <div className="p-2 sm:p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 text-center min-w-[50px] sm:min-w-[60px]">
            <span className="block text-xl sm:text-2xl font-black font-mono">
              {String(countdown.hours).padStart(2, "0")}
            </span>
            <span className="text-[9px] uppercase font-bold text-emerald-200">Hours</span>
          </div>
          <span className="text-xl font-bold font-mono text-emerald-300">:</span>
          <div className="p-2 sm:p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 text-center min-w-[50px] sm:min-w-[60px]">
            <span className="block text-xl sm:text-2xl font-black font-mono">
              {String(countdown.minutes).padStart(2, "0")}
            </span>
            <span className="text-[9px] uppercase font-bold text-emerald-200">Mins</span>
          </div>
          <span className="text-xl font-bold font-mono text-emerald-300">:</span>
          <div className="p-2 sm:p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 text-center min-w-[50px] sm:min-w-[60px]">
            <span className="block text-xl sm:text-2xl font-black font-mono">
              {String(countdown.seconds).padStart(2, "0")}
            </span>
            <span className="text-[9px] uppercase font-bold text-emerald-200">Secs</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Dedicated Banner Slider / Carousel Section Component
 */
function EventBannerSliderSection({ section }) {
  const slides = section.config?.slides || [];
  const [currentIdx, setCurrentIdx] = useState(0);

  if (slides.length === 0) return null;

  const current = slides[currentIdx] || slides[0];

  return (
    <section className="relative overflow-hidden rounded-3xl bg-slate-900 text-white min-h-[220px] sm:min-h-[300px] flex items-center p-6 sm:p-8 shadow-sm">
      {current.imageUrl && (
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.imageUrl} alt={current.title || "Slide"} className="size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-transparent" />
        </div>
      )}

      <div className="relative z-10 max-w-md space-y-2">
        {current.title && <h3 className="text-xl sm:text-2xl font-black">{current.title}</h3>}
        {current.subtitle && <p className="text-xs text-slate-300">{current.subtitle}</p>}
        {current.linkUrl && (
          <div className="pt-2">
            <Link
              href={safeHref(current.linkUrl, "/shop")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#004D38] text-white text-xs font-bold hover:bg-[#003B2B]"
            >
              <span>{current.ctaText || "Explore"}</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        )}
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setCurrentIdx((prev) => (prev - 1 + slides.length) % slides.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 size-8 rounded-full bg-white/90 text-slate-800 flex items-center justify-center hover:bg-white cursor-pointer"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentIdx((prev) => (prev + 1) % slides.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 size-8 rounded-full bg-white/90 text-slate-800 flex items-center justify-center hover:bg-white cursor-pointer"
          >
            <ChevronRight className="size-4" />
          </button>
        </>
      )}
    </section>
  );
}
