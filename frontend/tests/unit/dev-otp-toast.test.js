import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractDevOtp, shouldShowDevOtpToast, maskEmail } from "../../src/utils/dev-otp.util.js";
import { authService } from "../../src/services/auth.service.js";
import { vendorService } from "../../src/services/vendor.service.js";
import apiClient from "../../src/lib/api/axios.js";

describe("Production OTP Security & Privacy Unit Suite", () => {
  describe("1. OTP Extraction Suppression", () => {
    it("extractDevOtp unconditionally returns undefined across all payload structures", () => {
      const responseWithDevOtp = {
        success: true,
        message: "User registered successfully",
        data: {
          user: {
            id: "user-cust-123",
            email: "devcustomer@buybox.test",
            devOtp: "123456",
          },
          devOtp: "123456",
        },
      };

      const extracted = extractDevOtp(responseWithDevOtp);
      assert.strictEqual(extracted, undefined);
      assert.strictEqual(shouldShowDevOtpToast(extracted), false);
    });

    it("shouldShowDevOtpToast unconditionally returns false", () => {
      assert.strictEqual(shouldShowDevOtpToast("123456"), false);
      assert.strictEqual(shouldShowDevOtpToast(undefined), false);
      assert.strictEqual(shouldShowDevOtpToast(null), false);
    });

    it("handles null, undefined, or empty responses safely without throwing", () => {
      assert.strictEqual(extractDevOtp(null), undefined);
      assert.strictEqual(extractDevOtp(undefined), undefined);
      assert.strictEqual(extractDevOtp({}), undefined);
    });
  });

  describe("2. Email Privacy Masking Utility", () => {
    it("correctly masks typical email addresses", () => {
      assert.strictEqual(maskEmail("john.doe@example.com"), "j***@example.com");
      assert.strictEqual(maskEmail("customer@buybox.in"), "c***@buybox.in");
      assert.strictEqual(maskEmail("seller@merchant.org"), "s***@merchant.org");
    });

    it("masks single-character local parts gracefully", () => {
      assert.strictEqual(maskEmail("a@domain.com"), "a***@domain.com");
    });

    it("handles null, undefined, or malformed inputs without crashing", () => {
      assert.strictEqual(maskEmail(null), "");
      assert.strictEqual(maskEmail(undefined), "");
      assert.strictEqual(maskEmail(""), "");
      assert.strictEqual(maskEmail("not-an-email"), "not-an-email");
    });
  });

  describe("3. Client Service Response Purity (No Injected devOtp)", () => {
    it("authService.register does NOT inject devOtp into response object", async () => {
      const originalPost = apiClient.post;
      apiClient.post = async () => ({
        success: true,
        data: {
          user: {
            id: "user-1",
            email: "test@buybox.test",
            isEmailVerified: false,
          },
        },
      });

      try {
        const res = await authService.register({
          email: "test@buybox.test",
          password: "password123",
          firstName: "Dev",
          lastName: "User",
        });

        assert.strictEqual(res.devOtp, undefined);
        assert.strictEqual(res.data.user.devOtp, undefined);
      } finally {
        apiClient.post = originalPost;
      }
    });

    it("authService.resendOtp does NOT inject devOtp into response object", async () => {
      const originalPost = apiClient.post;
      apiClient.post = async () => ({
        success: true,
        data: {
          email: "test@buybox.test",
          resendCooldownSeconds: 60,
        },
      });

      try {
        const res = await authService.resendOtp({
          email: "test@buybox.test",
          purpose: "email_verification",
        });

        assert.strictEqual(res.devOtp, undefined);
        assert.strictEqual(res.data.devOtp, undefined);
      } finally {
        apiClient.post = originalPost;
      }
    });

    it("vendorService.registerVendor does NOT inject devOtp into response object", async () => {
      const originalPost = apiClient.post;
      apiClient.post = async () => ({
        success: true,
        data: {
          vendor: {
            id: "vendor-1",
            businessName: "Acme",
          },
          user: {
            id: "user-vendor-1",
          },
        },
      });

      try {
        const res = await vendorService.registerVendor({
          businessName: "Acme",
        });

        assert.strictEqual(res.devOtp, undefined);
      } finally {
        apiClient.post = originalPost;
      }
    });
  });
});
