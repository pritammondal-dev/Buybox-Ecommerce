const errorMiddleware = require("../src/middlewares/error.middleware");
const AppError = require("../src/errors/AppError");

describe("Global Error Handler (Task 8A.2)", () => {
  let originalNodeEnv;

  beforeAll(() => {
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  const runMiddleware = (err, reqOverrides = {}) => {
    let statusCode = null;
    let responseBody = null;

    const req = {
      id: "test-request-id-12345",
      method: "GET",
      originalUrl: "/api/v1/test",
      ...reqOverrides,
    };

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      },
    };

    const next = jest.fn();

    errorMiddleware(err, req, res, next);

    return { statusCode, responseBody, next };
  };

  describe("1. Operational AppError Preservation", () => {
    it("A. should preserve status, code, and message for AppError 400", () => {
      const err = new AppError("Invalid search query", 400, "BAD_REQUEST");
      const { statusCode, responseBody } = runMiddleware(err);

      expect(statusCode).toBe(400);
      expect(responseBody).toEqual({
        success: false,
        message: "Invalid search query",
        code: "BAD_REQUEST",
        requestId: "test-request-id-12345",
      });
      expect(typeof responseBody.code).toBe("string");
    });

    it("B. should preserve status, code, and message for AppError 401", () => {
      const err = new AppError("Authentication required", 401, "AUTHENTICATION_REQUIRED");
      const { statusCode, responseBody } = runMiddleware(err);

      expect(statusCode).toBe(401);
      expect(responseBody).toEqual({
        success: false,
        message: "Authentication required",
        code: "AUTHENTICATION_REQUIRED",
        requestId: "test-request-id-12345",
      });
      expect(typeof responseBody.code).toBe("string");
    });

    it("C. should preserve status, code, and message for AppError 404", () => {
      const err = new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
      const { statusCode, responseBody } = runMiddleware(err);

      expect(statusCode).toBe(404);
      expect(responseBody).toEqual({
        success: false,
        message: "Vendor profile not found",
        code: "VENDOR_NOT_FOUND",
        requestId: "test-request-id-12345",
      });
      expect(typeof responseBody.code).toBe("string");
    });

    it("D. should preserve status, code, and message for AppError 409", () => {
      const err = new AppError("Coupon code has expired", 409, "COUPON_EXPIRED");
      const { statusCode, responseBody } = runMiddleware(err);

      expect(statusCode).toBe(409);
      expect(responseBody).toEqual({
        success: false,
        message: "Coupon code has expired",
        code: "COUPON_EXPIRED",
        requestId: "test-request-id-12345",
      });
      expect(typeof responseBody.code).toBe("string");
    });

    it("should preserve operational errors with status 502 (e.g. gateway errors)", () => {
      const err = new AppError("Unable to create Razorpay order", 502, "RAZORPAY_ORDER_CREATION_FAILED");
      const { statusCode, responseBody } = runMiddleware(err);

      expect(statusCode).toBe(502);
      expect(responseBody).toEqual({
        success: false,
        message: "Unable to create Razorpay order",
        code: "RAZORPAY_ORDER_CREATION_FAILED",
        requestId: "test-request-id-12345",
      });
    });
  });

  describe("2. Unexpected 500 Errors in Production vs Development", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("E. should return generic 500 and not expose internal message/details in production", () => {
      const dangerousMessage = "TypeError: Cannot read property 'secretToken' of undefined at /var/app/secret.js:42";
      const err = new TypeError(dangerousMessage);

      const { statusCode, responseBody } = runMiddleware(err);

      expect(statusCode).toBe(500);
      expect(responseBody).toEqual({
        success: false,
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
        requestId: "test-request-id-12345",
      });

      const serialized = JSON.stringify(responseBody);
      expect(serialized).not.toContain("secretToken");
      expect(serialized).not.toContain("secret.js");
      expect(serialized).not.toContain("TypeError");
    });

    it("F. should preserve debug message in development without breaking string code contract", () => {
      process.env.NODE_ENV = "development";

      const err = new TypeError("Cannot read properties of undefined (reading 'items')");
      const { statusCode, responseBody } = runMiddleware(err);

      expect(statusCode).toBe(500);
      expect(responseBody.code).toBe("INTERNAL_SERVER_ERROR");
      expect(typeof responseBody.code).toBe("string");
      expect(responseBody.message).toBe("Cannot read properties of undefined (reading 'items')");
      expect(responseBody.stack).toBeUndefined();
    });
  });

  describe("3. Database Error Mapping", () => {
    it("G. should map Mongoose CastError to 400 INVALID_RESOURCE_ID without exposing model or path", () => {
      const castErr = new Error('Cast to ObjectId failed for value "bad_id_123" (type string) at path "_id" for model "Order"');
      castErr.name = "CastError";
      castErr.path = "_id";
      castErr.value = "bad_id_123";
      castErr.model = "Order";

      const { statusCode, responseBody } = runMiddleware(castErr);

      expect(statusCode).toBe(400);
      expect(responseBody).toEqual({
        success: false,
        message: "Invalid resource identifier",
        code: "INVALID_RESOURCE_ID",
        requestId: "test-request-id-12345",
      });

      const serialized = JSON.stringify(responseBody);
      expect(serialized).not.toContain("bad_id_123");
      expect(serialized).not.toContain("Order");
      expect(serialized).not.toContain("_id");
      expect(serialized).not.toContain("Cast to ObjectId");
    });

    it("H. should map Mongoose ValidationError to 400 VALIDATION_ERROR safely without model prefix", () => {
      const valErr = new Error("Order validation failed: status: 'invalid_status' is not a valid enum value");
      valErr.name = "ValidationError";
      valErr.errors = {
        status: {
          message: "'invalid_status' is not a valid enum value",
          name: "ValidatorError",
          path: "status",
        },
      };

      const { statusCode, responseBody } = runMiddleware(valErr);

      expect(statusCode).toBe(400);
      expect(responseBody).toEqual({
        success: false,
        message: "'invalid_status' is not a valid enum value",
        code: "VALIDATION_ERROR",
        requestId: "test-request-id-12345",
      });

      const serialized = JSON.stringify(responseBody);
      expect(serialized).not.toContain("Order validation failed");
    });

    it("I. should map MongoDB duplicate key (E11000) to 409 RESOURCE_ALREADY_EXISTS with safe message", () => {
      const dupErr = new Error('E11000 duplicate key error collection: buybox.users index: email_1 dup key: { email: "victim@example.com" }');
      dupErr.code = 11000;
      dupErr.name = "MongoServerError";

      const { statusCode, responseBody } = runMiddleware(dupErr);

      expect(statusCode).toBe(409);
      expect(responseBody).toEqual({
        success: false,
        message: "A resource with this identifier already exists",
        code: "RESOURCE_ALREADY_EXISTS",
        requestId: "test-request-id-12345",
      });
      expect(typeof responseBody.code).toBe("string");
    });

    it("P. response never contains raw MongoDB duplicate-key message", () => {
      const dupErr = new Error('E11000 duplicate key error collection: buybox.products index: sku_1 dup key: { sku: "PROD-SECRET-123" }');
      dupErr.code = 11000;

      const { responseBody } = runMiddleware(dupErr);
      const serialized = JSON.stringify(responseBody);

      expect(serialized).not.toContain("E11000");
      expect(responseBody.message).not.toContain("E11000");
    });

    it("Q. response never contains model/collection/index details for mapped database errors", () => {
      const dupErr = new Error('E11000 duplicate key error collection: buybox.users index: email_1 dup key: { email: "admin@buybox.com" }');
      dupErr.code = 11000;

      const { responseBody } = runMiddleware(dupErr);
      const serialized = JSON.stringify(responseBody);

      expect(serialized).not.toContain("buybox.users");
      expect(serialized).not.toContain("email_1");
      expect(serialized).not.toContain("admin@buybox.com");
    });
  });

  describe("4. System and Driver Errors in Production", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("J. should sanitize ECONNREFUSED system error to generic 500 in production", () => {
      const sysErr = new Error("connect ECONNREFUSED 127.0.0.1:27017");
      sysErr.code = "ECONNREFUSED";

      const { statusCode, responseBody } = runMiddleware(sysErr);

      expect(statusCode).toBe(500);
      expect(responseBody).toEqual({
        success: false,
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
        requestId: "test-request-id-12345",
      });

      const serialized = JSON.stringify(responseBody);
      expect(serialized).not.toContain("ECONNREFUSED");
      expect(serialized).not.toContain("127.0.0.1");
      expect(serialized).not.toContain("27017");
    });

    it("K. should sanitize ENOENT system error to generic 500 in production", () => {
      const sysErr = new Error("ENOENT: no such file or directory, open 'C:\\secrets\\private.key'");
      sysErr.code = "ENOENT";

      const { statusCode, responseBody } = runMiddleware(sysErr);

      expect(statusCode).toBe(500);
      expect(responseBody).toEqual({
        success: false,
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
        requestId: "test-request-id-12345",
      });

      const serialized = JSON.stringify(responseBody);
      expect(serialized).not.toContain("ENOENT");
      expect(serialized).not.toContain("private.key");
    });

    it("L. numeric driver error code never reaches response.code", () => {
      const errWithNumericCode = new Error("Custom driver failure");
      errWithNumericCode.code = 12345;

      const { responseBody } = runMiddleware(errWithNumericCode);

      expect(typeof responseBody.code).toBe("string");
      expect(responseBody.code).toBe("INTERNAL_SERVER_ERROR");
      expect(responseBody.code).not.toBe(12345);
    });
  });

  describe("5. Non-Error Thrown Values & Edge Cases", () => {
    it("M. should safely handle thrown string without throwing and return safe 500", () => {
      process.env.NODE_ENV = "production";
      const { statusCode, responseBody } = runMiddleware("Database connection failed abruptly");

      expect(statusCode).toBe(500);
      expect(responseBody).toEqual({
        success: false,
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
        requestId: "test-request-id-12345",
      });
      expect(typeof responseBody.code).toBe("string");
    });

    it("N. should safely handle thrown null without throwing and return safe 500", () => {
      process.env.NODE_ENV = "production";
      const { statusCode, responseBody } = runMiddleware(null);

      expect(statusCode).toBe(500);
      expect(responseBody).toEqual({
        success: false,
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
        requestId: "test-request-id-12345",
      });
    });

    it("N2. should safely handle thrown undefined without throwing and return safe 500", () => {
      process.env.NODE_ENV = "production";
      const { statusCode, responseBody } = runMiddleware(undefined);

      expect(statusCode).toBe(500);
      expect(responseBody).toEqual({
        success: false,
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
        requestId: "test-request-id-12345",
      });
    });

    it("O. response never contains stack trace property", () => {
      const err = new Error("Something broke");
      const { responseBody } = runMiddleware(err);

      expect(responseBody.stack).toBeUndefined();
      expect(JSON.stringify(responseBody)).not.toContain("    at ");
    });

    it("R. requestId remains present where existing middleware behavior provides it", () => {
      const err = new AppError("Item not found", 404, "NOT_FOUND");
      const { responseBody } = runMiddleware(err, { id: "custom-corr-id-999" });

      expect(responseBody.requestId).toBe("custom-corr-id-999");
    });
  });
});
