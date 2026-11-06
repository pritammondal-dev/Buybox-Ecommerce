import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatTaxDecimal, normalizeTaxRule, normalizeTaxRules } from "../../src/utils/tax.util.js";
import { adminTaxService } from "../../src/services/admin/admin.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Tax Rules Decimal128 React Rendering & Data Normalization Tests", () => {
  describe("1. formatTaxDecimal Formatting", () => {
    it("converts Decimal128 Extended JSON { $numberDecimal: '18.00' } to safe display string", () => {
      const input = { $numberDecimal: "18.00" };
      const output = formatTaxDecimal(input);
      assert.strictEqual(output, "18.00");
      assert.strictEqual(typeof output, "string");
    });

    it("preserves valid zero values such as 0, '0', and '0.00'", () => {
      assert.strictEqual(formatTaxDecimal({ $numberDecimal: "0.00" }), "0.00");
      assert.strictEqual(formatTaxDecimal({ $numberDecimal: "0" }), "0");
      assert.strictEqual(formatTaxDecimal(0), "0");
      assert.strictEqual(formatTaxDecimal("0"), "0");
      assert.strictEqual(formatTaxDecimal("0.00"), "0.00");
    });

    it("preserves full precision for numbers and strings without float drift", () => {
      assert.strictEqual(formatTaxDecimal("18.75"), "18.75");
      assert.strictEqual(formatTaxDecimal(18.5), "18.5");
      assert.strictEqual(formatTaxDecimal({ $numberDecimal: "18.75" }), "18.75");
    });

    it("safely handles null, undefined, and missing optional values with customizable fallback", () => {
      assert.strictEqual(formatTaxDecimal(null), "0");
      assert.strictEqual(formatTaxDecimal(undefined), "0");
      assert.strictEqual(formatTaxDecimal(""), "0");
      assert.strictEqual(formatTaxDecimal(null, "18"), "18");
      assert.strictEqual(formatTaxDecimal(undefined, "Default"), "Default");
    });

    it("never returns [object Object] when an unexpected object is passed", () => {
      const weirdObj = { otherKey: "val" };
      const output = formatTaxDecimal(weirdObj);
      assert.strictEqual(output, "0");
      assert.notStrictEqual(output, "[object Object]");
    });
  });

  describe("2. normalizeTaxRule and normalizeTaxRules Data Adapter", () => {
    it("normalizes tax rule with Decimal128 rate to string rate", () => {
      const rawRule = {
        _id: "rule-101",
        name: "Standard GST (18%)",
        country: "IN",
        state: null,
        taxCategory: "standard",
        rate: { $numberDecimal: "18.00" },
        priority: 0,
        isShippingTaxable: true,
      };

      const normalized = normalizeTaxRule(rawRule);
      assert.strictEqual(normalized.rate, "18.00");
      assert.strictEqual(typeof normalized.rate, "string");
      assert.strictEqual(normalized.isShippingTaxable, true);
    });

    it("normalizes optional monetary thresholds and limits without losing precision", () => {
      const rawRule = {
        _id: "rule-102",
        name: "Threshold Rule",
        rate: { $numberDecimal: "12.00" },
        minTaxableAmount: { $numberDecimal: "500.00" },
        maxTaxableAmount: { $numberDecimal: "10000.00" },
      };

      const normalized = normalizeTaxRule(rawRule);
      assert.strictEqual(normalized.rate, "12.00");
      assert.strictEqual(normalized.minTaxableAmount, "500.00");
      assert.strictEqual(normalized.maxTaxableAmount, "10000.00");
    });

    it("normalizes array of tax rules correctly", () => {
      const rawRules = [
        { _id: "1", name: "R1", rate: { $numberDecimal: "18.00" } },
        { _id: "2", name: "R2", rate: { $numberDecimal: "0.00" } },
        { _id: "3", name: "R3", rate: "5.00" },
      ];

      const normalizedList = normalizeTaxRules(rawRules);
      assert.strictEqual(normalizedList.length, 3);
      assert.strictEqual(normalizedList[0].rate, "18.00");
      assert.strictEqual(normalizedList[1].rate, "0.00");
      assert.strictEqual(normalizedList[2].rate, "5.00");
    });

    it("harmonizes isShippingTaxable from shippingTaxable if former is missing", () => {
      const raw = {
        _id: "rule-103",
        name: "Shipping Rule",
        shippingTaxable: true,
      };
      const normalized = normalizeTaxRule(raw);
      assert.strictEqual(normalized.isShippingTaxable, true);
    });
  });

  describe("3. adminTaxService Contract", () => {
    it("adminTaxService is defined and exports required methods", () => {
      assert.strictEqual(typeof adminTaxService, "object");
      assert.strictEqual(typeof adminTaxService.getRules, "function");
      assert.strictEqual(typeof adminTaxService.getRule, "function");
      assert.strictEqual(typeof adminTaxService.createRule, "function");
      assert.strictEqual(typeof adminTaxService.updateRule, "function");
      assert.strictEqual(typeof adminTaxService.deleteRule, "function");
    });
  });

  describe("4. React Component Safe Rendering Static Inspection", () => {
    const pagePath = path.resolve(
      __dirname,
      "../../src/app/administrator/settings/taxes/page.js"
    );
    const content = fs.readFileSync(pagePath, "utf-8");

    it("imports formatTaxDecimal and normalizeTaxRules", () => {
      assert.match(
        content,
        /import\s+.*formatTaxDecimal.*normalizeTaxRules.*from\s+["']@\/utils\/tax\.util\.js["']/
      );
    });

    it("does not render unescaped raw {r.rate}% in JSX children", () => {
      // Must not contain {r.rate}% directly which causes React child crash
      assert.doesNotMatch(
        content,
        /\{r\.rate\}%/,
        "Found raw {r.rate}% in JSX which crashes when rate is a Decimal128 object"
      );
    });

    it("renders rate safely using formatTaxDecimal", () => {
      assert.match(
        content,
        /\{formatTaxDecimal\(r\.rate\)\}%/,
        "Table row must render rate using formatTaxDecimal(r.rate)%"
      );
    });

    it("normalizes rules state in fetchRules", () => {
      assert.match(
        content,
        /setRules\(normalizeTaxRules\(list\)\)/,
        "fetchRules must pass rules through normalizeTaxRules"
      );
    });

    it("normalizes editingRule in openEditModal and avoids [object Object]", () => {
      assert.match(
        content,
        /formatTaxDecimal\(/,
        "openEditModal must use formatTaxDecimal to populate edit form rate"
      );
    });
  });
});
