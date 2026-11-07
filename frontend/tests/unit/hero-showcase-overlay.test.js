import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Hero Showcase Option A Split-Layout & Regression Contract Tests", () => {
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

  test("2. Option A Split-Layout: Left Content Zone renders badge, headline, subtitle, and primary CTA button", () => {
    // Left Content Zone checks
    assert.ok(
      heroSectionContent.includes("current.badge"),
      "HeroSection must render discount badge"
    );
    assert.ok(
      heroSectionContent.includes("<h1"),
      "HeroSection must render main headline <h1"
    );
    assert.ok(
      heroSectionContent.includes("current.title"),
      "HeroSection must reference current.title"
    );
    assert.ok(
      heroSectionContent.includes("current.subtitle"),
      "HeroSection must render supporting description"
    );
    assert.ok(
      heroSectionContent.includes("current.cta"),
      "HeroSection must render primary CTA button"
    );
  });

  test("3. Option A Split-Layout: Right Artwork Zone renders product/banner artwork safely contained", () => {
    assert.ok(
      heroSectionContent.includes("current.bannerImage"),
      "HeroSection must render bannerImage"
    );
    assert.ok(
      heroSectionContent.includes("<img"),
      "HeroSection must render <img> tag for artwork"
    );
    assert.ok(
      heroSectionContent.includes("object-contain") || heroSectionContent.includes("object-cover"),
      "HeroSection artwork must use appropriate object-fit containment"
    );
  });

  test("4. Hero Showcase carousel navigation controls are preserved", () => {
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

  test("5. Autoplay and pause on hover behaviors are preserved", () => {
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

  test("6. Side promotional cards support two-area split with headings and artwork", () => {
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
    assert.ok(
      heroSectionContent.includes("theme.title") || heroSectionContent.includes("card.slot.title"),
      "HeroSection promo cards must render heading title without clipping"
    );
  });
});
