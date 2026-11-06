import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "../../");
const srcDir = path.join(frontendDir, "src");

// Mock apiClient and adminApiClient before importing services
import { vendorService } from "../../src/services/vendor.service.js";
import { adminVendorService } from "../../src/services/admin/vendor.service.js";
import apiClient from "../../src/lib/api/axios.js";
import adminApiClient from "../../src/lib/api/admin-axios.js";

describe("Phase VD-04: Vendor Store Branding & KYC Modernization Frontend Tests", () => {
  // --------------------------------------------------------------------------
  // 1. Vendor API Client Contract & Branding Methods
  // --------------------------------------------------------------------------
  describe("1. Vendor Service API Client Contracts", () => {
    test("vendorService exports all VD-04 store branding and KYC methods", () => {
      assert.equal(typeof vendorService.getMyBranding, "function");
      assert.equal(typeof vendorService.updateMyBranding, "function");
      assert.equal(typeof vendorService.uploadBrandingAsset, "function");
      assert.equal(typeof vendorService.getPublicStore, "function");
      assert.equal(typeof vendorService.getMyKycStatus, "function");
      assert.equal(typeof vendorService.uploadKycDocument, "function");
      assert.equal(typeof vendorService.downloadMyKycDocument, "function");
    });

    test("vendorService.getMyBranding issues GET /vendors/me/branding", async () => {
      const originalGet = apiClient.get;
      let capturedUrl = null;

      apiClient.get = async (url) => {
        capturedUrl = url;
        return {
          data: {
            success: true,
            data: { branding: { displayName: "Alpha Electronics" } },
          },
        };
      };

      try {
        const res = await vendorService.getMyBranding();
        assert.equal(capturedUrl, "/vendors/me/branding");
        assert.equal(res.data.data.branding.displayName, "Alpha Electronics");
      } finally {
        apiClient.get = originalGet;
      }
    });

    test("vendorService.updateMyBranding issues PATCH /vendors/me/branding with payload", async () => {
      const originalPatch = apiClient.patch;
      let capturedUrl = null;
      let capturedPayload = null;

      apiClient.patch = async (url, payload) => {
        capturedUrl = url;
        capturedPayload = payload;
        return {
          data: {
            success: true,
            data: { branding: payload },
          },
        };
      };

      try {
        const payload = {
          displayName: "Alpha Elite",
          description: "Premium electronics store",
        };
        const res = await vendorService.updateMyBranding(payload);
        assert.equal(capturedUrl, "/vendors/me/branding");
        assert.deepEqual(capturedPayload, payload);
        assert.equal(res.data.data.branding.displayName, "Alpha Elite");
      } finally {
        apiClient.patch = originalPatch;
      }
    });

    test("vendorService.uploadBrandingAsset issues POST /vendors/me/branding/upload with multipart/form-data", async () => {
      const originalPost = apiClient.post;
      let capturedUrl = null;
      let capturedHeaders = null;

      apiClient.post = async (url, formData, config) => {
        capturedUrl = url;
        capturedHeaders = config?.headers;
        return {
          data: {
            success: true,
            data: { url: "/uploads/store-branding/logo-123.png" },
          },
        };
      };

      try {
        const dummyFormData = {};
        const res = await vendorService.uploadBrandingAsset(dummyFormData);
        assert.equal(capturedUrl, "/vendors/me/branding/upload");
        assert.equal(capturedHeaders?.["Content-Type"], "multipart/form-data");
        assert.equal(res.data.data.url, "/uploads/store-branding/logo-123.png");
      } finally {
        apiClient.post = originalPost;
      }
    });

    test("vendorService.getPublicStore issues GET /vendors/store/:slug without auth dependency", async () => {
      const originalGet = apiClient.get;
      let capturedUrl = null;

      apiClient.get = async (url) => {
        capturedUrl = url;
        return {
          data: {
            success: true,
            data: { store: { displayName: "Public Store", businessSlug: "public-store" } },
          },
        };
      };

      try {
        const res = await vendorService.getPublicStore("public-store");
        assert.equal(capturedUrl, "/vendors/store/public-store");
        assert.equal(res.data.data.store.businessSlug, "public-store");
      } finally {
        apiClient.get = originalGet;
      }
    });

    test("vendorService.getMyKycStatus issues GET /vendors/me/kyc", async () => {
      const originalGet = apiClient.get;
      let capturedUrl = null;

      apiClient.get = async (url) => {
        capturedUrl = url;
        return {
          data: {
            success: true,
            data: { kycStatus: "pending", documents: [] },
          },
        };
      };

      try {
        const res = await vendorService.getMyKycStatus();
        assert.equal(capturedUrl, "/vendors/me/kyc");
        assert.equal(res.data.data.kycStatus, "pending");
      } finally {
        apiClient.get = originalGet;
      }
    });

    test("vendorService.uploadKycDocument issues POST /vendors/me/kyc/upload with multipart/form-data", async () => {
      const originalPost = apiClient.post;
      let capturedUrl = null;
      let capturedHeaders = null;

      apiClient.post = async (url, formData, config) => {
        capturedUrl = url;
        capturedHeaders = config?.headers;
        return {
          data: {
            success: true,
            data: { document: { status: "pending", documentCategory: "identity_proof" } },
          },
        };
      };

      try {
        const dummyFormData = {};
        const res = await vendorService.uploadKycDocument(dummyFormData);
        assert.equal(capturedUrl, "/vendors/me/kyc/upload");
        assert.equal(capturedHeaders?.["Content-Type"], "multipart/form-data");
        assert.equal(res.data.data.document.documentCategory, "identity_proof");
      } finally {
        apiClient.post = originalPost;
      }
    });

    test("vendorService.downloadMyKycDocument issues GET /vendors/me/kyc/documents/:id/download with blob", async () => {
      const originalGet = apiClient.get;
      let capturedUrl = null;
      let capturedConfig = null;

      apiClient.get = async (url, config) => {
        capturedUrl = url;
        capturedConfig = config;
        return {
          data: new ArrayBuffer(8),
        };
      };

      try {
        const res = await vendorService.downloadMyKycDocument("doc_123");
        assert.equal(capturedUrl, "/vendors/me/kyc/documents/doc_123/download");
        assert.equal(capturedConfig?.responseType, "blob");
        assert.ok(res.data instanceof ArrayBuffer);
      } finally {
        apiClient.get = originalGet;
      }
    });
  });

  // --------------------------------------------------------------------------
  // 2. Admin KYC Service Client Contracts
  // --------------------------------------------------------------------------
  describe("2. Admin Vendor KYC Service Client Contracts", () => {
    test("adminVendorService exports KYC reviewer methods", () => {
      assert.equal(typeof adminVendorService.listKycQueue, "function");
      assert.equal(typeof adminVendorService.reviewKycDocument, "function");
      assert.equal(typeof adminVendorService.downloadKycDocument, "function");
    });

    test("adminVendorService.listKycQueue issues GET /admin/vendors/kyc/queue with query params", async () => {
      const originalGet = adminApiClient.get;
      let capturedUrl = null;
      let capturedParams = null;

      adminApiClient.get = async (url, config) => {
        capturedUrl = url;
        capturedParams = config?.params;
        return {
          data: {
            success: true,
            data: { items: [], meta: { total: 0 } },
          },
        };
      };

      try {
        const res = await adminVendorService.listKycQueue({ status: "pending", page: 1 });
        assert.equal(capturedUrl, "/admin/vendors/kyc/queue");
        assert.equal(capturedParams?.status, "pending");
        assert.equal(capturedParams?.page, 1);
        assert.ok(Array.isArray(res.items));
      } finally {
        adminApiClient.get = originalGet;
      }
    });

    test("adminVendorService.reviewKycDocument issues POST /admin/vendors/:id/kyc/documents/:docId/review", async () => {
      const originalPost = adminApiClient.post;
      let capturedUrl = null;
      let capturedPayload = null;

      adminApiClient.post = async (url, payload) => {
        capturedUrl = url;
        capturedPayload = payload;
        return {
          data: {
            success: true,
            data: { document: { status: "approved" } },
          },
        };
      };

      try {
        const res = await adminVendorService.reviewKycDocument("ven_123", "doc_456", {
          status: "approved",
        });
        assert.equal(capturedUrl, "/admin/vendors/ven_123/kyc/documents/doc_456/review");
        assert.equal(capturedPayload?.status, "approved");
        assert.equal(res.document.status, "approved");
      } finally {
        adminApiClient.post = originalPost;
      }
    });

    test("adminVendorService.downloadKycDocument issues GET /admin/vendors/:id/kyc/documents/:docId/download with blob", async () => {
      const originalGet = adminApiClient.get;
      let capturedUrl = null;
      let capturedConfig = null;

      adminApiClient.get = async (url, config) => {
        capturedUrl = url;
        capturedConfig = config;
        return {
          data: new ArrayBuffer(16),
        };
      };

      try {
        const res = await adminVendorService.downloadKycDocument("ven_123", "doc_456");
        assert.equal(capturedUrl, "/admin/vendors/ven_123/kyc/documents/doc_456/download");
        assert.equal(capturedConfig?.responseType, "blob");
        assert.ok(res instanceof ArrayBuffer);
      } finally {
        adminApiClient.get = originalGet;
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3. UI Component & Route Integrity
  // --------------------------------------------------------------------------
  describe("3. UI Component & Route Registrations", () => {
    test("VendorSidebar.jsx includes Compliance & KYC navigation link", () => {
      const sidebarPath = path.join(srcDir, "components/vendor/VendorSidebar.jsx");
      assert.ok(fs.existsSync(sidebarPath), "VendorSidebar.jsx must exist");
      const content = fs.readFileSync(sidebarPath, "utf-8");
      assert.ok(content.includes("/vendor/compliance"), "Sidebar must contain link to /vendor/compliance");
      assert.ok(content.includes("Compliance & KYC"), "Sidebar must have label 'Compliance & KYC'");
    });

    test("Vendor compliance page exists at /vendor/compliance/page.js and handles 4 document categories", () => {
      const compliancePagePath = path.join(srcDir, "app/vendor/compliance/page.js");
      assert.ok(fs.existsSync(compliancePagePath), "vendor/compliance/page.js must exist");
      const content = fs.readFileSync(compliancePagePath, "utf-8");
      assert.ok(content.includes('"use client"'), "Must be client component");
      assert.ok(content.includes("identity_proof"), "Must support identity_proof category");
      assert.ok(content.includes("business_registration"), "Must support business_registration category");
      assert.ok(content.includes("tax_id"), "Must support tax_id category");
      assert.ok(content.includes("address_proof"), "Must support address_proof category");
      assert.ok(content.includes("vendorService.uploadKycDocument"), "Must call uploadKycDocument");
      assert.ok(content.includes("vendorService.downloadMyKycDocument"), "Must call downloadMyKycDocument");
    });

    test("Vendor store settings page (/vendor/store/page.js) integrates Storefront Branding section", () => {
      const storePagePath = path.join(srcDir, "app/vendor/store/page.js");
      assert.ok(fs.existsSync(storePagePath), "vendor/store/page.js must exist");
      const content = fs.readFileSync(storePagePath, "utf-8");
      assert.ok(content.includes("Storefront Brand Identity"), "Must have Storefront Branding section");
      assert.ok(content.includes("vendorService.updateMyBranding"), "Must call updateMyBranding");
      assert.ok(content.includes("vendorService.uploadBrandingAsset"), "Must call uploadBrandingAsset");
      assert.ok(content.includes("Preview Storefront"), "Must have Preview Storefront action");
    });

    test("Public storefront page exists at /stores/[slug]/page.js and renders public store profile", () => {
      const storePagePath = path.join(srcDir, "app/(storefront)/stores/[slug]/page.js");
      const storeViewPath = path.join(srcDir, "app/(storefront)/stores/[slug]/StorefrontPageView.jsx");

      assert.ok(fs.existsSync(storePagePath), "stores/[slug]/page.js must exist");
      assert.ok(fs.existsSync(storeViewPath), "StorefrontPageView.jsx must exist");

      const pageContent = fs.readFileSync(storePagePath, "utf-8");
      const viewContent = fs.readFileSync(storeViewPath, "utf-8");

      assert.ok(pageContent.includes("vendorService.getPublicStore"), "page.js must call getPublicStore");
      assert.ok(viewContent.includes("policies"), "StorefrontPageView must render store policies");
    });

    test("Admin vendor detail page (/administrator/vendors/[id]/page.js) integrates KYC Review section", () => {
      const adminDetailPagePath = path.join(srcDir, "app/administrator/vendors/[id]/page.js");
      assert.ok(fs.existsSync(adminDetailPagePath), "administrator/vendors/[id]/page.js must exist");
      const content = fs.readFileSync(adminDetailPagePath, "utf-8");

      assert.ok(content.includes("adminVendorService.reviewKycDocument"), "Must call reviewKycDocument");
      assert.ok(content.includes("adminVendorService.downloadKycDocument"), "Must call downloadKycDocument");
      assert.ok(content.includes("Vendor KYC Verification & Compliance Documents"), "Must have KYC section header");
      assert.ok(content.includes("kycStatus"), "Must display kycStatus badge");
    });
  });
});
