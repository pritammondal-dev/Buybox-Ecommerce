const mongoose = require("mongoose");

const financialLedgerRepository = require("../repositories/financial-ledger.repository");

const {
  FINANCIAL_ENTRY_TYPES,
  FINANCIAL_ENTRY_DIRECTIONS,
  FINANCIAL_ACCOUNT_TYPES,
  FINANCIAL_ENTRY_SOURCES,
  LEDGER_ACCOUNTS,
  JOURNAL_STATUSES,
  WALLET_STATUSES,
} = require("../constants/finance.constants");

const AppError = require("../errors/AppError");

const toMinorUnits = (value) => {
  if (value === null || value === undefined) {
    throw new AppError(
      "Ledger amount must be defined",
      422,
      "INVALID_LEDGER_AMOUNT"
    );
  }

  const normalized = Number(value?.toString ? value.toString() : String(value));

  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new AppError(
      "Ledger amount must be greater than zero",
      422,
      "INVALID_LEDGER_AMOUNT"
    );
  }

  return Math.round(normalized * 100);
};

const fromMinorUnits = (minorUnits) => {
  const minor = Number(minorUnits || 0);
  return (minor / 100).toFixed(2);
};

const toDecimal128 = (value) => {
  const normalized = Number(value || 0);

  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new AppError(
      "Ledger amount must be greater than zero",
      422,
      "INVALID_LEDGER_AMOUNT"
    );
  }

  return mongoose.Types.Decimal128.fromString(normalized.toFixed(2));
};

const normalizeCurrency = (currency) => {
  const normalized = String(currency || "")
    .trim()
    .toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new AppError(
      "Invalid ledger currency",
      422,
      "INVALID_LEDGER_CURRENCY"
    );
  }

  return normalized;
};

/**
 * Authoritative double-entry journal posting.
 * Enforces:
 * 1. Balanced Invariant: Total Debits == Total Credits in minor units.
 * 2. Currency Isolation: All entries in a journal must share the exact same currency.
 * 3. Idempotent Execution: Duplicate idempotency keys return existing posted entries.
 * 4. Immutability: Once written, entries cannot be mutated or deleted.
 * 5. Automatic Wallet Projection Synchronization for affected vendors.
 */
const postJournal = async ({
  journalId,
  sourceEvent = "manual",
  sourceEventId = null,
  idempotencyKey = null,
  currency = "INR",
  entries = [],
  session = null,
  actorId = null,
  metadata = {},
}) => {
  if (!journalId || !String(journalId).trim()) {
    throw new AppError(
      "Journal ID is required",
      422,
      "JOURNAL_ID_REQUIRED"
    );
  }

  if (!Array.isArray(entries) || entries.length < 2) {
    throw new AppError(
      "A double-entry journal requires at least two balanced entries",
      422,
      "INVALID_JOURNAL_ENTRIES"
    );
  }

  const normalizedCurrency = normalizeCurrency(currency);

  // Check idempotency if an idempotency key was supplied
  if (idempotencyKey) {
    const FinancialLedgerEntry = require("../models/FinancialLedgerEntry");
    const existing = await FinancialLedgerEntry.findOne({
      $or: [
        { idempotencyKey },
        { idempotencyKey: `${idempotencyKey}_0` },
        { journalId },
      ],
    }).session(session || null);

    if (existing) {
      const existingJournal = await financialLedgerRepository.findByJournalId(
        existing.journalId,
        { session }
      );
      return existingJournal.length > 0 ? existingJournal : [existing];
    }
  }

  // Double-entry validation: Total Debits === Total Credits in minor units
  let totalDebitsMinor = 0;
  let totalCreditsMinor = 0;
  const vendorIdsToSync = new Set();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const entryCurrency = normalizeCurrency(entry.currency || normalizedCurrency);

    if (entryCurrency !== normalizedCurrency) {
      throw new AppError(
        `Currency mismatch: entry ${i} has currency ${entryCurrency}, expected ${normalizedCurrency}`,
        422,
        "CURRENCY_MISMATCH"
      );
    }

    const minor = toMinorUnits(entry.amount);

    if (entry.direction === FINANCIAL_ENTRY_DIRECTIONS.DEBIT) {
      totalDebitsMinor += minor;
    } else if (entry.direction === FINANCIAL_ENTRY_DIRECTIONS.CREDIT) {
      totalCreditsMinor += minor;
    } else {
      throw new AppError(
        `Invalid financial entry direction '${entry.direction}'`,
        422,
        "INVALID_FINANCIAL_ENTRY_DIRECTION"
      );
    }

    if (!Object.values(FINANCIAL_ENTRY_TYPES).includes(entry.entryType)) {
      throw new AppError(
        `Invalid financial entry type '${entry.entryType}'`,
        422,
        "INVALID_FINANCIAL_ENTRY_TYPE"
      );
    }

    if (!Object.values(FINANCIAL_ACCOUNT_TYPES).includes(entry.accountType)) {
      throw new AppError(
        `Invalid financial account type '${entry.accountType}'`,
        422,
        "INVALID_FINANCIAL_ACCOUNT_TYPE"
      );
    }

    if (entry.accountCode && !Object.values(LEDGER_ACCOUNTS).includes(entry.accountCode)) {
      throw new AppError(
        `Invalid ledger account code '${entry.accountCode}'`,
        422,
        "INVALID_ACCOUNT_CODE"
      );
    }

    if (entry.vendorId && mongoose.isValidObjectId(entry.vendorId)) {
      vendorIdsToSync.add(String(entry.vendorId));
    }
  }

  if (totalDebitsMinor !== totalCreditsMinor) {
    throw new AppError(
      `Unbalanced journal '${journalId}': Total Debits (${fromMinorUnits(totalDebitsMinor)}) != Total Credits (${fromMinorUnits(totalCreditsMinor)})`,
      422,
      "UNBALANCED_JOURNAL"
    );
  }

  if (totalDebitsMinor === 0) {
    throw new AppError(
      "Journal total amount must be greater than zero",
      422,
      "INVALID_JOURNAL_AMOUNT"
    );
  }

  // Construct prepared entries for insertion
  const preparedEntries = entries.map((entry, idx) => {
    const minor = toMinorUnits(entry.amount);
    const itemKey = entry.idempotencyKey || (idempotencyKey ? `${idempotencyKey}_${idx}` : null);

    return {
      journalId: String(journalId),
      entryType: entry.entryType,
      direction: entry.direction,
      accountType: entry.accountType,
      accountCode: entry.accountCode || null,
      accountReference: entry.accountReference || null,
      amount: mongoose.Types.Decimal128.fromString(fromMinorUnits(minor)),
      currency: normalizedCurrency,
      orderId: entry.orderId || null,
      paymentId: entry.paymentId || null,
      refundId: entry.refundId || null,
      settlementId: entry.settlementId || null,
      payoutId: entry.payoutId || null,
      vendorId: entry.vendorId || null,
      idempotencyKey: itemKey,
      description: entry.description || null,
      source: entry.source || FINANCIAL_ENTRY_SOURCES.SYSTEM,
      sourceEvent: sourceEvent || null,
      sourceEventId: sourceEventId ? String(sourceEventId) : null,
      journalStatus: JOURNAL_STATUSES.POSTED,
      reversalOfJournalId: entry.reversalOfJournalId || null,
      reversalReason: entry.reversalReason || null,
      metadata: {
        ...(metadata || {}),
        ...(entry.metadata || {}),
      },
    };
  });

  const executePost = async (activeSession) => {
    let created;
    try {
      created = await financialLedgerRepository.createMany(preparedEntries, {
        session: activeSession,
      });
    } catch (err) {
      if (err?.code === 11000) {
        const existingJournal = await financialLedgerRepository.findByJournalId(
          String(journalId),
          { session: activeSession }
        );
        if (existingJournal && existingJournal.length > 0) {
          return existingJournal;
        }
      }
      throw err;
    }

    // Synchronize vendor wallet balance projections for all affected vendors
    for (const vId of vendorIdsToSync) {
      await syncVendorWalletBalances(vId, normalizedCurrency, {
        session: activeSession,
      });
    }

    return created;
  };

  if (session) {
    return executePost(session);
  }

  const newSession = await mongoose.startSession();
  try {
    let result;
    await newSession.withTransaction(async () => {
      result = await executePost(newSession);
    });
    return result;
  } finally {
    await newSession.endSession();
  }
};

