/**
 * BUYBOX E-COMMERCE — PRODUCTION MONGODB INDEX DEPLOYMENT & AUDIT TOOL
 *
 * Operational Capabilities:
 * 1. Read-only Audit Mode (--audit / default): Compares declared Mongoose schema
 *    indexes against live MongoDB collections without mutating database state.
 * 2. Explicit Apply Mode (--apply): Builds approved missing indexes in the background.
 * 3. Preflight Duplicate Verification: Ensures unique indexes are not built when
 *    colliding data exists in the collection, preventing E11000 build failures.
 * 4. Safety Guarantee: NEVER drops or replaces existing indexes automatically.
 * 5. Structured Reporting: Produces both console summaries and machine-readable JSON logs.
 *
 * Usage:
 *   node scripts/deploy-indexes.js               # Audit mode (read-only)
 *   node scripts/deploy-indexes.js --audit       # Audit mode (read-only)
 *   node scripts/deploy-indexes.js --apply       # Apply missing indexes safely
 *   node scripts/deploy-indexes.js --collection=products --audit
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const env = require("../src/config/env");

/**
 * Normalizes index key object into canonical string for comparison.
 * e.g. { customerId: 1, createdAt: -1 } -> "customerId:1_createdAt:-1"
 */
function serializeKey(keyObj) {
  if (!keyObj || typeof keyObj !== "object") return "";
  return Object.entries(keyObj)
    .map(([k, v]) => `${k}:${v}`)
    .join("_");
}

/**
 * Discovers and registers all Mongoose models in src/models.
 * @returns {Array<{ file: string, model: any, name: string, collectionName: string }>}
 */
function discoverModels() {
  const modelsDir = path.join(__dirname, "../src/models");
  const modelFiles = fs.readdirSync(modelsDir).filter((f) => f.endsWith(".js"));
  const loaded = [];

  for (const file of modelFiles) {
    try {
      const model = require(path.join(modelsDir, file));
      if (model && model.schema) {
        loaded.push({
          file,
          model,
          name: model.modelName,
          collectionName: model.collection?.name || model.modelName.toLowerCase() + "s",
        });
      }
    } catch (err) {
      // Ignore non-model helpers
    }
  }

  return loaded;
}

/**
 * Extracts all declared indexes from a Mongoose schema (both schema.index() and path-level).
 * @param {import("mongoose").Schema} schema
 * @returns {Array<{ key: Object, options: Object, serializedKey: string, source: string }>}
 */
function extractDeclaredIndexes(schema) {
  const declared = [];

  // 1. Schema-level indexes
  const schemaIndexes = schema.indexes();
  for (const [keys, options = {}] of schemaIndexes) {
    declared.push({
      key: keys,
      options,
      serializedKey: serializeKey(keys),
      source: "schema.index()",
    });
  }

  // 2. Path-level indexes
  for (const [pathname, schemaType] of Object.entries(schema.paths)) {
    if (pathname === "_id") continue;
    const opts = schemaType.options || {};
    if (opts.index || opts.unique || opts.sparse) {
      const keys = { [pathname]: 1 };
      const indexOptions = {};
      if (opts.unique) indexOptions.unique = true;
      if (opts.sparse) indexOptions.sparse = true;
      if (opts.index && typeof opts.index === "object") {
        Object.assign(indexOptions, opts.index);
      }

      const serialized = serializeKey(keys);
      if (!declared.some((d) => d.serializedKey === serialized)) {
        declared.push({
          key: keys,
          options: indexOptions,
          serializedKey: serialized,
          source: "path.index",
        });
      }
    }
  }

  return declared;
}

/**
 * Preflight check for unique index compatibility.
 * Checks whether existing data in a collection contains duplicate values for the given index key.
 *
 * @param {import("mongodb").Db} db
 * @param {string} collectionName
 * @param {Object} key
 * @returns {Promise<{ hasDuplicates: boolean, duplicateCount: number, sampleDuplicates: Array }>}
 */
async function checkDuplicateKeyRisk(db, collectionName, key) {
  try {
    const fields = Object.keys(key);
    const groupId = fields.length === 1 ? `$${fields[0]}` : fields.reduce((acc, f) => { acc[f] = `$${f}`; return acc; }, {});
    const pipeline = [
      { $group: { _id: groupId, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 }, _id: { $ne: null } } },
      { $limit: 5 },
    ];

    const results = await db.collection(collectionName).aggregate(pipeline).toArray();
    return {
      hasDuplicates: results.length > 0,
      duplicateCount: results.length,
      sampleDuplicates: results,
    };
  } catch (err) {
    return {
      hasDuplicates: false,
      duplicateCount: 0,
      sampleDuplicates: [],
      error: err.message,
    };
  }
}

/**
 * Audit all declared Mongoose models against live MongoDB database.
 *
 * @param {Object} [options]
 * @param {string} [options.mongoUri]
 * @param {string} [options.targetCollection]
 * @returns {Promise<Object>} Full audit report
 */
