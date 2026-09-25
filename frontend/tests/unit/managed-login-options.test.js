import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { adminAuthPolicyService } from "../../src/services/admin/admin.service.js";
import { authService } from "../../src/services/auth.service.js";
import apiClient from "../../src/lib/api/axios.js";
import adminApiClient from "../../src/lib/api/admin-axios.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "../../src");

describe("Frontend Managed Login Options Service & Route Contract Tests", () => {
  test("authService.getLoginMethods issues GET /auth/login-methods", async () => {
    const originalGet = apiClient.get;
    let capturedUrl = null;

    apiClient.get = async (url) => {
      capturedUrl = url;
      return {
        data: {
          success: true,
          data: {
            methods: {
              emailPassword: true,
              emailOtp: false,
              mobileOtp: false,
              google: true,
            },
            registration: {
              enabled: true,
              requireEmailVerification: true,
              requirePhoneVerification: false,
            },
          },
        },
      };
    };

    try {
      const res = await authService.getLoginMethods();
      assert.equal(capturedUrl, "/auth/login-methods");
      assert.equal(res.methods.emailPassword, true);
      assert.equal(res.methods.google, true);
      assert.equal(res.methods.emailOtp, false);
      assert.equal(res.methods.mobileOtp, false);
    } finally {
      apiClient.get = originalGet;
    }
  });

  test("adminAuthPolicyService.getLoginMethods issues GET /admin/authentication/login-methods", async () => {
    const originalGet = adminApiClient.get;
    let capturedUrl = null;

    adminApiClient.get = async (url) => {
      capturedUrl = url;
      return {
        data: {
          success: true,
          data: {
            policy: {
              customerLogin: {
                emailPassword: { enabled: true, systemStatus: "READY", effectiveEnabled: true },
                emailOtp: { enabled: false, systemStatus: "NOT_READY", effectiveEnabled: false },
                mobileOtp: { enabled: false, systemStatus: "NOT_CONFIGURED", effectiveEnabled: false },
                google: { enabled: true, systemStatus: "READY", effectiveEnabled: true },
              },
            },
          },
        },
      };
    };

    try {
      const res = await adminAuthPolicyService.getLoginMethods();
      assert.equal(capturedUrl, "/admin/authentication/login-methods");
      assert.ok(res.policy.customerLogin.emailPassword);
      assert.equal(res.policy.customerLogin.emailPassword.effectiveEnabled, true);
    } finally {
      adminApiClient.get = originalGet;
    }
  });

  test("adminAuthPolicyService.updateLoginMethods issues PATCH /admin/authentication/login-methods with sanitized payload", async () => {
    const originalPatch = adminApiClient.patch;
    let capturedUrl = null;
    let capturedPayload = null;

    adminApiClient.patch = async (url, data) => {
      capturedUrl = url;
      capturedPayload = data;
      return {
        data: {
          success: true,
          message: "Customer login options updated successfully",
          data: {
            policy: {
              customerLogin: {
                emailPassword: { enabled: true, systemStatus: "READY", effectiveEnabled: true },
                google: { enabled: false, systemStatus: "READY", effectiveEnabled: false },
              },
            },
          },
        },
      };
    };

    try {
      const updateData = { emailPassword: true, google: false };
      const res = await adminAuthPolicyService.updateLoginMethods(updateData);
      assert.equal(capturedUrl, "/admin/authentication/login-methods");
      assert.deepEqual(capturedPayload, { emailPassword: true, google: false });
      assert.ok(res.policy);
    } finally {
      adminApiClient.patch = originalPatch;
    }
  });

  test("Admin Authentication Settings route files exist in correct locations", () => {
    const administratorSettingsPage = path.join(srcDir, "app/administrator/settings/authentication/page.js");
    const adminSettingsPage = path.join(srcDir, "app/admin/settings/authentication/page.js");

    assert.ok(fs.existsSync(administratorSettingsPage), "administrator/settings/authentication/page.js must exist");
    assert.ok(fs.existsSync(adminSettingsPage), "admin/settings/authentication/page.js alias must exist");
  });
});
