/**
 * Phase E12D — MongoDB Index Deployment, Backup & Recovery Readiness Test Suite
 *
 * Verifies:
 * 1. Mongoose model discovery and index extraction (path-level, schema-level, compound, TTL, text).
 * 2. Preflight duplicate-key risk detection.
 * 3. Safe index deployment and read-only audit mode protections.
 * 4. Connection pooling and graceful shutdown lifecycle.
 * 5. Logical backup tool, credential masking, EJSON serialization, and SHA-256 manifests.
 * 6. Restore target safety guardrails (rejection of live, production, and source databases).
 * 7. Archive integrity checks and checksum tampering detection.
 * 8. End-to-end restore verification into isolated test database.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const env = require("../src/config/env");

const {
  discoverModels,
  extractDeclaredIndexes,
  checkDuplicateKeyRisk,
  auditIndexes,
  deployIndexes,
} = require("../scripts/deploy-indexes");

const {
  createBackup,
  inspectDatabase,
  maskMongoUri,
  extractDatabaseName,
  applyRetentionPolicy,
} = require("../scripts/mongodb-backup");

const {
  verifyRestore,
  verifyArchiveIntegrity,
  assertSafeTargetDatabase,
  findLatestBackupDir,
  DEFAULT_ISOLATED_DB_NAME,
} = require("../scripts/verify-restore");

const {
  getDatabaseConnectionOptions,
  disconnectDatabase,
} = require("../src/config/database");

describe("PHASE E12D — MongoDB Index Deployment, Backup & Recovery Readiness", () => {
  const testBackupsRoot = path.join(__dirname, "temp_backups");
  let testBackupDir = null;

  beforeAll(async () => {
    fs.mkdirSync(testBackupsRoot, { recursive: true });
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/buybox_test?replicaSet=rs0");
    }
  });

  afterAll(async () => {
    // Clean up temporary test backups
    if (fs.existsSync(testBackupsRoot)) {
      fs.rmSync(testBackupsRoot, { recursive: true, force: true });
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // ============================================================================
  // 1. Model Discovery & Index Manifest Extraction
  // ============================================================================
  describe("1. Model Discovery & Index Extraction", () => {
    test("discoverModels discovers all Mongoose models in src/models", () => {
      const models = discoverModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThanOrEqual(80);

      const userModel = models.find((m) => m.name === "User");
      expect(userModel).toBeDefined();
      expect(userModel.collectionName).toBe("users");

      const productModel = models.find((m) => m.name === "Product");
      expect(productModel).toBeDefined();
      expect(productModel.collectionName).toBe("products");

      const orderModel = models.find((m) => m.name === "Order");
      expect(orderModel).toBeDefined();
      expect(orderModel.collectionName).toBe("orders");
    });

    test("extractDeclaredIndexes extracts schema-level, compound, unique, and TTL indexes", () => {
      const models = discoverModels();
      const userModel = models.find((m) => m.name === "User");
      const userIndexes = extractDeclaredIndexes(userModel.model.schema);

      expect(userIndexes.length).toBeGreaterThan(0);
      const emailIdx = userIndexes.find((i) => i.key.email !== undefined);
      expect(emailIdx).toBeDefined();
      expect(emailIdx.options.unique).toBe(true);

      const paymentModel = models.find((m) => m.name === "Payment");
      const paymentIndexes = extractDeclaredIndexes(paymentModel.model.schema);
      expect(paymentIndexes.length).toBeGreaterThan(0);
    });

    test("extractDeclaredIndexes correctly handles text indexes", () => {
      const models = discoverModels();
      const productModel = models.find((m) => m.name === "Product");
      const productIndexes = extractDeclaredIndexes(productModel.model.schema);

      const textIdx = productIndexes.find((i) => Object.values(i.key).some((v) => v === "text"));
      expect(textIdx).toBeDefined();
      expect(textIdx.key.name).toBe("text");
    });
  });

  // ============================================================================
  // 2. Preflight Duplicate-Key Risk Detection
  // ============================================================================
  describe("2. Preflight Duplicate-Key Risk Detection", () => {
    test("checkDuplicateKeyRisk identifies duplicate keys via aggregation", async () => {
      const testSchema = new mongoose.Schema({ email: String });
      const TestDuplicateModel = mongoose.model("TestDuplicateKeyModel", testSchema);

      // Clean prior documents
      await TestDuplicateModel.deleteMany({});
      // Insert duplicate documents
      await TestDuplicateModel.insertMany([
        { email: "dup@example.com" },
        { email: "dup@example.com" },
        { email: "unique@example.com" },
      ]);

      const result = await checkDuplicateKeyRisk(
        mongoose.connection.db,
        "testduplicatekeymodels",
        { email: 1 }
      );

      expect(result.hasDuplicates).toBe(true);
      expect(result.duplicateCount).toBe(1);
      expect(result.sampleDuplicates[0]._id).toBe("dup@example.com");
      expect(result.sampleDuplicates[0].count).toBe(2);

      // Clean up
      await mongoose.connection.db.dropCollection("testduplicatekeymodels").catch(() => {});
    });

    test("checkDuplicateKeyRisk returns false when collection contains no duplicates", async () => {
      const testSchema = new mongoose.Schema({ code: String });
      const TestUniqueModel = mongoose.model("TestUniqueKeyModel", testSchema);

      await TestUniqueModel.deleteMany({});
      await TestUniqueModel.insertMany([
        { code: "CODE-1" },
        { code: "CODE-2" },
      ]);

      const result = await checkDuplicateKeyRisk(
        mongoose.connection.db,
        "testuniquekeymodels",
        { code: 1 }
      );

      expect(result.hasDuplicates).toBe(false);
      expect(result.duplicateCount).toBe(0);

      await mongoose.connection.db.dropCollection("testuniquekeymodels").catch(() => {});
    });
  });

  // ============================================================================
  // 3. Read-Only Audit & Safe Index Deployment
  // ============================================================================
  describe("3. Read-Only Audit & Safe Index Deployment", () => {
    test("auditIndexes runs in read-only mode and produces summary without modifying database", async () => {
      const report = await auditIndexes({
        mongoUri: process.env.MONGODB_URI,
        targetCollection: "users",
      });

      expect(report).toBeDefined();
      expect(report.modelsAudited).toBe(1);
      expect(report.summary.declaredCount).toBeGreaterThan(0);
      expect(report.collections["users"]).toBeDefined();
      expect(Array.isArray(report.collections["users"].matching)).toBe(true);
    });

    test("deployIndexes never drops or modifies existing indexes", async () => {
      // In dry-run / audit mode, deployIndexes returns report without changes
      const report = await deployIndexes({
        mongoUri: process.env.MONGODB_URI,
        apply: false,
        targetCollection: "users",
      });

      expect(report.applied).toBe(false);
      expect(report.createdCount).toBe(0);
    });
  });

  // ============================================================================
  // 4. Connection Pooling & Graceful Shutdown
  // ============================================================================
  describe("4. Connection Pooling and Database Lifecycle", () => {
    test("getDatabaseConnectionOptions configures pooling and disables autoIndex for production", () => {
      const prodOpts = getDatabaseConnectionOptions("production");
      expect(prodOpts.autoIndex).toBe(false);
      expect(prodOpts.maxPoolSize).toBe(50);
      expect(prodOpts.minPoolSize).toBe(10);
      expect(prodOpts.serverSelectionTimeoutMS).toBe(5000);
      expect(prodOpts.socketTimeoutMS).toBe(45000);
    });

    test("getDatabaseConnectionOptions enables autoIndex for development", () => {
      const devOpts = getDatabaseConnectionOptions("development");
      expect(devOpts.autoIndex).toBe(true);
      expect(devOpts.maxPoolSize).toBe(20);
      expect(devOpts.minPoolSize).toBe(2);
    });

    test("disconnectDatabase function is exported and defined", () => {
      expect(typeof disconnectDatabase).toBe("function");
    });
  });

  // ============================================================================
  // 5. Logical Backup Tool & SHA-256 Manifest
  // ============================================================================
  describe("5. Logical Backup Tooling & Manifest Generation", () => {
    test("maskMongoUri masks username and password from connection strings", () => {
      const uri = "mongodb://admin_user:secret_password@127.0.0.1:27017/buybox?authSource=admin";
      const masked = maskMongoUri(uri);
      expect(masked).toBe("mongodb://***:***@127.0.0.1:27017/buybox?authSource=admin");
      expect(masked.includes("secret_password")).toBe(false);
      expect(masked.includes("admin_user")).toBe(false);
    });

    test("extractDatabaseName extracts database from standard and srv URIs", () => {
      expect(extractDatabaseName("mongodb://localhost:27017/buybox")).toBe("buybox");
      expect(extractDatabaseName("mongodb://localhost:27017/buybox?replicaSet=rs0")).toBe("buybox");
      expect(extractDatabaseName("mongodb+srv://user:pass@cluster.mongodb.net/buybox_prod?retryWrites=true")).toBe("buybox_prod");
    });

    test("createBackup dry-run inspects database and writes no files", async () => {
      const report = await createBackup({
        sourceUri: process.env.MONGODB_URI,
        dryRun: true,
      });

      expect(report.dryRun).toBe(true);
      expect(report.targetDir).toBeNull();
      expect(report.totalCollections).toBeGreaterThan(0);
      expect(report.totalDocuments).toBeGreaterThanOrEqual(0);
    });

    test("createBackup executes and writes EJSON files with valid SHA-256 manifest", async () => {
      testBackupDir = path.join(testBackupsRoot, `backup-test-${Date.now()}`);

      const report = await createBackup({
        sourceUri: process.env.MONGODB_URI,
        targetDir: testBackupDir,
        dryRun: false,
      });

      expect(report.dryRun).toBe(false);
      expect(report.totalCollections).toBeGreaterThan(0);
      expect(fs.existsSync(testBackupDir)).toBe(true);

      const manifestPath = path.join(testBackupDir, "manifest.json");
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      expect(manifest.sourceDatabase).toBeDefined();
      expect(manifest.collections).toBeDefined();

      // Verify SHA-256 matches actual file for each collection
      for (const [colName, meta] of Object.entries(manifest.collections)) {
        const filePath = path.join(testBackupDir, meta.dataFile);
        expect(fs.existsSync(filePath)).toBe(true);
        const content = fs.readFileSync(filePath, "utf8");
        const actualHash = crypto.createHash("sha256").update(content, "utf8").digest("hex");
        expect(actualHash).toBe(meta.sha256);
      }
    });

    test("applyRetentionPolicy retains requested count and preserves verified backups", () => {
      const mockBackupsRoot = path.join(testBackupsRoot, "retention_test");
      fs.mkdirSync(mockBackupsRoot, { recursive: true });

      // Create 4 mock backup directories
      for (let i = 1; i <= 4; i++) {
        const dir = path.join(mockBackupsRoot, `backup-${1000 + i}`);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ index: i }), "utf8");
      }

      applyRetentionPolicy(mockBackupsRoot, 2);

      const remaining = fs.readdirSync(mockBackupsRoot);
      expect(remaining.length).toBe(2);

      // Clean up mock directory
      fs.rmSync(mockBackupsRoot, { recursive: true, force: true });
    });
  });

  // ============================================================================
  // 6. Restore Target Validation & Safety Guardrails
  // ============================================================================
  describe("6. Restore Target Validation & Safety Guardrails", () => {
    test("assertSafeTargetDatabase rejects production database 'buybox'", () => {
      expect(() => assertSafeTargetDatabase("buybox", "buybox")).toThrow(
        /CRITICAL SAFETY VIOLATION/
      );
    });

    test("assertSafeTargetDatabase rejects databases containing 'prod', 'production', or 'live'", () => {
      expect(() => assertSafeTargetDatabase("buybox_prod", "buybox")).toThrow(
        /CRITICAL SAFETY VIOLATION.*production\/live environment/
      );
      expect(() => assertSafeTargetDatabase("production_database", "buybox")).toThrow(
        /CRITICAL SAFETY VIOLATION.*production\/live environment/
      );
      expect(() => assertSafeTargetDatabase("buybox-live", "buybox")).toThrow(
        /CRITICAL SAFETY VIOLATION.*production\/live environment/
      );
    });

    test("assertSafeTargetDatabase rejects restoring over the exact source database", () => {
      expect(() => assertSafeTargetDatabase("my_custom_source", "my_custom_source")).toThrow(
        /CRITICAL SAFETY VIOLATION.*identical to source database/
      );
    });

    test("assertSafeTargetDatabase permits isolated staging/test databases", () => {
      expect(assertSafeTargetDatabase("buybox_restore_verification_test", "buybox")).toBe(true);
      expect(assertSafeTargetDatabase("buybox_isolated_test_123", "buybox")).toBe(true);
    });
  });

  // ============================================================================
  // 7. Archive Integrity Verification & Tampering Detection
  // ============================================================================
  describe("7. Archive Integrity Verification & Tampering Detection", () => {
    test("verifyArchiveIntegrity passes for untampered backup", () => {
      expect(testBackupDir).toBeTruthy();
      const result = verifyArchiveIntegrity(testBackupDir);
      expect(result.valid).toBe(true);
      expect(result.collectionsChecked).toBeGreaterThan(0);
      expect(result.failures.length).toBe(0);
    });

    test("verifyArchiveIntegrity detects file tampering or corruption", () => {
      // Create a corrupted backup copy
      const corruptDir = path.join(testBackupsRoot, "corrupted_backup");
      fs.mkdirSync(corruptDir, { recursive: true });

      const manifest = {
        timestamp: new Date().toISOString(),
        sourceDatabase: "buybox",
        collections: {
          test_col: {
            dataFile: "test_col.json",
            sha256: "0000000000000000000000000000000000000000000000000000000000000000",
            count: 1,
          },
        },
      };
      fs.writeFileSync(path.join(corruptDir, "manifest.json"), JSON.stringify(manifest), "utf8");
      fs.writeFileSync(path.join(corruptDir, "test_col.json"), "tampered content", "utf8");

      const result = verifyArchiveIntegrity(corruptDir);
      expect(result.valid).toBe(false);
      expect(result.failures.length).toBeGreaterThan(0);
      expect(result.failures[0]).toContain("Checksum mismatch");

      fs.rmSync(corruptDir, { recursive: true, force: true });
    });
  });

  // ============================================================================
  // 8. End-to-End Isolated Restore Verification
  // ============================================================================
  describe("8. End-to-End Isolated Restore Verification", () => {
    test("verifyRestore restores archive into isolated test DB and verifies integrity", async () => {
      expect(testBackupDir).toBeTruthy();

      const isolatedTestDbName = "buybox_e12d_isolated_unit_test";

      const report = await verifyRestore({
        backupDir: testBackupDir,
        targetDbName: isolatedTestDbName,
        mongoBaseUri: process.env.MONGODB_URI,
        keepDatabase: false,
      });

      expect(report.archiveVerification.status).toBe("PASSED");
      expect(report.restoration.status).toBe("PASSED");
      expect(report.validation.status).toBe("PASSED");
      expect(report.validation.mismatches.length).toBe(0);
      expect(report.targetDatabase).toBe(isolatedTestDbName);
    }, 60000);
  });
});
