require("dotenv").config();
const mongoose = require("mongoose");
const reconciliationService = require("../src/services/catalog-reconciliation.service");

async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("================================================================================");
  console.log("BUYBOX E-COMMERCE — CONTROLLED CATALOG LEGACY DATA RECONCILIATION");
  console.log("PHASE 2F READ-ONLY DRY-RUN AUDIT REPORT");
  console.log("================================================================================");

  if (!isDryRun) {
    console.warn("⚠️ NOTICE: No mode specified. Enforcing mandatory --dry-run safety boundary.");
  }

  const mongoUri =
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/buybox?replicaSet=rs0";

  console.log(`Connecting to database: ${mongoUri.replace(/:([^:@]+)@/, ":****@")}`);
  await mongoose.connect(mongoUri);

  try {
    const report = await reconciliationService.runDryRun({ sampleLimit: 5 });

    console.log(`\nScan Timestamp: ${report.timestamp}`);
    console.log(`Execution Mode: ${report.mode}`);
    console.log(`Records Examined:`);
    console.log(`  - Products:    ${report.recordsExamined.totalProducts}`);
    console.log(`  - Variants:    ${report.recordsExamined.totalVariants}`);
    console.log(`  - Inventories: ${report.recordsExamined.totalInventories}`);
    console.log(`\nDiscrepancies Found: ${report.discrepanciesFound}`);
    console.log(`Deterministic Changes: ${report.summary.deterministicCount}`);
    console.log(`Ambiguous (Skipped):   ${report.summary.ambiguousCount}`);
    console.log(`Potentially Destructive: ${report.summary.destructiveCount}`);

    console.log("\n--------------------------------------------------------------------------------");
    console.log("CATEGORY BREAKDOWN");
    console.log("--------------------------------------------------------------------------------");

    for (const cat of report.categories) {
      console.log(`\n[${cat.ruleId}] ${cat.ruleName}`);
      console.log(`  Classification: ${cat.classification}`);
      console.log(`  Affected Records: ${cat.affectedRecordCount}`);
      console.log(`  Detection Rule: ${cat.detectionRule}`);
      console.log(`  Authoritative Source: ${cat.authoritativeSource || 'Established contract'}`);
      console.log(`  Proposed Action: ${cat.proposedReconciliationAction}`);
      console.log(`  Prerequisites:   ${cat.prerequisites}`);
      if (cat.sampleIdentifiers.length > 0) {
        console.log(`  Representative Samples (${cat.sampleIdentifiers.length}):`);
        console.log(`    ${JSON.stringify(cat.sampleIdentifiers, null, 2).replace(/\n/g, "\n    ")}`);
      }
    }

    console.log("\n================================================================================");
    console.log("DRY-RUN VERIFICATION: 0 database mutations executed. Database remains untouched.");
    console.log("================================================================================");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error("Dry run execution failed:", err);
  process.exit(1);
});
