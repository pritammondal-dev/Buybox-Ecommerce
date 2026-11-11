"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Star,
  MessageSquare,
  Send,
  CheckCircle2,
  RefreshCw,
  Package,
  Search,
  Filter,
  ThumbsUp,
  X,
  Edit3,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";
import VendorTablePagination from "@/components/vendor/VendorTablePagination";
import { VendorPageHeader, VendorEmptyState } from "@/components/vendor";

export default function VendorReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [overview, setOverview] = useState({
    averageRating: 0,
    totalReviews: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    distributionPercentages: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    answeredCount: 0,
    unansweredCount: 0,
    verifiedCount: 0,
  });
  const [productsList, setProductsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [responseStatus, setResponseStatus] = useState("all"); // 'all' | 'unanswered' | 'answered'
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  // Replying state
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch reviews with current filters
  const loadReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {
        page,
        limit,
        sort: sortBy,
      };

      if (ratingFilter !== "all") params.rating = ratingFilter;
      if (responseStatus === "answered") params.answered = "true";
      if (responseStatus === "unanswered") params.answered = "false";
      if (verifiedOnly) params.verified = "true";
      if (selectedProductId !== "all") params.productId = selectedProductId;
      if (search.trim()) params.search = search.trim();

      const res = await vendorService.getMyReviews(params);
      const data = res?.data?.data || res?.data?.reviews || res?.data || [];
      const items = Array.isArray(data) ? data : data.items || [];
      const resMeta = res?.data?.meta || {};

      setReviews(items);
      setMeta({
        page: resMeta.page || page,
        limit: resMeta.limit || limit,
        total: resMeta.total ?? items.length,
        totalPages: resMeta.totalPages || Math.ceil((resMeta.total ?? items.length) / limit) || 1,
      });

      if (resMeta.overview) {
        setOverview(resMeta.overview);
      }
      if (resMeta.productsList && Array.isArray(resMeta.productsList)) {
        setProductsList(resMeta.productsList);
      }
    } catch (err) {
      toast.error("Failed to load product reviews", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, sortBy, ratingFilter, responseStatus, verifiedOnly, selectedProductId, search]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // Handle Search Debounce / Submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setSearchInput("");
    setRatingFilter("all");
    setResponseStatus("all");
    setVerifiedOnly(false);
    setSelectedProductId("all");
    setSortBy("newest");
    setPage(1);
  };

  const hasActiveFilters = useMemo(() => {
    return (
      Boolean(search) ||
      ratingFilter !== "all" ||
      responseStatus !== "all" ||
      verifiedOnly ||
      selectedProductId !== "all" ||
      sortBy !== "newest"
    );
  }, [search, ratingFilter, responseStatus, verifiedOnly, selectedProductId, sortBy]);

  // Handle Reply or Edit Reply
  const handleStartReply = (review) => {
    setReplyingTo(review._id);
    const existing =
      typeof review.vendorResponse === "string"
        ? review.vendorResponse
        : review.vendorResponse?.comment || "";
    setReplyText(existing);
  };

  const handleSendResponse = async (reviewId) => {
    if (!replyText.trim()) return;
    setIsSubmitting(true);
    try {
      await vendorService.respondToReview(reviewId, replyText.trim());
      toast.success("Merchant response published successfully");
      setReplyingTo(null);
      setReplyText("");
      await loadReviews();
    } catch (err) {
      toast.error("Failed to post merchant response", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for Rating Pill Color (Flipkart Style)
  const getRatingPillColor = (rating) => {
    if (rating >= 4) return "bg-emerald-600 text-white";
    if (rating === 3) return "bg-amber-500 text-white";
    return "bg-rose-600 text-white";
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Customer Product Reviews
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Monitor buyer feedback across your catalog, track customer sentiment, and provide official merchant replies.
          </p>
        </div>

        <button
          onClick={loadReviews}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin text-emerald-600" : ""}`} />
          <span>Refresh Reviews</span>
        </button>
      </div>

      {/* Flipkart-Style Rating Overview Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Left: Overall Rating Badge */}
          <div className="md:col-span-3 text-center md:text-left md:border-r border-slate-100 md:pr-6 space-y-2">
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-slate-400">
              Overall Rating
            </span>
            <div className="flex items-center justify-center md:justify-start gap-2.5">
              <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
                {overview.averageRating ? overview.averageRating.toFixed(1) : "0.0"}
              </span>
              <div className="flex flex-col items-start">
                <div className="flex items-center text-amber-500">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`size-4 ${
                        star <= Math.round(overview.averageRating || 0)
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-200"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 mt-0.5">
                  5.0 Max Score
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Based on <strong className="text-slate-800">{overview.totalReviews || 0}</strong> verified reviews
            </p>
          </div>

          {/* Middle: 5 to 1 Star Progress Breakdown */}
          <div className="md:col-span-5 md:border-r border-slate-100 md:pr-6 space-y-2">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = overview.distribution?.[stars] || 0;
              const pct = overview.distributionPercentages?.[stars] || 0;
              const isSelected = ratingFilter === String(stars);

              return (
                <button
                  key={stars}
                  type="button"
                  onClick={() => {
                    setRatingFilter((prev) => (prev === String(stars) ? "all" : String(stars)));
                    setPage(1);
                  }}
                  className={`w-full flex items-center gap-3 text-xs group py-0.5 px-2 rounded-lg transition-colors cursor-pointer text-left ${
                    isSelected ? "bg-emerald-50 ring-1 ring-emerald-500/20" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="w-7 font-bold text-slate-700 flex items-center gap-1 shrink-0">
                    {stars} <Star className="size-3 fill-amber-400 text-amber-400" />
                  </span>

                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        stars >= 4
                          ? "bg-emerald-500"
                          : stars === 3
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <span className="w-16 text-right font-mono text-[11px] text-slate-400 group-hover:text-slate-700 shrink-0">
                    {count} ({pct}%)
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right: Merchant Response & Trust Badges */}
          <div className="md:col-span-4 grid grid-cols-1 sm:grid-cols-3 md:grid-cols-1 gap-3">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Answered Reviews
                </span>
                <span className="text-base font-black text-slate-800">
                  {overview.answeredCount || 0}
                </span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                {overview.totalReviews > 0
                  ? Math.round(((overview.answeredCount || 0) / overview.totalReviews) * 100)
                  : 0}
                % Response Rate
              </span>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Pending Replies
                </span>
                <span className="text-base font-black text-slate-800">
                  {overview.unansweredCount || 0}
                </span>
              </div>
              {overview.unansweredCount > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setResponseStatus("unanswered");
                    setPage(1);
                  }}
                  className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 cursor-pointer"
                >
                  Needs Attention
                </button>
              ) : (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  All Clear
                </span>
              )}
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Verified Purchases
                </span>
                <span className="text-base font-black text-slate-800">
                  {overview.verifiedCount || 0}
                </span>
              </div>
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 flex items-center gap-1">
                <ShieldCheck className="size-3" />
                Verified
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="size-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by review text, product name, or SKU..."
              className="w-full pl-9 pr-16 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent placeholder:text-slate-400"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setPage(1);
                }}
                className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-[#004D38] text-white text-[11px] font-semibold hover:bg-[#003828] cursor-pointer"
            >
              Search
            </button>
          </form>

          {/* Controls Cluster */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Product Selector */}
            {productsList.length > 0 && (
              <select
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer max-w-[180px] truncate"
              >
                <option value="all">All Products</option>
                {productsList.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}

            {/* Star Rating Dropdown */}
            <select
              value={ratingFilter}
              onChange={(e) => {
                setRatingFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
            >
              <option value="all">All Ratings</option>
              <option value="5">5 Stars Only</option>
              <option value="4">4 Stars Only</option>
              <option value="3">3 Stars Only</option>
              <option value="2">2 Stars Only</option>
              <option value="1">1 Star Only</option>
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="rating_high">Rating: High to Low</option>
              <option value="rating_low">Rating: Low to High</option>
              <option value="helpful">Most Helpful</option>
            </select>
          </div>
        </div>

        {/* Response Status Tabs & Verified Toggle */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => {
                setResponseStatus("all");
                setPage(1);
              }}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                responseStatus === "all"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "hover:text-slate-900"
              }`}
            >
              All Reviews ({overview.totalReviews || 0})
            </button>
            <button
              type="button"
              onClick={() => {
                setResponseStatus("unanswered");
                setPage(1);
              }}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                responseStatus === "unanswered"
                  ? "bg-white text-amber-900 shadow-xs"
                  : "hover:text-slate-900"
              }`}
            >
              <span>Needs Reply</span>
              {overview.unansweredCount > 0 && (
                <span className="size-2 rounded-full bg-amber-500" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setResponseStatus("answered");
                setPage(1);
              }}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                responseStatus === "answered"
                  ? "bg-white text-emerald-900 shadow-xs"
                  : "hover:text-slate-900"
              }`}
            >
              Answered ({overview.answeredCount || 0})
            </button>
          </div>

          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => {
                  setVerifiedOnly(e.target.checked);
                  setPage(1);
                }}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 size-3.5"
              />
              <span>Verified Purchases Only</span>
            </label>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1 cursor-pointer"
              >
                <X className="size-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reviews List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 bg-slate-100 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <VendorEmptyState
          icon={Star}
          title={hasActiveFilters ? "No Matching Reviews" : "No Customer Reviews Yet"}
          description={
            hasActiveFilters
              ? "No product reviews matched your filter and search criteria. Try loosening filters."
              : "Customer reviews for products sold by your vendor account will appear here."
          }
          action={
            hasActiveFilters
              ? {
                  label: "Clear All Filters",
                  onClick: handleClearFilters,
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {reviews.map((rev) => {
            const prod = rev.product || {};
            const variant = rev.variant;
            const customer = rev.customer || {};
            const isEditing = replyingTo === rev._id;

            return (
              <div
                key={rev._id}
                className="bg-white rounded-3xl border border-slate-200/80 p-6 space-y-4 shadow-xs hover:border-slate-300 transition-colors"
              >
                {/* Header: Rating Badge + Title + Date */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Flipkart-Style Rating Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-black shadow-xs ${getRatingPillColor(
                        rev.rating || 5
                      )}`}
                    >
                      <span>{rev.rating || 5}</span>
                      <Star className="size-3 fill-current" />
                    </span>

                    {/* Review Title */}
                    <h3 className="text-sm font-bold text-slate-900">
                      {rev.title || "Verified Product Review"}
                    </h3>
                  </div>

                  <span className="text-[11px] text-slate-400">
                    {rev.createdAt
                      ? new Date(rev.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Recent"}
                  </span>
                </div>

                {/* Product Context Strip */}
                <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-10 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 relative">
                      {prod.thumbnail ? (
                        <Image
                          src={prod.thumbnail}
                          alt={prod.name || "Product"}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      ) : (
                        <Package className="size-5 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 truncate block">
                        {prod.name || "Catalog Product"}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono flex-wrap">
                        {prod.sku && <span>SKU: {prod.sku}</span>}
                        {variant?.name && (
                          <span className="text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                            Variant: {variant.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {prod.slug && (
                    <Link
                      href={`/products/${prod.slug}`}
                      target="_blank"
                      className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline shrink-0 hidden sm:inline-block"
                    >
                      View Live
                    </Link>
                  )}
                </div>

                {/* Review Body */}
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed pl-1">
                  &ldquo;{rev.comment || "No detailed review comments provided."}&rdquo;
                </p>

                {/* Customer Trust Attribution & Helpful Votes */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-slate-800">
                      {customer.displayName || "Verified Customer"}
                    </span>
                    {rev.isVerifiedPurchase && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="size-3 text-emerald-600" />
                        <span>Verified Purchase</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-slate-400 text-xs">
                    {(rev.helpfulCount || 0) > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                        <ThumbsUp className="size-3 text-slate-400" />
                        <span>{rev.helpfulCount} found helpful</span>
                      </span>
                    )}

                    {!rev.vendorResponse && !isEditing && (
                      <button
                        type="button"
                        onClick={() => handleStartReply(rev)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>Reply as Merchant</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Official Merchant Response Callout */}
                {rev.vendorResponse && !isEditing && (
                  <div className="mt-3 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/70 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                        <span>Official Merchant Response</span>
                        {rev.vendorRespondedAt && (
                          <span className="text-[11px] text-emerald-700/80 font-normal ml-1">
                            • Replied on{" "}
                            {new Date(rev.vendorRespondedAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleStartReply(rev)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 cursor-pointer"
                      >
                        <Edit3 className="size-3" />
                        <span>Edit Reply</span>
                      </button>
                    </div>

                    <p className="text-emerald-900/90 leading-relaxed pl-5">
                      {typeof rev.vendorResponse === "string"
                        ? rev.vendorResponse
                        : rev.vendorResponse.comment}
                    </p>
                  </div>
                )}

                {/* Inline Reply Editor */}
                {isEditing && (
                  <div className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span className="flex items-center gap-1.5">
                        <MessageSquare className="size-3.5 text-emerald-600" />
                        <span>
                          {rev.vendorResponse ? "Edit Merchant Response" : "Write Merchant Response"}
                        </span>
                      </span>
                      <span className="text-[11px] text-slate-400 font-normal font-mono">
                        {replyText.length} / 2000
                      </span>
                    </div>

                    <textarea
                      rows={3}
                      maxLength={2000}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a professional and polite merchant response to address the buyer's feedback..."
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent leading-relaxed"
                    />

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyText("");
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isSubmitting || !replyText.trim()}
                        onClick={() => handleSendResponse(rev._id)}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Send className="size-3" />
                        <span>{isSubmitting ? "Publishing..." : "Publish Response"}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="pt-2">
              <VendorTablePagination
                page={meta.page}
                limit={meta.limit}
                total={meta.total}
                totalPages={meta.totalPages}
                onPageChange={(newPage) => setPage(newPage)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
