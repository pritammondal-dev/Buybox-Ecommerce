"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  adminSupportService,
  adminStaffService,
} from "@/services/admin/admin.service";

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [staffList, setStaffList] = useState([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Selected Ticket Drawer / Modal
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Status/Assign Modals
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("in_progress");
  const [statusNote, setStatusNote] = useState("");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState("");

  const fetchTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (priorityFilter !== "all") params.priority = priorityFilter;
      const res = await adminSupportService.listTickets(params);
      const items = Array.isArray(res) ? res : res.tickets || res.data || [];
      setTickets(items);
    } catch (err) {
      console.error("Failed to fetch tickets:", err);
      setError(err?.response?.data?.message || err?.message || "Failed to load support tickets");
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await adminStaffService.listStaff({ limit: 100 });
      const items = res?.employees || res?.data || res || [];
      if (Array.isArray(items)) {
        setStaffList(items);
      }
    } catch (err) {
      console.warn("Could not fetch staff for assignment:", err);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    fetchStaff();
  }, []);

  const openTicketDetail = async (ticket) => {
    setSelectedTicket(ticket);
    setActionError(null);
    setLoadingMessages(true);
    setMessages([]);
    try {
      const res = await adminSupportService.getTicketMessages(ticket._id);
      const msgList = Array.isArray(res) ? res : res.messages || res.data || [];
      setMessages(msgList);
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;
    setSubmittingReply(true);
    setActionError(null);
    try {
      if (isInternalNote) {
        await adminSupportService.addInternalNote(selectedTicket._id, {
          message: replyText.trim(),
        });
      } else {
        await adminSupportService.replyTicket(selectedTicket._id, {
          message: replyText.trim(),
        });
      }
      setReplyText("");
      // Refresh messages
      const res = await adminSupportService.getTicketMessages(selectedTicket._id);
      setMessages(Array.isArray(res) ? res : res.messages || res.data || []);
      // Also refresh ticket list
      fetchTickets();
    } catch (err) {
      console.error("Failed to send message:", err);
      setActionError(err?.response?.data?.message || err?.message || "Failed to send message");
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleTransitionStatus = async () => {
    if (!selectedTicket) return;
    setActionError(null);
    try {
      await adminSupportService.transitionStatus(selectedTicket._id, newStatus);
      setStatusModalOpen(false);
      setStatusNote("");
      // Refresh current ticket
      const updated = await adminSupportService.getTicket(selectedTicket._id);
      setSelectedTicket(updated);
      fetchTickets();
    } catch (err) {
      console.error("Failed to change ticket status:", err);
      setActionError(err?.response?.data?.message || err?.message || "Failed to change status");
    }
  };

  const handleAssignTicket = async () => {
    if (!selectedTicket || !selectedStaffId) return;
    setActionError(null);
    try {
      await adminSupportService.assignTicket(selectedTicket._id, selectedStaffId);
      setAssignModalOpen(false);
      // Refresh current ticket
      const updated = await adminSupportService.getTicket(selectedTicket._id);
      setSelectedTicket(updated);
      fetchTickets();
    } catch (err) {
      console.error("Failed to assign ticket:", err);
      setActionError(err?.response?.data?.message || err?.message || "Failed to assign ticket");
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.ticketNumber?.toLowerCase().includes(q) ||
      t.subject?.toLowerCase().includes(q) ||
      t.customerId?.email?.toLowerCase().includes(q) ||
      t.customerId?.name?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q)
    );
  });

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800 border-red-200";
      case "high":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "medium":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "open":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "in_progress":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "resolved":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "closed":
        return "bg-zinc-200 text-zinc-600 border-zinc-300";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Customer Support Operations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Resolve customer inquiries, handle order complaints, and track SLA escalations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTickets}
            className="px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
        {/* Status Tabs */}
        <div className="flex flex-wrap gap-1 p-1 bg-gray-100 rounded-lg border border-gray-200">
          {["all", "open", "in_progress", "resolved", "closed"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition-colors ${
                statusFilter === st
                  ? "bg-white text-[#004D38] shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {st.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Priority & Search Filter */}
        <div className="flex flex-wrap sm:flex-nowrap gap-3 items-center">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs font-medium border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#004D38]"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              placeholder="Search tickets, subject, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004D38] bg-white text-gray-900 placeholder-gray-400"
            />
            <svg
              className="w-4 h-4 absolute left-3 top-2.5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Main Content: Table & Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Ticket List Table */}
        <div className={`${selectedTicket ? "lg:col-span-7" : "lg:col-span-12"} transition-all duration-200`}>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-sm text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#004D38] mx-auto mb-3"></div>
                Loading support tickets...
              </div>
            ) : error ? (
              <div className="p-8 text-center text-sm text-red-600">
                <p className="font-semibold">{error}</p>
                <button
                  onClick={fetchTickets}
                  className="mt-3 text-xs text-[#004D38] underline font-medium hover:text-[#003829]"
                >
                  Try Again
                </button>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-500">
                No tickets matching current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600 divide-y divide-gray-200">
                  <thead className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Ticket</th>
                      <th className="px-4 py-3">Subject / Customer</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTickets.map((t) => {
                      const isSelected = selectedTicket?._id === t._id;
                      return (
                        <tr
                          key={t._id}
                          onClick={() => openTicketDetail(t)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? "bg-emerald-50/60" : "hover:bg-gray-50/80"
                          }`}
                        >
                          <td className="px-4 py-3.5 whitespace-nowrap font-mono text-gray-800 font-medium">
                            #{t.ticketNumber || t._id.slice(-6)}
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-semibold text-gray-900 truncate max-w-xs">{t.subject}</p>
                            <p className="text-[11px] text-gray-500">
                              {t.customerId?.name || t.customerId?.email || "Unknown Customer"}
                            </p>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap capitalize text-gray-700">
                            {t.category || "General"}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border capitalize ${getPriorityBadge(t.priority)}`}>
                              {t.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${getStatusBadge(t.status)}`}>
                              {t.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openTicketDetail(t);
                              }}
                              className="text-[#004D38] hover:text-[#003829] font-medium text-xs"
                            >
                              View &rarr;
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Selected Ticket Conversation & Actions Drawer */}
        {selectedTicket && (
          <div className="lg:col-span-5 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[750px] overflow-hidden">
            {/* Drawer Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-gray-900">
                    #{selectedTicket.ticketNumber || selectedTicket._id.slice(-6)}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border capitalize ${getPriorityBadge(selectedTicket.priority)}`}>
                    {selectedTicket.priority}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${getStatusBadge(selectedTicket.status)}`}>
                    {selectedTicket.status.replace("_", " ")}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mt-1 line-clamp-1">{selectedTicket.subject}</h3>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Quick Actions Bar */}
            <div className="px-4 py-2.5 border-b border-gray-100 bg-white flex flex-wrap gap-2 text-xs">
              <button
                onClick={() => {
                  setNewStatus(selectedTicket.status);
                  setStatusModalOpen(true);
                }}
                className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-md transition-colors"
              >
                Change Status
              </button>
              <button
                onClick={() => {
                  setSelectedStaffId(selectedTicket.assignedTo?._id || "");
                  setAssignModalOpen(true);
                }}
                className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-md transition-colors"
              >
                Assign Agent
              </button>
              {selectedTicket.orderId && (
                <Link
                  href={`/administrator/operations/orders?id=${selectedTicket.orderId}`}
                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#004D38] font-medium rounded-md transition-colors"
                >
                  View Order
                </Link>
              )}
            </div>

            {/* Conversation Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#F8F9FA]">
              {/* Ticket Initial Description */}
              <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-xs">
                <div className="flex justify-between items-center text-[11px] text-gray-500 mb-1">
                  <span className="font-semibold text-gray-800">
                    {selectedTicket.customerId?.name || "Customer"} (Initiator)
                  </span>
                  <span>{new Date(selectedTicket.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-gray-700 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {loadingMessages ? (
                <div className="py-6 text-center text-xs text-gray-400">Loading conversation history...</div>
              ) : messages.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400">No additional replies yet.</div>
              ) : (
                messages.map((m) => {
                  const isStaff = m.senderType === "employee" || m.senderRole === "staff" || m.senderRole === "admin";
                  const isInternal = m.isInternal || m.type === "internal_note";
                  return (
                    <div
                      key={m._id}
                      className={`p-3 rounded-lg text-xs border shadow-xs ${
                        isInternal
                          ? "bg-amber-50 border-amber-200 text-amber-900"
                          : isStaff
                          ? "bg-emerald-50/80 border-emerald-200 text-emerald-950 ml-4"
                          : "bg-white border-gray-200 text-gray-800 mr-4"
                      }`}
                    >
                      <div className="flex justify-between items-center text-[10px] text-gray-500 mb-1">
                        <span className="font-bold flex items-center gap-1">
                          {isInternal && <span className="bg-amber-200 text-amber-800 px-1 rounded text-[9px]">INTERNAL NOTE</span>}
                          {m.senderName || (isStaff ? "Support Agent" : "Customer")}
                        </span>
                        <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{m.message}</p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply Input Form */}
            <form onSubmit={handleSendReply} className="p-3 border-t border-gray-200 bg-white space-y-2">
              {actionError && (
                <div className="p-2 text-xs text-red-600 bg-red-50 rounded border border-red-200">
                  {actionError}
                </div>
              )}
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer text-gray-700">
                  <input
                    type="checkbox"
                    checked={isInternalNote}
                    onChange={(e) => setIsInternalNote(e.target.checked)}
                    className="rounded text-[#004D38] focus:ring-[#004D38] h-3.5 w-3.5"
                  />
                  <span>Internal Note (Hidden from Customer)</span>
                </label>
              </div>
              <div className="flex gap-2">
                <textarea
                  rows="2"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={isInternalNote ? "Write private staff note..." : "Reply to customer..."}
                  className="flex-1 text-xs border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#004D38] bg-white text-gray-900 resize-none"
                />
                <button
                  type="submit"
                  disabled={submittingReply || !replyText.trim()}
                  className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors flex items-center justify-center ${
                    isInternalNote ? "bg-amber-600 hover:bg-amber-700" : "bg-[#004D38] hover:bg-[#003829]"
                  } disabled:opacity-50`}
                >
                  {submittingReply ? "..." : isInternalNote ? "Note" : "Reply"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Change Status Modal */}
      {statusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-sm w-full p-5 space-y-4">
            <h3 className="text-base font-bold text-gray-900">Update Ticket Status</h3>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">New Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#004D38]"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                className="px-3.5 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTransitionStatus}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-[#004D38] hover:bg-[#003829] rounded-lg shadow-sm"
              >
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Agent Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-sm w-full p-5 space-y-4">
            <h3 className="text-base font-bold text-gray-900">Assign Ticket</h3>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Select Employee / Agent</label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#004D38]"
              >
                <option value="">-- Unassigned --</option>
                {staffList.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.user?.name || emp.name || emp.email} ({emp.jobRole?.name || emp.department || "Staff"})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="px-3.5 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignTicket}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-[#004D38] hover:bg-[#003829] rounded-lg shadow-sm"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
