"use client";

import { useMemo } from "react";
import { useAdminAuth } from "./useAdminAuth.js";
import {
  checkPermissionsMatch,
  resolvePermissionAliases,
  hasPermission as checkHasPermission,
  hasAnyPermission as checkHasAnyPermission,
  hasAllPermissions as checkHasAllPermission,
} from "../../lib/auth/permissions.js";

/**
 * Custom React Hook for Granular Administrative Permissions
 *
 * Provides reactive checking of permissions and roles with full alias support
 * for UI component gating and authorization checks.
 */
export function usePermissions() {
  const { user, permissions = [], isAuthenticated, isLoading } = useAdminAuth();

  const role = (user?.role || "").toLowerCase().replace(/[-_]/g, "");
  const isSuperadmin = role === "superadmin";

  const effectivePermissions = useMemo(() => {
    if (isSuperadmin) return ["*"];
    if (Array.isArray(permissions) && permissions.length > 0) return permissions;
    if (Array.isArray(user?.permissions) && user.permissions.length > 0) return user.permissions;
    return [];
  }, [isSuperadmin, permissions, user]);

  const hasPermission = (permission) => {
    if (!isAuthenticated || !user) return false;
    if (isSuperadmin) return true;
    return checkHasPermission(effectivePermissions, permission);
  };

  const hasAnyPermission = (requiredList = []) => {
    if (!isAuthenticated || !user) return false;
    if (isSuperadmin) return true;
    return checkHasAnyPermission(effectivePermissions, requiredList);
  };

  const hasAllPermissions = (requiredList = []) => {
    if (!isAuthenticated || !user) return false;
    if (isSuperadmin) return true;
    return checkHasAllPermission(effectivePermissions, requiredList);
  };

  return {
    user,
    role: user?.role,
    isSuperadmin,
    isAuthenticated,
    isLoading,
    permissions: effectivePermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    resolveAliases: resolvePermissionAliases,
  };
}

export default usePermissions;
