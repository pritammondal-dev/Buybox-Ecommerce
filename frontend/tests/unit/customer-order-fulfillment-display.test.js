import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "../../src");

test("Phase Remediation: Customer Order Fulfillment Display Integrity Frontend Tests", async (t) => {
  await t.test("1. OrderStatusBadge component handles custom fulfillment states", () => {
    const badgeFile = path.join(srcDir, "components", "storefront", "account", "OrderStatusBadge.jsx");
    assert.equal(fs.existsSync(badgeFile), true, "OrderStatusBadge.jsx must exist");
    const content = fs.readFileSync(badgeFile, "utf-8");

    assert.match(content, /awaiting_merchant_confirmation/, "Must handle awaiting_merchant_confirmation");
    assert.match(content, /Awaiting Merchant Confirmation/, "Must render Awaiting Merchant Confirmation label");
    assert.match(content, /merchant_accepted/, "Must handle merchant_accepted");
    assert.match(content, /Merchant Accepted/, "Must render Merchant Accepted label");
    assert.match(content, /vendor_rejected/, "Must handle vendor_rejected");
  });

  await t.test("2. OrderStatusTimeline dynamically reflects vendor confirmation status", () => {
    const timelineFile = path.join(srcDir, "components", "storefront", "orders", "OrderStatusTimeline.jsx");
    assert.equal(fs.existsSync(timelineFile), true, "OrderStatusTimeline.jsx must exist");
    const content = fs.readFileSync(timelineFile, "utf-8");

    assert.match(content, /customerDisplayStatus/, "Must support customerDisplayStatus prop");
    assert.match(content, /isAwaitingVendorConfirmation/, "Must support isAwaitingVendorConfirmation prop");
    assert.match(content, /Merchant Confirmation/, "Must provide Merchant Confirmation stage label");
    assert.match(content, /Awaiting merchant confirmation/, "Must provide clear awaiting description");
  });

  await t.test("3. OrderDetailsPageView renders honest delivery estimate and vendor package details", () => {
    const pageFile = path.join(srcDir, "components", "storefront", "orders", "OrderDetailsPageView.jsx");
    assert.equal(fs.existsSync(pageFile), true, "OrderDetailsPageView.jsx must exist");
    const content = fs.readFileSync(pageFile, "utf-8");

    assert.match(content, /order\.customerDisplayStatus \|\| order\.status/, "Header badge must use customerDisplayStatus");
    assert.match(content, /awaiting_vendor_confirmation/, "Delivery card must handle awaiting_vendor_confirmation");
    assert.match(content, /Awaiting Merchant/, "Delivery card badge must display Awaiting Merchant");
    assert.match(content, /vendorPackages\.length > 0/, "Fulfillment packages must render for single and multi-vendor orders");
    assert.match(content, /Fulfillment Packages/, "Must maintain Fulfillment Packages title");
    assert.match(content, /pkg\.vendorName/, "Must render fulfilling merchant name");
  });

  await t.test("4. OrderDetailView account component renders honest delivery estimate and vendor packages", () => {
    const pageFile = path.join(srcDir, "components", "storefront", "account", "OrderDetailView.jsx");
    assert.equal(fs.existsSync(pageFile), true, "OrderDetailView.jsx must exist");
    const content = fs.readFileSync(pageFile, "utf-8");

    assert.match(content, /order\.customerDisplayStatus \|\| order\.status/, "Header badge must use customerDisplayStatus");
    assert.match(content, /awaiting_vendor_confirmation/, "Delivery card must handle awaiting_vendor_confirmation");
    assert.match(content, /vendorPackages\.length > 0/, "Fulfillment packages must render for single and multi-vendor orders");
    assert.match(content, /pkg\.vendorName/, "Must render fulfilling merchant name");
  });

  await t.test("5. OrderTrackingPageView keeps milestone at 0 when vendor confirmation is pending", () => {
    const trackingFile = path.join(srcDir, "app", "(storefront)", "orders", "[orderId]", "tracking", "OrderTrackingPageView.jsx");
    assert.equal(fs.existsSync(trackingFile), true, "OrderTrackingPageView.jsx must exist");
    const content = fs.readFileSync(trackingFile, "utf-8");

    assert.match(content, /isAwaitingVendorConfirmation/, "Tracking page must guard against unconfirmed orders");
    assert.match(content, /awaiting_merchant_confirmation/, "Tracking page must check customerDisplayStatus");
  });
});