/**
 * Reverses a posted journal by creating a balanced mirror-opposite entry set.
 */
const reverseJournal = async ({
  originalJournalId,
  reason = null,
  actorId = null,
  idempotencyKey = null,
  session = null,
}) => {
  if (!originalJournalId) {
    throw new AppError(
      "Original journal ID is required for reversal",
      400,
      "ORIGINAL_JOURNAL_ID_REQUIRED"
    );
  }

  const existingEntries = await financialLedgerRepository.findByJournalId(
    originalJournalId,
    { session }
  );

  if (!existingEntries || existingEntries.length === 0) {
    throw new AppError(
      `Original journal '${originalJournalId}' not found`,
      404,
      "JOURNAL_NOT_FOUND"
    );
  }

  const existingReversals = await financialLedgerRepository.findByReversalOfJournalId(
    originalJournalId,
    { session }
  );

  if (existingReversals && existingReversals.length > 0) {
    return existingReversals;
  }

  const reversalJournalId = `JRN-REV-${originalJournalId}`;
  const reversalEntries = existingEntries.map((entry, idx) => ({
    entryType: FINANCIAL_ENTRY_TYPES.REVERSAL,
    direction:
      entry.direction === FINANCIAL_ENTRY_DIRECTIONS.DEBIT
        ? FINANCIAL_ENTRY_DIRECTIONS.CREDIT
        : FINANCIAL_ENTRY_DIRECTIONS.DEBIT,
    accountType: entry.accountType,
    accountCode: entry.accountCode || null,
    accountReference: entry.accountReference || null,
    amount: entry.amount,
    currency: entry.currency,
    orderId: entry.orderId || null,
    paymentId: entry.paymentId || null,
    refundId: entry.refundId || null,
    settlementId: entry.settlementId || null,
    payoutId: entry.payoutId || null,
    vendorId: entry.vendorId || null,
    idempotencyKey: idempotencyKey
      ? `${idempotencyKey}_${idx}`
      : `rev_${originalJournalId}_${idx}`,
    description: `Reversal of journal ${originalJournalId}${reason ? `: ${reason}` : ""}`,
    source: FINANCIAL_ENTRY_SOURCES.SYSTEM,
    reversalOfJournalId: originalJournalId,
    reversalReason: reason,
  }));

  return postJournal({
    journalId: reversalJournalId,
    sourceEvent: "journal_reversed",
    sourceEventId: originalJournalId,
    idempotencyKey: idempotencyKey || `rev_${originalJournalId}`,
    currency: existingEntries[0].currency,
    entries: reversalEntries,
    session,
    actorId,
    metadata: {
      originalJournalId,
      reason: reason || "",
    },
  });
};

const resolveSession = (opts) => {
  if (!opts) return null;
  if (opts.session !== undefined) return opts.session;
  if (typeof opts === "object" && (opts.id || opts.constructor?.name === "ClientSession")) {
    return opts;
  }
  return null;
};

/**
 * Calculates authoritative vendor balance classification from raw double-entry ledger lines.
 */
