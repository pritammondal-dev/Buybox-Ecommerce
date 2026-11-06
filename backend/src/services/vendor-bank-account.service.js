const mongoose = require("mongoose");
const Vendor = require("../models/Vendor");
const VendorPayout = require("../models/VendorPayout");
const PartnerBank = require("../models/PartnerBank");
const {
  VendorBankAccount,
  MAX_BANK_ACCOUNTS_PER_VENDOR,
} = require("../models/VendorBankAccount");
const {
  computeBankAccountHash,
  encryptBankAccount,
  decryptBankAccount,
  maskBankAccount,
} = require("../utils/bank-crypto.util");
const { recordAuditLog } = require("./governance.service");
const withTransaction = require("../utils/withTransaction");
const AppError = require("../errors/AppError");

/**
 * Resolves and validates partner bank eligibility if partnerBankId is supplied.
 */
const resolvePartnerBank = async (partnerBankId) => {
  if (partnerBankId) {
    if (!mongoose.isValidObjectId(partnerBankId)) {
      throw new AppError("Invalid partner bank ID", 400, "INVALID_PARTNER_BANK_ID");
    }
    const bank = await PartnerBank.findById(partnerBankId);
    if (!bank) {
      throw new AppError("Partner bank not found", 400, "PARTNER_BANK_NOT_FOUND");
    }
    if (!bank.isActive || !bank.isEligibleForNewApplications) {
      throw new AppError(
        "Selected partner bank is not eligible for new applications",
        400,
        "PARTNER_BANK_INELIGIBLE"
      );
    }
    return bank;
  }
  return null;
};

/**
 * Vendor self-service: submit a new bank account application.
 * Maximum 3 accounts per vendor (counting pending, under_review, approved, and rejected until archived).
 */
const submitBankAccount = async ({ vendorId, userId, accountData, req = null }) => {
  const vendor = await Vendor.findById(vendorId);
  if (!vendor || vendor.deletedAt) {
    throw new AppError("Vendor profile not found or deactivated", 404, "VENDOR_NOT_FOUND");
  }

  if (vendor.onboardingStatus === "suspended" || vendor.isActive === false) {
    throw new AppError("Suspended vendors cannot submit bank accounts", 403, "VENDOR_SUSPENDED");
  }

  // 1. Enforce strict 3-account limit per vendor
  const currentCount = await VendorBankAccount.countDocuments({
    vendorId,
    deletedAt: null,
  });

  if (currentCount >= MAX_BANK_ACCOUNTS_PER_VENDOR) {
    throw new AppError(
      `Vendor cannot exceed the maximum limit of ${MAX_BANK_ACCOUNTS_PER_VENDOR} bank accounts`,
      400,
      "BANK_ACCOUNT_LIMIT_EXCEEDED"
    );
  }

  // Resolve partner bank if specified
  let partnerBank = null;
  let resolvedBankName = accountData.bankName?.trim();

  if (accountData.partnerBankId) {
    partnerBank = await resolvePartnerBank(accountData.partnerBankId);
    resolvedBankName = partnerBank.name;
  }

  if (!resolvedBankName) {
    throw new AppError("Bank selection or bank name is required", 400, "BANK_NAME_REQUIRED");
  }

  // 2. Blind index computation and duplicate check
  const accountNumberHash = computeBankAccountHash(
    accountData.accountNumber,
    accountData.ifscCode
  );

  const duplicate = await VendorBankAccount.findOne({
    vendorId,
    accountNumberHash,
    deletedAt: null,
  });

  if (duplicate) {
    throw new AppError(
      "This bank account is already registered for this vendor",
      409,
      "DUPLICATE_BANK_ACCOUNT"
    );
  }

  // 3. Encrypt and mask
  const accountNumberEncrypted = encryptBankAccount(accountData.accountNumber);
  const accountNumberMasked = maskBankAccount(accountData.accountNumber);

  const bankAccount = await VendorBankAccount.create({
    vendorId,
    partnerBankId: partnerBank ? partnerBank._id : null,
    accountHolderName: accountData.accountHolderName.trim(),
    bankName: resolvedBankName,
    country: accountData.country ? accountData.country.toUpperCase().trim() : (partnerBank?.countries?.[0] || "IN"),
    state: accountData.state ? accountData.state.trim() : null,
    accountNumberEncrypted,
    accountNumberMasked,
    accountNumberHash,
    ifscCode: accountData.ifscCode ? accountData.ifscCode.trim().toUpperCase() : null,
    branchName: accountData.branchName ? accountData.branchName.trim() : null,
    accountType: accountData.accountType || "current",
    status: "pending",
    isActive: false,
    submittedBy: userId,
    submittedAt: new Date(),
    submissionReason: accountData.submissionReason || null,
  });

  await recordAuditLog({
    actorId: userId,
    targetId: bankAccount._id,
    action: "vendor_bank_account.submitted",
    entityType: "VendorBankAccount",
    afterState: bankAccount,
    reason: accountData.submissionReason || "Vendor submitted new bank account application",
    req,
  });

  return bankAccount;
};

