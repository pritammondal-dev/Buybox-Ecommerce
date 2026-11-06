"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../lib/api/axios.js";

let cachedSettings = null;
let cachePromise = null;
const listeners = new Set();

/**
 * Fetch authoritative active storefront settings with in-memory caching and request deduplication.
 */
export const fetchStorefrontSettings = async (force = false) => {
  if (!force && cachedSettings) return cachedSettings;
  if (!force && cachePromise) return cachePromise;

  cachePromise = apiClient
    .get("/storefront/settings")
    .then((res) => {
      const data = res?.data?.data || res?.data;
      if (data) {
        cachedSettings = data;
        listeners.forEach((fn) => fn(data));
      }
      return data;
    })
    .catch((err) => {
      return cachedSettings || null;
    })
    .finally(() => {
      cachePromise = null;
    });

  return cachePromise;
};

/**
 * Invalidate cached settings and broadcast updated authoritative values to all consumers.
 */
export const invalidateStorefrontSettings = async () => {
  cachedSettings = null;
  return fetchStorefrontSettings(true);
};

export function useStorefrontSettings() {
  const [settings, setSettings] = useState(cachedSettings);
  const [loading, setLoading] = useState(!cachedSettings);

  useEffect(() => {
    let isMounted = true;

    const handleUpdate = (newSettings) => {
      if (isMounted) {
        setSettings(newSettings);
        setLoading(false);
      }
    };

    listeners.add(handleUpdate);

    if (!cachedSettings) {
      fetchStorefrontSettings().then((data) => {
        if (isMounted && data) {
          setSettings(data);
          setLoading(false);
        }
      });
    } else {
      setSettings(cachedSettings);
      setLoading(false);
    }

    return () => {
      isMounted = false;
      listeners.delete(handleUpdate);
    };
  }, []);

  // Real-time client-side favicon synchronization
  useEffect(() => {
    if (typeof document !== "undefined" && settings?.faviconUrl) {
      try {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement("link");
          link.rel = "icon";
          document.head.appendChild(link);
        }
        if (link.getAttribute("href") !== settings.faviconUrl) {
          link.setAttribute("href", settings.faviconUrl);
        }
      } catch {}
    }
  }, [settings?.faviconUrl]);

  const DEFAULT_FEATURE_FLAGS = {
    promotions: true,
    deals: true,
    guestCheckout: false,
  };

  const isFeatureEnabled = useCallback(
    (flagKey) => {
      if (settings?.featureFlags && flagKey in settings.featureFlags) {
        return settings.featureFlags[flagKey] === true;
      }
      return DEFAULT_FEATURE_FLAGS[flagKey] ?? true;
    },
    [settings]
  );

  return {
    settings,
    loading,
    storeName: settings?.storeName || "Buybox",
    tagline: settings?.tagline || "High-Performance Audio, Tech & Peripherals",
    logoUrl: settings?.logoUrl || null,
    faviconUrl: settings?.faviconUrl || "/favicon.ico",
    logoDimensions: settings?.logoDimensions || {
      desktopWidth: 160,
      desktopMaxHeight: 48,
      mobileWidth: 120,
      mobileMaxHeight: 36,
      footerMaxHeight: 40,
    },
    isFeatureEnabled,
    refresh: () => invalidateStorefrontSettings(),
  };
}
