import axios from "axios";
import { adminTokenManager } from "../auth/admin-token-manager.js";
import { normalizeApiError } from "./api-error.js";

export const API_BASE_URL =
  typeof window !== "undefined"
    ? "/api/v1"
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

// Dedicated Axios instance for Administrator / Internal Portal requests
export const adminApiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 30000,
});

// Dedicated unintercepted client for administrator token refresh
const adminRefreshClient = axios.create({
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
 * Automatically attaches in-memory administrator access token when available.
 */
adminApiClient.interceptors.request.use(
  (config) => {
    const token = adminTokenManager.getAccessToken();
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
 * - Handles 401 errors with token rotation via /administrator/auth/refresh
 * - Normalizes all errors via ApiError
 */
adminApiClient.interceptors.response.use(
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

    const isAuthRoute =
      url.includes("/administrator/auth/login") ||
      url.includes("/administrator/auth/refresh") ||
      url.includes("/administrator/auth/logout");

    if (status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return adminApiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(normalizeApiError(err));
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await adminRefreshClient.post(
          "/administrator/auth/refresh"
        );
        const newAccessToken =
          response.data?.data?.accessToken ||
          response.data?.accessToken;

        if (!newAccessToken) {
          throw new Error("No access token returned from administrator refresh endpoint");
        }

        adminTokenManager.setAccessToken(newAccessToken);
        processQueue(null, newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        isRefreshing = false;

        return adminApiClient(originalRequest);
      } catch (refreshError) {
        adminTokenManager.clearAccessToken();
        const normalizedRefreshError = normalizeApiError(refreshError);
        processQueue(normalizedRefreshError, null);
        isRefreshing = false;

        return Promise.reject(normalizedRefreshError);
      }
    }

    return Promise.reject(normalizeApiError(error));
  }
);

export default adminApiClient;
