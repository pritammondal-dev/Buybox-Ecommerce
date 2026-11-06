import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "../../");
const srcDir = path.join(frontendDir, "src");

import { vendorService } from "../../src/services/vendor.service.js";
import { shipmentService } from "../../src/services/shipment.service.js";
import apiClient from "../../src/lib/api/axios.js";

describe("Phase VD-06: Shipping, Dispatch & Fulfillment Operations Frontend Tests", () => {
  // --------------------------------------------------------------------------
  // 1. Service API Method Exports & Contracts
  // --------------------------------------------------------------------------
  describe("1. Shipping Operations Service API Contracts", () => {
    test("vendorService exports all VD-06 shipping operations methods", () => {
      assert.equal(typeof vendorService.scheduleShipmentPickup, "function");
      assert.equal(typeof vendorService.getShipmentLabel, "function");
      assert.equal(typeof vendorService.cancelShipment, "function");
      assert.equal(typeof vendorService.checkServiceability, "function");
    });

    test("shipmentService exports all VD-06 shipping operations methods", () => {
      assert.equal(typeof shipmentService.scheduleShipmentPickup, "function");
      assert.equal(typeof shipmentService.getShipmentLabel, "function");
      assert.equal(typeof shipmentService.cancelShipment, "function");
      assert.equal(typeof shipmentService.checkServiceability, "function");
    });

    test("vendorService.scheduleShipmentPickup issues POST /shipments/vendor/:id/pickup", async () => {
      const originalPost = apiClient.post;
      let capturedUrl = null;
      let capturedPayload = null;

      apiClient.post = async (url, payload) => {
        capturedUrl = url;
        capturedPayload = payload;
        return {
          data: {
            success: true,
            data: {
              status: "pickup_scheduled",
              pickupSchedule: { status: "scheduled", pickupToken: "PKP-TEST-123" },
            },
          },
        };
      };

      try {
        const res = await vendorService.scheduleShipmentPickup("shp_test_123", {
          scheduledDate: "2026-11-05",
          timeSlot: "14:00-18:00",
        });
        assert.equal(capturedUrl, "/shipments/vendor/shp_test_123/pickup");
        assert.equal(capturedPayload.scheduledDate, "2026-11-05");
        assert.equal(res.data.data.status, "pickup_scheduled");
      } finally {
        apiClient.post = originalPost;
      }
    });

    test("vendorService.getShipmentLabel issues GET /shipments/vendor/:id/label", async () => {
      const originalGet = apiClient.get;
      let capturedUrl = null;

      apiClient.get = async (url) => {
        capturedUrl = url;
        return {
          data: {
            success: true,
            data: {
              labelUrl: "https://shipping.buybox.test/labels/label_123.pdf",
              format: "pdf",
            },
          },
        };
      };

      try {
        const res = await vendorService.getShipmentLabel("shp_test_123");
        assert.equal(capturedUrl, "/shipments/vendor/shp_test_123/label");
        assert.equal(res.data.data.format, "pdf");
        assert.ok(res.data.data.labelUrl.includes("label_123.pdf"));
      } finally {
        apiClient.get = originalGet;
      }
    });

    test("vendorService.checkServiceability issues GET /shipments/serviceability", async () => {
      const originalGet = apiClient.get;
      let capturedUrl = null;
      let capturedParams = null;

      apiClient.get = async (url, config) => {
        capturedUrl = url;
        capturedParams = config?.params;
        return {
          data: {
            success: true,
            data: {
              serviceable: true,
              carrier: "delhivery",
              estimatedDays: 3,
            },
          },
        };
      };

      try {
        const res = await vendorService.checkServiceability({
          provider: "delhivery",
          originPostalCode: "110037",
          destinationPostalCode: "700016",
        });
        assert.equal(capturedUrl, "/shipments/serviceability");
        assert.equal(capturedParams.originPostalCode, "110037");
        assert.equal(res.data.data.serviceable, true);
      } finally {
        apiClient.get = originalGet;
      }
    });
  });

  // --------------------------------------------------------------------------
  // 2. Vendor Shipments Console UI Files & Features
  // --------------------------------------------------------------------------
  describe("2. Vendor Shipments UI Components & Features", () => {
    test("vendor shipments page contains carrier filter and expanded status tabs", () => {
      const pagePath = path.join(srcDir, "app/vendor/shipments/page.js");
      assert.ok(fs.existsSync(pagePath), "Vendor shipments page must exist");
      const content = fs.readFileSync(pagePath, "utf8");

      // Verify carrier filter dropdown
      assert.ok(content.includes("carrierFilter") || content.includes("All Carriers"), "Must support Carrier filtering");
      // Verify expanded status tabs
      assert.ok(content.includes("ready_to_ship"), "Must support ready_to_ship tab");
      assert.ok(content.includes("pickup_scheduled"), "Must support pickup_scheduled tab");
      assert.ok(content.includes("in_transit"), "Must support in_transit tab");
      assert.ok(content.includes("out_for_delivery"), "Must support out_for_delivery tab");
      assert.ok(content.includes("delivered"), "Must support delivered tab");
    });

    test("vendor shipment detail page contains label download, pickup scheduling, and status handover", () => {
      const detailPath = path.join(srcDir, "app/vendor/shipments/[id]/page.js");
      assert.ok(fs.existsSync(detailPath), "Vendor shipment detail page must exist");
      const content = fs.readFileSync(detailPath, "utf8");

      // Verify label download
      assert.ok(content.includes("handleDownloadLabel") || content.includes("Download Label"), "Must support Label download");
      // Verify pickup scheduling modal
      assert.ok(content.includes("showPickupModal") || content.includes("Schedule Courier Pickup"), "Must support Pickup scheduling modal");
      // Verify handover modal
      assert.ok(content.includes("showStatusModal") || content.includes("Update / Handover"), "Must support Handover status modal");
      // Verify package dossier
      assert.ok(content.includes("Package") || content.includes("Weight"), "Must render package dossier");
      // Verify consigned items
      assert.ok(content.includes("Consigned Order Items") || content.includes("shipment.items"), "Must render consigned items");
    });
  });

  // --------------------------------------------------------------------------
  // 3. Storefront Multi-Package Tracking & Admin Integration
  // --------------------------------------------------------------------------
  describe("3. Storefront Tracking & Admin Operational Controls", () => {
    test("storefront OrderTrackingPageView supports multi-package shipment tabs", () => {
      const trackingViewPath = path.join(srcDir, "app/(storefront)/orders/[orderId]/tracking/OrderTrackingPageView.jsx");
      assert.ok(fs.existsSync(trackingViewPath), "Storefront tracking view must exist");
      const content = fs.readFileSync(trackingViewPath, "utf8");

      assert.ok(content.includes("activeShipmentIndex"), "Must support selecting active package index");
      assert.ok(content.includes("Package") || content.includes("packages"), "Must render multi-package badges/tabs");
      assert.ok(content.includes("trackingEvents"), "Must render milestone tracking events");
    });

    test("AdminShipmentStatusModal supports full VD-06 status transitions", () => {
      const adminModalPath = path.join(srcDir, "components/admin/orders/AdminShipmentStatusModal.jsx");
      assert.ok(fs.existsSync(adminModalPath), "Admin shipment status modal must exist");
      const content = fs.readFileSync(adminModalPath, "utf8");

      assert.ok(content.includes("pickup_scheduled"), "Admin modal must include pickup_scheduled transition");
      assert.ok(content.includes("label_available"), "Admin modal must include label_available transition");
      assert.ok(content.includes("rto_initiated"), "Admin modal must include rto_initiated transition");
    });
  });
});
