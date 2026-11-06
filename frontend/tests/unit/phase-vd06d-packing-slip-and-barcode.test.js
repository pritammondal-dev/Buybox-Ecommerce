import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encodeCode128, decodeCode128Widths } from "../../src/utils/code128.util.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendSrc = path.resolve(__dirname, "../../src");

describe("Phase VD-06D: Packing Slip, Real Barcode & Order Management Remediation", () => {
  describe("1. Authentic Code 128 Barcode Generation & Decoding", () => {
    test("encodes standard order numbers and shipment references", () => {
      const identifiers = [
        "BB-20261101-ABCD",
        "SHP-99238",
        "PS-BB-M3K2-001",
        "PACKAGE-1234",
      ];

      for (const id of identifiers) {
        const encoded = encodeCode128(id, { moduleWidth: 2, barHeight: 48 });
        assert.ok(encoded.totalWidth > 0, "Total width must be positive");
        assert.ok(encoded.bars.length > 0, "Bars array must not be empty");
        assert.equal(encoded.text, id);

        // Decode back using independent ISO/IEC 15417 decoder
        const decoded = decodeCode128Widths(encoded.widths);
        assert.equal(decoded.text, id, `Decoded text '${decoded.text}' must match original '${id}'`);
        assert.equal(decoded.checksumValid, true, "Modulo 103 checksum must be valid");
      }
    });

    test("computes correct modulo 103 checksum", () => {
      // Test string "12345"
      // Start B = 104
      // '1' (ascii 49 - 32 = 17) * 1 = 17
      // '2' (ascii 50 - 32 = 18) * 2 = 36
      // '3' (ascii 51 - 32 = 19) * 3 = 57
      // '4' (ascii 52 - 32 = 20) * 4 = 80
      // '5' (ascii 53 - 32 = 21) * 5 = 105
      // Sum = 104 + 17 + 36 + 57 + 80 + 105 = 399
      // 399 % 103 = 90
      const encoded = encodeCode128("12345");
      assert.equal(encoded.checksum, 90, "Checksum for '12345' must be 90");
    });

    test("enforces quiet zones of at least 10 modules on each side", () => {
      const moduleWidth = 2;
      const encoded = encodeCode128("BB-TEST", { moduleWidth, quietZoneModules: 10 });
      assert.equal(encoded.bars[0].x, 20, "First bar must start after 10 modules (20px)");
      const lastBar = encoded.bars[encoded.bars.length - 1];
      const rightQuietZone = encoded.totalWidth - (lastBar.x + lastBar.width);
      assert.ok(rightQuietZone >= 20, "Right quiet zone must be at least 10 modules (20px)");
    });
  });

  describe("2. Packing Slip Modal Contract & Fallback", () => {
    test("PackingSlipModal source supports both fetchPackingSlipFn and fetchSlip", () => {
      const filePath = path.resolve(frontendSrc, "components/fulfillment/PackingSlipModal.jsx");
      const content = fs.readFileSync(filePath, "utf8");

      assert.ok(content.includes("fetchPackingSlipFn"), "Must accept fetchPackingSlipFn prop");
      assert.ok(content.includes("fetchSlip"), "Must accept fetchSlip prop for backwards compatibility");
      assert.ok(content.includes("fetchPackingSlipFn || fetchSlip"), "Must adaptively support either prop");
      assert.ok(content.includes("Code128Barcode"), "Must render Code128Barcode");
      assert.ok(content.includes("Retry"), "Must provide a Retry button in error state");
    });

    test("Vendor Order Detail Page passes both fetchPackingSlipFn and fetchSlip", () => {
      const filePath = path.resolve(frontendSrc, "app/vendor/orders/[id]/page.js");
      const content = fs.readFileSync(filePath, "utf8");

      assert.ok(content.includes("fetchPackingSlipFn="), "Vendor page must pass fetchPackingSlipFn");
      assert.ok(content.includes("fetchSlip="), "Vendor page must pass fetchSlip");
    });
  });

  describe("3. Vendor-Scoped API Routes in Vendor Service", () => {
    test("vendorService calls vendor-scoped endpoints for packing slips", () => {
      const filePath = path.resolve(frontendSrc, "services/vendor.service.js");
      const content = fs.readFileSync(filePath, "utf8");

      assert.ok(
        content.includes("/vendors/me/orders/${orderId}/packing-slip"),
        "getOrderPackingSlip must call vendor-scoped route /vendors/me/orders/:id/packing-slip"
      );
      assert.ok(
        content.includes("/shipments/vendor/${id}/packing-slip"),
        "getShipmentPackingSlip must call vendor-scoped route /shipments/vendor/:id/packing-slip"
      );
    });
  });

  describe("4. Payment & Financial Transparency Dossier in Vendor UI", () => {
    test("Vendor order detail page contains dedicated Payment & Financial Dossier Card", () => {
      const filePath = path.resolve(frontendSrc, "app/vendor/orders/[id]/page.js");
      const content = fs.readFileSync(filePath, "utf8");

      assert.ok(content.includes("Payment &amp; Financial Dossier"), "Must render Payment & Financial Dossier header");
      assert.ok(content.includes("order.paymentDetails?.method"), "Must render payment method");
      assert.ok(content.includes("order.paymentDetails?.gateway"), "Must render payment gateway");
      assert.ok(content.includes("order.paymentDetails?.transactionReference"), "Must render transaction reference");
      assert.ok(content.includes("Estimated Net Payout"), "Must render Estimated Net Payout calculation");
      assert.ok(content.includes("Platform Marketplace Fee"), "Must render Platform Marketplace Fee deduction");
      assert.ok(content.includes("order.financialBreakdown?.estimatedReceivable"), "Must reference financialBreakdown estimated receivable");
    });
  });

  describe("5. Superadmin Courier Assignment Override & SLA Inactivity Triage", () => {
    test("Superadmin order console contains SLA triage filters and overdue indicators", () => {
      const listPagePath = path.resolve(frontendSrc, "app/administrator/operations/orders/page.js");
      const listContent = fs.readFileSync(listPagePath, "utf8");

      assert.ok(listContent.includes("Vendor SLA Triage:"), "Must render Vendor SLA Triage filter bar");
      assert.ok(listContent.includes("intervention_required"), "Must support intervention_required filter");
      assert.ok(listContent.includes("acceptance_overdue"), "Must support acceptance_overdue filter");
      assert.ok(listContent.includes("confirmation_overdue"), "Must support confirmation_overdue filter");
      assert.ok(listContent.includes("Overdue (+"), "Must display overdue hours badge on table rows");
    });

    test("Superadmin order detail page contains SLA banner and Courier Assignment Override modal", () => {
      const detailPagePath = path.resolve(frontendSrc, "app/administrator/operations/orders/[id]/page.js");
      const detailContent = fs.readFileSync(detailPagePath, "utf8");

      assert.ok(detailContent.includes("Vendor Fulfillment SLA:"), "Must render Vendor Fulfillment SLA banner");
      assert.ok(detailContent.includes("assign_courier"), "Must support assign_courier action in override modal");
      assert.ok(detailContent.includes("delhivery"), "Must support Delhivery in courier selector");
      assert.ok(detailContent.includes("shiprocket"), "Must support Shiprocket in courier selector");
      assert.ok(detailContent.includes("bluedart"), "Must support Blue Dart in courier selector");
      assert.ok(detailContent.includes("Mandatory Audit Reason"), "Must enforce mandatory audit reason");
    });
  });
});
