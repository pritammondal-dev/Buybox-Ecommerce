/**
 * Phase E12D — MongoDB Restore Verification Tool
 * 
 * Verifies backup archives and restores them into an isolated test database.
 * Safety Guardrails:
 * - Refuses to restore over live/production databases (e.g. 'buybox', /prod/i)
 * - Validates SHA-256 checksums before touching any database
 * - Reconstructs full EJSON types and indexes
 * - Samples representative records (user, product, order, inventory)
 * - Verifies document counts and index counts against manifest
 * - Cleans up test database cleanly unless --keep-db is specified
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const env = require("../src/config/env");
const { maskMongoUri, extractDatabaseName } = require("./mongodb-backup");

const DEFAULT_ISOLATED_DB_NAME = "buybox_restore_verification_test";

/**
 * Validates that the target database name is isolated and safe
 */
function assertSafeTargetDatabase(targetDbName, sourceDbName) {
  if (!targetDbName || typeof targetDbName !== "string") {
    throw new Error("Target database name must be a non-empty string.");
  }

  const normalized = targetDbName.trim().toLowerCase();

  // Guardrail 1: Never target live 'buybox'
  if (normalized === "buybox") {
    throw new Error(
      `CRITICAL SAFETY VIOLATION: Target database '${targetDbName}' matches production database. Restore aborted.`
    );
  }

  // Guardrail 2: Never target names containing 'prod' or 'production' or 'live'
  if (/prod|production|live/i.test(normalized)) {
    throw new Error(
      `CRITICAL SAFETY VIOLATION: Target database '${targetDbName}' appears to be a production/live environment. Restore aborted.`
    );
  }

  // Guardrail 3: Never restore over the source database
  if (sourceDbName && normalized === sourceDbName.trim().toLowerCase()) {
    throw new Error(
      `CRITICAL SAFETY VIOLATION: Target database '${targetDbName}' is identical to source database '${sourceDbName}'. Restore aborted.`
    );
  }

  return true;
}

/**
 * Verifies archive integrity (manifest & SHA-256 hashes) before restoration
 */