const getVendorBalancesFromLedger = async (
  vendorId,
  currency = "INR",
  options = {}
) => {
  const session = resolveSession(options);
  const normalizedCurrency = normalizeCurrency(currency);
  const entries = await financialLedgerRepository.findVendorAllEntries(
    vendorId,
    normalizedCurrency,
    { session }
  );

  let pendingMinor = 0;
  let availableMinor = 0;
  let reservedMinor = 0;
  let totalEarnedMinor = 0;
  let totalCommissionMinor = 0;
  let totalPaidOutMinor = 0;
  let totalRefundedMinor = 0;

  for (const entry of entries) {
    const minor = toMinorUnits(entry.amount);
    const code = entry.accountCode;
    const isCredit = entry.direction === FINANCIAL_ENTRY_DIRECTIONS.CREDIT;
    const isDebit = entry.direction === FINANCIAL_ENTRY_DIRECTIONS.DEBIT;

    // 1. Pending Balance tracking
    if (code === LEDGER_ACCOUNTS.VENDOR_PENDING_EARNINGS) {
      if (isCredit) pendingMinor += minor;
      if (isDebit) pendingMinor -= minor;
    } else if (!code && isCredit && [FINANCIAL_ENTRY_TYPES.VENDOR_EARNING, FINANCIAL_ENTRY_TYPES.ORDER_SALE].includes(entry.entryType)) {
      // Legacy unclassified credit
      pendingMinor += minor;
    }

    // 2. Available Balance tracking
    if (code === LEDGER_ACCOUNTS.VENDOR_AVAILABLE_EARNINGS) {
      if (isCredit) availableMinor += minor;
      if (isDebit) availableMinor -= minor;
    }

    // 3. Reserved Payout Funds tracking
    if (code === LEDGER_ACCOUNTS.VENDOR_RESERVED_PAYOUT) {
      if (isCredit) reservedMinor += minor;
      if (isDebit) reservedMinor -= minor;
    }

    // 4. Cumulative Lifetime Earnings
    if (
      isCredit &&
      [
        FINANCIAL_ENTRY_TYPES.VENDOR_EARNING,
        FINANCIAL_ENTRY_TYPES.ORDER_SALE,
        FINANCIAL_ENTRY_TYPES.PROMOTION_SUBSIDY,
      ].includes(entry.entryType) &&
      (code === LEDGER_ACCOUNTS.VENDOR_PENDING_EARNINGS || !code)
    ) {
      totalEarnedMinor += minor;
    }

    // 5. Total Paid Out (count disbursement from reserved payout account)
    if (
      entry.entryType === FINANCIAL_ENTRY_TYPES.PAYOUT_PAID &&
      isDebit &&
      code === LEDGER_ACCOUNTS.VENDOR_RESERVED_PAYOUT
    ) {
      totalPaidOutMinor += minor;
    } else if (!code && isDebit && entry.entryType === FINANCIAL_ENTRY_TYPES.PAYOUT) {
      // Legacy unclassified payout debit
      totalPaidOutMinor += minor;
    }

    // 6. Cumulative Refunds Deducted
    if (
      isDebit &&
      [
        FINANCIAL_ENTRY_TYPES.REFUND,
        FINANCIAL_ENTRY_TYPES.REFUND_REVERSAL,
      ].includes(entry.entryType)
    ) {
      totalRefundedMinor += minor;
    }
  }

  // Also calculate total commission from platform revenue entries tagged to this vendor
  const FinancialLedgerEntry = require("../models/FinancialLedgerEntry");
  const commissionEntries = await FinancialLedgerEntry.find({
    vendorId,
    currency: normalizedCurrency,
    accountCode: {
      $in: [
        LEDGER_ACCOUNTS.PLATFORM_COMMISSION_REVENUE,
        LEDGER_ACCOUNTS.COMMISSION_REVERSAL,
      ],
    },
  }).session(session || null);

  for (const cEntry of commissionEntries) {
    const cMinor = toMinorUnits(cEntry.amount);
    if (cEntry.accountCode === LEDGER_ACCOUNTS.PLATFORM_COMMISSION_REVENUE && cEntry.direction === FINANCIAL_ENTRY_DIRECTIONS.CREDIT) {
      totalCommissionMinor += cMinor;
    } else if (cEntry.accountCode === LEDGER_ACCOUNTS.COMMISSION_REVERSAL && cEntry.direction === FINANCIAL_ENTRY_DIRECTIONS.DEBIT) {
      totalCommissionMinor -= cMinor;
    }
  }

  return {
    vendorId: String(vendorId),
    currency: normalizedCurrency,
    pendingBalance: fromMinorUnits(Math.max(0, pendingMinor)),
    availableBalance: fromMinorUnits(Math.max(0, availableMinor)),
    reservedBalance: fromMinorUnits(Math.max(0, reservedMinor)),
    totalEarned: fromMinorUnits(Math.max(0, totalEarnedMinor)),
    totalCommission: fromMinorUnits(Math.max(0, totalCommissionMinor)),
    totalPaidOut: fromMinorUnits(Math.max(0, totalPaidOutMinor)),
    totalRefunded: fromMinorUnits(Math.max(0, totalRefundedMinor)),
    pendingMinor,
    availableMinor,
    reservedMinor,
    totalEarnedMinor,
    totalCommissionMinor,
    totalPaidOutMinor,
    totalRefundedMinor,
  };
};

/**
 * Synchronizes the cached VendorWallet document from authoritative double-entry ledger truth.
 */
const syncVendorWalletBalances = async (
  vendorId,
  currency = "INR",
  options = {}
) => {
  const session = resolveSession(options);
  const VendorWallet = require("../models/VendorWallet");
  const balances = await getVendorBalancesFromLedger(vendorId, currency, { session });

  const update = {
    $set: {
      pendingBalance: mongoose.Types.Decimal128.fromString(balances.pendingBalance),
      availableBalance: mongoose.Types.Decimal128.fromString(balances.availableBalance),
      reservedBalance: mongoose.Types.Decimal128.fromString(balances.reservedBalance),
      totalEarned: mongoose.Types.Decimal128.fromString(balances.totalEarned),
      totalCommission: mongoose.Types.Decimal128.fromString(balances.totalCommission),
      totalPaidOut: mongoose.Types.Decimal128.fromString(balances.totalPaidOut),
      totalRefunded: mongoose.Types.Decimal128.fromString(balances.totalRefunded),
      lastReconciledAt: new Date(),
      lastReconciliationStatus: "reconciled",
    },
    $inc: { lastSequence: 1 },
    $setOnInsert: {
      vendorId,
      currency: balances.currency,
      status: WALLET_STATUSES.ACTIVE,
    },
  };

  return VendorWallet.findOneAndUpdate(
    { vendorId, currency: balances.currency },
    update,
    { new: true, upsert: true, session }
  );
};

/**
 * Payment Capture Lifecycle Posting:
 * Creates balanced journal capturing order payment, platform commission, and vendor pending entitlement.
 */
