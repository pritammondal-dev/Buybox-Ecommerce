"use client";

import React, { useEffect, useState } from "react";
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  Clock,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Calendar,
  User,
  Trash2,
  ChevronRight,
  Send,
} from "lucide-react";
import { taskService, staffService } from "@/services/admin/admin.service.js";
import { useAuth } from "@/hooks/useAuth.js";

const STATUS_COLUMNS = [
  { key: "TODO", label: "To Do", bg: "bg-slate-100", text: "text-slate-700" },
  { key: "IN_PROGRESS", label: "In Progress", bg: "bg-blue-50", text: "text-blue-700" },
  { key: "REVIEW", label: "In Review", bg: "bg-purple-50", text: "text-purple-700" },
  { key: "BLOCKED", label: "Blocked", bg: "bg-rose-50", text: "text-rose-700" },
  { key: "COMPLETED", label: "Completed", bg: "bg-emerald-50", text: "text-emerald-700" },
];

const PRIORITY_BADGES = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-50 text-blue-700",
  HIGH: "bg-amber-50 text-amber-700 font-semibold",
  URGENT: "bg-rose-50 text-rose-700 font-bold",
};

export default function TaskManagementPage() {
  const { user: currentUser } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  // Modals & Active Drawer
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTask, setActiveTask] = useState(null);
  const [newNote, setNewNote] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  // Create Form
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    assignedTo: "",
    priority: "MEDIUM",
    status: "TODO",
    dueDate: "",
    internalNote: "",
  });
  const [creating, setCreating] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;

      const result = await taskService.list(params);
      setTasks(result?.tasks || []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const result = await staffService.list({ limit: 100 });
      setStaffList(result?.staff || []);
      if (result?.staff?.length > 0 && !createForm.assignedTo) {
        setCreateForm((prev) => ({ ...prev, assignedTo: result.staff[0].id }));
      }
    } catch {
      // Staff fetch fail silent
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchStaff();
  }, [statusFilter, priorityFilter]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await taskService.create({
        ...createForm,
        dueDate: createForm.dueDate ? new Date(createForm.dueDate) : null,
      });
      setShowCreateModal(false);
      setCreateForm({
        title: "",
        description: "",
        assignedTo: staffList[0]?.id || "",
        priority: "MEDIUM",
        status: "TODO",
        dueDate: "",
        internalNote: "",
      });
      setSuccess("Task created and assigned successfully");
      setTimeout(() => setSuccess(null), 4000);
      fetchTasks();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to create task");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      await taskService.update(taskId, { status: newStatus });
      fetchTasks();
      if (activeTask?._id === taskId) {
        const refreshed = await taskService.get(taskId);
        setActiveTask(refreshed);
      }
    } catch (err) {
      setError("Failed to update status");
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!activeTask || !newNote.trim()) return;
    setSubmittingNote(true);
    try {
      await taskService.addNote(activeTask._id, newNote);
      setNewNote("");
      const refreshed = await taskService.get(activeTask._id);
      setActiveTask(refreshed);
      fetchTasks();
    } catch (err) {
      setError("Failed to add note");
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      await taskService.delete(taskId);
      if (activeTask?._id === taskId) setActiveTask(null);
      fetchTasks();
    } catch (err) {
      setError("Failed to delete task");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <CheckSquare className="size-6 text-emerald-600" />
            <span>Task Management</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Assign operations, vendor reviews, content moderation, and team tasks
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-xs"
        >
          <Plus className="size-4" />
          <span>New Task</span>
        </button>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2.5">
          <AlertCircle className="size-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchTasks()}
            placeholder="Search tasks..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold py-2 px-3 border border-slate-200 rounded-xl bg-white focus:outline-none"
          >
            <option value="">All Statuses</option>
            {STATUS_COLUMNS.map((col) => (
              <option key={col.key} value={col.key}>
                {col.label}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs font-semibold py-2 px-3 border border-slate-200 rounded-xl bg-white focus:outline-none"
          >
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
      </div>

      {/* Kanban Board / Status Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
        {STATUS_COLUMNS.map((col) => {
          const columnTasks = tasks.filter((t) => t.status === col.key);

          return (
            <div
              key={col.key}
              className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs space-y-3 min-h-[400px]"
            >
              <div className="flex items-center justify-between px-2 pt-1">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {col.label}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${col.bg} ${col.text}`}>
                  {columnTasks.length}
                </span>
              </div>

              <div className="space-y-2.5">
                {columnTasks.map((t) => (
                  <div
                    key={t._id}
                    onClick={() => setActiveTask(t)}
                    className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-100/80 cursor-pointer transition-all hover:shadow-xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-xs text-slate-900 leading-tight">
                        {t.title}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded uppercase shrink-0 ${
                          PRIORITY_BADGES[t.priority] || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {t.priority}
                      </span>
                    </div>

                    {t.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-2">
                        {t.description}
                      </p>
                    )}

                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="truncate">
                        👤 {t.assignedTo?.firstName || "Unassigned"}
                      </span>
                      {t.dueDate && (
                        <span className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Calendar className="size-3" />
                          {new Date(t.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {columnTasks.length === 0 && (
                  <div className="py-8 text-center text-slate-300 text-[11px]">
                    Empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Detail Drawer / Modal */}
      {activeTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/50 backdrop-blur-xs">
          <div className="w-full max-w-lg h-full bg-white p-6 shadow-2xl overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded uppercase font-semibold ${
                    PRIORITY_BADGES[activeTask.priority]
                  }`}
                >
                  {activeTask.priority}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  #{activeTask._id?.slice(-6)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDeleteTask(activeTask._id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                  title="Delete Task"
                >
                  <Trash2 className="size-4" />
                </button>
                <button
                  onClick={() => setActiveTask(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg px-2"
                >
                  ✕
                </button>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {activeTask.title}
              </h2>
              <p className="text-xs text-slate-600 mt-2 whitespace-pre-wrap">
                {activeTask.description || "No description provided."}
              </p>
            </div>

            {/* Status Selector */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
              <label className="font-semibold text-slate-700 block">
                Update Status:
              </label>
              <div className="flex flex-wrap gap-2">
                {STATUS_COLUMNS.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => handleUpdateStatus(activeTask._id, s.key)}
                    className={`px-3 py-1 rounded-lg font-semibold text-xs transition-colors ${
                      activeTask.status === s.key
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Assignment & Dates */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Assigned To:</span>
                <span className="font-semibold text-slate-800">
                  {activeTask.assignedTo?.firstName} {activeTask.assignedTo?.lastName}
                </span>
                <span className="block text-[11px] text-slate-400">
                  {activeTask.assignedTo?.email}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Assigned By:</span>
                <span className="font-semibold text-slate-800">
                  {activeTask.assignedBy?.firstName} {activeTask.assignedBy?.lastName}
                </span>
              </div>
            </div>

            {/* Internal Notes */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Internal Notes &amp; Discussion
              </h3>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {activeTask.internalNotes?.map((n, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-semibold text-slate-700">
                        {n.author?.firstName} {n.author?.lastName}
                      </span>
                      <span>{new Date(n.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-700">{n.note}</p>
                  </div>
                ))}
                {(!activeTask.internalNotes || activeTask.internalNotes.length === 0) && (
                  <p className="text-slate-400 text-xs italic">No notes yet.</p>
                )}
              </div>

              <form onSubmit={handleAddNote} className="flex gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add an internal note..."
                  className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={submittingNote || !newNote.trim()}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                >
                  <Send className="size-3.5" />
                </button>
              </form>
            </div>

            {/* Audit History */}
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Task History
              </h3>
              <div className="space-y-1.5 text-[11px] text-slate-500">
                {activeTask.history?.map((h, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <span>
                      {h.action} by {h.changedBy?.firstName || "System"}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(h.changedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Create New Task</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Task Title
                </label>
                <input
                  required
                  type="text"
                  value={createForm.title}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, title: e.target.value })
                  }
                  placeholder="e.g. Review Vendor Onboarding Application"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Description
                </label>
                <textarea
                  rows="3"
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, description: e.target.value })
                  }
                  placeholder="Detailed instructions or context..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Assign To
                  </label>
                  <select
                    required
                    value={createForm.assignedTo}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, assignedTo: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none"
                  >
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName} ({s.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Priority
                  </label>
                  <select
                    value={createForm.priority}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, priority: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Status
                  </label>
                  <select
                    value={createForm.status}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, status: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none"
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="REVIEW">Review</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={createForm.dueDate}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, dueDate: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Initial Internal Note (Optional)
                </label>
                <input
                  type="text"
                  value={createForm.internalNote}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, internalNote: e.target.value })
                  }
                  placeholder="Notes visible to staff..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold disabled:opacity-50"
                >
                  {creating ? "Assigning..." : "Assign Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
