"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { BANNER_SLOT_MAP } from "../constants/banner-slots.constants.js";

/**
 * Pure resolution function to determine slot artwork
 * Priority:
 * 1. Active admin-managed banner from the backend API.
 * 2. Existing local image fallback from public/images/banners.
 *
 * @param {Array} banners - List of active banners from API
 * @param {string} slotKey - Target slot identifier (e.g. "hero_audio")
 * @returns {Object} { imageUrl, mobileImageUrl, linkUrl, altText, isCustom, fallbackImage, slotKey, bannerId }
 */
export function resolveBannerSlot(banners = [], slotKey) {
  const defaultSlot = BANNER_SLOT_MAP[slotKey] || {
    slotKey,
    defaultImage: "/images/banners/banner-work-smarter.png",
    defaultLink: "/shop",
    defaultAlt: "Buybox Promotional Banner",
  };

  if (!Array.isArray(banners) || banners.length === 0) {
    return {
      imageUrl: defaultSlot.defaultImage,
      mobileImageUrl: defaultSlot.defaultImage,
      linkUrl: defaultSlot.defaultLink,
      altText: defaultSlot.defaultAlt,
      isCustom: false,
      fallbackImage: defaultSlot.defaultImage,
      slotKey,
      bannerId: null,
    };
  }

  // Find banner explicitly mapped to this slotKey or placement
  const customBanner = banners.find(
    (b) =>
      b &&
      (b.slotKey === slotKey || b.placement === slotKey) &&
      b.isActive !== false &&
      b.imageUrl &&
      typeof b.imageUrl === "string" &&
      b.imageUrl.trim().length > 0
  );

  if (customBanner) {
    return {
      imageUrl: customBanner.imageUrl,
      mobileImageUrl: customBanner.mobileImageUrl || customBanner.imageUrl,
      linkUrl: customBanner.linkUrl || defaultSlot.defaultLink,
      altText: customBanner.altText || customBanner.title || defaultSlot.defaultAlt,
      isCustom: true,
      fallbackImage: defaultSlot.defaultImage,
      slotKey,
      bannerId: customBanner._id || customBanner.id || null,
    };
  }

  return {
    imageUrl: defaultSlot.defaultImage,
    mobileImageUrl: defaultSlot.defaultImage,
    linkUrl: defaultSlot.defaultLink,
    altText: defaultSlot.defaultAlt,
    isCustom: false,
    fallbackImage: defaultSlot.defaultImage,
    slotKey,
    bannerId: null,
  };
}

/**
 * React hook to resolve banner artwork with automatic error fallback
 *
 * @param {Array} banners - List of banners from API
 * @param {string} slotKey - Target slot identifier
 */
export function useBannerSlot(banners, slotKey) {
  const resolved = useMemo(
    () => resolveBannerSlot(banners, slotKey),
    [banners, slotKey]
  );

  const [failedUrl, setFailedUrl] = useState(null);

  const isFailed = failedUrl === resolved.imageUrl;
  const src = isFailed ? resolved.fallbackImage : resolved.imageUrl;

  const handleImageError = useCallback(() => {
    setFailedUrl(resolved.imageUrl);
  }, [resolved.imageUrl]);

  return {
    ...resolved,
    src,
    handleImageError,
  };
}

export default useBannerSlot;
