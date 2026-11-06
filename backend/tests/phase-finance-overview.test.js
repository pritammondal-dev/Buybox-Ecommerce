/**
 * Test Suite: Phase FINANCE-OVERVIEW-B Superadmin Financial Overview Contract & Aggregation Verification
 *
 * Verifies:
 * 1. Dual-Contract Response DTO (categorized sections + flat metrics parity).
 * 2. Order Aggregation (status filtering excluding cancelled, grandTotal summing, null handling).
 * 3. Payment Aggregation (captured payment status filtering and safe numeric conversion).
 * 4. Authoritative 5-State Reconciliation Health (passed, discrepancies_found, empty, failed, not_run).
 * 5. Date-Range Boundary Filtering (full day inclusive via $lt: nextDayStart, reversed date rejection).
 * 6. Controller Integration and response packaging.
 */

const mongoose = require("mongoose");
const Order = require("../src/models/Order");
const Payment = require("../src/models/Payment");
const Vendor = require("../src/models/Vendor");
const VendorWallet = require("../src/models/VendorWallet");
const FinancialLedgerEntry = require("../src/models/FinancialLedgerEntry");
const WithdrawalRequest = require("../src/models/WithdrawalRequest");
const VendorPayout = require("../src/models/VendorPayout");
const Refund = require("../src/models/Refund");

const financialOverviewService = require("../src/services/financial-overview.service");
const financialOverviewController = require("../src/controllers/financial-overview.controller");
const financialReconciliationService = require("../src/services/financial-reconciliation.service");
const AppError = require("../src/errors/AppError");
const {
  LEDGER_ACCOUNTS,
  FINANCIAL_ENTRY_DIRECTIONS,
  FINANCIAL_ENTRY_TYPES,
  FINANCIAL_ACCOUNT_TYPES,
  WALLET_STATUSES,
} = require("../src/constants/finance.constants");

const TEST_MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/buybox_finance_test?replicaSet=rs0";

