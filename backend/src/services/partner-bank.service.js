const mongoose = require("mongoose");
const PartnerBank = require("../models/PartnerBank");
const AuditLog = require("../models/AuditLog");
const AppError = require("../errors/AppError");

const DEFAULT_PARTNER_BANKS = [
  {
    name: "State Bank of India",
    code: "SBIN",
    aliases: ["SBI", "State Bank"],
    countries: ["IN"],
    routingSystem: "IFSC",
    ifscPrefix: "SBIN",
    isActive: true,
    isEligibleForNewApplications: true,
    displayOrder: 1,
  },
  {
    name: "HDFC Bank",
    code: "HDFC",
    aliases: ["HDFC", "Housing Development Finance Corporation"],
    countries: ["IN"],
    routingSystem: "IFSC",
    ifscPrefix: "HDFC",
    isActive: true,
    isEligibleForNewApplications: true,
    displayOrder: 2,
  },
  {
    name: "ICICI Bank",
    code: "ICIC",
    aliases: ["ICICI", "Industrial Credit and Investment Corporation of India"],
    countries: ["IN"],
    routingSystem: "IFSC",
    ifscPrefix: "ICIC",
    isActive: true,
    isEligibleForNewApplications: true,
    displayOrder: 3,
  },
  {
    name: "Axis Bank",
    code: "UTIB",
    aliases: ["Axis", "UTI Bank"],
    countries: ["IN"],
    routingSystem: "IFSC",
    ifscPrefix: "UTIB",
    isActive: true,
    isEligibleForNewApplications: true,
    displayOrder: 4,
  },
  {
    name: "Kotak Mahindra Bank",
    code: "KKBK",
    aliases: ["Kotak", "KMBL"],
    countries: ["IN"],
    routingSystem: "IFSC",
    ifscPrefix: "KKBK",
    isActive: true,
    isEligibleForNewApplications: true,
    displayOrder: 5,
  },
  {
    name: "Punjab National Bank",
    code: "PUNB",
    aliases: ["PNB"],
    countries: ["IN"],
    routingSystem: "IFSC",
    ifscPrefix: "PUNB",
    isActive: true,
    isEligibleForNewApplications: true,
    displayOrder: 6,
  },
  {
    name: "Bank of Baroda",
    code: "BARB",
    aliases: ["BOB", "Baroda Bank"],
    countries: ["IN"],
    routingSystem: "IFSC",
    ifscPrefix: "BARB",
    isActive: true,
    isEligibleForNewApplications: true,
    displayOrder: 7,
  },
  {
    name: "Canara Bank",
    code: "CNRB",
    aliases: ["Canara"],
    countries: ["IN"],
    routingSystem: "IFSC",
    ifscPrefix: "CNRB",
    isActive: true,
    isEligibleForNewApplications: true,
    displayOrder: 8,
  },
  {
    name: "Union Bank of India",
    code: "UBIN",
    aliases: ["Union Bank", "UBI"],
    countries: ["IN"],
    routingSystem: "IFSC",
    ifscPrefix: "UBIN",
    isActive: true,
    isEligibleForNewApplications: true,
    displayOrder: 9,
  },
  {
    name: "IndusInd Bank",
    code: "INDB",
    aliases: ["IndusInd"],
    countries: ["IN"],
    routingSystem: "IFSC",
    ifscPrefix: "INDB",
    isActive: true,
    isEligibleForNewApplications: true,
    displayOrder: 10,
  },
  {
    name: "Yes Bank",
    code: "YESB",
    aliases: ["YES"],
    countries: ["IN"],
    routingSystem: "IFSC",
    ifscPrefix: "YESB",
    isActive: true,
    isEligibleForNewApplications: true,
    displayOrder: 11,
  },
  {
    name: "IDFC FIRST Bank",
    code: "IDFB",
    aliases: ["IDFC", "IDFC First"],
    countries: ["IN"],
    routingSystem: "IFSC",
    ifscPrefix: "IDFB",
    isActive: true,
    isEligibleForNewApplications: true,
    displayOrder: 12,
  },
];

/**
 * Seed initial partner banks if catalogue is empty
 */
const seedDefaultPartnerBanks = async () => {
  const count = await PartnerBank.countDocuments();
  if (count === 0) {
    for (const bank of DEFAULT_PARTNER_BANKS) {
      await PartnerBank.create(bank).catch(() => {});
    }
  }
};

/**
 * List partner banks with search, filters, and pagination
 */
