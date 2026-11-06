"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  FileText,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Building,
  UserCheck,
  FileCheck,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";
import {
  VendorPageHeader,
  VendorBreadcrumbs,
  VendorStatusBadge,
} from "@/components/vendor";

const CATEGORIES = [
  {
    key: "identity_proof",
    title: "1. Identity Proof",
    description: "Government-issued identity document of primary merchant or director.",
    examples: "PAN Card, Passport, Voter ID, Driving License",
    icon: UserCheck,
    defaultType: "PAN Card",
  },
  {
    key: "business_registration",
    title: "2. Business Registration",
    description: "Official legal entity registration certificate.",
    examples: "GST Certificate, Certificate of Incorporation, MSME / Udyam",
    icon: Building,
    defaultType: "GST Certificate",
  },
  {
    key: "tax_id",
    title: "3. Tax Identification",
    description: "Permanent Account Number or Tax Deduction Account Number.",
    examples: "Company or Individual PAN Card, TAN Certificate",
    icon: FileCheck,
    defaultType: "Company PAN Card",
  },
  {
    key: "address_proof",
    title: "4. Business Address Proof",
    description: "Proof of physical operating address not older than 3 months.",
    examples: "Electricity Bill, Telephone Bill, Lease Agreement, Bank Statement",
    icon: MapPin,
    defaultType: "Utility / Electricity Bill",
  },
];

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function VendorCompliancePage() {
  const [kycData, setKycData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeUploads, setActiveUploads] = useState({});
  const [selectedFiles, setSelectedFiles] = useState({});
  const [docNumbers, setDocNumbers] = useState({});
  const [docTypes, setDocTypes] = useState({});
  const [downloadingDocId, setDownloadingDocId] = useState(null);

  const loadKyc = async () => {
    try {
      setIsLoading(true);
      const res = await vendorService.getMyKycStatus();
      const payload = res?.data?.data || res?.data || {};
      setKycData(payload);
    } catch (err) {
      toast.error("Failed to load KYC verification status", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKyc();
  }, []);

  const handleFileChange = (categoryKey, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File exceeds 5MB limit", {
        description: "Please select a document smaller than 5MB.",
      });
      return;
    }

    if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
      toast.error("SVG files are not allowed", {
        description: "Please upload PDF, JPEG, PNG, or WebP files.",
      });
      return;
    }

    setSelectedFiles((prev) => ({ ...prev, [categoryKey]: file }));
  };

  const handleUpload = async (categoryKey, defaultType) => {
    const file = selectedFiles[categoryKey];
    if (!file) {
      toast.error("Please select a file to upload");
      return;
    }

    const type = docTypes[categoryKey] || defaultType;
    const number = docNumbers[categoryKey] || "";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentCategory", categoryKey);
    formData.append("documentType", type);
    if (number.trim()) {
      formData.append("documentNumber", number.trim());
    }

    setActiveUploads((prev) => ({ ...prev, [categoryKey]: true }));
    try {
      await vendorService.uploadKycDocument(formData);
      toast.success("Document uploaded successfully! It is now pending review.");
      // Clear file selection
      setSelectedFiles((prev) => {
        const next = { ...prev };
        delete next[categoryKey];
        return next;
      });
      await loadKyc();
    } catch (err) {
      toast.error("Failed to upload KYC document", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setActiveUploads((prev) => ({ ...prev, [categoryKey]: false }));
    }
  };

  const handleDownload = async (docId, fileName) => {
    setDownloadingDocId(docId);
    try {
      const response = await vendorService.downloadMyKycDocument(docId);
      const blob = new Blob([response.data], {
        type: response.headers?.["content-type"] || "application/octet-stream",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName || "kyc_document");
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Document downloaded securely");
    } catch (err) {
      toast.error("Failed to download document", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setDownloadingDocId(null);
    }
  };

  const breadcrumbs = [
    { label: "Dashboard", href: "/vendor/dashboard" },
    { label: "Settings", href: "/vendor/store" },
    { label: "Compliance & KYC" },
  ];

  const overallStatus = kycData?.kycStatus || "not_submitted";
  const documents = kycData?.documents || [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <VendorBreadcrumbs items={breadcrumbs} />

      <VendorPageHeader
        title="Merchant Compliance & KYC"
        description="Verify your merchant legal identity and regulatory documentation to ensure full compliance with Buybox marketplace policies."
        actions={
          <button
            type="button"
            onClick={loadKyc}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        }
      />

      {/* Global Status Banner */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-2xl ${
                overallStatus === "approved"
                  ? "bg-emerald-100 text-emerald-700"
                  : overallStatus === "rejected"
                  ? "bg-rose-100 text-rose-700"
                  : overallStatus === "under_review" || overallStatus === "pending"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Verification Status
              </span>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mt-0.5">
                <span>
                  {overallStatus === "approved"
                    ? "Verified Merchant"
                    : overallStatus === "rejected"
                    ? "Verification Action Required"
                    : overallStatus === "under_review" || overallStatus === "pending"
                    ? "Verification Under Review"
                    : "Documentation Required"}
                </span>
                <VendorStatusBadge status={overallStatus} size="md" />
              </h3>
            </div>
          </div>

          <div className="text-xs text-slate-500 text-right">
            <span>Documents Approved: </span>
            <span className="font-bold text-slate-900">
              {documents.filter((d) => d.status === "approved").length} / 4
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
          {overallStatus === "approved"
            ? "Your merchant compliance documents have been verified and approved by Marketplace Operations. Your storefront displays the official Verified Merchant badge."
            : overallStatus === "rejected"
            ? "One or more documents were not approved during review. Please inspect the rejection remarks below and upload corrected documentation."
            : "All 4 document categories must be submitted and approved to achieve full Verified Merchant status. Uploaded documents are encrypted and accessible only to authorized marketplace compliance officers."}
        </p>
      </div>

      {/* Document Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {CATEGORIES.map((cat) => {
          const doc = documents.find((d) => d.documentCategory === cat.key);
          const isUploading = Boolean(activeUploads[cat.key]);
          const selectedFile = selectedFiles[cat.key];
          const docStatus = doc?.status || "not_submitted";
          const Icon = cat.icon;

          return (
            <div
              key={cat.key}
              className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-50 text-[#004D38] border border-emerald-100">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{cat.title}</h4>
                      <p className="text-[11px] text-slate-500">{cat.examples}</p>
                    </div>
                  </div>
                  <VendorStatusBadge status={docStatus} size="sm" />
                </div>

                <p className="text-xs text-slate-600">{cat.description}</p>

                {/* Submitted Document Info */}
                {doc && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium truncate max-w-[200px]">
                        {doc.fileOriginalName}
                      </span>
                      <span className="font-mono text-slate-400 text-[10px]">
                        {formatBytes(doc.fileSize)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Type: {doc.documentType}</span>
                      {doc.documentNumber && <span>No: {doc.documentNumber}</span>}
                    </div>

                    {doc.submittedAt && (
                      <div className="text-[10px] text-slate-400">
                        Submitted: {new Date(doc.submittedAt).toLocaleDateString()}
                      </div>
                    )}

                    {/* Rejection remarks */}
                    {doc.status === "rejected" && doc.rejectionReason && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] space-y-1">
                        <div className="font-bold flex items-center gap-1">
                          <AlertTriangle className="size-3.5" />
                          <span>Rejection Reason</span>
                        </div>
                        <p>{doc.rejectionReason}</p>
                      </div>
                    )}

                    {/* Secure Download Button */}
                    <button
                      type="button"
                      onClick={() => handleDownload(doc._id, doc.fileOriginalName)}
                      disabled={downloadingDocId === doc._id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50 mt-1"
                    >
                      <Download className="size-3.5" />
                      <span>
                        {downloadingDocId === doc._id ? "Downloading..." : "View / Download"}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Upload / Resubmission Form (if not approved or vendor wants to replace) */}
              {docStatus !== "approved" && (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Document Type
                      </label>
                      <input
                        type="text"
                        defaultValue={cat.defaultType}
                        onChange={(e) =>
                          setDocTypes((prev) => ({ ...prev, [cat.key]: e.target.value }))
                        }
                        placeholder={cat.defaultType}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#004D38] focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Doc Number (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. ABCDE1234F"
                        onChange={(e) =>
                          setDocNumbers((prev) => ({ ...prev, [cat.key]: e.target.value }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#004D38] focus:border-transparent outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => handleFileChange(cat.key, e)}
                        className="hidden"
                      />
                      <div className="px-3 py-2 rounded-xl border border-dashed border-slate-300 hover:border-[#004D38] bg-slate-50 hover:bg-emerald-50/30 text-center text-xs text-slate-600 transition-colors flex items-center justify-center gap-1.5">
                        <Upload className="size-3.5 text-slate-400" />
                        <span className="truncate max-w-[140px]">
                          {selectedFile ? selectedFile.name : "Select File (PDF, PNG, JPG)"}
                        </span>
                      </div>
                    </label>

                    <button
                      type="button"
                      onClick={() => handleUpload(cat.key, cat.defaultType)}
                      disabled={isUploading || !selectedFile}
                      className="px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003829] text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                    >
                      {isUploading ? (
                        <>
                          <RefreshCw className="size-3.5 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <span>{doc ? "Resubmit" : "Upload"}</span>
                      )}
                    </button>
                  </div>
                  <span className="block text-[10px] text-slate-400 text-center">
                    Max file size 5MB. PDF, JPG, PNG, WebP supported.
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

