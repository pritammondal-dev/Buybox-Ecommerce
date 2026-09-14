import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useAuthStore } from "../../src/stores/auth.store.js";
import { tokenManager } from "../../src/lib/auth/token-manager.js";
import { authService } from "../../src/services/auth.service.js";
import { customerService } from "../../src/services/customer.service.js";

describe("Auth Store State Transitions Unit Tests", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  test("initializes with unauthenticated guest state", () => {
    const state = useAuthStore.getState();
    assert.equal(state.isAuthenticated, false);
    assert.equal(state.user, null);
    assert.equal(state.customerProfile, null);
    assert.equal(state.isLoading, false);
  });

  test("setUser updates user state reactively", () => {
    const mockUser = {
      id: "usr-123",
      email: "buyer@example.com",
      firstName: "Jane",
      lastName: "Doe",
      role: "customer",
    };

    useAuthStore.getState().setUser(mockUser);
    assert.deepEqual(useAuthStore.getState().user, mockUser);
  });

  test("clearAuth resets session and clears tokenManager", () => {
    tokenManager.setAccessToken("active-token-abc");
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: "usr-1" },
      customerProfile: { phone: "+911234567890" },
    });

    assert.equal(useAuthStore.getState().isAuthenticated, true);
    assert.equal(tokenManager.hasAccessToken(), true);

    useAuthStore.getState().clearAuth();

    assert.equal(useAuthStore.getState().isAuthenticated, false);
    assert.equal(useAuthStore.getState().user, null);
    assert.equal(useAuthStore.getState().customerProfile, null);
    assert.equal(tokenManager.hasAccessToken(), false);
  });

  test("tokenManager clearing automatically synchronizes store to unauthenticated", () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: "usr-1" },
    });

    tokenManager.setAccessToken("token-xyz");
    assert.equal(useAuthStore.getState().isAuthenticated, true);

    // Simulate token clear (e.g. from Axios interceptor on 401 refresh failure)
    tokenManager.clearAccessToken();

    assert.equal(useAuthStore.getState().isAuthenticated, false);
    assert.equal(useAuthStore.getState().user, null);
  });

  test("login updates authenticated state and tokenManager on success", async () => {
    const originalLogin = authService.login;
    const originalGetProfile = customerService.getProfile;
    const mockResponse = {
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: "usr-99",
          email: "test@example.com",
          firstName: "Alex",
          lastName: "Smith",
          role: "customer",
        },
        accessToken: "new.jwt.access.token",
      },
    };

    authService.login = async () => mockResponse;
    customerService.getProfile = async () => ({
      data: { customer: { id: "cust-99", phone: "+919876543210" } },
    });

    try {
      await useAuthStore.getState().login({
        email: "test@example.com",
        password: "ValidPassword123!",
      });

      const state = useAuthStore.getState();
      assert.equal(state.isAuthenticated, true);
      assert.equal(state.user.email, "test@example.com");
      assert.equal(tokenManager.getAccessToken(), "new.jwt.access.token");
    } finally {
      authService.login = originalLogin;
      customerService.getProfile = originalGetProfile;
    }
  });
});
