"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Package,
  Headphones,
  Mail,
  PhoneCall,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../hooks/useAuth.js";
import { supportService } from "../../../services/support.service.js";
import { orderService } from "../../../services/order.service.js";

const CATEGORIES = [
  { value: "order", label: "Order Tracking or Modification" },
  { value: "payment", label: "Payment, Invoicing or Billing" },
  { value: "shipping", label: "Shipping & Courier Delays" },
  { value: "refund", label: "Returns, Replacements & Refunds" },
  { value: "product", label: "Technical Audio Specifications & Fit" },
  { value: "account", label: "Account Settings & Login Access" },
  { value: "other", label: "General Inquiry / Other" },
];

export function ContactSupportPageView({ prefillOrderId = null }) {
  const { isAuthenticated, user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [myTickets, setMyTickets] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form state
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState(prefillOrderId ? "order" : "order");
  const [priority, setPriority] = useState("medium");
  const [selectedOrderId, setSelectedOrderId] = useState(prefillOrderId || "");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdTicket, setCreatedTicket] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!isAuthenticated) {
        if (isMounted) setLoadingInitial(false);
        return;
      }

      try {
        const [ordersRes, ticketsRes] = await Promise.allSettled([
          orderService.getMyOrders(),
          supportService.getMyTickets(),
        ]);

        if (!isMounted) return;

        if (ordersRes.status === "fulfilled") {
          const list = Array.isArray(ordersRes.value?.data)
            ? ordersRes.value.data
            : ordersRes.value?.data?.orders || [];
          setOrders(list);
        }

        if (ticketsRes.status === "fulfilled") {
          const tList = Array.isArray(ticketsRes.value?.data)
            ? ticketsRes.value.data
            : ticketsRes.value?.data?.tickets || [];
          setMyTickets(tList);
        }
      } catch {
        // non-blocking
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      toast.error("Please fill in subject and description.");
      return;
    }

    if (!isAuthenticated) {
      toast.error("Please sign in to open a support ticket.", {
        description: "Authenticated tickets enable our team to verify orders and respond directly.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
      };

      if (selectedOrderId && selectedOrderId.length === 24) {
        payload.orderId = selectedOrderId;
      }

      const res = await supportService.createTicket(payload);
      const ticket = res?.data?.data || res?.data;
      setCreatedTicket(ticket);
      toast.success("Support ticket registered successfully!");
      // reload tickets list
      supportService.getMyTickets().then((r) => {
        setMyTickets(Array.isArray(r?.data) ? r.data : r?.data?.tickets || []);
      });
    } catch (err) {
      toast.error(err?.message || "Failed to create support ticket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="rounded-3xl bg-gradient-to-br from-[#004D38] to-[#002B1F] p-8 sm:p-12 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300">
              <Headphones className="h-4 w-4" /> Dedicated Helpdesk
            </span>
            <h1 className="text-3xl font-black tracking-tight">Contact Customer Support</h1>
            <p className="text-sm text-emerald-100/90 leading-relaxed">
              Have a question about an order, audio hardware synergy, or a warranty claim? Our certified audio technicians and operations staff respond within 12 business hours.
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md text-xs space-y-2 text-emerald-100 border border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-emerald-300" />
              <span>support@buybox.in</span>
            </div>
            <div className="flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-emerald-300" />
              <span>1800-BUYBOX-HELP</span>
            </div>
            <p className="text-[10px] text-emerald-300/80 pt-1">
              Mon - Sat: 9:00 AM – 7:00 PM IST
            </p>
          </div>
        </div>

        {/* Main Grid: Form & Open Tickets */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Form / Success view (8 cols) */}
          <div className="lg:col-span-8">
            {createdTicket ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-[#004D38]">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-black text-slate-900">Support Ticket Created</h2>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Ticket <strong className="font-mono text-slate-800">#{createdTicket._id || createdTicket.id}</strong> has been assigned to our support queue. An email confirmation has been dispatched.
                </p>
                <div className="pt-4 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCreatedTicket(null);
                      setSubject("");
                      setDescription("");
                    }}
                    className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Submit Another Inquiry
                  </button>
                  <Link
                    href="/help"
                    className="rounded-xl bg-[#004D38] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#003B2B]"
                  >
                    Help Center Home
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold text-slate-900">Submit a New Support Request</h2>
                  <p className="text-xs text-slate-500">
                    Provide complete details so our team can resolve your inquiry promptly.
                  </p>
                </div>

                {!isAuthenticated && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-900 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Sign In Recommended</p>
                      <p className="text-[11px] text-amber-800">
                        Please <Link href="/auth/login?redirect=/contact-support" className="font-bold underline text-[#004D38]">sign in to your Buybox account</Link> before submitting so this ticket is linked to your order history.
                      </p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Category & Priority */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Issue Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-[#004D38]"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Priority Level
                      </label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-[#004D38]"
                      >
                        <option value="low">Low (General question)</option>
                        <option value="medium">Medium (Standard inquiry)</option>
                        <option value="high">High (Urgent delivery/damaged box)</option>
                      </select>
                    </div>
                  </div>

                  {/* Related Order (if any) */}
                  {orders.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Link to an Order (Optional)
                      </label>
                      <select
                        value={selectedOrderId}
                        onChange={(e) => setSelectedOrderId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-[#004D38]"
                      >
                        <option value="">-- Select an Order (Optional) --</option>
                        {orders.map((ord) => (
                          <option key={ord._id} value={ord._id}>
                            Order #{ord.orderNumber || ord._id.slice(-8)} — {ord.status.toUpperCase()} ({new Date(ord.createdAt).toLocaleDateString()})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Subject */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Subject Headline <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Inquiring about delivery schedule for Order #12345"
                      required
                      maxLength={200}
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-[#004D38]"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Detailed Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe your issue with clarity. Include error messages, courier details, or symptoms if applicable..."
                      required
                      rows={5}
                      maxLength={5000}
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-[#004D38]"
                    />
                  </div>

                  {/* Submit */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting || !subject.trim() || !description.trim()}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#004D38] px-6 py-3 text-xs font-bold text-white shadow-sm hover:bg-[#003B2B] transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Submitting Ticket...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" /> Open Ticket
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Right Column: Existing Tickets (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[#004D38]" /> Your Open Tickets ({myTickets.length})
              </h3>

              {!isAuthenticated ? (
                <p className="text-xs text-slate-500">
                  Sign in to view your previous ticket history and vendor replies.
                </p>
              ) : myTickets.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  You have no open support tickets at this time.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 space-y-2">
                  {myTickets.slice(0, 5).map((ticket) => (
                    <div key={ticket._id || ticket.id} className="pt-3 first:pt-0 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-900 truncate max-w-[180px]">
                          {ticket.subject}
                        </span>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-[#004D38] uppercase">
                          {ticket.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{ticket.description}</p>
                      <span className="text-[10px] text-slate-400 block">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Policy links */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-3 text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-400 text-[10px] block">
                Helpful Resources
              </span>
              <ul className="space-y-2 text-slate-600">
                <li>
                  <Link href="/help/orders" className="hover:text-[#004D38] flex items-center gap-1.5">
                    <ArrowRight className="h-3 w-3 text-slate-400" /> Order Tracking Guide
                  </Link>
                </li>
                <li>
                  <Link href="/help/returns" className="hover:text-[#004D38] flex items-center gap-1.5">
                    <ArrowRight className="h-3 w-3 text-slate-400" /> 7-Day Return Policy
                  </Link>
                </li>
                <li>
                  <Link href="/shipping-policy" className="hover:text-[#004D38] flex items-center gap-1.5">
                    <ArrowRight className="h-3 w-3 text-slate-400" /> Transit & Packaging Standards
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
