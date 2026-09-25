"use client";

import React, { useState, useEffect } from "react";
import {
  Bell,
  CheckCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";

export default function VendorNotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    vendorService
      .getMyNotifications()
      .then((res) => {
        if (!isMounted) return;
        const data = res?.data?.data || res?.data?.notifications || res?.data || [];
        const items = Array.isArray(data) ? data : data.items || [];
        setNotifications(items);
      })
      .catch((err) => {
        if (!isMounted) return;
        toast.error("Failed to load notifications", {
          description: err.response?.data?.message || err.message,
        });
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const res = await vendorService.getMyNotifications();
      const data = res?.data?.data || res?.data?.notifications || res?.data || [];
      const items = Array.isArray(data) ? data : data.items || [];
      setNotifications(items);
    } catch (err) {
      toast.error("Failed to load notifications", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await vendorService.markAllNotificationsRead();
      toast.success("All notifications marked as read");
      handleRefresh();
    } catch (err) {
      toast.error("Failed to mark all as read");
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await vendorService.markNotificationRead(id);
      handleRefresh();
    } catch (err) {
      // silent
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Notifications Stream
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Real-time updates regarding new orders, inventory alerts, returns, and settlements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {notifications.some((n) => !n.isRead && !n.read) && (
            <button
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors"
            >
              <CheckCheck className="size-3.5" />
              <span>Mark All as Read</span>
            </button>
          )}

          <button
            onClick={handleRefresh}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200">
          <Bell className="size-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-800">No Notifications</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            You&apos;re all caught up! New operational events and customer transactions will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const isUnread = !n.isRead && !n.read;
            return (
              <div
                key={n._id}
                onClick={() => isUnread && handleMarkRead(n._id)}
                className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-4 cursor-pointer ${
                  isUnread
                    ? "bg-emerald-50/40 border-emerald-200 shadow-xs"
                    : "bg-white border-slate-200/80 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`size-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isUnread ? "bg-emerald-100 text-[#004D38]" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Bell className="size-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>{n.title || "Notification"}</span>
                      {isUnread && (
                        <span className="size-2 rounded-full bg-emerald-500" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                      {n.message || n.content}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {n.createdAt ? new Date(n.createdAt).toLocaleString("en-IN") : "Recent"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
