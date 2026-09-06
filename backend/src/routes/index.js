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

module.exports = router;
