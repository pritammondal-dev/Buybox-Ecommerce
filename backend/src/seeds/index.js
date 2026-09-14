const { seedRbac } = require("./rbac.seed");
const { migrateEmployees } = require("./employee-migration");

/**
 * Master seed runner.
 * 1. Seeds dynamic RBAC permissions and system roles.
 * 2. Migrates existing privileged users to Employee profiles.
 */
const runAllSeeds = async () => {
  const rbacResult = await seedRbac();
  const migrationResult = await migrateEmployees();

  return {
    rbac: rbacResult,
    migration: migrationResult,
  };
};

module.exports = {
  runAllSeeds,
  seedRbac,
  migrateEmployees,
};