const postOrderPaymentCaptureJournal = async (
  orderDoc,
  { session = null } = {}
) => {
  if (!orderDoc || !Array.isArray(orderDoc.items) || orderDoc.items.length === 0) {
    return [];
  }

  const currency = normalizeCurrency(orderDoc.currency || "INR");

  // Group items by vendorId
  const vendorItemsMap = new Map();
  for (const item of orderDoc.items) {
    if (!item.vendorId) continue;
    const vId = item.vendorId.toString();
    if (!vendorItemsMap.has(vId)) {
      vendorItemsMap.set(vId, []);
    }
    vendorItemsMap.get(vId).push(item);
  }

  const postedJournals = [];

  for (const [vendorId, items] of vendorItemsMap.entries()) {
    let baseMinor = 0;
    let commissionMinor = 0;
    let subsidyMinor = 0;

    for (const item of items) {
      const unitPrice = Number(item.unitPrice?.toString() || 0);
      const qty = item.quantity || 1;
      const itemBaseMinor = Math.round(unitPrice * qty * 100);
      baseMinor += itemBaseMinor;

      if (item.commissionAmount) {
        commissionMinor += toMinorUnits(item.commissionAmount);
      } else if (item.commissionSnapshot?.commissionAmount) {
        commissionMinor += toMinorUnits(item.commissionSnapshot.commissionAmount);
      } else {
        const rate = Number(item.commissionRate?.toString() || 0.10);
        commissionMinor += Math.round(itemBaseMinor * rate);
      }

      if (item.isPromotional && item.fundingSource === "platform") {
        const itemSubsidy = Number(item.promotionDiscountAmount?.toString() || 0) * qty;
        subsidyMinor += Math.round(itemSubsidy * 100);
      }
    }

    const vendorNetMinor = Math.max(0, baseMinor - commissionMinor);
    const customerPaidMinor = Math.max(0, baseMinor - subsidyMinor);

    const journalId = `JRN-ORD-${orderDoc.orderNumber || orderDoc._id}-${vendorId}`;
    const idempotencyKey = `ord_pay_${orderDoc._id}_${vendorId}`;

    const journalEntries = [
      // Debits
      {
        entryType: FINANCIAL_ENTRY_TYPES.PAYMENT_RECEIVED,
        direction: FINANCIAL_ENTRY_DIRECTIONS.DEBIT,
        accountType: FINANCIAL_ACCOUNT_TYPES.PLATFORM,
        accountCode: LEDGER_ACCOUNTS.PLATFORM_ESCROW,
        accountReference: "CUSTOMER_PAYMENT_GATEWAY",
        amount: fromMinorUnits(customerPaidMinor),
        currency,
        orderId: orderDoc._id,
        vendorId,
        idempotencyKey: `${idempotencyKey}_escrow`,
        description: `Customer payment captured for order #${orderDoc.orderNumber || orderDoc._id}`,
      },
    ];

    if (subsidyMinor > 0) {
      journalEntries.push({
        entryType: FINANCIAL_ENTRY_TYPES.PROMOTION_SUBSIDY,
        direction: FINANCIAL_ENTRY_DIRECTIONS.DEBIT,
        accountType: FINANCIAL_ACCOUNT_TYPES.PLATFORM,
        accountCode: LEDGER_ACCOUNTS.PLATFORM_SUBSIDY_EXPENSE,
        accountReference: "BUYBOX_MARKETING_PROMOTIONS",
        amount: fromMinorUnits(subsidyMinor),
        currency,
        orderId: orderDoc._id,
        vendorId,
        idempotencyKey: `${idempotencyKey}_subsidy`,
        description: `Platform promotional subsidy expense for order #${orderDoc.orderNumber || orderDoc._id}`,
      });
    }

    // Credits
    journalEntries.push(
      {
        entryType: FINANCIAL_ENTRY_TYPES.PLATFORM_COMMISSION,
        direction: FINANCIAL_ENTRY_DIRECTIONS.CREDIT,
        accountType: FINANCIAL_ACCOUNT_TYPES.PLATFORM,
        accountCode: LEDGER_ACCOUNTS.PLATFORM_COMMISSION_REVENUE,
        accountReference: "BUYBOX_COMMISSION_REVENUE",
        amount: fromMinorUnits(commissionMinor),
        currency,
        orderId: orderDoc._id,
        vendorId,
        idempotencyKey: `${idempotencyKey}_comm`,
        description: `Marketplace commission revenue for order #${orderDoc.orderNumber || orderDoc._id}`,
      },
      {
        entryType: FINANCIAL_ENTRY_TYPES.VENDOR_EARNING,
        direction: FINANCIAL_ENTRY_DIRECTIONS.CREDIT,
        accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
        accountCode: LEDGER_ACCOUNTS.VENDOR_PENDING_EARNINGS,
        accountReference: String(vendorId),
        amount: fromMinorUnits(vendorNetMinor),
        currency,
        orderId: orderDoc._id,
        vendorId,
        idempotencyKey: `${idempotencyKey}_earning`,
        description: `Vendor pending earning for order #${orderDoc.orderNumber || orderDoc._id}`,
      }
    );

    const posted = await postJournal({
      journalId,
      sourceEvent: "payment_captured",
      sourceEventId: orderDoc._id,
      idempotencyKey,
      currency,
      entries: journalEntries,
      session,
      metadata: {
        orderId: String(orderDoc._id),
        orderNumber: String(orderDoc.orderNumber || ""),
        vendorId: String(vendorId),
      },
    });

    postedJournals.push(posted);
  }

  return postedJournals;
};

/**
 * Settlement Maturation Lifecycle Posting:
 * Reclassifies vendor earnings from pending to available upon satisfying eligibility rules.
 */
const postSettlementMaturationJournal = async (
  settlementDoc,
  optionsOrCalc = {},
  extraOptions = {}
) => {
  if (!settlementDoc) return null;

  const options = optionsOrCalc && optionsOrCalc.session !== undefined
    ? optionsOrCalc
    : (extraOptions && extraOptions.session !== undefined ? extraOptions : optionsOrCalc);
  const session = options?.session || null;

  const netPayableNum = Number(settlementDoc.netPayable?.toString() || 0);
  if (netPayableNum <= 0) return null;

  const currency = normalizeCurrency(settlementDoc.currency || "INR");
  const journalId = `JRN-MAT-${settlementDoc.settlementNumber || settlementDoc._id}`;
  const idempotencyKey = `stl_mat_${settlementDoc._id}`;

  const entries = [
    {
      entryType: FINANCIAL_ENTRY_TYPES.SETTLEMENT_MATURED,
      direction: FINANCIAL_ENTRY_DIRECTIONS.DEBIT,
      accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
      accountCode: LEDGER_ACCOUNTS.VENDOR_PENDING_EARNINGS,
      accountReference: String(settlementDoc.vendorId),
      amount: fromMinorUnits(toMinorUnits(netPayableNum)),
      currency,
      vendorId: settlementDoc.vendorId,
      idempotencyKey: `${idempotencyKey}_debit_pending`,
      description: `Pending earnings matured into settlement #${settlementDoc.settlementNumber || settlementDoc._id}`,
    },
    {
      entryType: FINANCIAL_ENTRY_TYPES.SETTLEMENT_MATURED,
      direction: FINANCIAL_ENTRY_DIRECTIONS.CREDIT,
      accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
      accountCode: LEDGER_ACCOUNTS.VENDOR_AVAILABLE_EARNINGS,
      accountReference: String(settlementDoc.vendorId),
      amount: fromMinorUnits(toMinorUnits(netPayableNum)),
      currency,
      vendorId: settlementDoc.vendorId,
      idempotencyKey: `${idempotencyKey}_credit_available`,
      description: `Available balance credited for settlement #${settlementDoc.settlementNumber || settlementDoc._id}`,
    },
  ];

  return postJournal({
    journalId,
    sourceEvent: "settlement_matured",
    sourceEventId: settlementDoc._id,
    idempotencyKey,
    currency,
    entries,
    session,
    metadata: {
      settlementId: String(settlementDoc._id),
      settlementNumber: String(settlementDoc.settlementNumber || ""),
      vendorId: String(settlementDoc.vendorId),
    },
  });
};

