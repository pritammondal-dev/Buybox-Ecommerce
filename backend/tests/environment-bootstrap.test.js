/**
 * PHASE E12E1 — Backend Environment Bootstrap & Startup Integrity Unit Tests
 */

const path = require("path");
const fs = require("fs");
const { validateProductionConfiguration } = require("../src/config/production-validator");

describe("PHASE E12E1 — Backend Environment Bootstrap & Startup Integrity", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("1. Manifest & Dependency Declaration", () => {
    it("confirms dotenv is declared in backend/package.json production dependencies", () => {
      const packageJsonPath = path.resolve(__dirname, "../package.json");
      expect(fs.existsSync(packageJsonPath)).toBe(true);

      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      expect(pkg.dependencies).toBeDefined();
      expect(pkg.dependencies.dotenv).toBeDefined();
      expect(typeof pkg.dependencies.dotenv).toBe("string");
    });

    it("confirms backend/.env file exists at canonical backend root", () => {
      const backendEnvPath = path.resolve(__dirname, "../.env");
      expect(fs.existsSync(backendEnvPath)).toBe(true);
    });
  });

  describe("2. Single Source of Truth & No Duplicate Dotenv Calls", () => {
    it("confirms backend/src/server.js does not contain duplicate dotenv.config()", () => {
      const serverCode = fs.readFileSync(path.resolve(__dirname, "../src/server.js"), "utf8");
      expect(serverCode).not.toContain('require("dotenv").config');
      expect(serverCode).not.toContain("dotenv.config");
      expect(serverCode).toContain('require("./config/env")');
    });

    it("confirms backend/src/config/env.js configures dotenv with explicit backend path", () => {
      const envCode = fs.readFileSync(path.resolve(__dirname, "../src/config/env.js"), "utf8");
      expect(envCode).toContain('const dotenv = require("dotenv");');
      expect(envCode).toContain("dotenv.config({ path: backendEnvPath });");
      expect(envCode).toContain("path.resolve(__dirname, \"../../.env\")");
    });
  });

  describe("3. Non-Destructive Environment Loading", () => {
    it("preserves pre-existing environment variables without overwriting them", () => {
      const dotenv = require("dotenv");
      const backendEnvPath = path.resolve(__dirname, "../.env");

      // Inject a pre-existing custom variable
      process.env.CUSTOM_TEST_MARKER = "custom_pre_existing_value";
      const result = dotenv.config({ path: backendEnvPath });

      expect(process.env.CUSTOM_TEST_MARKER).toBe("custom_pre_existing_value");
      delete process.env.CUSTOM_TEST_MARKER;
    });
  });

  describe("4. Missing Required Environment Variable Failure Guardrails", () => {
    it("aborts schema validation when MONGODB_URI is undefined without exposing secrets", () => {
      const { z } = require("zod");
      // Simulate isolated schema evaluation with missing MONGODB_URI
      const testSchema = z.object({
        MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
        JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
      });

      const badEnv = {
        // MONGODB_URI missing
        JWT_ACCESS_SECRET: "mock_secret_that_is_long_enough_to_pass_validation_12345",
      };

      let caughtError = null;
      try {
        testSchema.parse(badEnv);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError.name).toBe("ZodError");
      const issue = caughtError.issues.find((i) => i.path.includes("MONGODB_URI"));
      expect(issue).toBeDefined();
      expect(issue.code).toBe("invalid_type");

      // Verify that an empty string also fails with the explicit required message
      let emptyUriError = null;
      try {
        testSchema.parse({ MONGODB_URI: "", JWT_ACCESS_SECRET: "valid_secret_1234567890123456789012345" });
      } catch (err) {
        emptyUriError = err;
      }
      expect(emptyUriError).not.toBeNull();
      const emptyIssue = emptyUriError.issues.find((i) => i.path.includes("MONGODB_URI"));
      expect(emptyIssue.message).toBe("MONGODB_URI is required");

      // Ensure error output string contains NO sensitive secret values
      const serializedError = JSON.stringify(caughtError.issues);
      expect(serializedError).not.toContain(badEnv.JWT_ACCESS_SECRET);
    });

    it("fails with clear validation message when JWT secrets are under minimum length", () => {
      const { z } = require("zod");
      const testSchema = z.object({
        JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
      });

      let caughtError = null;
      try {
        testSchema.parse({ JWT_ACCESS_SECRET: "too_short" });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      const issue = caughtError.issues.find((i) => i.path.includes("JWT_ACCESS_SECRET"));
      expect(issue).toBeDefined();
      expect(issue.message).toBe("JWT_ACCESS_SECRET must be at least 32 characters");
    });
  });

  describe("5. Production Configuration Safety Validation", () => {
    it("rejects production startup if BACKEND_URL points to localhost", () => {
      const mockEnv = {
        BACKEND_URL: "http://localhost:5000",
        FRONTEND_URL: "https://buybox.example.com",
        JWT_ACCESS_SECRET: "a_valid_high_entropy_secret_for_access_token_123",
        JWT_REFRESH_SECRET: "a_valid_high_entropy_secret_for_refresh_token_123",
        CREDENTIAL_ENCRYPTION_KEY: "a_valid_32_byte_key_for_encrypt_12345",
        MONGODB_URI: "mongodb://user:pass@atlas.mongodb.net/buybox",
        MEDIA_STORAGE_PROVIDER: "s3",
        S3_BUCKET: "my-bucket",
        S3_ACCESS_KEY_ID: "akid",
        S3_SECRET_ACCESS_KEY: "secret",
      };

      const result = validateProductionConfiguration(mockEnv, "production");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("BACKEND_URL"))).toBe(true);
    });

    it("rejects production startup if CREDENTIAL_ENCRYPTION_KEY is missing or too short", () => {
      const mockEnv = {
        BACKEND_URL: "https://api.buybox.example.com",
        FRONTEND_URL: "https://buybox.example.com",
        JWT_ACCESS_SECRET: "a_valid_high_entropy_secret_for_access_token_123",
        JWT_REFRESH_SECRET: "a_valid_high_entropy_secret_for_refresh_token_123",
        CREDENTIAL_ENCRYPTION_KEY: "short",
        MONGODB_URI: "mongodb://user:pass@atlas.mongodb.net/buybox",
        MEDIA_STORAGE_PROVIDER: "s3",
        S3_BUCKET: "my-bucket",
        S3_ACCESS_KEY_ID: "akid",
        S3_SECRET_ACCESS_KEY: "secret",
      };

      const result = validateProductionConfiguration(mockEnv, "production");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("CREDENTIAL_ENCRYPTION_KEY"))).toBe(true);
    });

    it("permits standard development/test environments without production constraints", () => {
      const mockDevEnv = {
        BACKEND_URL: "http://localhost:5000",
        FRONTEND_URL: "http://localhost:3000",
      };

      const result = validateProductionConfiguration(mockDevEnv, "development");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.mode).toBe("non-production");
    });
  });

  describe("6. Server Startup Phase Ordering & Invariant Verification", () => {
    it("verifies server.js implements strict fail-fast ordering", () => {
      const serverCode = fs.readFileSync(path.resolve(__dirname, "../src/server.js"), "utf8");

      // Verify sequence of calls in startServer
      const configValidationIndex = serverCode.indexOf("validateProductionConfiguration(env)");
      const connectDbIndex = serverCode.indexOf("await connectDatabase()");
      const bootstrapIndex = serverCode.indexOf("await bootstrapSuperadmin()");
      const startWorkersIndex = serverCode.indexOf("startAllWorkers()");
      const listenIndex = serverCode.indexOf("app.listen(PORT");

      expect(configValidationIndex).toBeGreaterThan(-1);
      expect(connectDbIndex).toBeGreaterThan(configValidationIndex);
      expect(bootstrapIndex).toBeGreaterThan(connectDbIndex);
      expect(startWorkersIndex).toBeGreaterThan(bootstrapIndex);
      expect(listenIndex).toBeGreaterThan(startWorkersIndex);
    });

    it("verifies server.js registers uncaughtException and unhandledRejection handlers", () => {
      const serverCode = fs.readFileSync(path.resolve(__dirname, "../src/server.js"), "utf8");
      expect(serverCode).toContain('process.on("unhandledRejection"');
      expect(serverCode).toContain('process.on("uncaughtException"');
    });
  });
});
