import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normalizeBulkValidationReport } from "../../src/utils/bulk-import-normalizer.js";

describe("Administrator Bulk Import Validation Response Normalizer Unit Tests", () => {
  test("1. Correctly normalizes authoritative backend validation response with 0 valid and 7 invalid rows", () => {
    const backendResponse = {
      totalRows: 7,
      validRowsCount: 0,
      validCount: 0,
      errorRowsCount: 7,
      errorCount: 7,
      newProductsCount: 0,
      newVariantsCount: 0,
      updateCount: 0,
      rows: [
        { rowNumber: 1, name: "Item 1", sku: "SKU-1", status: "ERROR", errors: ["Missing brand"] },
        { rowNumber: 2, name: "Item 2", sku: "SKU-2", status: "ERROR", errors: ["Missing warehouse"] },
      ],
      results: [
        { rowIndex: 1, isValid: false, status: "ERROR", errors: ["Missing brand"] },
        { rowIndex: 2, isValid: false, status: "ERROR", errors: ["Missing warehouse"] },
      ],
      errorDetails: [
        {
          rowNumber: 1,
          sku: "AURA-TV-55-4K",
          product: "AuraVue Horizon 4K QLED TV 55\"",
          field: "Warehouse Code",
          error: "Warehouse 'WH-MUM-01' not found or is currently inactive.",
          suggestedAction: "Verify warehouse code against active warehouses or leave blank",
        },
        {
          rowNumber: 1,
          sku: "AURA-TV-55-4K",
          product: "AuraVue Horizon 4K QLED TV 55\"",
          field: "Brand",
          error: "Brand 'AuraVue' not found or is currently inactive.",
          suggestedAction: "Select an existing marketplace brand or leave blank",
        },
        {
          rowNumber: 2,
          sku: "AURA-TV-65-4K",
          product: "AuraVue Horizon 4K QLED TV 65\"",
          field: "Warehouse Code",
          error: "Warehouse 'WH-MUM-01' not found or is currently inactive.",
          suggestedAction: "Verify warehouse code against active warehouses or leave blank",
        },
      ],
    };

    const normalized = normalizeBulkValidationReport(backendResponse);

    assert.equal(normalized.totalRows, 7, "Total rows must be 7");
    assert.equal(normalized.validCount, 0, "Valid count must be 0 (not fallback)");
    assert.equal(normalized.errorCount, 7, "Error count must be 7 (not 0)");
    assert.equal(normalized.detailedErrors.length, 3, "Detailed errors must preserve all 3 items");
    assert.equal(normalized.validRows.length, 0, "Valid rows array must be empty");

    // Check multiple errors on same row (Row 1 has 2 errors)
    const row1Errors = normalized.detailedErrors.filter((e) => e.rowNumber === 1);
    assert.equal(row1Errors.length, 2, "Row 1 must have 2 distinct errors preserved");
    assert.equal(row1Errors[0].field, "Warehouse Code");
    assert.equal(row1Errors[1].field, "Brand");
    assert.equal(row1Errors[0].suggestedAction, "Verify warehouse code against active warehouses or leave blank");
  });

  test("2. Accurately normalizes response when all rows are valid", () => {
    const allValidResponse = {
      totalRows: 5,
      validRowsCount: 5,
      validCount: 5,
      errorRowsCount: 0,
      errorCount: 0,
      newProductsCount: 3,
      newVariantsCount: 5,
      updateCount: 0,
      rows: [
        { rowNumber: 1, name: "Valid A", sku: "VA-1", status: "VALID", categoryId: "cat1" },
        { rowNumber: 2, name: "Valid B", sku: "VB-1", status: "VALID", categoryId: "cat1" },
      ],
      results: [
        { rowIndex: 1, isValid: true, status: "VALID", row: { name: "Valid A", sku: "VA-1" } },
        { rowIndex: 2, isValid: true, status: "VALID", row: { name: "Valid B", sku: "VB-1" } },
      ],
      errorDetails: [],
    };

    const normalized = normalizeBulkValidationReport(allValidResponse);

    assert.equal(normalized.totalRows, 5);
    assert.equal(normalized.validCount, 5);
    assert.equal(normalized.errorCount, 0);
    assert.equal(normalized.detailedErrors.length, 0);
    assert.equal(normalized.validRows.length, 2);
    assert.equal(normalized.newProductsCount, 3);
    assert.equal(normalized.newVariantsCount, 5);
  });

  test("3. Handles fallback when errorDetails is absent and errors are in results", () => {
    const resultsOnlyResponse = {
      totalRows: 2,
      validRowsCount: 1,
      errorRowsCount: 1,
      results: [
        {
          rowIndex: 1,
          isValid: true,
          status: "VALID",
          row: { name: "Item 1", sku: "SKU-1" },
          errors: [],
        },
        {
          rowIndex: 2,
          isValid: false,
          status: "ERROR",
          row: { name: "Item 2", sku: "SKU-2" },
          errors: ["Invalid price format", "Warehouse code missing"],
        },
      ],
    };

    const normalized = normalizeBulkValidationReport(resultsOnlyResponse);

    assert.equal(normalized.totalRows, 2);
    assert.equal(normalized.validCount, 1);
    assert.equal(normalized.errorCount, 1);
    assert.equal(normalized.detailedErrors.length, 2, "Must extract both errors for row 2");
    assert.equal(normalized.detailedErrors[0].rowNumber, 2);
    assert.equal(normalized.detailedErrors[0].message, "Invalid price format");
    assert.equal(normalized.detailedErrors[1].rowNumber, 2);
    assert.equal(normalized.detailedErrors[1].message, "Warehouse code missing");
    assert.equal(normalized.validRows.length, 1);
  });

  test("4. Safely handles missing, empty, or malformed input without throwing", () => {
    assert.equal(normalizeBulkValidationReport(null), null);
    assert.equal(normalizeBulkValidationReport(undefined), null);

    const emptyReport = normalizeBulkValidationReport({});
    assert.equal(emptyReport.totalRows, 0);
    assert.equal(emptyReport.validCount, 0);
    assert.equal(emptyReport.errorCount, 0);
    assert.equal(emptyReport.detailedErrors.length, 0);
    assert.equal(emptyReport.validRows.length, 0);

    const stringOnlyReport = normalizeBulkValidationReport({
      errors: ["Global catastrophic failure"],
    });
    assert.equal(stringOnlyReport.detailedErrors.length, 1);
    assert.equal(stringOnlyReport.detailedErrors[0].message, "Global catastrophic failure");
  });

  test("5. Handles legacy summary response shape", () => {
    const legacyResponse = {
      summary: {
        totalRows: 10,
        validRows: 8,
        invalidRows: 2,
        newProducts: 5,
        updated: 3,
      },
      validItems: [{ sku: "V1" }, { sku: "V2" }],
      errors: [
        { row: 3, message: "Duplicate SKU" },
        { row: 7, message: "Invalid category" },
      ],
    };

    const normalized = normalizeBulkValidationReport(legacyResponse);

    assert.equal(normalized.totalRows, 10);
    assert.equal(normalized.validCount, 8);
    assert.equal(normalized.errorCount, 2);
    assert.equal(normalized.newProductsCount, 5);
    assert.equal(normalized.updateCount, 3);
    assert.equal(normalized.detailedErrors.length, 2);
    assert.equal(normalized.detailedErrors[0].rowNumber, 3);
    assert.equal(normalized.detailedErrors[1].rowNumber, 7);
    assert.equal(normalized.validRows.length, 2);
  });

  test("6. P2-B: Stale validation and staging state invalidation when ZIP file changes or is removed", () => {
    // Initial state after valid validation with stagingId
    let validationResult = {
      totalRows: 2,
      validCount: 2,
      errorCount: 0,
      stagingId: "stg_1792750000000_abc12345",
      rows: [
        { sku: "ITEM-1", status: "VALID" },
        { sku: "ITEM-2", status: "VALID" },
      ],
    };
    let selectedZipFile = { name: "initial_images.zip", size: 1024 * 1024 };
    let error = null;

    // Simulate Administrator replacing ZIP file
    const newZipFile = { name: "replacement_images.zip", size: 2 * 1024 * 1024 };
    const handleZipChange = (file) => {
      selectedZipFile = file;
      validationResult = null; // Invalidate stale validation result & stagingId
      error = null;
    };

    handleZipChange(newZipFile);
    assert.equal(selectedZipFile.name, "replacement_images.zip");
    assert.equal(validationResult, null, "Prior validation result must be invalidated on ZIP file change");

    // Simulate Administrator removing ZIP file
    const handleRemoveZip = () => {
      selectedZipFile = null;
      validationResult = null;
      error = null;
    };

    validationResult = { stagingId: "stg_new" }; // suppose re-validated
    handleRemoveZip();
    assert.equal(selectedZipFile, null);
    assert.equal(validationResult, null, "Prior validation result and staging ID must be cleared on ZIP removal");
  });

  test("7. P2-B: In-flight validation sequence resolution safely ignores out-of-order delayed responses", async () => {
    let validationSeq = 0;
    let committedState = null;

    const executeSimulatedValidation = (seqId, mockReport, delayMs) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          if (seqId === validationSeq) {
            committedState = mockReport;
          }
          resolve();
        }, delayMs);
      });
    };

    // Request 1 started (slow response: 50ms)
    const seq1 = ++validationSeq;
    const p1 = executeSimulatedValidation(seq1, { id: "stale_result_1" }, 50);

    // User changes file / clicks validate again -> Request 2 started (faster response: 10ms)
    const seq2 = ++validationSeq;
    const p2 = executeSimulatedValidation(seq2, { id: "fresh_result_2" }, 10);

    await Promise.all([p1, p2]);

    assert.equal(committedState.id, "fresh_result_2", "Stale in-flight response must not overwrite newer validation state");
  });
});
