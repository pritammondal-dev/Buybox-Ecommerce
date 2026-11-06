import axios from "axios";
import { tokenManager } from "../auth/token-manager.js";
import { adminTokenManager } from "../auth/admin-token-manager.js";
import { vendorTokenManager } from "../auth/vendor-token-manager.js";
import { normalizeApiError } from "./api-error.js";
import { getApiBaseUrl } from "../config/api-config.js";

export const API_BASE_URL = getApiBaseUrl();

// Primary Axios instance for application requests
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 30000,
});

// Dedicated unintercepted client for customer token refresh
const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 15000,
});

// Dedicated unintercepted client for vendor token refresh
const vendorRefreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 15000,
});

// Dedicated queue state for customer token refresh
let isCustomerRefreshing = false;
let customerFailedQueue = [];

const processCustomerQueue = (error, token = null) => {
  customerFailedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  customerFailedQueue = [];
};

// Dedicated queue state for vendor token refresh
let isVendorRefreshing = false;
let vendorFailedQueue = [];

const processVendorQueue = (error, token = null) => {
  vendorFailedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  vendorFailedQueue = [];
};

// Backward-compatible query helper for refresh states
export const getQueueState = () => ({
  isCustomerRefreshing,
  customerQueueLength: customerFailedQueue.length,
  isVendorRefreshing,
  vendorQueueLength: vendorFailedQueue.length,
});

/**
 * Helper to identify vendor-scoped routes
 */
export const isVendorRoute = (url) => {
  if (!url || typeof url !== "string") return false;
  return (
    url.startsWith("/vendors/") ||
    url.startsWith("/vendor/") ||
    url.startsWith("/shipments/vendor") ||
    url.startsWith("/orders/vendor") ||
    url.startsWith("/products/vendor") ||
    url.startsWith("/inventory/vendor") ||
    url.startsWith("/warehouses/vendor") ||
    url.startsWith("/categories/vendor") ||
    url.startsWith("/analytics/vendor") ||
    url.startsWith("/reviews/vendor") ||
    url.startsWith("/questions/vendor") ||
    url.startsWith("/fulfillment-exceptions/vendor") ||
    url.includes("/vendor-response")
  );
};

/**
 * Explicit Authentication Context Resolution
 * Evaluates in priority order:
 * 1. Explicit config.authContext ('vendor' | 'customer' | 'admin' | 'superadmin')
 * 2. Explicit 'X-Auth-Context' header
 * 3. Specific vendor or admin route patterns
 * 4. Active browser pathname fallback (/vendor/... or /admin/...) for generic endpoints
 * 5. Default context: 'customer'
 */
export const resolveAuthContext = (config = {}) => {
  if (config.authContext) {
    return String(config.authContext).toLowerCase();
  }

  const headerContext =
    config.headers?.["X-Auth-Context"] ||
    config.headers?.["x-auth-context"];
  if (headerContext) {
    return String(headerContext).toLowerCase();
  }

  const url = config.url || "";
  if (isVendorRoute(url)) {
    return "vendor";
  }

  if (url.startsWith("/admin/") || url.startsWith("/superadmin/")) {
    return "admin";
  }

  // Active browser URL fallback for generic endpoints (e.g., /notifications, /support-tickets)
  // called while navigating within the vendor console
  if (typeof window !== "undefined" && window.location?.pathname?.startsWith("/vendor")) {
    const isCustomerExplicitRoute =
      url.startsWith("/cart") ||
      url.startsWith("/checkout") ||
      url.startsWith("/customers/me");
    if (!isCustomerExplicitRoute) {
      return "vendor";
    }
  }

  return "customer";
};

/**
 * Request Interceptor
 * Automatically attaches in-memory access token based on explicit execution context:
 * - Vendor context: attaches vendor token (falls back to staff override).
 * - Customer context: attaches customer token (falls back to admin token if available).
 * - Admin context: attaches admin token.
 * Strictly prevents cross-context token contamination.
 */
