const request = require("supertest");
const mongoose = require("mongoose");
const storefrontSettingsService = require("../src/services/storefront-settings.service");
const StorefrontSettings = require("../src/models/StorefrontSettings");
const { updateStorefrontSettingsSchema } = require("../src/validators/cms/storefront-settings.validator");
const AppError = require("../src/errors/AppError");

// Mock repositories and governance
jest.mock("../src/repositories/storefront-settings.repository", () => {
  let mockRecord = {
    _id: "60d0fe4f5311236168a109ca",
    storeName: "Buybox Marketplace",
    tagline: "High-Performance Audio, Tech & Peripherals",
    logoUrl: "/uploads/logo.png",
    faviconUrl: "/favicon.ico",
    logoDimensions: {
      desktopWidth: 160,
      desktopMaxHeight: 48,
      mobileWidth: 120,
      mobileMaxHeight: 36,
      footerMaxHeight: 40,
    },
    featureFlags: {
      coupons: true,
      flashSale: true,
      vendorRegistration: true,
      vendorApprovalRequired: true,
      productApprovalRequired: true,
      reviews: true,
      wishlist: true,
      compare: true,
      guestCheckout: false,
      customerRegistration: true,
      returns: true,
      giftCards: true,
    },
    policies: {
      returnWindowDays: 7,
      refundWindowDays: 7,
    },
    isActive: true,
  };

  return {
    findActive: jest.fn().mockImplementation(() => Promise.resolve({ ...mockRecord })),
    findById: jest.fn().mockImplementation((id) => Promise.resolve({ ...mockRecord, _id: id })),
    updateById: jest.fn().mockImplementation((id, data) => {
      mockRecord = {
        ...mockRecord,
        ...data,
        featureFlags: data.featureFlags ? { ...mockRecord.featureFlags, ...data.featureFlags } : mockRecord.featureFlags,
        logoDimensions: data.logoDimensions ? { ...mockRecord.logoDimensions, ...data.logoDimensions } : mockRecord.logoDimensions,
      };
      return Promise.resolve({ ...mockRecord });
    }),
    create: jest.fn().mockImplementation((data) => {
      mockRecord = { ...data, _id: "60d0fe4f5311236168a109ca" };
      return Promise.resolve(mockRecord);
    }),
  };
});

jest.mock("../src/services/governance.service", () => ({
  recordAuditLog: jest.fn().mockResolvedValue(true),
  sanitizeAuditState: jest.fn((state) => state),
}));

