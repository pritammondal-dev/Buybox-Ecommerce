const {
  calculateBusinessDaysFrom,
  getReturnSlaStatus,
  createReturnRequest,
  inspectReturnRequest,
  receiveReturnAndRestock,
  processReturnRefund,
} = require("../src/services/return-request.service");
const financialLedgerService = require("../src/services/financial-ledger.service");
const mongoose = require("mongoose");

// Mock dependencies
jest.mock("../src/models/Order");
jest.mock("../src/models/Customer");
jest.mock("../src/models/Product");
jest.mock("../src/models/ProductVariant");
jest.mock("../src/models/Shipment");
jest.mock("../src/models/ReturnRequest");
jest.mock("../src/models/Refund");
jest.mock("../src/models/Warehouse");
jest.mock("../src/models/Inventory");
jest.mock("../src/models/AuditLog", () => ({
  create: jest.fn().mockResolvedValue({}),
}));
jest.mock("../src/models/VendorWallet", () => ({
  findOneAndUpdate: jest.fn().mockResolvedValue({}),
}));
jest.mock("../src/services/storefront-settings.service", () => ({
  isFeatureEnabled: jest.fn().mockResolvedValue(true),
}));
jest.mock("../src/services/customer-notification.service", () => ({
  createCustomerNotification: jest.fn().mockResolvedValue({}),
}));
jest.mock("../src/repositories/financial-ledger.repository", () => ({
  findByJournalId: jest.fn().mockResolvedValue([]),
  findByIdempotencyKey: jest.fn().mockResolvedValue(null),
  createMany: jest.fn().mockImplementation((entries) => Promise.resolve(entries)),
  findVendorAllEntries: jest.fn().mockResolvedValue([]),
}));
jest.mock("../src/models/FinancialLedgerEntry", () => ({
  findOne: jest.fn().mockReturnValue({
    session: jest.fn().mockResolvedValue(null),
  }),
  find: jest.fn().mockReturnValue({
    session: jest.fn().mockResolvedValue([]),
  }),
  aggregate: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockImplementation((entries) => Promise.resolve(entries)),
}));

const mockSession = {
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  abortTransaction: jest.fn(),
  endSession: jest.fn(),
  withTransaction: jest.fn().mockImplementation((fn) => fn()),
};
jest.spyOn(mongoose, "startSession").mockResolvedValue(mockSession);

const Order = require("../src/models/Order");
const Customer = require("../src/models/Customer");
const Product = require("../src/models/Product");
const Shipment = require("../src/models/Shipment");
const ReturnRequest = require("../src/models/ReturnRequest");
const Refund = require("../src/models/Refund");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");

