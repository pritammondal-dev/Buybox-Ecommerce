"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Star,
  MessageSquare,
  ShieldCheck,
  ThumbsUp,
  AlertCircle,
  Building2,
  SlidersHorizontal,
  PlusCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../hooks/useAuth.js";
import { reviewService } from "../../../services/review.service.js";
import { orderService } from "../../../services/order.service.js";
import { Button } from "../../ui/Button.jsx";
import { WriteReviewModal } from "../review/WriteReviewModal.jsx";

export function ProductTabs({
  product,
  brand,
  category,
  initialActiveTab = "description",
}) {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState(initialActiveTab);

  const productId = product?._id || product?.id;

  // Real Reviews State
  const [reviews, setReviews] = useState([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(Boolean(productId));
  const [helpfulVoted, setHelpfulVoted] = useState({});

  // Review Filtering & Sorting State
  const [sortOption, setSortOption] = useState("recent");
  const [starFilter, setStarFilter] = useState(null);

  // Review Creation / Eligibility State
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [eligibleOrders, setEligibleOrders] = useState([]);
  const [isLoadingEligibility, setIsLoadingEligibility] = useState(false);

  // Load reviews on mount
  useEffect(() => {
    if (!productId) return;
    let isMounted = true;

    async function loadReviews() {
      try {
        const res = await reviewService.getProductReviews(productId);
        if (!isMounted) return;
        const list = Array.isArray(res?.data) ? res.data : res?.data?.reviews || [];
        setReviews(list);
      } catch {
        if (!isMounted) return;
        setReviews([]);
      } finally {
        if (isMounted) {
          setIsLoadingReviews(false);
        }
      }
    }

    loadReviews();

    return () => {
      isMounted = false;
    };
  }, [productId]);

  // Check customer verified purchase eligibility from real orders
  useEffect(() => {
    let isMounted = true;

    async function checkEligibility() {
      if (!isAuthenticated || !productId) {
        if (isMounted) {
          setEligibleOrders([]);
        }
        return;
      }

      setIsLoadingEligibility(true);
      try {
        const res = await orderService.getMyOrders();
        if (!isMounted) return;
        const allOrders = Array.isArray(res?.data) ? res.data : [];
        const deliveredWithProduct = allOrders.filter((o) => {
          const isDelivered =
            o.status === "delivered" || o.status === "completed";
          if (!isDelivered) return false;
          return o.items?.some(
            (item) => (item.productId || "").toString() === productId.toString()
          );
        });
        setEligibleOrders(deliveredWithProduct);
      } catch {
        if (isMounted) setEligibleOrders([]);
      } finally {
        if (isMounted) setIsLoadingEligibility(false);
      }
    }

    checkEligibility();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, productId]);

  // Mark Helpful handler
  const handleMarkHelpful = async (reviewId) => {
    if (helpfulVoted[reviewId]) return;

    if (!isAuthenticated) {
      toast.error("Please sign in to vote on reviews.", {
        description: "Only authenticated customers can mark reviews as helpful.",
      });
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

  // Compute real rating distribution strictly from actual reviews array
  const totalReviewsCount = reviews.length;
  const calculatedAverage =
    totalReviewsCount > 0
      ? reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0) /
        totalReviewsCount
      : 0;

  const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = reviews.filter(
      (r) => Math.round(Number(r.rating) || 0) === stars
    ).length;
    const percentage =
      totalReviewsCount > 0 ? Math.round((count / totalReviewsCount) * 100) : 0;
    return { stars, count, percentage };
  });

  // Client-side filtered & sorted reviews
  const filteredAndSortedReviews = useMemo(() => {
    let list = [...reviews];

    if (starFilter !== null) {
      list = list.filter(
        (r) => Math.round(Number(r.rating) || 0) === starFilter
      );
    }

    switch (sortOption) {
      case "highest":
        list.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
        break;
      case "lowest":
        list.sort((a, b) => (Number(a.rating) || 0) - (Number(b.rating) || 0));
        break;
      case "helpful":
        list.sort(
          (a, b) => (Number(b.helpfulCount) || 0) - (Number(a.helpfulCount) || 0)
        );
        break;
      case "recent":
      default:
        list.sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );
        break;
    }

    return list;
  }, [reviews, starFilter, sortOption]);

  const specificationsMap = product?.specifications || {};
  const customSpecEntries = specificationsMap instanceof Map
    ? Array.from(specificationsMap.entries())
    : typeof specificationsMap === "object"
      ? Object.entries(specificationsMap)
      : [];

  return (
    <div id="product-details-tabs" className="mt-14 sm:mt-18 border-t border-slate-200 pt-8 sm:pt-10">
      {/* Tab Navigation Buttons */}
      <div className="flex items-center gap-6 sm:gap-8 border-b border-slate-200 overflow-x-auto scrollbar-none pb-4">
        <button
          type="button"
          onClick={() => setActiveTab("description")}
          className={`text-sm sm:text-base font-bold tracking-tight transition-colors cursor-pointer relative pb-4 shrink-0 ${
            activeTab === "description"
              ? "text-[#007A55]"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <span>Product Overview</span>
          {activeTab === "description" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007A55] rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("specifications")}
          className={`text-sm sm:text-base font-bold tracking-tight transition-colors cursor-pointer relative pb-4 shrink-0 ${
            activeTab === "specifications"
              ? "text-[#007A55]"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <span>Technical Specifications</span>
          {activeTab === "specifications" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007A55] rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reviews")}
          className={`text-sm sm:text-base font-bold tracking-tight transition-colors cursor-pointer relative pb-4 shrink-0 ${
            activeTab === "reviews"
              ? "text-[#007A55]"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <span>Customer Reviews ({totalReviewsCount})</span>
          {activeTab === "reviews" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007A55] rounded-full" />
          )}
        </button>
      </div>

      {/* Tab 1: Product Overview (Strictly Real Backend Content) */}
      {activeTab === "description" && (
        <div className="py-6 max-w-4xl space-y-5 text-sm leading-relaxed text-slate-700">
          {product?.shortDescription && (
            <p className="font-semibold text-slate-900 text-base">
              {product.shortDescription}
            </p>
          )}

          {product?.description ? (
            <p className="whitespace-pre-line">{product.description}</p>
          ) : (
            <p className="text-slate-500 italic">
              No additional description provided by the manufacturer.
            </p>
          )}

          {Array.isArray(product?.tags) && product.tags.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Categorized Tags:
              </span>
              <div className="flex flex-wrap gap-2">
                {product.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Technical Specifications (Strict Real Data Only) */}
      {activeTab === "specifications" && (
        <div className="py-6 max-w-2xl">
          <table className="w-full text-xs text-left border border-slate-200 rounded-2xl overflow-hidden">
            <tbody>
              {product?.sku && (
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <td className="p-3.5 font-semibold text-slate-500 w-1/3">SKU Identifier</td>
                  <td className="p-3.5 text-slate-900 font-mono font-medium">{product.sku}</td>
                </tr>
              )}
              {brand?.name && (
                <tr className="border-b border-slate-100">
                  <td className="p-3.5 font-semibold text-slate-500">Brand Name</td>
                  <td className="p-3.5 text-slate-900 font-medium">{brand.name}</td>
                </tr>
              )}
              {category?.name && (
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <td className="p-3.5 font-semibold text-slate-500">Product Category</td>
                  <td className="p-3.5 text-slate-900 font-medium">{category.name}</td>
                </tr>
              )}
              {product?.taxCategory && (
                <tr className="border-b border-slate-100">
                  <td className="p-3.5 font-semibold text-slate-500">Tax Category</td>
                  <td className="p-3.5 text-slate-900 font-medium">{product.taxCategory}</td>
                </tr>
              )}
              {product?.isTaxable !== undefined && (
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <td className="p-3.5 font-semibold text-slate-500">Tax Treatment</td>
                  <td className="p-3.5 text-slate-900 font-medium">
                    {product.isTaxable ? "Taxable (GST applied at checkout)" : "Exempt"}
                  </td>
                </tr>
              )}
              {/* Custom specification key-values directly from backend */}
              {customSpecEntries.map(([key, val], idx) => (
                <tr
                  key={key}
                  className={`border-b border-slate-100 ${idx % 2 === 0 ? "" : "bg-slate-50/50"}`}
                >
                  <td className="p-3.5 font-semibold text-slate-500 capitalize">{key}</td>
                  <td className="p-3.5 text-slate-900 font-medium">{String(val)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Customer Reviews (Real Reviews + Real Distribution) */}
      {activeTab === "reviews" && (
        <div className="py-6 grid grid-cols-1 gap-10 lg:grid-cols-12">
          {/* Reviews List & Real Rating Breakdown (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Real Rating Breakdown Summary */}
            {totalReviewsCount > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-3xl font-black text-slate-950">
                    {calculatedAverage.toFixed(1)}
                  </span>
                  <div>
                    <div className="flex items-center text-amber-400">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={`stars-summary-${i}`}
                          className={`size-4 ${
                            i < Math.floor(calculatedAverage)
                              ? "fill-current"
                              : "stroke-current text-slate-300"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground mt-0.5 block">
                      Based on {totalReviewsCount} verified customer{" "}
                      {totalReviewsCount === 1 ? "review" : "reviews"}
                    </span>
                  </div>
                </div>

                {/* Rating Distribution Bars strictly from real reviews */}
                <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                  {ratingDistribution.map(({ stars, count, percentage }) => (
                    <button
                      key={`dist-${stars}`}
                      type="button"
                      onClick={() =>
                        setStarFilter((prev) => (prev === stars ? null : stars))
                      }
                      className="flex items-center gap-3 text-xs text-slate-600 w-full hover:bg-slate-100/60 p-1 rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <span className="w-12 font-medium">{stars} Stars</span>
                      <div className="h-2 flex-1 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-slate-400">
                        {count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Controls: Filter & Sort */}
            {totalReviewsCount > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
                  <button
                    type="button"
                    onClick={() => setStarFilter(null)}
                    className={`rounded-full px-3 py-1 font-bold transition-all cursor-pointer ${
                      starFilter === null
                        ? "bg-[#007A55] text-white shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    All ({totalReviewsCount})
                  </button>
                  {[5, 4, 3, 2, 1].map((s) => {
                    const count = reviews.filter(
                      (r) => Math.round(Number(r.rating) || 0) === s
                    ).length;
                    if (count === 0) return null;
                    return (
                      <button
                        key={`chip-${s}`}
                        type="button"
                        onClick={() =>
                          setStarFilter((prev) => (prev === s ? null : s))
                        }
                        className={`rounded-full px-3 py-1 font-bold transition-all cursor-pointer ${
                          starFilter === s
                            ? "bg-[#007A55] text-white shadow-xs"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {s}★ ({count})
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <SlidersHorizontal className="size-3.5 text-slate-400" />
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 outline-none focus:border-[#007A55]"
                  >
                    <option value="recent">Most Recent</option>
                    <option value="highest">Highest Rating</option>
                    <option value="lowest">Lowest Rating</option>
                    <option value="helpful">Most Helpful</option>
                  </select>
                </div>
              </div>
            )}

            {/* Reviews List */}
            {isLoadingReviews ? (
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={`skel-rev-${i}`}
                    className="p-4 rounded-xl border bg-slate-50 space-y-2 animate-pulse"
                  >
                    <div className="h-4 bg-slate-200 rounded w-1/4" />
                    <div className="h-3 bg-slate-200 rounded w-3/4" />
                  </div>
                ))}
              </div>
            ) : filteredAndSortedReviews.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-muted-foreground space-y-2">
                <MessageSquare className="size-8 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-700">
                  {starFilter !== null
                    ? `No ${starFilter}-star reviews found.`
                    : "No customer reviews published yet for this product."}
                </p>
                {starFilter !== null && (
                  <button
                    type="button"
                    onClick={() => setStarFilter(null)}
                    className="text-[#007A55] hover:underline font-bold"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAndSortedReviews.map((rev) => {
                  const revId = rev._id || rev.id;
                  const ratingScore = Number(rev.rating) || 5;

                  return (
                    <div
                      key={revId}
                      className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">
                            Verified Customer
                          </span>
                          {rev.isVerifiedPurchase && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-[#007A55]">
                              <ShieldCheck className="size-3" />
                              <span>Verified Purchase</span>
                            </span>
                          )}
                        </div>

                        {rev.createdAt && (
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(rev.createdAt).toLocaleDateString(
                              "en-IN",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )}
                          </span>
                        )}
                      </div>

                      {/* Stars */}
                      <div className="flex items-center gap-1 text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={`star-rev-${revId}-${i}`}
                            className={`size-3.5 ${
                              i < ratingScore
                                ? "fill-current"
                                : "stroke-current text-slate-200"
                            }`}
                          />
                        ))}
                      </div>

                      {rev.title && (
                        <h4 className="font-bold text-xs text-slate-900">
                          {rev.title}
                        </h4>
                      )}

                      {rev.comment && (
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {rev.comment}
                        </p>
                      )}

                      {/* Real Vendor Response Block */}
                      {rev.vendorResponse && (
                        <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3 text-xs space-y-1 mt-2">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                            <Building2 className="size-3.5 text-[#007A55]" />
                            <span>Official Vendor Response</span>
                            {rev.vendorRespondedAt && (
                              <span className="text-slate-400 font-normal text-[10px]">
                                •{" "}
                                {new Date(
                                  rev.vendorRespondedAt
                                ).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-600 text-[11px] leading-relaxed">
                            {rev.vendorResponse}
                          </p>
                        </div>
                      )}

                      {/* Helpful Button with Real Count */}
                      <div className="pt-2 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => handleMarkHelpful(revId)}
                          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#007A55] transition-colors cursor-pointer"
                        >
                          <ThumbsUp
                            className={`size-3.5 ${
                              helpfulVoted[revId]
                                ? "fill-current text-[#007A55]"
                                : ""
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

          {/* Write a Review Section (5 cols) */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-black text-slate-950 uppercase tracking-wider">
                Customer Reviews
              </h3>

              {!isAuthenticated ? (
                <div className="rounded-xl bg-white border border-slate-200 p-5 text-center space-y-3">
                  <ShieldCheck className="size-8 text-[#007A55] mx-auto" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-900">
                      Purchased this product?
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Sign in to your Buybox account to submit a verified
                      customer review once your order is delivered.
                    </p>
                  </div>
                  <Link
                    href={`/auth/login?redirect=/product/${product?.slug || productId}#reviews`}
                    className="inline-block rounded-full bg-[#007A55] hover:bg-[#004D38] text-white font-bold text-xs px-5 py-2 transition-colors shadow-xs"
                  >
                    Sign In to Review
                  </Link>
                </div>
              ) : isLoadingEligibility ? (
                <div className="p-4 bg-white rounded-xl border animate-pulse space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-2/3" />
                  <div className="h-3 bg-slate-100 rounded w-full" />
                </div>
              ) : eligibleOrders.length > 0 ? (
                <div className="rounded-xl bg-white border border-emerald-200 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <ShieldCheck className="size-5 text-[#007A55]" />
                    <span className="text-xs font-bold">
                      Verified Purchase Eligible
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    You purchased this item in Order #
                    {eligibleOrders[0]?.orderNumber || "BB-ORDER"}. Share your
                    honest feedback with other customers.
                  </p>
                  <Button
                    type="button"
                    onClick={() => setIsWriteModalOpen(true)}
                    className="w-full rounded-full bg-[#007A55] text-white hover:bg-[#004D38] font-bold text-xs py-2.5 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <PlusCircle className="size-4" />
                    <span>Write a Product Review</span>
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="size-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900">
                        Verified Purchase Policy
                      </p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        To maintain authentic reviews, Buybox accepts reviews
                        only from customers with a completed and delivered
                        order.
                      </p>
                      <Link
                        href="/account/orders"
                        className="inline-block pt-1 font-bold text-[#007A55] hover:underline"
                      >
                        View your order history &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Review Modal Dialog */}
      {isWriteModalOpen && eligibleOrders.length > 0 && (
        <WriteReviewModal
          isOpen={isWriteModalOpen}
          onClose={() => setIsWriteModalOpen(false)}
          orderId={eligibleOrders[0]._id || eligibleOrders[0].id}
          productId={productId}
          productName={product?.name || "Product"}
          orderNumber={eligibleOrders[0].orderNumber || ""}
          onSuccess={() => {
            setIsWriteModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default ProductTabs;