/**
 * Payout Reservation Lifecycle Posting:
 * Atomically reserves available funds for an in-flight payout.
 */
const postPayoutReservationJournal = async (
  payoutDoc,
  { session = null, actorId = null } = {}
) => {
  if (!payoutDoc) return null;

  const amountNum = Number(payoutDoc.amount?.toString() || 0);
  if (amountNum <= 0) return null;

  const currency = normalizeCurrency(payoutDoc.currency || "INR");
  const retryTag = payoutDoc.retryCount ? `_r${payoutDoc.retryCount}` : "";
  const journalId = `JRN-PAY-RES-${payoutDoc.payoutNumber || payoutDoc._id}${retryTag}`;
  const idempotencyKey = `payout_res_${payoutDoc._id}${retryTag}`;

  const entries = [
    {
      entryType: FINANCIAL_ENTRY_TYPES.PAYOUT_RESERVED,
      direction: FINANCIAL_ENTRY_DIRECTIONS.DEBIT,
      accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
      accountCode: LEDGER_ACCOUNTS.VENDOR_AVAILABLE_EARNINGS,
      accountReference: String(payoutDoc.vendorId),
      amount: fromMinorUnits(toMinorUnits(amountNum)),
      currency,
      settlementId: payoutDoc.settlementId,
      payoutId: payoutDoc._id,
      vendorId: payoutDoc.vendorId,
      idempotencyKey: `${idempotencyKey}_debit_avail`,
      description: `Funds reserved for payout #${payoutDoc.payoutNumber || payoutDoc._id}`,
    },
    {
      entryType: FINANCIAL_ENTRY_TYPES.PAYOUT_RESERVED,
      direction: FINANCIAL_ENTRY_DIRECTIONS.CREDIT,
      accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
      accountCode: LEDGER_ACCOUNTS.VENDOR_RESERVED_PAYOUT,
      accountReference: String(payoutDoc.vendorId),
      amount: fromMinorUnits(toMinorUnits(amountNum)),
      currency,
      settlementId: payoutDoc.settlementId,
      payoutId: payoutDoc._id,
      vendorId: payoutDoc.vendorId,
      idempotencyKey: `${idempotencyKey}_credit_res`,
      description: `Reserved payout balance for payout #${payoutDoc.payoutNumber || payoutDoc._id}`,
    },
  ];

  return postJournal({
    journalId,
    sourceEvent: "payout_reserved",
    sourceEventId: payoutDoc._id,
    idempotencyKey,
    currency,
    entries,
    session,
    actorId,
    metadata: {
      payoutId: String(payoutDoc._id),
      payoutNumber: String(payoutDoc.payoutNumber || ""),
      vendorId: String(payoutDoc.vendorId),
    },
  });
};

/**
 * Payout Disbursement Lifecycle Posting:
 * Records final disbursement of reserved payout funds to clearing destination upon success.
 */
const postPayoutDisbursementJournal = async (
  payoutDoc,
  { session = null, actorId = null } = {}
) => {
  if (!payoutDoc) return null;

  const amountNum = Number(payoutDoc.amount?.toString() || 0);
  if (amountNum <= 0) return null;

  const currency = normalizeCurrency(payoutDoc.currency || "INR");
  const journalId = `JRN-PAY-DISB-${payoutDoc.payoutNumber || payoutDoc._id}`;
  const idempotencyKey = `payout_disb_${payoutDoc._id}`;

  const entries = [
    {
      entryType: FINANCIAL_ENTRY_TYPES.PAYOUT_PAID,
      direction: FINANCIAL_ENTRY_DIRECTIONS.DEBIT,
      accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
      accountCode: LEDGER_ACCOUNTS.VENDOR_RESERVED_PAYOUT,
      accountReference: String(payoutDoc.vendorId),
      amount: fromMinorUnits(toMinorUnits(amountNum)),
      currency,
      settlementId: payoutDoc.settlementId,
      payoutId: payoutDoc._id,
      vendorId: payoutDoc.vendorId,
      idempotencyKey: `${idempotencyKey}_debit_res`,
      description: `Disbursed reserved funds for payout #${payoutDoc.payoutNumber || payoutDoc._id}`,
    },
    {
      entryType: FINANCIAL_ENTRY_TYPES.PAYOUT,
      direction: FINANCIAL_ENTRY_DIRECTIONS.CREDIT,
      accountType: FINANCIAL_ACCOUNT_TYPES.CLEARING,
      accountCode: LEDGER_ACCOUNTS.PAYOUT_CLEARING,
      accountReference: String(payoutDoc.bankAccountId || "BANK_DESTINATION"),
      amount: fromMinorUnits(toMinorUnits(amountNum)),
      currency,
      settlementId: payoutDoc.settlementId,
      payoutId: payoutDoc._id,
      vendorId: payoutDoc.vendorId,
      idempotencyKey: `${idempotencyKey}_credit_clearing`,
      description: `Bank destination payout clearing for #${payoutDoc.payoutNumber || payoutDoc._id}`,
    },
  ];

  return postJournal({
    journalId,
    sourceEvent: "payout_paid",
    sourceEventId: payoutDoc._id,
    idempotencyKey,
    currency,
    entries,
    session,
    actorId,
    metadata: {
      payoutId: String(payoutDoc._id),
      payoutNumber: String(payoutDoc.payoutNumber || ""),
      vendorId: String(payoutDoc.vendorId),
      providerReference: String(payoutDoc.providerReference || ""),
    },
  });
};

/**
 * Payout Release Lifecycle Posting:
 * Restores reserved payout funds back to available balance when payout fails or is cancelled.
 */
