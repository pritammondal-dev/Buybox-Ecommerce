"use client";

import { useAdminAuthStore } from "../../stores/admin-auth.store.js";

/**
 * Reusable Administrator Authentication Hook
 *
 * Exposes internal employee session state, roles, permissions,
 * and authentication operations to admin portal components.
 */
export function useAdminAuth() {
  const user = useAdminAuthStore((state) => state.user);
  const permissions = useAdminAuthStore((state) => state.permissions);
  const isAuthenticated = useAdminAuthStore((state) => state.isAuthenticated);
  const isLoading = useAdminAuthStore((state) => state.isLoading);
  const isInitialized = useAdminAuthStore((state) => state.isInitialized);
  const error = useAdminAuthStore((state) => state.error);

  const login = useAdminAuthStore((state) => state.login);
  const logout = useAdminAuthStore((state) => state.logout);
  const initializeAuth = useAdminAuthStore((state) => state.initializeAuth);
  const clearAuth = useAdminAuthStore((state) => state.clearAuth);
  const hasPermission = useAdminAuthStore((state) => state.hasPermission);

  return {
    user,
    permissions,
    isAuthenticated,
    isLoading,
    isInitialized,
    error,
    login,
    logout,
    initializeAuth,
    clearAuth,
    hasPermission,
  };
}

export default useAdminAuth;