describe("Phase Acceptance-C: Refund SLA Governance & Double-Entry Financial Reconciliation", () => {
  const customerId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const vendorId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("1. Business-Day and Configured Holiday Calculations", () => {
    test("skips weekends (Saturday & Sunday) correctly", () => {
      // Thursday, Nov 5, 2026
      const thursday = new Date("2026-11-05T10:00:00.000Z");
      const deadline = calculateBusinessDaysFrom(thursday, 3);
      // Day 1: Friday Nov 6
      // Sat Nov 7 & Sun Nov 8 skipped
      // Day 2: Monday Nov 9
      // Day 3: Tuesday Nov 10
      expect(deadline.getUTCDay()).toBe(2); // Tuesday
      expect(deadline.toISOString().split("T")[0]).toBe("2026-11-10");
    });

    test("skips configured statutory holidays as well as weekends", () => {
      // Thursday, Nov 5, 2026
      const thursday = new Date("2026-11-05T10:00:00.000Z");
      // Suppose Monday Nov 9 is a bank holiday
      const holidays = ["2026-11-09"];
      const deadline = calculateBusinessDaysFrom(thursday, 3, holidays);
      // Day 1: Friday Nov 6
      // Sat Nov 7 & Sun Nov 8 skipped
      // Mon Nov 9 holiday skipped
      // Day 2: Tuesday Nov 10
      // Day 3: Wednesday Nov 11
      expect(deadline.getUTCDay()).toBe(3); // Wednesday
      expect(deadline.toISOString().split("T")[0]).toBe("2026-11-11");
    });
  });

  describe("2. Authoritative SLA Stages & Decoupled Service Clocks", () => {
    test("application in logistics (requested / pickup_scheduled / picked_up) is never marked overdue", () => {
      const pastCreation = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      const retInLogistics = {
        type: "return",
        status: "picked_up",
        createdAt: pastCreation,
        refundTargetDeadline: null,
      };

      const sla = getReturnSlaStatus(retInLogistics);
      expect(sla.isEligibleForRefund).toBe(false);
      expect(sla.isOverdue).toBe(false);
      expect(sla.stage).toBe("logistics_in_progress");
      expect(sla.message).toContain("Doorstep reverse pickup and warehouse transit in progress");
    });

    test("authoritative 3-day refund processing SLA starts upon inspection approval", () => {
      const inspectionTime = new Date("2026-11-05T10:00:00.000Z");
      const deadline = calculateBusinessDaysFrom(inspectionTime, 3);

      const retInspected = {
        type: "return",
        status: "inspected",
        refundEligibleAt: inspectionTime,
        refundTargetDeadline: deadline,
      };

      // Checked 1 day after inspection: within SLA
      const withinSlaCheck = getReturnSlaStatus(retInspected, {
        referenceTime: new Date("2026-11-06T10:00:00.000Z"),
      });
      expect(withinSlaCheck.isEligibleForRefund).toBe(true);
      expect(withinSlaCheck.isOverdue).toBe(false);
      expect(withinSlaCheck.stage).toBe("refund_processing_active");

      // Checked 6 days after inspection (after Tuesday Nov 10): overdue
      const overdueCheck = getReturnSlaStatus(retInspected, {
        referenceTime: new Date("2026-11-12T10:00:00.000Z"),
      });
      expect(overdueCheck.isEligibleForRefund).toBe(true);
      expect(overdueCheck.isOverdue).toBe(true);
      expect(overdueCheck.stage).toBe("refund_overdue");
      expect(overdueCheck.message).toContain("Authoritative 3-business-day refund processing SLA exceeded");
    });

    test("terminal returns (refunded / cancelled / rejected) are marked completed", () => {
      const retRefunded = {
        type: "return",
        status: "refunded",
        refundTargetDeadline: new Date(),
      };
      const sla = getReturnSlaStatus(retRefunded);
      expect(sla.stage).toBe("completed");
      expect(sla.isOverdue).toBe(false);
    });
  });

  describe("3. Double-Entry Refund Journal & Financial Balance Invariants", () => {
    test("creates balanced double-entry journal (Debits === Credits) with zero variance", async () => {
      const refundDoc = {
        _id: new mongoose.Types.ObjectId(),
        orderId,
        amount: mongoose.Types.Decimal128.fromString("1000.00"),
        currency: "INR",
      };

      const orderDoc = {
        _id: orderId,
        items: [
          {
            vendorId,
            commissionSnapshot: { commissionRate: "0.1000" },
          },
        ],
      };

      const journal = await financialLedgerService.postRefundReversalJournal(refundDoc, {
        orderDoc,
        vendorId,
        isSettled: false,
        actorId: userId,
        session: mockSession,
      });

      expect(journal).toBeDefined();
      expect(Array.isArray(journal)).toBe(true);
      expect(journal.length).toBe(3);

      const debitEntries = journal.filter((e) => e.direction === "debit");
      const creditEntries = journal.filter((e) => e.direction === "credit");

      expect(debitEntries.length).toBe(2);
      expect(creditEntries.length).toBe(1);

      const totalDebits = debitEntries.reduce((sum, e) => sum + Math.round(Number(e.amount.toString()) * 100), 0);
      const totalCredits = creditEntries.reduce((sum, e) => sum + Math.round(Number(e.amount.toString()) * 100), 0);

      // Invariant: Total Debits === Total Credits
      expect(totalDebits).toBe(100000); // 100000 paise (₹1,000.00)
      expect(totalCredits).toBe(100000); // 100000 paise (₹1,000.00)
      expect(totalDebits - totalCredits).toBe(0); // Zero variance

      // Account verification
      const commEntry = debitEntries.find((e) => e.entryType === "commission_reversal");
      const vendorEntry = debitEntries.find((e) => e.entryType === "refund_reversal");
      const refundClearing = creditEntries[0];

      expect(Number(commEntry.amount.toString())).toBe(100.00);
      expect(Number(vendorEntry.amount.toString())).toBe(900.00);
      expect(Number(refundClearing.amount.toString())).toBe(1000.00);
    });

    test("accurately calculates partial refund with non-round commission percentage", async () => {
      const refundDoc = {
        _id: new mongoose.Types.ObjectId(),
        orderId,
        amount: mongoose.Types.Decimal128.fromString("349.50"),
        currency: "INR",
      };

      const orderDoc = {
        _id: orderId,
        items: [
          {
            vendorId,
            commissionRate: "0.1500", // 15%
          },
        ],
      };

      const journal = await financialLedgerService.postRefundReversalJournal(refundDoc, {
        orderDoc,
        vendorId,
        isSettled: true, // Settled -> VENDOR_AVAILABLE_EARNINGS
        actorId: userId,
        session: mockSession,
      });

      const debitEntries = journal.filter((e) => e.direction === "debit");
      const creditEntries = journal.filter((e) => e.direction === "credit");

      const totalDebits = debitEntries.reduce((sum, e) => sum + Math.round(Number(e.amount.toString()) * 100), 0);
      const totalCredits = creditEntries.reduce((sum, e) => sum + Math.round(Number(e.amount.toString()) * 100), 0);

      expect(totalDebits).toBe(34950); // 34,950 paise (₹349.50)
      expect(totalCredits).toBe(34950);
      expect(totalDebits - totalCredits).toBe(0);

      const vendorEntry = debitEntries.find((e) => e.entryType === "refund_reversal");
      expect(vendorEntry.accountCode).toBe("vendor_available_earnings");
    });
  });

  describe("4. COD Refund Workflow & Reversal Posting", () => {
    test("records COD refund settlement and triggers double-entry ledger reversal", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-COD-001",
        paymentMethod: "cod",
        currency: "INR",
        items: [{ vendorId, commissionRate: "0.1000" }],
        save: jest.fn().mockResolvedValue(true),
      };

      const mockReturn = {
        _id: new mongoose.Types.ObjectId(),
        orderId,
        vendorId,
        returnNumber: "RET-COD-001",
        status: "inspected",
        refundMethod: "bank_transfer",
        refundAmount: mongoose.Types.Decimal128.fromString("500.00"),
        bankDetails: {
          accountNumberMasked: "XXXXXXXX9876",
          ifscCode: "HDFC0001234",
        },
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
      };

      ReturnRequest.findById.mockResolvedValue(mockReturn);
      Order.findById.mockResolvedValue(mockOrder);

      const postJournalSpy = jest.spyOn(financialLedgerService, "postRefundReversalJournal");

      const res = await processReturnRefund({
        userId,
        returnId: mockReturn._id.toString(),
        notes: "Approved COD return NEFT settlement",
        bankReference: "UTR-TEST-998877",
        isAdmin: true,
      });

      expect(res.status).toBe("refunded");
      expect(mockOrder.paymentStatus).toBe("refunded");
      expect(postJournalSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: mockReturn._id,
          orderId,
          currency: "INR",
        }),
        expect.objectContaining({
          orderDoc: mockOrder,
          vendorId,
          actorId: userId,
        })
      );
    });
  });
});
