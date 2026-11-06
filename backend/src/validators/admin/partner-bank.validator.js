const { z } = require("zod");
const { ROUTING_SYSTEMS } = require("../../models/PartnerBank");

const createPartnerBankSchema = z.object({
  name: z
    .string({ required_error: "Canonical bank name is required" })
    .trim()
    .min(2, "Bank name must be at least 2 characters")
    .max(150, "Bank name cannot exceed 150 characters"),

  code: z
    .string({ required_error: "Bank identifier code is required" })
    .trim()
    .toUpperCase()
    .min(2, "Bank code must be at least 2 characters")
    .max(20, "Bank code cannot exceed 20 characters")
    .regex(/^[A-Z0-9]+$/, "Bank code must be alphanumeric uppercase"),

  aliases: z
    .array(z.string().trim().max(100))
    .optional()
    .default([]),

  countries: z
    .array(z.string().trim().length(2, "Country code must be 2 characters (ISO 3166-1 alpha-2)"))
    .optional()
    .default(["IN"]),

  supportedStates: z
    .array(z.string().trim().max(100))
    .optional()
    .default([]),

  routingSystem: z
    .enum(ROUTING_SYSTEMS)
    .default("IFSC"),

  ifscPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .max(10)
    .nullable()
    .optional(),

  isActive: z.boolean().default(true).optional(),
  isEligibleForNewApplications: z.boolean().default(true).optional(),
  logoUrl: z.string().trim().nullable().optional(),
  displayOrder: z.coerce.number().default(100).optional(),
});

const updatePartnerBankSchema = createPartnerBankSchema.partial();

const togglePartnerBankStatusSchema = z.object({
  isActive: z.boolean().optional(),
  isEligibleForNewApplications: z.boolean().optional(),
  reason: z.string().trim().max(500).optional(),
});

const listPartnerBanksQuerySchema = z.object({
  search: z.string().trim().optional(),
  country: z.string().trim().optional(),
  state: z.string().trim().optional(),
  isActive: z.enum(["true", "false"]).optional(),
  isEligibleForNewApplications: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().min(1).default(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(20).optional(),
  all: z.enum(["true", "false"]).optional(),
});

module.exports = {
  createPartnerBankSchema,
  updatePartnerBankSchema,
  togglePartnerBankStatusSchema,
  listPartnerBanksQuerySchema,
};

