"use client";

import React from "react";
import { useAdminAuth } from "../../hooks/useAdminAuth.js";
import { useAuth } from "../../hooks/useAuth.js";
import { checkPermissionsMatch } from "../../lib/auth/permissions.js";

/**
 * PermissionGate
 *
 * Conditionally renders UI actions (e.g. Delete button, Edit form)
 * based on the user's authenticated role or granted permissions.
 * Supports alias resolution between dot and colon formats.
 *
 * Note: Frontend gating is strictly for User Experience.
 * The backend remains strictly authoritative for security.
 */
export function PermissionGate({
  allowedRoles = [],
  requiredPermissions = [],
  fallback = null,
  children,
}) {
  const adminAuth = useAdminAuth();
  const customerAuth = useAuth();

  // Prefer admin auth in admin contexts, fallback to customer auth
  const activeAuth =
    adminAuth?.isAuthenticated && adminAuth?.user ? adminAuth : customerAuth;

  const { user, isAuthenticated } = activeAuth;

  if (!isAuthenticated || !user) {
    return fallback;
  }

  // Super Admin bypasses all checks
  const normalizedRole = (user.role || "").toLowerCase().replace(/[-_]/g, "");
  if (normalizedRole === "superadmin") {
    return <>{children}</>;
  }

  // Check roles
  if (allowedRoles.length > 0) {
    const userRole = (user.role || "").toLowerCase().replace(/[-_]/g, "");
    const allowed = allowedRoles.map((r) =>
      r.toLowerCase().replace(/[-_]/g, "")
    );
    if (!allowed.includes(userRole)) {
      return fallback;
    }
  }

  // Check permissions with alias resolution
  if (requiredPermissions.length > 0) {
    const userPermissions =
      user.permissions ||
      user.effectivePermissions ||
      activeAuth.permissions ||
      [];

    const hasAll = checkPermissionsMatch(userPermissions, requiredPermissions);
    if (!hasAll) {
      return fallback;
    }
  }

  return <>{children}</>;
}

export default PermissionGate;
