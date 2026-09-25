"use client";

import { useAuthStore } from "../stores/auth.store.js";

/**
 * Reusable Auth Hook
 *
 * Exposes authentication state and methods to React Client Components.
 * For Server Components, use cookies and backend session checks directly.
 */
export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const customerProfile = useAuthStore((state) => state.customerProfile);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const error = useAuthStore((state) => state.error);

  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const logout = useAuthStore((state) => state.logout);
  const refreshSession = useAuthStore((state) => state.refreshSession);
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const setUser = useAuthStore((state) => state.setUser);

  return {
    user,
    customerProfile,
    isAuthenticated,
    isLoading,
    isInitialized,
    error,
    login,
    register,
    logout,
    refreshSession,
    initializeAuth,
    clearAuth,
    setUser,
  };
}

export default useAuth;
