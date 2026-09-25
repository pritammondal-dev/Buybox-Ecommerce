"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { taskService, staffService } from "@/services/admin/admin.service.js";

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id;

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [staffList, setStaffList] = useState([]);

  const [status, setStatus] = useState("TODO");
  const [priority, setPriority] = useState("MEDIUM");
  const [assignedTo, setAssignedTo] = useState("");
  const [newComment, setNewComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);

  const fetchTask = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await taskService.getTaskById(taskId);
      const data = res?.task || res?.data || res;
      setTask(data);
      if (data) {
        setStatus(data.status || "TODO");
        setPriority(data.priority || "MEDIUM");
        setAssignedTo(data.assignedTo?._id || data.assignedTo || "");
      }
    } catch (err) {
      console.error("Failed to fetch task:", err);
      setError(err?.response?.data?.message || err?.message || "Failed to load task details");
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await staffService.listStaff({ limit: 100 });
      const items = res?.employees || res?.data || res || [];
      if (Array.isArray(items)) setStaffList(items);
    } catch (err) {
      console.warn("Could not load staff list:", err);
    }
  };

  useEffect(() => {
    if (taskId) {
      fetchTask();
      fetchStaff();
    }
  }, [taskId]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setActionSuccess(null);
    try {
      await taskService.updateTask(taskId, {
        status,
        priority,
        assignedTo: assignedTo || null,
      });
      setActionSuccess("Task updated successfully!");
      fetchTask();
    } catch (err) {
      console.error("Failed to update task:", err);
      setError(err?.response?.data?.message || err?.message || "Failed to update task");
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setCommenting(true);
    try {
      await taskService.addNote(taskId, { content: newComment.trim() });
      setNewComment("");
      fetchTask();
    } catch (err) {
      console.error("Failed to add comment:", err);
      setError(err?.response?.data?.message || err?.message || "Failed to add comment");
    } finally {
      setCommenting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#004D38] mx-auto mb-3"></div>
        Loading task details...
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="p-8 text-center text-sm text-red-600 max-w-lg mx-auto">
        <p className="font-bold">{error}</p>
        <Link
          href="/administrator/tasks"
          className="mt-4 inline-block text-xs font-semibold text-[#004D38] underline"
        >
          &larr; Back to All Tasks
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link href="/administrator/tasks" className="hover:text-gray-900 underline">
              Tasks
            </Link>
            <span>/</span>
            <span className="font-mono">#{taskId.slice(-6)}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{task.title}</h1>
        </div>
        <Link
          href="/administrator/tasks"
          className="px-3.5 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          &larr; Back to Task Board
        </Link>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
          {actionSuccess}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details & Comments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-3">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Description</h2>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">
              {task.description || "No description provided."}
            </p>
          </div>

          {/* Activity / Comments */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Comments & Notes</h2>

            <div className="space-y-3">
              {(!task.notes || task.notes.length === 0) ? (
                <p className="text-xs text-gray-400">No notes or comments on this task yet.</p>
              ) : (
                task.notes.map((n, i) => (
                  <div key={i} className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs">
                    <div className="flex justify-between items-center text-[10px] text-gray-500 mb-1">
                      <span className="font-semibold text-gray-700">
                        {n.author?.name || n.authorName || "Staff Member"}
                      </span>
                      <span>{new Date(n.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-gray-800 whitespace-pre-wrap">{n.content || n.note}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddComment} className="pt-2 flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment or status update..."
                className="flex-1 text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#004D38]"
              />
              <button
                type="submit"
                disabled={commenting || !newComment.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#004D38] hover:bg-[#003829] rounded-lg disabled:opacity-50"
              >
                {commenting ? "Adding..." : "Post"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Attributes & State Management */}
        <div className="space-y-6">
          <form onSubmit={handleUpdate} className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Task Attributes</h2>

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#004D38]"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="REVIEW">In Review</option>
                <option value="BLOCKED">Blocked</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#004D38]"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Assignee</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#004D38]"
              >
                <option value="">-- Unassigned --</option>
                {staffList.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.user?.name || emp.name || emp.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 text-xs font-semibold text-white bg-[#004D38] hover:bg-[#003829] rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                {saving ? "Saving Changes..." : "Save Changes"}
              </button>
            </div>
          </form>

          {/* Metadata Card */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-2 text-xs text-gray-600">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Audit Metadata</h2>
            <div className="flex justify-between">
              <span className="text-gray-400">Created:</span>
              <span className="font-medium text-gray-800">{new Date(task.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Created By:</span>
              <span className="font-medium text-gray-800">{task.createdBy?.name || "System Admin"}</span>
            </div>
            {task.dueDate && (
              <div className="flex justify-between">
                <span className="text-gray-400">Due Date:</span>
                <span className="font-medium text-gray-800">{new Date(task.dueDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