const listPartnerBanks = async ({
  search = null,
  country = null,
  state = null,
  isActive = undefined,
  isEligibleForNewApplications = undefined,
  page = 1,
  limit = 20,
  all = false,
} = {}) => {
  const filter = {};

  if (country) {
    filter.countries = country.toUpperCase();
  }

  if (state) {
    filter.$or = [
      { supportedStates: { $size: 0 } },
      { supportedStates: state },
    ];
  }

  if (isActive !== undefined && isActive !== null && isActive !== "") {
    filter.isActive = String(isActive) === "true";
  }

  if (
    isEligibleForNewApplications !== undefined &&
    isEligibleForNewApplications !== null &&
    isEligibleForNewApplications !== ""
  ) {
    filter.isEligibleForNewApplications = String(isEligibleForNewApplications) === "true";
  }

  if (search && search.trim()) {
    const term = search.trim();
    const regex = new RegExp(term, "i");
    const searchConditions = [
      { name: regex },
      { code: regex },
      { aliases: regex },
    ];

    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
      delete filter.$or;
    } else {
      filter.$or = searchConditions;
    }
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));

  if (all) {
    const banks = await PartnerBank.find(filter)
      .sort({ displayOrder: 1, name: 1 })
      .lean();
    return {
      items: banks.map((b) => ({ ...b, id: b._id })),
      meta: {
        total: banks.length,
        page: 1,
        limit: banks.length,
        totalPages: 1,
      },
    };
  }

  const [items, total] = await Promise.all([
    PartnerBank.find(filter)
      .sort({ displayOrder: 1, name: 1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    PartnerBank.countDocuments(filter),
  ]);

  return {
    items: items.map((b) => ({ ...b, id: b._id })),
    meta: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
};

/**
 * Get single partner bank by ID
 */
const getPartnerBankById = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid partner bank ID", 400, "INVALID_ID");
  }

  const bank = await PartnerBank.findById(id);
  if (!bank) {
    throw new AppError("Partner bank not found", 404, "PARTNER_BANK_NOT_FOUND");
  }

  return bank;
};

/**
 * Create a new partner bank (Superadmin only)
 */
const createPartnerBank = async ({ bankData, creatorId, req = null }) => {
  const {
    name,
    code,
    aliases = [],
    countries = ["IN"],
    supportedStates = [],
    routingSystem = "IFSC",
    ifscPrefix = null,
    isActive = true,
    isEligibleForNewApplications = true,
    logoUrl = null,
    displayOrder = 100,
  } = bankData;

  const normalizedName = name.toLowerCase().trim();
  const upperCode = code.toUpperCase().trim();

  // Check code uniqueness
  const existingCode = await PartnerBank.findOne({ code: upperCode });
  if (existingCode) {
    throw new AppError(
      `A partner bank with identifier code '${upperCode}' already exists`,
      400,
      "DUPLICATE_BANK_CODE"
    );
  }

  // Check canonical name uniqueness within country
  const existingName = await PartnerBank.findOne({
    normalizedName,
    countries: { $in: countries.map((c) => c.toUpperCase()) },
  });
  if (existingName) {
    throw new AppError(
      `A partner bank with name '${name}' already exists for these countries`,
      400,
      "DUPLICATE_BANK_NAME"
    );
  }

  const partnerBank = await PartnerBank.create({
    name: name.trim(),
    normalizedName,
    code: upperCode,
    aliases: aliases.map((a) => a.trim()).filter(Boolean),
    countries: countries.map((c) => c.toUpperCase().trim()).filter(Boolean),
    supportedStates: supportedStates.map((s) => s.trim()).filter(Boolean),
    routingSystem,
    ifscPrefix: ifscPrefix ? ifscPrefix.toUpperCase().trim() : null,
    isActive: Boolean(isActive),
    isEligibleForNewApplications: Boolean(isEligibleForNewApplications),
    logoUrl: logoUrl ? logoUrl.trim() : null,
    displayOrder: Number(displayOrder) || 100,
    createdBy: creatorId,
    updatedBy: creatorId,
  });

  await AuditLog.create([
    {
      actorId: creatorId,
      targetId: partnerBank._id,
      action: "partner_bank.created",
      entityType: "PartnerBank",
      beforeState: null,
      afterState: partnerBank.toObject(),
      reason: `Partner bank ${partnerBank.name} (${partnerBank.code}) registered in directory`,
      ipAddress: req?.ip || null,
      userAgent: req?.headers?.["user-agent"] || null,
    },
  ]).catch(() => {});

  return partnerBank;
};

/**
 * Update partner bank metadata (Superadmin only)
 */
