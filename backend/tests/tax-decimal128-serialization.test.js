const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../src/app");
const { serializeDecimals, isDecimal128, isExtendedJsonDecimal } = require("../src/utils/decimal.util");
const taxRepository = require("../src/repositories/tax.repository");
const { generateAccessToken } = require("../src/services/token.service");
const TaxRule = require("../src/models/TaxRule");

jest.mock("../src/repositories/tax.repository");
jest.mock("../src/services/notification.service");
jest.mock("../src/services/notification-outbox.service");
jest.mock("../src/services/notification");

describe("Tax Rules Decimal128 Serialization & API Boundary Regression Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("1. serializeDecimals Utility Function", () => {
    it("should serialize Decimal128 tax rates correctly to canonical string", () => {
      const decRate = mongoose.Types.Decimal128.fromString("18.00");
      expect(isDecimal128(decRate)).toBe(true);
      const serialized = serializeDecimals(decRate);
      expect(serialized).toBe("18.00");
      expect(typeof serialized).toBe("string");
    });

    it("should serialize Decimal128 monetary thresholds correctly without float drift", () => {
      const threshold = mongoose.Types.Decimal128.fromString("1000.50");
      const serialized = serializeDecimals(threshold);
      expect(serialized).toBe("1000.50");
    });

    it("should serialize zero values (0.00, 0) correctly and preserve them", () => {
      const zeroDecimal = mongoose.Types.Decimal128.fromString("0.00");
      expect(serializeDecimals(zeroDecimal)).toBe("0.00");

      const singleZero = mongoose.Types.Decimal128.fromString("0");
      expect(serializeDecimals(singleZero)).toBe("0");

      expect(serializeDecimals(0)).toBe(0);
      expect(serializeDecimals("0")).toBe("0");
    });

    it("should cleanly handle missing or null optional decimal values", () => {
      expect(serializeDecimals(null)).toBeNull();
      expect(serializeDecimals(undefined)).toBeUndefined();

      const objWithNulls = {
        rate: mongoose.Types.Decimal128.fromString("5.00"),
        fixedAmount: null,
        minTaxableAmount: undefined,
      };
      const res = serializeDecimals(objWithNulls);
      expect(res.rate).toBe("5.00");
      expect(res.fixedAmount).toBeNull();
      expect(res.minTaxableAmount).toBeUndefined();
    });

    it("should normalize Extended JSON {$numberDecimal: '...'} objects safely", () => {
      const extendedObj = { $numberDecimal: "18.00" };
      expect(isExtendedJsonDecimal(extendedObj)).toBe(true);
      expect(serializeDecimals(extendedObj)).toBe("18.00");
    });

    it("should recursively serialize nested decimal values inside complex structures", () => {
      const complex = {
        ruleId: "rule-1",
        name: "Standard GST",
        rate: mongoose.Types.Decimal128.fromString("18.00"),
        thresholds: {
          minOrderAmount: mongoose.Types.Decimal128.fromString("500.00"),
          brackets: [
            {
              limit: mongoose.Types.Decimal128.fromString("10000.00"),
              rate: mongoose.Types.Decimal128.fromString("12.00"),
            },
          ],
        },
      };

      const result = serializeDecimals(complex);
      expect(result.rate).toBe("18.00");
      expect(result.thresholds.minOrderAmount).toBe("500.00");
      expect(result.thresholds.brackets[0].limit).toBe("10000.00");
      expect(result.thresholds.brackets[0].rate).toBe("12.00");
      // Must not leak BSON object
      expect(result.rate).not.toHaveProperty("$numberDecimal");
    });
  });

  describe("2. Tax Rule API Endpoints Serialization Boundary", () => {
    const adminToken = generateAccessToken({
      sub: new mongoose.Types.ObjectId().toString(),
      role: "admin",
    });

    it("POST /api/v1/tax/rules: created tax rule returns string decimal rate, not BSON object", async () => {
      taxRepository.findConflictingRule.mockResolvedValue(null);
      taxRepository.create.mockResolvedValue({
        _id: "rule-new-123",
        name: "Interstate IGST 18%",
        country: "IN",
        state: null,
        taxCategory: "standard",
        rate: mongoose.Types.Decimal128.fromString("18.00"),
        priority: 0,
        isShippingTaxable: true,
        isActive: true,
      });

      const res = await request(app)
        .post("/api/v1/tax/rules")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Interstate IGST 18%",
          country: "IN",
          taxCategory: "standard",
          rate: 18,
          priority: 0,
          isShippingTaxable: true,
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rate).toBe("18.00");
      expect(typeof res.body.data.rate).toBe("string");
      expect(res.body.data.rate).not.toHaveProperty("$numberDecimal");
    });

    it("GET /api/v1/tax/rules: list of tax rules returns canonical decimal strings", async () => {
      taxRepository.findMany.mockResolvedValue([
        {
          _id: "rule-1",
          name: "Standard GST",
          country: "IN",
          rate: mongoose.Types.Decimal128.fromString("18.00"),
          priority: 0,
        },
        {
          _id: "rule-2",
          name: "Zero Rated Export",
          country: "IN",
          rate: mongoose.Types.Decimal128.fromString("0.00"),
          priority: 1,
        },
      ]);

      const res = await request(app)
        .get("/api/v1/tax/rules")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].rate).toBe("18.00");
      expect(res.body.data[1].rate).toBe("0.00");
      expect(res.body.data[0].rate).not.toHaveProperty("$numberDecimal");
    });

    it("GET /api/v1/tax/rules/:id: get rule by ID serializes rate cleanly", async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      taxRepository.findById.mockResolvedValue({
        _id: validId,
        name: "Reduced Rate 5%",
        country: "IN",
        state: "DL",
        taxCategory: "reduced",
        rate: mongoose.Types.Decimal128.fromString("5.00"),
        priority: 0,
      });

      const res = await request(app)
        .get(`/api/v1/tax/rules/${validId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rate).toBe("5.00");
      expect(typeof res.body.data.rate).toBe("string");
    });

    it("PUT /api/v1/tax/rules/:id: update rule serializes updated rate cleanly", async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      taxRepository.findById.mockResolvedValue({
        _id: validId,
        name: "Standard GST",
        country: "IN",
        taxCategory: "standard",
        rate: mongoose.Types.Decimal128.fromString("18.00"),
        isActive: true,
      });
      taxRepository.findConflictingRule.mockResolvedValue(null);
      taxRepository.updateById.mockResolvedValue({
        _id: validId,
        name: "Standard GST Updated",
        country: "IN",
        taxCategory: "standard",
        rate: mongoose.Types.Decimal128.fromString("12.00"),
        isActive: true,
      });

      const res = await request(app)
        .put(`/api/v1/tax/rules/${validId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Standard GST Updated",
          rate: 12,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rate).toBe("12.00");
      expect(typeof res.body.data.rate).toBe("string");
    });
  });
});