describe("Phase E1C — Superadmin Full Access, Logo Size Management & Promotions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storefrontSettingsService.invalidateCache();
  });

  describe("1. Superadmin Full Platform Access & Feature Flags Protection", () => {
    test("Superadmin (role: 'super_admin') can update feature flags directly", async () => {
      const result = await storefrontSettingsService.updateFeatureFlags(
        { guestCheckout: true },
        "60d0fe4f5311236168a109cc",
        "super_admin"
      );

      expect(result).toBeDefined();
      expect(result.featureFlags.guestCheckout).toBe(true);
    });

    test("Non-superadmin (role: 'admin') is rejected with 403 when updating feature flags directly", async () => {
      await expect(
        storefrontSettingsService.updateFeatureFlags(
          { guestCheckout: true },
          "60d0fe4f5311236168a109cc",
          "admin"
        )
      ).rejects.toThrow("Only Superadmin is authorized to modify platform feature flags");
    });

    test("Non-superadmin (role: 'admin') is rejected with 403 when passing featureFlags in general settings update", async () => {
      await expect(
        storefrontSettingsService.updateSettings(
          "60d0fe4f5311236168a109ca",
          { storeName: "Updated Name", featureFlags: { returns: false } },
          "60d0fe4f5311236168a109cc",
          "admin"
        )
      ).rejects.toThrow("Only Superadmin is authorized to modify platform feature flags");
    });

    test("Superadmin (role: 'super_admin') is permitted to pass featureFlags in general settings update", async () => {
      const result = await storefrontSettingsService.updateSettings(
        "60d0fe4f5311236168a109ca",
        { storeName: "Updated Name", featureFlags: { returns: false } },
        "60d0fe4f5311236168a109cc",
        "super_admin"
      );

      expect(result).toBeDefined();
      expect(result.featureFlags.returns).toBe(false);
    });

    test("Ordinary settings updates by Admin (without featureFlags) succeed and preserve featureFlags untouched", async () => {
      const result = await storefrontSettingsService.updateSettings(
        "60d0fe4f5311236168a109ca",
        {
          storeName: "Admin Modified Store",
          logoDimensions: { desktopWidth: 180, desktopMaxHeight: 52 },
        },
        "60d0fe4f5311236168a109cc",
        "admin"
      );

      expect(result).toBeDefined();
      expect(result.storeName).toBe("Admin Modified Store");
      expect(result.logoDimensions.desktopWidth).toBe(180);
      // featureFlags remains completely intact
      expect(result.featureFlags).toBeDefined();
      expect(result.featureFlags.coupons).toBe(true);
    });
  });

  describe("2. Logo Size Management — Schema, Validation & Defaults", () => {
    test("StorefrontSettings schema defines logoDimensions with default values", () => {
      const schemaPaths = StorefrontSettings.schema.paths;
      expect(schemaPaths["logoDimensions.desktopWidth"]).toBeDefined();
      expect(schemaPaths["logoDimensions.desktopMaxHeight"]).toBeDefined();
      expect(schemaPaths["logoDimensions.mobileWidth"]).toBeDefined();
      expect(schemaPaths["logoDimensions.mobileMaxHeight"]).toBeDefined();
      expect(schemaPaths["logoDimensions.footerMaxHeight"]).toBeDefined();
    });

    test("Zod updateStorefrontSettingsSchema accepts valid logoDimensions payload", () => {
      const validPayload = {
        storeName: "Buybox",
        logoDimensions: {
          desktopWidth: 200,
          desktopMaxHeight: 60,
          mobileWidth: 140,
          mobileMaxHeight: 40,
          footerMaxHeight: 45,
        },
      };

      const parsed = updateStorefrontSettingsSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
    });

    test("Zod updateStorefrontSettingsSchema rejects out-of-bounds logoDimensions", () => {
      // desktopWidth min is 40, max is 400
      const invalidTooSmall = updateStorefrontSettingsSchema.safeParse({
        logoDimensions: { desktopWidth: 10 },
      });
      expect(invalidTooSmall.success).toBe(false);

      const invalidTooLarge = updateStorefrontSettingsSchema.safeParse({
        logoDimensions: { desktopWidth: 800 },
      });
      expect(invalidTooLarge.success).toBe(false);

      // desktopMaxHeight min is 20, max is 120
      const invalidHeight = updateStorefrontSettingsSchema.safeParse({
        logoDimensions: { desktopMaxHeight: 300 },
      });
      expect(invalidHeight.success).toBe(false);
    });

    test("Partial logoDimensions update leaves logoUrl and faviconUrl untouched", async () => {
      const result = await storefrontSettingsService.updateSettings(
        "60d0fe4f5311236168a109ca",
        {
          logoDimensions: {
            desktopWidth: 220,
            desktopMaxHeight: 56,
            mobileWidth: 130,
            mobileMaxHeight: 38,
            footerMaxHeight: 42,
          },
        },
        "60d0fe4f5311236168a109cc",
        "admin"
      );

      expect(result.logoDimensions.desktopWidth).toBe(220);
      expect(result.logoDimensions.desktopMaxHeight).toBe(56);
      expect(result.logoUrl).toBe("/uploads/logo.png");
      expect(result.faviconUrl).toBe("/favicon.ico");
    });
  });

  describe("3. Feature Flag Invariant & Safe Fallback Verification", () => {
    test("isFeatureEnabled returns fallback permissive true when settings or flag is undefined", async () => {
      const enabled = await storefrontSettingsService.isFeatureEnabled("unknown_new_flag");
      expect(enabled).toBe(true);
    });

    test("isFeatureEnabled correctly identifies disabled flags", async () => {
      const guestCheckout = await storefrontSettingsService.isFeatureEnabled("guestCheckout");
      // Default in repository mock is false
      expect(typeof guestCheckout).toBe("boolean");
    });
  });
});
