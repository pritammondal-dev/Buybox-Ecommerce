const mongoose = require("mongoose");
const ProductDiscount = require("../models/ProductDiscount");
const { DISCOUNT_STATUSES } = require("../constants/promotion.constants");
const { recordAuditLog } = require("./governance.service");
const env = require("../config/env");
const logger = require("../config/logger");

class PromotionLifecycleService {
  /**
   * Reconcile promotion lifecycle states according to authoritative UTC timestamps.
   *
   * Safety Invariants:
   * 1. Scheduled promotions:
   *    - If startsAt <= asOfDate < endsAt -> atomically transition to ACTIVE.
   *    - If asOfDate >= endsAt -> atomically transition to EXPIRED.
   * 2. Active promotions:
   *    - If asOfDate >= endsAt -> atomically transition to EXPIRED.
   * 3. Paused promotions: remain PAUSED.
   * 4. Cancelled promotions: remain CANCELLED.
   * 5. Draft promotions: remain DRAFT.
   * 6. Soft-deleted promotions: strictly ignored.
   * 7. Malformed records (e.g. endsAt <= startsAt): reported safely as invalid; NEVER activated.
   * 8. Idempotency: Repeated runs will not mutate already reconciled records or emit duplicate audit logs.
   * 9. Concurrency: Uses atomic conditional updates (findOneAndUpdate) to guarantee single transition.
   * 10. Fault Isolation: Single item failures do not abort the remaining batch.
   *
   * @param {Object} [options]
   * @param {Date} [options.asOfDate] Reference evaluation timestamp (defaults to current time)
   * @param {number} [options.batchSize] Max promotions per scan
   * @param {string} [options.workerId] Identifier for the executing worker/process
   * @param {Object} [options.req] Optional request context
   * @returns {Promise<{ scanned: number, activated: number, expired: number, skipped: number, invalid: number, failed: number, durationMs: number, evaluationTime: Date }>}
   */
  async reconcilePromotions(options = {}) {
    const startTime = Date.now();
    const asOfDate = options.asOfDate instanceof Date ? options.asOfDate : new Date();
    const batchSize = Math.max(
      1,
      Number(options.batchSize) || env.PROMOTION_RECONCILIATION_BATCH_SIZE || 50
    );
    const workerId = options.workerId || "promotion-lifecycle-worker";

    let scanned = 0;
    let activated = 0;
    let expired = 0;
    let skipped = 0;
    let invalid = 0;
    let failed = 0;

    try {
      // 1. Fetch Candidate Scheduled Promotions ready for activation or expiration
      const scheduledCandidates = await ProductDiscount.find({
        status: DISCOUNT_STATUSES.SCHEDULED,
        deletedAt: null,
        startsAt: { $lte: asOfDate },
      })
        .limit(batchSize)
        .lean();

      // 2. Fetch Candidate Active Promotions ready for expiration
      const activeCandidates = await ProductDiscount.find({
        status: DISCOUNT_STATUSES.ACTIVE,
        deletedAt: null,
        endsAt: { $lte: asOfDate },
      })
        .limit(batchSize)
        .lean();

      const allCandidates = [...scheduledCandidates, ...activeCandidates];
      scanned = allCandidates.length;

      for (const promo of allCandidates) {
        try {
          const res = await this.reconcileSinglePromotion(promo, {
            asOfDate,
            workerId,
            req: options.req || null,
          });

          if (res.activated) activated++;
          else if (res.expired) expired++;
          else if (res.isInvalid) invalid++;
          else if (res.skipped) skipped++;
        } catch (itemErr) {
          failed++;
          logger.error(
            {
              promotionId: promo._id,
              promotionName: promo.name,
              error: itemErr.message,
              stack: itemErr.stack,
            },
            "Error processing promotion lifecycle reconciliation item"
          );
        }
      }
    } catch (batchErr) {
      logger.error(
        {
          error: batchErr.message,
          stack: batchErr.stack,
        },
        "Fatal error during promotion lifecycle reconciliation batch query"
      );
      throw batchErr;
    }

    const durationMs = Date.now() - startTime;

    logger.info(
      {
        scanned,
        activated,
        expired,
        skipped,
        invalid,
        failed,
        durationMs,
        asOfDate,
      },
      "Promotion lifecycle reconciliation batch completed"
    );

    return {
      scanned,
      activated,
      expired,
      skipped,
      invalid,
      failed,
      durationMs,
      evaluationTime: asOfDate,
    };
  }

