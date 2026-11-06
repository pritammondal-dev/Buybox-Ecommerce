import { create } from "zustand";
import { tokenManager } from "../lib/auth/token-manager.js";
import { vendorTokenManager } from "../lib/auth/vendor-token-manager.js";
import { authService } from "../services/auth.service.js";
import { customerService } from "../services/customer.service.js";
import { vendorService } from "../services/vendor.service.js";
import { normalizeApiError } from "../lib/api/api-error.js";
import { useCheckoutStore } from "./checkout.store.js";

/**
 * Zustand Authentication Store
 *
 * Manages frontend session state, reactive user information, and initialization.
 * The backend remains strictly authoritative for roles, permissions, and session validity.
 */
export const useAuthStore = create((set, get) => {
  // Synchronize when customer tokenManager clears the access token (e.g., failed refresh in Axios)
  tokenManager.subscribe((newToken) => {
    if (!newToken && get().isAuthenticated && (!get().user?.role || get().user?.role === "customer")) {
      try {
        useCheckoutStore.getState().resetCheckout();
      } catch {
        // Safe catch if checkout store is not ready
      }
      set({
        isAuthenticated: false,
        user: null,
        customerProfile: null,
      });
    }
  });

  // Synchronize when vendorTokenManager clears the access token (e.g., failed vendor refresh in Axios)
  vendorTokenManager.subscribe((newToken) => {
    if (!newToken && get().isAuthenticated && get().user?.role === "vendor") {
      set({
        isAuthenticated: false,
        user: null,
        customerProfile: null,
      });
    }
  });

  return {
    user: null,
    customerUser: null,
    vendorUser: null,
    customerProfile: null,
    isCustomerAuthenticated: false,
    isVendorAuthenticated: false,
    isCustomerInitialized: false,
    isVendorInitialized: false,
    isAuthenticated: false,
    isLoading: false,
    isInitialized: false,
    error: null,

    /**
     * Initialize authentication on client application mount.
     * Silently probes the backend refresh endpoint using the httpOnly cookie.
     */
    initializeAuth: async () => {
      // Avoid duplicate runs if already initialized
      if (get().isInitialized && get().isAuthenticated) {
        return;
      }

      set({ isLoading: true, error: null });

      try {
        const refreshResponse = await authService.refresh();
        const accessToken =
          refreshResponse?.data?.accessToken ||
          refreshResponse?.data?.data?.accessToken;

        if (accessToken) {
          tokenManager.setAccessToken(accessToken);

          let restoredUser = get().user;
          if (!restoredUser && typeof window !== "undefined") {
            try {
              const saved = localStorage.getItem("buybox_auth_user");
              if (saved) {
                restoredUser = JSON.parse(saved);
              }
            } catch {
              // Ignore parse error
            }
          }

          // Retrieve customer profile for user metadata (only for customer accounts)
          let profile = null;
          if (!restoredUser?.role || restoredUser?.role === "customer") {
            try {
              const profileResponse = await customerService.getProfile();
              profile = profileResponse?.data?.customer || profileResponse?.data || null;
            } catch {
              // Profile may not exist yet or request failed; proceed with basic authenticated session
            }
          }

          set({
            isAuthenticated: true,
            user: restoredUser,
            customerProfile: profile,
            isLoading: false,
            isInitialized: true,
            error: null,
          });
          return;
        }

        // No token returned
        tokenManager.clearAccessToken();
        set({
          isAuthenticated: false,
          user: null,
          customerProfile: null,
          isLoading: false,
          isInitialized: true,
        });
      } catch {
        // Refresh token expired or cookie missing - user is a guest
        tokenManager.clearAccessToken();
        set({
          isAuthenticated: false,
          user: null,
          customerProfile: null,
          isLoading: false,
          isInitialized: true,
          error: null,
        });
      }
    },

        /**
     * Initialize vendor authentication on Merchant Console mount.
     * Silently probes the backend vendor refresh endpoint using bb_vendor_session cookie.
     * Strictly isolated from customer session state.
     */
    initializeVendorAuth: async () => {
      // If already initialized as vendor and vendorTokenManager has access token, avoid redundant calls
      if (get().isVendorInitialized && get().isVendorAuthenticated && vendorTokenManager.hasAccessToken()) {
        return;
      }

      set({ isLoading: true, error: null });

      try {
        const refreshResponse = await vendorService.refresh();
        const data = refreshResponse?.data || refreshResponse;
        const accessToken =
          data?.accessToken ||
          data?.data?.accessToken;
        const user = data?.user || data?.data?.user;

        if (accessToken) {
          vendorTokenManager.setAccessToken(accessToken);

          let restoredVendorUser = user;
          if (!restoredVendorUser && typeof window !== "undefined") {
            try {
              const saved = localStorage.getItem("buybox_vendor_user") || localStorage.getItem("buybox_auth_user");
              if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.role === "vendor" || parsed.roles?.includes("vendor")) {
                  restoredVendorUser = parsed;
                }
              }
            } catch {}
          }

          if (restoredVendorUser && typeof window !== "undefined") {
            try {
              localStorage.setItem("buybox_vendor_user", JSON.stringify(restoredVendorUser));
            } catch {}
          }

          set({
            vendorUser: restoredVendorUser,
            user: restoredVendorUser,
            isVendorAuthenticated: true,
            isVendorInitialized: true,
            isAuthenticated: true,
            isInitialized: true,
            isLoading: false,
            error: null,
          });
          return;
        }

        vendorTokenManager.clearAccessToken();
        set({
          vendorUser: null,
          isVendorAuthenticated: false,
          isVendorInitialized: true,
          isLoading: false,
        });
      } catch {
        vendorTokenManager.clearAccessToken();
        set({
          vendorUser: null,
          isVendorAuthenticated: false,
          isVendorInitialized: true,
          isLoading: false,
          error: null,
        });
      }
    },

    /**
     * User login with email and password
     */
    login: async ({ email, password }) => {
      set({ isLoading: true, error: null });

      try {
        const response = await authService.login({ email, password });
        const data = response?.data || response;
        const user = data?.user || null;
        const accessToken = data?.accessToken || null;

        if (accessToken) {
          tokenManager.setAccessToken(accessToken);
        }

        // Retrieve customer profile (only for customer accounts)
        let profile = null;
        if (!user?.role || user?.role === "customer") {
          try {
            const profileResponse = await customerService.getProfile();
            profile = profileResponse?.data?.customer || profileResponse?.data || null;
          } catch {
            // Profile optional on first login
          }
        }

        if (user && typeof window !== "undefined") {
          try {
            localStorage.setItem("buybox_auth_user", JSON.stringify(user));
          } catch {
            // Ignore storage write failure
          }
        }

        set({
          user,
          customerProfile: profile,
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
          error: null,
        });

        const activeCustomerId = user?.id || user?._id || profile?.id || profile?._id;
        if (activeCustomerId) {
          try {
            useCheckoutStore.getState().validateAndSyncCustomer(activeCustomerId);
          } catch {
            // Safe catch
          }
        }

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
     * Vendor login with email and password via dedicated vendor auth endpoint
     */
    vendorLogin: async ({ email, password }) => {
      set({ isLoading: true, error: null });

      try {
        const response = await vendorService.login({ email, password });
        const data = response?.data || response;
        const user = data?.user || data?.data?.user || null;
        const accessToken = data?.accessToken || data?.data?.accessToken || null;

        if (accessToken) {
          vendorTokenManager.setAccessToken(accessToken);
        }

        if (user && typeof window !== "undefined") {
          try {
            localStorage.setItem("buybox_auth_user", JSON.stringify(user));
          } catch {
            // Ignore storage write failure
          }
        }

        set({
          user,
          customerProfile: null,
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
     * Internal helper to apply customer session state from API response
     */
    _applyAuthSession: async (response) => {
      const data = response?.data || response;
      const user = data?.user || null;
      const accessToken = data?.accessToken || null;

      if (accessToken) {
        tokenManager.setAccessToken(accessToken);
      }

      let profile = null;
      if (!user?.role || user?.role === "customer") {
        try {
          const profileResponse = await customerService.getProfile();
          profile = profileResponse?.data?.customer || profileResponse?.data || null;
        } catch {
          // Optional customer profile
        }
      }

      if (user && typeof window !== "undefined") {
        try {
          localStorage.setItem("buybox_auth_user", JSON.stringify(user));
        } catch {
          // Ignore storage write failure
        }
      }

      set({
        user,
        customerProfile: profile,
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
        error: null,
      });

      const activeCustomerId = user?.id || user?._id || profile?.id || profile?._id;
      if (activeCustomerId) {
        try {
          useCheckoutStore.getState().validateAndSyncCustomer(activeCustomerId);
        } catch {
          // Safe catch
        }
      }

      return response;
    },

    /**
     * Passwordless customer login via email OTP
     */
    loginWithEmailOtp: async ({ email, otp }) => {
      set({ isLoading: true, error: null });
      try {
        const response = await authService.verifyEmailLoginOtp({ email, otp });
        return await get()._applyAuthSession(response);
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
     * Customer login via mobile phone OTP
     */
    loginWithPhoneOtp: async ({ phone, otp }) => {
      set({ isLoading: true, error: null });
      try {
        const response = await authService.verifyPhoneLoginOtp({ phone, otp });
        return await get()._applyAuthSession(response);
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
     * Customer login via verified Google identity
     */
    loginWithGoogle: async ({ idToken }) => {
      set({ isLoading: true, error: null });
      try {
        const response = await authService.loginWithGoogle({ idToken });
        return await get()._applyAuthSession(response);
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
     * Mobile registration completion via phone OTP
     */
    registerWithPhone: async ({ phone, otp, firstName, lastName }) => {
      set({ isLoading: true, error: null });
      try {
        const response = await authService.verifyPhoneRegister({
          phone,
          otp,
          firstName,
          lastName,
        });
        return await get()._applyAuthSession(response);
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
     * User registration
     */
    register: async ({ email, password, firstName, lastName }) => {
      set({ isLoading: true, error: null });

      try {
        const response = await authService.register({
          email,
          password,
          firstName,
          lastName,
        });
        set({ isLoading: false, error: null });
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
     * Proactive token refresh
     */
    refreshSession: async () => {
      try {
        const response = await authService.refresh();
        const accessToken =
          response?.data?.accessToken || response?.data?.data?.accessToken;

        if (accessToken) {
          tokenManager.setAccessToken(accessToken);
          set({ isAuthenticated: true });
        }
        return response;
      } catch (err) {
        get().clearAuth();
        throw normalizeApiError(err);
      }
    },

        /**
     * Dedicated Vendor Logout
     * Wipes vendor credentials and local storage without affecting customer session
     */
    vendorLogout: async () => {
      set({ isLoading: true });
      try {
        await vendorService.logout();
      } catch {}
      vendorTokenManager.clearAccessToken();
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("buybox_vendor_user");
        } catch {}
      }
      const hasCustomer = Boolean(get().isCustomerAuthenticated && get().customerUser);
      set({
        vendorUser: null,
        isVendorAuthenticated: false,
        user: hasCustomer ? get().customerUser : null,
        isAuthenticated: hasCustomer,
        isLoading: false,
      });
    },

    /**
     * Dedicated Customer Logout
     * Wipes customer credentials and local storage without affecting vendor session
     */
    customerLogout: async () => {
      set({ isLoading: true });
      try {
        await authService.logout();
      } catch {}
      tokenManager.clearAccessToken();
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("buybox_customer_user");
          localStorage.removeItem("buybox_auth_user");
        } catch {}
      }
      try {
        useCheckoutStore.getState().resetCheckout();
      } catch {}
      const hasVendor = Boolean(get().isVendorAuthenticated && get().vendorUser);
      set({
        customerUser: null,
        customerProfile: null,
        isCustomerAuthenticated: false,
        user: hasVendor ? get().vendorUser : null,
        isAuthenticated: hasVendor,
        isLoading: false,
      });
    },

    /**
     * Context-aware logout
     */
    logout: async () => {
      const isVendorScope =
        (typeof window !== "undefined" && window.location?.pathname?.startsWith("/vendor")) ||
        get().user?.role === "vendor";

      if (isVendorScope) {
        await get().vendorLogout();
      } else {
        await get().customerLogout();
      }
    },

    /**
     * Clear all auth credentials and reset session state
     */
    clearAuth: () => {
      tokenManager.clearAccessToken();
      vendorTokenManager.clearAccessToken();
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("buybox_auth_user");
        } catch {
          // Ignore removal error
        }
      }
      try {
        useCheckoutStore.getState().resetCheckout();
      } catch {
        // Safe catch if checkout store is not ready
      }
      set({
        user: null,
        customerProfile: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    },

    /**
     * Update user details in store
     */
    setUser: (user) => {
      if (typeof window !== "undefined" && user) {
        try {
          localStorage.setItem("buybox_auth_user", JSON.stringify(user));
        } catch {
          // Ignore storage write failure
        }
      }
      set({ user });
    },

    /**
     * Update customer profile in store
     */
    setCustomerProfile: (customerProfile) => set({ customerProfile }),
  };
});

export default useAuthStore;
