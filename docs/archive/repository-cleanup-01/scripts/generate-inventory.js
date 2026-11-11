const fs = require('fs');
const path = require('path');

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

const CATEGORY_NAMES = {
  A: 'Core Architecture & System Design',
  B: 'API & Integration Contracts',
  C: 'Operations, Deployment & Runbooks',
  D: 'Security, RBAC & Governance',
  E: 'Database, Data Models & Migrations',
  F: 'Development, Onboarding & Environment',
  G: 'Product Domain: Customer & Storefront',
  H: 'Product Domain: Vendor & Store Management',
  I: 'Product Domain: Inventory, Warehouse & Logistics',
  J: 'Product Domain: Orders, Returns & Reverse Logistics',
  K: 'Product Domain: Payments, Refunds & Financial Integrity',
  L: 'Historical Phase Reports & Migration Audits (Archive)'
};

function categorize(rawPath) {
  const norm = rawPath.split(path.sep).join('/').replace(/^\.\//, '');
  const lower = norm.toLowerCase();
  
  if (norm === 'README.md') return { cat: 'F', dest: 'README.md', action: 'Rebuild root README with full architecture & setup' };
  if (norm === 'backend/README.md') return { cat: 'F', dest: 'backend/README.md', action: 'Rebuild backend README with runtime & test instructions' };
  if (norm === 'frontend/README.md') return { cat: 'F', dest: 'frontend/README.md', action: 'Update frontend README with Next.js architecture & tests' };
  if (norm === 'frontend/AGENTS.md') return { cat: 'F', dest: 'frontend/AGENTS.md', action: 'Preserve in place (Agent instructions)' };
  if (norm === 'frontend/CLAUDE.md') return { cat: 'F', dest: 'frontend/CLAUDE.md', action: 'Preserve in place (Agent instructions)' };
  if (norm === '.agents/rules/ui-ux-design-system.md') return { cat: 'F', dest: '.agents/rules/ui-ux-design-system.md', action: 'Preserve in place (Agent rule)' };
  if (norm === 'frontend/docs/frontend-api-architecture.md') return { cat: 'A', dest: 'docs/architecture/frontend-api-architecture.md', action: 'Move to architecture' };
  if (norm === 'frontend/docs/ui-ux-design-system.md') return { cat: 'A', dest: 'docs/architecture/ui-ux-design-system.md', action: 'Move to architecture' };
  if (norm === 'BUYBOX_VENDOR_DASHBOARD_GLOBAL_DESIGN_STANDARD.md') return { cat: 'A', dest: 'docs/architecture/buybox-vendor-dashboard-global-design-standard.md', action: 'Move to architecture' };
  if (norm === 'frontend/docs/backend-api-contract.md') return { cat: 'B', dest: 'docs/api/backend-api-contract.md', action: 'Move to api' };
  if (norm === 'docs/PRODUCTION_OPERATIONS_AND_ROLLBACK_MANUAL.md') return { cat: 'C', dest: 'docs/operations/production-operations-and-rollback-manual.md', action: 'Move to operations' };
  if (norm === 'docs/security/authorization-route-matrix.md') return { cat: 'D', dest: 'docs/security/authorization-route-matrix.md', action: 'Preserve in place (Security matrix)' };
  if (norm === 'frontend/docs/auth-flow.md') return { cat: 'D', dest: 'docs/security/auth-flow.md', action: 'Move to security' };
  if (norm === 'docs/PHASE_2A_MIGRATION_SPECIFICATION.md') return { cat: 'E', dest: 'docs/database/phase-2a-migration-specification.md', action: 'Move to database' };
  if (norm === 'docs/PHASE_2B_INVENTORY_MIGRATION_SPECIFICATION.md') return { cat: 'E', dest: 'docs/database/phase-2b-inventory-migration-specification.md', action: 'Move to database' };
  if (norm === 'docs/analytics.md') return { cat: 'L', dest: 'docs/archive/phase-reports/analytics/analytics.md', action: 'Move to archive analytics' };
  if (norm === 'implementation_plan.md') return { cat: 'L', dest: 'docs/archive/legacy-documentation/implementation_plan.md', action: 'Move to legacy archive' };

  const filename = path.basename(norm);
  if (lower.includes('refund')) {
    return { cat: 'L', dest: 'docs/archive/phase-reports/refunds/' + filename, action: 'Move to archive refunds' };
  }
  if (lower.includes('returns') || lower.includes('return') || lower.includes('postpurchase') || lower.includes('reverse_logistics') || lower.includes('merchant_ops')) {
    return { cat: 'L', dest: 'docs/archive/phase-reports/orders/' + filename, action: 'Move to archive orders' };
  }
  if (lower.includes('order') || lower.includes('fulfillment')) {
    return { cat: 'L', dest: 'docs/archive/phase-reports/orders/' + filename, action: 'Move to archive orders' };
  }
  if (lower.includes('warehouse') || lower.includes('inventory') || lower.includes('stock')) {
    if (lower.includes('analytics')) {
      return { cat: 'L', dest: 'docs/archive/phase-reports/analytics/' + filename, action: 'Move to archive analytics' };
    }
    return { cat: 'L', dest: 'docs/archive/phase-reports/inventory/' + filename, action: 'Move to archive inventory' };
  }
  if (lower.includes('analytics')) {
    return { cat: 'L', dest: 'docs/archive/phase-reports/analytics/' + filename, action: 'Move to archive analytics' };
  }
  if (lower.includes('finance') || lower.includes('bank') || lower.includes('wallet') || lower.includes('settlement') || lower.includes('commission') || lower.includes('payout') || lower.includes('gl_variance') || lower.includes('ledger') || lower.startsWith('phase_vw-') || lower.startsWith('phase_vb-')) {
    return { cat: 'L', dest: 'docs/archive/phase-reports/finance/' + filename, action: 'Move to archive finance' };
  }
  if (lower.includes('rbac') || lower.includes('permission') || lower.includes('role') || lower.startsWith('phase_sa-') || lower.startsWith('phase_e7') || lower.startsWith('phase_e8')) {
    return { cat: 'L', dest: 'docs/archive/phase-reports/authorization/' + filename, action: 'Move to archive authorization' };
  }
  if (lower.includes('customer_account_delete') || lower.includes('auth_production_readiness')) {
    return { cat: 'L', dest: 'docs/archive/phase-reports/authentication/' + filename, action: 'Move to archive authentication' };
  }
  if (lower.includes('product') || lower.includes('variable_product') || lower.startsWith('phase_4a') || lower.startsWith('phase_4b')) {
    return { cat: 'L', dest: 'docs/archive/phase-reports/catalog/' + filename, action: 'Move to archive catalog' };
  }
  if (lower.includes('campaign') || lower.includes('banner') || lower.includes('cms') || lower.includes('category_dynamic') || lower.includes('marketplace_lifecycle') || lower.includes('storefront') || lower.startsWith('phase_sm') || lower.startsWith('phase_e4') || lower.startsWith('phase_e5') || lower.startsWith('phase_e6')) {
    return { cat: 'L', dest: 'docs/archive/phase-reports/storefront/' + filename, action: 'Move to archive storefront' };
  }
  if (lower.startsWith('phase_vd-') || lower.includes('vendor') || lower.includes('vendor_console') || lower.includes('vendor_registration') || lower.includes('vendor_portal') || lower.includes('vendor_dashboard')) {
    return { cat: 'L', dest: 'docs/archive/phase-reports/vendor/' + filename, action: 'Move to archive vendor' };
  }
  if (lower.startsWith('phase_e10') || lower.startsWith('phase_e11') || lower.startsWith('phase_e12') || lower.includes('launch_readiness') || lower.includes('email_courier') || lower.includes('production_deployment') || lower.includes('admin_superadmin_production_readiness')) {
    return { cat: 'L', dest: 'docs/archive/phase-reports/infrastructure/' + filename, action: 'Move to archive infrastructure' };
  }
  if (lower.includes('admin_dashboard_dynamic')) {
    return { cat: 'L', dest: 'docs/archive/phase-reports/analytics/' + filename, action: 'Move to archive analytics' };
  }
  return { cat: 'L', dest: 'docs/archive/legacy-documentation/' + filename, action: 'Move to legacy archive' };
}

const fileEntries = rawFiles.map((rf, idx) => {
  const norm = rf.split(path.sep).join('/').replace(/^\.\//, '');
  const stat = fs.statSync(rf);
  const content = fs.readFileSync(rf, 'utf8');
  const lines = content.length > 0 ? content.split('\n').length : 0;
  const classification = categorize(rf);
  return {
    id: idx + 1,
    originalPath: norm,
    category: classification.cat,
    categoryName: CATEGORY_NAMES[classification.cat],
    dest: classification.dest,
    sizeBytes: stat.size,
    lineCount: lines,
    isEmpty: stat.size === 0 ? 'Yes' : 'No',
    action: classification.action
  };
});

// Sort entries by category then path
fileEntries.sort((a, b) => {
  if (a.category !== b.category) return a.category.localeCompare(b.category);
  return a.originalPath.localeCompare(b.originalPath);
});
fileEntries.forEach((e, i) => e.id = i + 1);

// Generate Markdown Content
let md = `# Buybox E-Commerce — Markdown Documentation Inventory
## Phase: PROJECT-REPOSITORY-HYGIENE-01
### Document Reference: \`docs/archive/repository-cleanup-01/markdown-inventory.md\`
### Date Generated: November 11, 2026

---

## 1. Executive Summary

As part of **PROJECT-REPOSITORY-HYGIENE-01**, this inventory comprehensively catalogs and classifies all **${fileEntries.length} Markdown (\`.md\`) files** existing across the Buybox-Ecommerce repository prior to reorganization.

### Key Metrics
- **Total Markdown Files Identified:** ${fileEntries.length}
- **Total Combined Content Size:** ${(fileEntries.reduce((acc, f) => acc + f.sizeBytes, 0) / 1024).toFixed(2)} KB
- **Total Combined Lines:** ${fileEntries.reduce((acc, f) => acc + f.lineCount, 0).toLocaleString()}
- **Empty Files Identified:** ${fileEntries.filter(f => f.isEmpty === 'Yes').length} (\`backend/README.md\`, rebuilt in Phase 3)
- **Active Documentation Targets:**
  - Architecture: \`docs/architecture/\`
  - API Contracts: \`docs/api/\`
  - Operations & Runbooks: \`docs/operations/\`
  - Security & RBAC: \`docs/security/\`
  - Database & Migrations: \`docs/database/\`
  - Development & Onboarding: \`README.md\`, \`backend/README.md\`, \`frontend/README.md\`
- **Historical Phase Reports & Migration Audits:** Archived into \`docs/archive/phase-reports/<domain>/\`

---

## 2. Classification Taxonomy (Categories A – L)

| Code | Category Name | Description | Count |
|---|---|---|---|
| **A** | Core Architecture & System Design | System design, design standards, frontend/backend architecture | ${fileEntries.filter(f => f.category === 'A').length} |
| **B** | API & Integration Contracts | Authoritative API contracts, payload schemas, route definitions | ${fileEntries.filter(f => f.category === 'B').length} |
| **C** | Operations, Deployment & Runbooks | Production deployment guides, rollback procedures, operations manual | ${fileEntries.filter(f => f.category === 'C').length} |
| **D** | Security, RBAC & Governance | Authorization route matrices, authentication flows, RBAC registries | ${fileEntries.filter(f => f.category === 'D').length} |
| **E** | Database, Data Models & Migrations | Schema specifications, migration runbooks, collection designs | ${fileEntries.filter(f => f.category === 'E').length} |
| **F** | Development, Onboarding & Environment | Root/app READMEs, developer onboarding guides, agent instructions | ${fileEntries.filter(f => f.category === 'F').length} |
| **G** | Product Domain: Customer & Storefront | Customer-facing UX, storefront, CMS pages | 0 (mapped to archive L/storefront) |
| **H** | Product Domain: Vendor & Store Management | Vendor operations, console, onboarding | 0 (mapped to archive L/vendor) |
| **I** | Product Domain: Inventory & Logistics | Warehouse, stock counts, adjustments | 0 (mapped to archive L/inventory) |
| **J** | Product Domain: Orders & Returns | Orders, postpurchase, reverse logistics | 0 (mapped to archive L/orders) |
| **K** | Product Domain: Payments & Refunds | Payment gateways, refund accounting | 0 (mapped to archive L/refunds) |
| **L** | Historical Phase Reports & Migration Audits | Historical implementation, forensic audits, test & completion reports | ${fileEntries.filter(f => f.category === 'L').length} |

### Distribution of Historical Archive (Category L by Domain)
`;

const domainCounts = {};
fileEntries.filter(f => f.category === 'L').forEach(f => {
  const parts = f.dest.split('/');
  const sub = parts[parts.length - 2];
  domainCounts[sub] = (domainCounts[sub] || 0) + 1;
});

md += `| Archive Domain Directory | Files |
|---|---|
`;
Object.keys(domainCounts).sort().forEach(domain => {
  md += `| \`docs/archive/phase-reports/${domain}/\` | ${domainCounts[domain]} |\n`;
});

md += `\n---\n\n## 3. Comprehensive Markdown Inventory Table\n\n`;
md += `| # | Original Path | Cat | Proposed Destination | Size (Bytes) | Lines | Empty | Recommended Action |\n`;
md += `|---|---|:---:|---|---:|---:|:---:|---|\n`;

fileEntries.forEach(e => {
  md += `| ${e.id} | \`${e.originalPath}\` | **${e.category}** | \`${e.dest}\` | ${e.sizeBytes.toLocaleString()} | ${e.lineCount.toLocaleString()} | ${e.isEmpty} | ${e.action} |\n`;
});

md += `\n---\n\n## 4. Execution Plan & Target Directory Structure

The reorganization is executed strictly according to the following principles:
1. **Zero Content Loss:** Every historical phase report is preserved and categorized into its proper domain folder under \`docs/archive/phase-reports/\`.
2. **Active Documentation Promoted:** Architecture, API contract, security, operations, and database migration documents are promoted to dedicated top-level directories in \`docs/\`.
3. **Repository Entrypoints Rebuilt:** Root \`README.md\` and \`backend/README.md\` are updated/rebuilt with accurate architectural diagrams, setup guides, and navigation indexes.
4. **Agent Configurations Preserved:** \`frontend/AGENTS.md\`, \`frontend/CLAUDE.md\`, and \`.agents/rules/ui-ux-design-system.md\` remain untouched in their active operational locations.
`;

const targetDir = path.join(__dirname, '..', 'docs', 'archive', 'repository-cleanup-01');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}
const outPath = path.join(targetDir, 'markdown-inventory.md');
fs.writeFileSync(outPath, md, 'utf8');

console.log('Successfully generated markdown inventory at:', outPath);
console.log('Total entries:', fileEntries.length);
