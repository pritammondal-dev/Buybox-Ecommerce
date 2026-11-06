const express = require("express");

const authRoutes = require("./auth.routes");
const productRoutes = require("./product.routes");
const categoryRoutes = require("./category.routes");
const brandRoutes = require("./brand.routes");
const attributeRoutes = require("./attribute.routes");
const productVariantRoutes = require("./product-variant.routes");
const customerRoutes = require("./customer.routes");
const addressRoutes = require("./address.routes");
const vendorRoutes = require("./vendor.routes");
const warehouseRoutes = require("./warehouse.routes");
const warehouseOperationsRoutes = require("./warehouse-operations.routes");
const inventoryRoutes = require("./inventory.routes");
const cartRoutes = require("./cart.routes");
const orderRoutes = require("./order.routes");
const paymentRoutes = require("./payment.routes");
const paymentMethodRoutes = require("./payment-method.routes");
const financialLedgerRoutes = require("./financial-ledger.routes");
const vendorSettlementRoutes = require("./vendor-settlement.routes");
const vendorPayoutRoutes = require("./vendor-payout.routes");
const commissionPolicyRoutes = require("./commission-policy.routes");
const vendorWalletRoutes = require("./vendor-wallet.routes");
const withdrawalRequestRoutes = require("./withdrawal-request.routes");
const financialOverviewRoutes = require("./financial-overview.routes");
const financialReconciliationRoutes = require("./financial-reconciliation.routes");
const couponRoutes = require("./coupon.routes");
const storefrontCouponRoutes = require("./storefront-coupon.routes");
const couponRedemptionRoutes = require("./coupon-redemption.routes");
const taxRoutes = require("./tax.routes");
const campaignRoutes = require("./campaign.routes");
const storefrontCampaignRoutes = require("./storefront-campaign.routes");
const campaignPerformanceRoutes = require("./campaign-performance.routes");
const reviewRoutes = require("./review.routes");
const supportTicketRoutes = require("./support-ticket.routes");
const supportTicketMessageRoutes = require("./support-ticket-message.routes");
const cmsPageRoutes = require("./cms-page.routes");
const cmsEventRoutes = require("./cms-event.routes");
const storefrontEventRoutes = require("./storefront-event.routes");
const storefrontBannerRoutes = require("./storefront-banner.routes");
const storefrontMenuRoutes = require("./storefront-menu.routes");
const storefrontSettingsRoutes = require("./storefront-settings.routes");
const storefrontSeoRoutes = require("./storefront-seo.routes");
const storefrontRedirectRoutes = require("./storefront-redirect.routes");
const storefrontContentBlockRoutes = require("./storefront-content-block.routes");
const storefrontHomepageRoutes = require("./storefront-homepage.routes");
const storefrontSectionRoutes = require("./storefront-section.routes");
const storefrontAnnouncementBarRoutes = require("./storefront-announcement-bar.routes");
const storefrontMediaRoutes = require("./storefront-media.routes");
const storefrontPublicationRoutes = require("./storefront-publication.routes");
const wishlistRoutes = require("./wishlist.routes");
const analyticsRoutes = require("./analytics.routes");
const governanceRoutes = require("./governance.routes");
const shipmentRoutes = require("./shipment.routes");
const questionRoutes = require("./question.routes");
const notificationRoutes = require("./notification.routes");
const returnRequestRoutes = require("./return-request.routes");
const rewardRoutes = require("./reward.routes");
const giftCardRoutes = require("./gift-card.routes");
const digitalDownloadRoutes = require("./digital-download.routes");
const fulfillmentExceptionRoutes = require("./fulfillment-exception.routes");
const administratorAuthRoutes = require("./administrator-auth.routes");
const vendorAuthRoutes = require("./vendor-auth.routes");
const { authenticateAdministrator } = require("../middlewares/authentication.middleware");
const AppError = require("../errors/AppError");

const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Buybox API v1",
  });
});

router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    message: "Buybox API is operational",
    timestamp: new Date().toISOString(),
  });
});

// 1. Customer Authentication Boundary (/api/v1/auth/*)
router.use("/auth", authRoutes);

// 2. Vendor Authentication Boundary (/api/v1/vendor/auth/*)
router.use("/vendor/auth", vendorAuthRoutes);

// 3. Administrator Authentication Boundary (/api/v1/administrator/auth/*)
router.use("/administrator/auth", administratorAuthRoutes);

// Explicit 404 for any public admin registration endpoints
router.all(["/admin/register", "/administrator/register"], (req, res, next) => {
  next(
    new AppError(
      "Public administrator registration is prohibited. Staff accounts must be provisioned by a Superadmin.",
      404,
      "ENDPOINT_NOT_FOUND"
    )
  );
});

