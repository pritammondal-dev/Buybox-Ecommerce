const { z } = require("zod");
const mongoose = require("mongoose");

const objectIdSchema = z
  .string()
  .trim()
  .refine((val) => mongoose.isValidObjectId(val), {
    message: "Invalid ObjectId",
  });

const createTaskSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(2000).optional().default(""),
    assignedTo: objectIdSchema,
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional().default("MEDIUM"),
    status: z
      .enum(["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "COMPLETED", "CANCELLED"])
      .optional()
      .default("TODO"),
    dueDate: z.coerce.date().nullable().optional(),
    tags: z.array(z.string().trim().max(50)).optional(),
    internalNote: z.string().trim().max(1000).optional(),
  })
  .strict();

const updateTaskSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    assignedTo: objectIdSchema.optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    status: z
      .enum(["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "COMPLETED", "CANCELLED"])
      .optional(),
    dueDate: z.coerce.date().nullable().optional(),
    tags: z.array(z.string().trim().max(50)).optional(),
    internalNote: z.string().trim().max(1000).optional(),
  })
  .strict();

const addNoteSchema = z
  .object({
    note: z.string().trim().min(1).max(1000),
  })
  .strict();

const listTasksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "COMPLETED", "CANCELLED"])
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assignedTo: objectIdSchema.optional(),
  search: z.string().trim().max(100).optional(),
});

module.exports = {
  createTaskSchema,
  updateTaskSchema,
  addNoteSchema,
  listTasksQuerySchema,
};