const updatePartnerBank = async ({ bankId, updateData, updaterId, req = null }) => {
  const bank = await getPartnerBankById(bankId);
  const beforeState = bank.toObject();

  if (updateData.code && updateData.code.toUpperCase().trim() !== bank.code) {
    const upperCode = updateData.code.toUpperCase().trim();
    const existing = await PartnerBank.findOne({ code: upperCode, _id: { $ne: bank._id } });
    if (existing) {
      throw new AppError(`A partner bank with code '${upperCode}' already exists`, 400, "DUPLICATE_BANK_CODE");
    }
    bank.code = upperCode;
  }

  if (updateData.name && updateData.name.trim() !== bank.name) {
    const trimmedName = updateData.name.trim();
    const normalizedName = trimmedName.toLowerCase();
    const targetCountries = updateData.countries || bank.countries;
    const existing = await PartnerBank.findOne({
      normalizedName,
      countries: { $in: targetCountries },
      _id: { $ne: bank._id },
    });
    if (existing) {
      throw new AppError(`A partner bank with name '${trimmedName}' already exists`, 400, "DUPLICATE_BANK_NAME");
    }
    bank.name = trimmedName;
    bank.normalizedName = normalizedName;
  }

  if (updateData.aliases !== undefined) {
    bank.aliases = updateData.aliases.map((a) => a.trim()).filter(Boolean);
  }

  if (updateData.countries !== undefined) {
    bank.countries = updateData.countries.map((c) => c.toUpperCase().trim()).filter(Boolean);
  }

  if (updateData.supportedStates !== undefined) {
    bank.supportedStates = updateData.supportedStates.map((s) => s.trim()).filter(Boolean);
  }

  if (updateData.routingSystem !== undefined) {
    bank.routingSystem = updateData.routingSystem;
  }

  if (updateData.ifscPrefix !== undefined) {
    bank.ifscPrefix = updateData.ifscPrefix ? updateData.ifscPrefix.toUpperCase().trim() : null;
  }

  if (updateData.isActive !== undefined) {
    bank.isActive = Boolean(updateData.isActive);
  }

  if (updateData.isEligibleForNewApplications !== undefined) {
    bank.isEligibleForNewApplications = Boolean(updateData.isEligibleForNewApplications);
  }

  if (updateData.logoUrl !== undefined) {
    bank.logoUrl = updateData.logoUrl ? updateData.logoUrl.trim() : null;
  }

  if (updateData.displayOrder !== undefined) {
    bank.displayOrder = Number(updateData.displayOrder) || 100;
  }

  bank.updatedBy = updaterId;
  await bank.save();

  await AuditLog.create([
    {
      actorId: updaterId,
      targetId: bank._id,
      action: "partner_bank.updated",
      entityType: "PartnerBank",
      beforeState,
      afterState: bank.toObject(),
      reason: `Partner bank ${bank.name} metadata updated`,
      ipAddress: req?.ip || null,
      userAgent: req?.headers?.["user-agent"] || null,
    },
  ]).catch(() => {});

  return bank;
};

/**
 * Toggle Partner Bank active or eligible status (Superadmin only)
 */
const togglePartnerBankStatus = async ({
  bankId,
  isActive,
  isEligibleForNewApplications,
  reason = null,
  updaterId,
  req = null,
}) => {
  const bank = await getPartnerBankById(bankId);
  const beforeState = bank.toObject();

  if (isActive !== undefined) {
    bank.isActive = Boolean(isActive);
  }

  if (isEligibleForNewApplications !== undefined) {
    bank.isEligibleForNewApplications = Boolean(isEligibleForNewApplications);
  }

  bank.updatedBy = updaterId;
  await bank.save();

  const action = bank.isActive && bank.isEligibleForNewApplications
    ? "partner_bank.enabled"
    : "partner_bank.disabled";

  await AuditLog.create([
    {
      actorId: updaterId,
      targetId: bank._id,
      action,
      entityType: "PartnerBank",
      beforeState,
      afterState: bank.toObject(),
      reason: reason || `Partner bank status updated (isActive: ${bank.isActive}, isEligible: ${bank.isEligibleForNewApplications})`,
      ipAddress: req?.ip || null,
      userAgent: req?.headers?.["user-agent"] || null,
    },
  ]).catch(() => {});

  return bank;
};

module.exports = {
  seedDefaultPartnerBanks,
  listPartnerBanks,
  getPartnerBankById,
  createPartnerBank,
  updatePartnerBank,
  togglePartnerBankStatus,
  DEFAULT_PARTNER_BANKS,
};

