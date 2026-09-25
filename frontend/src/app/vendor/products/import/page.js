"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  X,
  RefreshCw,
  HelpCircle,
  Package,
  Layers,
  Check,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";

export default function BulkProductImportPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  // States
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [validationReport, setValidationReport] = useState(null);
  const [commitResult, setCommitResult] = useState(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'valid' | 'errors'

  // Download Template
  const handleDownloadTemplate = async (format = "csv") => {
    setDownloadingTemplate(true);
    try {
      const res = await vendorService.downloadImportTemplate(format);
      const blob = new Blob([res.data], {
        type:
          format === "xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "text/csv;charset=utf-8;",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `buybox_product_import_template.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Template downloaded (${format.toUpperCase()})`);
    } catch (err) {
      toast.error("Failed to download template", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // Drag & Drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Validate File
  const processFile = async (file) => {
    const validExtensions = [".csv", ".xlsx", ".xls"];
    const fileExt = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!validExtensions.includes(fileExt)) {
      toast.error("Invalid file format", {
        description: "Please upload a CSV or Excel (.xlsx/.xls) file.",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", {
        description: "Maximum spreadsheet size is 5MB.",
      });
      return;
    }

    setSelectedFile(file);
    setValidationReport(null);
    setCommitResult(null);
    setIsValidating(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await vendorService.validateBulkImport(formData);
      const report = res.data?.data || res.data;
      setValidationReport(report);

      if (report.errorCount > 0) {
        toast.warning(
          `Validation complete: ${report.validCount} valid, ${report.errorCount} row(s) need attention.`
        );
      } else {
        toast.success(
          `All ${report.validCount} rows validated successfully!`
        );
      }
    } catch (err) {
      toast.error("Failed to parse & validate file", {
        description: err.response?.data?.message || err.message,
      });
      setSelectedFile(null);
    } finally {
      setIsValidating(false);
    }
  };

  // Commit Import
  const handleCommit = async () => {
    if (!validationReport || validationReport.validCount === 0) {
      toast.error("No valid rows to import");
      return;
    }

    const validRows =
      validationReport.results && validationReport.results.length > 0
        ? validationReport.results.filter((r) => r.isValid).map((r) => r.row || r)
        : (validationReport.rows || []).filter(
            (r) => r.isValid || !r.errors || r.errors.length === 0
          );

    setIsCommitting(true);
    try {
      const res = await vendorService.commitBulkImport(validRows);
      const data = res.data?.data || res.data;
      setCommitResult(data);
      toast.success("Products imported successfully!", {
        description: `Created: ${data.createdCount || 0}, Updated: ${data.updatedCount || 0}`,
      });
    } catch (err) {
      toast.error("Failed to commit import", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsCommitting(false);
    }
  };

  // Download Error CSV
  const handleDownloadErrors = () => {
    if (!validationReport || validationReport.errorCount === 0) return;

    const errorRows = validationReport.results.filter((r) => !r.isValid);
    const headers = [
      "Row Number",
      "SKU",
      "Title",
      "Errors",
    ];

    const csvContent = [
      headers.join(","),
      ...errorRows.map((r) => {
        const sku = `"${(r.row?.sku || "").replace(/"/g, '""')}"`;
        const title = `"${(r.row?.title || "").replace(/"/g, '""')}"`;
        const errors = `"${r.errors.join("; ").replace(/"/g, '""')}"`;
        return [r.rowIndex, sku, title, errors].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `import_errors_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  // Reset Form
  const handleReset = () => {
    setSelectedFile(null);
    setValidationReport(null);
    setCommitResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Filtered preview rows
  const previewRows = validationReport?.results.filter((item) => {
    if (activeTab === "valid") return item.isValid;
    if (activeTab === "errors") return !item.isValid;
    return true;
  }) || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Back navigation & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/vendor/products"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Products</span>
            </Link>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <UploadCloud className="size-6 text-[#004D38]" />
            <span>Bulk Product Import</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Upload CSV or Excel spreadsheets to create new marketplace listings or update existing SKUs in bulk.
          </p>
        </div>

        {/* Template Downloads */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownloadTemplate("csv")}
            disabled={downloadingTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
          >
            <FileText className="size-3.5 text-slate-500" />
            <span>CSV Template</span>
            <Download className="size-3 text-slate-400 ml-0.5" />
          </button>
          <button
            onClick={() => handleDownloadTemplate("xlsx")}
            disabled={downloadingTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-600" />
            <span>Excel Template</span>
            <Download className="size-3 text-slate-400 ml-0.5" />
          </button>
        </div>
      </div>

      {/* Commit Result Success Banner */}
      {commitResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-emerald-100 rounded-xl text-[#004D38]">
              <CheckCircle2 className="size-7" />
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-base font-bold text-emerald-950">
                Bulk Import Completed Successfully!
              </h3>
              <p className="text-xs text-emerald-800">
                Your products have been processed and saved into the marketplace catalog.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <div className="bg-white/80 border border-emerald-200 px-3.5 py-2 rounded-xl">
                  <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                    Total Processed
                  </div>
                  <div className="text-lg font-black text-slate-900">
                    {commitResult.totalProcessed || 0}
                  </div>
                </div>
                <div className="bg-white/80 border border-emerald-200 px-3.5 py-2 rounded-xl">
                  <div className="text-[11px] text-emerald-700 font-medium uppercase tracking-wider">
                    New Products Created
                  </div>
                  <div className="text-lg font-black text-emerald-700">
                    {commitResult.createdCount || 0}
                  </div>
                </div>
                <div className="bg-white/80 border border-emerald-200 px-3.5 py-2 rounded-xl">
                  <div className="text-[11px] text-blue-700 font-medium uppercase tracking-wider">
                    Existing SKUs Updated
                  </div>
                  <div className="text-lg font-black text-blue-700">
                    {commitResult.updatedCount || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-emerald-200/60">
            <Link
              href="/vendor/products"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Package className="size-3.5" />
              <span>View Product Catalog</span>
            </Link>
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900 text-xs font-semibold transition-colors"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}

      {/* File Upload Dropzone (shown if no commit yet) */}
      {!commitResult && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Dropzone Area */}
          <div className="lg:col-span-2 space-y-4">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative cursor-pointer border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                dragActive
                  ? "border-[#004D38] bg-emerald-50/50 scale-[1.005]"
                  : selectedFile
                  ? "border-emerald-300 bg-emerald-50/20"
                  : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="flex flex-col items-center justify-center space-y-3">
                <div
                  className={`p-3.5 rounded-2xl ${
                    selectedFile
                      ? "bg-emerald-100 text-[#004D38]"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <UploadCloud className="size-8" />
                </div>

                {selectedFile ? (
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-slate-800">
                      {selectedFile.name}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </div>
                    <div className="pt-2">
                      <span className="text-xs text-emerald-700 font-semibold underline">
                        Click or drag to replace file
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-800">
                      Drag and drop your spreadsheet here
                    </p>
                    <p className="text-xs text-slate-500">
                      Supports .CSV and .XLSX files up to 5MB
                    </p>
                    <div className="pt-2">
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
                        Browse Computer
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {isValidating && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center space-y-2">
                  <RefreshCw className="size-7 text-[#004D38] animate-spin" />
                  <p className="text-xs font-bold text-slate-700">
                    Parsing spreadsheet & validating rows...
                  </p>
                </div>
              )}
            </div>

            {selectedFile && !isValidating && (
              <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2.5 text-xs text-slate-700">
                  <FileSpreadsheet className="size-4 text-emerald-600" />
                  <span className="font-semibold">{selectedFile.name}</span>
                </div>
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-semibold"
                >
                  <X className="size-3.5" />
                  <span>Remove</span>
                </button>
              </div>
            )}
          </div>

          {/* Sidebar Instructions */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <HelpCircle className="size-3.5" />
                <span>Import Guidelines</span>
              </h4>

              <ul className="space-y-2.5 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <Check className="size-3.5 text-[#004D38] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-800">SKU Uniqueness:</strong> SKUs matching your existing products will be updated. Other vendors&apos; SKUs cannot be overwritten.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="size-3.5 text-[#004D38] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-800">Required Columns:</strong> Title, SKU, Price, Stock, and Category are mandatory for all new listings.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="size-3.5 text-[#004D38] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-800">Images:</strong> Provide direct image URLs separated by comma (e.g. <code>https://...jpg, https://...png</code>).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="size-3.5 text-[#004D38] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-800">Pricing:</strong> Use numbers only (e.g. <code>499.00</code>). Currency defaults to INR.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="size-3.5 text-[#004D38] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-800">Spreadsheet Security:</strong> Formula injection protection is enabled; cells starting with <code>=,+,-,@</code> are sanitized.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Validation Report & Preview Table */}
      {validationReport && !commitResult && (
        <div className="space-y-4 pt-4 border-t border-slate-200">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                Total Rows
              </div>
              <div className="text-2xl font-black text-slate-900 mt-0.5">
                {validationReport.totalRows}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs">
              <div className="text-[11px] text-emerald-600 font-semibold uppercase tracking-wider">
                Valid Rows
              </div>
              <div className="text-2xl font-black text-emerald-700 mt-0.5 flex items-center gap-1.5">
                <CheckCircle2 className="size-5" />
                <span>{validationReport.validCount}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-xs">
              <div className="text-[11px] text-rose-600 font-semibold uppercase tracking-wider">
                Rows with Errors
              </div>
              <div className="text-2xl font-black text-rose-700 mt-0.5 flex items-center gap-1.5">
                <AlertCircle className="size-5" />
                <span>{validationReport.errorCount}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-xs">
              <div className="text-[11px] text-blue-600 font-semibold uppercase tracking-wider">
                New vs Updates
              </div>
              <div className="text-sm font-bold text-slate-700 mt-1">
                <span className="text-emerald-700 font-black">
                  {validationReport.newCount || 0}
                </span>{" "}
                new,{" "}
                <span className="text-blue-700 font-black">
                  {validationReport.updateCount || 0}
                </span>{" "}
                updates
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  activeTab === "all"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Rows ({validationReport.totalRows})
              </button>
              <button
                onClick={() => setActiveTab("valid")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  activeTab === "valid"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-600 hover:text-emerald-700"
                }`}
              >
                Valid ({validationReport.validCount})
              </button>
              <button
                onClick={() => setActiveTab("errors")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  activeTab === "errors"
                    ? "bg-white text-rose-700 shadow-xs"
                    : "text-slate-600 hover:text-rose-700"
                }`}
              >
                Errors ({validationReport.errorCount})
              </button>
            </div>

            {/* Commit & Error Download buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {validationReport.errorCount > 0 && (
                <button
                  onClick={handleDownloadErrors}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors"
                >
                  <Download className="size-3.5" />
                  <span>Download Error Log (CSV)</span>
                </button>
              )}

              <button
                onClick={handleCommit}
                disabled={validationReport.validCount === 0 || isCommitting}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition-all ${
                  validationReport.validCount === 0 || isCommitting
                    ? "bg-slate-300 cursor-not-allowed"
                    : "bg-[#004D38] hover:bg-[#003828]"
                }`}
              >
                {isCommitting ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Importing Products...</span>
                  </>
                ) : (
                  <>
                    <Check className="size-3.5" />
                    <span>Import {validationReport.validCount} Valid Products</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Preview Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="px-4 py-3 w-16">Row</th>
                    <th className="px-4 py-3 w-24">Status</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Validation Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewRows.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-4 py-12 text-center text-slate-400">
                        No rows found for this filter tab.
                      </td>
                    </tr>
                  ) : (
                    previewRows.map((item) => (
                      <tr
                        key={item.rowIndex}
                        className={`hover:bg-slate-50/60 transition-colors ${
                          !item.isValid ? "bg-rose-50/30" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-mono text-slate-400">
                          #{item.rowIndex}
                        </td>
                        <td className="px-4 py-3">
                          {item.isValid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="size-3" />
                              VALID
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              <AlertCircle className="size-3" />
                              ERROR
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-slate-800">
                          {item.row?.sku || "—"}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900 max-w-xs truncate">
                          {item.row?.title || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.row?.category || "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-800">
                          {item.row?.price ? `₹${item.row.price}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-800">
                          {item.row?.stock !== undefined ? item.row.stock : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              item.action === "update"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-emerald-100 text-[#004D38]"
                            }`}
                          >
                            {item.action || "create"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {item.errors && item.errors.length > 0 ? (
                            <div className="space-y-0.5">
                              {item.errors.map((err, i) => (
                                <div
                                  key={i}
                                  className="text-[11px] text-rose-600 font-medium flex items-center gap-1"
                                >
                                  <AlertCircle className="size-3 shrink-0" />
                                  <span>{err}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-emerald-600">
                              Ready to import
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
