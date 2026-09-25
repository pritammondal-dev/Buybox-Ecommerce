"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, ShieldCheck, ThumbsUp, ArrowLeft, SlidersHorizontal, MessageSquare, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../../../hooks/useAuth.js";
import { reviewService } from "../../../../../services/review.service.js";

export function ProductReviewsPageView({ product, initialReviews = [] }) {
  const { isAuthenticated } = useAuth();
  const [reviews, setReviews] = useState(initialReviews);
  const [starFilter, setStarFilter] = useState(null);
  const [sortOption, setSortOption] = useState("recent");
  const [helpfulVoted, setHelpfulVoted] = useState({});

  const totalReviewsCount = reviews.length;
  const calculatedAverage =
    totalReviewsCount > 0
      ? reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0) / totalReviewsCount
      : 0;

  const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = reviews.filter((r) => Math.round(Number(r.rating) || 0) === stars).length;
    const percentage = totalReviewsCount > 0 ? Math.round((count / totalReviewsCount) * 100) : 0;
    return { stars, count, percentage };
  });

  const filteredAndSortedReviews = useMemo(() => {
    let list = [...reviews];
    if (starFilter !== null) {
      list = list.filter((r) => Math.round(Number(r.rating) || 0) === starFilter);
    }
    switch (sortOption) {
      case "highest":
        list.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
        break;
      case "lowest":
        list.sort((a, b) => (Number(a.rating) || 0) - (Number(b.rating) || 0));
        break;
      case "helpful":
        list.sort((a, b) => (Number(b.helpfulCount) || 0) - (Number(a.helpfulCount) || 0));
        break;
      case "recent":
      default:
        list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        break;
    }
    return list;
  }, [reviews, starFilter, sortOption]);

  const handleMarkHelpful = async (reviewId) => {
    if (helpfulVoted[reviewId]) return;
    if (!isAuthenticated) {
      toast.error("Please sign in to vote on reviews.");
      return;
    }

    try {
      const res = await reviewService.markHelpful(reviewId);
      const updatedCount =
        res?.data?.helpfulCount ??
        res?.data?.review?.helpfulCount ??
        res?.data?.data?.helpfulCount;

      setHelpfulVoted((prev) => ({ ...prev, [reviewId]: true }));
      setReviews((prev) =>
        prev.map((r) =>
          (r._id || r.id) === reviewId
            ? {
                ...r,
                helpfulCount:
                  typeof updatedCount === "number"
                    ? updatedCount
                    : (Number(r.helpfulCount) || 0) + 1,
              }
            : r
        )
      );
      toast.success("Thank you for your feedback!");
    } catch (err) {
      toast.error(err?.message || "Could not record helpful vote.");
    }
  };

  const primaryImage = product?.images?.[0]?.url || product?.image;

  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Back Link */}
        <Link
          href={`/product/${product.slug || product._id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#004D38] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Product Details
        </Link>

        {/* Product mini header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            {primaryImage && (
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                <Image
                  src={primaryImage}
                  alt={product.name}
                  fill
                  className="object-contain p-2"
                  sizes="80px"
                />
              </div>
            )}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {product.brand?.name || "Verified Audio"}
              </span>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 line-clamp-2">
                {product.name}
              </h1>
              <div className="mt-1 flex items-center gap-2 text-sm">
                <div className="flex items-center text-amber-500">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="ml-1 font-bold">{calculatedAverage.toFixed(1)}</span>
                </div>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500">{totalReviewsCount} customer reviews</span>
              </div>
            </div>
          </div>
          <Link
            href={`/product/${product.slug || product._id}#reviews`}
            className="inline-flex items-center justify-center rounded-xl bg-[#004D38] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#003B2B] transition-colors"
          >
            Write a Review
          </Link>
        </div>

        {/* Reviews Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Ratings Summary */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-900">Rating Breakdown</h2>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-extrabold text-slate-950">
                  {calculatedAverage.toFixed(1)}
                </span>
                <div>
                  <div className="flex text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < Math.floor(calculatedAverage)
                            ? "fill-current"
                            : "stroke-current text-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-slate-500 mt-0.5 block">
                    {totalReviewsCount} verified ratings
                  </span>
                </div>
              </div>

              {/* Breakdown Bars */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                {ratingDistribution.map(({ stars, count, percentage }) => (
                  <button
                    key={stars}
                    type="button"
                    onClick={() => setStarFilter((prev) => (prev === stars ? null : stars))}
                    className={`flex items-center gap-3 w-full text-xs p-1.5 rounded-lg transition-colors text-left ${
                      starFilter === stars ? "bg-emerald-50 text-[#004D38] font-bold" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="w-12 shrink-0">{stars} Stars</span>
                    <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-slate-400 shrink-0">{count}</span>
                  </button>
                ))}
              </div>

              {starFilter !== null && (
                <button
                  type="button"
                  onClick={() => setStarFilter(null)}
                  className="w-full text-center text-xs font-bold text-[#004D38] hover:underline pt-2"
                >
                  Clear star filter
                </button>
              )}
            </div>
          </div>

          {/* Right: Reviews List */}
          <div className="lg:col-span-8 space-y-6">
            {/* Filter and Sort Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-700">
                Showing {filteredAndSortedReviews.length} {filteredAndSortedReviews.length === 1 ? "review" : "reviews"}
              </div>

              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-slate-400" />
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-[#004D38]"
                >
                  <option value="recent">Most Recent</option>
                  <option value="highest">Highest Rating</option>
                  <option value="lowest">Lowest Rating</option>
                  <option value="helpful">Most Helpful</option>
                </select>
              </div>
            </div>

            {/* List */}
            {filteredAndSortedReviews.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                <MessageSquare className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-base font-bold text-slate-800">No matching reviews</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {starFilter !== null
                    ? `There are no ${starFilter}-star reviews for this product yet.`
                    : "No reviews have been published for this item yet."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAndSortedReviews.map((rev) => {
                  const revId = rev._id || rev.id;
                  const ratingScore = Number(rev.rating) || 5;

                  return (
                    <div
                      key={revId}
                      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">
                            {rev.userId?.name || rev.userName || "Verified Customer"}
                          </span>
                          {rev.isVerifiedPurchase && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-[#004D38]">
                              <ShieldCheck className="h-3.5 w-3.5" /> Verified Purchase
                            </span>
                          )}
                        </div>
                        {rev.createdAt && (
                          <span className="text-xs text-slate-400">
                            {new Date(rev.createdAt).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < ratingScore ? "fill-current" : "stroke-current text-slate-200"
                            }`}
                          />
                        ))}
                      </div>

                      {rev.title && (
                        <h4 className="font-bold text-sm text-slate-900">{rev.title}</h4>
                      )}

                      {rev.comment && (
                        <p className="text-sm text-slate-600 leading-relaxed">{rev.comment}</p>
                      )}

                      {rev.vendorResponse && (
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs space-y-1.5 mt-2">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            <Building2 className="h-4 w-4 text-[#004D38]" />
                            <span>Official Vendor Response</span>
                            {rev.vendorRespondedAt && (
                              <span className="text-slate-400 font-normal">
                                • {new Date(rev.vendorRespondedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-600 leading-relaxed">{rev.vendorResponse}</p>
                        </div>
                      )}

                      <div className="pt-2 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => handleMarkHelpful(revId)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#004D38] transition-colors cursor-pointer"
                        >
                          <ThumbsUp
                            className={`h-3.5 w-3.5 ${
                              helpfulVoted[revId] ? "fill-current text-[#004D38]" : ""
                            }`}
                          />
                          <span>Helpful ({Number(rev.helpfulCount) || 0})</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
