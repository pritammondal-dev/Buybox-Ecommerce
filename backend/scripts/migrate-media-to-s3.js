#!/usr/bin/env node
/**
 * BUYBOX E-COMMERCE — MEDIA TO S3 MIGRATION UTILITY
 *
 * Safe, idempotent migration script to inventory, verify, and upload
 * local media assets to persistent S3-compatible object storage.
 *
 * SAFETY RULES ENFORCED:
 * 1. Defaults to DRY-RUN mode.
 * 2. Original local files are NEVER deleted, renamed, or modified.
 * 3. Supports resume via state report.
 * 4. Never modifies MongoDB references unless explicit '--apply --update-db' is provided.
 * 5. Credentials are never hardcoded or logged.
 *
 * Usage:
 *   node scripts/migrate-media-to-s3.js                 # Dry-run (inventory & simulation)
 *   node scripts/migrate-media-to-s3.js --apply         # Upload files to S3, verify, keep local files & DB
 *   node scripts/migrate-media-to-s3.js --apply --update-db # Upload & update MongoDB references
 *   node scripts/migrate-media-to-s3.js --include-digital   # Include private digital assets
 *   node scripts/migrate-media-to-s3.js --resume-file=path  # Resume from previous report
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const storageService = require("../src/services/storage");
const S3StorageProvider = require("../src/services/storage/s3-storage.provider");
const S3Client = require("../src/services/storage/s3-client");

// Command-line flag parsing
const args = process.argv.slice(2);
const isApply = args.includes("--apply");
const isDryRun = !isApply;
const updateDb = args.includes("--update-db");
const includeDigital = args.includes("--include-digital");

let resumeFilePath = null;
const resumeArg = args.find((a) => a.startsWith("--resume-file="));
if (resumeArg) {
  resumeFilePath = resumeArg.split("=")[1];
}

const UPLOADS_DIR = path.resolve(__dirname, "../public/uploads");
const DIGITAL_DIR = path.resolve(__dirname, "../storage/digital-assets");
const REPORTS_DIR = path.resolve(__dirname, "migration-reports");

if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// MIME type resolution
const MIME_MAP = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] || "application/octet-stream";
}

async function runMigration() {
  console.log("================================================================================");
  console.log("BUYBOX E-COMMERCE — PERSISTENT MEDIA STORAGE MIGRATION");
  console.log("================================================================================");
  console.log(`Mode:                  ${isDryRun ? "DRY-RUN (SIMULATION ONLY - NO WRITES)" : "APPLY (WRITES ENABLED)"}`);
  console.log(`Database updates:      ${updateDb ? "ENABLED (--update-db provided)" : "DISABLED (References unchanged)"}`);
  console.log(`Digital assets:        ${includeDigital ? "INCLUDED (--include-digital provided)" : "EXCLUDED (Public media only)"}`);
  console.log(`Target S3 Bucket:      ${process.env.S3_BUCKET || "(NOT CONFIGURED)"}`);
  console.log(`Target S3 Region:      ${process.env.S3_REGION || "us-east-1"}`);
  console.log(`Target Public Base URL:${process.env.S3_PUBLIC_BASE_URL || "(Default S3 Host)"}`);
  console.log("================================================================================\n");

  // Validate S3 configuration if running in apply mode
  let s3Provider = null;
  if (!isDryRun) {
    if (!storageService.isS3Configured()) {
      console.error("ERROR: S3 configuration incomplete. S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY must be set to run with --apply.");
      process.exit(1);
    }
    try {
      s3Provider = new S3StorageProvider();
      s3Provider.validateConfig();
    } catch (cfgErr) {
      console.error(`ERROR: S3 configuration error: ${cfgErr.message}`);
      process.exit(1);
    }
  } else {
    // In dry-run, create virtual provider if config is set, or mock for simulation
    s3Provider = new S3StorageProvider({
      bucket: process.env.S3_BUCKET || "dryrun-bucket",
      region: process.env.S3_REGION || "us-east-1",
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "dryrun-key",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "dryrun-secret",
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || "https://dryrun-cdn.example.com",
    });
  }

  // Load resume state if provided
  const resumedItems = new Set();
  if (resumeFilePath && fs.existsSync(resumeFilePath)) {
    try {
      const stateContent = JSON.parse(fs.readFileSync(resumeFilePath, "utf8"));
      if (Array.isArray(stateContent.uploadedFiles)) {
        for (const item of stateContent.uploadedFiles) {
          resumedItems.add(item.localPath);
        }
        console.log(`[Resume] Loaded ${resumedItems.size} previously uploaded items from ${resumeFilePath}`);
      }
    } catch (e) {
      console.warn(`[Resume] Failed to parse resume file: ${e.message}`);
    }
  }

  // Connect to MongoDB to inventory references
  let dbConnected = false;
  let shouldDisconnectDb = false;
  const dbUrl = process.env.MONGODB_URI;

  if (mongoose.connection.readyState === 1) {
    dbConnected = true;
    console.log(`[Database] Reusing active MongoDB connection for media reference inventory.`);
  } else if (dbUrl) {
    try {
      await mongoose.connect(dbUrl);
      dbConnected = true;
      shouldDisconnectDb = true;
      console.log(`[Database] Connected to MongoDB for media reference inventory.`);
    } catch (dbErr) {
      console.warn(`[Database] Could not connect to MongoDB: ${dbErr.message}. Proceeding with filesystem inventory only.`);
    }
  } else {
    console.warn("[Database] MONGODB_URI not set. Proceeding with filesystem-only inventory.");
  }

  // 1. Gather database media references
  const dbReferences = new Map(); // normalizedPath -> array of { model, id, field }

  function recordRef(url, model, id, field) {
    if (!url || typeof url !== "string") return;
    const cleanUrl = url.trim();
    if (cleanUrl.startsWith("/uploads/")) {
      const filename = cleanUrl.replace(/^\/uploads\//, "");
      if (!dbReferences.has(filename)) dbReferences.set(filename, []);
      dbReferences.get(filename).push({ model, id: String(id), field, originalUrl: url });
    }
  }

  if (dbConnected) {
    try {
      console.log("[Inventory] Querying MongoDB collections for media references...");

      // Products
      const Product = mongoose.models.Product || mongoose.model("Product", new mongoose.Schema({}, { strict: false }));
      const products = await Product.find({}).lean();
      for (const prod of products) {
        if (Array.isArray(prod.images)) {
          prod.images.forEach((img, idx) => recordRef(img.url, "Product", prod._id, `images[${idx}].url`));
        }
        if (prod.primaryImage?.url) {
          recordRef(prod.primaryImage.url, "Product", prod._id, "primaryImage.url");
        }
      }

      // Product Variants
      const ProductVariant = mongoose.models.ProductVariant || mongoose.model("ProductVariant", new mongoose.Schema({}, { strict: false }));
      const variants = await ProductVariant.find({}).lean();
      for (const v of variants) {
        if (v.image?.url) recordRef(v.image.url, "ProductVariant", v._id, "image.url");
        if (Array.isArray(v.images)) {
          v.images.forEach((img, idx) => recordRef(typeof img === "string" ? img : img.url, "ProductVariant", v._id, `images[${idx}]`));
        }
      }

      // StorefrontMedia
      const StorefrontMedia = mongoose.models.StorefrontMedia || mongoose.model("StorefrontMedia", new mongoose.Schema({}, { strict: false }));
      const mediaDocs = await StorefrontMedia.find({}).lean();
      for (const m of mediaDocs) {
        if (m.url) recordRef(m.url, "StorefrontMedia", m._id, "url");
      }

      // StorefrontBanner
      const StorefrontBanner = mongoose.models.StorefrontBanner || mongoose.model("StorefrontBanner", new mongoose.Schema({}, { strict: false }));
      const banners = await StorefrontBanner.find({}).lean();
      for (const b of banners) {
        if (b.imageUrl) recordRef(b.imageUrl, "StorefrontBanner", b._id, "imageUrl");
        if (b.mobileImageUrl) recordRef(b.mobileImageUrl, "StorefrontBanner", b._id, "mobileImageUrl");
      }

      // SpecialEventPage
      const SpecialEventPage = mongoose.models.SpecialEventPage || mongoose.model("SpecialEventPage", new mongoose.Schema({}, { strict: false }));
      const eventPages = await SpecialEventPage.find({}).lean();
      for (const ep of eventPages) {
        if (ep.bannerUrl) recordRef(ep.bannerUrl, "SpecialEventPage", ep._id, "bannerUrl");
        if (ep.mobileBannerUrl) recordRef(ep.mobileBannerUrl, "SpecialEventPage", ep._id, "mobileBannerUrl");
        if (Array.isArray(ep.sections)) {
          ep.sections.forEach((s, idx) => {
            if (s.config?.imageUrl) recordRef(s.config.imageUrl, "SpecialEventPage", ep._id, `sections[${idx}].config.imageUrl`);
          });
        }
      }

      // DigitalEntitlements
      if (includeDigital) {
        const DigitalEntitlement = mongoose.models.DigitalEntitlement || mongoose.model("DigitalEntitlement", new mongoose.Schema({}, { strict: false }));
        const entitlements = await DigitalEntitlement.find({}).lean();
        for (const de of entitlements) {
          if (de.asset?.storageKey) {
            const key = de.asset.storageKey;
            if (!dbReferences.has(key)) dbReferences.set(key, []);
            dbReferences.get(key).push({ model: "DigitalEntitlement", id: String(de._id), field: "asset.storageKey" });
          }
        }
      }

      console.log(`[Inventory] Found ${dbReferences.size} distinct media items referenced in MongoDB.`);
    } catch (queryErr) {
      console.warn(`[Inventory] Error scanning database collections: ${queryErr.message}`);
    }
  }

  // 2. Gather filesystem files
  console.log(`[Inventory] Scanning local public uploads directory: ${UPLOADS_DIR}`);
  const localFiles = [];
  if (fs.existsSync(UPLOADS_DIR)) {
    const filenames = fs.readdirSync(UPLOADS_DIR);
    for (const fn of filenames) {
      const fullPath = path.join(UPLOADS_DIR, fn);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          localFiles.push({
            filename: fn,
            fullPath,
            size: stat.size,
            isPrivate: false,
            prefix: "uploads",
            storageKey: `uploads/${fn}`,
          });
        }
      } catch {
        // Skip unreadable
      }
    }
  }

  if (includeDigital && fs.existsSync(DIGITAL_DIR)) {
    console.log(`[Inventory] Scanning private digital storage directory: ${DIGITAL_DIR}`);
    const digitalFilenames = fs.readdirSync(DIGITAL_DIR);
    for (const fn of digitalFilenames) {
      const fullPath = path.join(DIGITAL_DIR, fn);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          localFiles.push({
            filename: fn,
            fullPath,
            size: stat.size,
            isPrivate: true,
            prefix: "digital-assets",
            storageKey: `digital-assets/${fn}`,
          });
        }
      } catch {}
    }
  }

  console.log(`[Inventory] Found ${localFiles.length} local files across storage directories.`);

  // 3. Classify files (Referenced vs Orphan vs Missing)
  const inventoryReport = {
    referenced: [],
    orphans: [],
    missing: [],
  };

  const localFileSet = new Set(localFiles.map((f) => f.filename));

  for (const file of localFiles) {
    const refs = dbReferences.get(file.filename) || [];
    if (refs.length > 0) {
      inventoryReport.referenced.push({ ...file, references: refs });
    } else {
      inventoryReport.orphans.push(file);
    }
  }

  for (const [filename, refs] of dbReferences.entries()) {
    if (!localFileSet.has(filename)) {
      inventoryReport.missing.push({ filename, references: refs });
    }
  }

  console.log(`[Classification] Summary:`);
  console.log(`  - Database-Referenced Files: ${inventoryReport.referenced.length}`);
  console.log(`  - Local Orphan Candidates:   ${inventoryReport.orphans.length}`);
  console.log(`  - Missing Referenced Files:  ${inventoryReport.missing.length}`);

  // 4. Perform simulation or upload
  const migrationResults = {
    mode: isDryRun ? "dry-run" : "apply",
    startedAt: new Date().toISOString(),
    totalDiscovered: localFiles.length,
    eligibleForUpload: inventoryReport.referenced.length,
    uploaded: [],
    skippedExisting: [],
    failed: [],
    dbUpdatesCount: 0,
  };

  const filesToProcess = inventoryReport.referenced;

  console.log(`\n[Execution] Beginning ${isDryRun ? "dry-run simulation" : "S3 upload process"} for ${filesToProcess.length} referenced files...`);

  for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i];
    const mimeType = getMimeType(file.fullPath);
    const targetUrl = s3Provider.getPublicUrl(file.storageKey);

    // Check if previously resumed
    if (resumedItems.has(file.fullPath)) {
      migrationResults.skippedExisting.push({
        filename: file.filename,
        key: file.storageKey,
        reason: "Already uploaded in resume state",
      });
      continue;
    }

    if (isDryRun) {
      // Dry-run simulation
      migrationResults.uploaded.push({
        filename: file.filename,
        localPath: file.fullPath,
        size: file.size,
        mimeType,
        targetKey: file.storageKey,
        simulatedUrl: targetUrl,
        referenceCount: file.references.length,
        status: "SIMULATED_SUCCESS",
      });
    } else {
      // Real upload
      try {
        // Idempotency: Check if already exists in S3
        const existsInS3 = await s3Provider.assetExists(file.storageKey, file.isPrivate);
        if (existsInS3) {
          migrationResults.skippedExisting.push({
            filename: file.filename,
            key: file.storageKey,
            reason: "Object already exists in S3",
          });
          continue;
        }

        const buffer = fs.readFileSync(file.fullPath);
        if (file.isPrivate) {
          await s3Provider.saveDigitalAsset({
            filename: file.filename,
            buffer,
            mimeType,
            metadata: { originalName: file.filename },
          });
        } else {
          await s3Provider.savePublicMedia({
            filename: file.filename,
            buffer,
            mimeType,
            prefix: file.prefix,
          });
        }

        // Verify upload via existence check
        const verified = await s3Provider.assetExists(file.storageKey, file.isPrivate);
        if (!verified) {
          throw new Error("Verification failed: object does not exist in S3 after PutObject");
        }

        migrationResults.uploaded.push({
          filename: file.filename,
          localPath: file.fullPath,
          size: file.size,
          mimeType,
          targetKey: file.storageKey,
          targetUrl,
          verified: true,
          status: "UPLOADED_AND_VERIFIED",
        });

        // Optionally update MongoDB references
        if (updateDb && dbConnected) {
          const oldUrl = `/uploads/${file.filename}`;
          // Update matching references
          for (const ref of file.references) {
            if (ref.model === "Product") {
              const Product = mongoose.models.Product;
              await Product.updateOne(
                { _id: ref.id, "images.url": oldUrl },
                { $set: { "images.$.url": targetUrl } }
              );
              await Product.updateOne(
                { _id: ref.id, "primaryImage.url": oldUrl },
                { $set: { "primaryImage.url": targetUrl } }
              );
              migrationResults.dbUpdatesCount++;
            } else if (ref.model === "ProductVariant") {
              const ProductVariant = mongoose.models.ProductVariant;
              await ProductVariant.updateOne(
                { _id: ref.id, "image.url": oldUrl },
                { $set: { "image.url": targetUrl } }
              );
              migrationResults.dbUpdatesCount++;
            } else if (ref.model === "StorefrontMedia") {
              const StorefrontMedia = mongoose.models.StorefrontMedia;
              await StorefrontMedia.updateOne(
                { _id: ref.id },
                { $set: { url: targetUrl, storageProvider: "s3", storageKey: file.storageKey } }
              );
              migrationResults.dbUpdatesCount++;
            } else if (ref.model === "StorefrontBanner") {
              const StorefrontBanner = mongoose.models.StorefrontBanner;
              await StorefrontBanner.updateOne(
                { _id: ref.id, imageUrl: oldUrl },
                { $set: { imageUrl: targetUrl } }
              );
              migrationResults.dbUpdatesCount++;
            } else if (ref.model === "SpecialEventPage") {
              const SpecialEventPage = mongoose.models.SpecialEventPage;
              await SpecialEventPage.updateOne(
                { _id: ref.id, bannerUrl: oldUrl },
                { $set: { bannerUrl: targetUrl } }
              );
              migrationResults.dbUpdatesCount++;
            }
          }
        }
      } catch (uploadErr) {
        migrationResults.failed.push({
          filename: file.filename,
          localPath: file.fullPath,
          error: uploadErr.message,
        });
      }
    }
  }

  migrationResults.completedAt = new Date().toISOString();

  // Save report
  const timestamp = Date.now();
  const reportPath = path.join(REPORTS_DIR, `migration_report_${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ inventory: inventoryReport, results: migrationResults }, null, 2));

  console.log("\n================================================================================");
  console.log("MIGRATION EXECUTION REPORT");
  console.log("================================================================================");
  console.log(`Status:                  COMPLETED (${migrationResults.mode.toUpperCase()})`);
  console.log(`Referenced Files:        ${inventoryReport.referenced.length}`);
  console.log(`Simulated / Uploaded:    ${migrationResults.uploaded.length}`);
  console.log(`Skipped (Already in S3): ${migrationResults.skippedExisting.length}`);
  console.log(`Failed:                  ${migrationResults.failed.length}`);
  console.log(`Orphan Candidates:       ${inventoryReport.orphans.length}`);
  console.log(`Missing References:      ${inventoryReport.missing.length}`);
  console.log(`Database References:     ${migrationResults.dbUpdatesCount} updated`);
  console.log(`Local Files Deleted:     0 (ORIGINALS ARE ALWAYS PRESERVED)`);
  console.log(`Report Saved To:         ${reportPath}`);
  console.log("================================================================================\n");

  if (shouldDisconnectDb) {
    await mongoose.disconnect();
  }

  return { inventoryReport, migrationResults, reportPath };
}

if (require.main === module) {
  runMigration().catch((err) => {
    console.error("Migration failed unexpectedly:", err);
    process.exit(1);
  });
}

module.exports = {
  runMigration,
  getMimeType,
};
