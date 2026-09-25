"use client";

import React, { useState, useEffect } from "react";
import {
  HelpCircle,
  MessageSquare,
  Send,
  CheckCircle2,
  RefreshCw,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";

export default function VendorQuestionsPage() {
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [answeringTo, setAnsweringTo] = useState(null);
  const [answerText, setAnswerText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    vendorService
      .getMyQuestions()
      .then((res) => {
        if (!isMounted) return;
        const data = res?.data?.data || res?.data?.questions || res?.data || [];
        const items = Array.isArray(data) ? data : data.items || [];
        setQuestions(items);
      })
      .catch((err) => {
        if (!isMounted) return;
        toast.error("Failed to load customer inquiries", {
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
      const res = await vendorService.getMyQuestions();
      const data = res?.data?.data || res?.data?.questions || res?.data || [];
      const items = Array.isArray(data) ? data : data.items || [];
      setQuestions(items);
    } catch (err) {
      toast.error("Failed to load customer inquiries", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendAnswer = async (questionId) => {
    if (!answerText.trim()) return;
    setIsSubmitting(true);
    try {
      await vendorService.answerQuestion(questionId, answerText.trim());
      toast.success("Merchant answer posted successfully");
      setAnsweringTo(null);
      setAnswerText("");
      handleRefresh();
    } catch (err) {
      toast.error("Failed to post merchant answer", {
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
            Customer Inquiries (Q&A)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Answer pre-purchase customer questions about compatibility, sizing, and specs.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors"
        >
          <RefreshCw className="size-3.5" />
          <span>Refresh Questions</span>
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200">
          <HelpCircle className="size-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-800">No Questions Found</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            When prospective buyers post questions on your product pages, they will appear here for you to answer.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => {
            const hasAnswer = q.answers?.length > 0;
            return (
              <div
                key={q._id}
                className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-500 font-medium">
                    Product: <span className="font-semibold text-slate-800">{q.productId?.name || q.productId?.title || "Product Listing"}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {q.createdAt ? new Date(q.createdAt).toLocaleDateString("en-IN") : "Recent"}
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="font-bold text-xs text-slate-400 mt-0.5">Q:</span>
                  <p className="text-xs font-semibold text-slate-900 leading-relaxed">
                    {q.question || q.content}
                  </p>
                </div>

                {hasAnswer ? (
                  <div className="mt-3 p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-xs text-emerald-950 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                      <span>Answered by Seller</span>
                    </div>
                    <p className="text-emerald-900/90 leading-relaxed pl-5">
                      {q.answers[0].content || q.answers[0]}
                    </p>
                  </div>
                ) : answeringTo === q._id ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      rows={3}
                      placeholder="Write your answer to help this customer..."
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAnsweringTo(null);
                          setAnswerText("");
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isSubmitting || !answerText.trim()}
                        onClick={() => handleSendAnswer(q._id)}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                      >
                        <Send className="size-3" />
                        <span>{isSubmitting ? "Posting..." : "Submit Answer"}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAnsweringTo(q._id);
                        setAnswerText("");
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                    >
                      <MessageSquare className="size-3.5" />
                      <span>Answer Question</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
