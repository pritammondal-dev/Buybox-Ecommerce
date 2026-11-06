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
          const payload =
            meResponse?.data?.data || meResponse?.data || meResponse;
          const user = payload?.user || (payload?.email ? payload : null);
          const permissions = Array.isArray(payload?.permissions)
            ? payload.permissions
            : Array.isArray(user?.permissions)
            ? user.permissions
            : [];

          if (user) {
            user.permissions = permissions;
          }

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
        const payload =
          response?.data?.data || response?.data || response;
        const user = payload?.user || null;
        const accessToken = payload?.accessToken || null;

        if (accessToken) {
          adminTokenManager.setAccessToken(accessToken);
        }

        const permissions = Array.isArray(payload?.permissions)
          ? payload.permissions
          : Array.isArray(user?.permissions)
          ? user.permissions
          : [];

        if (user) {
          user.permissions = permissions;
        }

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
      if (!permission) return true;
      if (permissions.includes(permission)) return true;

      const ALIASES = {
        "dashboard.view": ["analytics:read"],
        "analytics:read": ["dashboard.view", "analytics.view"],
        "analytics.view": ["analytics:read"],
        "tasks.view": ["work_assignments:read"],
        "work_assignments:read": ["tasks.view"],
        "vendors.view": ["vendors:read"],
        "vendors:read": ["vendors.view"],
        "customers.view": ["users:read"],
        "users:read": ["customers.view"],
        "customers.edit": ["users:manage"],
        "customers.suspend": ["users:manage"],
        "customers.reset_password": ["users:manage"],
        "customers.delete": ["users:manage"],
        "users:manage": [
          "customers.edit",
          "customers.suspend",
          "customers.reset_password",
          "customers.delete",
          "customers.export",
        ],
        "vendors.edit": ["vendors:manage"],
        "vendors.suspend": ["vendors:manage"],
        "vendors.approve": ["vendors:manage"],
        "vendors.reset_password": ["vendors:manage"],
        "vendors.delete": ["vendors:manage"],
        "vendors.bank_accounts.view": ["vendors:manage", "vendors:read", "finance:read", "finance:manage"],
        "vendors.bank_accounts.review": ["vendors:manage", "finance:manage"],
        "vendors.bank_accounts.approve": ["vendors:manage", "finance:manage"],
        "vendors.bank_accounts.reject": ["vendors:manage", "finance:manage"],
        "vendors.bank_accounts.manage": ["vendors:manage", "finance:manage"],
        "vendors.bank_accounts.view_unmasked": ["vendors:manage"],
        "vendors:manage": [
          "vendors.edit",
          "vendors.approve",
          "vendors.reject",
          "vendors.request_changes",
          "vendors.suspend",
          "vendors.reset_password",
          "vendors.delete",
          "vendors.export",
          "vendors.bank_accounts.view",
          "vendors.bank_accounts.review",
          "vendors.bank_accounts.approve",
          "vendors.bank_accounts.reject",
          "vendors.bank_accounts.manage",
          "vendors.bank_accounts.view_unmasked",
        ],
        "products.view": ["products:read"],
        "products:read": ["products.view", "attributes.view", "categories.view", "brands.view"],
        "attributes.view": ["products:read", "products.view"],
        "categories.view": ["products:read", "products.view"],
        "brands.view": ["products:read", "products.view"],
        "inventory.view": ["inventory:read"],
        "inventory:read": ["inventory.view"],
        "warehouses.view": ["warehouses:read"],
        "warehouses:read": ["warehouses.view"],
        "orders.view": ["orders:read"],
        "orders:read": ["orders.view", "orders.manage"],
        "returns.view": ["orders:read"],
        "refunds.view": ["finance:read"],
        "finance:read": ["refunds.view", "settlements.view"],
        "shipping.view": ["shipments:read"],
        "shipments:read": ["shipping.view"],
        "payments.view": ["payments:read"],
        "payments:read": ["payments.view"],
        "settlements.view": ["finance:read"],
        "campaigns.view": ["campaigns:read"],
        "campaigns:read": ["campaigns.view"],
        "coupons.view": ["coupons:read"],
        "coupons:read": ["coupons.view"],
        "discounts.view": ["coupons:read", "coupons.view"],
        "cms.view": ["settings:read"],
        "cms.events.view": ["settings:read", "cms.view"],
        "reviews.view": ["reviews:read"],
        "reviews:read": ["reviews.view"],
        "support.view": ["support_tickets:read"],
        "support_tickets:read": ["support.view"],
        "staff.view": ["employees:read"],
        "employees:read": ["staff.view", "job_roles.view"],
        "activity_logs.view": ["audit_logs:read"],
        "audit_logs:read": ["activity_logs.view"],
        "settings:read": ["platform_settings.view", "platform_credentials.view", "cms.view"],
        "settings:manage": ["platform_settings.manage", "platform_credentials.manage"],
        "tax.view": ["tax:read"],
        "tax:read": ["tax.view"],
        "permissions.view": ["permissions:read"],
        "permissions:read": ["permissions.view"],
        "job_roles.view": ["employees:read"],
      };

      const mapped = ALIASES[permission] || [];
      return mapped.some((alias) => permissions.includes(alias));
    },
  };
});

export default useAdminAuthStore;
