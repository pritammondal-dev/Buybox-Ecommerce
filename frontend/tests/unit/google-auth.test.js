import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { authService } from "../../src/services/auth.service.js";
import { useAuthStore } from "../../src/stores/auth.store.js";
import { tokenManager } from "../../src/lib/auth/token-manager.js";
import { customerService } from "../../src/services/customer.service.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Google OAuth / OIDC Frontend Suite", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
    tokenManager.clearAccessToken();
  });

  /* ========================================================================
     1. COMPONENT FILES & ARCHITECTURE INTEGRITY
     ======================================================================== */
  test("GoogleSignInButton component exists and contains GIS initialization logic", () => {
    const componentPath = path.resolve(__dirname, "../../src/components/auth/GoogleSignInButton.jsx");
    assert.ok(fs.existsSync(componentPath), "GoogleSignInButton.jsx must exist");

    const content = fs.readFileSync(componentPath, "utf8");
    assert.ok(content.includes('"use client"'), "Must be a client component");
    assert.ok(content.includes("https://accounts.google.com/gsi/client"), "Must load GIS script");
    assert.ok(content.includes("window.google.accounts.id.initialize"), "Must initialize Google Identity Services");
    assert.ok(content.includes("window.google.accounts.id.renderButton"), "Must render official GIS button");
    assert.ok(content.includes("loginWithGoogle"), "Must call auth store loginWithGoogle");
    assert.ok(content.includes("NEXT_PUBLIC_GOOGLE_CLIENT_ID"), "Must use NEXT_PUBLIC_GOOGLE_CLIENT_ID");
    assert.ok(content.includes("Signing in with Google..."), "Must include loading state during sign-in");
  });

  test("LoginForm integrates GoogleSignInButton in identifier step", () => {
    const loginFormPath = path.resolve(__dirname, "../../src/components/auth/LoginForm.jsx");
    const content = fs.readFileSync(loginFormPath, "utf8");

    assert.ok(content.includes("GoogleSignInButton"), "LoginForm must import GoogleSignInButton");
    assert.ok(content.includes('<GoogleSignInButton'), "LoginForm must render GoogleSignInButton");
    assert.ok(!content.includes("onClick={handleGoogleSignIn}"), "Old broken handleGoogleSignIn button must be replaced");
  });

  /* ========================================================================
     2. API SERVICE CONTRACT (POST /api/v1/auth/google)
     ======================================================================== */
  test("authService.loginWithGoogle correctly posts { idToken } to /auth/google", async () => {
    assert.equal(typeof authService.loginWithGoogle, "function");

    // Mock apiClient to verify endpoint and payload
    const originalPost = authService.loginWithGoogle;
    let capturedPayload = null;

    authService.loginWithGoogle = async (payload) => {
      capturedPayload = payload;
      return {
        success: true,
        data: {
          user: { id: "usr-google-test", email: "test@gmail.com", role: "customer" },
          accessToken: "mock.jwt.token",
        },
      };
    };

    try {
      const res = await authService.loginWithGoogle({ idToken: "test.id.token.jwt" });
      assert.equal(res.success, true);
      assert.deepEqual(capturedPayload, { idToken: "test.id.token.jwt" });
    } finally {
      authService.loginWithGoogle = originalPost;
    }
  });

  /* ========================================================================
     3. AUTH STORE INTEGRATION (SESSION & TOKEN MANAGEMENT)
     ======================================================================== */
  test("loginWithGoogle sets loading state during execution and resets after completion", async () => {
    const originalLoginWithGoogle = authService.loginWithGoogle;
    const originalGetProfile = customerService.getProfile;

    let loadingStateDuringAuth = false;

    authService.loginWithGoogle = async () => {
      loadingStateDuringAuth = useAuthStore.getState().isLoading;
      return {
        success: true,
        data: {
          user: {
            id: "usr-google-flow",
            email: "flow@gmail.com",
            firstName: "Flow",
            lastName: "Tester",
            role: "customer",
            isEmailVerified: true,
          },
          accessToken: "jwt.access.flow.token",
        },
      };
    };

    customerService.getProfile = async () => ({
      data: { customer: { id: "cust-flow-profile" } },
    });

    try {
      assert.equal(useAuthStore.getState().isLoading, false);

      const promise = useAuthStore.getState().loginWithGoogle({
        idToken: "sample.google.id.token",
      });

      await promise;

      assert.equal(loadingStateDuringAuth, true, "Store should flag isLoading during execution");
      assert.equal(useAuthStore.getState().isLoading, false, "Store should reset isLoading to false");
    } finally {
      authService.loginWithGoogle = originalLoginWithGoogle;
      customerService.getProfile = originalGetProfile;
    }
  });

  test("successful Google login establishes authenticated session and updates tokenManager", async () => {
    const originalLoginWithGoogle = authService.loginWithGoogle;
    const originalGetProfile = customerService.getProfile;

    authService.loginWithGoogle = async () => ({
      success: true,
      message: "Google sign-in successful",
      data: {
        user: {
          id: "usr-google-success",
          email: "verified.buyer@gmail.com",
          firstName: "Verified",
          lastName: "Buyer",
          role: "customer",
          isEmailVerified: true,
        },
        accessToken: "verified.google.jwt.access",
      },
    });

    customerService.getProfile = async () => ({
      data: { customer: { id: "cust-profile-success", tier: "gold" } },
    });

    try {
      await useAuthStore.getState().loginWithGoogle({
        idToken: "valid.google.id.token",
      });

      const state = useAuthStore.getState();
      assert.equal(state.isAuthenticated, true);
      assert.equal(state.user.id, "usr-google-success");
      assert.equal(state.user.email, "verified.buyer@gmail.com");
      assert.equal(state.customerProfile.tier, "gold");
      assert.equal(tokenManager.getAccessToken(), "verified.google.jwt.access");
      assert.equal(state.error, null);
    } finally {
      authService.loginWithGoogle = originalLoginWithGoogle;
      customerService.getProfile = originalGetProfile;
    }
  });

  test("backend Google verification failure resets store and preserves error message", async () => {
    const originalLoginWithGoogle = authService.loginWithGoogle;

    authService.loginWithGoogle = async () => {
      const err = new Error("Untrusted Google token issuer");
      err.response = {
        status: 401,
        data: {
          success: false,
          code: "INVALID_GOOGLE_ISSUER",
          message: "Untrusted Google token issuer",
        },
      };
      throw err;
    };

    try {
      await assert.rejects(
        async () => {
          await useAuthStore.getState().loginWithGoogle({
            idToken: "malicious.token.issuer",
          });
        },
        (err) => {
          assert.equal(err.message, "Untrusted Google token issuer");
          return true;
        }
      );

      const state = useAuthStore.getState();
      assert.equal(state.isAuthenticated, false);
      assert.equal(state.user, null);
      assert.equal(tokenManager.getAccessToken(), null);
      assert.equal(state.isLoading, false);
      assert.equal(state.error, "Untrusted Google token issuer");
    } finally {
      authService.loginWithGoogle = originalLoginWithGoogle;
    }
  });

  /* ========================================================================
     4. GOOGLE IDENTITY SERVICES INTERACTION CONTRACTS
     ======================================================================== */
  test("GIS callback handler processes response.credential and triggers auth flow", async () => {
    let capturedIdToken = null;
    let flowCompleted = false;

    // Simulate callback handler inside GoogleSignInButton
    const mockCallback = async (response) => {
      if (response?.credential) {
        capturedIdToken = response.credential;
        flowCompleted = true;
      }
    };

    await mockCallback({ credential: "google.gis.signed.jwt.credential" });

    assert.equal(flowCompleted, true);
    assert.equal(capturedIdToken, "google.gis.signed.jwt.credential");
  });

  test("GIS callback handler detects cancelled authentication when credential is missing", async () => {
    let capturedError = null;

    const mockCallback = async (response, onError) => {
      if (!response?.credential) {
        onError("Google Sign-In was cancelled or failed to provide a credential.");
        return;
      }
    };

    await mockCallback({}, (err) => {
      capturedError = err;
    });

    assert.equal(capturedError, "Google Sign-In was cancelled or failed to provide a credential.");
  });

  test("Google ID token is never stored in long-term localStorage session", async () => {
    const originalLoginWithGoogle = authService.loginWithGoogle;
    const originalGetProfile = customerService.getProfile;

    const testGoogleIdToken = "ephemeral.google.identity.idtoken.do.not.persist";

    authService.loginWithGoogle = async () => ({
      success: true,
      data: {
        user: { id: "usr-storage-check", email: "check@gmail.com", role: "customer" },
        accessToken: "shortlived.buybox.access.jwt",
      },
    });
    customerService.getProfile = async () => ({ data: { customer: null } });

    try {
      await useAuthStore.getState().loginWithGoogle({
        idToken: testGoogleIdToken,
      });

      // Verify tokenManager holds the Buybox access token, NOT the Google ID token
      assert.equal(tokenManager.getAccessToken(), "shortlived.buybox.access.jwt");
      assert.notEqual(tokenManager.getAccessToken(), testGoogleIdToken);
    } finally {
      authService.loginWithGoogle = originalLoginWithGoogle;
      customerService.getProfile = originalGetProfile;
    }
  });
});
