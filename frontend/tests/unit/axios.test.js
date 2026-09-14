import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { apiClient, API_BASE_URL } from "../../src/lib/api/axios.js";
import { tokenManager } from "../../src/lib/auth/token-manager.js";

describe("Axios Configuration & Interceptor Unit Tests", () => {
  beforeEach(() => {
    tokenManager.clearAccessToken();
  });

  test("apiClient defaults to expected base URL and credentials", () => {
    assert.equal(apiClient.defaults.withCredentials, true);
    assert.equal(apiClient.defaults.headers["Content-Type"], "application/json");
    assert.equal(apiClient.defaults.headers["Accept"], "application/json");
    assert.ok(API_BASE_URL.includes("/api/v1"));
  });

  test("request interceptor attaches Bearer token when available", async () => {
    tokenManager.setAccessToken("test-token-xyz");

    // Retrieve the request interceptor handler from apiClient
    const requestInterceptor = apiClient.interceptors.request.handlers[0];
    assert.ok(requestInterceptor, "Request interceptor must be registered");

    const config = { headers: {} };
    const modifiedConfig = await requestInterceptor.fulfilled(config);

    assert.equal(modifiedConfig.headers.Authorization, "Bearer test-token-xyz");
  });

  test("request interceptor does not attach Bearer token when token is null", async () => {
    tokenManager.clearAccessToken();

    const requestInterceptor = apiClient.interceptors.request.handlers[0];
    const config = { headers: {} };
    const modifiedConfig = await requestInterceptor.fulfilled(config);

    assert.equal(modifiedConfig.headers.Authorization, undefined);
  });

  test("response interceptor unwraps success response data", async () => {
    const responseInterceptor = apiClient.interceptors.response.handlers[0];
    assert.ok(responseInterceptor, "Response interceptor must be registered");

    const mockResponse = {
      status: 200,
      data: {
        success: true,
        message: "Products fetched",
        data: { products: [] },
      },
    };

    const unwrapped = responseInterceptor.fulfilled(mockResponse);
    assert.deepEqual(unwrapped, mockResponse.data);
  });
});
