import { create } from "zustand";
import { adminTokenManager } from "../lib/auth/admin-token-manager.js";
import { adminAuthService } from "../services/admin/admin-auth.service.js";
import { normalizeApiError } from "../lib/api/api-error.js";

/**
 * Zustand Administrator Authentication Store
 *
 * Exclusively manages session state for internal Buybox employees (SUPERADMIN, ADMIN, EDITOR).
 * Completely partitioned from customer and vendor authentication stores.
 */
export const useAdminAuthStore = create((set, get) => {
  // Synchronize when adminTokenManager clears access token (e.g. failed refresh)
  adminTokenManager.subscribe((newToken) => {
    if (!newToken && get().isAuthenticated) {
      set({
        isAuthenticated: false,
        user: null,
        permissions: [],
      });
    }
  });

  return {
    user: null,
    permissions: [],
    isAuthenticated: false,
    isLoading: false,
    isInitialized: false,
    error: null,

    /**
     * Initialize administrator session on mount.
     * Silent token refresh via bb_administrator_session httpOnly cookie.
     */
    initializeAuth: async () => {
      if (get().isInitialized && get().isAuthenticated) {
        return;
      }

      set({ isLoading: true, error: null });

      try {
        const refreshResponse = await adminAuthService.refresh();
        const accessToken =
          refreshResponse?.data?.accessToken ||
          refreshResponse?.data?.data?.accessToken;

        if (accessToken) {
          adminTokenManager.setAccessToken(accessToken);

          // Retrieve fresh server-authoritative employee identity and permissions
          const meResponse = await adminAuthService.getMe();
          const meData = meResponse?.data?.user || meResponse?.data?.data?.user || meResponse?.data;

          const user = meData || null;
          const permissions = user?.permissions || [];

          set({
            isAuthenticated: true,
            user,
            permissions,
            isLoading: false,
            isInitialized: true,
            error: null,
          });
          return;
        }

        adminTokenManager.clearAccessToken();
        set({
          isAuthenticated: false,
          user: null,
          permissions: [],
          isLoading: false,
          isInitialized: true,
        });
      } catch {
        adminTokenManager.clearAccessToken();
        set({
          isAuthenticated: false,
          user: null,
          permissions: [],
          isLoading: false,
          isInitialized: true,
          error: null,
        });
      }
    },

    /**
     * Authenticate staff credentials
     */
    login: async ({ email, password }) => {
      set({ isLoading: true, error: null });

      try {
        const response = await adminAuthService.login({ email, password });
        const data = response?.data || response;
        const user = data?.user || null;
        const accessToken = data?.accessToken || null;

        if (accessToken) {
          adminTokenManager.setAccessToken(accessToken);
        }

        const permissions = user?.permissions || [];

        set({
          user,
          permissions,
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
          error: null,
        });

        return response;
      } catch (err) {
        const normalized = normalizeApiError(err);
        set({
          isLoading: false,
          error: normalized.message,
        });
        throw normalized;
      }
    },

    /**
     * Logout current administrator session
     */
    logout: async () => {
      set({ isLoading: true });

      try {
        await adminAuthService.logout();
      } catch {
        // Proceed with client cleanup regardless of network result
      } finally {
        get().clearAuth();
        set({ isLoading: false });
      }
    },

    /**
     * Clear administrator credentials and state
     */
    clearAuth: () => {
      adminTokenManager.clearAccessToken();
      set({
        user: null,
        permissions: [],
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    },

    /**
     * Check if current employee has a specific permission
     */
    hasPermission: (permission) => {
      const { user, permissions } = get();
      if (!user) return false;
      const role = (user.role || "").toUpperCase();
      if (role === "SUPERADMIN" || role === "SUPER_ADMIN") return true;
      return permissions.includes(permission);
    },
  };
});

export default useAdminAuthStore;
