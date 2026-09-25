/**
 * Promotional Banner Slot Definitions
 *
 * Central specification for all 11 homepage promotional banner placements.
 * Every slot defines its human-readable title, section grouping, default fallback asset,
 * default link destination, default accessibility alt text, and recommended dimensions.
 */

export const BANNER_SECTIONS = [
  { id: "all", label: "All Slots", count: 11 },
  { id: "hero_mini", label: "Hero Mini Cards", count: 3 },
  { id: "mid_page", label: "Mid-Page Banners", count: 2 },
  { id: "category_highlights", label: "Category Highlights", count: 3 },
  { id: "bottom_promos", label: "Bottom Promos", count: 3 },
];

export const BANNER_SLOTS = [
  // 1. Hero Mini Cards
  {
    slotKey: "hero_audio",
    title: "Hero Card 1 — Audio Essentials",
    section: "hero_mini",
    sectionLabel: "Hero Mini Cards",
    description: "Top card in the 3-card stack beside the hero carousel.",
    defaultImage: "/images/banners/promo-audio-essentials.svg",
    defaultLink: "/shop?category=audio",
    defaultAlt: "Audio Essentials - Up to 40% Off",
    recommendedDimensions: "384 × 115 px (~3.3:1)",
    displayOrder: 1,
  },
  {
    slotKey: "hero_smart_home",
    title: "Hero Card 2 — Smart Devices",
    section: "hero_mini",
    sectionLabel: "Hero Mini Cards",
    description: "Middle card in the 3-card stack beside the hero carousel.",
    defaultImage: "/images/banners/promo-smart-home.svg",
    defaultLink: "/shop?category=smart-home",
    defaultAlt: "Smart Devices for a Smarter Home",
    recommendedDimensions: "384 × 115 px (~3.3:1)",
    displayOrder: 2,
  },
  {
    slotKey: "hero_brand_deals",
    title: "Hero Card 3 — Brand Deals",
    section: "hero_mini",
    sectionLabel: "Hero Mini Cards",
    description: "Bottom card in the 3-card stack beside the hero carousel.",
    defaultImage: "/images/banners/promo-brand-deals.svg",
    defaultLink: "/shop#brands",
    defaultAlt: "Exclusive Brand Deals",
    recommendedDimensions: "384 × 115 px (~3.3:1)",
    displayOrder: 3,
  },

  // 2. Mid-Page Promotional Banners
  {
    slotKey: "mid_work_smarter",
    title: "Mid Banner 1 — Work Smarter (67% Width)",
    section: "mid_page",
    sectionLabel: "Mid-Page Banners",
    description: "Wide prominent banner on the left side of the mid-page split row.",
    defaultImage: "/images/banners/banner-work-smarter.png",
    defaultLink: "/shop?category=laptops",
    defaultAlt: "Work Smarter Productivity Setup - Laptops and Accessories",
    recommendedDimensions: "840 × 260 px (~3.2:1)",
    displayOrder: 1,
  },
  {
    slotKey: "mid_stylish_looks",
    title: "Mid Banner 2 — Stylish Looks (33% Width)",
    section: "mid_page",
    sectionLabel: "Mid-Page Banners",
    description: "Compact banner on the right side of the mid-page split row.",
    defaultImage: "/images/banners/banner-stylish-looks.png",
    defaultLink: "/shop?category=fashion",
    defaultAlt: "Stylish Looks Fashion and Accessories",
    recommendedDimensions: "420 × 260 px (~1.6:1)",
    displayOrder: 2,
  },

  // 3. Category Highlight Banners
  {
    slotKey: "category_audio",
    title: "Category Highlight 1 — Audio Mood",
    section: "category_highlights",
    sectionLabel: "Category Highlights",
    description: "First card in the 3-column category highlight row.",
    defaultImage: "/images/banners/cat-audio-mood.png",
    defaultLink: "/shop?category=audio",
    defaultAlt: "Audio for Every Mood",
    recommendedDimensions: "400 × 300 px (4:3 or 16:9)",
    displayOrder: 1,
  },
  {
    slotKey: "category_workspace",
    title: "Category Highlight 2 — Workspace Upgrade",
    section: "category_highlights",
    sectionLabel: "Category Highlights",
    description: "Middle card in the 3-column category highlight row.",
    defaultImage: "/images/banners/cat-workspace-upgrade.png",
    defaultLink: "/shop?category=displays-monitors",
    defaultAlt: "Upgrade Your Workspace",
    recommendedDimensions: "400 × 300 px (4:3 or 16:9)",
    displayOrder: 2,
  },
  {
    slotKey: "category_smart_living",
    title: "Category Highlight 3 — Smart Living",
    section: "category_highlights",
    sectionLabel: "Category Highlights",
    description: "Third card in the 3-column category highlight row.",
    defaultImage: "/images/banners/cat-smart-living.png",
    defaultLink: "/shop?category=tv-appliances",
    defaultAlt: "Smart Living",
    recommendedDimensions: "400 × 300 px (4:3 or 16:9)",
    displayOrder: 3,
  },

  // 4. Bottom Promotional Banners
  {
    slotKey: "bottom_home_kitchen",
    title: "Bottom Promo 1 — Home & Kitchen",
    section: "bottom_promos",
    sectionLabel: "Bottom Promos",
    description: "First card in the bottom seasonal tri-banner row.",
    defaultImage: "/images/banners/promo-home-kitchen.png",
    defaultLink: "/shop?category=tv-appliances",
    defaultAlt: "Home & Kitchen - Up to 60% Off",
    recommendedDimensions: "400 × 300 px (4:3 or 16:9)",
    displayOrder: 1,
  },
  {
    slotKey: "bottom_smart_gadgets",
    title: "Bottom Promo 2 — Smart Gadgets",
    section: "bottom_promos",
    sectionLabel: "Bottom Promos",
    description: "Middle card in the bottom seasonal tri-banner row.",
    defaultImage: "/images/banners/promo-smart-gadgets.svg",
    defaultLink: "/shop?category=accessories",
    defaultAlt: "Smart Gadgets for a Smarter You",
    recommendedDimensions: "400 × 300 px (4:3 or 16:9)",
    displayOrder: 2,
  },
  {
    slotKey: "bottom_monsoon_special",
    title: "Bottom Promo 3 — Monsoon Special",
    section: "bottom_promos",
    sectionLabel: "Bottom Promos",
    description: "Third card in the bottom seasonal tri-banner row.",
    defaultImage: "/images/banners/promo-monsoon-special.svg",
    defaultLink: "/shop?category=fashion",
    defaultAlt: "Monsoon Special - Waterproof Gear",
    recommendedDimensions: "400 × 300 px (4:3 or 16:9)",
    displayOrder: 3,
  },
];

export const BANNER_SLOT_MAP = BANNER_SLOTS.reduce((acc, slot) => {
  acc[slot.slotKey] = slot;
  return acc;
}, {});
