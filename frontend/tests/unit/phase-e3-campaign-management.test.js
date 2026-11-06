import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { campaignService } from "../../src/services/admin/admin.service.js";
import adminApiClient from "../../src/lib/api/admin-axios.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

describe("Phase E3 — Campaign Management & Create/Edit Workflow (Frontend)", () => {
  describe("1. Campaign Service API Client Contract", () => {
    test("campaignService exposes list, create, update, schedule, duplicate, archive, activate, deactivate", () => {
      assert.equal(typeof campaignService.list, "function");
      assert.equal(typeof campaignService.create, "function");
      assert.equal(typeof campaignService.update, "function");
      assert.equal(typeof campaignService.schedule, "function");
      assert.equal(typeof campaignService.activate, "function");
      assert.equal(typeof campaignService.deactivate, "function");
      assert.equal(typeof campaignService.duplicate, "function");
      assert.equal(typeof campaignService.archive, "function");
      assert.equal(typeof campaignService.transitionStatus, "function");
    });

    test("campaignService.list passes query params correctly to /campaigns", async () => {
      const originalGet = adminApiClient.get;
      let capturedUrl = "";
      let capturedParams = null;

      adminApiClient.get = async (url, config) => {
        capturedUrl = url;
        capturedParams = config?.params;
        return {
          data: {
            success: true,
            data: {
              campaigns: [],
              pagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
              stats: { total: 0, active: 0, scheduled: 0, draft: 0, paused: 0, archived: 0 },
            },
          },
        };
      };

      try {
        const res = await campaignService.list({
          search: "festive",
          status: "active",
          type: "seasonal",
          page: 2,
          limit: 10,
        });

        assert.equal(capturedUrl, "/campaigns");
        assert.equal(capturedParams.search, "festive");
        assert.equal(capturedParams.status, "active");
        assert.equal(capturedParams.type, "seasonal");
        assert.equal(capturedParams.page, 2);
        assert.equal(capturedParams.limit, 10);
        assert.ok(res.campaigns);
      } finally {
        adminApiClient.get = originalGet;
      }
    });

    test("campaignService.duplicate calls POST /campaigns with duplicateFrom payload", async () => {
      const originalPost = adminApiClient.post;
      let capturedUrl = "";
      let capturedBody = null;

      adminApiClient.post = async (url, body) => {
        capturedUrl = url;
        capturedBody = body;
        return {
          data: {
            success: true,
            data: { _id: "new_copy_id", name: "Duplicated Campaign" },
          },
        };
      };

      try {
        const res = await campaignService.duplicate("orig_id_123");
        assert.equal(capturedUrl, "/campaigns");
        assert.deepEqual(capturedBody, { duplicateFrom: "orig_id_123" });
        assert.equal(res._id, "new_copy_id");
      } finally {
        adminApiClient.post = originalPost;
      }
    });

    test("campaignService.archive calls PATCH /campaigns/:id/status with archived status", async () => {
      const originalPatch = adminApiClient.patch;
      let capturedUrl = "";
      let capturedBody = null;

      adminApiClient.patch = async (url, body) => {
        capturedUrl = url;
        capturedBody = body;
        return {
          data: {
            success: true,
            data: { _id: "camp_456", status: "archived" },
          },
        };
      };

      try {
        const res = await campaignService.archive("camp_456");
        assert.equal(capturedUrl, "/campaigns/camp_456/status");
        assert.deepEqual(capturedBody, { status: "archived" });
        assert.equal(res.status, "archived");
      } finally {
        adminApiClient.patch = originalPatch;
      }
    });
  });

  describe("2. CampaignFormModal Component Contract & 7 Clear Sections", () => {
    const modalPath = path.join(
      rootDir,
      "src/components/admin/marketing/CampaignFormModal.jsx"
    );

    test("CampaignFormModal.jsx exists and exports a React component", () => {
      assert.ok(fs.existsSync(modalPath), "CampaignFormModal.jsx must exist");
      const content = fs.readFileSync(modalPath, "utf-8");
      assert.ok(content.includes("export function CampaignFormModal") || content.includes("export default CampaignFormModal"));
    });

    test("CampaignFormModal defines all 7 required form sections", () => {
      const content = fs.readFileSync(modalPath, "utf-8");
      assert.ok(content.includes("General Info"), "Section 1: General Info");
      assert.ok(content.includes("Schedule & Time"), "Section 2: Schedule & Time");
      assert.ok(content.includes("Creative Banner"), "Section 3: Creative Banner");
      assert.ok(content.includes("Destination URL"), "Section 4: Destination URL");
      assert.ok(content.includes("Audience & Scope"), "Section 5: Audience & Scope");
      assert.ok(content.includes("Discounts & Coupons"), "Section 6: Discounts & Coupons");
      assert.ok(content.includes("Review & Confirm"), "Section 7: Review & Confirm");
    });

    test("CampaignFormModal implements field-level validation and date order guard", () => {
      const content = fs.readFileSync(modalPath, "utf-8");
      assert.ok(content.includes("Campaign name is required"));
      assert.ok(content.includes("A URL slug is required"));
      assert.ok(content.includes("End date must be strictly after the start date"));
    });

    test("CampaignFormModal includes unsaved changes confirmation dialog", () => {
      const content = fs.readFileSync(modalPath, "utf-8");
      assert.ok(content.includes("Discard Unsaved Changes?"));
      assert.ok(content.includes("You have unsaved changes in this campaign form"));
    });

    test("CampaignFormModal supports file upload and creative asset preview", () => {
      const content = fs.readFileSync(modalPath, "utf-8");
      assert.ok(content.includes("adminMediaService.uploadMedia"));
      assert.ok(content.includes("Creative Asset Live Preview"));
    });

    test("CampaignFormModal supports linking authoritative ProductDiscounts and event Coupons", () => {
      const content = fs.readFileSync(modalPath, "utf-8");
      assert.ok(content.includes("discountService.list"));
      assert.ok(content.includes("couponService.list"));
      assert.ok(content.includes("Pricing Engine"));
    });
  });

  describe("3. Campaign Management Page UX & Architectural Invariants", () => {
    const pagePath = path.join(
      rootDir,
      "src/app/administrator/marketing/campaigns/page.js"
    );

    test("campaigns/page.js exists and exports page component", () => {
      assert.ok(fs.existsSync(pagePath), "campaigns/page.js must exist");
      const content = fs.readFileSync(pagePath, "utf-8");
      assert.ok(content.includes("export default function AdminCampaignsPage"));
    });

    test("campaigns/page.js renders 6 summary KPI cards with accurate states", () => {
      const content = fs.readFileSync(pagePath, "utf-8");
      assert.ok(content.includes("Total Campaigns"));
      assert.ok(content.includes("Live &amp; Active") || content.includes("Live & Active"));
      assert.ok(content.includes("Scheduled"));
      assert.ok(content.includes("Drafts"));
      assert.ok(content.includes("Paused"));
      assert.ok(content.includes("Completed / Archived"));
    });

    test("campaigns/page.js supports search, status pills, scope, type and date range filters", () => {
      const content = fs.readFileSync(pagePath, "utf-8");
      assert.ok(content.includes("Search name, slug..."));
      assert.ok(content.includes("All Campaigns"));
      assert.ok(content.includes("All Scopes"));
      assert.ok(content.includes("All Campaign Types"));
      assert.ok(content.includes("Starts From"));
      assert.ok(content.includes("Ends Before"));
    });

    test("campaigns/page.js supports server-side pagination with rows-per-page options", () => {
      const content = fs.readFileSync(pagePath, "utf-8");
      assert.ok(content.includes("Showing"));
      assert.ok(content.includes("10 per page"));
      assert.ok(content.includes("20 per page"));
      assert.ok(content.includes("50 per page"));
      assert.ok(content.includes("ChevronLeft"));
      assert.ok(content.includes("ChevronRight"));
    });

    test("campaigns/page.js supports lifecycle actions with confirmation dialogs", () => {
      const content = fs.readFileSync(pagePath, "utf-8");
      assert.ok(content.includes("Duplicate"));
      assert.ok(content.includes("Archive"));
      assert.ok(content.includes("Performance"));
      assert.ok(content.includes("actionConfirm"));
      assert.ok(content.includes("openCreateModal"));
    });
  });

  describe("4. Storefront Campaign Detail View Integration", () => {
    const storefrontDetailPath = path.join(
      rootDir,
      "src/app/(storefront)/campaign/[slug]/CampaignDetailView.jsx"
    );

    test("CampaignDetailView.jsx exists and renders creative banner overlay and staff preview badge", () => {
      assert.ok(fs.existsSync(storefrontDetailPath), "CampaignDetailView.jsx must exist");
      const content = fs.readFileSync(storefrontDetailPath, "utf-8");
      assert.ok(content.includes("campaign.bannerUrl"));
      assert.ok(content.includes("Staff Preview Mode (Unpublished)"));
      assert.ok(content.includes("campaign.type"));
    });
  });
});
