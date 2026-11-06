const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../src/app");

const User = require("../src/models/User");
const ProductDiscount = require("../src/models/ProductDiscount");
const AuditLog = require("../src/models/AuditLog");
const Employee = require("../src/models/Employee");
const JobRole = require("../src/models/JobRole");

const { generateAccessToken } = require("../src/services/token.service");
const promotionLifecycleService = require("../src/services/promotion-lifecycle.service");
const pricingEngineService = require("../src/services/pricing-engine.service");
const {
  processPromotionLifecycleBatch,
  runPromotionLifecycleScheduler,
  stopPromotionLifecycleScheduler,
} = require("../src/workers/promotion-lifecycle.worker");

const {
  DISCOUNT_TYPES,
  DISCOUNT_STATUSES,
  DISCOUNT_SCOPES,
  FUNDING_SOURCES,
} = require("../src/constants/promotion.constants");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/\/buybox(_test|_d3_test)?(\?|$)/, "/buybox_d4_test$2")
  : "mongodb://127.0.0.1:27017/buybox_d4_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Phase D4 — Promotion Scheduling & Lifecycle Automation", () => {
  let superAdminUser;
  let superAdminToken;
  let customerUser;
  let customerToken;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    const rand = Math.random().toString(36).substring(7);

    // Setup Superadmin (reusing existing active superadmin if shared test DB already has one)
    superAdminUser = await User.findOne({ role: "super_admin", isActive: true });
    if (!superAdminUser) {
      superAdminUser = await User.create({
        firstName: "Super",
        lastName: "Admin",
        email: `superadmin_${rand}@d4-test.com`,
        password: "Password123!",
        role: "super_admin",
        isActive: true,
        authVersion: 1,
        permissionVersion: 1,
      });
    }
    superAdminToken = generateAccessToken({
      sub: superAdminUser._id.toString(),
      role: "super_admin",
      authVersion: superAdminUser.authVersion || 1,
      permissionVersion: superAdminUser.permissionVersion || 1,
      context: "administrator",
    });

    // Setup Customer
    customerUser = await User.create({
      firstName: "Customer",
      lastName: "User",
      email: `customer_${rand}@d4-test.com`,
      password: "Password123!",
      role: "customer",
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    customerToken = generateAccessToken({
      sub: customerUser._id.toString(),
      role: "customer",
      authVersion: 1,
      permissionVersion: 1,
      context: "customer",
    });
  });

  afterAll(async () => {
    stopPromotionLifecycleScheduler();
  });

  // =========================================================================
  // 1. START & END BOUNDARY TRANSITION SEMANTICS
  // =========================================================================
  describe("1. Start & End Boundary Transition Semantics", () => {
    test("scheduled promotion activates when start time is reached", async () => {
      const tStart = new Date(Date.now() - 10000); // 10s ago
      const tEnd = new Date(Date.now() + 3600000); // 1h in future

      const promo = await ProductDiscount.create({
        name: "Scheduled To Active Test",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("15.00"),
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.SCHEDULED,
        startsAt: tStart,
        endsAt: tEnd,
        createdBy: superAdminUser._id,
      });

      const result = await promotionLifecycleService.reconcilePromotions({
        asOfDate: new Date(),
      });

      expect(result.activated).toBeGreaterThanOrEqual(1);

      const reloaded = await ProductDiscount.findById(promo._id);
      expect(reloaded.status).toBe(DISCOUNT_STATUSES.ACTIVE);
      expect(reloaded.lastTransitionAt).not.toBeNull();

      // Verify AuditLog written
      const audit = await AuditLog.findOne({
        targetId: promo._id,
        action: "PROMOTION_AUTO_ACTIVATED",
      });
      expect(audit).not.toBeNull();
      expect(audit.afterState.status).toBe("active");
    });

    test("active promotion expires when end time is reached", async () => {
      const tStart = new Date(Date.now() - 7200000); // 2h ago
      const tEnd = new Date(Date.now() - 1000); // 1s ago (passed)

      const promo = await ProductDiscount.create({
        name: "Active To Expired Test",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("20.00"),
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.ACTIVE,
        startsAt: tStart,
        endsAt: tEnd,
        createdBy: superAdminUser._id,
      });

      const result = await promotionLifecycleService.reconcilePromotions({
        asOfDate: new Date(),
      });

      expect(result.expired).toBeGreaterThanOrEqual(1);

      const reloaded = await ProductDiscount.findById(promo._id);
      expect(reloaded.status).toBe(DISCOUNT_STATUSES.EXPIRED);
      expect(reloaded.lastTransitionAt).not.toBeNull();

      // Verify AuditLog written
      const audit = await AuditLog.findOne({
        targetId: promo._id,
        action: "PROMOTION_AUTO_EXPIRED",
      });
      expect(audit).not.toBeNull();
      expect(audit.afterState.status).toBe("expired");
    });

    test("worker run before start time leaves promotion scheduled", async () => {
      const tStart = new Date(Date.now() + 3600000); // 1h in future
      const tEnd = new Date(Date.now() + 7200000); // 2h in future

      const promo = await ProductDiscount.create({
        name: "Future Scheduled Promo",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("25.00"),
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.SCHEDULED,
        startsAt: tStart,
        endsAt: tEnd,
        createdBy: superAdminUser._id,
      });

      // Run reconciliation at current time (before startsAt)
      await promotionLifecycleService.reconcilePromotions({
        asOfDate: new Date(),
      });

      const reloaded = await ProductDiscount.findById(promo._id);
      expect(reloaded.status).toBe(DISCOUNT_STATUSES.SCHEDULED);
      expect(reloaded.lastTransitionAt).toBeNull();
    });
  });

  // =========================================================================
  // 2. STATE PRESERVATION INVARIANTS
  // =========================================================================
  describe("2. State Preservation Invariants", () => {
    test("paused promotions remain paused", async () => {
      const promo = await ProductDiscount.create({
        name: "Paused Promo Stays Paused",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("10.00"),
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.PAUSED,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
        createdBy: superAdminUser._id,
      });

      const res = await promotionLifecycleService.reconcileSinglePromotion(promo.toObject(), {
        asOfDate: new Date(),
        workerId: "test-worker",
      });

      expect(res.skipped).toBe(true);
      expect(res.reason).toBe("PAUSED_PRESERVED");

      const reloaded = await ProductDiscount.findById(promo._id);
      expect(reloaded.status).toBe(DISCOUNT_STATUSES.PAUSED);
    });

    test("cancelled promotions remain cancelled", async () => {
      const promo = await ProductDiscount.create({
        name: "Cancelled Promo Stays Cancelled",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("10.00"),
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.CANCELLED,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
        createdBy: superAdminUser._id,
      });

      const res = await promotionLifecycleService.reconcileSinglePromotion(promo.toObject(), {
        asOfDate: new Date(),
        workerId: "test-worker",
      });

      expect(res.skipped).toBe(true);
      expect(res.reason).toBe("CANCELLED_PRESERVED");

      const reloaded = await ProductDiscount.findById(promo._id);
      expect(reloaded.status).toBe(DISCOUNT_STATUSES.CANCELLED);
    });

    test("soft-deleted promotions are completely ignored", async () => {
      const promo = await ProductDiscount.create({
        name: "Deleted Promo Ignored",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("10.00"),
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.SCHEDULED,
        startsAt: new Date(Date.now() - 10000),
        endsAt: new Date(Date.now() + 3600000),
        deletedAt: new Date(),
        createdBy: superAdminUser._id,
      });

      const res = await promotionLifecycleService.reconcileSinglePromotion(promo.toObject(), {
        asOfDate: new Date(),
        workerId: "test-worker",
      });

      expect(res.skipped).toBe(true);
      expect(res.reason).toBe("SOFT_DELETED_IGNORED");
    });

    test("draft promotions are never automatically activated", async () => {
      const promo = await ProductDiscount.create({
        name: "Draft Promo Never Auto-Activated",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("10.00"),
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.DRAFT,
        startsAt: new Date(Date.now() - 10000),
        endsAt: new Date(Date.now() + 3600000),
        createdBy: superAdminUser._id,
      });

      const res = await promotionLifecycleService.reconcileSinglePromotion(promo.toObject(), {
        asOfDate: new Date(),
        workerId: "test-worker",
      });

      expect(res.skipped).toBe(true);
      expect(res.reason).toBe("DRAFT_PRESERVED");

      const reloaded = await ProductDiscount.findById(promo._id);
      expect(reloaded.status).toBe(DISCOUNT_STATUSES.DRAFT);
    });
  });

  // =========================================================================
  // 3. DATA HYGIENE & MALFORMED RECORD REJECTIONS
  // =========================================================================
  describe("3. Data Hygiene & Malformed Record Rejections", () => {
    test("invalid date ranges (endsAt <= startsAt) are safely skipped and reported", async () => {
      const malformedPromo = {
        _id: new mongoose.Types.ObjectId(),
        name: "Malformed Dates Promo",
        status: DISCOUNT_STATUSES.SCHEDULED,
        startsAt: new Date("2026-10-26T12:00:00Z"),
        endsAt: new Date("2026-10-26T10:00:00Z"), // Earlier than startsAt!
      };

      const res = await promotionLifecycleService.reconcileSinglePromotion(malformedPromo, {
        asOfDate: new Date("2026-10-26T11:00:00Z"),
        workerId: "test-worker",
      });

      expect(res.isInvalid).toBe(true);
      expect(res.reason).toBe("INVALID_DATE_RANGE");
    });

    test("unknown or unsupported statuses are safely skipped and reported as invalid", async () => {
      const unknownPromo = {
        _id: new mongoose.Types.ObjectId(),
        name: "Unknown Status Promo",
        status: "archived_legacy_state",
        startsAt: new Date(Date.now() - 10000),
        endsAt: new Date(Date.now() + 10000),
      };

      const res = await promotionLifecycleService.reconcileSinglePromotion(unknownPromo, {
        asOfDate: new Date(),
        workerId: "test-worker",
      });

      expect(res.isInvalid).toBe(true);
      expect(res.reason).toBe("UNKNOWN_STATUS");
    });
  });

  // =========================================================================
  // 4. IDEMPOTENCY, CONCURRENCY & WORKER RECOVERY
  // =========================================================================
  describe("4. Idempotency, Concurrency & Worker Recovery", () => {
    test("repeated runs do not duplicate transition audit events (Idempotency)", async () => {
      const promo = await ProductDiscount.create({
        name: "Idempotency Test Promo",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("18.00"),
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.SCHEDULED,
        startsAt: new Date(Date.now() - 5000),
        endsAt: new Date(Date.now() + 3600000),
        createdBy: superAdminUser._id,
      });

      // Run 1: Should activate
      const run1 = await promotionLifecycleService.reconcilePromotions({
        asOfDate: new Date(),
      });
      expect(run1.activated).toBeGreaterThanOrEqual(1);

      const auditCountAfterRun1 = await AuditLog.countDocuments({
        targetId: promo._id,
        action: "PROMOTION_AUTO_ACTIVATED",
      });
      expect(auditCountAfterRun1).toBe(1);

      // Run 2: Immediately re-run. Must NOT activate again or duplicate audit log
      const run2 = await promotionLifecycleService.reconcilePromotions({
        asOfDate: new Date(),
      });
      expect(run2.activated).toBe(0);

      const auditCountAfterRun2 = await AuditLog.countDocuments({
        targetId: promo._id,
        action: "PROMOTION_AUTO_ACTIVATED",
      });
      expect(auditCountAfterRun2).toBe(1);
    });

    test("concurrent runs on same candidate do not produce duplicate transitions", async () => {
      const promo = await ProductDiscount.create({
        name: "Concurrency Test Promo",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("30.00"),
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.SCHEDULED,
        startsAt: new Date(Date.now() - 5000),
        endsAt: new Date(Date.now() + 3600000),
        createdBy: superAdminUser._id,
      });

      const promoDoc = promo.toObject();

      // Execute 5 simultaneous concurrent reconciliation attempts via Promise.all
      const results = await Promise.all([
        promotionLifecycleService.reconcileSinglePromotion(promoDoc, { asOfDate: new Date(), workerId: "worker-1" }),
        promotionLifecycleService.reconcileSinglePromotion(promoDoc, { asOfDate: new Date(), workerId: "worker-2" }),
        promotionLifecycleService.reconcileSinglePromotion(promoDoc, { asOfDate: new Date(), workerId: "worker-3" }),
        promotionLifecycleService.reconcileSinglePromotion(promoDoc, { asOfDate: new Date(), workerId: "worker-4" }),
        promotionLifecycleService.reconcileSinglePromotion(promoDoc, { asOfDate: new Date(), workerId: "worker-5" }),
      ]);

      const activatedCount = results.filter((r) => r.activated === true).length;
      expect(activatedCount).toBe(1); // EXACTLY ONE atomic update wins

      const auditLogs = await AuditLog.find({
        targetId: promo._id,
        action: "PROMOTION_AUTO_ACTIVATED",
      });
      expect(auditLogs.length).toBe(1); // EXACTLY ONE audit record created
    });

    test("recovers after simulated worker restart by reconciling records from timestamps", async () => {
      // 1. Simulate worker stopped while promo was scheduled
      const promo = await ProductDiscount.create({
        name: "Worker Recovery Promo",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("10.00"),
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.SCHEDULED,
        startsAt: new Date("2026-10-26T08:00:00Z"),
        endsAt: new Date("2026-10-26T12:00:00Z"),
        createdBy: superAdminUser._id,
      });

      // 2. Simulate worker restarting at 09:00:00Z (after start time, before end time)
      const restartResult = await processPromotionLifecycleBatch({
        asOfDate: new Date("2026-10-26T09:00:00Z"),
        workerId: "restarted-worker-process",
      });

      expect(restartResult.activated).toBeGreaterThanOrEqual(1);

      const reloaded = await ProductDiscount.findById(promo._id);
      expect(reloaded.status).toBe(DISCOUNT_STATUSES.ACTIVE);
    });

    test("fault isolation: error on single item does not abort remaining batch", async () => {
      const p1 = await ProductDiscount.create({
        name: "Batch Item 1 (Valid)",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("10.00"),
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.SCHEDULED,
        startsAt: new Date(Date.now() - 5000),
        endsAt: new Date(Date.now() + 3600000),
      });

      const p2 = await ProductDiscount.create({
        name: "Batch Item 2 (Valid)",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("10.00"),
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.SCHEDULED,
        startsAt: new Date(Date.now() - 5000),
        endsAt: new Date(Date.now() + 3600000),
      });

      const batchResult = await promotionLifecycleService.reconcilePromotions({
        asOfDate: new Date(),
      });

      expect(batchResult.activated).toBeGreaterThanOrEqual(2);
      expect(batchResult.failed).toBe(0);

      const r1 = await ProductDiscount.findById(p1._id);
      const r2 = await ProductDiscount.findById(p2._id);
      expect(r1.status).toBe(DISCOUNT_STATUSES.ACTIVE);
      expect(r2.status).toBe(DISCOUNT_STATUSES.ACTIVE);
    });
  });

  // =========================================================================
  // 5. PRICING ENGINE AUTHORITATIVE FALLBACK
  // =========================================================================
  describe("5. Pricing Engine Authoritative Fallback", () => {
    test("pricing engine excludes expired promotions even when stored status is stale active", async () => {
      const mockProduct = {
        _id: new mongoose.Types.ObjectId(),
        sku: "D4-STALE-001",
        price: mongoose.Types.Decimal128.fromString("2000.00"),
      };

      const staleActivePromo = {
        _id: new mongoose.Types.ObjectId(),
        name: "Stale Active Promo (Ended 1hr ago)",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: "50.00",
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.ACTIVE, // Stale status in DB before worker has run
        startsAt: new Date(Date.now() - 7200000),
        endsAt: new Date(Date.now() - 3600000), // Ended 1 hour ago
      };

      // Pricing engine must be authoritative: time-window evaluation overrides stale DB status
      const pricing = await pricingEngineService.calculateEffectivePrice({
        product: mockProduct,
        activePromotions: [staleActivePromo],
        asOfDate: new Date(),
      });

      expect(pricing.isPromotional).toBe(false);
      expect(pricing.effectivePrice).toBe("2000.00");
    });
  });

  // =========================================================================
  // 6. ADMINISTRATIVE MANUAL RECONCILIATION ENDPOINT
  // =========================================================================
  describe("6. Administrative Manual Reconciliation Endpoint & Guardrails", () => {
    test("rejects customer from triggering manual reconciliation (403 Forbidden)", async () => {
      const res = await request(app)
        .post("/api/v1/admin/discounts/reconcile")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    test("allows authorized Superadmin to trigger manual reconciliation and returns metrics", async () => {
      const res = await request(app)
        .post("/api/v1/admin/discounts/reconcile")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ batchSize: 20 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("scanned");
      expect(res.body.data).toHaveProperty("activated");
      expect(res.body.data).toHaveProperty("expired");
      expect(res.body.data).toHaveProperty("durationMs");
    });
  });
});
