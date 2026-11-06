/**
 * Storefront Promotional Banner Utilities
 */

/**
 * Compute human-friendly schedule status
 * @param {Object} banner
 * @returns {{ status: 'inactive' | 'scheduled' | 'expired' | 'active', label: string, badgeClass: string }}
 */
export function getBannerScheduleStatus(banner) {
  if (!banner || banner.isActive === false) {
    return {
      status: "inactive",
      label: "Hidden / Inactive",
      badgeClass:
        "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700",
    };
  }

  const now = new Date();
  if (banner.startsAt && new Date(banner.startsAt) > now) {
    const startsDate = new Date(banner.startsAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return {
      status: "scheduled",
      label: `Scheduled (Starts ${startsDate})`,
      badgeClass:
        "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800",
    };
  }

  if (banner.endsAt && new Date(banner.endsAt) < now) {
    const endsDate = new Date(banner.endsAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return {
      status: "expired",
      label: `Expired (${endsDate})`,
      badgeClass:
        "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300 dark:border-rose-800",
    };
  }

  return {
    status: "active",
    label: "Live on Storefront",
    badgeClass:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
  };
}

/**
 * Validate destination link URL or path
 * @param {string} url
 * @returns {boolean}
 */
export function isBannerLinkValid(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  return (
    trimmed.startsWith("/") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  );
}

/**
 * Compute dashboard summary KPIs
 * @param {Array} banners
 * @param {number} totalPredefinedSlots
 * @returns {Object}
 */
export function calculateBannerKPIs(banners = [], totalPredefinedSlots = 12) {
  const total = banners.length;
  const now = new Date();

  const active = banners.filter((b) => {
    if (b.isActive === false) return false;
    if (b.startsAt && new Date(b.startsAt) > now) return false;
    if (b.endsAt && new Date(b.endsAt) < now) return false;
    return true;
  }).length;

  const inactive = banners.filter((b) => b.isActive === false).length;

  const scheduled = banners.filter(
    (b) => b.isActive !== false && Boolean(b.startsAt || b.endsAt)
  ).length;

  const populatedSlots = new Set(
    banners
      .filter((b) => b.isActive !== false)
      .map((b) => b.slotKey || b.placement)
      .filter(Boolean)
  );

  const slotCoveragePercent =
    totalPredefinedSlots > 0
      ? Math.round((populatedSlots.size / totalPredefinedSlots) * 100)
      : 0;

  return {
    total,
    active,
    inactive,
    scheduled,
    activeSlots: populatedSlots.size,
    totalSlots: totalPredefinedSlots,
    slotCoveragePercent,
  };
}
