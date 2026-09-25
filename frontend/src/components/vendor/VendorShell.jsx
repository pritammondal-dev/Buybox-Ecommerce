"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  AlertTriangle,
  Clock,
  ExternalLink,
  ShieldAlert,
  LifeBuoy,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { vendorService } from "@/services/vendor.service";
import { VendorSidebar } from "./VendorSidebar.jsx";
import { VendorHeader } from "./VendorHeader.jsx";
import { VendorMobileNav } from "./VendorMobileNav.jsx";

export function VendorShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isInitialized } = useAuthStore();

  const [vendorProfile, setVendorProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isAdmin = isInitialized && isAuthenticated && ["admin", "super_admin"].includes(user?.role);
  const isCustomer = isInitialized && isAuthenticated && user?.role === "customer";
  const hasNoVendor = isInitialized && isAuthenticated && !isAdmin && !isCustomer && !isLoading && !vendorProfile;

  useEffect(() => {
    if (!isInitialized) {
      useAuthStore.getState().initializeAuth();
    }
  }, [isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;

    if (!isAuthenticated) {
      router.push(`/vendor/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (user?.role === "customer") {
      return;
    }

    let isMounted = true;
    vendorService
      .getMyProfile()
      .then((res) => {
        if (!isMounted) return;
        const profile = res?.data?.data?.vendor || res?.data?.vendor || res?.data;
        setVendorProfile(profile);
      })
      .catch(() => {
        if (isMounted) {
          setVendorProfile(null);
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
  }, [isInitialized, isAuthenticated, user, router, pathname]);

  // Boundary check: Customer attempting vendor dashboard
  if (isCustomer) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
        <div className="w-full max-w-md bg-white rounded-3xl border border-red-200 p-8 shadow-card text-center">
          <div className="size-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="size-7" />
          </div>
          <h1 className="text-xl font-black text-slate-900 mb-2">Access Restricted</h1>
          <p className="text-xs text-slate-600 mb-6">
            Your account ({user?.email}) is currently registered as a Customer. The Merchant Console is reserved for approved marketplace sellers.
          </p>
          <div className="flex flex-col gap-2.5">
            <Link
              href="/vendor/register"
              className="w-full py-2.5 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white font-semibold text-xs text-center shadow-sm transition-colors"
            >
              Apply as a Marketplace Vendor
            </Link>
            <Link
              href="/"
              className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs text-center transition-colors"
            >
              Return to Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Boundary check: Authenticated non-customer user without vendor profile
  if (hasNoVendor) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-8 shadow-card text-center">
          <div className="size-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="size-7" />
          </div>
          <h1 className="text-xl font-black text-slate-900 mb-2">Vendor Profile Required</h1>
          <p className="text-xs text-slate-600 mb-6">
            Your account ({user?.email}) does not have an active vendor profile. Please register as a seller to access the Merchant Console.
          </p>
          <div className="flex flex-col gap-2.5">
            <Link
              href="/vendor/register"
              className="w-full py-2.5 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white font-semibold text-xs text-center shadow-sm transition-colors"
            >
              Complete Vendor Registration
            </Link>
            <Link
              href="/"
              className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs text-center transition-colors"
            >
              Return to Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading skeleton
  if (!isInitialized || isLoading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <div className="hidden lg:block w-64 bg-[#00241A] animate-pulse" />
        <div className="flex-1 flex flex-col">
          <div className="h-16 bg-white border-b border-slate-200 animate-pulse" />
          <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
            <div className="h-8 w-48 bg-slate-200 rounded-xl animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 bg-slate-200 rounded-2xl animate-pulse" />
              ))}
            </div>
            <div className="h-96 bg-slate-200 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const onboardingStatus = vendorProfile?.onboardingStatus || "pending";
  const isApproved = onboardingStatus === "approved" && vendorProfile?.isActive;

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Desktop Fixed Sidebar */}
      <div className="hidden lg:block shrink-0">
        <VendorSidebar
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          vendorProfile={vendorProfile}
          className="sticky top-0 h-screen"
        />
      </div>

      {/* Mobile Drawer Navigation */}
      <VendorMobileNav
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        vendorProfile={vendorProfile}
      />

      {/* Main Body */}
      <div className="flex flex-1 flex-col min-w-0">
        <VendorHeader
          onMenuClick={() => setMobileNavOpen(true)}
          vendorProfile={vendorProfile}
        />

        {/* Global Onboarding Status Warning Banner if not approved */}
        {!isApproved && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 max-w-7xl mx-auto text-xs">
              <div className="flex items-center gap-2 text-amber-900 font-medium">
                <Clock className="size-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Onboarding Status: {onboardingStatus.toUpperCase()}</strong> — Your vendor application is being reviewed by marketplace operations. Product listings and order fulfillment will activate upon approval.
                </span>
              </div>
              <Link
                href="/vendor/support"
                className="inline-flex items-center gap-1 text-amber-800 hover:text-amber-950 font-semibold underline shrink-0"
              >
                <LifeBuoy className="size-3.5" /> Contact Support
              </Link>
            </div>
          </div>
        )}

        {/* Main Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default VendorShell;