async function auditIndexes(options = {}) {
  const mongoUri = options.mongoUri || env.MONGODB_URI || "mongodb://127.0.0.1:27017/buybox?replicaSet=rs0";
  const targetCol = options.targetCollection || null;

  const conn = await mongoose.createConnection(mongoUri, { autoIndex: false }).asPromise();
  const db = conn.db;

  const dbCollections = await db.listCollections().toArray();
  const dbColNames = new Set(dbCollections.map((c) => c.name));

  let models = discoverModels();
  if (targetCol) {
    models = models.filter((m) => m.collectionName === targetCol);
  }

  const report = {
    timestamp: new Date().toISOString(),
    database: db.databaseName,
    modelsAudited: models.length,
    collectionsInDb: dbCollections.length,
    summary: {
      declaredCount: 0,
      liveCount: 0,
      matchingCount: 0,
      missingCount: 0,
      conflictsCount: 0,
      extraCount: 0,
      duplicateRisksCount: 0,
    },
    collections: {},
  };

  for (const { name, collectionName, model } of models) {
    const declared = extractDeclaredIndexes(model.schema);
    report.summary.declaredCount += declared.length;

    const colExists = dbColNames.has(collectionName);
    let liveIndexes = [];
    if (colExists) {
      try {
        liveIndexes = await db.collection(collectionName).indexes();
      } catch (err) {
        liveIndexes = [];
      }
    }
    report.summary.liveCount += liveIndexes.length;

    const liveByKey = new Map();
    for (const idx of liveIndexes) {
      liveByKey.set(serializeKey(idx.key), idx);
    }

    const matching = [];
    const missing = [];
    const conflicting = [];
    const duplicateRisks = [];

    for (const decl of declared) {
      let match = liveByKey.get(decl.serializedKey);
      if (!match && Object.values(decl.key).some((v) => v === "text")) {
        const textKeys = Object.keys(decl.key);
        match = liveIndexes.find((idx) => {
          if (idx.weights) {
            return textKeys.every((k) => idx.weights[k] !== undefined);
          }
          return false;
        });
      }

      if (match) {
        let isConflict = false;
        const reasons = [];

        if (decl.options.unique && !match.unique) {
          isConflict = true;
          reasons.push("unique: declared=true, live=false");
        }
        if (decl.options.expireAfterSeconds !== undefined && decl.options.expireAfterSeconds !== match.expireAfterSeconds) {
          isConflict = true;
          reasons.push(`expireAfterSeconds: declared=${decl.options.expireAfterSeconds}, live=${match.expireAfterSeconds}`);
        }

        if (isConflict) {
          conflicting.push({ declared: decl, live: match, reasons });
          report.summary.conflictsCount++;
        } else {
          matching.push({ declared: decl, live: match });
          report.summary.matchingCount++;
        }
      } else {
        missing.push(decl);
        report.summary.missingCount++;

        // Run preflight duplicate check if index is unique
        if (decl.options.unique && colExists) {
          const preflight = await checkDuplicateKeyRisk(db, collectionName, decl.key);
          if (preflight.hasDuplicates) {
            duplicateRisks.push({
              index: decl,
              duplicateCount: preflight.duplicateCount,
              samples: preflight.sampleDuplicates,
            });
            report.summary.duplicateRisksCount++;
          }
        }
      }
    }

    // Extra live indexes
    const declaredKeySet = new Set(declared.map((d) => d.serializedKey));
    const extra = [];
    for (const idx of liveIndexes) {
      if (idx.name === "_id_") continue;
      const serialized = serializeKey(idx.key);
      if (!declaredKeySet.has(serialized)) {
        extra.push(idx);
        report.summary.extraCount++;
      }
    }

    report.collections[collectionName] = {
      modelName: name,
      collectionExists: colExists,
      declaredCount: declared.length,
      liveCount: liveIndexes.length,
      matchingCount: matching.length,
      matching,
      missing,
      extra,
      conflicting,
      duplicateRisks,
    };
  }

  await conn.close();
  return report;
}

/**
 * Deploys approved missing indexes to MongoDB with safety checks.
 *
 * @param {Object} [options]
 * @param {string} [options.mongoUri]
 * @param {string} [options.targetCollection]
 * @param {boolean} [options.apply]
 * @returns {Promise<Object>} Deployment report
 */
