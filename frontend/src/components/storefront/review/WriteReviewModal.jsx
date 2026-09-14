"use client";

import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Star, X, ShieldCheck, Loader2, AlertCircle, Info } from "lucide-react";
import { toast } from "sonner";
import { reviewService } from "../../../services/review.service.js";
import { Button } from "../../ui/Button.jsx";

/**
 * Accessible Write & Edit Review Modal
 * Strictly conforms to backend createReviewSchema & updateReviewSchema.
 */
export function WriteReviewModal({
  isOpen,
  onClose,
  orderId,
  productId,
  productVariantId = null,
  productName = "Product",
  orderNumber = "",
  existingReview = null,
  onSuccess,
}) {
  const isEditing = Boolean(existingReview?._id || existingReview?.id);

  const [rating, setRating] = useState(() => Number(existingReview?.rating) || 5);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState(() => existingReview?.title || "");
  const [comment, setComment] = useState(() => existingReview?.comment || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (rating < 1 || rating > 5) {
      setErrorMessage("Please select a rating between 1 and 5 stars.");
      return;
    }

    if (title.length > 150) {
      setErrorMessage("Review title cannot exceed 150 characters.");
      return;
    }

    if (comment.length > 2000) {
      setErrorMessage("Review details cannot exceed 2000 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing) {
        const reviewId = existingReview._id || existingReview.id;
        const res = await reviewService.updateReview(reviewId, {
          rating,
          title: title.trim() || null,
          comment: comment.trim() || null,
        });

        toast.success("Review updated successfully!", {
          description: "Your changes have been saved.",
        });

        if (onSuccess) onSuccess(res?.data?.review || res?.data);
      } else {
        if (!orderId || !productId) {
          throw new Error("Missing required order or product reference.");
        }

        const payload = {
          orderId,
          productId,
          productVariantId: productVariantId || null,
          rating,
          title: title.trim() || null,
          comment: comment.trim() || null,
        };

        const res = await reviewService.createReview(payload);

        toast.success("Review submitted for moderation!", {
          description:
            "Thank you for your feedback. Your review will be publicly visible once approved.",
        });

        if (onSuccess) onSuccess(res?.data?.review || res?.data);
      }

      onClose();
    } catch (err) {
      const code = err?.code || err?.response?.data?.code;
      let msg = err?.message || "Failed to submit review.";

      if (code === "ORDER_NOT_ELIGIBLE_FOR_REVIEW") {
        msg = "Reviews can only be submitted for delivered or completed orders.";
      } else if (code === "PRODUCT_NOT_IN_ORDER") {
        msg = "This product was not purchased in this specified order.";
      } else if (code === "REVIEW_ALREADY_EXISTS") {
        msg = "You have already submitted a review for this product on this order.";
      } else if (code === "REVIEW_NOT_EDITABLE") {
        msg = "Only pending reviews can be modified. Approved reviews are locked.";
      }

      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentDisplayRating = hoverRating > 0 ? hoverRating : rating;

  const RATING_LABELS = {
    1: "Poor — Did not meet expectations",
    2: "Fair — Below average",
    3: "Average — Satisfactory",
    4: "Good — Met expectations",
    5: "Excellent — Exceeded expectations",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1 pr-6">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-[#007A55]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#007A55]">
                Verified Customer Review
              </span>
            </div>
            <h2 id="review-modal-title" className="text-base sm:text-lg font-black text-slate-950 leading-snug">
              {isEditing ? "Edit Review" : `Review ${productName}`}
            </h2>
            {orderNumber && (
              <p className="text-xs text-muted-foreground">
                Purchased in Order #{orderNumber}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800 flex items-start gap-2.5">
            <AlertCircle className="size-4 shrink-0 text-rose-600 mt-0.5" />
            <p className="font-medium leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {/* Review Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Star Rating Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold text-slate-800">
              Overall Rating <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  disabled={isSubmitting}
                  className="p-1 cursor-pointer transition-transform hover:scale-110 focus:outline-hidden"
                  aria-label={`${star} Star${star > 1 ? "s" : ""}`}
                >
                  <Star
                    className={`size-7 transition-colors ${
                      star <= currentDisplayRating
                        ? "fill-amber-400 text-amber-400"
                        : "stroke-slate-300 text-slate-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              {RATING_LABELS[currentDisplayRating] || ""}
            </p>
          </div>

          {/* Headline / Title */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label htmlFor="review-title" className="block text-xs font-extrabold text-slate-800">
                Headline / Title <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                {title.length}/150
              </span>
            </div>
            <input
              id="review-title"
              type="text"
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              placeholder="e.g. Excellent build quality and fast delivery"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-[#007A55] focus:ring-1 focus:ring-[#007A55]"
            />
          </div>

          {/* Detailed Comment */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label htmlFor="review-comment" className="block text-xs font-extrabold text-slate-800">
                Review Details <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                {comment.length}/2000
              </span>
            </div>
            <textarea
              id="review-comment"
              rows={4}
              maxLength={2000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={isSubmitting}
              placeholder="What did you like or dislike? How does it perform in real usage?"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-[#007A55] focus:ring-1 focus:ring-[#007A55]"
            />
          </div>

          {/* Moderation Disclosure */}
          <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3 text-[11px] text-slate-600 flex items-start gap-2">
            <Info className="size-4 text-[#007A55] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Reviews are verified against purchase records and screened by our moderation team before public display.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-[#007A55] text-white hover:bg-[#004D38] px-5 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Submitting...</span>
                </span>
              ) : (
                <span>{isEditing ? "Save Changes" : "Submit Review"}</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

WriteReviewModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  orderId: PropTypes.string,
  productId: PropTypes.string.isRequired,
  productVariantId: PropTypes.string,
  productName: PropTypes.string,
  orderNumber: PropTypes.string,
  existingReview: PropTypes.object,
  onSuccess: PropTypes.func,
};

export default WriteReviewModal;
