"use client";

import React from "react";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Truck,
  Ban,
  Package,
  ShieldCheck,
  User,
  ArrowRight,
} from "lucide-react";

export default function OrderTimeline({ timeline = [], createdAt, placedAt }) {
  // Sort chronological descending (newest first)
  const events = [...(timeline || [])].sort((a, b) => {
    const timeA = new Date(a.timestamp || a.createdAt || 0).getTime();
    const timeB = new Date(b.timestamp || b.createdAt || 0).getTime();
    return timeB - timeA;
  });

  const getEventIcon = (eventKey = "") => {
    const key = eventKey.toLowerCase();
    if (key.includes("cancel")) return <Ban className="size-4 text-rose-600" />;
    if (key.includes("deliver") || key.includes("complete"))
      return <CheckCircle2 className="size-4 text-emerald-600" />;
    if (key.includes("ship") || key.includes("transit"))
      return <Truck className="size-4 text-indigo-600" />;
    if (key.includes("override"))
      return <ShieldCheck className="size-4 text-amber-600" />;
    if (key.includes("process"))
      return <Package className="size-4 text-blue-600" />;
    return <Clock className="size-4 text-slate-500" />;
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-slate-700" />
          <h3 className="text-sm font-bold text-slate-900">
            Order Status History &amp; Audit Trail
          </h3>
        </div>
        <span className="text-[11px] font-semibold text-slate-400">
          {events.length} Recorded Event{events.length === 1 ? "" : "s"}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-400">
          No detailed status progression events recorded for this order yet.
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
          {events.map((evt, idx) => {
            const timeStr = evt.timestamp || evt.createdAt
              ? new Date(evt.timestamp || evt.createdAt).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "N/A";

            const isOverride = evt.metadata?.isOverride;

            return (
              <div key={idx} className="relative group">
                <div className="absolute -left-6 top-0.5 size-5 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-2xs group-hover:border-slate-400 transition-colors">
                  {getEventIcon(evt.event || evt.title)}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{evt.title || evt.event || "Status Event"}</span>
                      {isOverride && (
                        <span className="inline-flex px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                          Override
                        </span>
                      )}
                    </p>
                    <time className="text-[11px] font-mono text-slate-400">
                      {timeStr}
                    </time>
                  </div>

                  {evt.description && (
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {evt.description}
                    </p>
                  )}

                  {evt.actor && (
                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      <User className="size-3" />
                      <span>
                        Actor:{" "}
                        <strong className="text-slate-600 capitalize">
                          {evt.actor.actorType || "System"}
                        </strong>
                        {evt.actor.actorId ? ` (${evt.actor.actorId})` : ""}
                      </span>
                    </p>
                  )}

                  {evt.metadata?.notes && (
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600 mt-1 font-mono">
                      <strong>Notes:</strong> {evt.metadata.notes}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
