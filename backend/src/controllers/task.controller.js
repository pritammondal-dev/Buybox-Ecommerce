const taskService = require("../services/task.service");

const listTasks = async (req, res, next) => {
  try {
    const result = await taskService.listTasks(req.query, req.user);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getTask = async (req, res, next) => {
  try {
    const task = await taskService.getTaskById(req.params.id, req.user);
    res.status(200).json({
      success: true,
      data: { task },
    });
  } catch (error) {
    next(error);
  }
};

const getWorkload = async (req, res, next) => {
  try {
    const workload = await taskService.getWorkloadSummary();
    res.status(200).json({
      success: true,
      data: { workload },
    });
  } catch (error) {
    next(error);
  }
};

const createTask = async (req, res, next) => {
  try {
    const task = await taskService.createTask(req.body, req.user, req);
    res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: { task },
    });
  } catch (error) {
    next(error);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const task = await taskService.updateTask(req.params.id, req.body, req.user, req);
    res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: { task },
    });
  } catch (error) {
    next(error);
  }
};

const addNote = async (req, res, next) => {
  try {
    const task = await taskService.addInternalNote(
      req.params.id,
      req.body.note,
      req.user,
      req
    );
    res.status(200).json({
      success: true,
      message: "Note added successfully",
      data: { task },
    });
  } catch (error) {
    next(error);
  }
};

const deleteTask = async (req, res, next) => {
  try {
    await taskService.deleteTask(req.params.id, req.user, req);
    res.status(200).json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listTasks,
  getTask,
  getWorkload,
  createTask,
  updateTask,
  addNote,
  deleteTask,
};
