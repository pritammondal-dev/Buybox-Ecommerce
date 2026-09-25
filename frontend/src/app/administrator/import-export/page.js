"use client";

import React, { useState } from "react";
import { adminImportExportService } from "@/services/admin/admin.service";

export default function ImportExportPage() {
  const [activeTab, setActiveTab] = useState("import");

  // Import State
  const [selectedFile, setSelectedFile] = useState(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(null);
  const [error, setError] = useState(null);

  // Export State
  const [exportFormat, setExportFormat] = useState("csv");
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setValidationResult(null);
      setImportSuccess(null);
      setError(null);
    }
  };

  const handleDownloadTemplate = async (format) => {
    try {
      const res = await adminImportExportService.downloadTemplate(format);
      const blob = new Blob([res.data || res], {
        type: format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `catalog_import_template.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Failed to download template:", err);
      setError("Failed to download import template");
    }
  };

  const handleValidate = async () => {
    if (!selectedFile) return;
    setValidating(true);
    setError(null);
    setValidationResult(null);
    setImportSuccess(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await adminImportExportService.validateImport(formData);
      setValidationResult(res);
    } catch (err) {
      console.error("Validation error:", err);
      setError(err?.response?.data?.message || err?.message || "File validation failed");
    } finally {
      setValidating(false);
    }
  };

  const handleCommit = async () => {
    if (!validationResult || !validationResult.rows) return;
    const validRows = validationResult.rows.filter((r) => r.status === "VALID");
    if (validRows.length === 0) {
      setError("No valid rows to commit.");
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const res = await adminImportExportService.commitImport(validRows);
      setImportSuccess(res);
      setValidationResult(null);
      setSelectedFile(null);
    } catch (err) {
      console.error("Commit failed:", err);
      setError(err?.response?.data?.message || err?.message || "Import execution failed");
    } finally {
      setImporting(false);
    }
  };

  const handleExportCatalog = async () => {
    setExporting(true);
    setError(null);
    setExportSuccess(null);
    try {
      const res = await adminImportExportService.exportProducts({ format: exportFormat });
      const blob = new Blob([res.data || res], {
        type: exportFormat === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `buybox_catalog_export_${new Date().toISOString().slice(0, 10)}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setExportSuccess(`Catalog successfully exported in ${exportFormat.toUpperCase()} format.`);
    } catch (err) {
      console.error("Export failed:", err);
      setError(err?.response?.data?.message || err?.message || "Catalog export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-gray-200 pb-5">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Bulk Catalog Operations</h1>
        <p className="text-sm text-gray-500 mt-1">
          Perform batch imports and full exports with schema validation, conflict detection, and transactional rollback.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("import")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeTab === "import"
              ? "border-[#004D38] text-[#004D38]"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          Bulk Product Import
        </button>
        <button
          onClick={() => setActiveTab("export")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeTab === "export"
              ? "border-[#004D38] text-[#004D38]"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          Platform Catalog Export
        </button>
      </div>

      {error && (
        <div className="p-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl">
          {error}
        </div>
      )}

      {/* IMPORT TAB */}
      {activeTab === "import" && (
        <div className="space-y-6">
          {/* Download Templates Card */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Standard Import Templates</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Download the official template pre-formatted with expected columns, types, and constraints.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDownloadTemplate("csv")}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Download CSV
              </button>
              <button
                onClick={() => handleDownloadTemplate("xlsx")}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Download Excel (.xlsx)
              </button>
            </div>
          </div>

          {/* File Upload & Validation Card */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-gray-900">Upload Data File</h2>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50/50 hover:bg-gray-50 transition-colors">
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
                id="bulk-file-input"
              />
              <label htmlFor="bulk-file-input" className="cursor-pointer">
                <svg
                  className="w-10 h-10 mx-auto text-gray-400 mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-xs font-semibold text-gray-800">
                  {selectedFile ? selectedFile.name : "Click to select CSV or Excel catalog file"}
                </p>
                <p className="text-[11px] text-gray-400 mt-1">Maximum 1,000 rows per batch &bull; Under 10MB</p>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleValidate}
                disabled={!selectedFile || validating}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#004D38] hover:bg-[#003829] rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                {validating ? "Validating Records..." : "Validate & Preview Rows"}
              </button>
            </div>
          </div>

          {/* Commit Success Alert */}
          {importSuccess && (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-1">
              <h3 className="text-sm font-bold">Catalog Batch Import Committed Successfully!</h3>
              <p className="text-xs">
                Processed {importSuccess.totalProcessed || importSuccess.insertedCount || "all"} rows.
                New: {importSuccess.insertedCount || 0} | Updated: {importSuccess.updatedCount || 0}
              </p>
            </div>
          )}

          {/* Validation Results Preview */}
          {validationResult && (
            <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden space-y-4">
              <div className="p-5 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50/50">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Validation Summary</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Total Rows: <span className="font-semibold text-gray-900">{validationResult.totalRows}</span> &bull;
                    Valid: <span className="font-semibold text-emerald-700">{validationResult.validRowsCount}</span> &bull;
                    Errors: <span className="font-semibold text-red-700">{validationResult.errorRowsCount}</span>
                  </p>
                </div>
                <button
                  onClick={handleCommit}
                  disabled={importing || validationResult.validRowsCount === 0}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#004D38] hover:bg-[#003829] rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {importing ? "Committing Transactions..." : `Commit ${validationResult.validRowsCount} Valid Rows`}
                </button>
              </div>

              {/* Rows Table */}
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs text-gray-600 divide-y divide-gray-200">
                  <thead className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="px-4 py-3">Row</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Product Name</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Stock</th>
                      <th className="px-4 py-3">Validation Errors</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {validationResult.rows?.map((r, idx) => (
                      <tr key={idx} className={r.status === "ERROR" ? "bg-red-50/30" : "hover:bg-gray-50/50"}>
                        <td className="px-4 py-3 font-mono text-gray-500">#{r.rowNumber || idx + 2}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              r.status === "VALID"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : "bg-red-100 text-red-800 border-red-200"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap capitalize font-medium text-gray-700">
                          {r.action || "insert"}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{r.name}</td>
                        <td className="px-4 py-3 font-mono text-gray-700">{r.sku}</td>
                        <td className="px-4 py-3 whitespace-nowrap">₹{r.price}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{r.stockQuantity}</td>
                        <td className="px-4 py-3 text-red-600 text-[11px]">
                          {r.errors && r.errors.length > 0 ? r.errors.join(", ") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* EXPORT TAB */}
      {activeTab === "export" && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-gray-900">Export Marketplace Catalog</h2>
            <p className="text-xs text-gray-500 mt-1">
              Generate a snapshot of all active products, variants, SKUs, inventory levels, and categories across all vendors.
            </p>
          </div>

          <div className="max-w-md space-y-3">
            <label className="text-xs font-semibold text-gray-700 block">Export Format</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs text-gray-800 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={exportFormat === "csv"}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="text-[#004D38] focus:ring-[#004D38]"
                />
                <span>CSV (.csv)</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-800 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="xlsx"
                  checked={exportFormat === "xlsx"}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="text-[#004D38] focus:ring-[#004D38]"
                />
                <span>Excel Spreadsheet (.xlsx)</span>
              </label>
            </div>
          </div>

          {exportSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-800">
              {exportSuccess}
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={handleExportCatalog}
              disabled={exporting}
              className="px-6 py-2.5 text-xs font-semibold text-white bg-[#004D38] hover:bg-[#003829] rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {exporting ? "Generating Export File..." : "Download Full Catalog Export"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
