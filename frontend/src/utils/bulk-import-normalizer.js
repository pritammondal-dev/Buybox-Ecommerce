/**
 * Normalizes bulk product import validation responses from the backend
 * across various legacy and canonical Phase 2H formats.
 *
 * Source of truth: backend bulkImportExportService.validateBulkImport
 *
 * Backend response shape:
 * {
 *   totalRows: number,
 *   validRowsCount: number,
 *   validCount: number,
 *   errorRowsCount: number,
 *   errorCount: number,
 *   newProductsCount: number,
 *   newVariantsCount: number,
 *   updateCount: number,
 *   rows: Array<ParsedRow>,
 *   results: Array<{ rowIndex, isValid, status, action, row, errors }>,
 *   errorDetails: Array<{ rowNumber, sku, product, field, error, suggestedAction }>
 * }
 */

export function normalizeBulkValidationReport(rawReport) {
  if (!rawReport) return null;
  const data = rawReport?.data?.data || rawReport?.data || rawReport;

  // 1. Total Rows Count (authoritative number)
  const totalRows = Number(
    data.totalRows ??
    data.summary?.totalRows ??
    (Array.isArray(data.rows) ? data.rows.length : undefined) ??
    (Array.isArray(data.results) ? data.results.length : 0)
  ) || 0;

  // 2. Valid Rows Count (authoritative number using nullish coalescing)
  let rawValid =
    data.validRowsCount ??
    data.validCount ??
    data.summary?.validRows ??
    (Array.isArray(data.validItems) ? data.validItems.length : undefined);

  if (rawValid === undefined && Array.isArray(data.rows)) {
    rawValid = data.rows.filter((r) => r.status === "VALID" || r.isValid === true).length;
  }
  if (rawValid === undefined && Array.isArray(data.results)) {
    rawValid = data.results.filter((r) => r.isValid === true || r.status === "VALID").length;
  }
  const validCount = Number(rawValid ?? 0) || 0;

  // 3. Error Rows Count (authoritative number using nullish coalescing)
  let rawError =
    data.errorRowsCount ??
    data.errorCount ??
    data.summary?.invalidRows ??
    (Array.isArray(data.errors) && typeof data.errors[0] === "object" ? data.errors.length : undefined);

  if (rawError === undefined && Array.isArray(data.rows)) {
    rawError = data.rows.filter((r) => r.status === "ERROR" || r.isValid === false).length;
  }
  if (rawError === undefined && Array.isArray(data.results)) {
    rawError = data.results.filter((r) => r.isValid === false || r.status === "ERROR").length;
  }
  if (rawError === undefined && Array.isArray(data.errorDetails)) {
    rawError = new Set(data.errorDetails.map((e) => e.rowNumber ?? e.row)).size;
  }
  const errorCount = Number(rawError ?? 0) || 0;

  // 4. Entity breakdown counts
  const newProductsCount = Number(data.newProductsCount ?? data.summary?.newProducts ?? 0) || 0;
  const newVariantsCount = Number(data.newVariantsCount ?? data.summary?.newVariants ?? 0) || 0;
  const updateCount = Number(data.updateCount ?? data.summary?.updated ?? 0) || 0;

  // 5. Detailed row-level errors list
  const detailedErrors = [];
  if (Array.isArray(data.errorDetails) && data.errorDetails.length > 0) {
    data.errorDetails.forEach((err, idx) => {
      detailedErrors.push({
        rowNumber: Number(err.rowNumber ?? err.row ?? (idx + 1)),
        sku: String(err.sku ?? "").trim(),
        product: String(err.product ?? err.name ?? "").trim(),
        field: String(err.field ?? "").trim(),
        message: String(err.error ?? err.message ?? (typeof err === "string" ? err : JSON.stringify(err))).trim(),
        suggestedAction: err.suggestedAction ? String(err.suggestedAction).trim() : null,
      });
    });
  } else if (Array.isArray(data.errors) && data.errors.length > 0) {
    data.errors.forEach((err, idx) => {
      detailedErrors.push({
        rowNumber: Number(err.rowNumber ?? err.row ?? (idx + 1)),
        sku: String(err.sku ?? "").trim(),
        product: String(err.product ?? err.name ?? "").trim(),
        field: String(err.field ?? "").trim(),
        message: String(err.message ?? err.error ?? (typeof err === "string" ? err : JSON.stringify(err))).trim(),
        suggestedAction: err.suggestedAction ? String(err.suggestedAction).trim() : null,
      });
    });
  } else if (Array.isArray(data.results)) {
    data.results.forEach((r, idx) => {
      if (r.isValid === false || (Array.isArray(r.errors) && r.errors.length > 0)) {
        const rowNum = Number(r.rowIndex ?? r.rowNumber ?? (idx + 1));
        const rowErrors = Array.isArray(r.errors) ? r.errors : (r.errors ? [r.errors] : []);
        rowErrors.forEach((e) => {
          detailedErrors.push({
            rowNumber: rowNum,
            sku: String(r.row?.sku ?? r.sku ?? "").trim(),
            product: String(r.row?.title ?? r.row?.name ?? r.name ?? "").trim(),
            field: "",
            message: String(typeof e === "string" ? e : (e.message || e.error || JSON.stringify(e))).trim(),
            suggestedAction: null,
          });
        });
      }
    });
  } else if (Array.isArray(data.rows)) {
    data.rows.forEach((r, idx) => {
      if (r.status === "ERROR" || r.isValid === false || (Array.isArray(r.errors) && r.errors.length > 0)) {
        const rowNum = Number(r.rowNumber ?? (idx + 1));
        const rowErrors = Array.isArray(r.errors) ? r.errors : (r.errors ? [r.errors] : []);
        rowErrors.forEach((e) => {
          detailedErrors.push({
            rowNumber: rowNum,
            sku: String(r.sku ?? "").trim(),
            product: String(r.name ?? r.title ?? "").trim(),
            field: "",
            message: String(typeof e === "string" ? e : (e.message || e.error || JSON.stringify(e))).trim(),
            suggestedAction: null,
          });
        });
      }
    });
  }

  // 6. Valid rows array ready for commit
  let validRows = [];
  if (Array.isArray(data.validItems) && data.validItems.length > 0) {
    validRows = data.validItems;
  } else if (Array.isArray(data.rows)) {
    validRows = data.rows.filter((r) => r.status === "VALID" || r.isValid === true);
  } else if (Array.isArray(data.results)) {
    validRows = data.results
      .filter((r) => r.isValid === true || r.status === "VALID")
      .map((r) => r.row || r);
  }

  return {
    raw: data,
    totalRows,
    validCount,
    errorCount,
    newProductsCount,
    newVariantsCount,
    updateCount,
    detailedErrors,
    validRows,
    results: Array.isArray(data.results) ? data.results : [],
  };
}
