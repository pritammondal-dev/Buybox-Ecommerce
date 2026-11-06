import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("PHASE VW-05S — Admin Vendor Wallets React Key & Data Mapping Invariants", () => {
  const walletsPagePath = path.resolve(__dirname, "../../src/app/administrator/finance/wallets/page.js");
  const drilldownPagePath = path.resolve(__dirname, "../../src/app/administrator/finance/wallets/[vendorId]/page.js");
  const backendServicePath = path.resolve(__dirname, "../../../backend/src/services/vendor-wallet.service.js");

  test("1. Wallets page assigns a verified, stable, non-undefined key to mapped table rows", () => {
    assert.ok(fs.existsSync(walletsPagePath), "wallets/page.js must exist");
    const content = fs.readFileSync(walletsPagePath, "utf8");

    // Must NOT have bare key={w._id} which was undefined when backend returned id: w._id
    assert.ok(
      !content.includes("<tr key={w._id}"),
      "Must not use bare key={w._id} without fallback or stable key resolution"
    );

    // Must resolve stableKey with fallbacks ensuring non-null key
    assert.ok(
      content.includes("stableKey") && content.includes("<tr key={stableKey}"),
      "Must bind stableKey to the rendered <tr>"
    );
  });

  test("2. Key resolution logic guarantees unique stable key across all mock wallet shapes", () => {
    const resolveKey = (w) => String(w._id || w.id || w.vendorId?._id || w.vendorId || w.vendor?._id);

    // Shape A: Standard MongoDB document with _id
    const itemA = { _id: "65b8f2a1b9c8d7e6f5a4b3c1", availableBalance: "100.00" };
    assert.equal(resolveKey(itemA), "65b8f2a1b9c8d7e6f5a4b3c1");

    // Shape B: API response with id instead of _id (root cause of previous warning)
    const itemB = { id: "65b8f2a1b9c8d7e6f5a4b3c2", availableBalance: "200.00" };
    assert.equal(resolveKey(itemB), "65b8f2a1b9c8d7e6f5a4b3c2");

    // Shape C: Fallback to vendorId string
    const itemC = { vendorId: "65b8f2a1b9c8d7e6f5a4b3c3", availableBalance: "300.00" };
    assert.equal(resolveKey(itemC), "65b8f2a1b9c8d7e6f5a4b3c3");

    // Verify all keys are distinct and non-empty
    const keys = [resolveKey(itemA), resolveKey(itemB), resolveKey(itemC)];
    assert.equal(new Set(keys).size, 3);
    assert.ok(keys.every((k) => k !== "undefined" && k !== "null" && k.length > 0));
  });

  test("3. Resolves populated vendor data safely without crashing on string vendorId", () => {
    const content = fs.readFileSync(walletsPagePath, "utf8");
    assert.ok(
      content.includes("w.vendor || (typeof w.vendorId === \"object\" ? w.vendorId : {}) || {}"),
      "Must extract vendorInfo from w.vendor or object w.vendorId"
    );
  });

  test("4. Drilldown sub-ledgers all provide fallback keys", () => {
    assert.ok(fs.existsSync(drilldownPagePath), "drilldown page.js must exist");
    const content = fs.readFileSync(drilldownPagePath, "utf8");

    assert.ok(content.includes("key={b._id || b.id"), "Bank accounts must have fallback key");
    assert.ok(content.includes("key={le._id || le.id"), "Ledger entries must have fallback key");
    assert.ok(content.includes("key={s._id || s.id"), "Settlements must have fallback key");
    assert.ok(content.includes("key={p._id || p.id"), "Payouts must have fallback key");
    assert.ok(content.includes("key={wr._id || wr.id"), "Withdrawals must have fallback key");
  });

  test("5. Backend vendor-wallet service provides both _id and id in listAdminVendorWallets", () => {
    assert.ok(fs.existsSync(backendServicePath), "vendor-wallet.service.js must exist");
    const content = fs.readFileSync(backendServicePath, "utf8");

    assert.ok(
      content.includes("_id: w._id") && content.includes("id: w._id"),
      "Backend must include both _id and id in mapped wallet items"
    );
  });
});

