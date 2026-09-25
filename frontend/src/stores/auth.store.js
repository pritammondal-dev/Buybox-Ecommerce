import { create } from "zustand";
import { tokenManager } from "../lib/auth/token-manager.js";
import { authService } from "../services/auth.service.js";
import { customerService } from "../services/customer.service.js";
import { vendorService } from "../services/vendor.service.js";
import { normalizeApiError } from "../lib/api/api-error.js";

/**
 * Zustand Authentication Store
 *
 * Manages frontend session state, reactive user information, and initialization.
 * The backend remains strictly authoritative for roles, permissions, and session validity.
 */
export const useAuthStore = create((set, get) => {
  // Synchronize when tokenManager clears the access token (e.g., failed refresh in Axios)
  tokenManager.subscribe((newToken) => {
    if (!newToken && get().isAuthenticated) {
      set({
        isAuthenticated: false,
        user: null,
        customerProfile: null,
      });
    }
  });

  return {
    user: null,
    customerProfile: null,
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
     * Vendor login with email and password via dedicated vendor auth endpoint
     */
    vendorLogin: async ({ email, password }) => {
      set({ isLoading: true, error: null });

      try {
        const response = await vendorService.login({ email, password });
        const data = response?.data || response;
        const user = data?.user || null;
        const accessToken = data?.accessToken || null;

        if (accessToken) {
          tokenManager.setAccessToken(accessToken);
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
     * Logout current session
     */
    logout: async () => {
      set({ isLoading: true });

      try {
        await authService.logout();
      } catch {
        // Proceed with client cleanup even if network fails
      } finally {
        get().clearAuth();
        set({ isLoading: false });
      }
    },

    /**
     * Clear all auth credentials and reset session state
     */
    clearAuth: () => {
      tokenManager.clearAccessToken();
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("buybox_auth_user");
        } catch {
          // Ignore removal error
        }
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
