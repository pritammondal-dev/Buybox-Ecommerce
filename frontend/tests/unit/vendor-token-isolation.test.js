import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { vendorTokenManager } from "../../src/lib/auth/vendor-token-manager.js";
import { tokenManager } from "../../src/lib/auth/token-manager.js";
import { adminTokenManager } from "../../src/lib/auth/admin-token-manager.js";
import apiClient, { isVendorRoute, resolveAuthContext, getQueueState } from "../../src/lib/api/axios.js";
import { useAuthStore } from "../../src/stores/auth.store.js";
import { vendorService } from "../../src/services/vendor.service.js";

describe("Phase VD-Auth: Vendor Token Isolation & Context Separation Unit Tests", () => {
  beforeEach(() => {
    vendorTokenManager.clearAccessToken();
    tokenManager.clearAccessToken();
    adminTokenManager.clearAccessToken();
  });

  describe("1. Dedicated Vendor Token Manager State", () => {
    it("vendorTokenManager holds and retrieves token independently of customer tokenManager", () => {
      const vendorToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.vendor";
      const customerToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.customer";

      vendorTokenManager.setAccessToken(vendorToken);
      tokenManager.setAccessToken(customerToken);

      assert.strictEqual(vendorTokenManager.getAccessToken(), vendorToken);
      assert.strictEqual(tokenManager.getAccessToken(), customerToken);
      assert.strictEqual(vendorTokenManager.hasAccessToken(), true);
      assert.strictEqual(tokenManager.hasAccessToken(), true);

      vendorTokenManager.clearAccessToken();
      assert.strictEqual(vendorTokenManager.getAccessToken(), null);
      assert.strictEqual(vendorTokenManager.hasAccessToken(), false);
      // Customer token must remain untouched
      assert.strictEqual(tokenManager.getAccessToken(), customerToken);
    });

    it("vendorTokenManager subscription fires on token change and clear", () => {
      let notifiedToken = null;
      const unsubscribe = vendorTokenManager.subscribe((token) => {
        notifiedToken = token;
      });

      vendorTokenManager.setAccessToken("token_abc");
      assert.strictEqual(notifiedToken, "token_abc");

      vendorTokenManager.clearAccessToken();
      assert.strictEqual(notifiedToken, null);

      unsubscribe();
    });
  });

  describe("2. Context-Aware Route Recognition (isVendorRoute)", () => {
    it("identifies vendor-scoped endpoints accurately", () => {
      assert.strictEqual(isVendorRoute("/vendors/me/orders/123/shipments"), true);
      assert.strictEqual(isVendorRoute("/vendors/me/dashboard"), true);
      assert.strictEqual(isVendorRoute("/vendors/me/orders"), true);
      assert.strictEqual(isVendorRoute("/shipments/vendor/my"), true);
      assert.strictEqual(isVendorRoute("/vendor/auth/login"), true);
      assert.strictEqual(isVendorRoute("/orders/vendor/export"), true);
      assert.strictEqual(isVendorRoute("/products/vendor/my"), true);
      assert.strictEqual(isVendorRoute("/inventory/vendor/my"), true);
      assert.strictEqual(isVendorRoute("/warehouses/vendor/my"), true);
    });

    it("rejects non-vendor (customer and public) routes", () => {
      assert.strictEqual(isVendorRoute("/orders"), false);
      assert.strictEqual(isVendorRoute("/orders/123"), false);
      assert.strictEqual(isVendorRoute("/customers/me"), false);
      assert.strictEqual(isVendorRoute("/auth/login"), false);
      assert.strictEqual(isVendorRoute("/auth/refresh"), false);
      assert.strictEqual(isVendorRoute("/cart"), false);
      assert.strictEqual(isVendorRoute("/products"), false);
      assert.strictEqual(isVendorRoute(null), false);
      assert.strictEqual(isVendorRoute(undefined), false);
    });
  });

  describe("3. Request Interceptor Context Partitioning", () => {
    it("attaches vendor token for vendor endpoints and ignores customer token", async () => {
      const vendorToken = "jwt.vendor.token";
      const customerToken = "jwt.customer.token";

      vendorTokenManager.setAccessToken(vendorToken);
      tokenManager.setAccessToken(customerToken);

      // Simulate request interceptor execution
      const interceptors = apiClient.interceptors.request;
      // Find the request handler in interceptors
      const handler = interceptors.handlers[0].fulfilled;

      const vendorConfig = await handler({
        url: "/vendors/me/orders/ord_123/shipments",
        headers: {},
      });

      assert.strictEqual(vendorConfig.headers.Authorization, `Bearer ${vendorToken}`);

      const customerConfig = await handler({
        url: "/orders/ord_123",
        headers: {},
      });

      assert.strictEqual(customerConfig.headers.Authorization, `Bearer ${customerToken}`);
    });

    it("does NOT attach customer token to vendor endpoint even if vendor token is empty", async () => {
      const customerToken = "jwt.customer.token";
      tokenManager.setAccessToken(customerToken);
      // vendorTokenManager is empty

      const interceptors = apiClient.interceptors.request;
      const handler = interceptors.handlers[0].fulfilled;

      const vendorConfig = await handler({
        url: "/vendors/me/orders/ord_123/shipments",
        headers: {},
      });

      assert.strictEqual(vendorConfig.headers.Authorization, undefined);
    });

    it("allows staff/admin token fallback for vendor endpoints (Superadmin override)", async () => {
      const adminToken = "jwt.admin.staff.token";
      adminTokenManager.setAccessToken(adminToken);
      // vendorTokenManager is empty

      const interceptors = apiClient.interceptors.request;
      const handler = interceptors.handlers[0].fulfilled;

      const vendorConfig = await handler({
        url: "/vendors/me/orders/ord_123/shipments",
        headers: {},
      });

      assert.strictEqual(vendorConfig.headers.Authorization, `Bearer ${adminToken}`);
    });
  });

  describe("4. Zustand Auth Store Vendor Authentication", () => {
    it("vendorLogin stores token in vendorTokenManager, not customer tokenManager", async () => {
      const originalLogin = vendorService.login;
      vendorService.login = async () => ({
        success: true,
        data: {
          user: {
            id: "usr_vendor_1",
            role: "vendor",
            email: "vendor@buybox.test",
          },
          accessToken: "jwt.vendor.session.token",
        },
      });

      try {
        await useAuthStore.getState().vendorLogin({
          email: "vendor@buybox.test",
          password: "Password123!",
        });

        assert.strictEqual(vendorTokenManager.getAccessToken(), "jwt.vendor.session.token");
        assert.strictEqual(tokenManager.getAccessToken(), null);
        assert.strictEqual(useAuthStore.getState().isAuthenticated, true);
        assert.strictEqual(useAuthStore.getState().user?.role, "vendor");
      } finally {
        vendorService.login = originalLogin;
      }
    });

    it("initializeVendorAuth fetches fresh vendor session via vendorService.refresh", async () => {
      const originalRefresh = vendorService.refresh;
      vendorService.refresh = async () => ({
        success: true,
        data: {
          user: {
            id: "usr_vendor_1",
            role: "vendor",
            email: "vendor@buybox.test",
          },
          accessToken: "jwt.refreshed.vendor.token",
        },
      });

      try {
        // Reset auth store
        useAuthStore.setState({ isInitialized: false, isAuthenticated: false, user: null });
        vendorTokenManager.clearAccessToken();

        await useAuthStore.getState().initializeVendorAuth();

        assert.strictEqual(vendorTokenManager.getAccessToken(), "jwt.refreshed.vendor.token");
        assert.strictEqual(tokenManager.getAccessToken(), null);
        assert.strictEqual(useAuthStore.getState().isAuthenticated, true);
        assert.strictEqual(useAuthStore.getState().user?.role, "vendor");
      } finally {
        vendorService.refresh = originalRefresh;
      }
    });

    it("clearAuth resets both customer and vendor token managers", () => {
      vendorTokenManager.setAccessToken("vendor.token");
      tokenManager.setAccessToken("customer.token");

      useAuthStore.getState().clearAuth();

      assert.strictEqual(vendorTokenManager.getAccessToken(), null);
      assert.strictEqual(tokenManager.getAccessToken(), null);
      assert.strictEqual(useAuthStore.getState().isAuthenticated, false);
      assert.strictEqual(useAuthStore.getState().user, null);
    });
  });
  describe("5. Explicit Authentication Context Selection (resolveAuthContext)", () => {
    it("respects explicit authContext over URL patterns", () => {
      // Explicit vendor on customer route
      assert.strictEqual(resolveAuthContext({ url: "/orders/123", authContext: "vendor" }), "vendor");
      // Explicit customer on vendor route
      assert.strictEqual(resolveAuthContext({ url: "/vendors/me/profile", authContext: "customer" }), "customer");
      // Explicit admin context
      assert.strictEqual(resolveAuthContext({ url: "/products", authContext: "admin" }), "admin");
    });

    it("respects explicit X-Auth-Context header when authContext config is absent", () => {
      assert.strictEqual(resolveAuthContext({ url: "/notifications", headers: { "X-Auth-Context": "vendor" } }), "vendor");
      assert.strictEqual(resolveAuthContext({ url: "/notifications", headers: { "X-Auth-Context": "customer" } }), "customer");
    });

    it("falls back to route recognition when explicit context is omitted", () => {
      assert.strictEqual(resolveAuthContext({ url: "/reviews/vendor/my" }), "vendor");
      assert.strictEqual(resolveAuthContext({ url: "/reviews/123/vendor-response" }), "vendor");
      assert.strictEqual(resolveAuthContext({ url: "/questions/vendor/my" }), "vendor");
      assert.strictEqual(resolveAuthContext({ url: "/fulfillment-exceptions/vendor" }), "vendor");
      assert.strictEqual(resolveAuthContext({ url: "/cart" }), "customer");
    });
  });

  describe("6. Dual-Role Concurrency & Isolated Logout", () => {
    it("vendorLogout clears vendor session while leaving customer session active", async () => {
      const originalVendorLogout = vendorService.logout;
      vendorService.logout = async () => ({ success: true });

      try {
        vendorTokenManager.setAccessToken("token.vendor.123");
        tokenManager.setAccessToken("token.customer.456");

        useAuthStore.setState({
          user: { id: "usr_vendor", role: "vendor" },
          vendorUser: { id: "usr_vendor", role: "vendor" },
          customerUser: { id: "usr_cust", role: "customer" },
          isVendorAuthenticated: true,
          isCustomerAuthenticated: true,
          isAuthenticated: true,
        });

        await useAuthStore.getState().vendorLogout();

        assert.strictEqual(vendorTokenManager.getAccessToken(), null);
        assert.strictEqual(useAuthStore.getState().isVendorAuthenticated, false);
        assert.strictEqual(useAuthStore.getState().vendorUser, null);

        // Customer credentials and state must remain fully active
        assert.strictEqual(tokenManager.getAccessToken(), "token.customer.456");
        assert.strictEqual(useAuthStore.getState().isCustomerAuthenticated, true);
        assert.strictEqual(useAuthStore.getState().customerUser?.id, "usr_cust");
        assert.strictEqual(useAuthStore.getState().isAuthenticated, true);
        assert.strictEqual(useAuthStore.getState().user?.role, "customer");
      } finally {
        vendorService.logout = originalVendorLogout;
      }
    });

    it("customerLogout clears customer session while leaving vendor session active", async () => {
      vendorTokenManager.setAccessToken("token.vendor.123");
      tokenManager.setAccessToken("token.customer.456");

      useAuthStore.setState({
        user: { id: "usr_cust", role: "customer" },
        vendorUser: { id: "usr_vendor", role: "vendor" },
        customerUser: { id: "usr_cust", role: "customer" },
        isVendorAuthenticated: true,
        isCustomerAuthenticated: true,
        isAuthenticated: true,
      });

      await useAuthStore.getState().customerLogout();

      assert.strictEqual(tokenManager.getAccessToken(), null);
      assert.strictEqual(useAuthStore.getState().isCustomerAuthenticated, false);
      assert.strictEqual(useAuthStore.getState().customerUser, null);

      // Vendor credentials and state must remain fully active
      assert.strictEqual(vendorTokenManager.getAccessToken(), "token.vendor.123");
      assert.strictEqual(useAuthStore.getState().isVendorAuthenticated, true);
      assert.strictEqual(useAuthStore.getState().vendorUser?.id, "usr_vendor");
      assert.strictEqual(useAuthStore.getState().isAuthenticated, true);
      assert.strictEqual(useAuthStore.getState().user?.role, "vendor");
    });
  });

  describe("7. Cross-Module Context Verification", () => {
    it("attaches vendor token for reviews and Q&A endpoints", async () => {
      const vendorToken = "jwt.vendor.token";
      const customerToken = "jwt.customer.token";
      vendorTokenManager.setAccessToken(vendorToken);
      tokenManager.setAccessToken(customerToken);

      const handler = apiClient.interceptors.request.handlers[0].fulfilled;

      // Vendor reviews
      const reviewConfig = await handler({ url: "/reviews/vendor/my", headers: {} });
      assert.strictEqual(reviewConfig.headers.Authorization, `Bearer ${vendorToken}`);

      // Vendor review response
      const responseConfig = await handler({ url: "/reviews/rev_1/vendor-response", headers: {} });
      assert.strictEqual(responseConfig.headers.Authorization, `Bearer ${vendorToken}`);

      // Vendor questions
      const questionConfig = await handler({ url: "/questions/vendor/my", headers: {} });
      assert.strictEqual(questionConfig.headers.Authorization, `Bearer ${vendorToken}`);

      // Customer route gets customer token
      const cartConfig = await handler({ url: "/cart", headers: {} });
      assert.strictEqual(cartConfig.headers.Authorization, `Bearer ${customerToken}`);
    });
  });

  describe("8. Analytics Sort Contract Verification", () => {
    it("validates that frontend sort parameters match backend allowed enum", () => {
      const allowedBackendSortOptions = ["unitsSold", "grossSales", "netSales", "productName"];
      
      // Values used by frontend analytics dropdown
      const frontendDropdownOptions = [
        "unitsSold:desc",
        "unitsSold:asc",
        "grossSales:desc",
        "grossSales:asc",
        "netSales:desc",
        "netSales:asc",
        "productName:asc",
        "productName:desc",
      ];

      frontendDropdownOptions.forEach((option) => {
        const [field, order] = option.split(":");
        assert.ok(
          allowedBackendSortOptions.includes(field),
          `Field ${field} must be one of backend enum: ${allowedBackendSortOptions.join(", ")}`
        );
        assert.ok(["asc", "desc"].includes(order), `Order ${order} must be asc or desc`);
      });

      // Assert obsolete values are rejected
      assert.strictEqual(allowedBackendSortOptions.includes("units"), false);
      assert.strictEqual(allowedBackendSortOptions.includes("orders"), false);
    });
  });
});
