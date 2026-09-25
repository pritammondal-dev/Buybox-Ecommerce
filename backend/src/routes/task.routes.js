const express = require("express");
const taskController = require("../controllers/task.controller");
const authenticate = require("../middlewares/authentication.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const validate = require("../middlewares/validate.middleware");
const validateObjectId = require("../middlewares/validate-object-id.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");
const {
  createTaskSchema,
  updateTaskSchema,
  addNoteSchema,
  listTasksQuerySchema,
} = require("../validators/task.validator");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  requirePermissions(PERMISSIONS.TASKS_VIEW),
  validate(listTasksQuerySchema, "query"),
  taskController.listTasks
);

router.post(
  "/",
  requirePermissions(PERMISSIONS.TASKS_CREATE),
  validate(createTaskSchema),
  taskController.createTask
);

router.get(
  "/workload",
  requirePermissions(PERMISSIONS.TASKS_VIEW),
  taskController.getWorkload
);

router.get(
  "/:id",
  requirePermissions(PERMISSIONS.TASKS_VIEW),
  validateObjectId("id"),
  taskController.getTask
);

router.patch(
  "/:id",
  requirePermissions(PERMISSIONS.TASKS_EDIT),
  validateObjectId("id"),
  validate(updateTaskSchema),
  taskController.updateTask
);

router.post(
  "/:id/notes",
  requirePermissions(PERMISSIONS.TASKS_EDIT),
  validateObjectId("id"),
  validate(addNoteSchema),
  taskController.addNote
);

router.delete(
  "/:id",
  requirePermissions(PERMISSIONS.TASKS_CREATE),
  validateObjectId("id"),
  taskController.deleteTask
);

module.exports = router;