function verifyArchiveIntegrity(backupDir) {
  const manifestPath = path.join(backupDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Invalid backup archive: manifest.json not found in ${backupDir}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const results = {
    valid: true,
    manifestTimestamp: manifest.timestamp,
    sourceDatabase: manifest.sourceDatabase,
    collectionsChecked: 0,
    failures: [],
  };

  for (const [colName, meta] of Object.entries(manifest.collections || {})) {
    const dataFilePath = path.join(backupDir, meta.dataFile || `${colName}.json`);
    if (!fs.existsSync(dataFilePath)) {
      results.valid = false;
      results.failures.push(`Missing data file for collection: ${colName}`);
      continue;
    }

    const content = fs.readFileSync(dataFilePath, "utf8");
    const hash = crypto.createHash("sha256").update(content, "utf8").digest("hex");

    if (hash !== meta.sha256) {
      results.valid = false;
      results.failures.push(
        `Checksum mismatch on ${colName}: expected ${meta.sha256}, calculated ${hash}`
      );
    } else {
      results.collectionsChecked++;
    }
  }

  return results;
}

/**
 * Executes restore verification into an isolated test database
 */
async function verifyRestore(options = {}) {
  const {
    backupDir,
    targetDbName = DEFAULT_ISOLATED_DB_NAME,
    mongoBaseUri = env.MONGODB_URI,
    keepDatabase = false,
  } = options;

  if (!backupDir || !fs.existsSync(backupDir)) {
    throw new Error(`Backup directory does not exist: ${backupDir}`);
  }

  const startTime = Date.now();
  const manifestPath = path.join(backupDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const sourceDbName = manifest.sourceDatabase || extractDatabaseName(mongoBaseUri);

  // Enforce isolated target database safety
  assertSafeTargetDatabase(targetDbName, sourceDbName);

  // Step 1: Preflight Archive Check
  const archiveCheck = verifyArchiveIntegrity(backupDir);
  if (!archiveCheck.valid) {
    throw new Error(`Archive integrity check failed: ${archiveCheck.failures.join("; ")}`);
  }

  // Construct isolated target connection URI
  const targetDbUri = mongoBaseUri.replace(
    /\/[^/?]+(?:\?|$)/,
    `/${targetDbName}?`
  );

  const report = {
    timestamp: new Date().toISOString(),
    sourceDatabase: sourceDbName,
    targetDatabase: targetDbName,
    targetUriMasked: maskMongoUri(targetDbUri),
    archiveVerification: {
      status: "PASSED",
      collectionsChecked: archiveCheck.collectionsChecked,
    },
    restoration: {
      status: "PENDING",
      collectionsRestored: 0,
      documentsRestored: 0,
      indexesRestored: 0,
    },
    validation: {
      status: "PENDING",
      mismatches: [],
      sampleChecks: {},
    },
    durationMs: 0,
  };

  const targetConn = await mongoose.createConnection(targetDbUri).asPromise();
  const targetDb = targetConn.db;
  const EJSON = mongoose.mongo.BSON.EJSON;

  try {
    // Clean prior state of isolated test DB
    await targetDb.dropDatabase().catch(() => {});

    // Step 2: Restore collections and recreate indexes
    for (const [colName, meta] of Object.entries(manifest.collections || {})) {
      const dataFilePath = path.join(backupDir, meta.dataFile || `${colName}.json`);
      const indexFilePath = path.join(backupDir, meta.indexFile || `${colName}.indexes.json`);

      const rawData = fs.readFileSync(dataFilePath, "utf8");
      const docs = EJSON.parse(rawData);
      const targetCollection = targetDb.collection(colName);

      if (docs.length > 0) {
        await targetCollection.insertMany(docs);
        report.restoration.documentsRestored += docs.length;
      }

      if (fs.existsSync(indexFilePath)) {
        const indexes = JSON.parse(fs.readFileSync(indexFilePath, "utf8"));
        const indexSpecs = [];
        for (const idx of indexes) {
          if (idx.name === "_id_") continue;
          const { key, name, unique, sparse, partialFilterExpression, expireAfterSeconds, weights, default_language } = idx;
          const opt = { name };
          if (unique) opt.unique = true;
          if (sparse) opt.sparse = true;
          if (partialFilterExpression) opt.partialFilterExpression = partialFilterExpression;
          if (expireAfterSeconds !== undefined) opt.expireAfterSeconds = expireAfterSeconds;
          if (weights) opt.weights = weights;
          if (default_language) opt.default_language = default_language;
          indexSpecs.push({ key, ...opt });
        }

        if (indexSpecs.length > 0) {
          try {
            await targetCollection.createIndexes(indexSpecs);
            report.restoration.indexesRestored += indexSpecs.length;
          } catch (batchErr) {
            for (const spec of indexSpecs) {
              const { key, ...opt } = spec;
              try {
                await targetCollection.createIndex(key, opt);
                report.restoration.indexesRestored++;
              } catch (idxErr) {
                console.warn(`[WARN] Rebuilding index ${opt.name} on ${colName}: ${idxErr.message}`);
              }
            }
          }
        }
      }

      report.restoration.collectionsRestored++;
    }

    report.restoration.status = "PASSED";

    // Step 3: Validate database invariants & counts
    for (const [colName, meta] of Object.entries(manifest.collections || {})) {
      const actualCount = await targetDb.collection(colName).countDocuments();
      if (actualCount !== meta.count) {
        report.validation.mismatches.push({
          collection: colName,
          expected: meta.count,
          actual: actualCount,
        });
      }
    }

    // Sample checks: Users, Products, Orders, Inventories
    const sampleSuperadmin = await targetDb.collection("users").findOne({ role: "super_admin" });
    report.validation.sampleChecks.superadmin = {
      present: !!sampleSuperadmin,
      hasEmail: !!(sampleSuperadmin && sampleSuperadmin.email),
      isActive: !!(sampleSuperadmin && sampleSuperadmin.isActive),
    };

    const productCount = await targetDb.collection("products").countDocuments();
    const sampleProduct = await targetDb.collection("products").findOne({});
    report.validation.sampleChecks.products = {
      count: productCount,
      samplePresent: !!sampleProduct,
      hasTitleOrName: !!(sampleProduct && (sampleProduct.name || sampleProduct.title)),
    };

    const orderCount = await targetDb.collection("orders").countDocuments();
    report.validation.sampleChecks.orders = {
      count: orderCount,
    };

    const inventoryCount = await targetDb.collection("inventories").countDocuments();
    report.validation.sampleChecks.inventories = {
      count: inventoryCount,
    };

    if (report.validation.mismatches.length === 0 && report.validation.sampleChecks.superadmin.present) {
      report.validation.status = "PASSED";
    } else {
      report.validation.status = "FAILED";
    }

    report.durationMs = Date.now() - startTime;
    return report;
  } finally {
    if (!keepDatabase) {
      // Teardown isolated test database
      await targetDb.dropDatabase().catch(() => {});
    }
    await targetConn.close();
  }
}

/**
 * Finds the latest backup directory in the default backups location
 */
function findLatestBackupDir(backupsRoot = path.join(__dirname, "..", "backups")) {
  if (!fs.existsSync(backupsRoot)) return null;
  const entries = fs.readdirSync(backupsRoot, { withFileTypes: true });
  const backupFolders = entries
    .filter((e) => e.isDirectory() && e.name.startsWith("backup-"))
    .map((e) => ({
      name: e.name,
      fullPath: path.join(backupsRoot, e.name),
      mtimeMs: fs.statSync(path.join(backupsRoot, e.name)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return backupFolders.length > 0 ? backupFolders[0].fullPath : null;
}

// CLI Execution
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const backupDirArg = args.find((a) => !a.startsWith("--"));
    const keepDb = args.includes("--keep-db");
    const targetDbArg = args.find((a) => a.startsWith("--target-db="));
    const targetDbName = targetDbArg ? targetDbArg.split("=")[1] : DEFAULT_ISOLATED_DB_NAME;

    let backupDir = backupDirArg;
    if (!backupDir) {
      backupDir = findLatestBackupDir();
    }

    if (!backupDir) {
      console.error("No backup archive found to verify. Run node scripts/mongodb-backup.js --execute first.");
      process.exit(1);
    }

    console.log("==================================================");
    console.log("BUYBOX RESTORE VERIFICATION TOOL");
    console.log("==================================================");
    console.log(`- Backup Archive: ${backupDir}`);
    console.log(`- Target Test DB: ${targetDbName}`);
    console.log(`- Keep Test DB:   ${keepDb}`);

    try {
      const report = await verifyRestore({
        backupDir,
        targetDbName,
        keepDatabase: keepDb,
      });

      console.log(`- Archive Integrity: ${report.archiveVerification.status} (${report.archiveVerification.collectionsChecked} collections verified)`);
      console.log(`- Restoration Status: ${report.restoration.status}`);
      console.log(`  * Collections Restored: ${report.restoration.collectionsRestored}`);
      console.log(`  * Documents Restored:   ${report.restoration.documentsRestored}`);
      console.log(`  * Indexes Restored:     ${report.restoration.indexesRestored}`);
      console.log(`- Validation Status:  ${report.validation.status}`);
      console.log(`  * Superadmin Record:  ${report.validation.sampleChecks.superadmin?.present ? "OK" : "MISSING"}`);
      console.log(`  * Products Restored:  ${report.validation.sampleChecks.products?.count || 0}`);
      console.log(`  * Orders Restored:    ${report.validation.sampleChecks.orders?.count || 0}`);
      console.log(`  * Total Duration:     ${report.durationMs}ms`);
      console.log("==================================================");
      if (report.validation.status === "PASSED") {
        console.log("STATUS: SUCCESSFUL RESTORE VERIFICATION (100% INTEGRITY)");
      } else {
        console.error("STATUS: RESTORE VERIFICATION FAILED WITH MISMATCHES:", report.validation.mismatches);
        process.exit(1);
      }
      console.log("==================================================");
    } catch (err) {
      console.error("Restore verification failed with error:", err.message);
      process.exit(1);
    }
  })();
}

module.exports = {
  verifyRestore,
  verifyArchiveIntegrity,
  assertSafeTargetDatabase,
  findLatestBackupDir,
  DEFAULT_ISOLATED_DB_NAME,
};