/**
 * Vendor self-service: list all own bank accounts (masked).
 */
const listVendorBankAccounts = async (vendorId) => {
  return VendorBankAccount.find({ vendorId, deletedAt: null }).sort({
    createdAt: -1,
  });
};

/**
 * Vendor self-service: switch active payout destination among approved accounts.
 * Atomic transition within a MongoDB transaction.
 */
const switchActiveBankAccount = async ({ vendorId, bankAccountId, userId, req = null }) => {
  return withTransaction(async (session) => {
    const target = await VendorBankAccount.findOne({
      _id: bankAccountId,
      vendorId,
      deletedAt: null,
    }).session(session);

    if (!target) {
      throw new AppError("Bank account not found", 404, "BANK_ACCOUNT_NOT_FOUND");
    }

    if (target.status !== "approved") {
      throw new AppError(
        "Only approved bank accounts can be activated for payouts",
        400,
        "ACCOUNT_NOT_ELIGIBLE_FOR_ACTIVATION"
      );
    }

    if (target.isActive === true) {
      return {
        activeAccountId: target._id,
        bankAccount: target,
        message: "Bank account is already the active payout destination",
      };
    }

    const beforeState = target.toObject();

    // Deactivate previous active account for this vendor
    const currentActive = await VendorBankAccount.findOne({
      vendorId,
      isActive: true,
      deletedAt: null,
    }).session(session);

    if (currentActive) {
      currentActive.isActive = false;
      currentActive.deactivatedAt = new Date();
      currentActive.deactivatedBy = userId;
      await currentActive.save({ session });
    }

    // Activate the target account
    target.isActive = true;
    target.activatedAt = new Date();
    await target.save({ session });

    await recordAuditLog({
      actorId: userId,
      targetId: target._id,
      action: "vendor_bank_account.switched_active",
      entityType: "VendorBankAccount",
      beforeState,
      afterState: target,
      reason: "Vendor selected bank account as active payout destination",
      req,
      session,
    });

    return {
      activeAccountId: target._id,
      bankAccount: target,
      message: "Active payout account switched successfully",
    };
  });
};

/**
 * Vendor self-service: resubmit corrected details for a rejected account.
 */