apiClient.interceptors.request.use(
  (config) => {
    const context = resolveAuthContext(config);
    config.authContext = context;

    let token = null;
    if (context === "vendor") {
      token = vendorTokenManager.getAccessToken() || adminTokenManager.getAccessToken();
    } else if (context === "admin" || context === "superadmin") {
      token = adminTokenManager.getAccessToken();
    } else {
      token = tokenManager.getAccessToken() || adminTokenManager.getAccessToken();
    }

    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      if (config.headers) {
        delete config.headers["Content-Type"];
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(normalizeApiError(error));
  }
);

/**
 * Response Interceptor
 * - Unwraps success data
 * - Context-aware 401 token refresh queueing:
 *   - Vendor endpoints rotate using bb_vendor_session via /vendor/auth/refresh
 *   - Customer endpoints rotate using bb_customer_session via /auth/refresh
 * - Independent refresh concurrency queues preventing cross-token corruption
 * - Normalizes all errors via ApiError
 */
apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(normalizeApiError(error));
    }

    const status = error.response?.status;
    const url = originalRequest.url || "";

    // Auth endpoints that should NOT trigger automatic token refresh
    const isAuthRoute =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/forgot-password") ||
      url.includes("/auth/reset-password") ||
      url.includes("/auth/verify-email") ||
      url.includes("/vendor/auth/login") ||
      url.includes("/vendor/auth/refresh") ||
      url.includes("/vendor/auth/logout");

    if (status === 401 && !originalRequest._retry && !isAuthRoute) {
      const context = resolveAuthContext(originalRequest);
      const isVendorReq = context === "vendor";

      if (isVendorReq) {
        if (isVendorRefreshing) {
          // Queue concurrent vendor requests while vendor refresh is in flight
          return new Promise((resolve, reject) => {
            vendorFailedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return apiClient(originalRequest);
            })
            .catch((err) => {
              return Promise.reject(normalizeApiError(err));
            });
        }

        originalRequest._retry = true;
        isVendorRefreshing = true;

        try {
          const response = await vendorRefreshClient.post("/vendor/auth/refresh");
          const newAccessToken =
            response.data?.data?.accessToken ||
            response.data?.accessToken;

          if (!newAccessToken) {
            throw new Error("No access token returned from vendor refresh endpoint");
          }

          vendorTokenManager.setAccessToken(newAccessToken);
          processVendorQueue(null, newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          isVendorRefreshing = false;

          return apiClient(originalRequest);
        } catch (refreshError) {
          vendorTokenManager.clearAccessToken();
          const normalizedRefreshError = normalizeApiError(refreshError);
          processVendorQueue(normalizedRefreshError, null);
          isVendorRefreshing = false;

          return Promise.reject(normalizedRefreshError);
        }
      } else {
        // Customer 401 handling
        if (isCustomerRefreshing) {
          // Queue concurrent customer requests while customer refresh is in flight
          return new Promise((resolve, reject) => {
            customerFailedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return apiClient(originalRequest);
            })
            .catch((err) => {
              return Promise.reject(normalizeApiError(err));
            });
        }

        originalRequest._retry = true;
        isCustomerRefreshing = true;

        try {
          const response = await refreshClient.post("/auth/refresh");
          const newAccessToken =
            response.data?.data?.accessToken ||
            response.data?.accessToken;

          if (!newAccessToken) {
            throw new Error("No access token returned from refresh endpoint");
          }

          tokenManager.setAccessToken(newAccessToken);
          processCustomerQueue(null, newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          isCustomerRefreshing = false;

          return apiClient(originalRequest);
        } catch (refreshError) {
          tokenManager.clearAccessToken();
          const normalizedRefreshError = normalizeApiError(refreshError);
          processCustomerQueue(normalizedRefreshError, null);
          isCustomerRefreshing = false;

          return Promise.reject(normalizedRefreshError);
        }
      }
    }

    return Promise.reject(normalizeApiError(error));
  }
);

export default apiClient;
