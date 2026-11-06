import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { adminCustomerService } from "../../src/services/admin/customer.service.js";
import { adminVendorService } from "../../src/services/admin/vendor.service.js";
import adminApiClient from "../../src/lib/api/admin-axios.js";
import { useAdminAuthStore } from "../../src/stores/admin-auth.store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "../../src");

describe("Phase SA-03: Superadmin Customer & Vendor Account Management Frontend Workflows", () => {
  describe("1. Customer API Client Contract & Lifecycle Methods", () => {
    test("adminCustomerService.list issues GET /admin/customers with query params", async () => {
      const originalGet = adminApiClient.get;
      let capturedUrl = null;
      let capturedConfig = null;

      adminApiClient.get = async (url, config) => {
        capturedUrl = url;
        capturedConfig = config;
        return {
          data: {
            success: true,
            data: {
              customers: [{ id: "cust_1", firstName: "Alice" }],
              pagination: { page: 1, limit: 20, total: 1 },
            },
          },
        };
      };

      try {
        const res = await adminCustomerService.list({ page: 1, limit: 20, isActive: "true" });
        assert.equal(capturedUrl, "/admin/customers");
        assert.deepEqual(capturedConfig, { params: { page: 1, limit: 20, isActive: "true" } });
        assert.equal(res.customers.length, 1);
      } finally {
        adminApiClient.get = originalGet;
      }
    });

    test("adminCustomerService.get issues GET /admin/customers/:id", async () => {
      const originalGet = adminApiClient.get;
      let capturedUrl = null;

      adminApiClient.get = async (url) => {
        capturedUrl = url;
        return {
          data: {
            success: true,
            data: {
              customer: { id: "cust_123", email: "alice@example.com" },
            },
          },
        };
      };

      try {
        const res = await adminCustomerService.get("cust_123");
        assert.equal(capturedUrl, "/admin/customers/cust_123");
        assert.equal(res.customer.email, "alice@example.com");
      } finally {
        adminApiClient.get = originalGet;
      }
    });

    test("adminCustomerService.update issues PATCH /admin/customers/:id with allowlisted fields and reason", async () => {
      const originalPatch = adminApiClient.patch;
      let capturedUrl = null;
      let capturedPayload = null;

      adminApiClient.patch = async (url, payload) => {
        capturedUrl = url;
        capturedPayload = payload;
        return {
          data: {
            success: true,
            data: { id: "cust_123", firstName: "AliceUpdated" },
          },
        };
      };

      try {
        const updateData = {
          firstName: "AliceUpdated",
          lastName: "Smith",
          phone: "+919876543210",
          isActive: true,
          reason: "Customer verified phone number via support ticket",
        };
        const res = await adminCustomerService.update("cust_123", updateData);
        assert.equal(capturedUrl, "/admin/customers/cust_123");
        assert.deepEqual(capturedPayload, updateData);
        assert.equal(res.firstName, "AliceUpdated");
      } finally {
        adminApiClient.patch = originalPatch;
      }
    });

    test("adminCustomerService.suspend issues POST /admin/customers/:id/suspend with mandatory reason", async () => {
      const originalPost = adminApiClient.post;
      let capturedUrl = null;
      let capturedPayload = null;

      adminApiClient.post = async (url, payload) => {
        capturedUrl = url;
        capturedPayload = payload;
        return {
          data: {
            success: true,
            message: "Customer account suspended successfully",
          },
        };
      };

      try {
        const reason = "Suspicious login attempts detected from unrecognized geographic region";
        const res = await adminCustomerService.suspend("cust_123", reason);
        assert.equal(capturedUrl, "/admin/customers/cust_123/suspend");
        assert.deepEqual(capturedPayload, { reason });
        assert.equal(res.success, true);
      } finally {
        adminApiClient.post = originalPost;
      }
    });

    test("adminCustomerService.reactivate issues POST /admin/customers/:id/reactivate with mandatory reason", async () => {
      const originalPost = adminApiClient.post;
      let capturedUrl = null;
      let capturedPayload = null;

      adminApiClient.post = async (url, payload) => {
        capturedUrl = url;
        capturedPayload = payload;
        return {
          data: {
            success: true,
            message: "Customer account reactivated successfully",
          },
        };
      };

      try {
        const reason = "Customer identity verified with KYC team successfully";
        const res = await adminCustomerService.reactivate("cust_123", reason);
        assert.equal(capturedUrl, "/admin/customers/cust_123/reactivate");
        assert.deepEqual(capturedPayload, { reason });
        assert.equal(res.success, true);
      } finally {
        adminApiClient.post = originalPost;
      }
    });

    test("adminCustomerService.resetPassword issues POST /admin/customers/:id/reset-password with password and reason", async () => {
      const originalPost = adminApiClient.post;
      let capturedUrl = null;
      let capturedPayload = null;

      adminApiClient.post = async (url, payload) => {
        capturedUrl = url;
        capturedPayload = payload;
        return {
          data: {
            success: true,
            message: "Customer account password reset successfully",
          },
        };
      };

      try {
        const newPassword = "NewSecurePassword123!";
        const reason = "Customer requested account recovery via phone support ticket";
        const res = await adminCustomerService.resetPassword("cust_123", newPassword, reason);
        assert.equal(capturedUrl, "/admin/customers/cust_123/reset-password");
        assert.deepEqual(capturedPayload, { newPassword, reason });
        assert.equal(res.success, true);
      } finally {
        adminApiClient.post = originalPost;
      }
    });

    test("adminCustomerService.delete issues DELETE /admin/customers/:id with body reason", async () => {
      const originalDelete = adminApiClient.delete;
      let capturedUrl = null;
      let capturedConfig = null;

      adminApiClient.delete = async (url, config) => {
        capturedUrl = url;
        capturedConfig = config;
        return {
          data: {
            success: true,
            message: "Customer account safely deactivated",
          },
        };
      };

      try {
        const reason = "Customer requested permanent account deactivation under platform privacy terms";
        const res = await adminCustomerService.delete("cust_123", reason);
        assert.equal(capturedUrl, "/admin/customers/cust_123");
        assert.deepEqual(capturedConfig, { data: { reason } });
        assert.equal(res.success, true);
      } finally {
        adminApiClient.delete = originalDelete;
      }
    });
  });

  describe("2. Vendor API Client Contract & Lifecycle Methods", () => {
    test("adminVendorService.suspendVendor issues POST /admin/vendors/:id/suspend with reason", async () => {
      const originalPost = adminApiClient.post;
      let capturedUrl = null;
      let capturedPayload = null;

      adminApiClient.post = async (url, payload) => {
        capturedUrl = url;
        capturedPayload = payload;
        return {
          data: {
            success: true,
            data: { vendor: { secureId: "ven_99", onboardingStatus: "suspended" } },
          },
        };
      };

      try {
        const reason = "Merchant failed recurring compliance audit and inventory check";
        const res = await adminVendorService.suspendVendor("ven_99", reason);
        assert.equal(capturedUrl, "/admin/vendors/ven_99/suspend");
        assert.deepEqual(capturedPayload, { reason });
        assert.equal(res.onboardingStatus, "suspended");
      } finally {
        adminApiClient.post = originalPost;
      }
    });

    test("adminVendorService.reactivateVendor issues POST /admin/vendors/:id/reactivate with reason", async () => {
      const originalPost = adminApiClient.post;
      let capturedUrl = null;
      let capturedPayload = null;

      adminApiClient.post = async (url, payload) => {
        capturedUrl = url;
        capturedPayload = payload;
        return {
          data: {
            success: true,
            data: { vendor: { secureId: "ven_99", onboardingStatus: "approved" } },
          },
        };
      };

      try {
        const reason = "Merchant provided verified documentation and paid pending settlement fees";
        const res = await adminVendorService.reactivateVendor("ven_99", reason);
        assert.equal(capturedUrl, "/admin/vendors/ven_99/reactivate");
        assert.deepEqual(capturedPayload, { reason });
        assert.equal(res.onboardingStatus, "approved");
      } finally {
        adminApiClient.post = originalPost;
      }
    });

    test("adminVendorService.resetVendorPassword issues POST /admin/vendors/:id/reset-password with password and reason", async () => {
      const originalPost = adminApiClient.post;
      let capturedUrl = null;
      let capturedPayload = null;

      adminApiClient.post = async (url, payload) => {
        capturedUrl = url;
        capturedPayload = payload;
        return {
          data: {
            success: true,
            message: "Vendor account password updated securely",
          },
        };
      };

      try {
        const newPassword = "VendorSecurePassword789!";
        const reason = "Merchant representative requested credential recovery via verified call";
        const res = await adminVendorService.resetVendorPassword("ven_99", newPassword, reason);
        assert.equal(capturedUrl, "/admin/vendors/ven_99/reset-password");
        assert.deepEqual(capturedPayload, { newPassword, reason });
        assert.equal(res.success, true);
      } finally {
        adminApiClient.post = originalPost;
      }
    });

    test("adminVendorService.deleteVendor issues DELETE /admin/vendors/:id with data reason", async () => {
      const originalDelete = adminApiClient.delete;
      let capturedUrl = null;
      let capturedConfig = null;

      adminApiClient.delete = async (url, config) => {
        capturedUrl = url;
        capturedConfig = config;
        return {
          data: {
            success: true,
            message: "Vendor account safely deactivated",
          },
        };
      };

      try {
        const reason = "Merchant voluntary partnership termination per signed contract agreement";
        const res = await adminVendorService.deleteVendor("ven_99", reason);
        assert.equal(capturedUrl, "/admin/vendors/ven_99");
        assert.deepEqual(capturedConfig, { data: { reason } });
        assert.equal(res.success, true);
      } finally {
        adminApiClient.delete = originalDelete;
      }
    });

    test("adminVendorService.updateVendor issues PATCH /admin/vendors/:id with payload including reason", async () => {
      const originalPatch = adminApiClient.patch;
      let capturedUrl = null;
      let capturedPayload = null;

      adminApiClient.patch = async (url, payload) => {
        capturedUrl = url;
        capturedPayload = payload;
        return {
          data: {
            success: true,
            data: { vendor: { secureId: "ven_99", businessName: "Acme Superstore" } },
          },
        };
      };

      try {
        const payload = {
          businessName: "Acme Superstore",
          commissionRate: 12.5,
          reason: "Approved commercial commission renegotiation for Q4 promotion",
        };
        const res = await adminVendorService.updateVendor("ven_99", payload);
        assert.equal(capturedUrl, "/admin/vendors/ven_99");
        assert.deepEqual(capturedPayload, payload);
        assert.equal(res.businessName, "Acme Superstore");
      } finally {
        adminApiClient.patch = originalPatch;
      }
    });
  });

  describe("3. Administrative Reason Validation Rules", () => {
    const validateReason = (reason) => {
      if (!reason || typeof reason !== "string") {
        return { valid: false, error: "Reason is required and must be a string." };
      }
      const trimmed = reason.trim();
      if (trimmed.length < 10) {
        return {
          valid: false,
          error: `Administrative reason must be at least 10 characters long (currently ${trimmed.length}).`,
        };
      }
      if (reason.length > 500) {
        return {
          valid: false,
          error: `Administrative reason cannot exceed 500 characters (currently ${reason.length}).`,
        };
      }
      return { valid: true, trimmed };
    };

    test("Rejects empty or whitespace-only reason strings", () => {
      assert.equal(validateReason("").valid, false);
      assert.equal(validateReason("   ").valid, false);
      assert.equal(validateReason(null).valid, false);
    });

    test("Rejects reasons under 10 characters after trimming", () => {
      const res = validateReason("Too short");
      assert.equal(res.valid, false);
      assert.match(res.error, /at least 10 characters/);

      const padded = validateReason("   short   ");
      assert.equal(padded.valid, false);
    });

    test("Accepts valid reason strings between 10 and 500 characters", () => {
      const validReason = "Customer reported compromised account; suspension requested immediately.";
      const res = validateReason(validReason);
      assert.equal(res.valid, true);
      assert.equal(res.trimmed, validReason);
    });

    test("Rejects reason strings exceeding 500 characters", () => {
      const longReason = "a".repeat(501);
      const res = validateReason(longReason);
      assert.equal(res.valid, false);
      assert.match(res.error, /cannot exceed 500 characters/);
    });
  });

  describe("4. Password Complexity Validation Rules", () => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

    test("Rejects passwords lacking complexity or under 8 chars", () => {
      assert.equal(passwordRegex.test("short1!"), false); // < 8 chars
      assert.equal(passwordRegex.test("alllowercase1!"), false); // no uppercase
      assert.equal(passwordRegex.test("ALLUPPERCASE1!"), false); // no lowercase
      assert.equal(passwordRegex.test("NoNumbersHere!"), false); // no digit
      assert.equal(passwordRegex.test("NoSpecialChar123"), false); // no special char
    });

    test("Accepts compliant passwords meeting all 5 security criteria", () => {
      assert.equal(passwordRegex.test("SecurePassword123!"), true);
      assert.equal(passwordRegex.test("P@ssw0rd2026#"), true);
      assert.equal(passwordRegex.test("BuyboxMerchant$99"), true);
    });
  });

  describe("5. Permission Aliasing and Role-Based Access Control", () => {
    test("Superadmin role bypasses permission checks unconditionally", () => {
      useAdminAuthStore.setState({
        user: { role: "SUPER_ADMIN", email: "superadmin@buybox.internal" },
        permissions: [],
        isAuthenticated: true,
      });

      const store = useAdminAuthStore.getState();
      assert.equal(store.hasPermission("customers.edit"), true);
      assert.equal(store.hasPermission("customers.suspend"), true);
      assert.equal(store.hasPermission("customers.reset_password"), true);
      assert.equal(store.hasPermission("customers.delete"), true);
      assert.equal(store.hasPermission("vendors.edit"), true);
      assert.equal(store.hasPermission("vendors.suspend"), true);
      assert.equal(store.hasPermission("vendors.approve"), true);
      assert.equal(store.hasPermission("vendors.reset_password"), true);
      assert.equal(store.hasPermission("vendors.delete"), true);
    });

    test("Admin with users:manage inherits granular customer permissions via alias mapping", () => {
      useAdminAuthStore.setState({
        user: { role: "STAFF", email: "support_lead@buybox.internal" },
        permissions: ["users:manage"],
        isAuthenticated: true,
      });

      const store = useAdminAuthStore.getState();
      assert.equal(store.hasPermission("customers.edit"), true);
      assert.equal(store.hasPermission("customers.suspend"), true);
      assert.equal(store.hasPermission("customers.reset_password"), true);
      assert.equal(store.hasPermission("customers.delete"), true);
      // But does not have vendor permissions
      assert.equal(store.hasPermission("vendors.delete"), false);
    });

    test("Admin with vendors:manage inherits granular vendor permissions via alias mapping", () => {
      useAdminAuthStore.setState({
        user: { role: "STAFF", email: "merchant_ops@buybox.internal" },
        permissions: ["vendors:manage"],
        isAuthenticated: true,
      });

      const store = useAdminAuthStore.getState();
      assert.equal(store.hasPermission("vendors.edit"), true);
      assert.equal(store.hasPermission("vendors.suspend"), true);
      assert.equal(store.hasPermission("vendors.approve"), true);
      assert.equal(store.hasPermission("vendors.reset_password"), true);
      assert.equal(store.hasPermission("vendors.delete"), true);
      // But does not have customer deletion permissions
      assert.equal(store.hasPermission("customers.delete"), false);
    });

    test("Unauthorized user with empty permissions is strictly rejected", () => {
      useAdminAuthStore.setState({
        user: { role: "VIEWER", email: "viewer@buybox.internal" },
        permissions: ["customers.view", "vendors.view"],
        isAuthenticated: true,
      });

      const store = useAdminAuthStore.getState();
      assert.equal(store.hasPermission("customers.view"), true);
      assert.equal(store.hasPermission("vendors.view"), true);
      assert.equal(store.hasPermission("customers.suspend"), false);
      assert.equal(store.hasPermission("customers.delete"), false);
      assert.equal(store.hasPermission("vendors.suspend"), false);
      assert.equal(store.hasPermission("vendors.delete"), false);
    });
  });

  describe("6. Frontend Component & Page File Structure Verification", () => {
    test("ReasonConfirmModal component exists and is properly structured", () => {
      const modalPath = path.join(srcDir, "components/admin/shared/ReasonConfirmModal.jsx");
      const exportPath = path.join(srcDir, "components/admin/ReasonConfirmModal.jsx");

      assert.ok(fs.existsSync(modalPath), "ReasonConfirmModal.jsx must exist in components/admin/shared");
      assert.ok(fs.existsSync(exportPath), "ReasonConfirmModal.jsx must be re-exported in components/admin");

      const content = fs.readFileSync(modalPath, "utf-8");
      assert.match(content, /ReasonConfirmModal/);
      assert.match(content, /minChars/);
      assert.match(content, /maxChars/);
      assert.match(content, /requireAcknowledgment/);
    });

    test("Customer directory and detail pages exist and integrate ReasonConfirmModal", () => {
      const listPage = path.join(srcDir, "app/administrator/customers/page.js");
      const detailPage = path.join(srcDir, "app/administrator/customers/[id]/page.js");

      assert.ok(fs.existsSync(listPage), "administrator/customers/page.js must exist");
      assert.ok(fs.existsSync(detailPage), "administrator/customers/[id]/page.js must exist");

      const listContent = fs.readFileSync(listPage, "utf-8");
      assert.match(listContent, /ReasonConfirmModal/);
      assert.match(listContent, /adminCustomerService\.suspend/);
      assert.match(listContent, /adminCustomerService\.reactivate/);
      assert.match(listContent, /Deactivated/);

      const detailContent = fs.readFileSync(detailPage, "utf-8");
      assert.match(detailContent, /ReasonConfirmModal/);
      assert.match(detailContent, /adminCustomerService\.update/);
      assert.match(detailContent, /adminCustomerService\.suspend/);
      assert.match(detailContent, /adminCustomerService\.reactivate/);
      assert.match(detailContent, /adminCustomerService\.resetPassword/);
      assert.match(detailContent, /adminCustomerService\.delete/);
      assert.match(detailContent, /Deactivated/);
    });

    test("Vendor directory and detail pages exist and integrate ReasonConfirmModal", () => {
      const listPage = path.join(srcDir, "app/administrator/vendors/page.js");
      const detailPage = path.join(srcDir, "app/administrator/vendors/[id]/page.js");

      assert.ok(fs.existsSync(listPage), "administrator/vendors/page.js must exist");
      assert.ok(fs.existsSync(detailPage), "administrator/vendors/[id]/page.js must exist");

      const listContent = fs.readFileSync(listPage, "utf-8");
      assert.match(listContent, /ReasonConfirmModal/);
      assert.match(listContent, /adminVendorService\.suspendVendor/);
      assert.match(listContent, /adminVendorService\.reactivateVendor/);

      const detailContent = fs.readFileSync(detailPage, "utf-8");
      assert.match(detailContent, /ReasonConfirmModal/);
      assert.match(detailContent, /adminVendorService\.updateVendor/);
      assert.match(detailContent, /adminVendorService\.suspendVendor/);
      assert.match(detailContent, /adminVendorService\.reactivateVendor/);
      assert.match(detailContent, /adminVendorService\.resetVendorPassword/);
      assert.match(detailContent, /adminVendorService\.deleteVendor/);
      assert.match(detailContent, /Deactivated/);
    });
  });

  describe("7. Phase SA-03B: Vendor Delete & Reset Password Actions Integration", () => {
    test("adminVendorService exports canonical aliases for resetPassword and delete", async () => {
      assert.equal(typeof adminVendorService.resetPassword, "function");
      assert.equal(typeof adminVendorService.delete, "function");
      assert.equal(typeof adminVendorService.suspend, "function");
      assert.equal(typeof adminVendorService.reactivate, "function");

      const originalPost = adminApiClient.post;
      const originalDelete = adminApiClient.delete;
      let postUrl = null;
      let deleteUrl = null;

      adminApiClient.post = async (url) => {
        postUrl = url;
        return { data: { success: true } };
      };
      adminApiClient.delete = async (url) => {
        deleteUrl = url;
        return { data: { success: true } };
      };

      try {
        await adminVendorService.resetPassword("ven_alias_1", "P@ssword123!", "Reason for password reset test");
        assert.equal(postUrl, "/admin/vendors/ven_alias_1/reset-password");

        await adminVendorService.delete("ven_alias_1", "Reason for account deactivation test");
        assert.equal(deleteUrl, "/admin/vendors/ven_alias_1");
      } finally {
        adminApiClient.post = originalPost;
        adminApiClient.delete = originalDelete;
      }
    });

    test("adminVendorService in admin.service.js provides full account lifecycle methods", async () => {
      const adminServicePath = path.join(srcDir, "services/admin/admin.service.js");
      assert.ok(fs.existsSync(adminServicePath));
      const content = fs.readFileSync(adminServicePath, "utf-8");
      assert.match(content, /resetPassword/);
      assert.match(content, /resetVendorPassword/);
      assert.match(content, /deleteVendor/);
      assert.match(content, /reactivateVendor/);
      assert.match(content, /\/admin\/vendors\/\$\{id\}\/reset-password/);
      assert.match(content, /\/admin\/vendors\/\$\{id\}/);
    });

    test("Password matching check rejects mismatched passwords before network call", () => {
      const validatePasswords = (newPass, confirmPass) => {
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
        if (!newPass || !passwordRegex.test(newPass)) {
          return { valid: false, error: "Password must be at least 8 characters long and contain uppercase, lowercase, digit, and symbol." };
        }
        if (newPass !== confirmPass) {
          return { valid: false, error: "New password and confirmation password do not match." };
        }
        return { valid: true };
      };

      assert.equal(validatePasswords("ValidPass123!", "MismatchPass456!").valid, false);
      assert.match(validatePasswords("ValidPass123!", "MismatchPass456!").error, /do not match/);
      assert.equal(validatePasswords("ValidPass123!", "ValidPass123!").valid, true);
    });

    test("Vendor directory page (vendors/page.js) integrates Reset Password and Deactivate actions", () => {
      const listPage = path.join(srcDir, "app/administrator/vendors/page.js");
      const listContent = fs.readFileSync(listPage, "utf-8");

      // Permission checks
      assert.match(listContent, /vendors\.reset_password/);
      assert.match(listContent, /vendors\.delete/);

      // Method invocations
      assert.match(listContent, /adminVendorService\.resetVendorPassword/);
      assert.match(listContent, /adminVendorService\.deleteVendor/);

      // UI elements
      assert.match(listContent, /Reset Merchant Password/);
      assert.match(listContent, /Soft-Deactivate Merchant Account/);
      assert.match(listContent, /confirmPassword/);
      assert.match(listContent, /Passwords do not match/);
      assert.match(listContent, /requireAcknowledgment=\{true\}/);
    });

    test("Vendor detail page (vendors/[id]/page.js) exposes Reset Password without linkedUserId dependency", () => {
      const detailPage = path.join(srcDir, "app/administrator/vendors/[id]/page.js");
      const detailContent = fs.readFileSync(detailPage, "utf-8");

      // Verify Reset Password does not have linkedUserId in its button guard
      assert.doesNotMatch(
        detailContent,
        /canResetPassword\s*&&\s*linkedUserId/,
        "Reset Password button guard must not depend on linkedUserId"
      );

      // Verify confirmation password field is present
      assert.match(detailContent, /confirmPassword/);
      assert.match(detailContent, /Confirm New Password/);
      assert.match(detailContent, /Passwords do not match/);

      // Verify soft-deactivation modal and acknowledgment
      assert.match(detailContent, /Soft-Deactivate Merchant Account/);
      assert.match(detailContent, /requireAcknowledgment=\{true\}/);
      assert.match(detailContent, /Merchant Account Safely Soft-Deactivated/);
    });
  });
});

