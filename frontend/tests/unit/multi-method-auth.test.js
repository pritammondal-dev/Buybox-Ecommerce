import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useAuthStore } from "../../src/stores/auth.store.js";
import { tokenManager } from "../../src/lib/auth/token-manager.js";
import { authService } from "../../src/services/auth.service.js";
import { customerService } from "../../src/services/customer.service.js";

describe("Frontend Multi-Method Customer Authentication Unit Tests", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  test("loginWithEmailOtp establishes authenticated customer session and sets access token", async () => {
    const originalVerifyEmailLoginOtp = authService.verifyEmailLoginOtp;
    const originalGetProfile = customerService.getProfile;

    const mockResponse = {
      success: true,
      message: "Signed in successfully with email OTP",
      data: {
        user: {
          id: "usr-otp-1",
          email: "otpuser@example.com",
          firstName: "Email",
          lastName: "User",
          role: "customer",
          isEmailVerified: true,
        },
        accessToken: "header.payload.signature.emailotp",
      },
    };

    authService.verifyEmailLoginOtp = async () => mockResponse;
    customerService.getProfile = async () => ({
      data: { customer: { id: "cust-1", phone: null } },
    });

    try {
      await useAuthStore.getState().loginWithEmailOtp({
        email: "otpuser@example.com",
        otp: "123456",
      });

      const state = useAuthStore.getState();
      assert.equal(state.isAuthenticated, true);
      assert.equal(state.user.email, "otpuser@example.com");
      assert.equal(tokenManager.getAccessToken(), "header.payload.signature.emailotp");
      assert.equal(tokenManager.hasAccessToken(), true);
    } finally {
      authService.verifyEmailLoginOtp = originalVerifyEmailLoginOtp;
      customerService.getProfile = originalGetProfile;
    }
  });

  test("loginWithPhoneOtp establishes authenticated customer session and sets access token", async () => {
    const originalVerifyPhoneLoginOtp = authService.verifyPhoneLoginOtp;
    const originalGetProfile = customerService.getProfile;

    const mockResponse = {
      success: true,
      message: "Signed in successfully with mobile OTP",
      data: {
        user: {
          id: "usr-phone-1",
          phone: "+919876543210",
          firstName: "Phone",
          lastName: "User",
          role: "customer",
          isPhoneVerified: true,
        },
        accessToken: "header.payload.signature.phoneotp",
      },
    };

    authService.verifyPhoneLoginOtp = async () => mockResponse;
    customerService.getProfile = async () => ({
      data: { customer: { id: "cust-2", phone: "+919876543210" } },
    });

    try {
      await useAuthStore.getState().loginWithPhoneOtp({
        phone: "+919876543210",
        otp: "654321",
      });

      const state = useAuthStore.getState();
      assert.equal(state.isAuthenticated, true);
      assert.equal(state.user.phone, "+919876543210");
      assert.equal(tokenManager.getAccessToken(), "header.payload.signature.phoneotp");
    } finally {
      authService.verifyPhoneLoginOtp = originalVerifyPhoneLoginOtp;
      customerService.getProfile = originalGetProfile;
    }
  });

  test("loginWithGoogle establishes authenticated customer session and sets access token", async () => {
    const originalLoginWithGoogle = authService.loginWithGoogle;
    const originalGetProfile = customerService.getProfile;

    const mockResponse = {
      success: true,
      message: "Google sign-in successful",
      data: {
        user: {
          id: "usr-google-1",
          email: "googleuser@gmail.com",
          firstName: "Google",
          lastName: "User",
          role: "customer",
          isEmailVerified: true,
        },
        accessToken: "header.payload.signature.googleauth",
      },
    };

    authService.loginWithGoogle = async () => mockResponse;
    customerService.getProfile = async () => ({
      data: { customer: { id: "cust-3" } },
    });

    try {
      await useAuthStore.getState().loginWithGoogle({
        idToken: "google.oauth2.id.token.verified",
      });

      const state = useAuthStore.getState();
      assert.equal(state.isAuthenticated, true);
      assert.equal(state.user.email, "googleuser@gmail.com");
      assert.equal(tokenManager.getAccessToken(), "header.payload.signature.googleauth");
    } finally {
      authService.loginWithGoogle = originalLoginWithGoogle;
      customerService.getProfile = originalGetProfile;
    }
  });

  test("registerWithPhone establishes session after mobile OTP verification", async () => {
    const originalVerifyPhoneRegister = authService.verifyPhoneRegister;
    const originalGetProfile = customerService.getProfile;

    const mockResponse = {
      success: true,
      message: "Mobile registration successful",
      data: {
        user: {
          id: "usr-reg-phone",
          phone: "+919123456789",
          firstName: "New",
          lastName: "Registrant",
          role: "customer",
          isPhoneVerified: true,
        },
        accessToken: "header.payload.signature.phonereg",
      },
    };

    authService.verifyPhoneRegister = async () => mockResponse;
    customerService.getProfile = async () => ({
      data: { customer: { id: "cust-4" } },
    });

    try {
      await useAuthStore.getState().registerWithPhone({
        phone: "+919123456789",
        otp: "123456",
        firstName: "New",
        lastName: "Registrant",
      });

      const state = useAuthStore.getState();
      assert.equal(state.isAuthenticated, true);
      assert.equal(state.user.phone, "+919123456789");
      assert.equal(tokenManager.getAccessToken(), "header.payload.signature.phonereg");
    } finally {
      authService.verifyPhoneRegister = originalVerifyPhoneRegister;
      customerService.getProfile = originalGetProfile;
    }
  });

  test("authService defines all required multi-method and account security API methods", () => {
    assert.equal(typeof authService.requestEmailLoginOtp, "function");
    assert.equal(typeof authService.verifyEmailLoginOtp, "function");
    assert.equal(typeof authService.requestPhoneLoginOtp, "function");
    assert.equal(typeof authService.verifyPhoneLoginOtp, "function");
    assert.equal(typeof authService.requestPhoneRegister, "function");
    assert.equal(typeof authService.verifyPhoneRegister, "function");
    assert.equal(typeof authService.loginWithGoogle, "function");
    assert.equal(typeof authService.changePassword, "function");
    assert.equal(typeof authService.requestChangeEmail, "function");
    assert.equal(typeof authService.verifyChangeEmail, "function");
    assert.equal(typeof authService.requestChangePhone, "function");
    assert.equal(typeof authService.verifyChangePhone, "function");
  });
});