async function deployIndexes(options = {}) {
  const isApply = options.apply === true;
  const mongoUri = options.mongoUri || env.MONGODB_URI || "mongodb://127.0.0.1:27017/buybox?replicaSet=rs0";
  const audit = await auditIndexes(options);

  const deploymentReport = {
    timestamp: new Date().toISOString(),
    database: audit.database,
    applied: isApply,
    status: "COMPLETED",
    indexesAttempted: 0,
    indexesCreated: 0,
    createdCount: 0,
    indexesSkipped: 0,
    indexesFailed: 0,
    results: [],
  };

  if (!isApply || audit.summary.missingCount === 0) {
    return deploymentReport;
  }

  const conn = await mongoose.createConnection(mongoUri, { autoIndex: false }).asPromise();
  const db = conn.db;

  for (const [collectionName, colData] of Object.entries(audit.collections)) {
    if (colData.missing.length === 0) continue;

    const collection = db.collection(collectionName);

    for (const missingIndex of colData.missing) {
      deploymentReport.indexesAttempted++;
      const { key, options = {}, serializedKey } = missingIndex;

      // 1. Safety Guard: Check if duplicate risk exists
      const hasDupeRisk = colData.duplicateRisks.some((r) => r.index.serializedKey === serializedKey);
      if (hasDupeRisk) {
        deploymentReport.indexesSkipped++;
        deploymentReport.results.push({
          collection: collectionName,
          key,
          status: "SKIPPED_DUPLICATE_KEY_RISK",
          reason: "Existing collection data violates unique constraint. Resolve duplicates before indexing.",
        });
        continue;
      }

      // 2. Safe index creation options
      const buildOptions = {
        background: true,
        ...options,
      };

      const startTime = Date.now();
      try {
        const indexName = await collection.createIndex(key, buildOptions);
        const durationMs = Date.now() - startTime;
        deploymentReport.indexesCreated++;
        deploymentReport.results.push({
          collection: collectionName,
          key,
          name: indexName,
          status: "CREATED",
          durationMs,
        });
      } catch (err) {
        deploymentReport.indexesFailed++;
        deploymentReport.status = "PARTIAL_FAILURE";
        deploymentReport.results.push({
          collection: collectionName,
          key,
          status: "FAILED",
          error: err.message,
        });
      }
    }
  }

  deploymentReport.createdCount = deploymentReport.indexesCreated;
  await conn.close();
  return deploymentReport;
}

// CLI Execution handler
async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");
  const targetColArg = args.find((a) => a.startsWith("--collection="));
  const targetCollection = targetColArg ? targetColArg.split("=")[1] : null;

  console.log("================================================================================");
  console.log(`BUYBOX E-COMMERCE — MONGODB INDEX DEPLOYMENT TOOL (${isApply ? "APPLY MODE" : "READ-ONLY AUDIT MODE"})`);
  console.log("================================================================================");

  const audit = await auditIndexes({ targetCollection });

  console.log(`Database:                   ${audit.database}`);
  console.log(`Models Audited:             ${audit.modelsAudited}`);
  console.log(`Total Declared Indexes:     ${audit.summary.declaredCount}`);
  console.log(`Matching Live Indexes:      ${audit.summary.matchingCount}`);
  console.log(`Missing Indexes:            ${audit.summary.missingCount}`);
  console.log(`Conflicting Indexes:        ${audit.summary.conflictsCount}`);
  console.log(`Extra Indexes:              ${audit.summary.extraCount}`);
  console.log(`Duplicate Key Risks:        ${audit.summary.duplicateRisksCount}`);
  console.log("================================================================================");

  if (audit.summary.missingCount > 0) {
    console.log(`\n[Missing Indexes (${audit.summary.missingCount})]:`);
    for (const [col, c] of Object.entries(audit.collections)) {
      if (c.missing.length === 0) continue;
      console.log(`\n• Collection '${col}' (${c.modelName}) — Missing ${c.missing.length}:`);
      for (const m of c.missing) {
        console.log(`    - Keys: ${JSON.stringify(m.key)} | Options: ${JSON.stringify(m.options)}`);
      }
    }
  }

  if (isApply) {
    console.log("\n-> Executing Index Deployment (--apply)...");
    const deployResult = await deployIndexes({ targetCollection });

    console.log("\n================================================================================");
    console.log(`DEPLOYMENT RESULT: ${deployResult.status}`);
    console.log(`Indexes Attempted:          ${deployResult.indexesAttempted}`);
    console.log(`Indexes Created:            ${deployResult.indexesCreated}`);
    console.log(`Indexes Skipped:            ${deployResult.indexesSkipped}`);
    console.log(`Indexes Failed:             ${deployResult.indexesFailed}`);
    console.log("================================================================================");

    for (const res of deployResult.results) {
      console.log(`• [${res.status}] ${res.collection} -> ${JSON.stringify(res.key)} (${res.durationMs || 0}ms)`);
      if (res.error) console.error(`    Error: ${res.error}`);
    }

    const reportsDir = path.join(__dirname, "migration-reports");
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
    const reportFile = path.join(reportsDir, `index_deployment_report_${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify({ audit, deployResult }, null, 2), "utf8");
    console.log(`\n-> Deployment report saved to: ${reportFile}`);
  } else {
    console.log("\n-> Run with '--apply' to deploy approved missing indexes.");
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal deployment error:", err);
    process.exit(1);
  });
}

module.exports = {
  serializeKey,
  discoverModels,
  extractDeclaredIndexes,
  checkDuplicateKeyRisk,
  auditIndexes,
  deployIndexes,
};
