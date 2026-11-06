"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Download,
  Package,
  Clock,
  AlertCircle,
  FileCheck,
  CheckCircle2,
  HardDrive,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Ban,
  Loader2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { productService } from "@/services/product.service";
import { useAuth } from "@/hooks/useAuth";
import { AccountNav } from "./AccountNav";
import { Skeleton } from "@/components/ui/Skeleton";

export function DownloadsPageView() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [downloads, setDownloads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all"); // "all" | "available" | "unavailable"
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchDownloads = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await productService.getMyDigitalDownloads({ limit: 50 });
      const data = res?.data?.data || res?.data || {};
      setDownloads(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      console.error("Failed to load digital downloads:", err);
      setError(
        err.response?.data?.message || err.message || "Failed to load digital downloads"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchDownloads();
    } else if (!authLoading && !isAuthenticated) {
      setIsLoading(false);
    }
  }, [isAuthenticated, authLoading]);

  const handleDownload = async (item) => {
    if (!item.isAvailable) {
      toast.error("Download unavailable", {
        description:
          item.status === "expired"
            ? "Your download link has expired."
            : item.status === "exhausted"
            ? "You have reached the maximum download limit."
            : "Access to this download has been revoked.",
      });
      return;
    }

    setDownloadingId(item.id);
    try {
      const response = await productService.downloadDigitalAsset(item.id);
      const blob = new Blob([response.data], {
        type: item.asset?.mimeType || "application/octet-stream",
      });

      const fileName =
        item.asset?.fileName ||
        (item.asset?.name ? `${item.asset.name}.bin` : "download");

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success("Download started", {
        description: `Downloading ${fileName}`,
      });

      // Update download count locally
      setDownloads((prev) =>
        prev.map((d) => {
          if (d.id === item.id) {
            const newCount = d.downloadCount + 1;
            const isExhausted = d.downloadLimit !== null && newCount >= d.downloadLimit;
            return {
              ...d,
              downloadCount: newCount,
              remainingDownloads:
                d.downloadLimit === null ? null : Math.max(0, d.downloadLimit - newCount),
              isAvailable: d.isAvailable && !isExhausted,
              status: isExhausted ? "exhausted" : d.status,
            };
          }
          return d;
        })
      );
    } catch (err) {
      console.error("Download failed:", err);
      const msg =
        err.response?.data?.message || err.message || "Failed to download asset file.";
      toast.error("Download failed", { description: msg });
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredDownloads = downloads.filter((d) => {
    if (activeFilter === "available") return d.isAvailable;
    if (activeFilter === "unavailable") return !d.isAvailable;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Account Navigation Sidebar */}
          <div className="lg:col-span-1">
            <AccountNav />
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Header */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                  <Download className="size-6 text-[#007A55]" />
                  <span>My Digital Downloads</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Access your purchased virtual goods, software, ebooks, guides, and downloadable files.
                </p>
              </div>

              <button
                onClick={fetchDownloads}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
              {[
                { key: "all", label: `All (${downloads.length})` },
                {
                  key: "available",
                  label: `Available (${downloads.filter((d) => d.isAvailable).length})`,
                },
                {
                  key: "unavailable",
                  label: `Expired / Revoked (${downloads.filter((d) => !d.isAvailable).length})`,
                },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    activeFilter === tab.key
                      ? "bg-[#007A55] text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="size-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
                <button
                  onClick={fetchDownloads}
                  className="font-bold underline text-rose-800 hover:text-rose-900"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Loading Skeletons */}
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="p-6 rounded-3xl bg-white border border-slate-200/80 space-y-4 animate-pulse"
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-4 w-48 bg-slate-200 rounded" />
                      <div className="h-6 w-24 bg-slate-200 rounded-full" />
                    </div>
                    <div className="h-3 w-72 bg-slate-100 rounded" />
                    <div className="h-10 w-32 bg-slate-200 rounded-xl" />
                  </div>
                ))}
              </div>
            ) : filteredDownloads.length === 0 ? (
              /* Empty State */
              <div className="p-12 rounded-3xl bg-white border border-slate-200/80 text-center space-y-4 shadow-xs">
                <div className="size-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <HardDrive className="size-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900">
                    No digital downloads found
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    When you purchase virtual or downloadable products on Buybox, your secure download entitlements will appear here automatically once payment is captured.
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    href="/products"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold text-white bg-[#007A55] hover:bg-[#004D38] transition-colors shadow-xs"
                  >
                    <Package className="size-4" />
                    <span>Explore Products</span>
                  </Link>
                </div>
              </div>
            ) : (
              /* Downloads List */
              <div className="space-y-4">
                {filteredDownloads.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      {/* Product & File Information */}
                      <div className="flex items-start gap-3.5">
                        <div className="size-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-[#007A55]">
                          <FileCheck className="size-6" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-900">
                              {item.product?.title || "Digital Product"}
                            </h3>
                            {item.variantTitle && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-600">
                                {item.variantTitle}
                              </span>
                            )}
                            <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-slate-100 text-slate-500">
                              v{item.asset?.version || "1.0"}
                            </span>
                          </div>

                          <div className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                            <span>File: {item.asset?.fileName || item.asset?.name}</span>
                            {item.asset?.fileSize ? (
                              <span className="text-[11px] font-mono text-slate-400">
                                (
                                {item.asset.fileSize > 1024 * 1024
                                  ? `${(item.asset.fileSize / (1024 * 1024)).toFixed(2)} MB`
                                  : `${Math.round(item.asset.fileSize / 1024)} KB`}
                                )
                              </span>
                            ) : null}
                          </div>

                          {item.orderNumber && (
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                              <span>Order #{item.orderNumber}</span>
                              <span>•</span>
                              <span>
                                Purchased{" "}
                                {new Date(item.createdAt).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="flex sm:flex-col sm:items-end gap-2">
                        {item.status === "active" && item.isAvailable && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="size-3 text-emerald-600" />
                            <span>Available</span>
                          </span>
                        )}
                        {item.status === "expired" && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="size-3 text-amber-600" />
                            <span>Expired</span>
                          </span>
                        )}
                        {item.status === "exhausted" && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            <Ban className="size-3 text-slate-500" />
                            <span>Limit Reached</span>
                          </span>
                        )}
                        {item.status === "revoked" && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            <Ban className="size-3 text-rose-600" />
                            <span>Access Revoked</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Download Policy Meta Row */}
                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
                      <div className="flex items-center gap-4 flex-wrap">
                        {/* Download count / limit */}
                        <div>
                          <span className="font-semibold text-slate-700">Downloads: </span>
                          {item.downloadLimit === null ? (
                            <span className="text-emerald-700 font-bold">Unlimited ({item.downloadCount} used)</span>
                          ) : (
                            <span className="font-bold">
                              {item.remainingDownloads} of {item.downloadLimit} remaining
                            </span>
                          )}
                        </div>

                        {/* Expiration date */}
                        <div>
                          <span className="font-semibold text-slate-700">Expires: </span>
                          {item.expiresAt ? (
                            <span>
                              {new Date(item.expiresAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-bold">Never (Lifetime)</span>
                          )}
                        </div>
                      </div>

                      {/* Download Action Button */}
                      <div>
                        {item.isAvailable ? (
                          <button
                            type="button"
                            onClick={() => handleDownload(item)}
                            disabled={downloadingId === item.id}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#007A55] hover:bg-[#004D38] transition-colors shadow-xs disabled:opacity-50"
                          >
                            {downloadingId === item.id ? (
                              <>
                                <Loader2 className="size-4 animate-spin" />
                                <span>Authorizing Download...</span>
                              </>
                            ) : (
                              <>
                                <Download className="size-4" />
                                <span>Download File</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-400 cursor-not-allowed"
                          >
                            <Ban className="size-3.5" />
                            <span>Download Unavailable</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DownloadsPageView;
