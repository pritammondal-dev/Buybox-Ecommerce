"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, X, Megaphone } from "lucide-react";
import { storefrontService } from "../../../services/storefront.service.js";

/**
 * PromoMessageStrip
 * Fetches active announcement bars from `/api/v1/storefront/announcement-bars/active`.
 * Strictly follows zero fake claim rules:
 * Returns null if no authentic announcements exist in the backend.
 */
export function PromoMessageStrip({ initialAnnouncements = [] }) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (initialAnnouncements.length > 0) return;

    let isMounted = true;
    storefrontService
      .getAnnouncementBars()
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        setAnnouncements(list.filter((a) => a.isActive !== false));
      })
      .catch(() => {
        if (!isMounted) return;
        setAnnouncements([]);
      });

    return () => {
      isMounted = false;
    };
  }, [initialAnnouncements]);

  // Gracefully return null if no authentic active announcements exist or if dismissed
  if (isDismissed || announcements.length === 0) {
    return null;
  }

  const activeBar = announcements[0];

  return (
    <div
      role="region"
      aria-label="Promotional announcement"
      className="bg-emerald-50 border-b border-emerald-200/80 py-2 px-4 text-xs font-semibold text-emerald-950"
    >
      <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 mx-auto">
          <span className="flex size-6 items-center justify-center rounded-full bg-emerald-200/80 text-[#007A55]">
            <Megaphone className="size-3" />
          </span>
          <span>{activeBar.title ? `${activeBar.title}: ` : ""}</span>
          <span className="font-normal text-emerald-900">{activeBar.message}</span>

          {activeBar.linkUrl && (
            <Link
              href={activeBar.linkUrl}
              className="inline-flex items-center gap-1 font-bold text-[#007A55] hover:underline ml-1"
            >
              <span>{activeBar.linkLabel || "Learn more"}</span>
              <ArrowRight className="size-3" />
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          aria-label="Dismiss announcement"
          className="text-emerald-700 hover:text-emerald-950 p-1 rounded-md transition-colors cursor-pointer"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export default PromoMessageStrip;
