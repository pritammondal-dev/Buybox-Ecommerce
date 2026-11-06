import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

describe("Storefront Flash Sale & Today's Hot Deal Layout Refinement", () => {
  const dealsRowPath = path.join(
    rootDir,
    "src/components/storefront/home/DealsPromoRow.jsx"
  );

  test("DealsPromoRow.jsx exists and is populated", () => {
    assert.ok(fs.existsSync(dealsRowPath), "DealsPromoRow.jsx must exist");
  });

  const content = fs.readFileSync(dealsRowPath, "utf-8");

  test("1. Product Image Frame: establishes consistent responsive aspect-ratio frames", () => {
    // Verifies aspect-square frame on thumbnail wrapper
    assert.ok(
      content.includes("aspect-square") && content.includes("w-full"),
      "Thumbnail cards must use responsive aspect-square w-full frame"
    );
    // Verifies subtle neutral background for product presentation
    assert.ok(
      content.includes("bg-slate-50/70"),
      "Product thumbnail inner frame must use subtle neutral bg-slate-50/70"
    );
    // Verifies flex centering
    assert.ok(
      content.includes("flex items-center justify-center overflow-hidden"),
      "Product frame must center image horizontally and vertically without clipping"
    );
  });

  test("2. Object-Fit & Aspect Ratio: uses object-contain and max bounds to avoid distortion", () => {
    assert.ok(
      content.includes("max-h-full max-w-full object-contain"),
      "Images must use object-contain with max-h-full max-w-full to prevent forced cropping or stretching"
    );
    assert.ok(
      content.includes("group-hover/thumb:scale-105"),
      "Images must provide subtle micro-interaction hover zoom"
    );
  });

  test("3. Countdown Timer: prevents wrapping and layout jitter across screen sizes", () => {
    // Header flex-wrap with gap
    assert.ok(
      content.includes("flex-wrap items-center justify-between gap-2"),
      "Flash Sale header must use flex-wrap with gap to protect countdown from colliding with title"
    );
    // Shrink protection on countdown container
    assert.ok(
      content.includes("flex shrink-0 items-center gap-1 rounded-lg bg-white/95"),
      "Countdown container must use shrink-0 to prevent compression at narrow widths"
    );
    // Tabular numbers and monospace for jitter-free countdown ticks
    assert.ok(
      content.includes("tabular-nums"),
      "Countdown digits must use tabular-nums to prevent layout shifts"
    );
    assert.ok(
      content.includes("min-w-[16px] text-center font-mono"),
      "Countdown digits must be monospace with minimum fixed width"
    );
  });

  test("4. Visual Identity & Promotional Badges: preserves brand treatment and icons", () => {
    // Today's Hot Deals: Flame icon, Rose styling, Limited Time Only badge
    assert.ok(content.includes("Flame"), "Today's Hot Deals must retain Flame icon");
    assert.ok(content.includes("bg-[#FFF5F5]"), "Today's Hot Deals must retain soft rose background");
    assert.ok(content.includes("Limited Time Only!"), "Today's Hot Deals must retain Limited Time badge");
    assert.ok(content.includes("View All Deals"), "Today's Hot Deals must retain View All link");

    // Flash Sale: Zap icon, Amber styling, Up to 70% badge
    assert.ok(content.includes("Zap"), "Flash Sale must retain Zap icon");
    assert.ok(content.includes("bg-[#FFFBEB]"), "Flash Sale must retain warm amber background");
    assert.ok(content.includes("Up to 70%"), "Flash Sale must retain discount badge");
    assert.ok(content.includes("View All Flash Sale"), "Flash Sale must retain View All link");
  });

  test("5. Data & Image Integrity: supports diverse image shapes and preserves product URLs", () => {
    // Image fallback resolution supporting URL strings and objects
    assert.ok(
      content.includes("typeof p.images?.[0] === \"string\""),
      "Thumbnail resolution must support both string URLs and object images safely"
    );
    // Link generation
    assert.ok(
      content.includes("p.slug ? `/product/${p.slug}` : `/product/${p._id || p.id}`"),
      "Must preserve authentic product routes and slug navigation"
    );
  });

  test("6. Accessibility & SEO: provides descriptive title and aria-labels for deal links", () => {
    assert.ok(
      content.includes("title={item.name}"),
      "Thumbnail links must supply descriptive title attribute for tooltips"
    );
    assert.ok(
      content.includes("aria-label={item.name}"),
      "Thumbnail links must supply accessible aria-label for assistive technologies"
    );
  });

  test("7. Card Sizing & Balance: harmonizes Today's Hot Deal and Flash Sale container bounds", () => {
    const hotDealCardMatches = content.match(/min-h-\[290px\]/g);
    assert.ok(
      hotDealCardMatches && hotDealCardMatches.length >= 2,
      "Both Today's Hot Deal and Flash Sale must share uniform min-height for horizontal alignment"
    );
  });
});
