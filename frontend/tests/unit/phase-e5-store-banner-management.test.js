import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BANNER_SLOTS,
  BANNER_SECTIONS,
  BANNER_SLOT_MAP,
} from "../../src/constants/banner-slots.constants.js";
import {
  getBannerScheduleStatus,
  isBannerLinkValid,
  calculateBannerKPIs,
} from "../../src/utils/banner.util.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("PHASE E5 — Store Banner Management Frontend Unit Tests", () => {
  describe("1. Banner Slot Definitions & Groupings", () => {
    test("defines exactly 12 supported storefront banner slots matching backend enum", () => {
      assert.equal(BANNER_SLOTS.length, 12);
      const expectedSlots = [
        "hero_main",
        "hero_audio",
        "hero_smart_home",
        "hero_brand_deals",
        "mid_work_smarter",
        "mid_stylish_looks",
        "category_audio",
        "category_workspace",
        "category_smart_living",
        "bottom_home_kitchen",
        "bottom_smart_gadgets",
        "bottom_monsoon_special",
      ];
      expectedSlots.forEach((slotKey) => {
        assert.ok(
          BANNER_SLOTS.some((s) => s.slotKey === slotKey),
          `Slot ${slotKey} should be in BANNER_SLOTS`
        );
      });
    });

    test("BANNER_SLOT_MAP provides O(1) indexed lookup by slotKey", () => {
      assert.equal(typeof BANNER_SLOT_MAP, "object");
      assert.equal(BANNER_SLOT_MAP.hero_main.slotKey, "hero_main");
      assert.equal(BANNER_SLOT_MAP.hero_main.section, "hero_main");
      assert.equal(BANNER_SLOT_MAP.mid_work_smarter.section, "mid_page");
    });

    test("all slots provide recommended dimensions and titles for UI guidance", () => {
      BANNER_SLOTS.forEach((slot) => {
        assert.ok(slot.title, `Slot ${slot.slotKey} must have a title`);
        assert.ok(
          slot.recommendedDimensions,
          `Slot ${slot.slotKey} must have recommended dimensions`
        );
        assert.ok(
          slot.sectionLabel,
          `Slot ${slot.slotKey} must have a section label`
        );
      });
    });
  });

  describe("2. Banner Schedule Status Calculator", () => {
    test("returns 'inactive' when banner isActive is false", () => {
      const banner = { isActive: false, title: "Draft Banner" };
      const res = getBannerScheduleStatus(banner);
      assert.equal(res.status, "inactive");
      assert.equal(res.label, "Hidden / Inactive");
    });

    test("returns 'scheduled' when startsAt is in the future", () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const banner = {
        isActive: true,
        startsAt: futureDate,
        title: "Future Banner",
      };
      const res = getBannerScheduleStatus(banner);
      assert.equal(res.status, "scheduled");
      assert.ok(res.label.includes("Scheduled"));
    });

    test("returns 'expired' when endsAt is in the past", () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString();
      const banner = {
        isActive: true,
        endsAt: pastDate,
        title: "Expired Banner",
      };
      const res = getBannerScheduleStatus(banner);
      assert.equal(res.status, "expired");
      assert.ok(res.label.includes("Expired"));
    });

    test("returns 'active' when banner is active and within valid time window", () => {
      const start = new Date(Date.now() - 3600000).toISOString();
      const end = new Date(Date.now() + 3600000).toISOString();
      const banner = {
        isActive: true,
        startsAt: start,
        endsAt: end,
        title: "Live Banner",
      };
      const res = getBannerScheduleStatus(banner);
      assert.equal(res.status, "active");
      assert.equal(res.label, "Live on Storefront");
    });

    test("returns 'active' when banner has no start or end restrictions", () => {
      const banner = {
        isActive: true,
        startsAt: null,
        endsAt: null,
        title: "Evergreen Banner",
      };
      const res = getBannerScheduleStatus(banner);
      assert.equal(res.status, "active");
      assert.equal(res.label, "Live on Storefront");
    });
  });

  describe("3. Destination Link URL Validation Rules", () => {
    test("validates relative store paths", () => {
      assert.equal(isBannerLinkValid("/shop"), true);
      assert.equal(isBannerLinkValid("/shop?category=audio"), true);
      assert.equal(isBannerLinkValid("/campaigns/summer-deals"), true);
    });

    test("validates anchor links", () => {
      assert.equal(isBannerLinkValid("#brands"), true);
    });

    test("validates full http and https URLs", () => {
      assert.equal(isBannerLinkValid("https://buybox.market/special"), true);
      assert.equal(isBannerLinkValid("http://localhost:3000/shop"), true);
    });

    test("rejects unsafe JavaScript or invalid protocol strings", () => {
      assert.equal(isBannerLinkValid("javascript:alert(1)"), false);
      assert.equal(isBannerLinkValid("data:text/html"), false);
      assert.equal(isBannerLinkValid(""), false);
      assert.equal(isBannerLinkValid(null), false);
    });
  });

  describe("4. Dashboard KPI Calculations", () => {
    test("calculates active, inactive, scheduled, and slot coverage percentage accurately", () => {
      const mockBanners = [
        {
          _id: "1",
          slotKey: "hero_main",
          isActive: true,
        },
        {
          _id: "2",
          slotKey: "hero_audio",
          isActive: true,
          startsAt: new Date(Date.now() - 3600000).toISOString(),
          endsAt: new Date(Date.now() + 3600000).toISOString(),
        },
        {
          _id: "3",
          slotKey: "mid_work_smarter",
          isActive: false, // inactive
        },
      ];

      const kpis = calculateBannerKPIs(mockBanners, 12);
      assert.equal(kpis.total, 3);
      assert.equal(kpis.active, 2);
      assert.equal(kpis.inactive, 1);
      assert.equal(kpis.scheduled, 1);
      assert.equal(kpis.activeSlots, 2);
      assert.equal(kpis.totalSlots, 12);
      assert.equal(kpis.slotCoveragePercent, 17); // 2/12 = 16.6% -> 17%
    });
  });

  describe("5. Component Structure and Contract Integrity", () => {
    test("BannerSlotManager component exists and exports BannerSlotManager", () => {
      const filePath = path.resolve(
        __dirname,
        "../../src/components/admin/cms/BannerSlotManager.jsx"
      );
      assert.ok(fs.existsSync(filePath), "BannerSlotManager.jsx must exist");
      const content = fs.readFileSync(filePath, "utf-8");
      assert.match(content, /export function BannerSlotManager/);
      assert.match(content, /export default BannerSlotManager/);
    });

    test("StoreBannerFormModal component exists and provides 6 workflow sections", () => {
      const filePath = path.resolve(
        __dirname,
        "../../src/components/admin/cms/StoreBannerFormModal.jsx"
      );
      assert.ok(fs.existsSync(filePath), "StoreBannerFormModal.jsx must exist");
      const content = fs.readFileSync(filePath, "utf-8");
      assert.match(content, /export function StoreBannerFormModal/);
      assert.match(content, /FORM_SECTIONS/);
      assert.match(content, /General Information/);
      assert.match(content, /Artwork & Media/);
      assert.match(content, /Placement & Order/);
      assert.match(content, /Destination & Link/);
      assert.match(content, /Schedule & Status/);
      assert.match(content, /Preview & Publish/);
    });

    test("StoreBannerPreviewModal component exists and provides desktop/mobile preview modes", () => {
      const filePath = path.resolve(
        __dirname,
        "../../src/components/admin/cms/StoreBannerPreviewModal.jsx"
      );
      assert.ok(fs.existsSync(filePath), "StoreBannerPreviewModal.jsx must exist");
      const content = fs.readFileSync(filePath, "utf-8");
      assert.match(content, /export function StoreBannerPreviewModal/);
      assert.match(content, /setDeviceMode/);
      assert.match(content, /Desktop/);
      assert.match(content, /Mobile/);
    });
  });
});
