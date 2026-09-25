"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  HelpCircle,
  MessageCircle,
  ThumbsUp,
  Search,
  ArrowLeft,
  CheckCircle2,
  Building2,
  Send,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../../../hooks/useAuth.js";
import { questionService } from "../../../../../services/question.service.js";

export function ProductQuestionsPageView({ product, initialQuestions = [] }) {
  const { isAuthenticated, user } = useAuth();
  const [questions, setQuestions] = useState(initialQuestions);
  const [searchQuery, setSearchQuery] = useState("");
  const [newQuestionText, setNewQuestionText] = useState("");
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);
  const [showAskBox, setShowAskBox] = useState(false);
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [helpfulVoted, setHelpfulVoted] = useState({});

  const productId = product?._id || product?.id;
  const primaryImage = product?.images?.[0]?.url || product?.image;

  // Filter questions by search query
  const filteredQuestions = useMemo(() => {
    if (!searchQuery.trim()) return questions;
    const q = searchQuery.toLowerCase();
    return questions.filter(
      (item) =>
        item.question?.toLowerCase().includes(q) ||
        item.answers?.some((a) => a.answer?.toLowerCase().includes(q))
    );
  }, [questions, searchQuery]);

  // Handle Ask Question
  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;

    if (!isAuthenticated) {
      toast.error("Please sign in to ask a question.", {
        description: "Only verified members can post community questions.",
      });
      return;
    }

    setIsSubmittingQuestion(true);
    try {
      const res = await questionService.askQuestion({
        productId,
        question: newQuestionText.trim(),
      });
      const created = res?.data?.data || res?.data;
      if (created) {
        setQuestions((prev) => [created, ...prev]);
      }
      setNewQuestionText("");
      setShowAskBox(false);
      toast.success("Question submitted successfully!", {
        description: "Our community and product team will review and respond shortly.",
      });
    } catch (err) {
      toast.error(err?.message || "Could not submit question.");
    } finally {
      setIsSubmittingQuestion(false);
    }
  };

  // Handle Reply to Question
  const handleAnswerQuestion = async (questionId) => {
    if (!replyText.trim()) return;

    if (!isAuthenticated) {
      toast.error("Please sign in to answer questions.");
      return;
    }

    setIsSubmittingReply(true);
    try {
      const res = await questionService.answerQuestion(questionId, {
        answer: replyText.trim(),
      });
      const updatedQuestion = res?.data?.data || res?.data;

      setQuestions((prev) =>
        prev.map((q) => ((q._id || q.id) === questionId ? updatedQuestion : q))
      );
      setReplyingToId(null);
      setReplyText("");
      toast.success("Answer posted successfully!");
    } catch (err) {
      toast.error(err?.message || "Could not post answer.");
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Handle Helpful Vote on Question
  const handleQuestionHelpful = async (questionId) => {
    if (helpfulVoted[questionId]) return;
    if (!isAuthenticated) {
      toast.error("Please sign in to vote.");
      return;
    }

    try {
      await questionService.markQuestionHelpful(questionId);
      setHelpfulVoted((prev) => ({ ...prev, [questionId]: true }));
      setQuestions((prev) =>
        prev.map((q) =>
          (q._id || q.id) === questionId
            ? { ...q, helpfulCount: (Number(q.helpfulCount) || 0) + 1 }
            : q
        )
      );
      toast.success("Marked as helpful!");
    } catch (err) {
      toast.error(err?.message || "Failed to vote.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Back Link */}
        <Link
          href={`/product/${product.slug || productId}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#004D38] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Product Details
        </Link>

        {/* Product Header */}
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
                Customer Q&A
              </span>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 line-clamp-2">
                {product.name}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {questions.length} answered questions from the Buybox community
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAskBox(!showAskBox)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#004D38] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#003B2B] transition-colors"
          >
            <Plus className="h-4 w-4" /> Ask a Question
          </button>
        </div>

        {/* Ask Question Collapsible Box */}
        {showAskBox && (
          <form
            onSubmit={handleAskQuestion}
            className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-6 shadow-sm space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-[#004D38]" /> Ask about this product
            </h3>
            <textarea
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              placeholder="e.g. Does this headphone amp support 600 ohm dynamic drivers? What cables are included in the box?"
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-[#004D38] focus:ring-1 focus:ring-[#004D38]"
              required
            />
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAskBox(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingQuestion || !newQuestionText.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#004D38] px-5 py-2 text-xs font-bold text-white hover:bg-[#003B2B] transition-colors disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" /> Submit Question
              </button>
            </div>
          </form>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Have a question? Search for answers on specs, compatibility, warranty..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm text-slate-800 placeholder-slate-400 shadow-sm outline-none focus:border-[#004D38] focus:ring-1 focus:ring-[#004D38]"
          />
        </div>

        {/* Questions List */}
        {filteredQuestions.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <HelpCircle className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-base font-bold text-slate-800">
              {searchQuery ? "No matching questions found" : "No questions asked yet"}
            </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? `We couldn't find any questions matching "${searchQuery}". Be the first to ask!`
                : "Have a question about specifications, compatibility, or packaging? Ask the seller or community."}
            </p>
            <button
              type="button"
              onClick={() => setShowAskBox(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#004D38] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#003B2B] transition-colors"
            >
              <Plus className="h-4 w-4" /> Ask a Question
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredQuestions.map((item) => {
              const qId = item._id || item.id;
              const hasAnswers = Array.isArray(item.answers) && item.answers.length > 0;

              return (
                <div
                  key={qId}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
                >
                  {/* Question */}
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md bg-[#004D38] text-white text-xs font-extrabold">
                      Q
                    </span>
                    <div className="flex-1 space-y-1">
                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {item.question}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>Asked by {item.userId?.name || "Customer"}</span>
                        {item.createdAt && (
                          <>
                            <span>•</span>
                            <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Answers */}
                  {hasAnswers ? (
                    <div className="space-y-3 pl-9">
                      {item.answers.map((ans, idx) => (
                        <div
                          key={ans._id || idx}
                          className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 border border-slate-100"
                        >
                          <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-[#004D38] text-xs font-bold">
                            A
                          </span>
                          <div className="flex-1 space-y-1">
                            <p className="text-sm text-slate-700 leading-relaxed">{ans.answer}</p>
                            <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
                              {ans.isVendor ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-[#004D38]">
                                  <Building2 className="h-3.5 w-3.5" /> Seller Official
                                </span>
                              ) : (
                                <span>{ans.userId?.name || "Verified Buyer"}</span>
                              )}
                              {ans.createdAt && (
                                <>
                                  <span>•</span>
                                  <span>{new Date(ans.createdAt).toLocaleDateString()}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="pl-9 text-xs text-slate-500 italic">
                      No answers yet. Be the first to answer this question.
                    </div>
                  )}

                  {/* Footer actions: Helpful vote & Answer button */}
                  <div className="flex items-center justify-between pl-9 pt-2 border-t border-slate-100 text-xs">
                    <button
                      type="button"
                      onClick={() => handleQuestionHelpful(qId)}
                      className={`inline-flex items-center gap-1.5 font-medium transition-colors ${
                        helpfulVoted[qId] ? "text-[#004D38] font-bold" : "text-slate-500 hover:text-[#004D38]"
                      }`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      Helpful ({Number(item.helpfulCount) || 0})
                    </button>

                    <button
                      type="button"
                      onClick={() => setReplyingToId(replyingToId === qId ? null : qId)}
                      className="inline-flex items-center gap-1 text-slate-600 hover:text-[#004D38] font-semibold"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {replyingToId === qId ? "Cancel" : "Answer this question"}
                    </button>
                  </div>

                  {/* Reply Input Box */}
                  {replyingToId === qId && (
                    <div className="pl-9 pt-3 space-y-3">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write your helpful answer here..."
                        rows={2}
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-[#004D38]"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setReplyingToId(null)}
                          className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAnswerQuestion(qId)}
                          disabled={isSubmittingReply || !replyText.trim()}
                          className="rounded-lg bg-[#004D38] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#003B2B] disabled:opacity-50"
                        >
                          Post Answer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
