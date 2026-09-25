const mongoose = require("mongoose");
const Task = require("../models/Task");
const User = require("../models/User");
const AppError = require("../errors/AppError");
const { recordAuditLog } = require("./governance.service");
const { getEffectivePermissions } = require("./authorization.service");

/**
 * List tasks with pagination, search, and filtering.
 */
const listTasks = async (query = {}, user) => {
  const {
    page = 1,
    limit = 20,
    status,
    priority,
    assignedTo,
    search,
  } = query;

  const filter = {};

  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (assignedTo && mongoose.isValidObjectId(assignedTo)) {
    filter.assignedTo = assignedTo;
  }

  const actorId = user?._id || user?.id;
  const isSuperadmin =
    user?.role === "super_admin" || user?.roles?.includes?.("super_admin");
  const permissions = actorId ? await getEffectivePermissions(actorId) : [];
  const canManageAllTasks =
    isSuperadmin ||
    permissions.includes("tasks.manage_all") ||
    permissions.includes("work_assignments:manage");

  if (!canManageAllTasks && actorId) {
    filter.$or = [{ assignedTo: actorId }, { assignedBy: actorId }];
  }

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(escaped, "i");
    if (filter.$or) {
      filter.$and = [
        { $or: filter.$or },
        {
          $or: [
            { title: searchRegex },
            { description: searchRegex },
          ],
        },
      ];
      delete filter.$or;
    } else {
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
      ];
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [rawTasks, total] = await Promise.all([
    Task.find(filter)
      .populate("assignedTo", "firstName lastName email role")
      .populate("assignedBy", "firstName lastName email role")
      .populate("internalNotes.author", "firstName lastName email role")
      .populate("history.changedBy", "firstName lastName email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Task.countDocuments(filter),
  ]);

  const now = new Date();
  const tasks = rawTasks.map((t) => ({
    ...t,
    isOverdue: Boolean(
      t.dueDate &&
      new Date(t.dueDate) < now &&
      !["COMPLETED", "CANCELLED"].includes(t.status)
    ),
  }));

  return {
    tasks,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
  };
};

/**
 * Get task by ID with resource authorization and overdue status.
 */
const getTaskById = async (taskId, actor = null) => {
  if (!mongoose.isValidObjectId(taskId)) {
    throw new AppError("Invalid task ID", 400, "INVALID_TASK_ID");
  }

  const task = await Task.findById(taskId)
    .populate("assignedTo", "firstName lastName email role")
    .populate("assignedBy", "firstName lastName email role")
    .populate("internalNotes.author", "firstName lastName email role")
    .populate("history.changedBy", "firstName lastName email role")
    .lean();

  if (!task) {
    throw new AppError("Task not found", 404, "TASK_NOT_FOUND");
  }

  if (actor) {
    const actorId = (actor._id || actor.id).toString();
    const isSuperadmin =
      actor.role === "super_admin" || actor.roles?.includes?.("super_admin");
    const permissions = await getEffectivePermissions(actorId);
    const canManageAllTasks =
      isSuperadmin ||
      permissions.includes("tasks.manage_all") ||
      permissions.includes("work_assignments:manage");

    const isAssignee =
      task.assignedTo?._id?.toString() === actorId ||
      task.assignedTo?.toString() === actorId;
    const isCreator =
      task.assignedBy?._id?.toString() === actorId ||
      task.assignedBy?.toString() === actorId;

    if (!canManageAllTasks && !isAssignee && !isCreator) {
      throw new AppError(
        "You do not have permission to access this task",
        403,
        "TASK_ACCESS_DENIED"
      );
    }
  }

  task.isOverdue = Boolean(
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    !["COMPLETED", "CANCELLED"].includes(task.status)
  );

  return task;
};

/**
 * Create a new task.
 */
const createTask = async (payload, actor, req = null) => {
  const { title, description, assignedTo, priority, status, dueDate, internalNote } =
    payload;

  const actorId = actor?._id || actor?.id;

  let targetUser = await User.findById(assignedTo).lean();
  let finalAssignedTo = assignedTo;
  if (!targetUser) {
    const Employee = require("../models/Employee");
    const emp = await Employee.findById(assignedTo).lean();
    if (emp) {
      targetUser = await User.findById(emp.userId).lean();
      if (targetUser) finalAssignedTo = targetUser._id;
    }
  }

  if (!targetUser) {
    throw new AppError("Assigned user does not exist", 404, "USER_NOT_FOUND");
  }

  const notes = [];
  if (internalNote) {
    notes.push({
      note: internalNote,
      author: actorId,
      createdAt: new Date(),
    });
  }

  const history = [
    {
      action: "TASK_CREATED",
      changedBy: actorId,
      changedAt: new Date(),
      newStatus: status || "TODO",
      notes: "Task initialized",
    },
  ];

  const task = await Task.create({
    title,
    description: description || "",
    assignedTo: finalAssignedTo,
    assignedBy: actorId,
    priority: priority || "MEDIUM",
    status: status || "TODO",
    dueDate: dueDate || null,
    internalNotes: notes,
    history,
  });

  await recordAuditLog({
    actorId,
    targetId: task._id,
    action: "task.created",
    entityType: "task",
    afterState: task.toObject(),
    req,
  });

  return task;
};

/**
 * Update an existing task with reassignment, reopening, and IDOR guards.
 */
const updateTask = async (taskId, payload, actor, req = null) => {
  const actorId = (actor?._id || actor?.id).toString();

  if (!mongoose.isValidObjectId(taskId)) {
    throw new AppError("Invalid task ID", 400, "INVALID_TASK_ID");
  }

  const task = await Task.findById(taskId);
  if (!task) {
    throw new AppError("Task not found", 404, "TASK_NOT_FOUND");
  }

  const isSuperadmin =
    actor?.role === "super_admin" || actor?.roles?.includes?.("super_admin");
  const permissions = actorId ? await getEffectivePermissions(actorId) : [];
  const canManageAll =
    isSuperadmin ||
    permissions.includes("tasks.manage_all") ||
    permissions.includes("work_assignments:manage");

  const isAssignee =
    task.assignedTo?._id?.toString() === actorId ||
    task.assignedTo?.toString() === actorId;
  const isCreator =
    task.assignedBy?._id?.toString() === actorId ||
    task.assignedBy?.toString() === actorId;

  if (!canManageAll && !isAssignee && !isCreator) {
    throw new AppError(
      "You do not have permission to update this task",
      403,
      "TASK_UPDATE_DENIED"
    );
  }

  const beforeState = task.toObject();

  if (payload.title !== undefined) task.title = payload.title;
  if (payload.description !== undefined) task.description = payload.description;
  if (payload.priority !== undefined) task.priority = payload.priority;
  if (payload.dueDate !== undefined) task.dueDate = payload.dueDate;

  let actionType = "TASK_UPDATED";

  // Reassignment validation
  if (payload.assignedTo && payload.assignedTo.toString() !== task.assignedTo.toString()) {
    const canReassign = isSuperadmin || permissions.includes("tasks.assign") || canManageAll;
    if (!canReassign) {
      throw new AppError(
        "You do not have permission to reassign tasks",
        403,
        "TASK_REASSIGNMENT_DENIED"
      );
    }

    let newAssignee = await User.findById(payload.assignedTo).lean();
    let finalAssignedTo = payload.assignedTo;
    if (!newAssignee) {
      const Employee = require("../models/Employee");
      const emp = await Employee.findById(payload.assignedTo).lean();
      if (emp) {
        newAssignee = await User.findById(emp.userId).lean();
        if (newAssignee) finalAssignedTo = newAssignee._id;
      }
    }
    if (!newAssignee) {
      throw new AppError("Assigned user not found", 404, "USER_NOT_FOUND");
    }
    task.assignedTo = finalAssignedTo;
    actionType = "TASK_REASSIGNED";
  }

  // Status transitions & reopening validation
  if (payload.status && payload.status !== task.status) {
    const prevStatus = task.status;

    if (["COMPLETED", "CANCELLED"].includes(prevStatus) && ["TODO", "IN_PROGRESS"].includes(payload.status)) {
      const canReopen =
        isSuperadmin ||
        permissions.includes("tasks.reopen") ||
        canManageAll ||
        isCreator;
      if (!canReopen) {
        throw new AppError(
          "You do not have permission to reopen this task",
          403,
          "TASK_REOPEN_DENIED"
        );
      }
      actionType = "TASK_REOPENED";
    } else if (payload.status === "COMPLETED") {
      actionType = "TASK_COMPLETED";
    }

    task.status = payload.status;

    task.history.push({
      action: actionType,
      changedBy: actorId,
      changedAt: new Date(),
      previousStatus: prevStatus,
      newStatus: payload.status,
      notes: payload.internalNote || `Status changed from ${prevStatus} to ${payload.status}`,
    });
  } else {
    task.history.push({
      action: actionType,
      changedBy: actorId,
      changedAt: new Date(),
      notes: payload.internalNote || "Task details updated",
    });
  }

  if (payload.internalNote) {
    task.internalNotes.push({
      note: payload.internalNote,
      author: actorId,
      createdAt: new Date(),
    });
  }

  await task.save();

  await recordAuditLog({
    actorId,
    targetId: task._id,
    action: actionType.toLowerCase().replace("_", "."),
    entityType: "task",
    beforeState,
    afterState: task.toObject(),
    req,
  });

  return task;
};

/**
 * Add internal note to task with resource authorization.
 */
const addInternalNote = async (taskId, note, actor, req = null) => {
  const actorId = (actor?._id || actor?.id).toString();

  if (!mongoose.isValidObjectId(taskId)) {
    throw new AppError("Invalid task ID", 400, "INVALID_TASK_ID");
  }

  const task = await Task.findById(taskId);
  if (!task) {
    throw new AppError("Task not found", 404, "TASK_NOT_FOUND");
  }

  const isSuperadmin =
    actor?.role === "super_admin" || actor?.roles?.includes?.("super_admin");
  const permissions = actorId ? await getEffectivePermissions(actorId) : [];
  const canManageAll =
    isSuperadmin ||
    permissions.includes("tasks.manage_all") ||
    permissions.includes("work_assignments:manage");
  const isAssignee =
    task.assignedTo?._id?.toString() === actorId ||
    task.assignedTo?.toString() === actorId;
  const isCreator =
    task.assignedBy?._id?.toString() === actorId ||
    task.assignedBy?.toString() === actorId;

  if (!canManageAll && !isAssignee && !isCreator) {
    throw new AppError(
      "You do not have permission to comment on this task",
      403,
      "TASK_COMMENT_DENIED"
    );
  }

  task.internalNotes.push({
    note,
    author: actorId,
    createdAt: new Date(),
  });

  task.history.push({
    action: "NOTE_ADDED",
    changedBy: actorId,
    changedAt: new Date(),
    notes: "Internal note added",
  });

  await task.save();

  return task;
};

/**
 * Delete a task with authority verification.
 */
const deleteTask = async (taskId, actor, req = null) => {
  const actorId = (actor?._id || actor?.id).toString();

  if (!mongoose.isValidObjectId(taskId)) {
    throw new AppError("Invalid task ID", 400, "INVALID_TASK_ID");
  }

  const task = await Task.findById(taskId);
  if (!task) {
    throw new AppError("Task not found", 404, "TASK_NOT_FOUND");
  }

  const isSuperadmin =
    actor?.role === "super_admin" || actor?.roles?.includes?.("super_admin");
  const permissions = actorId ? await getEffectivePermissions(actorId) : [];
  const canDelete =
    isSuperadmin ||
    permissions.includes("tasks.delete") ||
    permissions.includes("tasks.manage_all") ||
    task.assignedBy.toString() === actorId;

  if (!canDelete) {
    throw new AppError(
      "You do not have permission to delete this task",
      403,
      "TASK_DELETE_DENIED"
    );
  }

  const beforeState = task.toObject();
  await Task.findByIdAndDelete(taskId);

  await recordAuditLog({
    actorId,
    targetId: taskId,
    action: "task.deleted",
    entityType: "task",
    beforeState,
    req,
  });

  return { success: true };
};

/**
 * Aggregate workload distribution across staff.
 */
const getWorkloadSummary = async () => {
  const workload = await Task.aggregate([
    {
      $group: {
        _id: "$assignedTo",
        totalTasks: { $sum: 1 },
        todo: { $sum: { $cond: [{ $eq: ["$status", "TODO"] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ["$status", "IN_PROGRESS"] }, 1, 0] } },
        blocked: { $sum: { $cond: [{ $eq: ["$status", "BLOCKED"] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
        urgent: { $sum: { $cond: [{ $eq: ["$priority", "URGENT"] }, 1, 0] } },
        high: { $sum: { $cond: [{ $eq: ["$priority", "HIGH"] }, 1, 0] } },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        assignedTo: "$_id",
        employeeName: { $concat: ["$user.firstName", " ", "$user.lastName"] },
        email: "$user.email",
        totalTasks: 1,
        todo: 1,
        inProgress: 1,
        blocked: 1,
        completed: 1,
        urgent: 1,
        high: 1,
      },
    },
    { $sort: { totalTasks: -1 } },
  ]);

  return workload;
};

module.exports = {
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  addInternalNote,
  deleteTask,
  getWorkloadSummary,
};
