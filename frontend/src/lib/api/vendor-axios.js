import axios from "axios";
import { vendorTokenManager } from "../auth/vendor-token-manager.js";
import { adminTokenManager } from "../auth/admin-token-manager.js";
import { normalizeApiError } from "./api-error.js";
import { getApiBaseUrl } from "../config/api-config.js";

export const API_BASE_URL = getApiBaseUrl();

// Dedicated Axios instance for Merchant Console / Vendor Portal requests
export const vendorApiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 30000,
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

// Queue state for handling concurrent 401 requests safely
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Request Interceptor
 * Automatically attaches in-memory vendor access token when available.
 * Falls back to admin token if an internal staff member is operating on vendor resources.
 * STRICTLY ignores customer tokens to prevent cross-context authorization faults.
 */
vendorApiClient.interceptors.request.use(
  (config) => {
    const token = vendorTokenManager.getAccessToken() || adminTokenManager.getAccessToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
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
 * - Transparently handles 401 errors with vendor token rotation via /vendor/auth/refresh
 * - Normalizes all errors via ApiError
 */
vendorApiClient.interceptors.response.use(
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
      url.includes("/vendor/auth/login") ||
      url.includes("/vendor/auth/refresh") ||
      url.includes("/vendor/auth/logout");

    if (status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        // Queue concurrent requests while refresh is in flight
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return vendorApiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(normalizeApiError(err));
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt refresh using vendor-specific httpOnly cookie (bb_vendor_session)
        const response = await vendorRefreshClient.post("/vendor/auth/refresh");
        const newAccessToken =
          response.data?.data?.accessToken ||
          response.data?.accessToken;

        if (!newAccessToken) {
          throw new Error("No access token returned from vendor refresh endpoint");
        }

        // Store new access token in dedicated vendor token manager
        vendorTokenManager.setAccessToken(newAccessToken);

        // Resume queued requests
        processQueue(null, newAccessToken);

        // Retry original request with new access token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        isRefreshing = false;

        return vendorApiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed: clear vendor auth and reject all queued requests
        vendorTokenManager.clearAccessToken();
        const normalizedRefreshError = normalizeApiError(refreshError);
        processQueue(normalizedRefreshError, null);
        isRefreshing = false;

        return Promise.reject(normalizedRefreshError);
      }
    }

    return Promise.reject(normalizeApiError(error));
  }
);

export default vendorApiClient;

