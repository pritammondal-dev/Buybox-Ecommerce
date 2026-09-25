"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar.jsx";
import { AdminHeader } from "../AdminHeader.jsx";
import { AdminMobileNav } from "../AdminMobileNav.jsx";
import { useAdminAuth } from "@/hooks/useAdminAuth.js";

export function AdminShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, isInitialized, initializeAuth } = useAdminAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // If on login page, render children directly without admin chrome
  const isLoginPage =
    pathname === "/administrator/login" ||
    pathname === "/admin/login";

  useEffect(() => {
    if (!isInitialized && !isLoading) {
      initializeAuth();
    }
  }, [isInitialized, isLoading, initializeAuth]);

  useEffect(() => {
    if (isInitialized && !isLoading) {
      if (!isAuthenticated && !isLoginPage) {
        router.push("/administrator/login");
      } else if (isAuthenticated && isLoginPage) {
        router.push("/administrator/dashboard");
      }
    }
  }, [isInitialized, isLoading, isAuthenticated, isLoginPage, user, router]);

  if (isLoginPage) {
    return <div className="min-h-screen bg-slate-950 font-sans">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-[#00241A] font-sans text-foreground">
      {/* Desktop Fixed Sidebar */}
      <div className="hidden lg:block shrink-0">
        <AdminSidebar
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          className="sticky top-0 h-screen"
        />
      </div>

      {/* Mobile Nav Drawer */}
      <AdminMobileNav
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />

      {/* Right Column: Top Header + Main Content */}
      <div className="flex flex-1 flex-col min-w-0 bg-slate-50">
        <AdminHeader
          onMenuClick={() => setMobileNavOpen(true)}
          title="Buybox Admin"
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#F8F9FA]">
          <div className="mx-auto max-w-7xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default AdminShell;
