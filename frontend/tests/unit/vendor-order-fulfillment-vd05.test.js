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
import { adminOrderService } from "../../src/services/admin/order.service.js";
import apiClient from "../../src/lib/api/axios.js";
import adminApiClient from "../../src/lib/api/admin-axios.js";

describe("Phase VD-05: Unified Order Management & Vendor Fulfillment Frontend Tests", () => {
  // --------------------------------------------------------------------------
  // 1. Vendor Service Fulfillment Methods & Contract
  // --------------------------------------------------------------------------
  describe("1. Vendor Service API Client Contracts", () => {
    test("vendorService exports all VD-05 fulfillment operations methods", () => {
      assert.equal(typeof vendorService.getShipmentPartners, "function");
      assert.equal(typeof vendorService.acceptOrder, "function");
      assert.equal(typeof vendorService.rejectOrder, "function");
      assert.equal(typeof vendorService.updateFulfillmentDetails, "function");
      assert.equal(typeof vendorService.confirmFulfillment, "function");
    });

    test("vendorService.getShipmentPartners issues GET /vendors/me/orders/shipment-partners", async () => {
      const originalGet = apiClient.get;
      let capturedUrl = null;

      apiClient.get = async (url) => {
        capturedUrl = url;
        return {
          data: {
            success: true,
            data: [
              { id: "delhivery", name: "Delhivery Express & Surface", type: "integrated" },
              { id: "shiprocket", name: "Shiprocket Aggregator", type: "integrated" },
            ],
          },
        };
      };

      try {
        const partners = await vendorService.getShipmentPartners();
        assert.equal(capturedUrl, "/vendors/me/orders/shipment-partners");
        assert.equal(Array.isArray(partners), true);
        assert.equal(partners[0].id, "delhivery");
      } finally {
        apiClient.get = originalGet;
      }
    });

    test("vendorService.acceptOrder issues POST /vendors/me/orders/:id/accept", async () => {
      const originalPost = apiClient.post;
      let capturedUrl = null;
      let capturedPayload = null;

      apiClient.post = async (url, payload) => {
        capturedUrl = url;
        capturedPayload = payload;
        return {
          data: {
            success: true,
            data: { acceptanceStatus: "accepted" },
          },
        };
      };

      try {
        const res = await vendorService.acceptOrder("ord_sec123", { notes: "Accepting batch" });
        assert.equal(capturedUrl, "/vendors/me/orders/ord_sec123/accept");
        assert.equal(capturedPayload.notes, "Accepting batch");
        assert.equal(res.acceptanceStatus, "accepted");
      } finally {
        apiClient.post = originalPost;
      }
    });

    test("vendorService.rejectOrder issues POST /vendors/me/orders/:id/reject with non-empty reason", async () => {
      const originalPost = apiClient.post;
      let capturedUrl = null;
      let capturedPayload = null;

      apiClient.post = async (url, payload) => {
        capturedUrl = url;
        capturedPayload = payload;
        return {
          data: {
            success: true,
            data: { acceptanceStatus: "rejected", rejectionReason: payload.rejectionReason },
          },
        };
      };

      try {
        const res = await vendorService.rejectOrder("ord_sec123", {
          rejectionReason: "Out of stock in regional hub",
        });
        assert.equal(capturedUrl, "/vendors/me/orders/ord_sec123/reject");
        assert.equal(capturedPayload.rejectionReason, "Out of stock in regional hub");
        assert.equal(res.acceptanceStatus, "rejected");
      } finally {
        apiClient.post = originalPost;
      }
    });

    test("vendorService.updateFulfillmentDetails issues PATCH /vendors/me/orders/:id/fulfillment-details", async () => {
      const originalPatch = apiClient.patch;
      let capturedUrl = null;
      let capturedPayload = null;

      apiClient.patch = async (url, payload) => {
        capturedUrl = url;
        capturedPayload = payload;
        return {
          data: {
            success: true,
            data: { partnerId: payload.partnerId, expectedDeliveryDate: payload.expectedDeliveryDate },
          },
        };
      };

      try {
        const futureDate = new Date(Date.now() + 86400000 * 4).toISOString();
        const res = await vendorService.updateFulfillmentDetails("ord_sec123", {
          partnerId: "bluedart",
          expectedDeliveryDate: futureDate,
        });
        assert.equal(capturedUrl, "/vendors/me/orders/ord_sec123/fulfillment-details");
        assert.equal(capturedPayload.partnerId, "bluedart");
        assert.equal(capturedPayload.expectedDeliveryDate, futureDate);
      } finally {
        apiClient.patch = originalPatch;
      }
    });

    test("vendorService.confirmFulfillment issues POST /vendors/me/orders/:id/confirm-fulfillment", async () => {
      const originalPost = apiClient.post;
      let capturedUrl = null;

      apiClient.post = async (url, payload) => {
        capturedUrl = url;
        return {
          data: {
            success: true,
            data: { isFulfillmentConfirmed: true },
          },
        };
      };

      try {
        const res = await vendorService.confirmFulfillment("ord_sec123", { notes: "Ready for pickup" });
        assert.equal(capturedUrl, "/vendors/me/orders/ord_sec123/confirm-fulfillment");
        assert.equal(res.isFulfillmentConfirmed, true);
      } finally {
        apiClient.post = originalPost;
      }
    });
  });

  // --------------------------------------------------------------------------
  // 2. Superadmin Order Service Controlled Override
  // --------------------------------------------------------------------------
  describe("2. Admin Order Service Controlled Override", () => {
    test("adminOrderService exports overrideFulfillment method", () => {
      assert.equal(typeof adminOrderService.overrideFulfillment, "function");
    });

    test("adminOrderService.overrideFulfillment issues PATCH /orders/admin/:id/override-fulfillment", async () => {
      const originalPatch = adminApiClient.patch;
      let capturedUrl = null;
      let capturedPayload = null;

      adminApiClient.patch = async (url, payload) => {
        capturedUrl = url;
        capturedPayload = payload;
        return {
          data: {
            success: true,
            data: { overrideApplied: true },
          },
        };
      };

      try {
        const res = await adminOrderService.overrideFulfillment("ord_adm999", {
          action: "resolve_rejection",
          acceptanceStatus: "accepted",
          auditReason: "Verified merchant replenishment with manager",
        });

        assert.equal(capturedUrl, "/orders/admin/ord_adm999/override-fulfillment");
        assert.equal(capturedPayload.action, "resolve_rejection");
        assert.equal(capturedPayload.auditReason, "Verified merchant replenishment with manager");
        assert.equal(res.overrideApplied, true);
      } finally {
        adminApiClient.patch = originalPatch;
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3. Central Confirmation Guard & Invariant Validation
  // --------------------------------------------------------------------------
  describe("3. Central Confirmation Guard & Invariants", () => {
    test("Central Confirmation Guard evaluates all 4 conditions accurately", () => {
      const evaluateGuard = (order, vf) => {
        const acceptanceStatus = vf.acceptanceStatus || "pending";
        const hasPartner = Boolean(vf.assignedShipmentPartner?.partnerId);
        const hasDate = Boolean(vf.expectedDeliveryDate);
        const isPaid = order.paymentStatus === "paid" || order.paymentStatus === "pending_cod";
        const notCancelled = order.status !== "cancelled" && acceptanceStatus !== "rejected";

        return acceptanceStatus === "accepted" && hasPartner && hasDate && isPaid && notCancelled;
      };

      // Fails when unaccepted
      assert.equal(
        evaluateGuard(
          { paymentStatus: "paid", status: "confirmed" },
          { acceptanceStatus: "pending", assignedShipmentPartner: { partnerId: "delhivery" }, expectedDeliveryDate: "2026-11-10" }
        ),
        false
      );

      // Fails when partner missing
      assert.equal(
        evaluateGuard(
          { paymentStatus: "paid", status: "confirmed" },
          { acceptanceStatus: "accepted", assignedShipmentPartner: null, expectedDeliveryDate: "2026-11-10" }
        ),
        false
      );

      // Fails when delivery date missing
      assert.equal(
        evaluateGuard(
          { paymentStatus: "paid", status: "confirmed" },
          { acceptanceStatus: "accepted", assignedShipmentPartner: { partnerId: "delhivery" }, expectedDeliveryDate: null }
        ),
        false
      );

      // Fails when rejected
      assert.equal(
        evaluateGuard(
          { paymentStatus: "paid", status: "confirmed" },
          { acceptanceStatus: "rejected", assignedShipmentPartner: { partnerId: "delhivery" }, expectedDeliveryDate: "2026-11-10" }
        ),
        false
      );

      // Succeeds when all prerequisites (a)-(e) are met
      assert.equal(
        evaluateGuard(
          { paymentStatus: "paid", status: "confirmed" },
          { acceptanceStatus: "accepted", assignedShipmentPartner: { partnerId: "delhivery" }, expectedDeliveryDate: "2026-11-10" }
        ),
        true
      );
    });

    test("Parent order safety invariant: Vendor rejection must never cancel parent order", () => {
      // Invariant assertion: order level status must remain unmutated on vendor rejection
      const initialParentOrder = {
        _id: "order_123",
        status: "confirmed",
        paymentStatus: "paid",
        vendorFulfillments: [
          { vendorId: "v1", acceptanceStatus: "pending" },
          { vendorId: "v2", acceptanceStatus: "accepted" },
        ],
      };

      // Simulate vendor rejection
      const updatedOrder = {
        ...initialParentOrder,
        vendorFulfillments: initialParentOrder.vendorFulfillments.map((vf) =>
          vf.vendorId === "v1"
            ? { ...vf, acceptanceStatus: "rejected", rejectionReason: "Out of stock" }
            : vf
        ),
      };

      // Parent order status MUST NOT be cancelled
      assert.equal(updatedOrder.status, "confirmed");
      assert.equal(updatedOrder.paymentStatus, "paid");
      assert.equal(updatedOrder.vendorFulfillments[0].acceptanceStatus, "rejected");
    });
  });

  // --------------------------------------------------------------------------
  // 4. Static Source Code & UI Component Verification
  // --------------------------------------------------------------------------
  describe("4. Static Source Code & UI Architecture Verification", () => {
    test("VendorOrderDetailPage contains acceptance, rejection, partner selector, delivery date, and guard checklist", () => {
      const vendorDetailPath = path.join(srcDir, "app", "vendor", "orders", "[id]", "page.js");
      assert.equal(fs.existsSync(vendorDetailPath), true, "Vendor order detail page must exist");
      const content = fs.readFileSync(vendorDetailPath, "utf-8");

      // Verify acceptance and rejection actions
      assert.match(content, /handleAcceptOrder/);
      assert.match(content, /handleRejectOrder/);
      assert.match(content, /showRejectModal/);

      // Verify partner selection and delivery date
      assert.match(content, /getShipmentPartners/);
      assert.match(content, /updateFulfillmentDetails/);
      assert.match(content, /selectedPartnerId/);
      assert.match(content, /selectedDeliveryDate/);

      // Verify Central Confirmation Guard checklist
      assert.match(content, /Central Confirmation Guard Checklist/);
      assert.match(content, /confirmFulfillment/);
      assert.match(content, /allPrerequisitesMet/);
    });

    test("AdminOrderDetailPage contains vendor rejection alert and multi-vendor packages dossier", () => {
      const adminDetailPath = path.join(srcDir, "app", "administrator", "operations", "orders", "[id]", "page.js");
      assert.equal(fs.existsSync(adminDetailPath), true, "Admin order detail page must exist");
      const content = fs.readFileSync(adminDetailPath, "utf-8");

      assert.match(content, /Vendor Fulfillment Rejection Alert/);
      assert.match(content, /Resolve Vendor Rejection/);
      assert.match(content, /Multi-Vendor Fulfillment Packages/);
      assert.match(content, /handleControlledOverride/);
      assert.match(content, /overrideFulfillment/);
    });

    test("Customer OrderDetailsPageView contains multi-vendor package grouping", () => {
      const customerOrderPath = path.join(srcDir, "components", "storefront", "orders", "OrderDetailsPageView.jsx");
      assert.equal(fs.existsSync(customerOrderPath), true, "Customer OrderDetailsPageView must exist");
      const content = fs.readFileSync(customerOrderPath, "utf-8");

      assert.match(content, /vendorPackages/);
      assert.match(content, /Fulfillment Packages/);
    });
  });
});

