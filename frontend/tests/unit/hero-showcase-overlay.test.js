import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Hero Showcase & Side Banners Image-Only Redesign Contract Tests", () => {
  const heroSectionPath = path.resolve(__dirname, "../../src/components/storefront/home/HeroSection.jsx");
  const heroSectionContent = fs.readFileSync(heroSectionPath, "utf-8");

  test("1. HeroSection file exists and contains expected component definition", () => {
    assert.ok(heroSectionContent.length > 0, "HeroSection.jsx must not be empty");
    assert.ok(
      heroSectionContent.includes("export function HeroSection") ||
      heroSectionContent.includes("export default HeroSection"),
      "HeroSection must export the HeroSection component"
    );
  });

  test("2. Hero Showcase banner renders pure image-only without title, subtitle, badge, or CTA overlay", () => {
    // Isolate the main hero banner block
    const mainHeroStart = heroSectionContent.indexOf("{/* Main Hero Banner:");
    const mainHeroEnd = heroSectionContent.indexOf("{/* Active Side Promo Cards");
    const mainHeroBlock = heroSectionContent.slice(mainHeroStart, mainHeroEnd);

    // Verify clean image rendering
    assert.ok(
      mainHeroBlock.includes("<img"),
      "Main hero banner must render the banner image"
    );
    assert.ok(
      mainHeroBlock.includes("current.bannerImage"),
      "Main hero banner must reference current.bannerImage"
    );

    // Verify absence of badge, title heading, subtitle, CTA button, and text overlays in main hero banner
    assert.ok(
      !mainHeroBlock.includes("<h1"),
      "Main hero banner must not render <h1 heading"
    );
    assert.ok(
      !mainHeroBlock.includes("current.badge"),
      "Main hero banner must not render current.badge"
    );
    assert.ok(
      !mainHeroBlock.includes("current.subtitle"),
      "Main hero banner must not render current.subtitle"
    );
    assert.ok(
      !mainHeroBlock.includes("current.cta"),
      "Main hero banner must not render current.cta button text"
    );
    assert.ok(
      !mainHeroBlock.includes("Shop Now"),
      "Main hero banner must not render Shop Now text"
    );
  });

  test("3. Hero Showcase carousel navigation controls are preserved", () => {
    // Carousel arrows
    assert.ok(
      heroSectionContent.includes("aria-label=\"Previous slide\""),
      "HeroSection must preserve Previous slide button"
    );
    assert.ok(
      heroSectionContent.includes("aria-label=\"Next slide\""),
      "HeroSection must preserve Next slide button"
    );
    assert.ok(
      heroSectionContent.includes("prevSlide"),
      "HeroSection must preserve prevSlide handler"
    );
    assert.ok(
      heroSectionContent.includes("nextSlide"),
      "HeroSection must preserve nextSlide handler"
    );

    // Carousel dots
    assert.ok(
      heroSectionContent.includes("setCurrentSlide(idx)"),
      "HeroSection must preserve carousel dots indicator click handler"
    );
    assert.ok(
      heroSectionContent.includes("slides.map"),
      "HeroSection must map through slides for dots"
    );
  });

  test("4. Autoplay and pause on hover behaviors are preserved", () => {
    assert.ok(
      heroSectionContent.includes("setInterval"),
      "HeroSection must preserve carousel timer"
    );
    assert.ok(
      heroSectionContent.includes("onMouseEnter={() => setIsPaused(true)}"),
      "HeroSection must pause autoplay on mouse enter"
    );
    assert.ok(
      heroSectionContent.includes("onMouseLeave={() => setIsPaused(false)}"),
      "HeroSection must resume autoplay on mouse leave"
    );
  });

  test("5. Side promotional banners render pure image-only without HTML text or CTA overlays", () => {
    // Isolate the side promo cards block
    const sideCardsStart = heroSectionContent.indexOf("{/* Active Side Promo Cards:");
    const sideCardsBlock = heroSectionContent.slice(sideCardsStart);

    assert.ok(
      heroSectionContent.includes("activeSideCards"),
      "HeroSection must maintain activeSideCards logic"
    );
    assert.ok(
      heroSectionContent.includes("heroAudio"),
      "HeroSection must maintain heroAudio hook"
    );
    assert.ok(
      heroSectionContent.includes("heroSmartHome"),
      "HeroSection must maintain heroSmartHome hook"
    );
    assert.ok(
      heroSectionContent.includes("heroBrandDeals"),
      "HeroSection must maintain heroBrandDeals hook"
    );

    // Verify image rendering
    assert.ok(
      sideCardsBlock.includes("<img"),
      "Side promotional cards must render <img> tag"
    );
    assert.ok(
      sideCardsBlock.includes("card.slot.src"),
      "Side promotional cards must render card.slot.src"
    );

    // Verify complete absence of HTML text overlays, badges, and CTA buttons in side cards
    assert.ok(
      !sideCardsBlock.includes("<h2"),
      "Side promotional cards must not render <h2 title heading"
    );
    assert.ok(
      !sideCardsBlock.includes("badgeClass"),
      "Side promotional cards must not render badgeClass"
    );
    assert.ok(
      !sideCardsBlock.includes("subtitleClass"),
      "Side promotional cards must not render subtitleClass"
    );
    assert.ok(
      !sideCardsBlock.includes("Shop Now"),
      "Side promotional cards must not render HTML 'Shop Now' text"
    );
    assert.ok(
      !sideCardsBlock.includes("ctaClass"),
      "Side promotional cards must not render ctaClass"
    );
    assert.ok(
      !sideCardsBlock.includes("ArrowRight"),
      "Side promotional cards must not render ArrowRight CTA icons"
    );
  });

  test("6. Side promotional banners preserve destination URLs and accessible labels", () => {
    const sideCardsStart = heroSectionContent.indexOf("{/* Active Side Promo Cards:");
    const sideCardsBlock = heroSectionContent.slice(sideCardsStart);

    // Destination handling
    assert.ok(
      sideCardsBlock.includes("card.slot.linkUrl"),
      "Side cards must respect card.slot.linkUrl"
    );
    assert.ok(
      sideCardsBlock.includes("hasValidDestination"),
      "Side cards must check hasValidDestination"
    );

    // Accessible labels
    assert.ok(
      sideCardsBlock.includes("card.slot.altText || card.slot.title"),
      "Side cards must provide accessible labels from slot altText or title"
    );
    assert.ok(
      sideCardsBlock.includes("handleImageError"),
      "Side cards must preserve image error handling"
    );
  });
});
