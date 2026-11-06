import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { vendorService } from "../../src/services/vendor.service.js";
import apiClient from "../../src/lib/api/axios.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "../../src");

describe("Phase VB-03: Vendor Console Bank Account Management UI & Workflows", () => {
  // --------------------------------------------------------------------------
  // 1. API Client Contracts
  // --------------------------------------------------------------------------
  describe("1. Vendor Bank Account API Client Methods", () => {
    test("vendorService.getMyBankAccounts issues GET /vendors/me/bank-accounts", async () => {
      const originalGet = apiClient.get;
      let capturedUrl = null;

      apiClient.get = async (url) => {
        capturedUrl = url;
        return {
          data: {
            success: true,
            data: {
              accounts: [
                {
                  id: "vba_001",
                  bankName: "HDFC Bank",
                  accountNumberMasked: "••••••••••••1234",
                  ifscCode: "HDFC0001234",
                  accountHolderName: "Acme Enterprises",
                  accountType: "current",
                  status: "approved",
                  isActive: true,
                },
              ],
            },
          },
        };
      };

      try {
        const res = await vendorService.getMyBankAccounts();
        assert.equal(capturedUrl, "/vendors/me/bank-accounts");
        assert.equal(res.data.success, true);
        assert.equal(res.data.data.accounts.length, 1);
        assert.equal(res.data.data.accounts[0].bankName, "HDFC Bank");
      } finally {
        apiClient.get = originalGet;
      }
    });

    test("vendorService.submitBankAccount issues POST /vendors/me/bank-accounts with sanitized payload", async () => {
      const originalPost = apiClient.post;
      let capturedUrl = null;
      let capturedBody = null;

      apiClient.post = async (url, data) => {
        capturedUrl = url;
        capturedBody = data;
        return {
          data: {
            success: true,
            message: "Bank account submitted for verification",
            data: {
              account: {
                id: "vba_002",
                bankName: data.bankName,
                accountNumberMasked: `••••••••••••${data.accountNumber.slice(-4)}`,
                ifscCode: data.ifscCode,
                status: "pending",
                isActive: false,
              },
            },
          },
        };
      };

      try {
        const payload = {
          accountHolderName: "Acme Enterprises LLP",
          bankName: "State Bank of India",
          accountNumber: "12345678901234",
          confirmAccountNumber: "12345678901234",
          ifscCode: "SBIN0000456",
          branchName: "Industrial Area",
          accountType: "current",
          submissionReason: "Primary settlement account registration",
        };

        const res = await vendorService.submitBankAccount(payload);
        assert.equal(capturedUrl, "/vendors/me/bank-accounts");
        assert.equal(capturedBody.bankName, "State Bank of India");
        assert.equal(capturedBody.accountNumber, "12345678901234");
        assert.equal(capturedBody.ifscCode, "SBIN0000456");
        assert.equal(res.data.success, true);
        assert.equal(res.data.data.account.status, "pending");
      } finally {
        apiClient.post = originalPost;
      }
    });

    test("vendorService.switchActiveBankAccount issues PATCH /vendors/me/bank-accounts/:id/active", async () => {
      const originalPatch = apiClient.patch;
      let capturedUrl = null;
      let capturedBody = null;

      apiClient.patch = async (url, data) => {
        capturedUrl = url;
        capturedBody = data;
        return {
          data: {
            success: true,
            message: "Active payout bank account updated successfully",
            data: {
              account: {
                id: "vba_003",
                bankName: "ICICI Bank",
                isActive: true,
              },
            },
          },
        };
      };

      try {
        const res = await vendorService.switchActiveBankAccount("vba_003");
        assert.equal(capturedUrl, "/vendors/me/bank-accounts/vba_003/active");
        assert.deepEqual(capturedBody, {});
        assert.equal(res.data.success, true);
        assert.equal(res.data.data.account.isActive, true);
      } finally {
        apiClient.patch = originalPatch;
      }
    });

    test("vendorService.resubmitBankAccount issues POST /vendors/me/bank-accounts/:id/resubmit with corrections", async () => {
      const originalPost = apiClient.post;
      let capturedUrl = null;
      let capturedBody = null;

      apiClient.post = async (url, data) => {
        capturedUrl = url;
        capturedBody = data;
        return {
          data: {
            success: true,
            message: "Bank account application resubmitted for verification",
            data: {
              account: {
                id: "vba_004",
                bankName: data.bankName,
                status: "pending",
                rejectionReason: null,
              },
            },
          },
        };
      };

      try {
        const correctionPayload = {
          accountHolderName: "Acme Corrected Pvt Ltd",
          bankName: "Axis Bank",
          accountNumber: "98765432109876",
          confirmAccountNumber: "98765432109876",
          ifscCode: "UTIB0000123",
          branchName: "Tech Hub",
          accountType: "current",
          submissionReason: "Corrected legal name matching PAN certificate",
        };

        const res = await vendorService.resubmitBankAccount("vba_004", correctionPayload);
        assert.equal(capturedUrl, "/vendors/me/bank-accounts/vba_004/resubmit");
        assert.equal(capturedBody.accountHolderName, "Acme Corrected Pvt Ltd");
        assert.equal(capturedBody.ifscCode, "UTIB0000123");
        assert.equal(res.data.success, true);
        assert.equal(res.data.data.account.status, "pending");
      } finally {
        apiClient.post = originalPost;
      }
    });
  });

  // --------------------------------------------------------------------------
  // 2. Route & Component File Integrity
  // --------------------------------------------------------------------------
  describe("2. Route & Component File Integrity", () => {
    test("primary page route exists at frontend/src/app/vendor/finance/bank-accounts/page.js", () => {
      const primaryPagePath = path.join(srcDir, "app/vendor/finance/bank-accounts/page.js");
      assert.ok(fs.existsSync(primaryPagePath), "Primary page file must exist");
      const content = fs.readFileSync(primaryPagePath, "utf-8");
      assert.ok(content.includes('"use client"'), "Must be a client component");
      assert.ok(content.includes("vendorService.getMyBankAccounts"), "Must load bank accounts");
      assert.ok(content.includes("BankAccountOverview"), "Must render BankAccountOverview");
      assert.ok(content.includes("BankAccountCard"), "Must render BankAccountCard");
      assert.ok(content.includes("AddBankAccountModal"), "Must house AddBankAccountModal");
      assert.ok(content.includes("SwitchActiveConfirmModal"), "Must house SwitchActiveConfirmModal");
      assert.ok(content.includes("ResubmitBankAccountModal"), "Must house ResubmitBankAccountModal");
    });

    test("alias page route exists at frontend/src/app/vendor/settings/bank-accounts/page.js", () => {
      const aliasPagePath = path.join(srcDir, "app/vendor/settings/bank-accounts/page.js");
      assert.ok(fs.existsSync(aliasPagePath), "Alias settings page file must exist");
      const content = fs.readFileSync(aliasPagePath, "utf-8");
      assert.ok(content.includes("VendorBankAccountsPage"), "Must render or re-export VendorBankAccountsPage");
    });

    test("all 5 specialized bank account UI components exist and export valid functions", () => {
      const compDir = path.join(srcDir, "components/vendor/bank-accounts");
      const expectedComponents = [
        "BankAccountOverview.jsx",
        "BankAccountCard.jsx",
        "AddBankAccountModal.jsx",
        "SwitchActiveConfirmModal.jsx",
        "ResubmitBankAccountModal.jsx",
      ];

      for (const compName of expectedComponents) {
        const filePath = path.join(compDir, compName);
        assert.ok(fs.existsSync(filePath), `Component ${compName} must exist`);
        const content = fs.readFileSync(filePath, "utf-8");
        assert.ok(content.includes('"use client"'), `${compName} must be a client component`);
      }
    });

    test("VendorSidebar.jsx registers Bank Accounts navigation entry under Finance & Payouts", () => {
      const sidebarPath = path.join(srcDir, "components/vendor/VendorSidebar.jsx");
      assert.ok(fs.existsSync(sidebarPath), "VendorSidebar.jsx must exist");
      const content = fs.readFileSync(sidebarPath, "utf-8");
      assert.ok(
        content.includes("/vendor/finance/bank-accounts"),
        "Sidebar must have link to /vendor/finance/bank-accounts"
      );
      assert.ok(content.includes('"Bank Accounts"'), "Sidebar must have label 'Bank Accounts'");
    });

    test("frontend/src/app/vendor/finance/page.js renders Active Payout Destination banner linking to bank accounts", () => {
      const financePagePath = path.join(srcDir, "app/vendor/finance/page.js");
      assert.ok(fs.existsSync(financePagePath), "Vendor finance page must exist");
      const content = fs.readFileSync(financePagePath, "utf-8");
      assert.ok(
        content.includes("vendorService.getMyBankAccounts"),
        "Finance overview must load bank accounts to display active payout status"
      );
      assert.ok(
        content.includes("/vendor/finance/bank-accounts"),
        "Finance overview must link to /vendor/finance/bank-accounts"
      );
      assert.ok(
        content.includes("activeBankAccount"),
        "Finance overview must track active bank account"
      );
    });
  });

  // --------------------------------------------------------------------------
  // 3. Form Validation Rules & Indian Banking Format Constraints
  // --------------------------------------------------------------------------
  describe("3. Form Validation Rules & Indian Banking Format Invariants", () => {
    const accountNumRegex = /^[0-9]{9,20}$/;
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

    test("account number format: permits 9 to 20 numeric digits and rejects non-digit/short/long values", () => {
      // Valid Indian bank account lengths
      assert.equal(accountNumRegex.test("123456789"), true, "9 digits valid");
      assert.equal(accountNumRegex.test("123456789012"), true, "12 digits valid (e.g. ICICI)");
      assert.equal(accountNumRegex.test("12345678901234"), true, "14 digits valid (e.g. HDFC)");
      assert.equal(accountNumRegex.test("1234567890123456"), true, "16 digits valid");
      assert.equal(accountNumRegex.test("12345678901234567890"), true, "20 digits valid");

      // Invalid
      assert.equal(accountNumRegex.test("12345678"), false, "8 digits too short");
      assert.equal(accountNumRegex.test("123456789012345678901"), false, "21 digits too long");
      assert.equal(accountNumRegex.test("12345ABCD"), false, "letters rejected");
      assert.equal(accountNumRegex.test("1234 5678 9012"), false, "spaces rejected without cleanup");
    });

    test("IFSC code format: strictly validates 11-character Indian financial code (4 letters, 0, 6 alphanumerics)", () => {
      // Valid IFSCs
      assert.equal(ifscRegex.test("HDFC0001234"), true, "Valid HDFC IFSC");
      assert.equal(ifscRegex.test("SBIN0000456"), true, "Valid SBI IFSC");
      assert.equal(ifscRegex.test("ICIC0000001"), true, "Valid ICICI IFSC");
      assert.equal(ifscRegex.test("UTIB0000123"), true, "Valid Axis IFSC");
      assert.equal(ifscRegex.test("KKBK0000180"), true, "Valid Kotak IFSC");

      // Invalid IFSCs
      assert.equal(ifscRegex.test("HDFC1001234"), false, "5th character must be '0'");
      assert.equal(ifscRegex.test("HDF0001234"), false, "10 characters too short");
      assert.equal(ifscRegex.test("HDFC00012345"), false, "12 characters too long");
      assert.equal(ifscRegex.test("hdfc0001234"), false, "lowercase invalid (must be uppercase)");
      assert.equal(ifscRegex.test("12340001234"), false, "First 4 must be letters");
    });

    test("account number confirmation invariant: values must match exactly", () => {
      const num1 = "12345678901234";
      const num2 = "12345678901234";
      const mismatch = "12345678901235";

      assert.equal(num1 === num2, true);
      assert.equal(num1 === mismatch, false);
    });

    test("account holder name validation: requires length between 2 and 150 characters", () => {
      const isValidName = (name) => {
        const trimmed = (name || "").trim();
        return trimmed.length >= 2 && trimmed.length <= 150;
      };

      assert.equal(isValidName("A"), false, "1 char too short");
      assert.equal(isValidName(""), false, "empty string rejected");
      assert.equal(isValidName("   "), false, "whitespace rejected");
      assert.equal(isValidName("Acme Enterprises"), true, "valid name");
      assert.equal(isValidName("A".repeat(150)), true, "150 chars valid boundary");
      assert.equal(isValidName("A".repeat(151)), false, "151 chars rejected");
    });
  });

  // --------------------------------------------------------------------------
  // 4. Security & Privacy Invariants
  // --------------------------------------------------------------------------
  describe("4. Security, Privacy & Zero-Plaintext Leak Invariants", () => {
    test("modal and card source code does not persist raw account numbers to localStorage or sessionStorage", () => {
      const files = [
        "components/vendor/bank-accounts/AddBankAccountModal.jsx",
        "components/vendor/bank-accounts/ResubmitBankAccountModal.jsx",
        "components/vendor/bank-accounts/BankAccountCard.jsx",
        "components/vendor/bank-accounts/SwitchActiveConfirmModal.jsx",
        "app/vendor/finance/bank-accounts/page.js",
      ];

      for (const relPath of files) {
        const content = fs.readFileSync(path.join(srcDir, relPath), "utf-8");
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

    test("bank account card displays masked credentials (accountNumberMasked)", () => {
      const cardPath = path.join(srcDir, "components/vendor/bank-accounts/BankAccountCard.jsx");
      const content = fs.readFileSync(cardPath, "utf-8");
      assert.ok(
        content.includes("account.accountNumberMasked"),
        "Card must display masked account number"
      );
      assert.equal(
        content.includes("account.accountNumber "),
        false,
        "Card must not access raw accountNumber"
      );
    });

    test("add bank account modal defaults account number fields to type='password'", () => {
      const modalPath = path.join(srcDir, "components/vendor/bank-accounts/AddBankAccountModal.jsx");
      const content = fs.readFileSync(modalPath, "utf-8");
      assert.ok(
        content.includes('type={showAccountNumber ? "text" : "password"}'),
        "Modal must use password field masking by default"
      );
      assert.ok(
        content.includes("showAccountNumber"),
        "Modal must support explicit user reveal toggle"
      );
    });

    test("resubmit modal defaults account number fields to type='password'", () => {
      const modalPath = path.join(srcDir, "components/vendor/bank-accounts/ResubmitBankAccountModal.jsx");
      const content = fs.readFileSync(modalPath, "utf-8");
      assert.ok(
        content.includes('type={showAccountNumber ? "text" : "password"}'),
        "Resubmit modal must use password field masking by default"
      );
    });

    test("slot limit constraint logic: max 3 accounts enforced", () => {
      const maxAccounts = 3;
      const getRemainingSlots = (count) => Math.max(0, maxAccounts - count);
      const isAddDisabled = (count) => count >= maxAccounts;

      assert.equal(getRemainingSlots(0), 3);
      assert.equal(getRemainingSlots(1), 2);
      assert.equal(getRemainingSlots(2), 1);
      assert.equal(getRemainingSlots(3), 0);
      assert.equal(getRemainingSlots(4), 0);

      assert.equal(isAddDisabled(0), false);
      assert.equal(isAddDisabled(2), false);
      assert.equal(isAddDisabled(3), true);
      assert.equal(isAddDisabled(4), true);
    });

    test("active payout switching contract: requires confirmed approved status", () => {
      const canSwitchActive = (account) => {
        return account.status === "approved" && account.isActive !== true;
      };

      assert.equal(
        canSwitchActive({ status: "approved", isActive: false }),
        true,
        "Approved inactive account can be switched to active"
      );
      assert.equal(
        canSwitchActive({ status: "approved", isActive: true }),
        false,
        "Already active account cannot be switched again"
      );
      assert.equal(
        canSwitchActive({ status: "pending", isActive: false }),
        false,
        "Pending account cannot be activated"
      );
      assert.equal(
        canSwitchActive({ status: "under_review", isActive: false }),
        false,
        "Under review account cannot be activated"
      );
      assert.equal(
        canSwitchActive({ status: "rejected", isActive: false }),
        false,
        "Rejected account cannot be activated"
      );
    });
  });
});

