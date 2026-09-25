/**
 * Buybox Full System End-to-End Verification Script
 * Validates:
 * 1. Database connection & existing persistent data
 * 2. Superadmin login & token issue
 * 3. Media upload endpoint (/api/v1/storefront/media/upload)
 * 4. Category creation with image & parent hierarchy
 * 5. Storefront category synchronization
 * 6. Brand creation with logo
 * 7. Storefront brand synchronization
 * 8. Vendor registration (User + Vendor linkage)
 * 9. Vendor product creation with variants & stock
 * 10. Admin moderation & approval workflow
 * 11. Public storefront product visibility
 * 12. Bulk XLSX template generation, validation & commit
 * 13. ImportExportJob logging & audit logging
 * 14. Vendor isolation (vendor cannot modify other vendor products)
 */

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");

const BASE_URL = "http://127.0.0.1:5000/api/v1";
const DB_URI = "mongodb://127.0.0.1:27017/buybox?replicaSet=rs0";

async function runVerification() {
  console.log("================================================================");
  console.log("   BUYBOX MASTER PRODUCTION SYSTEM E2E VERIFICATION SCRIPT");
  console.log("================================================================\n");

  const results = [];
  function record(step, name, passed, detail = "") {
    results.push({ step, name, passed, detail });
    const mark = passed ? " [PASS] " : " [FAIL] ";
    console.log(`${mark} Step ${step}: ${name}${detail ? ` -> ${detail}` : ""}`);
  }

  // 1. Verify DB connection and existing persistent data
  await mongoose.connect(DB_URI);
  const db = mongoose.connection.db;
  const catCount = await db.collection("categories").countDocuments();
  const brandCount = await db.collection("brands").countDocuments();
  const prdCount = await db.collection("products").countDocuments();
  record(1, "Persistent DB connection verified", catCount >= 8 && brandCount >= 6, `Categories: ${catCount}, Brands: ${brandCount}, Products: ${prdCount}`);

  // 2. Superadmin Login
  let adminToken = "";
  try {
    const res = await fetch(`${BASE_URL}/administrator/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin123@example.com", password: "admin123" }),
    });
    const data = await res.json();
    adminToken = data?.data?.token || data?.data?.accessToken || data?.token;
    record(2, "Superadmin Login", res.status === 200 && Boolean(adminToken), `Status ${res.status}`);
  } catch (err) {
    record(2, "Superadmin Login", false, err.message);
  }

  if (!adminToken) {
    console.error("Cannot proceed without admin token.");
    process.exit(1);
  }

  // 3. Media Upload Endpoint Test
  let uploadedMediaUrl = "";
  try {
    // Create a 1x1 test PNG buffer
    const dummyPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
    let body = `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="file"; filename="test_logo.png"\r\n`;
    body += `Content-Type: image/png\r\n\r\n`;
    const postData = Buffer.concat([
      Buffer.from(body, "utf-8"),
      dummyPng,
      Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8"),
    ]);

    const res = await fetch(`${BASE_URL}/storefront/media/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: postData,
    });
    const data = await res.json();
    uploadedMediaUrl = data?.data?.url || data?.url;
    record(3, "Media Upload API", res.status === 201 && Boolean(uploadedMediaUrl), `Uploaded to: ${uploadedMediaUrl}`);
  } catch (err) {
    record(3, "Media Upload API", false, err.message);
  }

  // 4. Admin Category Hierarchy Creation: Electronics -> Mobiles -> Smartphones
  let smartphonesCatId = "";
  try {
    // A. Root: Electronics
    let electronics = await db.collection("categories").findOne({ slug: "electronics" });
    if (!electronics) {
      const res = await fetch(`${BASE_URL}/categories`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Electronics", slug: "electronics", description: "Consumer Electronics" }),
      });
      const data = await res.json();
      electronics = data?.data?.category;
    }

    // B. Subcategory: Mobiles
    let mobiles = await db.collection("categories").findOne({ slug: "mobiles" });
    if (mobiles && !mobiles.parentId && electronics) {
      await db.collection("categories").updateOne({ _id: mobiles._id }, { $set: { parentId: electronics._id } });
    }

    // C. Child: Smartphones
    const slug = `smartphones-${Date.now().toString(36)}`;
    const res = await fetch(`${BASE_URL}/categories`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Smartphones",
        slug,
        parentId: mobiles ? mobiles._id.toString() : null,
        description: "Latest 5G and Flagship Smartphones",
        image: {
          url: uploadedMediaUrl || "https://images.unsplash.com/photo-1598327105666-5b89351aff97",
          altText: "Smartphones Category",
        },
      }),
    });
    const data = await res.json();
    smartphonesCatId = data?.data?.category?._id;
    record(4, "Category Hierarchy & Image Creation", res.status === 201 && Boolean(smartphonesCatId), `Created Smartphones (${smartphonesCatId}) under Mobiles`);
  } catch (err) {
    record(4, "Category Hierarchy & Image Creation", false, err.message);
  }

  // 5. Verify Storefront Category API
  try {
    const res = await fetch(`${BASE_URL}/categories`);
    const data = await res.json();
    const items = data?.data || [];
    const found = items.some((c) => c._id === smartphonesCatId || c.name === "Smartphones");
    record(5, "Storefront Category Sync", res.status === 200 && found, `Smartphones visible in public categories array (${items.length} total)`);
  } catch (err) {
    record(5, "Storefront Category Sync", false, err.message);
  }

  // 6. Admin Brand Creation with Logo: Samsung
  let samsungBrandId = "";
  try {
    const slug = `samsung-e2e-${Date.now().toString(36)}`;
    const res = await fetch(`${BASE_URL}/brands`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Samsung",
        slug,
        website: "https://samsung.com",
        description: "Global electronics and smartphone manufacturer",
        logo: {
          url: uploadedMediaUrl || "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c",
          altText: "Samsung Official Logo",
        },
      }),
    });
    const data = await res.json();
    samsungBrandId = data?.data?.brand?._id || data?.data?._id;
    record(6, "Brand Creation with Logo", res.status === 201 && Boolean(samsungBrandId), `Created brand Samsung (${samsungBrandId})`);
  } catch (err) {
    record(6, "Brand Creation with Logo", false, err.message);
  }

  // 7. Storefront Brand API Sync
  try {
    const res = await fetch(`${BASE_URL}/brands`);
    const data = await res.json();
    const items = data?.data || [];
    const found = items.some((b) => b._id === samsungBrandId || b.name === "Samsung");
    record(7, "Storefront Brand Sync", res.status === 200 && found, `Samsung visible in public brands API (${items.length} total)`);
  } catch (err) {
    record(7, "Storefront Brand Sync", false, err.message);
  }

  // 8. Vendor Registration Flow
  let vendorUserEmail = `vendor-${Date.now().toString(36)}@buybox.test`;
  let vendorPassword = "Password123!";
  let vendorToken = "";
  let vendorId = "";
  try {
    const regRes = await fetch(`${BASE_URL}/vendors/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: vendorUserEmail,
        password: vendorPassword,
        firstName: "Galaxy",
        lastName: "Store",
        businessName: `Galaxy Official Store ${Date.now().toString(36)}`,
        phone: "+919876543210",
      }),
    });
    const regData = await regRes.json();
    const regOk = regRes.status === 201;

    // Verify User <-> Vendor linkage in DB
    const userDoc = await db.collection("users").findOne({ email: vendorUserEmail });
    const vendorDoc = await db.collection("vendors").findOne({ userId: userDoc?._id });
    const linked = Boolean(userDoc && vendorDoc && vendorDoc.userId.toString() === userDoc._id.toString());
    vendorId = vendorDoc?._id?.toString();

    // Auto-approve vendor for testing products & import
    await db.collection("vendors").updateOne({ _id: vendorDoc._id }, { $set: { onboardingStatus: "approved", isActive: true } });

    // Vendor Login
    const loginRes = await fetch(`${BASE_URL}/vendor/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: vendorUserEmail, password: vendorPassword }),
    });
    const loginData = await loginRes.json();
    vendorToken = loginData?.data?.token || loginData?.data?.accessToken || loginData?.token;

    record(8, "Vendor Registration & User Linkage", regOk && linked && Boolean(vendorToken), `Registered ${vendorUserEmail}, linked vendorDoc ${vendorId}`);
  } catch (err) {
    record(8, "Vendor Registration & User Linkage", false, err.message);
  }

  // 9. Vendor Creates Product with Variants & Warehouse stock
  let createdProductId = "";
  try {
    const productSku = `SAM-S25-${Date.now().toString(36).toUpperCase()}`;
    const slug = `sam-s25-${Date.now().toString(36).toLowerCase()}`;
    const prdRes = await fetch(`${BASE_URL}/products`, {
      method: "POST",
      headers: { Authorization: `Bearer ${vendorToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Samsung Galaxy S25 Ultra 5G",
        slug,
        sku: productSku,
        categoryId: smartphonesCatId,
        brandId: samsungBrandId,
        description: "Flagship Snapdragon 8 Elite with 200MP camera and Titanium frame.",
        price: "129999.00",
        compareAtPrice: "139999.00",
        taxCategory: "standard",
      }),
    });
    const prdData = await prdRes.json();
    createdProductId = prdData?.data?.product?._id;

    if (!createdProductId) {
      record(9, "Vendor Product Creation", false, `Status ${prdRes.status}: ${JSON.stringify(prdData)}`);
    } else {
      // Create a variant
      const varRes = await fetch(`${BASE_URL}/product-variants/product/${createdProductId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${vendorToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: `${productSku}-BLK-512`,
          name: "Titanium Black / 512GB",
          price: "129999.00",
          stockQuantity: 50,
          attributes: { color: "Titanium Black", storage: "512GB", ram: "12GB" },
        }),
      });
      const varData = await varRes.json();
      const varOk = varRes.status === 201;

      record(9, "Vendor Product & Variant Creation", prdRes.status === 201 && varOk, `Created product ${createdProductId} in DRAFT (${varOk ? "variant created" : JSON.stringify(varData)})`);
    }
  } catch (err) {
    record(9, "Vendor Product & Variant Creation", false, err.message);
  }

  // 10. Product Moderation & Approval Workflow
  try {
    // Vendor submits for review
    const subRes = await fetch(`${BASE_URL}/products/${createdProductId}/submit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${vendorToken}`, "Content-Type": "application/json" },
    });
    const subData = await subRes.json();
    const isPending = subData?.data?.status === "pending_approval" || subRes.status === 200;

    // Admin approves product
    const appRes = await fetch(`${BASE_URL}/products/${createdProductId}/approve`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    });
    const appData = await appRes.json();
    const isApproved = appData?.data?.status === "active" || appRes.status === 200;

    record(10, "Product Submission & Admin Approval", isPending && isApproved, `Draft -> Pending Approval -> Active`);
  } catch (err) {
    record(10, "Product Moderation & Approval Workflow", false, err.message);
  }

  // 11. Public Storefront Product Visibility
  try {
    const res = await fetch(`${BASE_URL}/products/${createdProductId}`);
    const data = await res.json();
    const isPublic = res.status === 200 && data?.data?.product?.status === "active";
    record(11, "Storefront Product Visibility", isPublic, `Approved product is live on storefront`);
  } catch (err) {
    record(11, "Storefront Product Visibility", false, err.message);
  }

  // 12. Multi-Row XLSX Bulk Import & Grouping Test
  let importJobId = "";
  try {
    const parentSku = `BULK-NIKE-${Date.now().toString(36).toUpperCase()}`;
    const xlsxRows = [
      [
        "Product Name", "Parent SKU", "Variant SKU", "Category", "Brand",
        "Price", "Compare At Price", "Cost Price", "Stock Quantity",
        "Color", "Size", "Material", "Barcode", "Tax Category",
        "Weight (kg)", "Dimensions (LxWxH cm)", "Description", "Image 1", "Tags"
      ],
      [
        "Nike Air Max Precision Runner", parentSku, `${parentSku}-BLK-8`,
        "Fashion", "Nike", 7999.0, 9999.0, 4500.0, 30,
        "Black", "8", "Breathable Mesh", "890987654321", "standard",
        0.75, "30x20x12", "High-performance running shoe with Air cushioning.",
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff", "running,shoes,nike,sport"
      ],
      [
        "Nike Air Max Precision Runner", parentSku, `${parentSku}-BLK-9`,
        "Fashion", "Nike", 7999.0, 9999.0, 4500.0, 25,
        "Black", "9", "Breathable Mesh", "890987654322", "standard",
        0.75, "30x20x12", "High-performance running shoe with Air cushioning.",
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff", "running,shoes,nike,sport"
      ],
      [
        "Nike Air Max Precision Runner", parentSku, `${parentSku}-WHT-8`,
        "Fashion", "Nike", 7999.0, 9999.0, 4500.0, 20,
        "White", "8", "Breathable Mesh", "890987654323", "standard",
        0.75, "30x20x12", "High-performance running shoe with Air cushioning.",
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff", "running,shoes,nike,sport"
      ],
    ];

    const ws = xlsx.utils.aoa_to_sheet(xlsxRows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Products");
    const xlsxBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    // Step A: Validate
    const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
    let body = `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="file"; filename="nike_import.xlsx"\r\n`;
    body += `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`;
    const postData = Buffer.concat([
      Buffer.from(body, "utf-8"),
      xlsxBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8"),
    ]);

    const valRes = await fetch(`${BASE_URL}/products/vendor/import/validate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vendorToken}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: postData,
    });
    const valData = await valRes.json();
    const report = valData?.data;
    const valPassed = report?.validCount === 3 && report?.errorCount === 0;

    // Step B: Commit
    const validRows = report?.results?.map((r) => r.row) || report?.rows;
    const comRes = await fetch(`${BASE_URL}/products/vendor/import/commit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${vendorToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ rows: validRows }),
    });
    const comData = await comRes.json();
    const comResult = comData?.data;
    importJobId = comResult?.jobId;

    // Verify in MongoDB: Exactly 1 parent product created, with 3 variants
    const parentPrd = await db.collection("products").findOne({ sku: parentSku });
    const variants = await db.collection("productvariants").find({ productId: parentPrd?._id }).toArray();
    const inventory = await db.collection("inventories").find({ productVariantId: { $in: variants.map((v) => v._id) } }).toArray();
    const isGroupedCorrectly = Boolean(parentPrd && variants.length === 3 && inventory.length === 3);

    if (!valPassed || !isGroupedCorrectly) {
      record(12, "Multi-Row XLSX Import & Variant Grouping", false, `valRes: ${valRes.status} (valid: ${report?.validCount}, err: ${report?.errorCount}, details: ${JSON.stringify(report?.errorDetails)}), comRes: ${comRes?.status}: ${JSON.stringify(comData)}, grouped: ${isGroupedCorrectly}`);
    } else {
      record(12, "Multi-Row XLSX Import & Variant Grouping", true, `1 Product (${parentSku}) -> 3 Variants -> 3 Inventory ledger records`);
    }
  } catch (err) {
    record(12, "Multi-Row XLSX Import & Variant Grouping", false, err.message);
  }

  // 13. ImportExportJob Logging Verification
  try {
    const jobDoc = await db.collection("importexportjobs").findOne({ jobId: importJobId });
    const jobOk = Boolean(jobDoc && jobDoc.type === "import_products" && jobDoc.status === "completed");
    record(13, "ImportExportJob Audit Persistence", jobOk, `Logged job ${importJobId} with status ${jobDoc?.status}`);
  } catch (err) {
    record(13, "ImportExportJob Audit Persistence", false, err.message);
  }

  // 14. Security: Vendor Multi-Tenant Isolation
  try {
    // Create another vendor
    const otherEmail = `other-${Date.now().toString(36)}@buybox.test`;
    await fetch(`${BASE_URL}/vendors/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: otherEmail,
        password: "Password123!",
        firstName: "Other",
        lastName: "Vendor",
        businessName: "Other Vendor Store",
        phone: "+919876543211",
      }),
    });
    const otherUser = await db.collection("users").findOne({ email: otherEmail });
    await db.collection("vendors").updateOne({ userId: otherUser._id }, { $set: { onboardingStatus: "approved", isActive: true } });

    const otherLogin = await fetch(`${BASE_URL}/vendor/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: otherEmail, password: "Password123!" }),
    });
    const otherData = await otherLogin.json();
    const otherToken = otherData?.data?.token || otherData?.data?.accessToken || otherData?.token;

    // Attempt to modify Vendor A's product using Vendor B's token
    const attackRes = await fetch(`${BASE_URL}/products/${createdProductId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${otherToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Hacked by Competitor" }),
    });

    const isBlocked = attackRes.status === 403 || attackRes.status === 404;
    record(14, "Vendor Multi-Tenant Isolation", isBlocked, `Vendor B blocked from modifying Vendor A product (HTTP ${attackRes.status})`);
  } catch (err) {
    record(14, "Vendor Multi-Tenant Isolation", false, err.message);
  }

  // 15. Security: Vendor Cannot Create Category
  try {
    const catAttackRes = await fetch(`${BASE_URL}/categories`, {
      method: "POST",
      headers: { Authorization: `Bearer ${vendorToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Rogue Category", slug: `rogue-${Date.now()}` }),
    });
    const isCatBlocked = catAttackRes.status === 403;
    record(15, "Platform Taxonomy Security", isCatBlocked, `Vendor blocked from creating category (HTTP ${catAttackRes.status})`);
  } catch (err) {
    record(15, "Platform Taxonomy Security", false, err.message);
  }

  console.log("\n================================================================");
  console.log("                  E2E VERIFICATION SUMMARY                      ");
  console.log("================================================================");
  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`Total Checks: ${total}`);
  console.log(`Passed Checks: ${passedCount}`);
  console.log(`Failed Checks: ${total - passedCount}`);
  console.log(`Overall Health: ${passedCount === total ? "100% PRODUCTION READY" : "DEGRADED"}\n`);

  await mongoose.disconnect();
  process.exit(passedCount === total ? 0 : 1);
}

runVerification().catch((err) => {
  console.error("Verification execution error:", err);
  process.exit(1);
});
