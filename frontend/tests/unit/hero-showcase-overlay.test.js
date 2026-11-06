import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Hero Showcase Banner Overlay Removal & Regression Contract", () => {
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

  test("2. Hero Showcase banner with image does NOT render overlay badge, title, description, or CTA button", () => {
    // When current.bannerImage is present, it must render clean <Link> with <img> and NO text overlay elements
    const bannerImageBranch = heroSectionContent.slice(
      heroSectionContent.indexOf("{current.bannerImage ? ("),
      heroSectionContent.indexOf(") : (")
    );

    // Verify clean image rendering
    assert.ok(
      bannerImageBranch.includes("<img"),
      "Banner image branch must render the banner image"
    );
    assert.ok(
      bannerImageBranch.includes("current.bannerImage"),
      "Banner image branch must reference current.bannerImage"
    );

    // Verify absence of badge, visible title heading, subtitle, CTA button, and gradient overlay within image branch
    assert.ok(
      !bannerImageBranch.includes("current.badge"),
      "Banner image branch must not render current.badge"
    );
    assert.ok(
      !bannerImageBranch.includes("<h1"),
      "Banner image branch must not render <h1 heading"
    );
    assert.ok(
      !bannerImageBranch.includes("current.subtitle"),
      "Banner image branch must not render current.subtitle"
    );
    assert.ok(
      !bannerImageBranch.includes("current.cta"),
      "Banner image branch must not render current.cta button text"
    );
    assert.ok(
      !bannerImageBranch.includes("linear-gradient"),
      "Banner image branch must not render linear-gradient overlay"
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
      heroSectionContent.includes("prevSlide();"),
      "HeroSection must preserve prevSlide handler"
    );
    assert.ok(
      heroSectionContent.includes("nextSlide();"),
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

  test("5. Side cards and other banners remain separate and intact", () => {
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
  });
});
