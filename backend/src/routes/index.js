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

module.exports = router;
