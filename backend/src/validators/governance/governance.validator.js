const { z } = require("zod");
const mongoose = require("mongoose");

const objectIdSchema = z
  .string()
  .trim()
  .refine((val) => mongoose.isValidObjectId(val), {
    message: "Invalid ObjectId",
  });

const createRoleSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(100)
      .regex(
        /^[a-z0-9_-]+$/,
        "Slug may contain only lowercase letters, numbers, underscores, and hyphens",
      ),
    description: z.string().trim().max(500).nullable().optional(),
    isSystem: z.boolean().optional().default(false),
  })
  .strict();

const updateRoleSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(100)
      .regex(
        /^[a-z0-9_-]+$/,
        "Slug may contain only lowercase letters, numbers, underscores, and hyphens",
      )
      .optional(),
    description: z.string().trim().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

const updateRolePermissionsSchema = z
  .object({
    permissionIds: z.array(objectIdSchema),
  })
  .strict();

const createEmployeeSchema = z
  .object({
    userId: objectIdSchema,
    jobTitle: z.string().trim().max(100).nullable().optional(),
    department: z.string().trim().max(100).nullable().optional(),
    employeeNumber: z.string().trim().toUpperCase().min(3).max(30).optional(),
  })
  .strict();

const updateEmployeeSchema = z
  .object({
    jobTitle: z.string().trim().max(100).nullable().optional(),
    department: z.string().trim().max(100).nullable().optional(),
    status: z.enum(["active", "suspended", "terminated"]).optional(),
  })
  .strict();

const assignEmployeeRoleSchema = z
  .object({
    roleId: objectIdSchema,
    expiresAt: z.coerce.date().nullable().optional(),
  })
  .strict();

const createPermissionGrantSchema = z
  .object({
    permissionId: objectIdSchema,
    reason: z.string().trim().min(5).max(500),
    expiresAt: z.coerce.date().nullable().optional(),
  })
  .strict();

const createPermissionRestrictionSchema = z
  .object({
    permissionId: objectIdSchema,
    reason: z.string().trim().min(5).max(500),
    expiresAt: z.coerce.date().nullable().optional(),
  })
  .strict();

const createWorkAssignmentSchema = z
  .object({
    scopeType: z.enum(["vendor", "warehouse", "category", "support_queue"]),
    scopeId: z.string().trim().min(1).max(200),
  })
  .strict();

const updateWorkAssignmentSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

const auditLogQuerySchema = z.object({
  actorId: objectIdSchema.optional(),
  targetId: objectIdSchema.optional(),
  entityType: z.string().trim().optional(),
  action: z.string().trim().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = {
  createRoleSchema,
  updateRoleSchema,
  updateRolePermissionsSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  assignEmployeeRoleSchema,
  createPermissionGrantSchema,
  createPermissionRestrictionSchema,
  createWorkAssignmentSchema,
  updateWorkAssignmentSchema,
  auditLogQuerySchema,
};
