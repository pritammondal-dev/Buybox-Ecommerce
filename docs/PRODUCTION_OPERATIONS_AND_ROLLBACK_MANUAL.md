# BUYBOX E-COMMERCE — PRODUCTION OPERATIONS, MIGRATION SAFETY & ROLLBACK MANUAL

## 1. Scope and Objective
This manual establishes the mandatory operational protocols for database migrations, production software deployments, incident recovery, and rollback procedures for the Buybox Multi-Vendor Marketplace.

---

## 2. Database Migration Safety Framework (Section 32)

Every production database schema or data migration must follow a 5-step lifecycle. Blind or unverified destructive migrations against the production MongoDB replica set are strictly prohibited.

```text
[1. Pre-Flight Validation]
          ↓
[2. Automated Full Backup Snapshot]
          ↓
[3. Atomic / Idempotent Migration Execution]
          ↓
[4. Post-Migration Verification & Invariant Audit]
          ↓
[5. Sign-Off or Immediate Rollback]
```

### 2.1 Step 1 — Pre-Flight Validation
- Confirm migration script is purely idempotent (`$set`, `$setOnInsert`, partial filters).
- Ensure no unbounded locks or unindexed multi-document updates on high-velocity collections (`orders`, `inventories`, `users`).
- Execute migration script on a dedicated staging replica set with sanitized production data.

### 2.2 Step 2 — Mandatory Pre-Migration Backup
Before any schema mutation or index modification:
- Trigger an isolated snapshot using native replica set oplog or `node scripts/test-backup-restore.js`.
- Confirm snapshot completion and verify archive checksums.

### 2.3 Step 3 — Execution
- Run migrations during scheduled operational maintenance windows.
- Set conservative connection timeouts: `maxTimeMS = 30000`.
- Maintain audit trail in `AuditLog` collection documenting: `actorId`, `action: "DATABASE_MIGRATION"`, `entityType: "SYSTEM"`.

### 2.4 Step 4 — Verification
- Run `node scripts/verify-production-db.js` immediately following migration.
- Verify:
  1. Single active Superadmin invariant holds (`role: "super_admin", isActive: true`).
  2. Inventory consistency: `available == onHand - reserved` across 100% of records.
  3. No negative stock balances.
  4. Compound and unique indexes active.

---

## 3. Production Rollback Strategy (Section 33)

If a deployment exhibits critical regressions, error spikes (> 1% 5xx rate), or invariant violations, the deployment engineer must execute the appropriate rollback protocol below.

### 3.1 Frontend Rollback (Next.js)
1. **PaaS / CDN Level (e.g. Vercel / AWS CloudFront / Docker):**
   - Re-point active domain alias/traffic to the previous immutable release hash:
     ```bash
     # Example CLI rollback command:
     vercel rollback <previous-deployment-url>
     # Or Docker container image rollback:
     docker service update --image buybox-frontend:v<previous_build> buybox_frontend
     ```
2. **Post-Rollback Validation:**
   - Verify `https://buybox.com/robots.txt` and `https://buybox.com/sitemap.xml` return HTTP 200.
   - Confirm storefront homepage loads without client-side console exceptions.

### 3.2 Backend Process Rollback (Express)
1. **Container / PM2 Rollback:**
   - Switch traffic back to previous backend artifact:
     ```bash
     # If managed via PM2:
     pm2 restart buybox-backend-previous --update-env
     # If managed via Docker / Kubernetes:
     kubectl rollout undo deployment/buybox-backend
     ```
2. **Post-Rollback Validation:**
   - Execute liveness and readiness probes:
     ```bash
     curl -f https://api.buybox.com/liveness
     curl -f https://api.buybox.com/readiness
     ```

### 3.3 Worker & Scheduler Rollback (BullMQ / Cron)
1. Stop runaway or misconfigured workers gracefully (`SIGTERM` allows in-flight jobs to finish cleanly).
2. Drain any poisoned dead-letter queue jobs to prevent retry stampedes.
3. Restart workers using verified release code.

### 3.4 Database Recovery Procedure (Point-In-Time)
If data corruption occurred:
1. Put marketplace into maintenance mode (set maintenance header on API reverse proxy).
2. Restore verified pre-migration backup into staging database.
3. Apply oplog replay up to the timestamp immediately preceding the corrupting event (`restore --oplogReplay --oplogLimit=<timestamp>`).
4. Re-run `node scripts/verify-production-db.js` to confirm 100% invariant satisfaction.
5. Switch connection string and resume production traffic.

---

## 4. Emergency Incident Contact & Escalation
- Superadmin Security Lead: `admin123@example.com`
- Database Infrastructure Admin: `infra@buybox.com`
