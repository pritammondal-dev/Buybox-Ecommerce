"use client";

import React, { useState } from "react";
import { AdminSidebar } from "../AdminSidebar.jsx";
import { AdminHeader } from "../AdminHeader.jsx";
import { AdminMobileNav } from "../AdminMobileNav.jsx";

export function AdminShell({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-900 font-sans text-foreground">
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
      <div className="flex flex-1 flex-col min-w-0 bg-background">
        <AdminHeader
          onMenuClick={() => setMobileNavOpen(true)}
          title="Buybox Admin"
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-muted/15">
          <div className="mx-auto max-w-7xl space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminShell;