// Storefront & Domain Routes
router.use("/products", productRoutes);
router.use("/categories", categoryRoutes);
router.use("/brands", brandRoutes);
router.use("/attributes", attributeRoutes);
router.use("/product-variants", productVariantRoutes);
router.use("/customers", customerRoutes);
router.use("/addresses", addressRoutes);
router.use("/vendors", vendorRoutes);
router.use("/warehouses", warehouseRoutes);
router.use("/warehouse-operations", warehouseOperationsRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/cart", cartRoutes);
router.use("/wishlist", wishlistRoutes);
router.use("/orders", orderRoutes);
router.use("/shipments", shipmentRoutes);
router.use("/questions", questionRoutes);
router.use("/notifications", notificationRoutes);
router.use("/returns", returnRequestRoutes);
router.use("/return-requests", returnRequestRoutes);
router.use("/rewards", rewardRoutes);
router.use("/gift-cards", giftCardRoutes);
router.use("/payments", paymentRoutes);
router.use("/payment-methods", paymentMethodRoutes);
router.use("/finance/ledger", financialLedgerRoutes);
router.use("/finance/settlements", vendorSettlementRoutes);
router.use("/vendor-settlements", vendorSettlementRoutes);
router.use("/finance/payouts", vendorPayoutRoutes);
router.use("/finance/commission-policies", commissionPolicyRoutes);
router.use("/finance/wallets", vendorWalletRoutes);
router.use("/finance/withdrawals", withdrawalRequestRoutes);
router.use("/finance/overview", financialOverviewRoutes);
router.use("/finance/reconciliation", financialReconciliationRoutes);
router.use("/coupons", storefrontCouponRoutes);
router.use("/coupons", couponRoutes);
router.use("/coupon-redemptions", couponRedemptionRoutes);
router.use("/tax", taxRoutes);
router.use("/campaigns", storefrontCampaignRoutes);
router.use("/campaigns", campaignRoutes);
router.use("/campaign-performance", campaignPerformanceRoutes);
router.use("/reviews", reviewRoutes);
router.use("/support-tickets", supportTicketRoutes);
router.use("/support-tickets", supportTicketMessageRoutes);
router.use("/cms/pages", cmsPageRoutes);
router.use("/cms/events", cmsEventRoutes);
router.use("/storefront/events", storefrontEventRoutes);
router.use("/storefront/banners", storefrontBannerRoutes);
router.use("/storefront/menus", storefrontMenuRoutes);
router.use("/storefront/settings", storefrontSettingsRoutes);
router.use("/storefront/seo", storefrontSeoRoutes);
router.use("/storefront/redirects", storefrontRedirectRoutes);
router.use("/storefront/content-blocks", storefrontContentBlockRoutes);
router.use("/storefront/homepages", storefrontHomepageRoutes);
router.use("/storefront/sections", storefrontSectionRoutes);
router.use("/storefront/announcement-bars", storefrontAnnouncementBarRoutes);
router.use("/storefront/media", storefrontMediaRoutes);
router.use("/storefront/publications", storefrontPublicationRoutes);
router.use("/digital-downloads", digitalDownloadRoutes);
router.use("/fulfillment-exceptions", fulfillmentExceptionRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/partner-banks", require("./partner-bank.routes"));
router.use("/shipping/webhooks", require("./courier-webhook.routes"));

// ----------------------------------------------------
// Strictly Guarded Administrator Business Routes (/api/v1/admin/*)
// ----------------------------------------------------
router.use("/admin", authenticateAdministrator);
router.use("/admin/vendors", vendorRoutes);
router.use("/admin/partner-banks", require("./admin-partner-bank.routes"));
router.use("/admin/governance", governanceRoutes);
router.use("/admin/job-roles", require("./job-role.routes"));
router.use("/admin/staff", require("./staff.routes"));
router.use("/admin/tasks", require("./task.routes"));
router.use("/tasks", require("./task.routes"));
router.use("/admin/dashboard", require("./admin-dashboard.routes"));
router.use("/administrator/dashboard", require("./admin-dashboard.routes"));
router.use("/admin/customers", require("./admin-customer.routes"));
router.use("/admin/security", require("./security.routes"));
router.use("/admin/settings/credentials", require("./credential.routes"));
router.use("/admin/settings/general", require("./admin-settings.routes"));
router.use("/admin/settings/store", require("./admin-settings.routes"));
router.use("/admin/settings/taxes", taxRoutes);
router.use("/admin/tax", taxRoutes);
router.use("/admin/authentication", require("./admin-authentication-policy.routes"));
router.use("/admin/settings/authentication", require("./admin-authentication-policy.routes"));
router.use("/admin/search", require("./admin-search.routes"));
router.use("/admin/attributes", attributeRoutes);
router.use("/admin/inventory", inventoryRoutes);
router.use("/admin/payments", paymentRoutes);
router.use("/admin/payment-methods", paymentMethodRoutes);
router.use("/admin/products", productRoutes);
router.use("/admin/categories", categoryRoutes);
router.use("/admin/brands", brandRoutes);
router.use("/admin/coupons", require("./admin-coupon.routes"));
router.use("/admin/discounts", require("./admin-discount.routes"));
router.use("/admin/promotions", require("./admin-discount.routes"));
router.use("/admin/campaigns", campaignRoutes);
router.use("/admin/cms/pages", cmsPageRoutes);
router.use("/admin/cms/events", cmsEventRoutes);
router.use("/admin/saved-views", require("./saved-view.routes"));
router.use("/admin/fulfillment-exceptions", fulfillmentExceptionRoutes);
router.use("/discounts", require("./admin-discount.routes"));
router.use("/promotions", require("./admin-discount.routes"));

module.exports = router;

