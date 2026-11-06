require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Order = require("../src/models/Order");
const Inventory = require("../src/models/Inventory");
const Shipment = require("../src/models/Shipment");
const ReturnRequest = require("../src/models/ReturnRequest");
const AuditLog = require("../src/models/AuditLog");

async function auditData() {
  await mongoose.connect(process.env.MONGODB_URI);

  const totalVendors = await Vendor.countDocuments();
  const deletedVendors = await Vendor.countDocuments({ deletedAt: { $ne: null } });
  const activeVendors = await Vendor.countDocuments({ deletedAt: null });

  const statusCounts = await Vendor.aggregate([
    { $match: { deletedAt: null } },
    { $group: { _id: "$onboardingStatus", count: { $sum: 1 } } },
  ]);

  const vendors = await Vendor.find().lean();
  console.log("=== VENDOR COUNTS ===");
  console.log(JSON.stringify({ totalVendors, deletedVendors, activeVendors, statusCounts }, null, 2));

  console.log("\n=== VENDOR RECORDS AUDIT ===");
  const auditReport = [];
  for (const v of vendors) {
    const user = await User.findById(v.userId).lean();
    const prodCount = await Product.countDocuments({ vendorId: v._id });
    const activeProdCount = await Product.countDocuments({ vendorId: v._id, status: "active" });
    const orderItemsCount = await Order.countDocuments({ "items.vendorId": v._id });
    const orderVendorItemsCount = await Order.countDocuments({ "vendorItems.vendorId": v._id });
    const inventoryCount = await Inventory.countDocuments({ vendorId: v._id });
    const shipmentCount = await Shipment.countDocuments({ vendorId: v._id });
    const auditCount = await AuditLog.countDocuments({ targetId: v._id });

    auditReport.push({
      vendorId: v._id.toString(),
      name: v.businessName,
      slug: v.businessSlug,
      status: v.onboardingStatus,
      isActive: v.isActive,
      hasUser: Boolean(user),
      userEmail: user?.email || "ORPHAN",
      userName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : null,
      userRole: user?.role,
      userRoles: user?.roles,
      userEmailVerified: user?.isEmailVerified,
      prodCount,
      activeProdCount,
      orderItemsCount,
      orderVendorItemsCount,
      inventoryCount,
      shipmentCount,
      auditCount,
    });
  }
  console.log(JSON.stringify(auditReport, null, 2));

  // Users with role 'vendor' or roles containing 'vendor' without Vendor record
  const vendorUsers = await User.find({
    $or: [{ role: "vendor" }, { roles: "vendor" }],
  }).lean();
  console.log("\n=== VENDOR ROLE USERS WITHOUT VENDOR RECORD ===");
  const orphanUsers = [];
  for (const u of vendorUsers) {
    const linked = await Vendor.findOne({ userId: u._id });
    if (!linked) {
      orphanUsers.push({ id: u._id.toString(), email: u.email, role: u.role, roles: u.roles });
    }
  }
  console.log(JSON.stringify(orphanUsers, null, 2));

  // Inspect Orders collection for how vendorId is stored
  console.log("\n=== SAMPLE ORDER ITEMS VENDOR ATTRIBUTION ===");
  const sampleOrder = await Order.findOne({ "items.0": { $exists: true } }).lean();
  if (sampleOrder) {
    console.log("Order ID:", sampleOrder._id.toString());
    console.log("Order has items array:", Boolean(sampleOrder.items));
    console.log("Order items length:", sampleOrder.items?.length);
    console.log("Order items[0] keys:", Object.keys(sampleOrder.items[0] || {}));
    console.log("Order items[0].vendorId:", sampleOrder.items[0]?.vendorId);
    console.log("Order has vendorItems field:", Boolean(sampleOrder.vendorItems));
  } else {
    console.log("No orders found in database.");
  }

  await mongoose.disconnect();
}

auditData().catch((err) => {
  console.error("Audit error:", err);
  process.exit(1);
});
