"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { VendorShell } from "./VendorShell.jsx";

export function VendorLayoutWrapper({ children }) {
  const pathname = usePathname();

  // Exclude vendor auth pages from the authenticated merchant shell layout
  const isAuthPage =
    pathname?.startsWith("/vendor/login") ||
    pathname?.startsWith("/vendor/register") ||
    pathname?.startsWith("/vendor/verify-email") ||
    pathname?.startsWith("/vendor/forgot-password") ||
    pathname?.startsWith("/vendor/reset-password");

  if (isAuthPage) {
    return <>{children}</>;
  }

  return <VendorShell>{children}</VendorShell>;
}

export default VendorLayoutWrapper;
