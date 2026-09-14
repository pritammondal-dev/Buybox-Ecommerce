import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ApiError, normalizeApiError } from "../../src/lib/api/api-error.js";

describe("API Error Normalization Unit Tests", () => {
  test("instantiates ApiError with standard parameters", () => {
    const error = new ApiError({
      message: "Resource not found",
      status: 404,
      code: "NOT_FOUND",
      requestId: "req-123",
      details: { resource: "product" },
    });

    assert.equal(error.name, "ApiError");
    assert.equal(error.message, "Resource not found");
    assert.equal(error.status, 404);
    assert.equal(error.code, "NOT_FOUND");
    assert.equal(error.requestId, "req-123");
    assert.deepEqual(error.details, { resource: "product" });
    assert.equal(error.isNotFound, true);
    assert.equal(error.isAuthError, false);
  });

  test("normalizes Axios response error conforming to backend contract", () => {
    const mockAxiosError = {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          success: false,
          message: "Validation failed on fields",
          code: "VALIDATION_ERROR",
          requestId: "req-abc-999",
          errors: [{ field: "email", message: "Invalid email address" }],
        },
      },
    };

    const normalized = normalizeApiError(mockAxiosError);
    assert.equal(normalized instanceof ApiError, true);
    assert.equal(normalized.status, 400);
    assert.equal(normalized.code, "VALIDATION_ERROR");
    assert.equal(normalized.message, "Validation failed on fields");
    assert.equal(normalized.requestId, "req-abc-999");
    assert.equal(normalized.isValidationError, true);
    assert.equal(normalized.details.length, 1);
  });

  test("normalizes 401 authentication errors and flags isAuthError", () => {
    const mockAuthError = {
      response: {
        status: 401,
        data: {
          success: false,
          message: "Authentication token expired",
          code: "INVALID_ACCESS_TOKEN",
        },
      },
    };

    const normalized = normalizeApiError(mockAuthError);
    assert.equal(normalized.status, 401);
    assert.equal(normalized.isAuthError, true);
    assert.equal(normalized.isForbidden, false);
  });

  test("normalizes network connection timeout or failure", () => {
    const mockNetworkError = {
      isAxiosError: true,
      code: "ECONNABORTED",
      message: "timeout of 30000ms exceeded",
    };

    const normalized = normalizeApiError(mockNetworkError);
    assert.equal(normalized.status, 408);
    assert.equal(normalized.code, "REQUEST_TIMEOUT");
    assert.equal(normalized.isNetworkError, false);

    const mockOfflineError = {
      isAxiosError: true,
      code: "ERR_NETWORK",
      message: "Network Error",
    };

    const normalizedOffline = normalizeApiError(mockOfflineError);
    assert.equal(normalizedOffline.status, 0);
    assert.equal(normalizedOffline.code, "NETWORK_ERROR");
    assert.equal(normalizedOffline.isNetworkError, true);
  });

  test("returns existing ApiError unchanged if already normalized", () => {
    const original = new ApiError({ message: "Already an ApiError", status: 500 });
    const returned = normalizeApiError(original);
    assert.equal(original, returned);
  });
});