const resubmitBankAccount = async ({
  vendorId,
  bankAccountId,
  userId,
  accountData,
  req = null,
}) => {
  const vendor = await Vendor.findById(vendorId);
  if (!vendor || vendor.deletedAt) {
    throw new AppError("Vendor profile not found or deactivated", 404, "VENDOR_NOT_FOUND");
  }

  if (vendor.onboardingStatus === "suspended" || vendor.isActive === false) {
    throw new AppError("Suspended vendors cannot resubmit bank accounts", 403, "VENDOR_SUSPENDED");
  }

  const account = await VendorBankAccount.findOne({
    _id: bankAccountId,
    vendorId,
    deletedAt: null,
  });

  if (!account) {
    throw new AppError("Bank account not found", 404, "BANK_ACCOUNT_NOT_FOUND");
  }

  if (account.status !== "rejected") {
    throw new AppError(
      "Only rejected bank accounts can be resubmitted",
      400,
      "CANNOT_RESUBMIT_NON_REJECTED"
    );
  }

  // Resolve partner bank if specified
  let partnerBank = null;
  let resolvedBankName = accountData.bankName?.trim() || account.bankName;

  if (accountData.partnerBankId) {
    partnerBank = await resolvePartnerBank(accountData.partnerBankId);
    resolvedBankName = partnerBank.name;
  }

  if (!resolvedBankName) {
    throw new AppError("Bank selection or bank name is required", 400, "BANK_NAME_REQUIRED");
  }

  const accountNumberHash = computeBankAccountHash(
    accountData.accountNumber,
    accountData.ifscCode
  );

  const duplicate = await VendorBankAccount.findOne({
    vendorId,
    accountNumberHash,
    _id: { $ne: account._id },
    deletedAt: null,
  });

  if (duplicate) {
    throw new AppError(
      "This bank account is already registered for this vendor",
      409,
      "DUPLICATE_BANK_ACCOUNT"
    );
  }

  const beforeState = account.toObject();

  account.partnerBankId = partnerBank ? partnerBank._id : (accountData.partnerBankId === null ? null : account.partnerBankId);
  account.accountHolderName = accountData.accountHolderName.trim();
  account.bankName = resolvedBankName;
  if (accountData.country) account.country = accountData.country.toUpperCase().trim();
  if (accountData.state !== undefined) account.state = accountData.state ? accountData.state.trim() : null;
  account.accountNumberEncrypted = encryptBankAccount(accountData.accountNumber);
  account.accountNumberMasked = maskBankAccount(accountData.accountNumber);
  account.accountNumberHash = accountNumberHash;
  account.ifscCode = accountData.ifscCode ? accountData.ifscCode.trim().toUpperCase() : null;
  account.branchName = accountData.branchName ? accountData.branchName.trim() : null;
  account.accountType = accountData.accountType || "current";
  account.status = "pending";
  account.rejectionReason = null;
  account.submittedAt = new Date();
  account.submittedBy = userId;
  account.submissionReason = accountData.submissionReason || null;
  account.reviewedBy = null;
  account.reviewedAt = null;
  account.version = (account.version || 1) + 1;

  await account.save();

  await recordAuditLog({
    actorId: userId,
    targetId: account._id,
    action: "vendor_bank_account.resubmitted",
    entityType: "VendorBankAccount",
    beforeState,
    afterState: account,
    reason: accountData.submissionReason || "Vendor resubmitted corrected bank account details",
    req,
  });

  return account;
};

/**
 * Administrative reviewer queue: list pending and under_review applications across all vendors.
 */