  /**
   * Reconcile a single promotion candidate with atomic conditional update and audit logging.
   *
   * @param {Object} promo Promotion plain document
   * @param {Object} context
   * @param {Date} context.asOfDate
   * @param {string} context.workerId
   * @param {Object} [context.req]
   * @returns {Promise<{ activated?: boolean, expired?: boolean, skipped?: boolean, isInvalid?: boolean, reason?: string }>}
   */
  async reconcileSinglePromotion(promo, context) {
    if (!promo || !promo._id) {
      return { skipped: true, isInvalid: true, reason: "MALFORMED_PROMOTION" };
    }

    // Guard: Soft-deleted promotions are completely ignored
    if (promo.deletedAt) {
      return { skipped: true, reason: "SOFT_DELETED_IGNORED" };
    }

    // Guard: Paused, Cancelled, and Draft promotions remain in their states
    if (promo.status === DISCOUNT_STATUSES.PAUSED) {
      return { skipped: true, reason: "PAUSED_PRESERVED" };
    }
    if (promo.status === DISCOUNT_STATUSES.CANCELLED) {
      return { skipped: true, reason: "CANCELLED_PRESERVED" };
    }
    if (promo.status === DISCOUNT_STATUSES.DRAFT) {
      return { skipped: true, reason: "DRAFT_PRESERVED" };
    }

    // Guard: Unknown or unsupported status
    if (!Object.values(DISCOUNT_STATUSES).includes(promo.status)) {
      logger.warn(
        { promotionId: promo._id, status: promo.status },
        "Promotion possesses unknown or unsupported status; skipping"
      );
      return { skipped: true, isInvalid: true, reason: "UNKNOWN_STATUS" };
    }

    const startsAt = new Date(promo.startsAt).getTime();
    const endsAt = new Date(promo.endsAt).getTime();
    const evalTime = context.asOfDate.getTime();

    // Guard: Malformed date range (endsAt <= startsAt)
    if (isNaN(startsAt) || isNaN(endsAt) || endsAt <= startsAt) {
      logger.warn(
        {
          promotionId: promo._id,
          name: promo.name,
          startsAt: promo.startsAt,
          endsAt: promo.endsAt,
        },
        "Promotion contains invalid date range (endsAt <= startsAt); skipping without activation"
      );
      return { skipped: true, isInvalid: true, reason: "INVALID_DATE_RANGE" };
    }

    // Case 1: Scheduled Promotion Evaluation
    if (promo.status === DISCOUNT_STATUSES.SCHEDULED) {
      // 1a. If window has already ended before it could be activated -> EXPIRED
      if (evalTime >= endsAt) {
        const updated = await ProductDiscount.findOneAndUpdate(
          {
            _id: promo._id,
            status: DISCOUNT_STATUSES.SCHEDULED,
            deletedAt: null,
            endsAt: { $lte: context.asOfDate },
          },
          {
            $set: {
              status: DISCOUNT_STATUSES.EXPIRED,
              lastTransitionAt: context.asOfDate,
              lastReconciledAt: context.asOfDate,
            },
          },
          { new: false }
        );

        if (updated) {
          await this.logLifecycleAudit({
            promo,
            fromStatus: DISCOUNT_STATUSES.SCHEDULED,
            toStatus: DISCOUNT_STATUSES.EXPIRED,
            action: "PROMOTION_AUTO_EXPIRED",
            reason: "Scheduled promotion reached end time before activation",
            context,
          });
          return { expired: true };
        }
        return { skipped: true, reason: "CONCURRENT_UPDATE_OR_STATUS_CHANGED" };
      }

      // 1b. If within active window (startsAt <= evalTime < endsAt) -> ACTIVE
      if (evalTime >= startsAt && evalTime < endsAt) {
        const updated = await ProductDiscount.findOneAndUpdate(
          {
            _id: promo._id,
            status: DISCOUNT_STATUSES.SCHEDULED,
            deletedAt: null,
            startsAt: { $lte: context.asOfDate },
            endsAt: { $gt: context.asOfDate },
          },
          {
            $set: {
              status: DISCOUNT_STATUSES.ACTIVE,
              lastTransitionAt: context.asOfDate,
              lastReconciledAt: context.asOfDate,
            },
          },
          { new: false }
        );

        if (updated) {
          await this.logLifecycleAudit({
            promo,
            fromStatus: DISCOUNT_STATUSES.SCHEDULED,
            toStatus: DISCOUNT_STATUSES.ACTIVE,
            action: "PROMOTION_AUTO_ACTIVATED",
            reason: "Scheduled start time reached",
            context,
          });
          return { activated: true };
        }
        return { skipped: true, reason: "CONCURRENT_UPDATE_OR_STATUS_CHANGED" };
      }

      // 1c. Before start time -> remains scheduled
      return { skipped: true, reason: "NOT_YET_DUE" };
    }

    // Case 2: Active Promotion Evaluation
    if (promo.status === DISCOUNT_STATUSES.ACTIVE) {
      // 2a. Reached end time -> EXPIRED
      if (evalTime >= endsAt) {
        const updated = await ProductDiscount.findOneAndUpdate(
          {
            _id: promo._id,
            status: DISCOUNT_STATUSES.ACTIVE,
            deletedAt: null,
            endsAt: { $lte: context.asOfDate },
          },
          {
            $set: {
              status: DISCOUNT_STATUSES.EXPIRED,
              lastTransitionAt: context.asOfDate,
              lastReconciledAt: context.asOfDate,
            },
          },
          { new: false }
        );

        if (updated) {
          await this.logLifecycleAudit({
            promo,
            fromStatus: DISCOUNT_STATUSES.ACTIVE,
            toStatus: DISCOUNT_STATUSES.EXPIRED,
            action: "PROMOTION_AUTO_EXPIRED",
            reason: "Active promotion reached scheduled end time",
            context,
          });
          return { expired: true };
        }
        return { skipped: true, reason: "CONCURRENT_UPDATE_OR_STATUS_CHANGED" };
      }

      // 2b. Still in active window
      return { skipped: true, reason: "CURRENTLY_ACTIVE" };
    }

    // Default fallback
    return { skipped: true, reason: "NO_ACTION_REQUIRED" };
  }

