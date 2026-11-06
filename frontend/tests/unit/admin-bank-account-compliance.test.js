import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { adminBankAccountService } from "../../src/services/admin/bank-account.service.js";
import { adminVendorService } from "../../src/services/admin/vendor.service.js";
import apiClient from "../../src/lib/api/admin-axios.js";
import { useAdminAuthStore } from "../../src/stores/admin-auth.store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "../../src");

describe("Phase VB-04: Superadmin Bank Account Reviewer & Compliance Console", () => {
  // --------------------------------------------------------------------------
  // 1. Reviewer Queue & Compliance API Contracts
  // --------------------------------------------------------------------------
  describe("1. Reviewer Queue API Client Contracts", () => {
    test("adminBankAccountService.listApplications issues GET /admin/vendors/bank-accounts/applications with query params", async () => {
      const originalGet = apiClient.get;
      let capturedUrl = null;
      let capturedConfig = null;

      apiClient.get = async (url, config) => {
        capturedUrl = url;
        capturedConfig = config;
        return {
          data: {
            success: true,
            data: {
              items: [
                {
                  id: "vba_app_1",
                  bankName: "HDFC Bank",
                  accountNumberMasked: "••••••••••••5678",
                  ifscCode: "HDFC0001234",
                  accountHolderName: "Acme Enterprises",
                  accountType: "current",
                  status: "pending",
                  submittedAt: new Date().toISOString(),
                },
              ],
              meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
            },
          },
        };
      };

      try {
        const res = await adminBankAccountService.listApplications({
          page: 1,
          limit: 20,
          status: "pending",
          search: "HDFC",
        });

        assert.equal(capturedUrl, "/admin/vendors/bank-accounts/applications");
        assert.deepEqual(capturedConfig, {
          params: { page: 1, limit: 20, status: "pending", search: "HDFC" },
        });
        assert.equal(res.items.length, 1);
        assert.equal(res.items[0].bankName, "HDFC Bank");
      } finally {
        apiClient.get = originalGet;
      }
    });

    test("adminBankAccountService.approveApplication issues POST /admin/vendors/bank-accounts/:id/approve", async () => {
      const originalPost = apiClient.post;
      let capturedUrl = null;
      let capturedBody = null;

      apiClient.post = async (url, body) => {
        capturedUrl = url;
        capturedBody = body;
        return {
          data: {
            success: true,
            message: "Bank account application approved successfully",
            data: {
              account: {
                id: "vba_app_1",
                status: "approved",
                isActive: true,
              },
            },
          },
        };
      };

      try {
        const res = await adminBankAccountService.approveApplication(
          "vba_app_1",
          "Verified against GST certificate and passbook"
        );

        assert.equal(capturedUrl, "/admin/vendors/bank-accounts/vba_app_1/approve");
        assert.equal(capturedBody.reason, "Verified against GST certificate and passbook");
        assert.equal(res.account.status, "approved");
      } finally {
        apiClient.post = originalPost;
      }
    });

    test("adminBankAccountService.rejectApplication issues POST /admin/vendors/bank-accounts/:id/reject with mandatory reason", async () => {
      const originalPost = apiClient.post;
      let capturedUrl = null;
      let capturedBody = null;

      apiClient.post = async (url, body) => {
        capturedUrl = url;
        capturedBody = body;
        return {
          data: {
            success: true,
            message: "Bank account application rejected",
            data: {
              account: {
                id: "vba_app_2",
                status: "rejected",
                rejectionReason: body.reason,
              },
            },
          },
        };
      };

      try {
        const rejectionReason = "IFSC code does not match the provided bank branch name";
        const res = await adminBankAccountService.rejectApplication("vba_app_2", rejectionReason);

        assert.equal(capturedUrl, "/admin/vendors/bank-accounts/vba_app_2/reject");
        assert.equal(capturedBody.reason, rejectionReason);
        assert.equal(res.account.status, "rejected");
      } finally {
        apiClient.post = originalPost;
      }
    });

    test("adminBankAccountService.markUnderReview issues POST /admin/vendors/bank-accounts/:id/under-review", async () => {
      const originalPost = apiClient.post;
      let capturedUrl = null;

      apiClient.post = async (url) => {
        capturedUrl = url;
        return {
          data: {
            success: true,
            message: "Application marked as under review",
            data: { account: { id: "vba_app_3", status: "under_review" } },
          },
        };
      };

      try {
        const res = await adminBankAccountService.markUnderReview("vba_app_3");
        assert.equal(capturedUrl, "/admin/vendors/bank-accounts/vba_app_3/under-review");
        assert.equal(res.account.status, "under_review");
      } finally {
        apiClient.post = originalPost;
      }
    });

    test("adminBankAccountService.unmaskAccountNumber issues POST to privileged unmask endpoint with reason", async () => {
      const originalPost = apiClient.post;
      let capturedUrl = null;
      let capturedBody = null;

      apiClient.post = async (url, body) => {
        capturedUrl = url;
        capturedBody = body;
        return {
          data: {
            success: true,
            data: {
              bankAccountId: "vba_app_4",
              vendorId: "v_123",
              accountNumber: "12345678901234",
              accountNumberMasked: "••••••••••••1234",
            },
          },
        };
      };

      try {
        const reason = "Auditor conducting fraud investigation for refund batch";
        const res = await adminBankAccountService.unmaskAccountNumber("vba_app_4", reason, "v_123");

        assert.equal(capturedUrl, "/admin/vendors/v_123/bank-accounts/vba_app_4/unmask");
        assert.equal(capturedBody.reason, reason);
        assert.equal(res.accountNumber, "12345678901234");
      } finally {
        apiClient.post = originalPost;
      }
    });
  });

  // --------------------------------------------------------------------------
  // 2. Per-Vendor Bank Account Management Contracts
  // --------------------------------------------------------------------------
  describe("2. Superadmin Per-Vendor Bank Management Contracts", () => {
    test("adminBankAccountService.getVendorBankAccounts issues GET /admin/vendors/:id/bank-accounts", async () => {
      const originalGet = apiClient.get;
      let capturedUrl = null;

      apiClient.get = async (url) => {
        capturedUrl = url;
        return {
          data: {
            success: true,
            data: {
              accounts: [{ id: "vba_1", bankName: "SBI", isActive: true }],
            },
          },
        };
      };

      try {
        const res = await adminBankAccountService.getVendorBankAccounts("vnd_001");
        assert.equal(capturedUrl, "/admin/vendors/vnd_001/bank-accounts");
        assert.equal(res.accounts.length, 1);
      } finally {
        apiClient.get = originalGet;
      }
    });

    test("adminBankAccountService.addVendorBankAccount issues POST /admin/vendors/:id/bank-accounts with admin flags", async () => {
      const originalPost = apiClient.post;
      let capturedUrl = null;
      let capturedBody = null;

      apiClient.post = async (url, body) => {
        capturedUrl = url;
        capturedBody = body;
        return {
          data: {
            success: true,
            message: "Bank account created administratively",
            data: {
              account: {
                id: "vba_new",
                bankName: body.bankName,
                status: body.autoApprove ? "approved" : "pending",
                isActive: Boolean(body.setActive),
              },
            },
          },
        };
      };

      try {
        const payload = {
          accountHolderName: "Global Exports",
          bankName: "ICICI Bank",
          accountNumber: "987654321012",
          confirmAccountNumber: "987654321012",
          ifscCode: "ICIC0000001",
          accountType: "current",
          reason: "Direct vendor onboarding requested by enterprise merchant",
          autoApprove: true,
          setActive: true,
        };

        const res = await adminBankAccountService.addVendorBankAccount("vnd_001", payload);
        assert.equal(capturedUrl, "/admin/vendors/vnd_001/bank-accounts");
        assert.equal(capturedBody.autoApprove, true);
        assert.equal(capturedBody.setActive, true);
        assert.equal(res.account.status, "approved");
        assert.equal(res.account.isActive, true);
      } finally {
        apiClient.post = originalPost;
      }
    });

    test("adminBankAccountService.updateVendorBankAccount issues PATCH /admin/vendors/:id/bank-accounts/:id with reason", async () => {
      const originalPatch = apiClient.patch;
      let capturedUrl = null;
      let capturedBody = null;

      apiClient.patch = async (url, body) => {
        capturedUrl = url;
        capturedBody = body;
        return {
          data: {
            success: true,
            message: "Bank account updated successfully",
            data: { account: { id: "vba_1", bankName: body.bankName } },
          },
        };
      };

      try {
        const payload = {
          bankName: "HDFC Bank Ltd",
          reason: "Updated corporate name to match bank records",
        };

        const res = await adminBankAccountService.updateVendorBankAccount("vnd_001", "vba_1", payload);
        assert.equal(capturedUrl, "/admin/vendors/vnd_001/bank-accounts/vba_1");
        assert.equal(capturedBody.bankName, "HDFC Bank Ltd");
        assert.equal(res.account.bankName, "HDFC Bank Ltd");
      } finally {
        apiClient.patch = originalPatch;
      }
    });

    test("adminBankAccountService.setStatusVendorBankAccount issues PATCH /admin/vendors/:id/bank-accounts/:id/status", async () => {
      const originalPatch = apiClient.patch;
      let capturedUrl = null;
      let capturedBody = null;

      apiClient.patch = async (url, body) => {
        capturedUrl = url;
        capturedBody = body;
        return {
          data: {
            success: true,
            message: "Bank account status updated",
            data: { account: { id: "vba_1", isActive: body.isActive } },
          },
        };
      };

      try {
        const res = await adminBankAccountService.setStatusVendorBankAccount(
          "vnd_001",
          "vba_1",
          true,
          "Setting primary disbursement account for monthly billing cycle"
        );

        assert.equal(capturedUrl, "/admin/vendors/vnd_001/bank-accounts/vba_1/status");
        assert.equal(capturedBody.isActive, true);
        assert.equal(res.account.isActive, true);
      } finally {
        apiClient.patch = originalPatch;
      }
    });

    test("adminBankAccountService.deleteVendorBankAccount issues DELETE with body reason", async () => {
      const originalDelete = apiClient.delete;
      let capturedUrl = null;
      let capturedConfig = null;

      apiClient.delete = async (url, config) => {
        capturedUrl = url;
        capturedConfig = config;
        return {
          data: {
            success: true,
            message: "Bank account safely archived",
            data: { bankAccountId: "vba_old" },
          },
        };
      };

      try {
        const res = await adminBankAccountService.deleteVendorBankAccount(
          "vnd_001",
          "vba_old",
          "Vendor closed old corporate bank account at Axis Bank"
        );

        assert.equal(capturedUrl, "/admin/vendors/vnd_001/bank-accounts/vba_old");
        assert.equal(
          capturedConfig.data.reason,
          "Vendor closed old corporate bank account at Axis Bank"
        );
        assert.equal(res.bankAccountId, "vba_old");
      } finally {
        apiClient.delete = originalDelete;
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3. UI Component Integrity & Route Registrations
  // --------------------------------------------------------------------------
  describe("3. UI Component Integrity & Route Registrations", () => {
    test("reviewer queue route exists at frontend/src/app/administrator/bank-accounts/page.js", () => {
      const pagePath = path.join(srcDir, "app/administrator/bank-accounts/page.js");
      assert.ok(fs.existsSync(pagePath), "Reviewer queue page must exist");
      const content = fs.readFileSync(pagePath, "utf-8");
      assert.ok(content.includes('"use client"'), "Must be client component");
      assert.ok(content.includes("adminBankAccountService.listApplications"), "Must list applications");
      assert.ok(content.includes("PrivilegedUnmaskModal"), "Must house PrivilegedUnmaskModal");
      assert.ok(content.includes("ReasonConfirmModal"), "Must house ReasonConfirmModal");
    });

    test("all 4 specialized Superadmin bank components exist in components/admin/bank-accounts/", () => {
      const compDir = path.join(srcDir, "components/admin/bank-accounts");
      const expected = [
        "PrivilegedUnmaskModal.jsx",
        "AdminAddBankAccountModal.jsx",
        "AdminEditBankAccountModal.jsx",
        "AdminBankAccountCard.jsx",
      ];

      for (const compName of expected) {
        const filePath = path.join(compDir, compName);
        assert.ok(fs.existsSync(filePath), `${compName} must exist`);
        const content = fs.readFileSync(filePath, "utf-8");
        assert.ok(content.includes('"use client"'), `${compName} must be a client component`);
      }
    });

    test("AdminSidebar.jsx registers Bank Applications under Marketplace group with Landmark icon", () => {
      const sidebarPath = path.join(srcDir, "components/admin/AdminSidebar.jsx");
      const content = fs.readFileSync(sidebarPath, "utf-8");
      assert.ok(content.includes("/administrator/bank-accounts"), "Sidebar must link to /administrator/bank-accounts");
      assert.ok(content.includes('"Bank Applications"'), "Sidebar must have label 'Bank Applications'");
      assert.ok(content.includes("vendors.bank_accounts.view"), "Sidebar must require view permission");
    });

    test("frontend/src/app/administrator/vendors/[id]/page.js integrates Bank Accounts tab", () => {
      const detailPagePath = path.join(srcDir, "app/administrator/vendors/[id]/page.js");
      const content = fs.readFileSync(detailPagePath, "utf-8");
      assert.ok(content.includes('id: "bank_accounts"'), "TABS array must contain 'bank_accounts'");
      assert.ok(content.includes('label: "Bank Accounts"'), "TABS must have Bank Accounts label");
      assert.ok(content.includes("AdminBankAccountCard"), "Must render AdminBankAccountCard");
      assert.ok(content.includes("AdminAddBankAccountModal"), "Must mount AdminAddBankAccountModal");
      assert.ok(content.includes("AdminEditBankAccountModal"), "Must mount AdminEditBankAccountModal");
      assert.ok(content.includes("PrivilegedUnmaskModal"), "Must mount PrivilegedUnmaskModal");
    });
  });

  // --------------------------------------------------------------------------
  // 4. Role & Permission Aliasing
  // --------------------------------------------------------------------------
  describe("4. Permission & RBAC Aliasing Invariants", () => {
    test("Superadmin role automatically bypasses all bank account permission gates", () => {
      const { hasPermission } = useAdminAuthStore.getState();

      useAdminAuthStore.setState({
        user: { id: "u_super", role: "SUPERADMIN" },
        permissions: [],
      });

      assert.equal(hasPermission("vendors.bank_accounts.view"), true);
      assert.equal(hasPermission("vendors.bank_accounts.review"), true);
      assert.equal(hasPermission("vendors.bank_accounts.approve"), true);
      assert.equal(hasPermission("vendors.bank_accounts.reject"), true);
      assert.equal(hasPermission("vendors.bank_accounts.manage"), true);
      assert.equal(hasPermission("vendors.bank_accounts.view_unmasked"), true);
    });

    test("ordinary administrator with vendors:manage or finance:manage resolves bank permissions via aliases", () => {
      const { hasPermission } = useAdminAuthStore.getState();

      useAdminAuthStore.setState({
        user: { id: "u_admin", role: "ADMIN" },
        permissions: ["vendors:manage"],
      });

      assert.equal(hasPermission("vendors.bank_accounts.view"), true);
      assert.equal(hasPermission("vendors.bank_accounts.review"), true);
      assert.equal(hasPermission("vendors.bank_accounts.approve"), true);
      assert.equal(hasPermission("vendors.bank_accounts.reject"), true);
      assert.equal(hasPermission("vendors.bank_accounts.manage"), true);
      assert.equal(hasPermission("vendors.bank_accounts.view_unmasked"), true);

      // Staff with finance:read only
      useAdminAuthStore.setState({
        user: { id: "u_finance", role: "FINANCE_STAFF" },
        permissions: ["finance:read"],
      });

      assert.equal(hasPermission("vendors.bank_accounts.view"), true);
      assert.equal(hasPermission("vendors.bank_accounts.manage"), false);
      assert.equal(hasPermission("vendors.bank_accounts.view_unmasked"), false);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Security & Sensitive Plaintext Hygiene
  // --------------------------------------------------------------------------
  describe("5. Security, Zero-Plaintext Storage & Ephemeral Memory Hygiene", () => {
    test("all Superadmin bank components forbid localStorage, sessionStorage, and document.cookie writes", () => {
      const files = [
        "components/admin/bank-accounts/PrivilegedUnmaskModal.jsx",
        "components/admin/bank-accounts/AdminAddBankAccountModal.jsx",
        "components/admin/bank-accounts/AdminEditBankAccountModal.jsx",
        "components/admin/bank-accounts/AdminBankAccountCard.jsx",
        "app/administrator/bank-accounts/page.js",
      ];

      for (const relPath of files) {
        const fullPath = path.join(srcDir, relPath);
        const content = fs.readFileSync(fullPath, "utf-8");
        assert.equal(
          content.includes("localStorage.setItem"),
          false,
          `${relPath} must never write to localStorage`
        );
        assert.equal(
          content.includes("sessionStorage.setItem"),
          false,
          `${relPath} must never write to sessionStorage`
        );
        assert.equal(
          content.includes("document.cookie"),
          false,
          `${relPath} must never write to document.cookie`
        );
      }
    });

    test("privileged unmask modal cleans up decrypted account digits on dialog close or unmount", () => {
      const modalPath = path.join(srcDir, "components/admin/bank-accounts/PrivilegedUnmaskModal.jsx");
      const content = fs.readFileSync(modalPath, "utf-8");

      assert.ok(
        content.includes("setRevealedData(null)"),
        "PrivilegedUnmaskModal must purge decrypted digits on close/reset"
      );
      assert.ok(
        content.includes("return () => {"),
        "PrivilegedUnmaskModal must have unmount cleanup hook"
      );
    });

    test("administrative reason validation rules: min 10 and max 500 characters", () => {
      const isValidAdminReason = (r) => {
        const trimmed = (r || "").trim();
        return trimmed.length >= 10 && trimmed.length <= 500;
      };

      assert.equal(isValidAdminReason(""), false, "Empty string rejected");
      assert.equal(isValidAdminReason("123456789"), false, "9 chars rejected");
      assert.equal(isValidAdminReason("1234567890"), true, "10 chars accepted");
      assert.equal(isValidAdminReason("A".repeat(500)), true, "500 chars accepted");
      assert.equal(isValidAdminReason("A".repeat(501)), false, "501 chars rejected");
    });
  });
});

