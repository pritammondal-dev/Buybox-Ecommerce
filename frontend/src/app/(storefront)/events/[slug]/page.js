import React, { Suspense } from "react";
import { notFound } from "next/navigation";
import { eventPageService } from "@/services/event-page.service.js";
import { EventPageDetailView } from "./EventPageDetailView.jsx";
import { Skeleton } from "@/components/ui/Skeleton.jsx";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "";

  try {
    const res = await eventPageService.getEventBySlug(slug);
    const event = res?.data?.data || res?.data;
    if (event) {
      return {
        title: event.seo?.title || `${event.name} | Exclusive Sale Event | Buybox`,
        description:
          event.seo?.description ||
          event.description ||
          `Shop the ${event.name} on Buybox. Exclusive bargains, verified brand warranties, and limited-time deals.`,
        keywords: event.seo?.keywords || ["special event", "sale", "buybox"],
      };
    }
  } catch {
    // Return standard fallback
  }

  return {
    title: "Special Event | Buybox",
    description: "Exclusive shopping event with handpicked electronics and lifestyle bargains at Buybox.",
  };
}

function EventPageFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <Skeleton className="h-64 w-full rounded-3xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default async function SpecialEventPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const slug = resolvedParams?.slug || "";
  const isPreview = resolvedSearchParams?.preview === "true";
  const token = resolvedSearchParams?.token || "";

  let event = null;
  try {
    const queryParams = {};
    if (isPreview) queryParams.preview = "true";
    if (token) queryParams.token = token;

    const res = await eventPageService.getEventBySlug(slug, queryParams);
    event = res?.data?.data || res?.data;
  } catch {
    notFound();
  }

  if (!event) {
    notFound();
  }

  return (
    <Suspense fallback={<EventPageFallback />}>
      <EventPageDetailView event={event} isPreview={isPreview} />
    </Suspense>
  );
}
