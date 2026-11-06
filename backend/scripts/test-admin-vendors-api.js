require("dotenv").config();
const mongoose = require("mongoose");
const vendorService = require("../src/services/vendor.service");

async function testApi() {
  await mongoose.connect(process.env.MONGODB_URI);

  console.log("=== 1. listVendors default ===");
  const res1 = await vendorService.listVendors({});
  console.log("Returned vendors count:", res1.vendors.length);
  console.log("Pagination total:", res1.pagination.total);
  console.log("StatusCounts:", res1.statusCounts);
  if (res1.vendors.length > 0) {
    console.log("Sample mapped vendor keys:", Object.keys(res1.vendors[0]));
    console.log("Sample vendor user:", res1.vendors[0].userId);
    console.log("Sample vendor productsCount in list:", res1.vendors[0].productsCount);
    console.log("Sample vendor ordersCount in list:", res1.vendors[0].ordersCount);
  }

  console.log("\n=== 2. listVendors with search 'Smriti' ===");
  const res2 = await vendorService.listVendors({ search: "Smriti" });
  console.log("Search 'Smriti' count:", res2.vendors.length, "total:", res2.pagination.total);

  console.log("\n=== 3. listVendors with search by phone ===");
  const res3 = await vendorService.listVendors({ search: "+919876543210" });
  console.log("Search phone count:", res3.vendors.length);

  console.log("\n=== 4. getVendorById for Buybox Electronics ===");
  const buyboxVendor = res1.vendors.find(v => v.businessSlug === "buybox-electronics");
  if (buyboxVendor) {
    const detail = await vendorService.getVendorById(buyboxVendor._id.toString());
    console.log("Detail for Buybox Electronics:");
    console.log(" - productsCount:", detail.productsCount);
    console.log(" - ordersCount:", detail.ordersCount);
    console.log(" - user:", detail.user);
    console.log(" - isEmailVerified:", detail.userId?.isEmailVerified);
  }

  console.log("\n=== 5. getVendorOverview for Buybox Electronics ===");
  if (buyboxVendor) {
    const ov = await vendorService.getVendorOverview(buyboxVendor._id.toString());
    console.log("Overview KPIs for Buybox Electronics:", ov.kpis);
    console.log("Overview recent orders count:", ov.recentOrders?.length);
    console.log("Overview products count:", ov.products?.length);
  }

  await mongoose.disconnect();
}

testApi().catch((err) => {
  console.error(err);
  process.exit(1);
});
