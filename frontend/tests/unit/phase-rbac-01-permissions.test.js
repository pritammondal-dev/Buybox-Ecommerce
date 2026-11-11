import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  PERMISSIONS,
  SECTION5_PERMISSIONS,
  CANONICAL_PERMISSIONS,
  ALIAS_MAP,
  SECTION5_CATALOG,
  resolvePermissionAliases,
} from "../../src/constants/permissions.js";

import {
  checkPermissionsMatch,
  extractPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
} from "../../src/lib/auth/permissions.js";

describe("Phase RBAC-01: Frontend Permission Architecture & Resolution", () => {
  describe("1. Permission Constants & Catalog Synchronization", () => {
    test("exports canonical permission constants and SECTION5_PERMISSIONS", () => {
      assert.ok(PERMISSIONS !== null && typeof PERMISSIONS === "object");
      assert.ok(SECTION5_PERMISSIONS !== null && typeof SECTION5_PERMISSIONS === "object");
      assert.ok(CANONICAL_PERMISSIONS !== null && typeof CANONICAL_PERMISSIONS === "object");

      // Verify essential section 5 keys exist
      assert.equal(SECTION5_PERMISSIONS.DASHBOARD_VIEW, "dashboard.view");
      assert.equal(SECTION5_PERMISSIONS.CUSTOMERS_VIEW, "customers.view");
      assert.equal(SECTION5_PERMISSIONS.VENDORS_VIEW, "vendors.view");
      assert.equal(SECTION5_PERMISSIONS.VENDORS_BANK_ACCOUNTS_VIEW, "vendors.bank_accounts.view");
      assert.equal(SECTION5_PERMISSIONS.VENDORS_KYC_VIEW, "vendors.kyc.view");
      assert.equal(SECTION5_PERMISSIONS.PRODUCTS_VIEW, "products.view");
      assert.equal(SECTION5_PERMISSIONS.FINANCE_VIEW, "finance.view");
      assert.equal(SECTION5_PERMISSIONS.FINANCE_MANAGE_SEC5, "finance.manage");
      assert.equal(SECTION5_PERMISSIONS.AUTHENTICATION_LOGIN_METHODS_READ, "authentication.login_methods.read");
      assert.equal(SECTION5_PERMISSIONS.AUTHENTICATION_LOGIN_METHODS_MANAGE, "authentication.login_methods.manage");
    });

    test("contains structured SECTION5_CATALOG with complete category coverage", () => {
      assert.ok(Array.isArray(SECTION5_CATALOG));
      assert.ok(SECTION5_CATALOG.length >= 30);

      const categoryNames = SECTION5_CATALOG.map((c) => c.category);
      assert.ok(categoryNames.includes("Dashboard"));
      assert.ok(categoryNames.includes("Customers"));
      assert.ok(categoryNames.includes("Vendors"));
      assert.ok(categoryNames.includes("Vendor Bank Accounts"));
      assert.ok(categoryNames.includes("Vendor KYC & Compliance"));
      assert.ok(categoryNames.includes("Products"));
      assert.ok(categoryNames.includes("Orders"));
      assert.ok(categoryNames.includes("Returns"));
      assert.ok(categoryNames.includes("Refunds"));
      assert.ok(categoryNames.includes("Finance"));
      assert.ok(categoryNames.includes("Settlements"));
      assert.ok(categoryNames.includes("Authentication Methods"));
      assert.ok(categoryNames.includes("Employee Governance"));
    });

    test("resolves aliases bidirectionally between dot and colon notations", () => {
      const financeViewAliases = resolvePermissionAliases("finance.view");
      assert.ok(financeViewAliases.includes("finance:read"));

      const financeReadAliases = resolvePermissionAliases("finance:read");
      assert.ok(financeReadAliases.includes("finance.view"));
      assert.ok(financeReadAliases.includes("settlements.view"));

      const usersReadAliases = resolvePermissionAliases("users:read");
      assert.ok(usersReadAliases.includes("customers.view"));

      const customersViewAliases = resolvePermissionAliases("customers.view");
      assert.ok(customersViewAliases.includes("users:read"));
    });
  });

  describe("2. checkPermissionsMatch and extractPermissions Logic", () => {
    test("matches direct identical permissions", () => {
      const granted = ["products.view", "orders.view"];
      assert.ok(checkPermissionsMatch(granted, "products.view"));
      assert.ok(checkPermissionsMatch(granted, "orders.view"));
      assert.equal(checkPermissionsMatch(granted, "customers.view"), false);
    });

    test("resolves dot required permission against colon granted permission via ALIAS_MAP", () => {
      // User only has legacy colon permissions in JWT
      const legacyGranted = ["finance:read", "products:read", "users:read"];

      assert.ok(checkPermissionsMatch(legacyGranted, "finance.view"));
      assert.ok(checkPermissionsMatch(legacyGranted, "settlements.view"));
      assert.ok(checkPermissionsMatch(legacyGranted, "products.view"));
      assert.ok(checkPermissionsMatch(legacyGranted, "customers.view"));
      assert.equal(checkPermissionsMatch(legacyGranted, "products.delete"), false);
    });

    test("resolves colon required permission against dot granted permission via ALIAS_MAP", () => {
      // User has modern section 5 dot permissions
      const dotGranted = ["settlements.view", "customers.view"];

      assert.ok(checkPermissionsMatch(dotGranted, "finance:read"));
      assert.ok(checkPermissionsMatch(dotGranted, "users:read"));
      assert.equal(checkPermissionsMatch(dotGranted, "orders:read"), false);
    });

    test("supports wildcard prefix matching", () => {
      const wildcardGranted = ["products.*", "vendors.*"];

      assert.ok(checkPermissionsMatch(wildcardGranted, "products.view"));
      assert.ok(checkPermissionsMatch(wildcardGranted, "products.edit"));
      assert.ok(checkPermissionsMatch(wildcardGranted, "products.delete"));
      assert.ok(checkPermissionsMatch(wildcardGranted, "vendors.approve"));
      assert.equal(checkPermissionsMatch(wildcardGranted, "orders.view"), false);
    });

    test("extracts permissions reliably from various user and role payload shapes", () => {
      // Flat array
      assert.deepEqual(extractPermissions(["a", "b"]), ["a", "b"]);

      // User object with direct permissions
      assert.deepEqual(extractPermissions({ permissions: ["x", "y"] }), ["x", "y"]);

      // Employee object with jobRole permissions
      const nestedUser = {
        employee: {
          jobRole: {
            permissions: ["role.perm1", "role.perm2"],
          },
        },
      };
      assert.deepEqual(extractPermissions(nestedUser), ["role.perm1", "role.perm2"]);

      // Empty / invalid
      assert.deepEqual(extractPermissions(null), []);
      assert.deepEqual(extractPermissions(undefined), []);
      assert.deepEqual(extractPermissions({}), []);
    });
  });

  describe("3. hasPermission, hasAnyPermission, and hasAllPermissions helpers", () => {
    const user = {
      permissions: ["products.view", "orders.view", "finance:read"],
    };

    test("hasPermission checks single permission with alias fallback", () => {
      assert.ok(hasPermission(user, "products.view"));
      assert.ok(hasPermission(user, "finance.view"));
      assert.equal(hasPermission(user, "customers.create"), false);
    });

    test("hasAnyPermission checks if at least one permission matches", () => {
      assert.ok(hasAnyPermission(user, ["customers.view", "products.view"]));
      assert.ok(hasAnyPermission(user, ["settlements.view", "non.existent"]));
      assert.equal(hasAnyPermission(user, ["customers.view", "customers.create"]), false);
    });

    test("hasAllPermissions checks if all required permissions match", () => {
      assert.ok(hasAllPermissions(user, ["products.view", "orders.view"]));
      assert.ok(hasAllPermissions(user, ["products.view", "settlements.view"])); // settlements.view satisfied by finance:read
      assert.equal(hasAllPermissions(user, ["products.view", "customers.view"]), false);
    });
  });
});

