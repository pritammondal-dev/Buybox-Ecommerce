import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveBannerSlot } from "../../src/hooks/useBannerSlot.js";
import { BANNER_SLOT_MAP } from "../../src/constants/banner-slots.constants.js";

describe("Banner Slot Artwork Resolver Contract Tests", () => {
  const mockApiBanners = [
    {
      _id: "banner_1",
      title: "Audio Mega Deal",
      slotKey: "hero_audio",
      imageUrl: "https://cdn.example.com/audio-promo.webp",
      linkUrl: "/shop?category=audio&deal=active",
      altText: "Custom Audio Artwork",
      isActive: true,
    },
    {
      _id: "banner_2",
      title: "Smart Home Devices",
      slotKey: "hero_smart_home",
      imageUrl: "https://cdn.example.com/smart-home.webp",
      linkUrl: "/shop?category=smart-home",
      altText: "Custom Smart Home Artwork",
      isActive: false, // Inactive!
    },
    {
      _id: "banner_3",
      title: "Mid Page Work Smarter",
      placement: "mid_work_smarter", // Using placement alias
      imageUrl: "https://cdn.example.com/work-smarter.webp",
      linkUrl: "/shop?category=laptops",
      isActive: true,
    },
    {
      _id: "banner_4",
      title: "Empty Image URL Banner",
      slotKey: "bottom_smart_gadgets",
      imageUrl: "", // Invalid empty string
      isActive: true,
    },
  ];

  it("1. Priority 1: resolves active admin-managed artwork from API data", () => {
    const resolved = resolveBannerSlot(mockApiBanners, "hero_audio");

    assert.strictEqual(resolved.isCustom, true);
    assert.strictEqual(resolved.imageUrl, "https://cdn.example.com/audio-promo.webp");
    assert.strictEqual(resolved.linkUrl, "/shop?category=audio&deal=active");
    assert.strictEqual(resolved.altText, "Custom Audio Artwork");
    assert.strictEqual(resolved.fallbackImage, BANNER_SLOT_MAP.hero_audio.defaultImage);
    assert.strictEqual(resolved.slotKey, "hero_audio");
  });

  it("2. Priority 2: falls back to local asset when banners array is empty or undefined", () => {
    const resolvedEmpty = resolveBannerSlot([], "hero_brand_deals");
    assert.strictEqual(resolvedEmpty.isCustom, false);
    assert.strictEqual(resolvedEmpty.imageUrl, BANNER_SLOT_MAP.hero_brand_deals.defaultImage);
    assert.strictEqual(resolvedEmpty.linkUrl, BANNER_SLOT_MAP.hero_brand_deals.defaultLink);
    assert.strictEqual(resolvedEmpty.altText, BANNER_SLOT_MAP.hero_brand_deals.defaultAlt);

    const resolvedNull = resolveBannerSlot(null, "hero_brand_deals");
    assert.strictEqual(resolvedNull.isCustom, false);
    assert.strictEqual(resolvedNull.imageUrl, BANNER_SLOT_MAP.hero_brand_deals.defaultImage);
  });

  it("3. Priority 2: falls back to local asset when banner is inactive (isActive: false)", () => {
    const resolved = resolveBannerSlot(mockApiBanners, "hero_smart_home");

    assert.strictEqual(resolved.isCustom, false);
    assert.strictEqual(resolved.imageUrl, BANNER_SLOT_MAP.hero_smart_home.defaultImage);
    assert.strictEqual(resolved.linkUrl, BANNER_SLOT_MAP.hero_smart_home.defaultLink);
  });

  it("4. Priority 2: falls back to local asset when custom imageUrl is empty or invalid", () => {
    const resolved = resolveBannerSlot(mockApiBanners, "bottom_smart_gadgets");

    assert.strictEqual(resolved.isCustom, false);
    assert.strictEqual(resolved.imageUrl, BANNER_SLOT_MAP.bottom_smart_gadgets.defaultImage);
  });

  it("5. Supports 'placement' alias interoperability transparently", () => {
    const resolved = resolveBannerSlot(mockApiBanners, "mid_work_smarter");

    assert.strictEqual(resolved.isCustom, true);
    assert.strictEqual(resolved.imageUrl, "https://cdn.example.com/work-smarter.webp");
    assert.strictEqual(resolved.linkUrl, "/shop?category=laptops");
  });

  it("6. Verifies all 11 slots have valid fallback definitions in constants", () => {
    const allSlotKeys = [
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

    for (const key of allSlotKeys) {
      const slot = BANNER_SLOT_MAP[key];
      assert.ok(slot, `Slot ${key} must exist in BANNER_SLOT_MAP`);
      assert.ok(slot.defaultImage.startsWith("/images/banners/"), `${key} defaultImage must start with /images/banners/`);
      assert.ok(slot.defaultLink.length > 0, `${key} defaultLink must not be empty`);
      assert.ok(slot.defaultAlt.length > 0, `${key} defaultAlt must not be empty`);
    }
  });
});
