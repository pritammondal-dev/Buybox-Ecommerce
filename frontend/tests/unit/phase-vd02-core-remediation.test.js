import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getPaginationRange,
} from "../../src/utils/pagination.util.js";
import {
  validateGSTIN,
  normalizeGSTIN,
  validatePAN,
  normalizePAN,
  validateIFSC,
  normalizeIFSC,
} from "../../src/utils/compliance-validation.util.js";

test("Phase VD-02 Remediation — Core Vendor Dashboard Verification", async (t) => {
  await t.test("Part A: Storefront Product Preview Route Verification", () => {
    const productsPagePath = path.resolve("src/app/vendor/products/page.js");
    const productEditorPath = path.resolve("src/components/catalog/ProductEditor.jsx");

    const productsPageCode = fs.readFileSync(productsPagePath, "utf8");
    const productEditorCode = fs.readFileSync(productEditorPath, "utf8");

    // 1. Ensure NO plural storefront links exist
    assert.strictEqual(
      productsPageCode.includes("/products/${prd.slug}"),
      false,
      "VendorProductsPage must not contain broken plural /products/${prd.slug}"
    );
    assert.strictEqual(
      productEditorCode.includes("/products/${formData.slug}"),
      false,
      "ProductEditor must not contain broken plural /products/${formData.slug}"
    );
    assert.strictEqual(
      productEditorCode.includes("https://buybox.market/products/"),
      false,
      "ProductEditor SEO preview must not use plural /products/ URL"
    );

    // 2. Ensure canonical singular /product/ route is used
    assert.strictEqual(
      productsPageCode.includes("/product/"),
      true,
      "VendorProductsPage must link to canonical singular /product/ route"
    );
    assert.strictEqual(
      productEditorCode.includes("/product/"),
      true,
      "ProductEditor must link to canonical singular /product/ route"
    );
  });

  await t.test("Part B: VendorTablePagination Smart Range Generation", () => {
    // 1. Few pages (<= 7) shows all pages
    const range1 = getPaginationRange(1, 5);
    assert.deepStrictEqual(range1, [1, 2, 3, 4, 5]);

    const range2 = getPaginationRange(3, 7);
    assert.deepStrictEqual(range2, [1, 2, 3, 4, 5, 6, 7]);

    // 2. Near start of large page set
    const rangeStart = getPaginationRange(2, 15);
    assert.deepStrictEqual(rangeStart, [1, 2, 3, 4, 5, "...", 15]);

    // 3. In the middle of large page set
    const rangeMid = getPaginationRange(8, 15);
    assert.deepStrictEqual(rangeMid, [1, "...", 7, 8, 9, "...", 15]);

    // 4. Near end of large page set
    const rangeEnd = getPaginationRange(14, 15);
    assert.deepStrictEqual(rangeEnd, [1, "...", 11, 12, 13, 14, 15]);

    // 5. Single page or 0 items
    assert.deepStrictEqual(getPaginationRange(1, 1), [1]);
    assert.deepStrictEqual(getPaginationRange(1, 0), [1]);
  });

  await t.test("Part C: Compliance Utilities — GSTIN Validation & Normalization", () => {
    // Valid GSTIN
    const valid = validateGSTIN("29ABCDE1234F1Z5");
    assert.strictEqual(valid.isValid, true);
    assert.strictEqual(valid.normalized, "29ABCDE1234F1Z5");

    // Normalization with lowercase and spacing
    const normalized = normalizeGSTIN("  29abcde1234f1z5  ");
    assert.strictEqual(normalized, "29ABCDE1234F1Z5");
    assert.strictEqual(validateGSTIN("  29abcde1234f1z5  ").isValid, true);

    // Invalid length
    const shortGstin = validateGSTIN("29ABCDE1234F1Z");
    assert.strictEqual(shortGstin.isValid, false);
    assert.match(shortGstin.error, /exactly 15 characters/);

    // Missing 'Z' in 14th character
    const bad14th = validateGSTIN("29ABCDE1234F1A5");
    assert.strictEqual(bad14th.isValid, false);
    assert.match(bad14th.error, /Invalid GSTIN format/);

    // Empty
    assert.strictEqual(validateGSTIN("").isValid, false);
  });

  await t.test("Part C: Compliance Utilities — PAN Validation & Normalization", () => {
    // Valid PAN
    const valid = validatePAN("ABCDE1234F");
    assert.strictEqual(valid.isValid, true);
    assert.strictEqual(valid.normalized, "ABCDE1234F");

    // Normalization
    const normalized = normalizePAN(" abcde-1234-f ");
    assert.strictEqual(normalized, "ABCDE1234F");
    assert.strictEqual(validatePAN(" abcde 1234 f ").isValid, true);

    // Invalid length
    const shortPan = validatePAN("ABCDE1234");
    assert.strictEqual(shortPan.isValid, false);
    assert.match(shortPan.error, /exactly 10 characters/);

    // Invalid format (all numbers or all letters)
    assert.strictEqual(validatePAN("1234567890").isValid, false);
    assert.strictEqual(validatePAN("ABCDEFGHIJ").isValid, false);

    // Empty
    assert.strictEqual(validatePAN("").isValid, false);
  });

  await t.test("Part C: Compliance Utilities — IFSC Validation & Country Bypass", () => {
    // Valid Indian IFSC
    const validSBI = validateIFSC("SBIN0001234", "IN");
    assert.strictEqual(validSBI.isValid, true);
    assert.strictEqual(validSBI.normalized, "SBIN0001234");

    const validHDFC = validateIFSC("  hdfc0000001  ", "IN");
    assert.strictEqual(validHDFC.isValid, true);
    assert.strictEqual(validHDFC.normalized, "HDFC0000001");

    // Non-zero 5th character is invalid in India
    const invalid5th = validateIFSC("SBIN1001234", "IN");
    assert.strictEqual(invalid5th.isValid, false);
    assert.match(invalid5th.error, /Invalid IFSC format/);

    // Invalid length
    assert.strictEqual(validateIFSC("SBIN00123", "IN").isValid, false);

    // International Country Bypass (e.g. US, GB)
    const usRouting = validateIFSC("123456789", "US");
    assert.strictEqual(usRouting.isValid, true, "Foreign accounts must bypass Indian IFSC enforcement");

    const emptyForeign = validateIFSC("", "GB");
    assert.strictEqual(emptyForeign.isValid, true, "Empty IFSC for foreign account is valid");
  });

  await t.test("Part D: Pagination Component Integration across 5 Modules", () => {
    const pages = [
      { name: "Products", file: "src/app/vendor/products/page.js" },
      { name: "Orders", file: "src/app/vendor/orders/page.js" },
      { name: "Shipments", file: "src/app/vendor/shipments/page.js" },
      { name: "Returns", file: "src/app/vendor/returns/page.js" },
      { name: "Inventory", file: "src/app/vendor/inventory/page.js" },
    ];

    for (const p of pages) {
      const code = fs.readFileSync(path.resolve(p.file), "utf8");
      assert.strictEqual(
        code.includes("VendorTablePagination"),
        true,
        `${p.name} page must import and render VendorTablePagination`
      );
      assert.strictEqual(
        code.includes("setPage(1)"),
        true,
        `${p.name} page must reset page to 1 on filter or search updates`
      );
    }
  });

  await t.test("Part E: Compliance Integration in Forms", () => {
    const registerCode = fs.readFileSync(path.resolve("src/app/vendor/register/page.js"), "utf8");
    const storeCode = fs.readFileSync(path.resolve("src/app/vendor/store/page.js"), "utf8");
    const addBankCode = fs.readFileSync(
      path.resolve("src/components/vendor/bank-accounts/AddBankAccountModal.jsx"),
      "utf8"
    );

    assert.strictEqual(
      registerCode.includes("validateGSTIN") && registerCode.includes("validatePAN"),
      true,
      "Vendor registration page must validate GSTIN and PAN"
    );
    assert.strictEqual(
      storeCode.includes("validateGSTIN") && storeCode.includes("validatePAN"),
      true,
      "Vendor store settings page must validate GSTIN and PAN"
    );
    assert.strictEqual(
      addBankCode.includes("validateIFSC"),
      true,
      "AddBankAccountModal must validate IFSC using compliance utility"
    );
  });
});