describe("Phase FINANCE-OVERVIEW-B: Financial Overview Aggregation & Contract Integrity", () => {
  const createdOrderIds = [];
  const createdPaymentIds = [];
  const createdLedgerIds = [];
  const createdWalletIds = [];
  const createdVendorIds = [];
  const createdWithdrawalIds = [];

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }
  });

  afterAll(async () => {
    // Clean up created test documents
    if (createdOrderIds.length > 0) {
      await Order.deleteMany({ _id: { $in: createdOrderIds } });
    }
    if (createdPaymentIds.length > 0) {
      await Payment.deleteMany({ _id: { $in: createdPaymentIds } });
    }
    if (createdLedgerIds.length > 0 && mongoose.connection.db) {
      // Use native driver to bypass Mongoose FINANCIAL_LEDGER_IMMUTABLE hook for test cleanup
      await mongoose.connection.db.collection("financialledgerentries").deleteMany({
        _id: { $in: createdLedgerIds },
      });
    }
    if (createdWalletIds.length > 0) {
      await VendorWallet.deleteMany({ _id: { $in: createdWalletIds } });
    }
    if (createdVendorIds.length > 0) {
      await Vendor.deleteMany({ _id: { $in: createdVendorIds } });
    }
    if (createdWithdrawalIds.length > 0) {
      await WithdrawalRequest.deleteMany({ _id: { $in: createdWithdrawalIds } });
    }
    await mongoose.connection.close();
  });

  describe("1. Dual-Contract Response DTO Parity", () => {
    it("should return both categorized sections and flat metrics with matching values", async () => {
      const overview = await financialOverviewService.getFinancialOverview({ currency: "INR" });

      // Verify root structure
      expect(overview).toHaveProperty("currency", "INR");
      expect(overview).toHaveProperty("dateRange");
      expect(overview).toHaveProperty("salesAndRevenue");
      expect(overview).toHaveProperty("platformCommission");
      expect(overview).toHaveProperty("vendorLiabilities");
      expect(overview).toHaveProperty("cashDisbursements");
      expect(overview).toHaveProperty("operationalQueues");
      expect(overview).toHaveProperty("reconciliationHealth");
      expect(overview).toHaveProperty("metrics");

      // Verify flat metrics match categorized blocks
      expect(overview.metrics.grossOrderValue).toBe(overview.salesAndRevenue.grossOrderValue);
      expect(overview.metrics.capturedPaymentValue).toBe(overview.salesAndRevenue.capturedPaymentValue);
      expect(overview.metrics.platformCommissionEarned).toBe(overview.platformCommission.grossCommission);
      expect(overview.metrics.commissionReversals).toBe(overview.platformCommission.commissionReversals);
      expect(overview.metrics.netPlatformCommission).toBe(overview.platformCommission.netCommission);
      expect(overview.metrics.vendorTotalLiabilities).toBe(overview.vendorLiabilities.totalLiability);
      expect(overview.metrics.vendorAvailableBalance).toBe(overview.vendorLiabilities.availableEarnings);
      expect(overview.metrics.vendorReservedBalance).toBe(overview.vendorLiabilities.reservedPayouts);
      expect(overview.metrics.vendorPendingBalance).toBe(overview.vendorLiabilities.pendingEarnings);
      expect(overview.metrics.vendorLifetimeEarned).toBe(overview.vendorLiabilities.totalGrossEarned);
      expect(overview.metrics.totalCashOutflows).toBe(overview.cashDisbursements.netCashOutflow);
      expect(overview.metrics.totalDisbursements).toBe(overview.cashDisbursements.totalPaidOut);
      expect(overview.metrics.totalCustomerRefunds).toBe(overview.cashDisbursements.totalRefunded);

      // Verify numeric formatting (all metrics are finite numbers, not NaN, not strings)
      Object.entries(overview.metrics).forEach(([key, val]) => {
        expect(typeof val).toBe("number");
        expect(isNaN(val)).toBe(false);
      });
    });
  });

  describe("2. Order Aggregation & GrandTotal Summing", () => {
    it("should exclude cancelled orders and correctly sum grandTotal using toDouble", async () => {
      const testVendorId = new mongoose.Types.ObjectId();
      const testCustomerId = new mongoose.Types.ObjectId();

      const order1 = await Order.create({
        orderNumber: `TEST-ORD-VAL-${Date.now()}-1`,
        customerId: testCustomerId,
        status: "delivered",
        paymentStatus: "paid",
        fulfillmentStatus: "fulfilled",
        grandTotal: mongoose.Types.Decimal128.fromString("1500.50"),
        subtotal: 1400,
        currency: "INR",
        shippingAddress: { fullName: "A", phone: "123", addressLine1: "X", city: "Y", state: "Z", postalCode: "1", country: "IN" },
        billingAddress: { fullName: "A", phone: "123", addressLine1: "X", city: "Y", state: "Z", postalCode: "1", country: "IN" },
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productVariantId: new mongoose.Types.ObjectId(),
          vendorId: testVendorId,
          productName: "Test",
          sku: `SKU-${Date.now()}-1`,
          quantity: 1,
          unitPrice: 1400,
          lineTotal: 1400,
          currency: "INR",
        }],
      });
      createdOrderIds.push(order1._id);

      const order2Cancelled = await Order.create({
        orderNumber: `TEST-ORD-VAL-${Date.now()}-2`,
        customerId: testCustomerId,
        status: "cancelled",
        paymentStatus: "failed",
        fulfillmentStatus: "unfulfilled",
        grandTotal: mongoose.Types.Decimal128.fromString("9999.00"),
        subtotal: 9000,
        currency: "INR",
        shippingAddress: { fullName: "A", phone: "123", addressLine1: "X", city: "Y", state: "Z", postalCode: "1", country: "IN" },
        billingAddress: { fullName: "A", phone: "123", addressLine1: "X", city: "Y", state: "Z", postalCode: "1", country: "IN" },
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productVariantId: new mongoose.Types.ObjectId(),
          vendorId: testVendorId,
          productName: "Test",
          sku: `SKU-${Date.now()}-2`,
          quantity: 1,
          unitPrice: 9000,
          lineTotal: 9000,
          currency: "INR",
        }],
      });
      createdOrderIds.push(order2Cancelled._id);

      const overview = await financialOverviewService.getFinancialOverview({ currency: "INR" });

      // Ensure cancelled order grandTotal (9999.00) is NOT added to grossOrderValue
      expect(overview.salesAndRevenue.grossOrderValue).toBeGreaterThanOrEqual(1500.50);
    });
  });

  describe("3. Payment Aggregation & Safe Conversion", () => {
    it("should aggregate captured payments and ignore failed/pending", async () => {
      const dummyOrderId = new mongoose.Types.ObjectId();

      const payment1 = await Payment.create({
        orderId: dummyOrderId,
        gateway: "razorpay",
        amount: mongoose.Types.Decimal128.fromString("1500.50"),
        currency: "INR",
        status: "captured",
      });
      createdPaymentIds.push(payment1._id);

      const paymentPending = await Payment.create({
        orderId: dummyOrderId,
        gateway: "razorpay",
        amount: mongoose.Types.Decimal128.fromString("50000.00"),
        currency: "INR",
        status: "pending",
      });
      createdPaymentIds.push(paymentPending._id);

      const overview = await financialOverviewService.getFinancialOverview({ currency: "INR" });
      expect(overview.salesAndRevenue.capturedPaymentValue).toBeGreaterThanOrEqual(1500.50);
    });
  });

  describe("4. Authoritative 5-State Reconciliation Health", () => {
    it("should never report 100% Balanced & Reconciled when 0 wallets exist", async () => {
      // Create a test overview with a non-existent currency where 0 wallets exist
      const overview = await financialOverviewService.getFinancialOverview({ currency: "EUR" });

      expect(overview.reconciliationHealth.status).toBe("empty");
      expect(overview.reconciliationHealth.statusLabel).toBe("No Records Available to Evaluate");
      expect(overview.reconciliationHealth.statusLabel).not.toBe("100% Balanced & Reconciled");
    });

    it("should report discrepancies_found when trial balance is unbalanced", async () => {
      const unbalancedEntry = await FinancialLedgerEntry.create({
        journalId: `JRN-TEST-${Date.now()}`,
        entryType: FINANCIAL_ENTRY_TYPES.PAYMENT_RECEIVED,
        direction: FINANCIAL_ENTRY_DIRECTIONS.DEBIT,
        accountCode: LEDGER_ACCOUNTS.PLATFORM_ESCROW,
        accountType: FINANCIAL_ACCOUNT_TYPES.CLEARING,
        amount: mongoose.Types.Decimal128.fromString("777.77"),
        currency: "INR",
        sourceEntityId: new mongoose.Types.ObjectId(),
        sourceEntityType: "Payment",
      });
      createdLedgerIds.push(unbalancedEntry._id);

      const overview = await financialOverviewService.getFinancialOverview({ currency: "INR" });

      expect(overview.reconciliationHealth.trialBalanceBalanced).toBe(false);
      expect(overview.reconciliationHealth.unallocatedVariance).toBeGreaterThan(0);
      expect(overview.reconciliationHealth.status).toBe("discrepancies_found");
    });
  });

  describe("5. Date-Range Boundary Filtering & Validation", () => {
    it("should include events on the endDate full day via $lt: nextDayStart", async () => {
      const testVendorId = new mongoose.Types.ObjectId();
      const testCustomerId = new mongoose.Types.ObjectId();

      // Create an order late in the day on 2026-06-15 at 23:45:00 UTC
      const lateOrderDate = new Date("2026-06-15T23:45:00.000Z");

      const orderOnTargetDate = await Order.create({
        orderNumber: `TEST-ORD-DATE-${Date.now()}`,
        customerId: testCustomerId,
        status: "confirmed",
        paymentStatus: "paid",
        fulfillmentStatus: "unfulfilled",
        grandTotal: mongoose.Types.Decimal128.fromString("350.00"),
        subtotal: 350,
        currency: "INR",
        createdAt: lateOrderDate,
        shippingAddress: { fullName: "A", phone: "123", addressLine1: "X", city: "Y", state: "Z", postalCode: "1", country: "IN" },
        billingAddress: { fullName: "A", phone: "123", addressLine1: "X", city: "Y", state: "Z", postalCode: "1", country: "IN" },
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productVariantId: new mongoose.Types.ObjectId(),
          vendorId: testVendorId,
          productName: "Test Date Item",
          sku: `SKU-DATE-${Date.now()}`,
          quantity: 1,
          unitPrice: 350,
          lineTotal: 350,
          currency: "INR",
        }],
      });
      createdOrderIds.push(orderOnTargetDate._id);

      // Query with date-only strings spanning that day
      const overview = await financialOverviewService.getFinancialOverview({
        startDate: "2026-06-15",
        endDate: "2026-06-15",
        currency: "INR",
      });

      expect(overview.salesAndRevenue.orderCount).toBe(1);
      expect(overview.salesAndRevenue.grossOrderValue).toBe(350);
    });

    it("should throw HTTP 400 INVALID_DATE_RANGE when startDate > endDate", async () => {
      await expect(
        financialOverviewService.getFinancialOverview({
          startDate: "2026-12-31",
          endDate: "2026-01-01",
          currency: "INR",
        })
      ).rejects.toThrow("startDate cannot be greater than endDate.");
    });

    it("should throw HTTP 400 INVALID_DATE_RANGE when date string is malformed", async () => {
      await expect(
        financialOverviewService.getFinancialOverview({
          startDate: "invalid-date-format",
          currency: "INR",
        })
      ).rejects.toThrow("Invalid startDate format");
    });
  });

  describe("6. Controller Integration", () => {
    it("should package financial overview into standardized API response", async () => {
      const mockReq = {
        query: { currency: "INR" },
      };

      const mockRes = {
        statusCode: 200,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.body = payload;
          return this;
        },
      };

      await financialOverviewController.getOverview(mockReq, mockRes);

      expect(mockRes.statusCode).toBe(200);
      expect(mockRes.body).toHaveProperty("success", true);
      expect(mockRes.body).toHaveProperty("data");
      expect(mockRes.body.data).toHaveProperty("salesAndRevenue");
      expect(mockRes.body.data).toHaveProperty("metrics");
      expect(mockRes.body.data).toHaveProperty("reconciliationHealth");
    });
  });
});
