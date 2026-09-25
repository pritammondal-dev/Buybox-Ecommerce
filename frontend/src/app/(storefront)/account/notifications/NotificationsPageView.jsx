"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  Package,
  Tag,
  AlertCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { notificationService } from "../../../../services/notification.service.js";
import { AccountNav } from "../../../../components/storefront/account/AccountNav.jsx";
import { Skeleton } from "../../../../components/ui/Skeleton.jsx";

export function NotificationsPageView({ showSidebar = true }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await notificationService.getNotifications();
        if (!isMounted) return;
        const list = Array.isArray(res?.data) ? res.data : res?.data?.notifications || [];
        setNotifications(list);
      } catch {
        if (isMounted) setNotifications([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => ((n._id || n.id) === id ? { ...n, isRead: true } : n))
      );
    } catch {
      // non-blocking
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success("All notifications marked as read.");
    } catch (err) {
      toast.error(err?.message || "Failed to mark notifications.");
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = useMemo(() => {
    switch (activeFilter) {
      case "unread":
        return notifications.filter((n) => !n.isRead);
      case "order":
        return notifications.filter((n) => n.type === "order" || n.category === "order");
      case "promotion":
        return notifications.filter(
          (n) => n.type === "promotion" || n.type === "coupon" || n.category === "marketing"
        );
      case "all":
      default:
        return notifications;
    }
  }, [notifications, activeFilter]);

  const getIcon = (type) => {
    switch (type) {
      case "order":
        return <Package className="h-4 w-4 text-[#004D38]" />;
      case "promotion":
      case "coupon":
        return <Tag className="h-4 w-4 text-amber-600" />;
      case "alert":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-slate-500" />;
    }
  };

  const content = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Notifications</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time order milestone updates, delivery alerts, and promotional notices.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            <CheckCheck className="h-3.5 w-3.5 text-[#004D38]" /> Mark all as read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveFilter("all")}
          className={`rounded-full px-3.5 py-1.5 font-bold transition-all ${
            activeFilter === "all"
              ? "bg-[#004D38] text-white shadow-xs"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter("unread")}
          className={`rounded-full px-3.5 py-1.5 font-bold transition-all ${
            activeFilter === "unread"
              ? "bg-[#004D38] text-white shadow-xs"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Unread ({unreadCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter("order")}
          className={`rounded-full px-3.5 py-1.5 font-bold transition-all ${
            activeFilter === "order"
              ? "bg-[#004D38] text-white shadow-xs"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Orders
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter("promotion")}
          className={`rounded-full px-3.5 py-1.5 font-bold transition-all ${
            activeFilter === "promotion"
              ? "bg-[#004D38] text-white shadow-xs"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Offers & Vouchers
        </button>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm space-y-3">
          <Bell className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="text-base font-bold text-slate-800">
            {activeFilter === "unread" ? "You're all caught up!" : "No notifications yet"}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {activeFilter === "unread"
              ? "No unread notifications at the moment. We'll alert you here when your order ships or when exclusive discounts drop."
              : "When you place orders or receive account updates, they'll appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((item) => {
            const notifId = item._id || item.id;
            const isUnread = !item.isRead;

            return (
              <div
                key={notifId}
                onClick={() => isUnread && handleMarkAsRead(notifId)}
                className={`relative flex items-start gap-4 rounded-2xl border p-5 transition-all cursor-pointer ${
                  isUnread
                    ? "border-emerald-200 bg-emerald-50/20 shadow-xs"
                    : "border-slate-200/80 bg-white hover:border-slate-300"
                }`}
              >
                {/* Icon */}
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    isUnread ? "bg-[#004D38]/10" : "bg-slate-100"
                  }`}
                >
                  {getIcon(item.type)}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4
                      className={`text-xs sm:text-sm font-bold truncate ${
                        isUnread ? "text-slate-950" : "text-slate-700"
                      }`}
                    >
                      {item.title}
                    </h4>
                    {item.createdAt && (
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(item.createdAt).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {item.message || item.body}
                  </p>

                  {item.actionUrl && (
                    <div className="pt-2">
                      <Link
                        href={item.actionUrl}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#004D38] hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>View Details</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  )}
                </div>

                {/* Unread indicator dot */}
                {isUnread && (
                  <span className="h-2 w-2 rounded-full bg-[#004D38] shrink-0 mt-1" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (!showSidebar) {
    return (
      <div className="min-h-screen bg-slate-50/50 py-10">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">{content}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4">
            <AccountNav />
          </div>
          <div className="lg:col-span-8">{content}</div>
        </div>
      </div>
    </div>
  );
}
