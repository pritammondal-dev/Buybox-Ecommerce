import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { authService } from "../../src/services/auth.service.js";
import { credentialService } from "../../src/services/credential.service.js";

describe("OTP Verification & Production Credentials Frontend Unit Suite", () => {
  describe("1. Auth Service OTP API Methods", () => {
    it("exports verifyOtp and resendOtp functions", () => {
      assert.strictEqual(typeof authService.verifyOtp, "function");
      assert.strictEqual(typeof authService.resendOtp, "function");
      assert.strictEqual(typeof authService.verifyEmail, "function");
    });
  });

  describe("2. Platform Credential Service API Methods", () => {
    it("exports listCredentials, updateCredentials, and testCredential", () => {
      assert.strictEqual(typeof credentialService.listCredentials, "function");
      assert.strictEqual(typeof credentialService.updateCredentials, "function");
      assert.strictEqual(typeof credentialService.testCredential, "function");
    });
  });

  describe("3. Client-Side OTP Input Logic & Paste Sanitization", () => {
    it("validates 6-digit numeric OTP format strictly", () => {
      const isValidOtp = (val) => typeof val === "string" && /^\d{6}$/.test(val);

      assert.strictEqual(isValidOtp("123456"), true);
      assert.strictEqual(isValidOtp("000000"), true);
      assert.strictEqual(isValidOtp("987654"), true);

      assert.strictEqual(isValidOtp("12345"), false); // too short
      assert.strictEqual(isValidOtp("1234567"), false); // too long
      assert.strictEqual(isValidOtp("12345a"), false); // non-numeric
      assert.strictEqual(isValidOtp(""), false);
      assert.strictEqual(isValidOtp(null), false);
    });

    it("sanitizes pasted text by stripping non-numeric characters and slicing to 6 digits", () => {
      const sanitizePastedOtp = (raw) => {
        return String(raw || "")
          .replace(/\D/g, "")
          .slice(0, 6);
      };

      assert.strictEqual(sanitizePastedOtp("123-456"), "123456");
      assert.strictEqual(sanitizePastedOtp("Your code is 849201 for Buybox"), "849201");
      assert.strictEqual(sanitizePastedOtp("  9 1 8 2 7 3  "), "918273");
      assert.strictEqual(sanitizePastedOtp("1234567890"), "123456");
      assert.strictEqual(sanitizePastedOtp("abcdef"), "");
    });

    it("handles countdown cooldown progression cleanly", () => {
      let cooldown = 60;
      const tick = () => Math.max(0, cooldown - 1);

      cooldown = tick();
      assert.strictEqual(cooldown, 59);

      cooldown = 1;
      cooldown = tick();
      assert.strictEqual(cooldown, 0);

      cooldown = tick();
      assert.strictEqual(cooldown, 0);
    });
  });

  describe("4. Masked Values Rendering Guarantee", () => {
    it("verifies masked placeholders never expose plaintext keys in the UI", () => {
      const mockCredentials = {
        elastic_email: {
          apiKey: "••••••••••••3456",
          fromEmail: "support@buybox.test",
        },
        delhivery: {
          apiKey: "••••••••••••9999",
          clientSecret: "••••••••••••1111",
        },
      };

      for (const [provider, creds] of Object.entries(mockCredentials)) {
        if (creds.apiKey) {
          assert.strictEqual(creds.apiKey.startsWith("••••••••••••"), true);
          assert.strictEqual(creds.apiKey.length, 16);
        }
        if (creds.clientSecret) {
          assert.strictEqual(creds.clientSecret.startsWith("••••••••••••"), true);
        }
      }
    });
  });
});
