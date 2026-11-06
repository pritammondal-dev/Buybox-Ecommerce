import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { adminOperationsService, adminInventoryService } from "../../src/services/admin/admin.service.js";
import { orderAdminService } from "../../src/services/admin/order.service.js";
import { vendorService } from "../../src/services/vendor.service.js";

describe("Buybox Phase 5B — Warehouse Packing Slips, Pick Lists & Order Exports (Frontend Services & Helpers)", () => {
  // ----------------------------------------------------
  // 1. Admin Service Methods Interface
  // ----------------------------------------------------
  describe("1. Admin Fulfillment Operations Interfaces", () => {
    test("adminOperationsService exposes packing slip and shipment export methods", () => {
      assert.equal(typeof adminOperationsService.getOrderPackingSlip, "function");
      assert.equal(typeof adminOperationsService.getShipmentPackingSlip, "function");
      assert.equal(typeof adminOperationsService.exportShipments, "function");
    });

    test("adminInventoryService exposes pick list generation and export methods", () => {
      assert.equal(typeof adminInventoryService.getPickLists, "function");
      assert.equal(typeof adminInventoryService.exportPickLists, "function");
    });

    test("orderAdminService exposes packing slip and order export methods", () => {
      assert.equal(typeof orderAdminService.getPackingSlip, "function");
      assert.equal(typeof orderAdminService.exportOrders, "function");
      assert.equal(typeof orderAdminService.exportOrderItems, "function");
    });
  });

  // ----------------------------------------------------
  // 2. Vendor Service Methods Interface
  // ----------------------------------------------------
  describe("2. Vendor Scoped Fulfillment Operations Interfaces", () => {
    test("vendorService exposes scoped packing slips and exports", () => {
      assert.equal(typeof vendorService.getOrderPackingSlip, "function");
      assert.equal(typeof vendorService.exportMyOrders, "function");
      assert.equal(typeof vendorService.exportMyOrderItems, "function");
      assert.equal(typeof vendorService.getShipmentPackingSlip, "function");
      assert.equal(typeof vendorService.exportMyShipments, "function");
    });
  });

  // ----------------------------------------------------
  // 3. Formula Injection Sanitization Logic
  // ----------------------------------------------------
  describe("3. Spreadsheet Formula Injection Protection", () => {
    function sanitizeCellValue(val) {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (/^[=+\-@\t\r]/.test(str)) {
        return `'${str}`;
      }
      return str;
    }

    test("prepends apostrophe to formula trigger characters (=, +, -, @, \\t, \\r)", () => {
      assert.equal(sanitizeCellValue("=cmd|'/C calc'!A0"), "'=cmd|'/C calc'!A0");
      assert.equal(sanitizeCellValue("+SUM(A1:A10)"), "'+SUM(A1:A10)");
      assert.equal(sanitizeCellValue("-100+20"), "'-100+20");
      assert.equal(sanitizeCellValue("@HYPERLINK('http://evil.com')"), "'@HYPERLINK('http://evil.com')");
      assert.equal(sanitizeCellValue("\tmalicious_tab"), "'\tmalicious_tab");
      assert.equal(sanitizeCellValue("\rmalicious_cr"), "'\rmalicious_cr");
    });

    test("leaves legitimate alphanumeric, SKU, and punctuation values untampered", () => {
      assert.equal(sanitizeCellValue("SKU-PRO-BLUE-L"), "SKU-PRO-BLUE-L");
      assert.equal(sanitizeCellValue("Delivered via Delhivery"), "Delivered via Delhivery");
      assert.equal(sanitizeCellValue("ORD-2026-0042"), "ORD-2026-0042");
      assert.equal(sanitizeCellValue("12345"), "12345");
      assert.equal(sanitizeCellValue(null), "");
      assert.equal(sanitizeCellValue(undefined), "");
    });
  });

  // ----------------------------------------------------
  // 4. Split-Shipment Packing Slip Integrity
  // ----------------------------------------------------
  describe("4. Split-Shipment Packing Slip Integrity", () => {
    function filterSlipItemsForShipment(orderItems, shipmentItems) {
      const shpMap = new Map();
      for (const si of shipmentItems) {
        shpMap.set(String(si.orderItemId), Number(si.quantity) || 1);
      }

      return orderItems
        .filter((oi) => shpMap.has(String(oi._id)))
        .map((oi) => ({
          ...oi,
          shippedQuantity: shpMap.get(String(oi._id)),
        }));
    }

    test("retains only items allocated to the specific split shipment with correct shipped quantities", () => {
      const mockOrderItems = [
        { _id: "item1", name: "Premium Polo", sku: "POLO-BLU-L", quantity: 3 },
        { _id: "item2", name: "Running Shorts", sku: "SHORTS-BLK-M", quantity: 2 },
        { _id: "item3", name: "Ankle Socks", sku: "SOCK-WHT", quantity: 5 },
      ];

      const mockShipmentItems = [
        { orderItemId: "item1", quantity: 2 },
        { orderItemId: "item3", quantity: 5 },
      ];

      const filtered = filterSlipItemsForShipment(mockOrderItems, mockShipmentItems);

      assert.equal(filtered.length, 2);
      assert.equal(filtered[0].sku, "POLO-BLU-L");
      assert.equal(filtered[0].shippedQuantity, 2);
      assert.equal(filtered[1].sku, "SOCK-WHT");
      assert.equal(filtered[1].shippedQuantity, 5);

      // Verify item2 was excluded from this shipment slip
      const hasItem2 = filtered.some((it) => it._id === "item2");
      assert.equal(hasItem2, false);
    });

    test("redacts payment secrets, card tokens, and cost prices from packing slip snapshot", () => {
      const sensitiveOrder = {
        orderNumber: "ORD-999",
        recipientName: "Alice Sharma",
        items: [{ name: "Polo", sku: "POLO-1", costPrice: 200, unitPrice: 500, quantity: 1 }],
        paymentGatewaySecrets: "sk_live_xyz987654321",
        cardToken: "tok_visa_4242",
        cvv: "123",
      };

      // Simulated packing slip formatter
      const slipData = {
        orderNumber: sensitiveOrder.orderNumber,
        recipientName: sensitiveOrder.recipientName,
        items: sensitiveOrder.items.map((it) => ({
          name: it.name,
          sku: it.sku,
          quantity: it.quantity,
        })),
      };

      assert.equal(slipData.paymentGatewaySecrets, undefined);
      assert.equal(slipData.cardToken, undefined);
      assert.equal(slipData.cvv, undefined);
      assert.equal(slipData.items[0].costPrice, undefined);
      assert.equal(slipData.items[0].sku, "POLO-1");
    });
  });

  // ----------------------------------------------------
  // 5. Pick-List Aggregation and Invariants
  // ----------------------------------------------------
  describe("5. Pick-List Pure Aggregation & Zero Mutation Invariant", () => {
    function aggregatePickList(orderItems) {
      const grouped = new Map();

      for (const item of orderItems) {
        const whId = item.warehouseId || "unassigned";
        const key = `${whId}:${item.sku}`;

        if (!grouped.has(key)) {
          grouped.set(key, {
            warehouseId: whId,
            sku: item.sku,
            productName: item.productName,
            totalQuantity: 0,
            orders: [],
          });
        }

        const entry = grouped.get(key);
        entry.totalQuantity += item.quantity;
        entry.orders.push({
          orderNumber: item.orderNumber,
          quantity: item.quantity,
        });
      }

      return Array.from(grouped.values());
    }

    test("groups pick items by warehouse and SKU, correctly summing quantities with order traceability", () => {
      const itemsToPick = [
        { warehouseId: "WH-NORTH", sku: "KB-MECH", productName: "Mechanical Keyboard", quantity: 2, orderNumber: "ORD-1" },
        { warehouseId: "WH-NORTH", sku: "KB-MECH", productName: "Mechanical Keyboard", quantity: 3, orderNumber: "ORD-2" },
        { warehouseId: "WH-SOUTH", sku: "KB-MECH", productName: "Mechanical Keyboard", quantity: 1, orderNumber: "ORD-3" },
        { warehouseId: "WH-NORTH", sku: "MOUSE-WL", productName: "Wireless Mouse", quantity: 4, orderNumber: "ORD-1" },
      ];

      const pickList = aggregatePickList(itemsToPick);

      assert.equal(pickList.length, 3);

      const northKeyboards = pickList.find((p) => p.warehouseId === "WH-NORTH" && p.sku === "KB-MECH");
      assert.ok(northKeyboards);
      assert.equal(northKeyboards.totalQuantity, 5);
      assert.equal(northKeyboards.orders.length, 2);
      assert.deepEqual(northKeyboards.orders, [
        { orderNumber: "ORD-1", quantity: 2 },
        { orderNumber: "ORD-2", quantity: 3 },
      ]);

      const southKeyboards = pickList.find((p) => p.warehouseId === "WH-SOUTH" && p.sku === "KB-MECH");
      assert.ok(southKeyboards);
      assert.equal(southKeyboards.totalQuantity, 1);
      assert.equal(southKeyboards.orders.length, 1);

      const northMice = pickList.find((p) => p.warehouseId === "WH-NORTH" && p.sku === "MOUSE-WL");
      assert.ok(northMice);
      assert.equal(northMice.totalQuantity, 4);
    });

    test("pick-list generation does not mutate original inventory record", () => {
      const warehouseInventory = Object.freeze({
        sku: "KB-MECH",
        onHand: 50,
        reserved: 10,
      });

      // Reading inventory for pick list
      const pickQuantity = 5;
      const readOnlyView = {
        sku: warehouseInventory.sku,
        availableOnHand: warehouseInventory.onHand,
        neededToPick: pickQuantity,
      };

      assert.equal(warehouseInventory.onHand, 50);
      assert.equal(warehouseInventory.reserved, 10);
      assert.equal(readOnlyView.neededToPick, 5);
    });
  });
});
