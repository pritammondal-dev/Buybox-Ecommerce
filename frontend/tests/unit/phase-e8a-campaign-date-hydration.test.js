import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  formatDate,
  formatCampaignEndDate,
  parseDate,
  isValidDate,
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
} from "../../src/utils/formatDate.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Phase E8a: Active Campaigns Date Hydration & Deterministic Formatting", () => {
  describe("1. Deterministic Timestamp Formatting & Environment Isolation", () => {
    it("produces identical output for ISO strings, Date instances, and numeric timestamps", () => {
      const iso = "2026-03-11T00:00:00.000Z";
      const dateObj = new Date(iso);
      const timestamp = dateObj.getTime();

      const outIso = formatDate(iso);
      const outDate = formatDate(dateObj);
      const outTimestamp = formatDate(timestamp);

      assert.strictEqual(outIso, "11/3/2026");
      assert.strictEqual(outDate, "11/3/2026");
      assert.strictEqual(outTimestamp, "11/3/2026");
      assert.strictEqual(outIso, outDate);
      assert.strictEqual(outDate, outTimestamp);
    });

    it("remains deterministic regardless of server process.env.TZ setting", () => {
      const originalTz = process.env.TZ;
      const testIso = "2026-03-11T00:00:00.000Z";

      try {
        // Test in US Eastern
        process.env.TZ = "America/New_York";
        const nyResult = formatDate(testIso);

        // Test in UTC
        process.env.TZ = "UTC";
        const utcResult = formatDate(testIso);

        // Test in Tokyo
        process.env.TZ = "Asia/Tokyo";
        const tokyoResult = formatDate(testIso);

        assert.strictEqual(nyResult, "11/3/2026");
        assert.strictEqual(utcResult, "11/3/2026");
        assert.strictEqual(tokyoResult, "11/3/2026");
        assert.strictEqual(nyResult, utcResult);
        assert.strictEqual(utcResult, tokyoResult);
      } finally {
        process.env.TZ = originalTz;
      }
    });

    it("formatCampaignEndDate matches formatDate business defaults", () => {
      const iso = "2026-03-11T12:00:00.000Z";
      assert.strictEqual(formatCampaignEndDate(iso), formatDate(iso));
      assert.strictEqual(formatCampaignEndDate(iso), "11/3/2026");
    });
  });

  describe("2. Explicit en-IN Locale & Indian Date Ordering", () => {
    it("uses Day/Month/Year ordering for March 11 (11/3/2026), preventing US M/D/Y (3/11/2026) mismatch", () => {
      const march11 = "2026-03-11T10:00:00.000Z";
      const formatted = formatDate(march11);

      // In Indian English (en-IN), day comes first: 11/3/2026
      assert.strictEqual(formatted, "11/3/2026");
      assert.notStrictEqual(formatted, "3/11/2026", "Must not output US month-first format");
    });

    it("uses Day/Month/Year ordering for November 3 (3/11/2026)", () => {
      const nov3 = "2026-11-03T10:00:00.000Z";
      const formatted = formatDate(nov3);

      // In Indian English (en-IN), day comes first: 3/11/2026
      assert.strictEqual(formatted, "3/11/2026");
      assert.notStrictEqual(formatted, "11/3/2026", "Must not confuse Nov 3 with March 11");
    });

    it("exposes DEFAULT_LOCALE as en-IN", () => {
      assert.strictEqual(DEFAULT_LOCALE, "en-IN");
    });

    it("supports custom formatting options while retaining en-IN locale", () => {
      const date = "2026-03-11T10:00:00.000Z";
      const formatted = formatDate(date, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      assert.strictEqual(formatted, "11 Mar 2026");
    });
  });

  describe("3. Asia/Kolkata Business Timezone Application", () => {
    it("exposes DEFAULT_TIMEZONE as Asia/Kolkata", () => {
      assert.strictEqual(DEFAULT_TIMEZONE, "Asia/Kolkata");
    });

    it("correctly shifts midnight boundaries according to Asia/Kolkata (UTC+5:30)", () => {
      // 20:00 UTC on March 11 is 01:30 AM on March 12 in IST
      const nearMidnightUtc = "2026-03-11T20:00:00.000Z";
      const formatted = formatDate(nearMidnightUtc);

      assert.strictEqual(
        formatted,
        "12/3/2026",
        "Timestamp at 20:00 UTC on 11th must resolve to 12th in Asia/Kolkata (+5:30)"
      );
    });

    it("respects custom timezone when explicitly specified in options", () => {
      const nearMidnightUtc = "2026-03-11T20:00:00.000Z";
      const inUtc = formatDate(nearMidnightUtc, { timeZone: "UTC" });
      const inIst = formatDate(nearMidnightUtc, { timeZone: "Asia/Kolkata" });

      assert.strictEqual(inUtc, "11/3/2026");
      assert.strictEqual(inIst, "12/3/2026");
    });
  });

  describe("4. Missing, Invalid Date, and Edge Case Resilience", () => {
    it("returns null for missing dates without throwing", () => {
      assert.strictEqual(formatDate(null), null);
      assert.strictEqual(formatDate(undefined), null);
      assert.strictEqual(formatDate(""), null);
      assert.strictEqual(formatDate("   "), null);
      assert.strictEqual(formatCampaignEndDate(null), null);
      assert.strictEqual(formatCampaignEndDate(undefined), null);
      assert.strictEqual(formatCampaignEndDate(""), null);
    });

    it("returns null for invalid dates without throwing", () => {
      assert.strictEqual(formatDate("invalid-date-string"), null);
      assert.strictEqual(formatDate("2026-99-99"), null);
      assert.strictEqual(formatDate(NaN), null);
      assert.strictEqual(formatDate({}), null);
      assert.strictEqual(formatDate([]), null);
      assert.strictEqual(formatCampaignEndDate("not-a-date"), null);
    });

    it("parseDate and isValidDate correctly classify inputs", () => {
      assert.strictEqual(isValidDate("2026-03-11"), true);
      assert.strictEqual(isValidDate(new Date()), true);
      assert.strictEqual(isValidDate(1773273600000), true);

      assert.strictEqual(isValidDate(null), false);
      assert.strictEqual(isValidDate(undefined), false);
      assert.strictEqual(isValidDate(""), false);
      assert.strictEqual(isValidDate("corrupted"), false);
      assert.strictEqual(isValidDate(NaN), false);

      assert.ok(parseDate("2026-03-11") instanceof Date);
      assert.strictEqual(parseDate("corrupted"), null);
    });
  });

  describe("5. ActiveCampaignsSection Hydration Safety & Rendering Contract", () => {
    const componentPath = path.resolve(
      __dirname,
      "../../src/components/storefront/home/ActiveCampaignsSection.jsx"
    );
    const content = fs.readFileSync(componentPath, "utf8");

    it("imports and uses formatCampaignEndDate from formatDate utility", () => {
      assert.ok(
        content.includes("formatCampaignEndDate"),
        "ActiveCampaignsSection must import formatCampaignEndDate"
      );
      assert.ok(
        content.includes('from "../../../utils/formatDate.js"') ||
          content.includes("from '@/utils/formatDate'"),
        "ActiveCampaignsSection must import from formatDate.js"
      );
    });

    it("does not use un-localized or bare new Date().toLocaleDateString()", () => {
      assert.ok(
        !content.includes(".toLocaleDateString()"),
        "Must not contain environment-dependent bare .toLocaleDateString() calls"
      );
    });

    it("does not bypass SSR with suppressHydrationWarning or post-mount delays", () => {
      assert.ok(
        !content.includes("suppressHydrationWarning"),
        "Must avoid suppressHydrationWarning antipattern"
      );
      assert.ok(
        !content.includes("isMounted"),
        "Should not delay entire component rendering behind isMounted when deterministic formatting is available"
      );
    });

    it("preserves Calendar icon and 'Ends ' prefix for valid end dates", () => {
      assert.ok(
        content.includes("<Calendar className="),
        "Must preserve Calendar icon for end date display"
      );
      assert.ok(
        content.includes("Ends {formattedEndDate}") ||
          content.includes("Ends {formatCampaignEndDate"),
        "Must render 'Ends {formattedEndDate}' inside the card footer"
      );
    });

    it("renders 'Active Now' for campaigns with missing end dates", () => {
      assert.ok(
        content.includes("Active Now"),
        "Must preserve 'Active Now' badge for open-ended campaigns"
      );
      assert.ok(
        content.includes("text-emerald-700 font-bold"),
        "Must maintain emerald styling for Active Now badge"
      );
    });

    it("does not misleadingly label invalid end dates as 'Active Now'", () => {
      // Must differentiate between missing date (!hasEndDate) and invalid date (hasEndDate but !formattedEndDate)
      assert.ok(
        content.includes("hasEndDate") || content.includes("Limited Time"),
        "Must distinguish missing end dates from invalid end dates so invalid dates are not marked Active Now"
      );
      assert.ok(
        content.includes("Limited Time"),
        "Invalid end dates must render safe non-misleading fallback like 'Limited Time'"
      );
    });

    it("preserves card links, Explore CTA, product count, and SectionContainer layout", () => {
      assert.ok(content.includes('href={`/campaign/${slug}`}')),
        "Must preserve campaign links";
      assert.ok(content.includes("Explore"), "Must preserve Explore button");
      assert.ok(
        content.includes("productCount"),
        "Must preserve product count badges"
      );
      assert.ok(
        content.includes("<SectionContainer"),
        "Must preserve SectionContainer layout"
      );
    });
  });

  describe("6. Storefront Homepage & Wrapper Integration Invariants", () => {
    const homeWrapperPath = path.resolve(
      __dirname,
      "../../src/components/storefront/home/HomeClientWrapper.jsx"
    );
    const homeWrapperContent = fs.readFileSync(homeWrapperPath, "utf8");

    it("HomeClientWrapper integrates ActiveCampaignsSection with initialActiveCampaigns", () => {
      assert.ok(
        homeWrapperContent.includes(
          "<ActiveCampaignsSection campaigns={initialActiveCampaigns} />"
        ),
        "HomeClientWrapper must pass initialActiveCampaigns to ActiveCampaignsSection"
      );
    });

    const homePagePath = path.resolve(
      __dirname,
      "../../src/app/(storefront)/page.js"
    );
    const homePageContent = fs.readFileSync(homePagePath, "utf8");

    it("Storefront page.js fetches getActiveCampaigns server-side for initial render", () => {
      assert.ok(
        homePageContent.includes("campaignService.getActiveCampaigns()"),
        "Storefront page.js must fetch campaigns on server"
      );
      assert.ok(
        homePageContent.includes("initialActiveCampaigns={activeCampaigns}"),
        "page.js must pass activeCampaigns to HomeClientWrapper"
      );
    });
  });
});
