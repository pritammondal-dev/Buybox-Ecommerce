const express = require("express");

const authRoutes = require("./auth.routes");
const productRoutes = require("./product.routes");
const categoryRoutes = require("./category.routes");
const brandRoutes = require("./brand.routes");
const productVariantRoutes = require("./product-variant.routes");
const customerRoutes = require("./customer.routes");
const addressRoutes = require("./address.routes");
const vendorRoutes = require("./vendor.routes");
const warehouseRoutes = require("./warehouse.routes");
const inventoryRoutes = require("./inventory.routes");
const cartRoutes = require("./cart.routes");
const orderRoutes = require("./order.routes");
const paymentRoutes = require("./payment.routes");
const financialLedgerRoutes = require("./financial-ledger.routes");
const vendorSettlementRoutes = require("./vendor-settlement.routes");
const vendorPayoutRoutes = require("./vendor-payout.routes");
const couponRoutes = require("./coupon.routes");
const couponRedemptionRoutes = require("./coupon-redemption.routes");
const campaignRoutes = require("./campaign.routes");
const campaignPerformanceRoutes = require("./campaign-performance.routes");
const reviewRoutes = require("./review.routes");
const supportTicketRoutes = require("./support-ticket.routes");
const supportTicketMessageRoutes = require("./support-ticket-message.routes");
const cmsPageRoutes = require("./cms-page.routes");
const storefrontBannerRoutes = require("./storefront-banner.routes");
const storefrontMenuRoutes = require("./storefront-menu.routes");
const storefrontSettingsRoutes = require("./storefront-settings.routes");
const storefrontSeoRoutes = require("./storefront-seo.routes");
const storefrontRedirectRoutes = require("./storefront-redirect.routes");
const storefrontContentBlockRoutes = require("./storefront-content-block.routes");
const storefrontHomepageRoutes = require("./storefront-homepage.routes");
const storefrontSectionRoutes = require("./storefront-section.routes");
const storefrontAnnouncementBarRoutes = require("./storefront-announcement-bar.routes");


const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Buybox API v1",
  });
});

router.use("/auth", authRoutes);
router.use("/products", productRoutes);
router.use("/categories", categoryRoutes);
router.use("/brands", brandRoutes);
router.use("/product-variants", productVariantRoutes);
router.use("/customers", customerRoutes);
router.use("/addresses", addressRoutes);
router.use("/vendors", vendorRoutes);
router.use("/warehouses", warehouseRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/cart", cartRoutes);
router.use("/orders", orderRoutes);
router.use("/payments", paymentRoutes);
router.use("/finance/ledger", financialLedgerRoutes);
router.use("/finance/settlements", vendorSettlementRoutes);
router.use("/finance/payouts", vendorPayoutRoutes);
router.use("/coupons", couponRoutes);
router.use("/coupon-redemptions", couponRedemptionRoutes);
router.use("/campaigns", campaignRoutes);
router.use("/campaign-performance", campaignPerformanceRoutes);
router.use("/reviews", reviewRoutes);
router.use("/support-tickets", supportTicketRoutes);
router.use("/support-tickets", supportTicketMessageRoutes);
router.use("/cms/pages", cmsPageRoutes);
router.use("/storefront/banners", storefrontBannerRoutes);
router.use("/storefront/menus", storefrontMenuRoutes);
router.use("/storefront/settings",storefrontSettingsRoutes);
router.use("/storefront/seo",storefrontSeoRoutes);
router.use("/storefront/redirects",storefrontRedirectRoutes);
router.use("/storefront/content-blocks",storefrontContentBlockRoutes);
router.use("/storefront/homepages",storefrontHomepageRoutes);
router.use("/storefront/sections",storefrontSectionRoutes);
router.use("/storefront/announcement-bars",storefrontAnnouncementBarRoutes);


module.exports = router;
