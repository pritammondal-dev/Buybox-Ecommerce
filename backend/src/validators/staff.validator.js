const { z } = require("zod");

const createStaffSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Valid email required"),
    password: z.string().min(8, "Password must be at least 8 characters").max(100),
    firstName: z.string().trim().min(1, "First name is required").max(50),
    lastName: z.string().trim().min(1, "Last name is required").max(50),
    role: z.enum(["admin", "editor", "manager", "support", "staff"]).optional().default("editor"),
    jobRoleId: z.string().optional(),
    jobTitle: z.string().trim().max(100).optional(),
    department: z.string().trim().max(100).optional(),
  })
  .strict();

const updateStaffSchema = z
  .object({
    firstName: z.string().trim().min(1).max(50).optional(),
    lastName: z.string().trim().min(1).max(50).optional(),
    role: z.enum(["super_admin", "admin", "editor", "manager", "support", "staff"]).optional(),
    jobRoleId: z.string().optional(),
    jobTitle: z.string().trim().max(100).nullable().optional(),
    department: z.string().trim().max(100).nullable().optional(),
    status: z.enum(["active", "suspended"]).optional(),
  })
  .strict();

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters").max(100),
  })
  .strict();

const listStaffQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(["super_admin", "admin", "editor"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  search: z.string().trim().max(100).optional(),
});

module.exports = {
  createStaffSchema,
  updateStaffSchema,
  resetPasswordSchema,
  listStaffQuerySchema,
};