const postPayoutReleaseJournal = async (
  payoutDoc,
  { session = null, actorId = null } = {}
) => {
  if (!payoutDoc) return null;

  const amountNum = Number(payoutDoc.amount?.toString() || 0);
  if (amountNum <= 0) return null;

  const currency = normalizeCurrency(payoutDoc.currency || "INR");
  const retryTag = payoutDoc.retryCount !== undefined ? `_r${payoutDoc.retryCount}` : "";
  const journalId = `JRN-PAY-REL-${payoutDoc.payoutNumber || payoutDoc._id}${retryTag}`;
  const idempotencyKey = `payout_rel_${payoutDoc._id}${retryTag}`;

  const entries = [
    {
      entryType: FINANCIAL_ENTRY_TYPES.PAYOUT_RELEASED,
      direction: FINANCIAL_ENTRY_DIRECTIONS.DEBIT,
      accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
      accountCode: LEDGER_ACCOUNTS.VENDOR_RESERVED_PAYOUT,
      accountReference: String(payoutDoc.vendorId),
      amount: fromMinorUnits(toMinorUnits(amountNum)),
      currency,
      settlementId: payoutDoc.settlementId,
      payoutId: payoutDoc._id,
      vendorId: payoutDoc.vendorId,
      idempotencyKey: `${idempotencyKey}_debit_res`,
      description: `Released reserved funds for failed/cancelled payout #${payoutDoc.payoutNumber || payoutDoc._id}`,
    },
    {
      entryType: FINANCIAL_ENTRY_TYPES.PAYOUT_RELEASED,
      direction: FINANCIAL_ENTRY_DIRECTIONS.CREDIT,
      accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
      accountCode: LEDGER_ACCOUNTS.VENDOR_AVAILABLE_EARNINGS,
      accountReference: String(payoutDoc.vendorId),
      amount: fromMinorUnits(toMinorUnits(amountNum)),
      currency,
      settlementId: payoutDoc.settlementId,
      payoutId: payoutDoc._id,
      vendorId: payoutDoc.vendorId,
      idempotencyKey: `${idempotencyKey}_credit_avail`,
      description: `Restored available funds from failed/cancelled payout #${payoutDoc.payoutNumber || payoutDoc._id}`,
    },
  ];

  return postJournal({
    journalId,
    sourceEvent: "payout_released",
    sourceEventId: payoutDoc._id,
    idempotencyKey,
    currency,
    entries,
    session,
    actorId,
    metadata: {
      payoutId: String(payoutDoc._id),
      payoutNumber: String(payoutDoc.payoutNumber || ""),
      vendorId: String(payoutDoc.vendorId),
      reason: String(payoutDoc.failureReason || "Payout release"),
    },
  });
};

/**
 * Vendor Withdrawal Request Lifecycle Posting:
 * Reserves available earnings into reserved payout funds upon withdrawal request submission.
 */
const postWithdrawalReservationJournal = async (
  withdrawalDoc,
  { session = null, actorId = null } = {}
) => {
  if (!withdrawalDoc) return null;

  const amountNum = Number(withdrawalDoc.amount?.toString() || 0);
  if (amountNum <= 0) return null;

  const currency = normalizeCurrency(withdrawalDoc.currency || "INR");
  const journalId = `JRN-WTH-RES-${withdrawalDoc.withdrawalNumber || withdrawalDoc._id}`;
  const idempotencyKey = `wth_res_${withdrawalDoc._id}`;

  const entries = [
    {
      entryType: FINANCIAL_ENTRY_TYPES.WITHDRAWAL_RESERVED,
      direction: FINANCIAL_ENTRY_DIRECTIONS.DEBIT,
      accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
      accountCode: LEDGER_ACCOUNTS.VENDOR_AVAILABLE_EARNINGS,
      accountReference: String(withdrawalDoc.vendorId),
      amount: fromMinorUnits(toMinorUnits(amountNum)),
      currency,
      vendorId: withdrawalDoc.vendorId,
      idempotencyKey: `${idempotencyKey}_debit_avail`,
      description: `Funds reserved for withdrawal #${withdrawalDoc.withdrawalNumber || withdrawalDoc._id}`,
    },
    {
      entryType: FINANCIAL_ENTRY_TYPES.WITHDRAWAL_RESERVED,
      direction: FINANCIAL_ENTRY_DIRECTIONS.CREDIT,
      accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
      accountCode: LEDGER_ACCOUNTS.VENDOR_RESERVED_PAYOUT,
      accountReference: String(withdrawalDoc.vendorId),
      amount: fromMinorUnits(toMinorUnits(amountNum)),
      currency,
      vendorId: withdrawalDoc.vendorId,
      idempotencyKey: `${idempotencyKey}_credit_res`,
      description: `Reserved payout balance for withdrawal #${withdrawalDoc.withdrawalNumber || withdrawalDoc._id}`,
    },
  ];

  return postJournal({
    journalId,
    sourceEvent: "withdrawal_reserved",
    sourceEventId: withdrawalDoc._id,
    idempotencyKey,
    currency,
    entries,
    session,
    actorId,
    metadata: {
      withdrawalId: String(withdrawalDoc._id),
      withdrawalNumber: String(withdrawalDoc.withdrawalNumber || ""),
      vendorId: String(withdrawalDoc.vendorId),
    },
  });
};

/**
 * Vendor Withdrawal Rejection / Release Lifecycle Posting:
 * Restores reserved payout funds back to available balance when withdrawal request is rejected or cancelled.
 */
const postWithdrawalReleaseJournal = async (
  withdrawalDoc,
  { session = null, actorId = null, reason = "Withdrawal rejected" } = {}
) => {
  if (!withdrawalDoc) return null;

  const amountNum = Number(withdrawalDoc.amount?.toString() || 0);
  if (amountNum <= 0) return null;

  const currency = normalizeCurrency(withdrawalDoc.currency || "INR");
  const journalId = `JRN-WTH-REL-${withdrawalDoc.withdrawalNumber || withdrawalDoc._id}`;
  const idempotencyKey = `wth_rel_${withdrawalDoc._id}`;

  const entries = [
    {
      entryType: FINANCIAL_ENTRY_TYPES.WITHDRAWAL_RELEASED,
      direction: FINANCIAL_ENTRY_DIRECTIONS.DEBIT,
      accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
      accountCode: LEDGER_ACCOUNTS.VENDOR_RESERVED_PAYOUT,
      accountReference: String(withdrawalDoc.vendorId),
      amount: fromMinorUnits(toMinorUnits(amountNum)),
      currency,
      vendorId: withdrawalDoc.vendorId,
      idempotencyKey: `${idempotencyKey}_debit_res`,
      description: `Released reserved funds for rejected withdrawal #${withdrawalDoc.withdrawalNumber || withdrawalDoc._id}`,
    },
    {
      entryType: FINANCIAL_ENTRY_TYPES.WITHDRAWAL_RELEASED,
      direction: FINANCIAL_ENTRY_DIRECTIONS.CREDIT,
      accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
      accountCode: LEDGER_ACCOUNTS.VENDOR_AVAILABLE_EARNINGS,
      accountReference: String(withdrawalDoc.vendorId),
      amount: fromMinorUnits(toMinorUnits(amountNum)),
      currency,
      vendorId: withdrawalDoc.vendorId,
      idempotencyKey: `${idempotencyKey}_credit_avail`,
      description: `Restored available funds from rejected withdrawal #${withdrawalDoc.withdrawalNumber || withdrawalDoc._id}`,
    },
  ];

  return postJournal({
    journalId,
    sourceEvent: "withdrawal_released",
    sourceEventId: withdrawalDoc._id,
    idempotencyKey,
    currency,
    entries,
    session,
    actorId,
    metadata: {
      withdrawalId: String(withdrawalDoc._id),
      withdrawalNumber: String(withdrawalDoc.withdrawalNumber || ""),
      vendorId: String(withdrawalDoc.vendorId),
      reason: String(reason || "Withdrawal release"),
    },
  });
};

