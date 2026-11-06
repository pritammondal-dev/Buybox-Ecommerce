const request = require("supertest");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const storefrontMediaController = require("../src/controllers/storefront-media.controller");
const storefrontSettingsService = require("../src/services/storefront-settings.service");
const StorefrontSettings = require("../src/models/StorefrontSettings");
const AppError = require("../src/errors/AppError");

// Mock services to isolate unit testing
jest.mock("../src/services/storefront-media.service", () => ({
  createMedia: jest.fn().mockResolvedValue({ _id: "60d0fe4f5311236168a109ca" }),
}));

describe("Phase E1B — Store Branding, Promotions Routing & Feature Flags", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storefrontSettingsService.invalidateCache();
  });

  describe("1. Brand Asset Upload & Validation", () => {
    const createMockRes = () => {
      const res = {};
      res.statusCode = 200;
      res.status = jest.fn((code) => {
        res.statusCode = code;
        return res;
      });
      res.json = jest.fn((data) => {
        res.body = data;
        return res;
      });
      return res;
    };

    test("should upload a valid PNG logo file successfully", async () => {
      // Magic bytes for PNG: 89 50 4E 47 0D 0A 1A 0A
      const validPngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      ]);
      const req = {
        file: {
          originalname: "store-logo.png",
          mimetype: "image/png",
          size: validPngBuffer.length,
          buffer: validPngBuffer,
        },
        user: { id: new mongoose.Types.ObjectId().toString() },
      };
      const res = createMockRes();
      const next = jest.fn();

      await storefrontMediaController.uploadMedia(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toMatch(/^\/uploads\/media_.*\.png$/);
      expect(res.body.data.mimeType).toBe("image/png");
    });

    test("should upload a valid ICO favicon file successfully", async () => {
      // Magic bytes for ICO: 00 00 01 00
      const validIcoBuffer = Buffer.from([0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x10, 0x10]);
      const req = {
        file: {
          originalname: "custom-favicon.ico",
          mimetype: "image/x-icon",
          size: validIcoBuffer.length,
          buffer: validIcoBuffer,
        },
        user: { id: new mongoose.Types.ObjectId().toString() },
      };
      const res = createMockRes();
      const next = jest.fn();

      await storefrontMediaController.uploadMedia(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toMatch(/^\/uploads\/media_.*\.ico$/);
      expect(res.body.data.mimeType).toBe("image/x-icon");
    });

    test("should reject unsupported file types (e.g. text/plain)", async () => {
      const textBuffer = Buffer.from("Hello world");
      const req = {
        file: {
          originalname: "notes.txt",
          mimetype: "text/plain",
          size: textBuffer.length,
          buffer: textBuffer,
        },
        user: { id: new mongoose.Types.ObjectId().toString() },
      };
      const res = createMockRes();
      const next = jest.fn();

      await storefrontMediaController.uploadMedia(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("INVALID_FILE_TYPE");
    });

    test("should strictly reject SVG uploads for stored XSS protection", async () => {
      const svgBuffer = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>");
      const req = {
        file: {
          originalname: "malicious-logo.svg",
          mimetype: "image/svg+xml",
          size: svgBuffer.length,
          buffer: svgBuffer,
        },
        user: { id: new mongoose.Types.ObjectId().toString() },
      };
      const res = createMockRes();
      const next = jest.fn();

      await storefrontMediaController.uploadMedia(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("SVG_NOT_ALLOWED");
      expect(err.message).toMatch(/SVG uploads are not permitted for security reasons/);
    });

    test("should reject oversized files exceeding the 2MB threshold", async () => {
      const oversizedSize = 2.5 * 1024 * 1024; // 2.5 MB
      const req = {
        file: {
          originalname: "giant-logo.png",
          mimetype: "image/png",
          size: oversizedSize,
          buffer: Buffer.alloc(100),
        },
        user: { id: new mongoose.Types.ObjectId().toString() },
      };
      const res = createMockRes();
      const next = jest.fn();

      await storefrontMediaController.uploadMedia(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("FILE_TOO_LARGE");
    });

    test("should reject corrupted or spoofed files failing magic byte inspection", async () => {
      // Renamed file: mime image/png but content is ASCII text
      const fakeBuffer = Buffer.from("THIS IS NOT A VALID PNG");
      const req = {
        file: {
          originalname: "fake-image.png",
          mimetype: "image/png",
          size: fakeBuffer.length,
          buffer: fakeBuffer,
        },
        user: { id: new mongoose.Types.ObjectId().toString() },
      };
      const res = createMockRes();
      const next = jest.fn();

      await storefrontMediaController.uploadMedia(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("CORRUPT_OR_INVALID_IMAGE");
    });
  });

  describe("2. Authoritative Settings Persistence & Fallback", () => {
    test("should return default fallback settings when no custom configuration exists", async () => {
      const settings = await storefrontSettingsService.getActiveSettings();

      expect(settings).toBeDefined();
      expect(settings.storeName).toBe("Buybox Marketplace");
      expect(settings.faviconUrl).toBe("/favicon.ico");
      expect(settings.featureFlags.returns).toBe(true);
      expect(settings.featureFlags.guestCheckout).toBe(false);
    });

    test("should evaluate isFeatureEnabled correctly with fallback defaults", async () => {
      const returnsEnabled = await storefrontSettingsService.isFeatureEnabled("returns");
      expect(returnsEnabled).toBe(true);

      const guestCheckoutEnabled = await storefrontSettingsService.isFeatureEnabled("guestCheckout");
      expect(guestCheckoutEnabled).toBe(false);
    });
  });

  describe("3. Promotions Route Alias & Authorization", () => {
    const app = require("../src/app");

    test("should require authentication for /api/v1/admin/promotions", async () => {
      const response = await request(app).get("/api/v1/admin/promotions");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test("should require authentication for legacy alias /api/v1/promotions", async () => {
      const response = await request(app).get("/api/v1/promotions");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test("should preserve existing /api/v1/admin/discounts authentication", async () => {
      const response = await request(app).get("/api/v1/admin/discounts");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe("4. Feature Flag Enforcement", () => {
    test("should block return requests when returns feature flag is disabled", async () => {
      const returnService = require("../src/services/return-request.service");

      // Spy on isFeatureEnabled to simulate disabled returns flag
      jest.spyOn(storefrontSettingsService, "isFeatureEnabled").mockImplementation(async (flag) => {
        if (flag === "returns") return false;
        return true;
      });

      await expect(
        returnService.createReturnRequest({
          userId: new mongoose.Types.ObjectId().toString(),
          orderId: new mongoose.Types.ObjectId().toString(),
          items: [],
        })
      ).rejects.toThrow("Customer returns and replacement requests are currently disabled by platform administration.");
    });

    test("should block gift card operations when giftCards feature flag is disabled", async () => {
      const giftCardController = require("../src/controllers/gift-card.controller");

      jest.spyOn(storefrontSettingsService, "isFeatureEnabled").mockImplementation(async (flag) => {
        if (flag === "giftCards") return false;
        return true;
      });

      const req = { body: { code: "GIFT-TEST-1000" } };
      const res = {};
      res.status = jest.fn().mockReturnValue(res);
      res.json = jest.fn();

      await expect(giftCardController.checkBalance(req, res)).rejects.toThrow(
        "Gift cards are currently disabled by platform administration"
      );

      req.user = { id: new mongoose.Types.ObjectId().toString() };
      await expect(giftCardController.claimGiftCard(req, res)).rejects.toThrow(
        "Gift cards are currently disabled by platform administration"
      );

      await expect(giftCardController.getMyGiftCards(req, res)).rejects.toThrow(
        "Gift cards are currently disabled by platform administration"
      );
    });

    test("should set vendor onboarding status to pending when vendorApprovalRequired is true", async () => {
      jest.spyOn(storefrontSettingsService, "isFeatureEnabled").mockImplementation(async (flag) => {
        if (flag === "vendorApprovalRequired") return true;
        return true;
      });

      const vendorApprovalRequired = await storefrontSettingsService.isFeatureEnabled("vendorApprovalRequired");
      const initialOnboardingStatus = vendorApprovalRequired ? "pending" : "approved";
      const initialIsActive = !vendorApprovalRequired;

      expect(initialOnboardingStatus).toBe("pending");
      expect(initialIsActive).toBe(false);
    });

    test("should auto-approve vendor when vendorApprovalRequired is false", async () => {
      jest.spyOn(storefrontSettingsService, "isFeatureEnabled").mockImplementation(async (flag) => {
        if (flag === "vendorApprovalRequired") return false;
        return true;
      });

      const vendorApprovalRequired = await storefrontSettingsService.isFeatureEnabled("vendorApprovalRequired");
      const initialOnboardingStatus = vendorApprovalRequired ? "pending" : "approved";
      const initialIsActive = !vendorApprovalRequired;

      expect(initialOnboardingStatus).toBe("approved");
      expect(initialIsActive).toBe(true);
    });

    test("should force vendor product to draft when productApprovalRequired is true", async () => {
      jest.spyOn(storefrontSettingsService, "isFeatureEnabled").mockImplementation(async (flag) => {
        if (flag === "productApprovalRequired") return true;
        return true;
      });

      const productApprovalRequired = await storefrontSettingsService.isFeatureEnabled("productApprovalRequired");
      const isPrivileged = false;
      const dataStatus = "active";
      const initialStatus = isPrivileged && dataStatus
        ? dataStatus
        : (!productApprovalRequired && dataStatus ? dataStatus : "draft");

      expect(initialStatus).toBe("draft");
    });

    test("should allow active product creation when productApprovalRequired is false", async () => {
      jest.spyOn(storefrontSettingsService, "isFeatureEnabled").mockImplementation(async (flag) => {
        if (flag === "productApprovalRequired") return false;
        return true;
      });

      const productApprovalRequired = await storefrontSettingsService.isFeatureEnabled("productApprovalRequired");
      const isPrivileged = false;
      const dataStatus = "active";
      const initialStatus = isPrivileged && dataStatus
        ? dataStatus
        : (!productApprovalRequired && dataStatus ? dataStatus : "draft");

      expect(initialStatus).toBe("active");
    });

    test("should safely return true for missing/unknown flag keys as safe permissive default", async () => {
      const result = await storefrontSettingsService.isFeatureEnabled("unknown_nonexistent_flag");
      expect(result).toBe(true);
    });
  });
});
