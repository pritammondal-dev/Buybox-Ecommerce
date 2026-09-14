import axios from "axios";
import { tokenManager } from "../auth/token-manager.js";
import { normalizeApiError } from "./api-error.js";

export const API_BASE_URL =
  typeof window !== "undefined"
    ? "/api/v1"
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

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

// Dedicated unintercepted client for token refresh to avoid interceptor recursion
const refreshClient = axios.create({
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
 * Automatically attaches in-memory access token when available.
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = tokenManager.getAccessToken();
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
 * - Transparently handles 401 errors with token rotation and concurrent queueing
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
      url.includes("/auth/verify-email");

    if (status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        // Queue concurrent requests while refresh is in flight
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
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
      isRefreshing = true;

      try {
        // Attempt refresh using httpOnly cookie (or empty body)
        const response = await refreshClient.post("/auth/refresh");
        const newAccessToken = response.data?.data?.accessToken;

        if (!newAccessToken) {
          throw new Error("No access token returned from refresh endpoint");
        }

        // Store new access token in memory
        tokenManager.setAccessToken(newAccessToken);

        // Resume queued requests
        processQueue(null, newAccessToken);

        // Retry original request with new access token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        isRefreshing = false;

        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed: clear auth and reject all queued requests
        tokenManager.clearAccessToken();
        const normalizedRefreshError = normalizeApiError(refreshError);
        processQueue(normalizedRefreshError, null);
        isRefreshing = false;

        return Promise.reject(normalizedRefreshError);
      }
    }

    return Promise.reject(normalizeApiError(error));
  }
);

export default apiClient;
