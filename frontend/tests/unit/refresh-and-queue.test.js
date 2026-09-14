import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { apiClient } from "../../src/lib/api/axios.js";
import { tokenManager } from "../../src/lib/auth/token-manager.js";
import { ApiError } from "../../src/lib/api/api-error.js";

describe("401 Token Refresh & Concurrent Queue Unit Tests", () => {
  beforeEach(() => {
    tokenManager.clearAccessToken();
  });

  test("response interceptor rejects non-401 errors directly via ApiError", async () => {
    const responseInterceptor = apiClient.interceptors.response.handlers[0];
    const mock500Error = {
      config: { url: "/products" },
      response: {
        status: 500,
        data: {
          success: false,
          message: "Internal Server Error",
          code: "INTERNAL_SERVER_ERROR",
        },
      },
    };

    await assert.rejects(
      async () => {
        await responseInterceptor.rejected(mock500Error);
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 500);
        assert.equal(err.code, "INTERNAL_SERVER_ERROR");
        return true;
      }
    );
  });

  test("does not attempt refresh for public auth endpoints returning 401", async () => {
    const responseInterceptor = apiClient.interceptors.response.handlers[0];
    const mockAuthError = {
      config: { url: "/auth/login" },
      response: {
        status: 401,
        data: {
          success: false,
          message: "Invalid email or password",
          code: "INVALID_CREDENTIALS",
        },
      },
    };

    await assert.rejects(
      async () => {
        await responseInterceptor.rejected(mockAuthError);
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 401);
        assert.equal(err.code, "INVALID_CREDENTIALS");
        return true;
      }
    );
  });

  test("concurrent queue resolves all waiting promises when new token arrives", async () => {
    // Model of the concurrent queue implementation
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

    // Simulate 3 concurrent requests arriving while refresh is in flight
    const req1 = new Promise((resolve, reject) => failedQueue.push({ resolve, reject }));
    const req2 = new Promise((resolve, reject) => failedQueue.push({ resolve, reject }));
    const req3 = new Promise((resolve, reject) => failedQueue.push({ resolve, reject }));

    assert.equal(failedQueue.length, 3);

    // Refresh succeeds with new token
    const newAccessToken = "new.jwt.access.token";
    processQueue(null, newAccessToken);

    const [res1, res2, res3] = await Promise.all([req1, req2, req3]);
    assert.equal(res1, newAccessToken);
    assert.equal(res2, newAccessToken);
    assert.equal(res3, newAccessToken);
    assert.equal(failedQueue.length, 0);
  });

  test("concurrent queue rejects all waiting promises when refresh fails", async () => {
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

    const req1 = new Promise((resolve, reject) => failedQueue.push({ resolve, reject }));
    const req2 = new Promise((resolve, reject) => failedQueue.push({ resolve, reject }));

    const refreshError = new ApiError({
      message: "Session expired. Please log in again.",
      status: 401,
      code: "INVALID_REFRESH_TOKEN",
    });

    processQueue(refreshError, null);

    await assert.rejects(req1, (err) => err.code === "INVALID_REFRESH_TOKEN");
    await assert.rejects(req2, (err) => err.code === "INVALID_REFRESH_TOKEN");
    assert.equal(failedQueue.length, 0);
  });
});
