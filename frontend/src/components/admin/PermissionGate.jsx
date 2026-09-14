"use client";

import React from "react";
import { useAuth } from "../../hooks/useAuth.js";

/**
 * PermissionGate
 *
 * Conditionally renders UI actions (e.g. Delete button, Edit form)
 * based on the user's authenticated role or granted permissions.
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
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return fallback;
  }

  // Super Admin bypasses all checks
  if (user.role === "super_admin") {
    return <>{children}</>;
  }

  // Check roles
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return fallback;
  }

  // Check permissions
  if (requiredPermissions.length > 0) {
    const userPermissions = user.permissions || [];
    const hasAll = requiredPermissions.every((perm) =>
      userPermissions.includes(perm)
    );
    if (!hasAll) {
      return fallback;
    }
  }

  return <>{children}</>;
}

export default PermissionGate;
