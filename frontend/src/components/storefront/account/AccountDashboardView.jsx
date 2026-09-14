"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  MapPin,
  Heart,
  Lock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth.js";
import { orderService } from "../../../services/order.service.js";
import { addressService } from "../../../services/address.service.js";
import { useWishlist } from "../../../hooks/useWishlist.js";
import { formatCurrency, parsePrice } from "../../../utils/formatCurrency.js";
import { AccountNav } from "./AccountNav.jsx";
import { OrderStatusBadge } from "./OrderStatusBadge.jsx";
import { Skeleton } from "../../ui/Skeleton.jsx";

export function AccountDashboardView() {
  const { user, customerProfile, isAuthenticated, isInitialized } = useAuth();
  const { items: wishlistItems } = useWishlist();

  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;
    Promise.allSettled([
      orderService.getMyOrders(),
      addressService.getAddresses(),
    ])
      .then(([ordersRes, addrRes]) => {
        if (!isMounted) return;

        if (ordersRes.status === "fulfilled") {
          const ordList =
            ordersRes.value?.data?.orders ||
            (Array.isArray(ordersRes.value?.data) ? ordersRes.value.data : []);
          setOrders(ordList);
        }
        if (addrRes.status === "fulfilled") {
          const addrList =
            addrRes.value?.data?.addresses ||
            (Array.isArray(addrRes.value?.data) ? addrRes.value.data : []);
          setAddresses(addrList);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  if (isInitialized && !isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-50 text-[#007A55] mb-4">
          <Lock className="size-8 stroke-[1.5]" />
        </div>
        <h1 className="text-2xl font-black text-slate-950">Account Sign In Required</h1>
        <p className="mt-2 text-xs text-slate-600">
          Please sign in to access your Buybox customer dashboard.
        </p>
        <Link
          href="/auth/login?redirect=/account"
          className="mt-6 inline-block rounded-full bg-[#007A55] text-white font-bold text-xs px-8 py-3 hover:bg-[#004D38] transition-colors shadow-xs"
        >
          Sign In to Your Account
        </Link>
      </div>
    );
  }

  const defaultAddress = addresses.find((a) => a.isDefault) || addresses[0] || null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-[#007A55] transition-colors">
          Home
        </Link>
        <span>/</span>
        <span className="font-semibold text-foreground">My Account</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Account Nav (4 cols) */}
        <div className="lg:col-span-4">
          <AccountNav />
        </div>

        {/* Right: Dashboard Body (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Welcome Banner */}
          <div className="rounded-2xl bg-[#FFF8D6] p-6 border border-amber-200/70 shadow-xs">
            <span className="text-[11px] font-black uppercase tracking-widest text-[#007A55]">
              Customer Portal
            </span>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
              Welcome back, {user?.firstName ? `${user.firstName}` : user?.name || "Customer"}!
            </h1>
            <p className="mt-1 text-xs text-slate-700">
              Track active orders, manage delivery addresses, and update profile preferences.
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <Link
              href="/account/orders"
              className="rounded-2xl border bg-white p-4 text-center shadow-xs hover:border-[#007A55] transition-all group"
            >
              <Package className="size-5 text-[#007A55] mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
              {isLoading ? (
                <Skeleton className="h-6 w-12 mx-auto my-1" />
              ) : (
                <p className="text-xl font-black text-slate-950">{orders.length}</p>
              )}
              <p className="text-[11px] text-muted-foreground font-medium">Orders Placed</p>
            </Link>

            <Link
              href="/account/addresses"
              className="rounded-2xl border bg-white p-4 text-center shadow-xs hover:border-[#007A55] transition-all group"
            >
              <MapPin className="size-5 text-sky-600 mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
              {isLoading ? (
                <Skeleton className="h-6 w-12 mx-auto my-1" />
              ) : (
                <p className="text-xl font-black text-slate-950">{addresses.length}</p>
              )}
              <p className="text-[11px] text-muted-foreground font-medium">Saved Addresses</p>
            </Link>

            <Link
              href="/account/wishlist"
              className="rounded-2xl border bg-white p-4 text-center shadow-xs hover:border-[#007A55] transition-all group"
            >
              <Heart className="size-5 text-pink-600 mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
              <p className="text-xl font-black text-slate-950">{wishlistItems.length}</p>
              <p className="text-[11px] text-muted-foreground font-medium">Wishlist Items</p>
            </Link>
          </div>

          {/* Recent Orders Section */}
          <div className="rounded-2xl border bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-950">
                Recent Orders
              </h2>
              <Link
                href="/account/orders"
                className="text-xs font-bold text-[#007A55] hover:underline"
              >
                View All Orders →
              </Link>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                You have not placed any orders yet.{" "}
                <Link href="/shop" className="text-[#007A55] font-bold hover:underline">
                  Browse Store Catalog
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 3).map((ord) => {
                  const id = ord._id || ord.id;
                  const orderNum = ord.orderNumber || `BB-${id?.slice(-8)?.toUpperCase()}`;
                  const grandTotal = parsePrice(ord.grandTotal || ord.totalAmount || 0);

                  return (
                    <div
                      key={id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 hover:border-slate-300 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-slate-900">
                            {orderNum}
                          </span>
                          <OrderStatusBadge status={ord.status} type="order" />
                          <OrderStatusBadge status={ord.paymentStatus} type="payment" />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {ord.createdAt ? new Date(ord.createdAt).toLocaleDateString() : "Recent"} • {ord.items?.length || 1} {ord.items?.length === 1 ? "item" : "items"}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-sm font-black text-[#007A55]">
                          {formatCurrency(grandTotal)}
                        </span>
                        <Link
                          href={`/account/orders/${id}`}
                          className="rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3.5 py-1.5 transition-colors"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Account Overview Grid (Profile + Default Address) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Profile Snapshot */}
            <div className="rounded-2xl border bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-[#007A55]" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    Profile Snapshot
                  </h3>
                </div>
                <Link
                  href="/account/profile"
                  className="text-xs font-bold text-[#007A55] hover:underline"
                >
                  Edit →
                </Link>
              </div>

              <div className="space-y-1.5 text-xs text-slate-700">
                <p className="font-bold text-slate-900">
                  {user?.firstName ? `${user.firstName} ${user.lastName || ""}` : user?.name || "Customer"}
                </p>
                <p className="text-muted-foreground">{user?.email || "No email registered"}</p>
                {customerProfile?.phone && (
                  <p className="text-slate-600">Phone: {customerProfile.phone}</p>
                )}
                {user?.isEmailVerified && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-[#007A55]">
                    <CheckCircle2 className="size-3" />
                    Verified Email
                  </span>
                )}
              </div>
            </div>

            {/* Default Address Snapshot */}
            <div className="rounded-2xl border bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-sky-600" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    Primary Address
                  </h3>
                </div>
                <Link
                  href="/account/addresses"
                  className="text-xs font-bold text-[#007A55] hover:underline"
                >
                  Manage →
                </Link>
              </div>

              {defaultAddress ? (
                <div className="space-y-1 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      {[defaultAddress.firstName, defaultAddress.lastName].filter(Boolean).join(" ")}
                    </span>
                    <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-slate-600">
                      {defaultAddress.type || "HOME"}
                    </span>
                  </div>
                  <p className="text-slate-600">
                    {defaultAddress.addressLine1}
                    {defaultAddress.addressLine2 && `, ${defaultAddress.addressLine2}`}
                  </p>
                  <p className="text-slate-600">
                    {defaultAddress.city}, {defaultAddress.state} - {defaultAddress.postalCode}
                  </p>
                  <p className="text-slate-500 pt-0.5">Phone: {defaultAddress.phone}</p>
                </div>
              ) : (
                <div className="py-2 text-xs text-muted-foreground">
                  No saved delivery addresses yet.{" "}
                  <Link href="/account/addresses" className="text-[#007A55] font-bold hover:underline">
                    Add address
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AccountDashboardView;
