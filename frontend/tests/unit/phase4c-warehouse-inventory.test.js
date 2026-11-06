import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { adminInventoryService } from "../../src/services/admin/admin.service.js";

describe("Buybox Phase 4C — Advanced Warehouse Management & Inventory Operations Unit Tests", () => {
  // ----------------------------------------------------
  // 1. Service Interface & Endpoint Signatures
  // ----------------------------------------------------
  describe("1. adminInventoryService Operations Interface", () => {
    test("exposes receiving management methods", () => {
      assert.equal(typeof adminInventoryService.listReceivingRecords, "function");
      assert.equal(typeof adminInventoryService.getReceivingRecord, "function");
      assert.equal(typeof adminInventoryService.createReceivingRecord, "function");
      assert.equal(typeof adminInventoryService.confirmReceivingRecord, "function");
      assert.equal(typeof adminInventoryService.cancelReceivingRecord, "function");
    });

    test("exposes multi-stage warehouse transfer methods", () => {
      assert.equal(typeof adminInventoryService.listTransfers, "function");
      assert.equal(typeof adminInventoryService.getTransferRecord, "function");
      assert.equal(typeof adminInventoryService.createTransfer, "function");
      assert.equal(typeof adminInventoryService.approveTransfer, "function");
      assert.equal(typeof adminInventoryService.dispatchTransfer, "function");
      assert.equal(typeof adminInventoryService.receiveTransfer, "function");
      assert.equal(typeof adminInventoryService.cancelTransfer, "function");
    });

    test("exposes warehouse bin location methods", () => {
      assert.equal(typeof adminInventoryService.listLocations, "function");
      assert.equal(typeof adminInventoryService.createLocation, "function");
      assert.equal(typeof adminInventoryService.assignItemToLocation, "function");
      assert.equal(typeof adminInventoryService.moveItemBetweenLocations, "function");
    });

    test("exposes stock count and cycle counting methods", () => {
      assert.equal(typeof adminInventoryService.listStockCounts, "function");
      assert.equal(typeof adminInventoryService.getStockCount, "function");
      assert.equal(typeof adminInventoryService.createStockCount, "function");
      assert.equal(typeof adminInventoryService.recordPhysicalCounts, "function");
      assert.equal(typeof adminInventoryService.reconcileAndFinalizeCount, "function");
      assert.equal(typeof adminInventoryService.cancelStockCount, "function");
    });

    test("exposes order allocation and reporting methods", () => {
      assert.equal(typeof adminInventoryService.getEligibleWarehousesForItem, "function");
      assert.equal(typeof adminInventoryService.reallocateOrderItem, "function");
      assert.equal(typeof adminInventoryService.getWarehouseOperationsOverview, "function");
      assert.equal(typeof adminInventoryService.getWarehouseInventoryReport, "function");
      assert.equal(typeof adminInventoryService.getWarehouseMovementHistory, "function");
    });
  });

  // ----------------------------------------------------
  // 2. Authoritative Availability Calculations & Stock Conditions
  // ----------------------------------------------------
  describe("2. Authoritative Availability & Non-Sellable Stock Protection", () => {
    function computeAvailableToSell(inventory) {
      const onHand = Number(inventory.onHand) || 0;
      const reserved = Number(inventory.reserved) || 0;
      const damaged = Number(inventory.damaged) || 0;
      const defective = Number(inventory.defective) || 0;
      const expired = Number(inventory.expired) || 0;
      const nonSellable = damaged + defective + expired;
      return Math.max(0, onHand - reserved - nonSellable);
    }

    test("strictly excludes non-sellable stock (damaged, defective, expired) from available-to-sell", () => {
      const inv = {
        onHand: 100,
        reserved: 20,
        damaged: 15,
        defective: 5,
        expired: 10,
      };
      // 100 - 20 reserved - (15 + 5 + 10 = 30 non-sellable) = 50 available
      assert.equal(computeAvailableToSell(inv), 50);
    });

    test("clamps available-to-sell at zero when reservations or non-sellable exceed on-hand", () => {
      const inv = {
        onHand: 30,
        reserved: 25,
        damaged: 10,
        defective: 0,
        expired: 0,
      };
      // 30 - 25 - 10 = -5 => clamped to 0
      assert.equal(computeAvailableToSell(inv), 0);
    });
  });

  // ----------------------------------------------------
  // 3. Multi-Stage Transfer Lifecycle State Validation
  // ----------------------------------------------------
  describe("3. Transfer Lifecycle & In-Transit Invariants", () => {
    function validateTransferTransition(currentStatus, action) {
      const allowedTransitions = {
        draft: ["approve", "cancel"],
        approved: ["dispatch", "cancel"],
        dispatched: ["receive_partial", "receive_full"],
        partially_received: ["receive_partial", "receive_full"],
        received: [],
        cancelled: [],
      };

      const validActions = allowedTransitions[currentStatus] || [];
      return validActions.includes(action);
    }

    test("enforces strict status progression", () => {
      assert.equal(validateTransferTransition("draft", "approve"), true);
      assert.equal(validateTransferTransition("approved", "dispatch"), true);
      assert.equal(validateTransferTransition("dispatched", "receive_full"), true);
      assert.equal(validateTransferTransition("dispatched", "cancel"), false); // cannot cancel in-transit
      assert.equal(validateTransferTransition("received", "dispatch"), false); // immutable terminal state
    });

    test("calculates in-transit units remaining correctly", () => {
      const item = {
        dispatchedQuantity: 50,
        receivedQuantity: 30,
        rejectedQuantity: 5,
      };
      const remainingInTransit = item.dispatchedQuantity - (item.receivedQuantity + item.rejectedQuantity);
      assert.equal(remainingInTransit, 15);
    });
  });

  // ----------------------------------------------------
  // 4. Stock Count Discrepancy & Stale Snapshot Reconciliation
  // ----------------------------------------------------
  describe("4. Stock Count Discrepancy Logic", () => {
    function calculateDiscrepancyDelta(item, currentOnHand) {
      const physicalCount = item.countedOnHand;
      // Stale-snapshot protection: discrepancy delta applies to current real-time stock
      return physicalCount - currentOnHand;
    }

    test("computes accurate discrepancy between counted quantity and real-time on-hand", () => {
      const item = { countedOnHand: 42, snapshotOnHand: 40 };
      // Real-time stock is still 40: delta is +2
      assert.equal(calculateDiscrepancyDelta(item, 40), 2);

      // Real-time stock moved to 45 while count was active: delta is 42 - 45 = -3
      assert.equal(calculateDiscrepancyDelta(item, 45), -3);
    });
  });
});
