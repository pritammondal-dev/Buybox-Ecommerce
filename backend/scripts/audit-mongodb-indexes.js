/**
 * BUYBOX E-COMMERCE — READ-ONLY MONGOOSE & MONGODB INDEX AUDIT SCRIPT
 *
 * Scans all 80+ Mongoose models, extracts declared schema indexes,
 * connects to MongoDB in read-only mode, and inspects collection indexes.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const env = require("../src/config/env");

async function runIndexAudit() {
  console.log("================================================================================");
  console.log("BUYBOX E-COMMERCE — READ-ONLY MONGOOSE INDEX AUDIT & COMPARISON");
  console.log("================================================================================");

  const modelsDir = path.join(__dirname, "../src/models");
  const modelFiles = fs.readdirSync(modelsDir).filter((f) => f.endsWith(".js"));

  console.log(`[1] Found ${modelFiles.length} model definitions in ${modelsDir}`);

  // Load all models into mongoose
  const loadedModels = [];
  for (const file of modelFiles) {
    try {
      const model = require(path.join(modelsDir, file));
      if (model && model.schema) {
        loadedModels.push({ file, model, name: model.modelName, collectionName: model.collection.name });
      }
    } catch (err) {
      console.warn(`[Warning] Could not load model ${file}: ${err.message}`);
    }
  }

  console.log(`[2] Successfully registered ${loadedModels.length} Mongoose models.`);

  // Connect to MongoDB
  const mongoUri = env.MONGODB_URI || "mongodb://127.0.0.1:27017/buybox?replicaSet=rs0";
  console.log(`[3] Connecting to MongoDB (Read-Only Inspection): ${mongoUri.replace(/\/\/.*@/, "//***:***@")}`);

  const conn = await mongoose.createConnection(mongoUri, { autoIndex: false }).asPromise();
  const db = conn.db;

  const dbCollections = await db.listCollections().toArray();
  const dbColNames = new Set(dbCollections.map((c) => c.name));
  console.log(`[4] Live MongoDB database '${db.databaseName}' contains ${dbCollections.length} collections.`);

  const auditReport = {
    timestamp: new Date().toISOString(),
    database: db.databaseName,
    modelsCount: loadedModels.length,
    collectionsInDbCount: dbCollections.length,
    summary: {
      totalDeclaredIndexes: 0,
      totalLiveIndexes: 0,
      matchingCount: 0,
      missingCount: 0,
      extraCount: 0,
      conflictsCount: 0,
      duplicateRiskCount: 0,
    },
    collections: {},
  };

  // Helper to normalize index key representation
  const serializeKey = (keyObj) => {
    return Object.entries(keyObj)
      .map(([k, v]) => `${k}:${v}`)
      .join("_");
  };

  for (const { name, collectionName, model } of loadedModels) {
    const schema = model.schema;
    const declared = [];

    // 1. Schema-level indexes
    const schemaIndexes = schema.indexes(); // Array of [keys, options]
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
        // Avoid duplicate if already declared at schema level
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

    auditReport.summary.totalDeclaredIndexes += declared.length;

    // Check live database
    const colExists = dbColNames.has(collectionName);
    let liveIndexes = [];
    if (colExists) {
      try {
        liveIndexes = await db.collection(collectionName).indexes();
      } catch (err) {
        console.warn(`Could not fetch indexes for ${collectionName}: ${err.message}`);
      }
    }

    auditReport.summary.totalLiveIndexes += liveIndexes.length;

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
        // Compare options (unique, sparse, partialFilterExpression, expireAfterSeconds)
        let isConflict = false;
        const reasons = [];

        if (Boolean(decl.options.unique) !== Boolean(match.unique)) {
          isConflict = true;
          reasons.push(`unique: declared=${decl.options.unique}, live=${match.unique}`);
        }
        if (Boolean(decl.options.sparse) !== Boolean(match.sparse)) {
          isConflict = true;
          reasons.push(`sparse: declared=${decl.options.sparse}, live=${match.sparse}`);
        }
        if (decl.options.expireAfterSeconds !== undefined && decl.options.expireAfterSeconds !== match.expireAfterSeconds) {
          isConflict = true;
          reasons.push(`expireAfterSeconds: declared=${decl.options.expireAfterSeconds}, live=${match.expireAfterSeconds}`);
        }

        if (isConflict) {
          conflicting.push({ declared: decl, live: match, reasons });
          auditReport.summary.conflictsCount++;
        } else {
          matching.push({ declared: decl, live: match });
          auditReport.summary.matchingCount++;
        }
      } else {
        // Missing in live DB
        missing.push(decl);
        auditReport.summary.missingCount++;

        // Check if unique index and if duplicates exist in existing data
        if (decl.options.unique && colExists) {
          try {
            const pipeline = [
              { $group: { _id: decl.key, count: { $sum: 1 } } },
              { $match: { count: { $gt: 1 }, _id: { $ne: null } } },
              { $limit: 5 },
            ];
            const dupes = await db.collection(collectionName).aggregate(pipeline).toArray();
            if (dupes.length > 0) {
              duplicateRisks.push({
                index: decl,
                duplicateCount: dupes.length,
                examples: dupes,
              });
              auditReport.summary.duplicateRiskCount++;
            }
          } catch {}
        }
      }
    }

    // Extra indexes in DB (not declared in Mongoose schema, excluding _id_)
    const declaredKeySet = new Set(declared.map((d) => d.serializedKey));
    const extra = [];
    for (const idx of liveIndexes) {
      if (idx.name === "_id_") continue;
      const serialized = serializeKey(idx.key);
      if (!declaredKeySet.has(serialized)) {
        extra.push(idx);
        auditReport.summary.extraCount++;
      }
    }

    auditReport.collections[collectionName] = {
      modelName: name,
      collectionExistsInDb: colExists,
      declaredCount: declared.length,
      liveCount: liveIndexes.length,
      matching: matching.length,
      missing,
      extra,
      conflicting,
      duplicateRisks,
    };
  }

  await conn.close();

  // Print Summary Table
  console.log("\n================================================================================");
  console.log("AUDIT SUMMARY MATRIX");
  console.log("================================================================================");
  console.log(`Total Models Audited:       ${auditReport.modelsCount}`);
  console.log(`Total Declared Indexes:     ${auditReport.summary.totalDeclaredIndexes}`);
  console.log(`Total Live DB Indexes:      ${auditReport.summary.totalLiveIndexes}`);
  console.log(`Matching Indexes:           ${auditReport.summary.matchingCount}`);
  console.log(`Missing Indexes:            ${auditReport.summary.missingCount}`);
  console.log(`Conflicting Indexes:        ${auditReport.summary.conflictsCount}`);
  console.log(`Extra Live Indexes:         ${auditReport.summary.extraCount}`);
  console.log(`Duplicate Key Risks:        ${auditReport.summary.duplicateRiskCount}`);
  console.log("================================================================================");

  // Print missing indexes breakdown
  const missingEntries = Object.entries(auditReport.collections).filter(([_, c]) => c.missing.length > 0);
  if (missingEntries.length > 0) {
    console.log(`\n[Collections with Missing Indexes (${missingEntries.length})]:`);
    for (const [col, c] of missingEntries) {
      console.log(`\n• ${col} (${c.modelName}) — Missing ${c.missing.length} index(es):`);
      for (const m of c.missing) {
        const optStr = Object.keys(m.options).length > 0 ? ` [${JSON.stringify(m.options)}]` : "";
        console.log(`    - Keys: ${JSON.stringify(m.key)}${optStr}`);
      }
      if (c.duplicateRisks.length > 0) {
        console.error(`    ⚠️  DUPLICATE DATA DETECTED for unique index on ${col}! Creation will fail without cleanup.`);
      }
    }
  }

  // Save audit report JSON
  const reportPath = path.join(__dirname, "mongodb_index_audit_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(auditReport, null, 2), "utf8");
  console.log(`\n-> Full machine-readable report saved to: ${reportPath}`);
}

runIndexAudit().catch((err) => {
  console.error("Index audit failed:", err);
  process.exit(1);
});
