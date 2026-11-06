import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { productService } from "../../src/services/product.service.js";
import { vendorService } from "../../src/services/vendor.service.js";

describe("Buybox Phase 4B — Digital Product Management & Customer Downloads Unit Tests", () => {
  // ----------------------------------------------------
  // 1. Service Interface & Endpoint Signatures
  // ----------------------------------------------------
  describe("1. Service Interface & Endpoint Signatures", () => {
    test("productService exposes uploadDigitalAsset method", () => {
      assert.equal(typeof productService.uploadDigitalAsset, "function");
    });

    test("productService exposes getMyDigitalDownloads method", () => {
      assert.equal(typeof productService.getMyDigitalDownloads, "function");
    });

    test("productService exposes downloadDigitalAsset method", () => {
      assert.equal(typeof productService.downloadDigitalAsset, "function");
    });

    test("vendorService exposes uploadDigitalAsset method matching product service contract", () => {
      assert.equal(typeof vendorService.uploadDigitalAsset, "function");
    });
  });

  // ----------------------------------------------------
  // 2. File Metadata Formatting & Size Utilities
  // ----------------------------------------------------
  describe("2. File Metadata & Availability Calculations", () => {
    function formatBytes(bytes) {
      if (!bytes || bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    test("formats digital file sizes accurately across magnitude boundaries", () => {
      assert.equal(formatBytes(0), "0 B");
      assert.equal(formatBytes(512), "512 B");
      assert.equal(formatBytes(1024), "1 KB");
      assert.equal(formatBytes(1048576), "1 MB");
      assert.equal(formatBytes(15728640), "15 MB");
    });

    function calculateEntitlementStatus(ent) {
      const now = new Date();
      const isRevoked = ent.status === "revoked";
      const isExpired = ent.expiresAt ? new Date(ent.expiresAt) < now : false;
      const isExhausted =
        ent.downloadLimit !== null ? ent.downloadCount >= ent.downloadLimit : false;

      let effectiveStatus = "active";
      if (isRevoked) {
        effectiveStatus = "revoked";
      } else if (isExpired) {
        effectiveStatus = "expired";
      } else if (isExhausted) {
        effectiveStatus = "exhausted";
      }

      const isAvailable = !isRevoked && !isExpired && !isExhausted;
      const remainingDownloads =
        ent.downloadLimit === null
          ? null
          : Math.max(0, ent.downloadLimit - ent.downloadCount);

      return {
        effectiveStatus,
        isAvailable,
        remainingDownloads,
      };
    }

    test("identifies active and available digital download with remaining quota", () => {
      const entitlement = {
        status: "active",
        downloadLimit: 5,
        downloadCount: 2,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };
      const result = calculateEntitlementStatus(entitlement);
      assert.equal(result.effectiveStatus, "active");
      assert.equal(result.isAvailable, true);
      assert.equal(result.remainingDownloads, 3);
    });

    test("identifies exhausted status when download count reaches limit", () => {
      const entitlement = {
        status: "active",
        downloadLimit: 3,
        downloadCount: 3,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };
      const result = calculateEntitlementStatus(entitlement);
      assert.equal(result.effectiveStatus, "exhausted");
      assert.equal(result.isAvailable, false);
      assert.equal(result.remainingDownloads, 0);
    });

    test("identifies expired status when expiration date is in the past", () => {
      const entitlement = {
        status: "active",
        downloadLimit: 10,
        downloadCount: 1,
        expiresAt: new Date(Date.now() - 86400000).toISOString(),
      };
      const result = calculateEntitlementStatus(entitlement);
      assert.equal(result.effectiveStatus, "expired");
      assert.equal(result.isAvailable, false);
      assert.equal(result.remainingDownloads, 9);
    });

    test("identifies revoked status immediately with zero availability", () => {
      const entitlement = {
        status: "revoked",
        downloadLimit: 10,
        downloadCount: 1,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };
      const result = calculateEntitlementStatus(entitlement);
      assert.equal(result.effectiveStatus, "revoked");
      assert.equal(result.isAvailable, false);
    });

    test("handles unlimited downloads (downloadLimit = null) properly", () => {
      const entitlement = {
        status: "active",
        downloadLimit: null,
        downloadCount: 99,
        expiresAt: null,
      };
      const result = calculateEntitlementStatus(entitlement);
      assert.equal(result.effectiveStatus, "active");
      assert.equal(result.isAvailable, true);
      assert.equal(result.remainingDownloads, null);
    });
  });

  // ----------------------------------------------------
  // 3. Digital Settings Form State Validation
  // ----------------------------------------------------
  describe("3. Digital Settings Form Payload Builder", () => {
    function buildProductSavePayload(formData) {
      const payload = {
        name: formData.name,
        price: Number(formData.price),
        isVirtual: Boolean(formData.isVirtual),
        isDownloadable: Boolean(formData.isDownloadable),
      };

      if (formData.isDownloadable) {
        payload.downloadableFiles = formData.downloadableFiles || [];
        payload.downloadLimit =
          formData.downloadLimit === "" || formData.downloadLimit === null
            ? null
            : Number(formData.downloadLimit);
        payload.downloadExpiryDays =
          formData.downloadExpiryDays === "" || formData.downloadExpiryDays === null
            ? null
            : Number(formData.downloadExpiryDays);
      } else {
        payload.downloadableFiles = [];
        payload.downloadLimit = null;
        payload.downloadExpiryDays = null;
      }

      return payload;
    }

    test("formats downloadable product payload with files and limits", () => {
      const form = {
        name: "React 19 Deep Dive",
        price: 499,
        isVirtual: true,
        isDownloadable: true,
        downloadLimit: "5",
        downloadExpiryDays: "30",
        downloadableFiles: [
          {
            id: "file-123",
            name: "React 19 PDF",
            fileUrl: "digital://key-123",
            storageKey: "key-123",
            fileSize: 1024,
            mimeType: "application/pdf",
          },
        ],
      };

      const payload = buildProductSavePayload(form);
      assert.equal(payload.isVirtual, true);
      assert.equal(payload.isDownloadable, true);
      assert.equal(payload.downloadLimit, 5);
      assert.equal(payload.downloadExpiryDays, 30);
      assert.equal(payload.downloadableFiles.length, 1);
    });

    test("clears digital files and limits when isDownloadable is false", () => {
      const form = {
        name: "Physical Hardware Gizmo",
        price: 1999,
        isVirtual: false,
        isDownloadable: false,
        downloadLimit: "10",
        downloadExpiryDays: "60",
        downloadableFiles: [{ id: "stale-file" }],
      };

      const payload = buildProductSavePayload(form);
      assert.equal(payload.isVirtual, false);
      assert.equal(payload.isDownloadable, false);
      assert.equal(payload.downloadLimit, null);
      assert.equal(payload.downloadExpiryDays, null);
      assert.equal(payload.downloadableFiles.length, 0);
    });

    test("supports pure virtual product with no downloads", () => {
      const form = {
        name: "1-on-1 Architecture Consultation",
        price: 5000,
        isVirtual: true,
        isDownloadable: false,
      };

      const payload = buildProductSavePayload(form);
      assert.equal(payload.isVirtual, true);
      assert.equal(payload.isDownloadable, false);
      assert.equal(payload.downloadableFiles.length, 0);
    });
  });
});
