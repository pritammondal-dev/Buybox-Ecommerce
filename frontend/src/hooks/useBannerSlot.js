"use client";

import { useState, useMemo, useCallback } from "react";
import { BANNER_SLOT_MAP } from "../constants/banner-slots.constants.js";

/**
 * Resolve a banner slot from the authoritative active-banner API response.
 * There is intentionally NO promotional/static fallback here: when Superadmin
 * deactivates a banner, the slot becomes empty instead of showing stale artwork.
 */
export function resolveBannerSlot(banners = [], slotKey, inactiveSlots = null) {
  const inactiveSet = new Set([
    ...(Array.isArray(inactiveSlots) ? inactiveSlots : []),
    ...(Array.isArray(banners?.inactiveSlots) ? banners.inactiveSlots : []),
    ...(Array.isArray(banners)
      ? banners
          .filter((b) => b && b.isActive === false && (b.slotKey || b.placement))
          .map((b) => b.slotKey || b.placement)
      : []),
  ]);

  const defaultSlot = BANNER_SLOT_MAP[slotKey] || {
    slotKey,
    defaultImage: "/images/banners/banner-work-smarter.png",
    defaultLink: "/shop",
    defaultAlt: "Buybox Promotional Banner",
  };

  // 1. Explicitly deactivated slot by admin (via inactiveSlots meta or inactive banner object in array)
  const isDeactivated =
    inactiveSet.has(slotKey) ||
    (Array.isArray(banners) &&
      banners.some(
        (b) =>
          b &&
          (b.slotKey === slotKey || b.placement === slotKey) &&
          b.isActive === false
      ));

  if (isDeactivated) {
    return {
      imageUrl: null,
      mobileImageUrl: null,
      linkUrl: defaultSlot.defaultLink || "/shop",
      altText: "",
      isCustom: false,
      isActive: false,
      isVisible: false,
      fallbackImage: null,
      slotKey,
      bannerId: null,
    };
  }

  if (!Array.isArray(banners) || banners.length === 0) {
    return {
      imageUrl: defaultSlot.defaultImage || null,
      mobileImageUrl: defaultSlot.defaultImage || null,
      linkUrl: defaultSlot.defaultLink || "/shop",
      altText: defaultSlot.defaultAlt || "Buybox Promotional Banner",
      title: defaultSlot.title || null,
      subtitle: defaultSlot.description || null,
      ctaText: "Shop Now",
      badge: null,
      isCustom: false,
      isActive: true,
      isVisible: Boolean(defaultSlot.defaultImage),
      fallbackImage: defaultSlot.defaultImage || null,
      slotKey,
      bannerId: null,
    };
  }

  // 2. Active custom banner explicitly mapped to this slotKey or placement
  const customBanner = banners.find(
    (b) =>
      b &&
      (b.slotKey === slotKey || b.placement === slotKey) &&
      b.isActive === true &&
      b.imageUrl &&
      typeof b.imageUrl === "string" &&
      b.imageUrl.trim().length > 0
  );

  if (!customBanner) {
    return {
      imageUrl: defaultSlot.defaultImage || null,
      mobileImageUrl: defaultSlot.defaultImage || null,
      linkUrl: defaultSlot.defaultLink || "/shop",
      altText: defaultSlot.defaultAlt || "Buybox Promotional Banner",
      title: defaultSlot.title || null,
      subtitle: defaultSlot.description || null,
      ctaText: "Shop Now",
      badge: null,
      isCustom: false,
      isActive: true,
      isVisible: Boolean(defaultSlot.defaultImage),
      fallbackImage: defaultSlot.defaultImage || null,
      slotKey,
      bannerId: null,
    };
  }

  return {
    imageUrl: customBanner.imageUrl,
    mobileImageUrl: customBanner.mobileImageUrl || customBanner.imageUrl,
    linkUrl: customBanner.linkUrl || "/shop",
    altText: customBanner.altText || customBanner.title || "Buybox Promotional Banner",
    title: customBanner.title || null,
    subtitle: customBanner.subtitle || null,
    ctaText: customBanner.ctaText || null,
    badge: customBanner.badge || null,
    isCustom: true,
    isActive: true,
    isVisible: true,
    fallbackImage: defaultSlot.defaultImage || null,
    slotKey,
    bannerId: customBanner._id || customBanner.id || null,
  };
}

/**
 * React hook to resolve banner artwork with automatic error fallback
 *
 * @param {Array} banners - List of banners from API
 * @param {string} slotKey - Target slot identifier
 * @param {Array} [inactiveSlots] - Optional list of deactivated slot keys
 */
export function useBannerSlot(banners, slotKey, inactiveSlots = null) {
  const resolved = useMemo(
    () => resolveBannerSlot(banners, slotKey, inactiveSlots),
    [banners, slotKey, inactiveSlots]
  );

  const [failedUrl, setFailedUrl] = useState(null);

  const isFailed = failedUrl === resolved.imageUrl;
  const src = (resolved.isVisible && !isFailed) ? resolved.imageUrl : null;

  const handleImageError = useCallback(() => {
    setFailedUrl(resolved.imageUrl);
  }, [resolved.imageUrl]);

  return {
    ...resolved,
    isVisible: Boolean(resolved.isVisible && src),
    src,
    handleImageError,
  };
}

export default useBannerSlot;
