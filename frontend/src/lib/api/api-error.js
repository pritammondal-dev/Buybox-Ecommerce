/**
 * Normalized API Error Class and Factory
 *
 * Normalizes backend error responses conforming to:
 * { "success": false, "message": string, "code": string, "requestId"?: string }
 */

export class ApiError extends Error {
  constructor({
    message = "An unexpected error occurred",
    status = 500,
    code = "UNKNOWN_ERROR",
    requestId = null,
    details = null,
    rawError = null,
  } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
    this.rawError = rawError;

    // Maintains proper stack trace for where our error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  get isAuthError() {
    return this.status === 401 || this.code === "AUTHENTICATION_REQUIRED" || this.code === "INVALID_ACCESS_TOKEN";
  }

  get isForbidden() {
    return this.status === 403 || this.code === "INSUFFICIENT_ROLE" || this.code === "INSUFFICIENT_PERMISSIONS";
  }

  get isNotFound() {
    return this.status === 404 || this.code === "NOT_FOUND" || this.code === "ROUTE_NOT_FOUND";
  }

  get isValidationError() {
    return this.status === 400 && this.code === "VALIDATION_ERROR";
  }

  get isConflict() {
    return this.status === 409 || this.code === "RESOURCE_ALREADY_EXISTS";
  }

  get isNetworkError() {
    return this.status === 0 || this.code === "NETWORK_ERROR";
  }
}

/**
 * Normalizes any caught error (AxiosError, NetworkError, standard Error)
 * into an instance of ApiError.
 */
export function normalizeApiError(error) {
  if (error instanceof ApiError) {
    return error;
  }

  // Axios error with response from backend
  if (error && error.response) {
    const data = error.response.data;
    const status = error.response.status;

    const message =
      typeof data?.message === "string" && data.message.trim()
        ? data.message
        : `Request failed with status code ${status}`;

    const code =
      typeof data?.code === "string" && data.code.trim()
        ? data.code
        : status >= 500
        ? "INTERNAL_SERVER_ERROR"
        : "APPLICATION_ERROR";

    const requestId =
      data?.requestId ||
      error.response.headers?.["x-request-id"] ||
      null;

    return new ApiError({
      message,
      status,
      code,
      requestId,
      details: data?.data || data?.errors || null,
      rawError: error,
    });
  }

  // Axios error without server response (Network down, CORS error, Timeout)
  if (error && error.isAxiosError && !error.response) {
    const isTimeout =
      error.code === "ECONNABORTED" ||
      (typeof error.message === "string" && error.message.toLowerCase().includes("timeout"));

    return new ApiError({
      message: isTimeout
        ? "Request timed out. Please check your internet connection."
        : "Unable to connect to the server. Please check your internet connection.",
      status: isTimeout ? 408 : 0,
      code: isTimeout ? "REQUEST_TIMEOUT" : "NETWORK_ERROR",
      requestId: null,
      rawError: error,
    });
  }

  // Standard or unknown JavaScript Error
  return new ApiError({
    message: error?.message || "An unexpected error occurred",
    status: 500,
    code: "UNEXPECTED_ERROR",
    rawError: error,
  });
}

export default ApiError;
