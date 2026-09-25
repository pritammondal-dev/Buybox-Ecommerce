require("dotenv").config();
const mongoose = require("mongoose");
const env = require("../src/config/env");

(async () => {
  try {
    await mongoose.connect(env.MONGODB_URI);
    const Category = mongoose.model("Category", new mongoose.Schema({}, { strict: false }));
    const Brand = mongoose.model("Brand", new mongoose.Schema({}, { strict: false }));
    const Campaign = mongoose.model("Campaign", new mongoose.Schema({}, { strict: false }));
    const Vendor = mongoose.model("Vendor", new mongoose.Schema({}, { strict: false }));
    const Warehouse = mongoose.model("Warehouse", new mongoose.Schema({}, { strict: false }));
    const User = mongoose.model("User", new mongoose.Schema({}, { strict: false }));
    const Product = mongoose.model("Product", new mongoose.Schema({}, { strict: false }));

    const cats = await Category.find();
    const brands = await Brand.find();
    const campaigns = await Campaign.find();
    const vendors = await Vendor.find();
    const warehouses = await Warehouse.find();
    const admins = await User.find({ role: { $in: ["admin", "super_admin"] } }).select("email role firstName lastName");
    const allProducts = await Product.find();

    console.log("=== CATEGORIES ===", cats.length);
    cats.forEach(c => console.log(`- ${c.name} (${c.slug}) id: ${c._id}`));

    console.log("\n=== BRANDS ===", brands.length);
    brands.forEach(b => console.log(`- ${b.name} (${b.slug}) id: ${b._id}`));

    console.log("\n=== CAMPAIGNS ===", campaigns.length);
    campaigns.forEach(c => console.log(`- ${c.name} (${c.slug}) status: ${c.status} id: ${c._id}`));

    console.log("\n=== VENDORS ===", vendors.length);
    vendors.forEach(v => console.log(`- ${v.businessName} (status: ${v.status || v.onboardingStatus}) userId: ${v.userId} id: ${v._id}`));

    console.log("\n=== WAREHOUSES ===", warehouses.length);
    warehouses.forEach(w => console.log(`- ${w.name} (${w.code}) id: ${w._id}`));

    console.log("\n=== ADMINS ===", admins.length);
    admins.forEach(a => console.log(`- ${a.email} (${a.role}) id: ${a._id}`));

    console.log("\n=== ALL PRODUCTS ===", allProducts.length);
    allProducts.forEach(p => console.log(`- ${p.name} (status: ${p.status}, approval: ${p.approvalStatus}, price: ${p.price}) id: ${p._id}`));

    await mongoose.disconnect();
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
})();