/**
 * Posts an immutable, balanced reconciliation adjustment journal.
 * Strictly adheres to double-entry accounting rules (Debit = Credit).
 */
const postReconciliationAdjustmentJournal = async ({
  vendorId,
  amount,
  direction, // 'debit' | 'credit'
  accountCode = LEDGER_ACCOUNTS.VENDOR_AVAILABLE_EARNINGS,
  contraAccountCode = LEDGER_ACCOUNTS.FINANCIAL_ADJUSTMENT,
  reason,
  actorId = null,
  currency = "INR",
  idempotencyKey = null,
  session = null,
} = {}) => {
  if (!mongoose.isValidObjectId(vendorId)) {
    throw new AppError("Invalid vendor ID", 400, "INVALID_VENDOR_ID");
  }

  if (!reason || String(reason).trim().length < 10) {
    throw new AppError(
      "A mandatory justification reason (min 10 characters) is required for financial adjustments",
      400,
      "ADJUSTMENT_REASON_REQUIRED"
    );
  }

  const normalizedDir = String(direction).toLowerCase();
  if (
    normalizedDir !== FINANCIAL_ENTRY_DIRECTIONS.DEBIT &&
    normalizedDir !== FINANCIAL_ENTRY_DIRECTIONS.CREDIT
  ) {
    throw new AppError(
      "Adjustment direction must be either 'debit' or 'credit'",
      400,
      "INVALID_ENTRY_DIRECTION"
    );
  }

  const amountMinor = toMinorUnits(amount);
  if (amountMinor <= 0) {
    throw new AppError(
      "Adjustment amount must be greater than zero",
      400,
      "INVALID_ADJUSTMENT_AMOUNT"
    );
  }

  const normCurrency = normalizeCurrency(currency);
  const targetIdempotency = idempotencyKey || `idem_adj_${vendorId}_${Date.now()}`;
  const targetJournalId = idempotencyKey
    ? `JRN-ADJ-RECON-${String(idempotencyKey).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32)}`
    : `JRN-ADJ-RECON-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  // If vendor balance is credited: vendor account is credited, platform adjustment clearing is debited
  // If vendor balance is debited: vendor account is debited, platform adjustment clearing is credited
  const vendorEntryDirection = normalizedDir;
  const contraEntryDirection =
    normalizedDir === FINANCIAL_ENTRY_DIRECTIONS.CREDIT
      ? FINANCIAL_ENTRY_DIRECTIONS.DEBIT
      : FINANCIAL_ENTRY_DIRECTIONS.CREDIT;

  const entries = [
    {
      entryType: FINANCIAL_ENTRY_TYPES.ADJUSTMENT,
      direction: vendorEntryDirection,
      accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
      accountCode,
      accountReference: String(vendorId),
      amount: fromMinorUnits(amountMinor),
      currency: normCurrency,
      vendorId,
      idempotencyKey: targetIdempotency,
      description: `Reconciliation adjustment for vendor: ${reason.trim()}`,
      metadata: { actorId, reason: reason.trim() },
    },
    {
      entryType: FINANCIAL_ENTRY_TYPES.ADJUSTMENT,
      direction: contraEntryDirection,
      accountType: FINANCIAL_ACCOUNT_TYPES.CLEARING,
      accountCode: contraAccountCode,
      accountReference: "PLATFORM_RECONCILIATION",
      amount: fromMinorUnits(amountMinor),
      currency: normCurrency,
      idempotencyKey: `${targetIdempotency}_contra`,
      description: `Contra reconciliation adjustment: ${reason.trim()}`,
      metadata: { actorId, vendorId, reason: reason.trim() },
    },
  ];

  return postJournal({
    journalId: targetJournalId,
    sourceEvent: "reconciliation_adjustment",
    sourceEventId: vendorId,
    idempotencyKey: targetIdempotency,
    currency: normCurrency,
    entries,
    session,
    actorId,
    metadata: {
      reason: reason.trim(),
      accountCode,
      contraAccountCode,
    },
  });
};

/**
 * Refund & Commission Reversal Lifecycle Posting:
 * Records proportional commission and vendor earning reversal using VW-02 snapshot.
 */
const postRefundReversalJournal = async (
  refundDoc,
  {
    orderDoc = null,
    vendorId = null,
    isSettled = false,
    session = null,
    actorId = null,
    reversalCalc = null,
  } = {}
) => {
  if (!refundDoc) return null;

  const refundAmountNum = Number(refundDoc.amount?.toString() || 0);
  if (refundAmountNum <= 0) return null;

  const currency = normalizeCurrency(refundDoc.currency || "INR");
  const refundMinor = toMinorUnits(refundAmountNum);

  let commMinor = 0;
  let vendorDebitMinor = 0;

  if (reversalCalc) {
    commMinor = toMinorUnits(reversalCalc.reversedCommissionAmount);
    vendorDebitMinor = toMinorUnits(reversalCalc.vendorNetAdjustment);
  } else {
    let rateNum = 0.10;
    if (orderDoc && Array.isArray(orderDoc.items) && orderDoc.items.length > 0) {
      const matchedItem = (orderDoc.items || []).find((it) =>
        it.vendorId && vendorId && it.vendorId.toString() === vendorId.toString()
      ) || orderDoc.items[0];
      if (matchedItem?.commissionSnapshot?.commissionRate) {
        rateNum = Number(matchedItem.commissionSnapshot.commissionRate.toString());
      } else if (matchedItem?.commissionRate) {
        rateNum = Number(matchedItem.commissionRate.toString());
      }
    }
    commMinor = Math.round(refundMinor * rateNum);
    vendorDebitMinor = Math.max(0, refundMinor - commMinor);
  }

  const targetAccount = isSettled
    ? LEDGER_ACCOUNTS.VENDOR_AVAILABLE_EARNINGS
    : LEDGER_ACCOUNTS.VENDOR_PENDING_EARNINGS;

  const journalId = `JRN-REF-${refundDoc._id}`;
  const idempotencyKey = `ref_rev_${refundDoc._id}`;

  const entries = [
    // Debits
    {
      entryType: FINANCIAL_ENTRY_TYPES.COMMISSION_REVERSAL,
      direction: FINANCIAL_ENTRY_DIRECTIONS.DEBIT,
      accountType: FINANCIAL_ACCOUNT_TYPES.PLATFORM,
      accountCode: LEDGER_ACCOUNTS.COMMISSION_REVERSAL,
      accountReference: "BUYBOX_COMMISSION_REVENUE",
      amount: fromMinorUnits(commMinor),
      currency,
      refundId: refundDoc._id,
      orderId: refundDoc.orderId || (orderDoc ? orderDoc._id : null),
      vendorId,
      idempotencyKey: `${idempotencyKey}_comm_rev`,
      description: `Commission reversal for refund #${refundDoc._id}`,
    },
    {
      entryType: FINANCIAL_ENTRY_TYPES.REFUND_REVERSAL,
      direction: FINANCIAL_ENTRY_DIRECTIONS.DEBIT,
      accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
      accountCode: targetAccount,
      accountReference: String(vendorId),
      amount: fromMinorUnits(vendorDebitMinor),
      currency,
      refundId: refundDoc._id,
      orderId: refundDoc.orderId || (orderDoc ? orderDoc._id : null),
      vendorId,
      idempotencyKey: `${idempotencyKey}_vendor_debit`,
      description: `Vendor earning deduction for refund #${refundDoc._id}`,
    },
    // Credit
    {
      entryType: FINANCIAL_ENTRY_TYPES.REFUND,
      direction: FINANCIAL_ENTRY_DIRECTIONS.CREDIT,
      accountType: FINANCIAL_ACCOUNT_TYPES.CLEARING,
      accountCode: LEDGER_ACCOUNTS.REFUND_CLEARING,
      accountReference: "CUSTOMER_REFUND_GATEWAY",
      amount: fromMinorUnits(refundMinor),
      currency,
      refundId: refundDoc._id,
      orderId: refundDoc.orderId || (orderDoc ? orderDoc._id : null),
      vendorId,
      idempotencyKey: `${idempotencyKey}_refund_credit`,
      description: `Customer refund outflow for refund #${refundDoc._id}`,
    },
  ];

  return postJournal({
    journalId,
    sourceEvent: "refund_processed",
    sourceEventId: refundDoc._id,
    idempotencyKey,
    currency,
    entries,
    session,
    actorId,
    metadata: {
      refundId: String(refundDoc._id),
      orderId: String(refundDoc.orderId || ""),
      vendorId: String(vendorId || ""),
    },
  });
};

