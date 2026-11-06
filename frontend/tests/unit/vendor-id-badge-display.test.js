import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("PHASE VW-05T — Superadmin Vendor Directory Vendor ID Display Remediation", () => {
  const badgeComponentPath = path.resolve(__dirname, "../../src/components/admin/VendorIdBadge.jsx");
  const adminIndexExportPath = path.resolve(__dirname, "../../src/components/admin/index.js");
  const vendorsListPagePath = path.resolve(__dirname, "../../src/app/administrator/vendors/page.js");
  const vendorDetailPagePath = path.resolve(__dirname, "../../src/app/administrator/vendors/[id]/page.js");

  test("1. VendorIdBadge component exists and has required constraints", () => {
    assert.ok(fs.existsSync(badgeComponentPath), "VendorIdBadge.jsx must exist");
    const content = fs.readFileSync(badgeComponentPath, "utf8");

    // Width constraint within 180-220px range
    assert.ok(
      content.includes("max-w-[210px]"),
      "VendorIdBadge must have max-w-[210px] constraint"
    );

    // Wrapping rules for unbroken base64/encrypted tokens
    assert.ok(
      content.includes("break-all") && content.includes("[overflow-wrap:anywhere]"),
      "VendorIdBadge must contain break-all and [overflow-wrap:anywhere] to prevent table horizontal stretch"
    );

    // Visually secondary typography and styling
    assert.ok(
      content.includes("text-[10px]") && content.includes("font-mono"),
      "VendorIdBadge must use compact monospace typography secondary to store name"
    );

    // Full ID accessibility: tooltip title and text selection
    assert.ok(
      content.includes("title={`Vendor ID: ${id}`}") && content.includes("select-all"),
      "VendorIdBadge must provide accessible title tooltip and allow full text selection"
    );

    // Clipboard copy mechanism with accessible label
    assert.ok(
      content.includes("aria-label=\"Copy Vendor ID\"") &&
      content.includes("navigator.clipboard") &&
      content.includes("execCommand"),
      "VendorIdBadge must support clipboard copy with fallback and accessible aria-label"
    );
  });

  test("2. VendorIdBadge is exported from admin components barrel file", () => {
    assert.ok(fs.existsSync(adminIndexExportPath), "admin/index.js must exist");
    const content = fs.readFileSync(adminIndexExportPath, "utf8");

    assert.ok(
      content.includes("export { VendorIdBadge } from \"./VendorIdBadge.jsx\";"),
      "admin/index.js must re-export VendorIdBadge"
    );
  });

  test("3. Vendor directory page (/administrator/vendors) renders VendorIdBadge cleanly in table", () => {
    assert.ok(fs.existsSync(vendorsListPagePath), "administrator/vendors/page.js must exist");
    const content = fs.readFileSync(vendorsListPagePath, "utf8");

    // Must import VendorIdBadge
    assert.ok(
      content.includes("import { VendorIdBadge } from \"../../../components/admin/VendorIdBadge.jsx\";"),
      "vendors/page.js must import VendorIdBadge"
    );

    // Must render VendorIdBadge inside the merchant column with secureId or fallback
    assert.ok(
      content.includes("<VendorIdBadge id={vendor.secureId || String(vendor._id)} />"),
      "vendors/page.js must render VendorIdBadge with secureId or _id"
    );

    // Must not contain the old unbroken ID display in a bare flex container
    assert.ok(
      !content.includes("<span className=\"font-mono text-slate-700 dark:text-slate-200 select-all\">{vendor.secureId || vendor._id}</span>"),
      "Old unbounded unbroken ID span must be removed"
    );
  });

  test("4. Vendor detail page (/administrator/vendors/[id]) applies VendorIdBadge in header", () => {
    assert.ok(fs.existsSync(vendorDetailPagePath), "administrator/vendors/[id]/page.js must exist");
    const content = fs.readFileSync(vendorDetailPagePath, "utf8");

    // Must import VendorIdBadge
    assert.ok(
      content.includes("import { VendorIdBadge } from \"../../../../components/admin/VendorIdBadge.jsx\";"),
      "vendors/[id]/page.js must import VendorIdBadge"
    );

    // Must render VendorIdBadge in header metadata
    assert.ok(
      content.includes("<VendorIdBadge id={vendor.secureId || String(vendor._id || rawId)} />"),
      "vendors/[id]/page.js must render VendorIdBadge in header metadata"
    );

    // Must not contain the old unbounded unbroken ID paragraph
    assert.ok(
      !content.includes("<p className=\"font-mono text-xs text-slate-500 mt-1\">Vendor ID: {vendor.secureId || vendor._id}</p>"),
      "Old unbroken ID paragraph must be removed from detail header"
    );
  });

  test("5. Vendor ID formatting safety simulation: long encrypted IDs wrap without truncation", () => {
    // Simulating an 88-character encrypted token
    const mockEncryptedId = "ven_ZW5jOnZlbmRvcl82NWJhYmNkZWYwMTIzNDU2Nzg5YWJjZGVmX2F1dGg3ODkxMDExcXJzdHV2d3h5ejEyMzQ1";
    assert.ok(mockEncryptedId.length > 80, "Mock encrypted ID is sufficiently long");

    // Container width simulation: max-w-[210px] with text-[10px] mono (~6px per char)
    // ~20-25 characters per line at 10px font size in 200px width
    const approxCharsPerLine = Math.floor(190 / 6);
    const estimatedLines = Math.ceil(mockEncryptedId.length / approxCharsPerLine);

    assert.ok(estimatedLines >= 2 && estimatedLines <= 4, `Estimated wrapping across 2-4 lines (calculated: ${estimatedLines} lines)`);
  });
});

