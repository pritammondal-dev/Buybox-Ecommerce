"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Star,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  User,
  Package,
} from "lucide-react";
import { adminCatalogService } from "@/services/admin/admin.service.js";

export default function AdminReviewsModerationPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("pending");
  const [ratingFilter, setRatingFilter] = useState("");
  const [search, setSearch] = useState("");

  // Reject Modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchReviews = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { limit: 50 };
      if (statusFilter !== "all") params.status = statusFilter;
      if (ratingFilter) params.rating = ratingFilter;
      if (search) params.search = search;

      const res = await adminCatalogService.listReviews(params);
      const items = res?.items || res || [];
      setReviews(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load reviews for moderation"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [statusFilter, ratingFilter]);

  const handleApprove = async (review) => {
    if (!confirm(`Are you sure you want to approve this review?`)) return;
    try {
      await adminCatalogService.moderateReview(review._id, "approved");
      setSuccess("Review approved and published to storefront");
      setTimeout(() => setSuccess(null), 4000);
      fetchReviews();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to approve review"
      );
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReview) return;
    setSubmitting(true);
    try {
      await adminCatalogService.moderateReview(
        selectedReview._id,
        "rejected",
        rejectionReason.trim()
      );
      setShowRejectModal(false);
      setSelectedReview(null);
      setRejectionReason("");
      setSuccess("Review rejected");
      setTimeout(() => setSuccess(null), 4000);
      fetchReviews();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to reject review"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (rating) => {
    return (
      <div className="flex items-center gap-0.5 text-amber-400">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`size-3.5 ${
              star <= rating ? "fill-amber-400" : "text-slate-200"
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Star className="size-6 text-amber-500 fill-amber-500" />
            <span>Product Reviews &amp; Moderation</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review customer feedback, rate compliance, and moderate storefront product testimonials
          </p>
        </div>

        <button
          onClick={fetchReviews}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="size-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle className="size-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          {["pending", "approved", "rejected", "all"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                statusFilter === st
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="text-xs p-2 rounded-xl border border-slate-200 bg-white focus:outline-hidden"
          >
            <option value="">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>
        </div>
      </div>

      {/* Review List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80">
            Loading reviews queue...
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200/80 space-y-2">
            <Star className="size-8 mx-auto text-slate-300" />
            <p className="text-sm font-medium">No reviews found matching filter criteria.</p>
          </div>
        ) : (
          reviews.map((rev) => (
            <div
              key={rev._id}
              className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 hover:border-slate-300 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    {renderStars(rev.rating)}
                    <h3 className="text-sm font-bold text-slate-900">
                      {rev.title || "Customer Review"}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        rev.status === "approved"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : rev.status === "pending"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}
                    >
                      {rev.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 font-medium pt-1">
                    <span className="flex items-center gap-1 text-slate-700">
                      <Package className="size-3.5 text-slate-400" />
                      {rev.product?.title || rev.productId?.title || "Product"}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <User className="size-3.5 text-slate-400" />
                      {rev.customerId?.userId?.firstName || "Customer"}
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(rev.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {/* Moderation Actions */}
                {rev.status === "pending" && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApprove(rev)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs font-semibold transition-colors"
                    >
                      <CheckCircle className="size-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedReview(rev);
                        setShowRejectModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-semibold transition-colors"
                    >
                      <XCircle className="size-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Review Comment Body */}
              <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                {rev.comment}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900">
              Reject Review
            </h3>
            <p className="text-xs text-slate-500">
              Provide justification for declining this customer review.
            </p>
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Inappropriate language, spam, or off-topic product content..."
                rows={3}
                required
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#004D38] focus:outline-hidden resize-none"
              />
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  {submitting ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
