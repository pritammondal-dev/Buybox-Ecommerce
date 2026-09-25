"use client";

import React, { useState, useEffect } from "react";
import {
  Star,
  MessageSquare,
  Send,
  CheckCircle2,
  RefreshCw,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";

export default function VendorReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    vendorService
      .getMyReviews()
      .then((res) => {
        if (!isMounted) return;
        const data = res?.data?.data || res?.data?.reviews || res?.data || [];
        const items = Array.isArray(data) ? data : data.items || [];
        setReviews(items);
      })
      .catch((err) => {
        if (!isMounted) return;
        toast.error("Failed to load product reviews", {
          description: err.response?.data?.message || err.message,
        });
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const res = await vendorService.getMyReviews();
      const data = res?.data?.data || res?.data?.reviews || res?.data || [];
      const items = Array.isArray(data) ? data : data.items || [];
      setReviews(items);
    } catch (err) {
      toast.error("Failed to load product reviews", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendResponse = async (reviewId) => {
    if (!replyText.trim()) return;
    setIsSubmitting(true);
    try {
      await vendorService.respondToReview(reviewId, replyText.trim());
      toast.success("Merchant response posted successfully");
      setReplyingTo(null);
      setReplyText("");
      handleRefresh();
    } catch (err) {
      toast.error("Failed to post merchant response", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Customer Product Reviews
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Monitor buyer feedback across your catalog and provide official merchant replies.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors"
        >
          <RefreshCw className="size-3.5" />
          <span>Refresh Reviews</span>
        </button>
      </div>

      {/* Reviews List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-slate-100 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200">
          <Star className="size-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-800">No Reviews Yet</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Reviews left by verified purchasers on your product listings will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((rev) => (
            <div
              key={rev._id}
              className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center text-amber-500">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`size-3.5 ${
                          star <= (rev.rating || 5) ? "fill-current" : "text-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-slate-900">
                    {rev.title || `${rev.rating || 5} Stars Rating`}
                  </span>
                </div>

                <span className="text-[11px] text-slate-400">
                  {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString("en-IN") : "Recent"}
                </span>
              </div>

              <div className="text-xs text-slate-500 font-medium">
                Product: <span className="font-semibold text-slate-800">{rev.productId?.name || rev.productId?.title || "Product Listing"}</span>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                &ldquo;{rev.comment || rev.content || "Great product as described."}&rdquo;
              </p>

              {/* Vendor response if present */}
              {rev.vendorResponse ? (
                <div className="mt-3 p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-xs text-emerald-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                    <span>Official Merchant Response</span>
                  </div>
                  <p className="text-emerald-900/90 leading-relaxed pl-5">
                    {rev.vendorResponse.comment || rev.vendorResponse}
                  </p>
                </div>
              ) : replyingTo === rev._id ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    rows={3}
                    placeholder="Write an official merchant reply to this customer review..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyText("");
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting || !replyText.trim()}
                      onClick={() => handleSendResponse(rev._id)}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                    >
                      <Send className="size-3" />
                      <span>{isSubmitting ? "Posting..." : "Post Response"}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingTo(rev._id);
                      setReplyText("");
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    <MessageSquare className="size-3.5" />
                    <span>Reply as Merchant</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
