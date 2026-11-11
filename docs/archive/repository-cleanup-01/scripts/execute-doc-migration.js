const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getMdFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (['node_modules', '.next', '.git', '.mongodb_data', 'repository-cleanup-01'].includes(file)) continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getMdFiles(fullPath));
    } else if (file.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

const rawFiles = getMdFiles('.');

function categorize(rawPath) {
  const norm = rawPath.split(path.sep).join('/').replace(/^\.\//, '');
  const lower = norm.toLowerCase();
  
  if (norm === 'README.md') return { dest: 'README.md', action: 'keep' };
  if (norm === 'backend/README.md') return { dest: 'backend/README.md', action: 'keep' };
  if (norm === 'frontend/README.md') return { dest: 'frontend/README.md', action: 'keep' };
  if (norm === 'frontend/AGENTS.md') return { dest: 'frontend/AGENTS.md', action: 'keep' };
  if (norm === 'frontend/CLAUDE.md') return { dest: 'frontend/CLAUDE.md', action: 'keep' };
  if (norm === '.agents/rules/ui-ux-design-system.md') return { dest: '.agents/rules/ui-ux-design-system.md', action: 'keep' };
  if (norm === 'frontend/docs/frontend-api-architecture.md') return { dest: 'docs/architecture/frontend-api-architecture.md', action: 'move' };
  if (norm === 'frontend/docs/ui-ux-design-system.md') return { dest: 'docs/architecture/ui-ux-design-system.md', action: 'move' };
  if (norm === 'BUYBOX_VENDOR_DASHBOARD_GLOBAL_DESIGN_STANDARD.md') return { dest: 'docs/architecture/buybox-vendor-dashboard-global-design-standard.md', action: 'move' };
  if (norm === 'frontend/docs/backend-api-contract.md') return { dest: 'docs/api/backend-api-contract.md', action: 'move' };
  if (norm === 'docs/PRODUCTION_OPERATIONS_AND_ROLLBACK_MANUAL.md') return { dest: 'docs/operations/production-operations-and-rollback-manual.md', action: 'move' };
  if (norm === 'docs/security/authorization-route-matrix.md') return { dest: 'docs/security/authorization-route-matrix.md', action: 'keep' };
  if (norm === 'frontend/docs/auth-flow.md') return { dest: 'docs/security/auth-flow.md', action: 'move' };
  if (norm === 'docs/PHASE_2A_MIGRATION_SPECIFICATION.md') return { dest: 'docs/database/phase-2a-migration-specification.md', action: 'move' };
  if (norm === 'docs/PHASE_2B_INVENTORY_MIGRATION_SPECIFICATION.md') return { dest: 'docs/database/phase-2b-inventory-migration-specification.md', action: 'move' };
  if (norm === 'docs/analytics.md') return { dest: 'docs/archive/phase-reports/analytics/analytics.md', action: 'move' };
  if (norm === 'implementation_plan.md') return { dest: 'docs/archive/legacy-documentation/implementation_plan.md', action: 'move' };

  const filename = path.basename(norm);
  if (lower.includes('refund')) {
    return { dest: 'docs/archive/phase-reports/refunds/' + filename, action: 'move' };
  }
  if (lower.includes('returns') || lower.includes('return') || lower.includes('postpurchase') || lower.includes('reverse_logistics') || lower.includes('merchant_ops')) {
    return { dest: 'docs/archive/phase-reports/orders/' + filename, action: 'move' };
  }
  if (lower.includes('order') || lower.includes('fulfillment')) {
    return { dest: 'docs/archive/phase-reports/orders/' + filename, action: 'move' };
  }
  if (lower.includes('warehouse') || lower.includes('inventory') || lower.includes('stock')) {
    if (lower.includes('analytics')) {
      return { dest: 'docs/archive/phase-reports/analytics/' + filename, action: 'move' };
    }
    return { dest: 'docs/archive/phase-reports/inventory/' + filename, action: 'move' };
  }
  if (lower.includes('analytics')) {
    return { dest: 'docs/archive/phase-reports/analytics/' + filename, action: 'move' };
  }
  if (lower.includes('finance') || lower.includes('bank') || lower.includes('wallet') || lower.includes('settlement') || lower.includes('commission') || lower.includes('payout') || lower.includes('gl_variance') || lower.includes('ledger') || lower.startsWith('phase_vw-') || lower.startsWith('phase_vb-')) {
    return { dest: 'docs/archive/phase-reports/finance/' + filename, action: 'move' };
  }
  if (lower.includes('rbac') || lower.includes('permission') || lower.includes('role') || lower.startsWith('phase_sa-') || lower.startsWith('phase_e7') || lower.startsWith('phase_e8')) {
    return { dest: 'docs/archive/phase-reports/authorization/' + filename, action: 'move' };
  }
  if (lower.includes('customer_account_delete') || lower.includes('auth_production_readiness')) {
    return { dest: 'docs/archive/phase-reports/authentication/' + filename, action: 'move' };
  }
  if (lower.includes('product') || lower.includes('variable_product') || lower.startsWith('phase_4a') || lower.startsWith('phase_4b')) {
    return { dest: 'docs/archive/phase-reports/catalog/' + filename, action: 'move' };
  }
  if (lower.includes('campaign') || lower.includes('banner') || lower.includes('cms') || lower.includes('category_dynamic') || lower.includes('marketplace_lifecycle') || lower.includes('storefront') || lower.startsWith('phase_sm') || lower.startsWith('phase_e4') || lower.startsWith('phase_e5') || lower.startsWith('phase_e6')) {
    return { dest: 'docs/archive/phase-reports/storefront/' + filename, action: 'move' };
  }
  if (lower.startsWith('phase_vd-') || lower.includes('vendor') || lower.includes('vendor_console') || lower.includes('vendor_registration') || lower.includes('vendor_portal') || lower.includes('vendor_dashboard')) {
    return { dest: 'docs/archive/phase-reports/vendor/' + filename, action: 'move' };
  }
  if (lower.startsWith('phase_e10') || lower.startsWith('phase_e11') || lower.startsWith('phase_e12') || lower.includes('launch_readiness') || lower.includes('email_courier') || lower.includes('production_deployment') || lower.includes('admin_superadmin_production_readiness')) {
    return { dest: 'docs/archive/phase-reports/infrastructure/' + filename, action: 'move' };
  }
  if (lower.includes('admin_dashboard_dynamic')) {
    return { dest: 'docs/archive/phase-reports/analytics/' + filename, action: 'move' };
  }
  return { dest: 'docs/archive/legacy-documentation/' + filename, action: 'move' };
}

console.log('Total files found:', rawFiles.length);

let moved = 0;
let kept = 0;

for (const rf of rawFiles) {
  const norm = rf.split(path.sep).join('/').replace(/^\.\//, '');
  const c = categorize(rf);
  if (c.action === 'keep' || norm === c.dest) {
    kept++;
    continue;
  }
  
  const destDir = path.dirname(c.dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Check if tracked by git
  let isTracked = false;
  try {
    execSync(`git ls-files --error-unmatch "${norm}"`, { stdio: 'ignore' });
    isTracked = true;
  } catch (e) {
    isTracked = false;
  }

  if (isTracked) {
    try {
      execSync(`git mv "${norm}" "${c.dest}"`);
      moved++;
    } catch (e) {
      console.error(`git mv failed for ${norm} -> ${c.dest}:`, e.message);
    }
  } else {
    try {
      fs.renameSync(norm, c.dest);
      moved++;
    } catch (e) {
      console.error(`fs.renameSync failed for ${norm} -> ${c.dest}:`, e.message);
    }
  }
}

console.log(`Migration finished. Moved: ${moved}, Kept: ${kept}`);