  /**
   * Helper to write an immutable AuditLog record for automated lifecycle transitions.
   *
   * @param {Object} params
   * @param {Object} params.promo
   * @param {string} params.fromStatus
   * @param {string} params.toStatus
   * @param {string} params.action
   * @param {string} params.reason
   * @param {Object} params.context
   */
  async logLifecycleAudit({ promo, fromStatus, toStatus, action, reason, context }) {
    try {
      const actorId =
        promo.createdBy || new mongoose.Types.ObjectId("000000000000000000000000");

      await recordAuditLog({
        actorId,
        targetId: promo._id,
        action,
        entityType: "product_discount",
        beforeState: {
          status: fromStatus,
          startsAt: promo.startsAt,
          endsAt: promo.endsAt,
        },
        afterState: {
          status: toStatus,
          transitionReason: reason,
          workerId: context.workerId,
          evaluatedAt: context.asOfDate,
          scheduledStartsAt: promo.startsAt,
          scheduledEndsAt: promo.endsAt,
        },
        req: context.req || null,
      });
    } catch (auditErr) {
      logger.error(
        {
          promotionId: promo._id,
          action,
          error: auditErr.message,
        },
        "Failed to write automated lifecycle audit log"
      );
    }
  }
}

const promotionLifecycleService = new PromotionLifecycleService();
module.exports = promotionLifecycleService;
module.exports.PromotionLifecycleService = PromotionLifecycleService;
