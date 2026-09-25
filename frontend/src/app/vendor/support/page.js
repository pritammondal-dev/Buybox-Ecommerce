"use client";

import React, { useState, useEffect } from "react";
import {
  LifeBuoy,
  Plus,
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";

export default function VendorSupportPage() {
  const [tickets, setTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    subject: "",
    category: "general",
    priority: "medium",
    message: "",
  });

  useEffect(() => {
    let isMounted = true;

    vendorService
      .getMySupportTickets()
      .then((res) => {
        if (!isMounted) return;
        const data = res?.data?.data || res?.data?.tickets || res?.data || [];
        const items = Array.isArray(data) ? data : data.items || [];
        setTickets(items);
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err.status === 404 || err.response?.status === 404) {
          setTickets([]);
          return;
        }
        toast.error("Failed to load support tickets", {
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
      const res = await vendorService.getMySupportTickets();
      const data = res?.data?.data || res?.data?.tickets || res?.data || [];
      const items = Array.isArray(data) ? data : data.items || [];
      setTickets(items);
    } catch (err) {
      if (err.status === 404 || err.response?.status === 404) {
        setTickets([]);
        return;
      }
      toast.error("Failed to load support tickets", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!formData.subject.trim() || !formData.message.trim()) {
      toast.error("Subject and message are required");
      return;
    }

    setIsSubmitting(true);
    try {
      await vendorService.createSupportTicket({
        subject: formData.subject.trim(),
        category: formData.category,
        priority: formData.priority,
        message: formData.message.trim(),
      });
      toast.success("Support ticket submitted to marketplace operations");
      setIsCreating(false);
      setFormData({ subject: "", category: "general", priority: "medium", message: "" });
      handleRefresh();
    } catch (err) {
      toast.error("Failed to submit ticket", {
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
            Merchant Support Desk
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Submit questions, dispute settlements, or request account assistance from Buybox platform administrators.
          </p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-xs transition-colors"
        >
          <Plus className="size-4" />
          <span>Open Support Ticket</span>
        </button>
      </div>

      {/* New Ticket Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
              Open New Support Ticket
            </h3>

            <form onSubmit={handleCreateTicket} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Question about payout statement #STL-002"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="general">General Support</option>
                    <option value="catalog">Catalog & Products</option>
                    <option value="finance">Settlements & Banking</option>
                    <option value="shipment">Courier & Logistics</option>
                    <option value="returns">RMA & Returns</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High (Urgent)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Detailed Message</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Describe the issue or assistance required in detail..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white font-semibold shadow-xs disabled:opacity-50"
                >
                  <Send className="size-3.5" />
                  <span>{isSubmitting ? "Submitting..." : "Submit Ticket"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tickets List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200">
          <LifeBuoy className="size-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-800">No Support Tickets</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto mb-4">
            If you need assistance with account onboarding, listings, logistics, or payouts, open a support ticket.
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] text-white text-xs font-semibold"
          >
            <Plus className="size-3.5" />
            <span>Open Ticket</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <div
              key={t._id}
              className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <h4 className="text-sm font-bold text-slate-900">{t.subject}</h4>
                  <span
                    className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      t.status === "resolved" || t.status === "closed"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    {t.status || "open"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="capitalize">{t.category || "General"}</span>
                  <span>•</span>
                  <span>Priority: {t.priority || "Medium"}</span>
                  <span>•</span>
                  <span>Filed: {t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-IN") : "Recent"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
