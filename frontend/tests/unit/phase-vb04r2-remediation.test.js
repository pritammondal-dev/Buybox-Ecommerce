import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SUPPORTED_COUNTRIES,
  INDIAN_STATES,
  US_STATES,
  CANADIAN_PROVINCES,
  AUSTRALIAN_STATES,
  UK_REGIONS,
  UAE_EMIRATES,
  SINGAPORE_REGIONS,
  getSubdivisionsForCountry,
  getCountryRoutingMeta,
} from "../../src/constants/bank-geo.constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "../../src");

describe("Phase VB-04R2: Vendor Bank Application & Finance Navigation Remediation", () => {
  // --------------------------------------------------------------------------
  // 1. Geographic & Banking System Constants
  // --------------------------------------------------------------------------
  describe("1. Geographic & Banking Metadata Constants", () => {
    test("defines supported countries conforming to ISO 3166-1 alpha-2", () => {
      assert.ok(Array.isArray(SUPPORTED_COUNTRIES));
      assert.ok(SUPPORTED_COUNTRIES.length >= 7);

      const codes = SUPPORTED_COUNTRIES.map((c) => c.code);
      assert.ok(codes.includes("IN"));
      assert.ok(codes.includes("US"));
      assert.ok(codes.includes("GB"));
      assert.ok(codes.includes("CA"));
      assert.ok(codes.includes("AU"));
      assert.ok(codes.includes("AE"));
      assert.ok(codes.includes("SG"));
    });

    test("resolves regional subdivisions for supported countries and null for unsupported", () => {
      const inStates = getSubdivisionsForCountry("IN");
      assert.ok(Array.isArray(inStates));
      assert.ok(inStates.includes("Maharashtra"));
      assert.ok(inStates.includes("Karnataka"));

      const usStates = getSubdivisionsForCountry("US");
      assert.ok(Array.isArray(usStates));
      assert.ok(usStates.includes("California"));
      assert.ok(usStates.includes("New York"));

      const caProvinces = getSubdivisionsForCountry("CA");
      assert.ok(Array.isArray(caProvinces));
      assert.ok(caProvinces.includes("Ontario"));

      const unknown = getSubdivisionsForCountry("ZZ");
      assert.equal(unknown, null);
    });

    test("resolves routing metadata with IFSC required only for India", () => {
      const inMeta = getCountryRoutingMeta("IN");
      assert.equal(inMeta.requiresIfsc, true);
      assert.equal(inMeta.routingLabel, "IFSC Code");

      const usMeta = getCountryRoutingMeta("US");
      assert.equal(usMeta.requiresIfsc, false);
      assert.ok(usMeta.routingLabel.includes("ABA") || usMeta.routingLabel.includes("Routing"));

      const gbMeta = getCountryRoutingMeta("GB");
      assert.equal(gbMeta.requiresIfsc, false);
      assert.ok(gbMeta.routingLabel.includes("Sort Code") || gbMeta.routingLabel.includes("SWIFT"));
    });
  });

  // --------------------------------------------------------------------------
  // 2. Vendor Sidebar Navigation Architecture
  // --------------------------------------------------------------------------
  describe("2. Vendor Sidebar Navigation & Active Prefix Collision Immunity", () => {
    test("VendorSidebar source defines Finance Overview, Bank Accounts, and Statements", () => {
      const sidebarPath = path.join(srcDir, "components/vendor/VendorSidebar.jsx");
      assert.ok(fs.existsSync(sidebarPath), "VendorSidebar.jsx must exist");
      const content = fs.readFileSync(sidebarPath, "utf-8");

      assert.ok(content.includes('href: "/vendor/finance"'), "Must link to /vendor/finance");
      assert.ok(
        content.includes('name: "Finance Overview"'),
        "Must name route 'Finance Overview'"
      );
      assert.ok(
        content.includes('href: "/vendor/finance/bank-accounts"'),
        "Must link to /vendor/finance/bank-accounts"
      );
      assert.ok(
        content.includes('name: "Bank Accounts"'),
        "Must name route 'Bank Accounts'"
      );
      assert.ok(
        content.includes('href: "/vendor/finance/statements"'),
        "Must link to /vendor/finance/statements"
      );
      assert.ok(
        content.includes('name: "Statements"'),
        "Must name route 'Statements'"
      );
    });

    test("active matching logic eliminates prefix collision between finance overview and subroutes", () => {
      const computeActive = (item, pathname) => {
        return item.exact
          ? pathname === item.href
          : pathname === item.href ||
              pathname.startsWith(item.href + "/") ||
              Boolean(
                item.matchPrefixes?.some(
                  (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
                )
              );
      };

      const financeOverview = {
        name: "Finance Overview",
        href: "/vendor/finance",
        exact: true,
      };
      const bankAccounts = {
        name: "Bank Accounts",
        href: "/vendor/finance/bank-accounts",
      };
      const statements = {
        name: "Statements",
        href: "/vendor/finance/statements",
        matchPrefixes: ["/vendor/finance/settlements"],
      };

      // When on /vendor/finance: ONLY Finance Overview is active
      assert.equal(computeActive(financeOverview, "/vendor/finance"), true);
      assert.equal(computeActive(bankAccounts, "/vendor/finance"), false);
      assert.equal(computeActive(statements, "/vendor/finance"), false);

      // When on /vendor/finance/bank-accounts: ONLY Bank Accounts is active
      assert.equal(computeActive(financeOverview, "/vendor/finance/bank-accounts"), false);
      assert.equal(computeActive(bankAccounts, "/vendor/finance/bank-accounts"), true);
      assert.equal(computeActive(statements, "/vendor/finance/bank-accounts"), false);

      // When on /vendor/finance/statements: ONLY Statements is active
      assert.equal(computeActive(financeOverview, "/vendor/finance/statements"), false);
      assert.equal(computeActive(bankAccounts, "/vendor/finance/statements"), false);
      assert.equal(computeActive(statements, "/vendor/finance/statements"), true);

      // When on /vendor/finance/settlements/123: Statements is active via matchPrefixes
      assert.equal(
        computeActive(financeOverview, "/vendor/finance/settlements/123"),
        false
      );
      assert.equal(
        computeActive(bankAccounts, "/vendor/finance/settlements/123"),
        false
      );
      assert.equal(
        computeActive(statements, "/vendor/finance/settlements/123"),
        true
      );
    });
  });

  // --------------------------------------------------------------------------
  // 3. Dedicated Statements Page Architecture
  // --------------------------------------------------------------------------
  describe("3. Dedicated Vendor Statements Page", () => {
    test("statements page exists at /vendor/finance/statements/page.js", () => {
      const pagePath = path.join(
        srcDir,
        "app/vendor/finance/statements/page.js"
      );
      assert.ok(fs.existsSync(pagePath), "Statements page file must exist");
      const content = fs.readFileSync(pagePath, "utf-8");

      assert.ok(content.includes("vendorService.getMySettlements"));
      assert.ok(content.includes("/vendor/finance/settlements/"));
      assert.ok(content.includes("Settlement Statements"));
    });
  });

  // --------------------------------------------------------------------------
  // 4. Modals & Searchable Selection Enforcement
  // --------------------------------------------------------------------------
  describe("4. Add & Resubmit Modal Component Specifications", () => {
    test("AddBankAccountModal enforces SearchableSelect and SearchableBankSelect without manual bypass", () => {
      const modalPath = path.join(
        srcDir,
        "components/vendor/bank-accounts/AddBankAccountModal.jsx"
      );
      assert.ok(fs.existsSync(modalPath));
      const content = fs.readFileSync(modalPath, "utf-8");

      assert.ok(content.includes("SearchableSelect"));
      assert.ok(content.includes("SearchableBankSelect"));
      assert.ok(content.includes("handleCountryChange"));
      // Verify manual bypass fallback was removed
      assert.ok(
        !content.includes("Or enter bank name manually:"),
        "Manual text fallback must not exist to prevent directory bypass"
      );
      // Verify optional branchName with 'Not provided' fallback
      assert.ok(content.includes('"Not provided"'));
    });

    test("ResubmitBankAccountModal enforces SearchableSelect and SearchableBankSelect without manual bypass", () => {
      const modalPath = path.join(
        srcDir,
        "components/vendor/bank-accounts/ResubmitBankAccountModal.jsx"
      );
      assert.ok(fs.existsSync(modalPath));
      const content = fs.readFileSync(modalPath, "utf-8");

      assert.ok(content.includes("SearchableSelect"));
      assert.ok(content.includes("SearchableBankSelect"));
      assert.ok(content.includes("handleCountryChange"));
      assert.ok(
        !content.includes("Bank Name (Manual):"),
        "Manual text fallback must not exist in resubmit modal"
      );
      assert.ok(content.includes('"Not provided"'));
    });

    test("SearchableBankSelect is structured as an accessible inline combobox", () => {
      const comboboxPath = path.join(
        srcDir,
        "components/shared/SearchableBankSelect.jsx"
      );
      assert.ok(fs.existsSync(comboboxPath));
      const content = fs.readFileSync(comboboxPath, "utf-8");

      assert.ok(content.includes('role="combobox"'));
      assert.ok(content.includes("handleKeyDown"));
      assert.ok(content.includes("ArrowDown"));
      assert.ok(content.includes("ArrowUp"));
      assert.ok(content.includes("searchPartnerBanks"));
      assert.ok(content.includes("Partner Verified"));
    });
  });
});

