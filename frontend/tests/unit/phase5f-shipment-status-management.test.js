import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { adminOperationsService } from "../../src/services/admin/admin.service.js";
import { adminOrderService } from "../../src/services/admin/order.service.js";
import apiClient from "../../src/lib/api/admin-axios.js";

describe("Phase 5F Frontend — Superadmin Shipment Status Management Contract", () => {
  test("adminOperationsService.updateShipmentStatus issues PATCH /shipments/:id/status with valid payload", async () => {
    const originalPatch = apiClient.patch;
    let capturedUrl = null;
    let capturedBody = null;

    apiClient.patch = async (url, body) => {
      capturedUrl = url;
      capturedBody = body;
      return {
        data: {
          success: true,
          data: {
            _id: "shp-12345",
            shipmentNumber: "SHP-20261019-001",
            status: body.status,
            carrier: body.carrier,
            trackingNumber: body.trackingNumber,
          },
        },
      };
    };

    try {
      const payload = {
        status: "ready_to_ship",
        carrier: "BlueDart",
        trackingNumber: "BD-12345678",
        expectedPreviousStatus: "created",
        isOverride: false,
      };

      const result = await adminOperationsService.updateShipmentStatus("shp-12345", payload);

      assert.equal(capturedUrl, "/shipments/shp-12345/status");
      assert.deepEqual(capturedBody, payload);
      assert.equal(result.status, "ready_to_ship");
      assert.equal(result.carrier, "BlueDart");
      assert.equal(result.trackingNumber, "BD-12345678");
    } finally {
      apiClient.patch = originalPatch;
    }
  });

  test("adminOrderService.updateShipmentStatus issues PATCH /shipments/:id/status with conforming contract", async () => {
    const originalPatch = apiClient.patch;
    let capturedUrl = null;
    let capturedBody = null;

    apiClient.patch = async (url, body) => {
      capturedUrl = url;
      capturedBody = body;
      return {
        data: {
          success: true,
          data: {
            _id: "shp-67890",
            status: body.status,
          },
        },
      };
    };

    try {
      const payload = {
        status: "picked_up",
        notes: "Courier accepted parcel at loading dock",
      };

      const result = await adminOrderService.updateShipmentStatus("shp-67890", payload);

      assert.equal(capturedUrl, "/shipments/shp-67890/status");
      assert.deepEqual(capturedBody, payload);
      assert.equal(result.status, "picked_up");
    } finally {
      apiClient.patch = originalPatch;
    }
  });

  test("adminOperationsService.updateShipmentStatus preserves secure ID encoding in URL", async () => {
    const originalPatch = apiClient.patch;
    let capturedUrl = null;

    apiClient.patch = async (url, body) => {
      capturedUrl = url;
      return {
        data: {
          success: true,
          data: { status: body.status },
        },
      };
    };

    try {
      const secureId = "shp_e30=";
      await adminOperationsService.updateShipmentStatus(secureId, { status: "in_transit" });

      assert.equal(capturedUrl, `/shipments/${encodeURIComponent(secureId)}/status`);
    } finally {
      apiClient.patch = originalPatch;
    }
  });

  test("Superadmin exceptional override payload includes isOverride and overrideReason", async () => {
    const originalPatch = apiClient.patch;
    let capturedBody = null;

    apiClient.patch = async (url, body) => {
      capturedBody = body;
      return {
        data: {
          success: true,
          data: {
            _id: "shp-999",
            status: body.status,
          },
        },
      };
    };

    try {
      const overridePayload = {
        status: "in_transit",
        isOverride: true,
        overrideReason: "Manual carrier dispatch confirmation override",
        notes: "AWB issued offline by central hub supervisor",
      };

      const result = await adminOperationsService.updateShipmentStatus("shp-999", overridePayload);

      assert.equal(capturedBody.isOverride, true);
      assert.equal(capturedBody.overrideReason, "Manual carrier dispatch confirmation override");
      assert.equal(result.status, "in_transit");
    } finally {
      apiClient.patch = originalPatch;
    }
  });
});