const listPendingApplications = async (query = {}) => {
  const safePage = Math.max(Number(query.page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const filter = { deletedAt: null };
  if (query.status && query.status !== "all") {
    filter.status = query.status;
  } else if (!query.status) {
    filter.status = { $in: ["pending", "under_review"] };
  }

  if (query.search && query.search.trim()) {
    const s = query.search.trim();
    filter.$or = [
      { bankName: { $regex: s, $options: "i" } },
      { ifscCode: { $regex: s, $options: "i" } },
      { accountHolderName: { $regex: s, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    VendorBankAccount.find(filter)
      .populate("vendorId", "businessName storeName businessSlug email phone onboardingStatus")
      .populate("submittedBy", "name email")
      .populate("reviewedBy", "name email")
      .sort({ submittedAt: 1 })
      .skip(skip)
      .limit(safeLimit),
    VendorBankAccount.countDocuments(filter),
  ]);

  return {
    items,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
};

/**
 * Superadmin / Reviewer: list all bank accounts for a specific vendor.
 */
const listAdminVendorBankAccounts = async (vendorId) => {
  return VendorBankAccount.find({ vendorId, deletedAt: null })
    .populate("submittedBy", "name email")
    .populate("reviewedBy", "name email")
    .sort({ createdAt: -1 });
};

/**
 * Superadmin / Reviewer: get a single bank account details.
 */
const getAdminVendorBankAccount = async ({ vendorId, bankAccountId }) => {
  const filter = { _id: bankAccountId, deletedAt: null };
  if (vendorId) {
    filter.vendorId = vendorId;
  }

  const account = await VendorBankAccount.findOne(filter)
    .populate("vendorId", "businessName storeName businessSlug email phone onboardingStatus")
    .populate("submittedBy", "name email")
    .populate("reviewedBy", "name email");

  if (!account) {
    throw new AppError("Bank account not found", 404, "BANK_ACCOUNT_NOT_FOUND");
  }

  return account;
};

/**
 * Authorized Reviewer: review bank account application (approve, reject, or mark under_review).
 */
const reviewApplication = async ({
  vendorId = null,
  bankAccountId,
  reviewerId,
  action,
  reason = null,
  req = null,
}) => {
  return withTransaction(async (session) => {
    const filter = { _id: bankAccountId, deletedAt: null };
    if (vendorId) {
      filter.vendorId = vendorId;
    }

    const account = await VendorBankAccount.findOne(filter).session(session);
    if (!account) {
      throw new AppError("Bank account application not found", 404, "BANK_ACCOUNT_NOT_FOUND");
    }

    const beforeState = account.toObject();

    if (action === "approve") {
      if (account.status === "approved") {
        return account;
      }

      account.status = "approved";
      account.reviewedBy = reviewerId;
      account.reviewedAt = new Date();
      account.approvedAt = new Date();
      account.rejectionReason = null;

      // Auto-activation if vendor currently has NO active payout account
      const activeExists = await VendorBankAccount.exists({
        vendorId: account.vendorId,
        isActive: true,
        deletedAt: null,
      }).session(session);

      if (!activeExists) {
        account.isActive = true;
        account.activatedAt = new Date();
      }

      await account.save({ session });

      await recordAuditLog({
        actorId: reviewerId,
        targetId: account._id,
        action: "vendor_bank_account.approved",
        entityType: "VendorBankAccount",
        beforeState,
        afterState: account,
        reason: reason || "Bank account application approved by reviewer",
        req,
        session,
      });

      return account;
    }

    if (action === "reject") {
      if (!reason || reason.trim().length < 10) {
        throw new AppError(
          "Administrative rejection reason must be at least 10 characters",
          400,
          "REJECTION_REASON_REQUIRED"
        );
      }

      // If account was active, deactivate it immediately
      if (account.isActive === true) {
        account.isActive = false;
        account.deactivatedAt = new Date();
        account.deactivatedBy = reviewerId;
      }

      account.status = "rejected";
      account.rejectionReason = reason.trim();
      account.reviewedBy = reviewerId;
      account.reviewedAt = new Date();

      await account.save({ session });

      await recordAuditLog({
        actorId: reviewerId,
        targetId: account._id,
        action: "vendor_bank_account.rejected",
        entityType: "VendorBankAccount",
        beforeState,
        afterState: account,
        reason: reason.trim(),
        req,
        session,
      });

      return account;
    }

    if (action === "under_review") {
      account.status = "under_review";
      account.reviewedBy = reviewerId;
      account.reviewedAt = new Date();

      await account.save({ session });

      await recordAuditLog({
        actorId: reviewerId,
        targetId: account._id,
        action: "vendor_bank_account.marked_under_review",
        entityType: "VendorBankAccount",
        beforeState,
        afterState: account,
        reason: reason || "Reviewer commenced investigation of bank details",
        req,
        session,
      });

      return account;
    }

    throw new AppError(`Unsupported review action: ${action}`, 400, "INVALID_REVIEW_ACTION");
  });
};

/**
 * Privileged Unmasking: decrypt raw account number for authorized auditor.
 * Requires mandatory reason (min 10 chars) and writes immutable AuditLog.
 */
const unmaskBankAccount = async ({
  vendorId = null,
  bankAccountId,
  actorId,
  reason,
  req = null,
}) => {
  if (!reason || reason.trim().length < 10) {
    throw new AppError(
      "Audit reason (min 10 characters) is required to view unmasked financial credentials",
      400,
      "REASON_REQUIRED"
    );
  }

  const filter = { _id: bankAccountId, deletedAt: null };
  if (vendorId) {
    filter.vendorId = vendorId;
  }

  const account = await VendorBankAccount.findOne(filter);
  if (!account) {
    throw new AppError("Bank account not found", 404, "BANK_ACCOUNT_NOT_FOUND");
  }

  const rawAccountNumber = decryptBankAccount(account.accountNumberEncrypted);

  await recordAuditLog({
    actorId,
    targetId: account._id,
    action: "vendor_bank_account.unmasked_view",
    entityType: "VendorBankAccount",
    reason: reason.trim(),
    req,
  });

  return {
    bankAccountId: account._id,
    vendorId: account.vendorId,
    accountNumber: rawAccountNumber,
    accountNumberMasked: account.accountNumberMasked,
    accountHolderName: account.accountHolderName,
    bankName: account.bankName,
    ifscCode: account.ifscCode,
  };
};

/**
 * Superadmin: administratively create bank account.
 */
const adminAddBankAccount = async ({
  vendorId,
  actorId,
  accountData,
  reason,
  autoApprove = false,
  setActive = false,
  req = null,
}) => {
  if (!reason || reason.trim().length < 10) {
    throw new AppError(
      "Administrative reason (min 10 characters) is required",
      400,
      "REASON_REQUIRED"
    );
  }

  const vendor = await Vendor.findById(vendorId);
  if (!vendor || vendor.deletedAt) {
    throw new AppError("Vendor profile not found or deactivated", 404, "VENDOR_NOT_FOUND");
  }

  const currentCount = await VendorBankAccount.countDocuments({
    vendorId,
    deletedAt: null,
  });

  if (currentCount >= MAX_BANK_ACCOUNTS_PER_VENDOR) {
    throw new AppError(
      `Vendor cannot exceed the maximum limit of ${MAX_BANK_ACCOUNTS_PER_VENDOR} bank accounts`,
      400,
      "BANK_ACCOUNT_LIMIT_EXCEEDED"
    );
  }

  // Resolve partner bank if specified
  let partnerBank = null;
  let resolvedBankName = accountData.bankName?.trim();

  if (accountData.partnerBankId) {
    partnerBank = await resolvePartnerBank(accountData.partnerBankId);
    resolvedBankName = partnerBank.name;
  }

  if (!resolvedBankName) {
    throw new AppError("Bank selection or bank name is required", 400, "BANK_NAME_REQUIRED");
  }

  const accountNumberHash = computeBankAccountHash(
    accountData.accountNumber,
    accountData.ifscCode
  );

  const duplicate = await VendorBankAccount.findOne({
    vendorId,
    accountNumberHash,
    deletedAt: null,
  });

  if (duplicate) {
    throw new AppError(
      "This bank account is already registered for this vendor",
      409,
      "DUPLICATE_BANK_ACCOUNT"
    );
  }

  if (setActive && !autoApprove) {
    throw new AppError(
      "Cannot set unapproved bank account as active payout destination",
      400,
      "CANNOT_ACTIVATE_UNAPPROVED_ACCOUNT"
    );
  }

  return withTransaction(async (session) => {
    if (setActive) {
      const currentActive = await VendorBankAccount.findOne({
        vendorId,
        isActive: true,
        deletedAt: null,
      }).session(session);

      if (currentActive) {
        currentActive.isActive = false;
        currentActive.deactivatedAt = new Date();
        currentActive.deactivatedBy = actorId;
        await currentActive.save({ session });
      }
    }

    const accountNumberEncrypted = encryptBankAccount(accountData.accountNumber);
    const accountNumberMasked = maskBankAccount(accountData.accountNumber);

    const [account] = await VendorBankAccount.create(
      [
        {
          vendorId,
          partnerBankId: partnerBank ? partnerBank._id : null,
          accountHolderName: accountData.accountHolderName.trim(),
          bankName: resolvedBankName,
          country: accountData.country ? accountData.country.toUpperCase().trim() : (partnerBank?.countries?.[0] || "IN"),
          state: accountData.state ? accountData.state.trim() : null,
          accountNumberEncrypted,
          accountNumberMasked,
          accountNumberHash,
          ifscCode: accountData.ifscCode ? accountData.ifscCode.trim().toUpperCase() : null,
          branchName: accountData.branchName ? accountData.branchName.trim() : null,
          accountType: accountData.accountType || "current",
          status: autoApprove ? "approved" : "pending",
          isActive: Boolean(setActive),
          submittedBy: actorId,
          submittedAt: new Date(),
          submissionReason: reason.trim(),
          reviewedBy: autoApprove ? actorId : null,
          reviewedAt: autoApprove ? new Date() : null,
          approvedAt: autoApprove ? new Date() : null,
          activatedAt: setActive ? new Date() : null,
        },
      ],
      { session }
    );

    await recordAuditLog({
      actorId,
      targetId: account._id,
      action: "vendor_bank_account.admin_created",
      entityType: "VendorBankAccount",
      afterState: account,
      reason: reason.trim(),
      req,
      session,
    });

    return account;
  });
};

/**
 * Superadmin: administratively edit bank account details.
 * If account number or IFSC changes, approval is revoked and reset to pending.
 */
const adminUpdateBankAccount = async ({
  vendorId,
  bankAccountId,
  actorId,
  updateData,
  reason,
  req = null,
}) => {
  if (!reason || reason.trim().length < 10) {
    throw new AppError(
      "Administrative reason (min 10 characters) is required",
      400,
      "REASON_REQUIRED"
    );
  }

  return withTransaction(async (session) => {
    const account = await VendorBankAccount.findOne({
      _id: bankAccountId,
      vendorId,
      deletedAt: null,
    }).session(session);

    if (!account) {
      throw new AppError("Bank account not found", 404, "BANK_ACCOUNT_NOT_FOUND");
    }

    const beforeState = account.toObject();

    if (updateData.partnerBankId !== undefined) {
      if (updateData.partnerBankId) {
        const pBank = await resolvePartnerBank(updateData.partnerBankId);
        account.partnerBankId = pBank._id;
        if (!updateData.bankName) {
          account.bankName = pBank.name;
        }
      } else {
        account.partnerBankId = null;
      }
    }
    if (updateData.country !== undefined) {
      account.country = updateData.country ? updateData.country.toUpperCase().trim() : "IN";
    }
    if (updateData.state !== undefined) {
      account.state = updateData.state ? updateData.state.trim() : null;
    }
    if (updateData.accountHolderName) {
      account.accountHolderName = updateData.accountHolderName.trim();
    }
    if (updateData.bankName) {
      account.bankName = updateData.bankName.trim();
    }
    if (updateData.branchName !== undefined) {
      account.branchName = updateData.branchName ? updateData.branchName.trim() : null;
    }
    if (updateData.accountType) {
      account.accountType = updateData.accountType;
    }

    // Critical financial detail change: account number or IFSC
    if (updateData.accountNumber || updateData.ifscCode) {
      const newAccNum = updateData.accountNumber || decryptBankAccount(account.accountNumberEncrypted);
      const newIfsc = updateData.ifscCode || account.ifscCode;

      const newHash = computeBankAccountHash(newAccNum, newIfsc);
      const duplicate = await VendorBankAccount.findOne({
        vendorId,
        accountNumberHash: newHash,
        _id: { $ne: account._id },
        deletedAt: null,
      }).session(session);

      if (duplicate) {
        throw new AppError(
          "This bank account is already registered for this vendor",
          409,
          "DUPLICATE_BANK_ACCOUNT"
        );
      }

      account.accountNumberEncrypted = encryptBankAccount(newAccNum);
      account.accountNumberMasked = maskBankAccount(newAccNum);
      account.accountNumberHash = newHash;
      account.ifscCode = newIfsc.trim().toUpperCase();

      // Revoke prior approval on critical detail modification
      account.status = "pending";
      account.isActive = false;
      account.approvedAt = null;
      account.reviewedBy = null;
      account.reviewedAt = null;
    }

    account.version = (account.version || 1) + 1;
    await account.save({ session });

    await recordAuditLog({
      actorId,
      targetId: account._id,
      action: "vendor_bank_account.admin_updated",
      entityType: "VendorBankAccount",
      beforeState,
      afterState: account,
      reason: reason.trim(),
      req,
      session,
    });

    return account;
  });
};

/**
 * Superadmin: administratively toggle active payout status.
 */
const adminSetStatusBankAccount = async ({
  vendorId,
  bankAccountId,
  actorId,
  isActive,
  reason,
  req = null,
}) => {
  if (!reason || reason.trim().length < 10) {
    throw new AppError(
      "Administrative reason (min 10 characters) is required",
      400,
      "REASON_REQUIRED"
    );
  }

  return withTransaction(async (session) => {
    const account = await VendorBankAccount.findOne({
      _id: bankAccountId,
      vendorId,
      deletedAt: null,
    }).session(session);

    if (!account) {
      throw new AppError("Bank account not found", 404, "BANK_ACCOUNT_NOT_FOUND");
    }

    const beforeState = account.toObject();

    if (isActive === true) {
      if (account.status !== "approved") {
        throw new AppError(
          "Only approved bank accounts can be activated for payouts",
          400,
          "ACCOUNT_NOT_ELIGIBLE_FOR_ACTIVATION"
        );
      }

      // Deactivate previous active account
      const currentActive = await VendorBankAccount.findOne({
        vendorId,
        isActive: true,
        deletedAt: null,
      }).session(session);

      if (currentActive && String(currentActive._id) !== String(account._id)) {
        currentActive.isActive = false;
        currentActive.deactivatedAt = new Date();
        currentActive.deactivatedBy = actorId;
        await currentActive.save({ session });
      }

      account.isActive = true;
      account.activatedAt = new Date();
    } else {
      account.isActive = false;
      account.deactivatedAt = new Date();
      account.deactivatedBy = actorId;
    }

    await account.save({ session });

    await recordAuditLog({
      actorId,
      targetId: account._id,
      action: "vendor_bank_account.admin_status_changed",
      entityType: "VendorBankAccount",
      beforeState,
      afterState: account,
      reason: reason.trim(),
      req,
      session,
    });

    return account;
  });
};

/**
 * Superadmin: administratively soft-delete an eligible bank account.
 * Blocked if referenced by pending or in-flight payouts.
 */
const adminDeleteBankAccount = async ({
  vendorId,
  bankAccountId,
  actorId,
  reason,
  req = null,
}) => {
  if (!reason || reason.trim().length < 10) {
    throw new AppError(
      "Administrative reason (min 10 characters) is required",
      400,
      "REASON_REQUIRED"
    );
  }

  return withTransaction(async (session) => {
    const account = await VendorBankAccount.findOne({
      _id: bankAccountId,
      vendorId,
      deletedAt: null,
    }).session(session);

    if (!account) {
      throw new AppError("Bank account not found", 404, "BANK_ACCOUNT_NOT_FOUND");
    }

    // Check in-flight payouts referencing this bank account
    const inFlightPayout = await VendorPayout.findOne({
      vendorId: account.vendorId,
      status: { $in: ["pending", "processing"] },
      $or: [
        { "metadata.bankAccountId": String(account._id) },
        { bankAccountId: account._id },
      ],
    }).session(session);

    if (inFlightPayout) {
      throw new AppError(
        "Cannot delete bank account associated with pending or in-flight payouts",
        400,
        "CANNOT_DELETE_ACTIVE_PAYOUT_ACCOUNT"
      );
    }

    const beforeState = account.toObject();

    account.deletedAt = new Date();
    account.deletedBy = actorId;
    account.deletedReason = reason.trim();
    account.isActive = false;
    await account.save({ session });

    await recordAuditLog({
      actorId,
      targetId: account._id,
      action: "vendor_bank_account.admin_deleted",
      entityType: "VendorBankAccount",
      beforeState,
      afterState: account,
      reason: reason.trim(),
      req,
      session,
    });

    return {
      success: true,
      message: "Bank account safely archived",
      bankAccountId: account._id,
    };
  });
};

/**
 * Internal helper: resolve current active and approved bank account for payouts.
 */
const resolveActiveBankAccountForVendor = async (vendorId) => {
  return VendorBankAccount.findOne({
    vendorId,
    isActive: true,
    status: "approved",
    deletedAt: null,
  });
};

module.exports = {
  submitBankAccount,
  listVendorBankAccounts,
  switchActiveBankAccount,
  resubmitBankAccount,
  listPendingApplications,
  listAdminVendorBankAccounts,
  getAdminVendorBankAccount,
  reviewApplication,
  unmaskBankAccount,
  adminAddBankAccount,
  adminUpdateBankAccount,
  adminSetStatusBankAccount,
  adminDeleteBankAccount,
  resolveActiveBankAccountForVendor,
};