// Backward-compatible individual entry functions
const createLedgerEntry = async ({
  journalId,
  entryType,
  direction,
  accountType,
  accountCode = null,
  accountReference = null,
  amount,
  currency,
  orderId = null,
  paymentId = null,
  refundId = null,
  settlementId = null,
  payoutId = null,
  vendorId = null,
  idempotencyKey = null,
  description = null,
  source = "system",
  metadata = {},
}) => {
  if (!journalId) {
    throw new AppError("Journal ID is required", 422, "JOURNAL_ID_REQUIRED");
  }

  if (!Object.values(FINANCIAL_ENTRY_TYPES).includes(entryType)) {
    throw new AppError("Invalid financial entry type", 422, "INVALID_FINANCIAL_ENTRY_TYPE");
  }

  if (!Object.values(FINANCIAL_ENTRY_DIRECTIONS).includes(direction)) {
    throw new AppError("Invalid financial entry direction", 422, "INVALID_FINANCIAL_ENTRY_DIRECTION");
  }

  if (!Object.values(FINANCIAL_ACCOUNT_TYPES).includes(accountType)) {
    throw new AppError("Invalid financial account type", 422, "INVALID_FINANCIAL_ACCOUNT_TYPE");
  }

  if (idempotencyKey) {
    const existing = await financialLedgerRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      return existing;
    }
  }

  if (vendorId && !mongoose.isValidObjectId(vendorId)) {
    throw new AppError("Invalid vendor ID", 400, "INVALID_VENDOR_ID");
  }

  const entryData = {
    journalId: String(journalId),
    entryType,
    direction,
    accountType,
    accountCode: accountCode || null,
    accountReference,
    amount: toDecimal128(amount),
    currency: normalizeCurrency(currency),
    orderId,
    paymentId,
    refundId,
    settlementId,
    payoutId,
    vendorId,
    idempotencyKey,
    description,
    source,
    metadata,
  };

  try {
    return await financialLedgerRepository.create(entryData);
  } catch (error) {
    if (error?.code === 11000 && idempotencyKey) {
      const existing = await financialLedgerRepository.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return existing;
      }
    }
    throw error;
  }
};

const createLedgerEntries = async (entries, options = {}) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new AppError("At least one ledger entry is required", 422, "LEDGER_ENTRIES_REQUIRED");
  }

  const session = options.session || null;

  const preparedEntries = entries.map((entry) => ({
    ...entry,
    amount: toDecimal128(entry.amount),
    currency: normalizeCurrency(entry.currency),
  }));

  return financialLedgerRepository.createMany(preparedEntries, { session });
};

const getLedgerEntryById = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid ledger entry ID", 400, "INVALID_LEDGER_ENTRY_ID");
  }

  const entry = await financialLedgerRepository.findById(id);
  if (!entry) {
    throw new AppError("Financial ledger entry not found", 404, "LEDGER_ENTRY_NOT_FOUND");
  }

  return entry;
};

const getEntriesByJournalId = async (journalId) => {
  return financialLedgerRepository.findByJournalId(journalId);
};

const getEntriesByOrderId = async (orderId) => {
  if (!mongoose.isValidObjectId(orderId)) {
    throw new AppError("Invalid order ID", 400, "INVALID_ORDER_ID");
  }

  return financialLedgerRepository.findByOrderId(orderId);
};

const getEntriesByVendorId = async (vendorId) => {
  if (!mongoose.isValidObjectId(vendorId)) {
    throw new AppError("Invalid vendor ID", 400, "INVALID_VENDOR_ID");
  }

  return financialLedgerRepository.findByVendorId(vendorId);
};

module.exports = {
  toMinorUnits,
  fromMinorUnits,
  toDecimal128,
  normalizeCurrency,
  postJournal,
  reverseJournal,
  getVendorBalancesFromLedger,
  syncVendorWalletBalances,
  postOrderPaymentCaptureJournal,
  postSettlementMaturationJournal,
  postPayoutReservationJournal,
  postPayoutDisbursementJournal,
  postPayoutReleaseJournal,
  postWithdrawalReservationJournal,
  postWithdrawalReleaseJournal,
  postReconciliationAdjustmentJournal,
  postRefundReversalJournal,
  createLedgerEntry,
  createLedgerEntries,
  getLedgerEntryById,
  getEntriesByJournalId,
  getEntriesByOrderId,
  getEntriesByVendorId,
};
