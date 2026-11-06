const vendorBankAccountService = require("../services/vendor-bank-account.service");

/**
 * Vendor self-service: list all own bank accounts.
 */
const getMyBankAccounts = async (req, res, next) => {
  try {
    const accounts = await vendorBankAccountService.listVendorBankAccounts(
      req.vendor._id
    );

    res.status(200).json({
      success: true,
      data: {
        accounts,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Vendor self-service: submit a new bank account application.
 */
const submitMyBankAccount = async (req, res, next) => {
  try {
    const account = await vendorBankAccountService.submitBankAccount({
      vendorId: req.vendor._id,
      userId: req.user._id,
      accountData: req.body,
      req,
    });

    res.status(201).json({
      success: true,
      message: "Bank account application submitted successfully",
      data: {
        account,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Vendor self-service: switch active payout destination.
 */
const switchMyActiveBankAccount = async (req, res, next) => {
  try {
    const result = await vendorBankAccountService.switchActiveBankAccount({
      vendorId: req.vendor._id,
      bankAccountId: req.params.id,
      userId: req.user._id,
      req,
    });

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Vendor self-service: resubmit rejected bank account details.
 */
const resubmitMyBankAccount = async (req, res, next) => {
  try {
    const account = await vendorBankAccountService.resubmitBankAccount({
      vendorId: req.vendor._id,
      bankAccountId: req.params.id,
      userId: req.user._id,
      accountData: req.body,
      req,
    });

    res.status(200).json({
      success: true,
      message: "Bank account application resubmitted successfully",
      data: {
        account,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Administrative reviewer queue: list pending applications.
 */
const listPendingApplications = async (req, res, next) => {
  try {
    const result = await vendorBankAccountService.listPendingApplications(
      req.query
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Superadmin / Reviewer: list bank accounts for a specific vendor.
 */
const getVendorBankAccounts = async (req, res, next) => {
  try {
    const accounts = await vendorBankAccountService.listAdminVendorBankAccounts(
      req.params.id
    );

    res.status(200).json({
      success: true,
      data: {
        accounts,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Superadmin / Reviewer: get single bank account details.
 */
const getVendorBankAccountById = async (req, res, next) => {
  try {
    const account = await vendorBankAccountService.getAdminVendorBankAccount({
      vendorId: req.params.id,
      bankAccountId: req.params.accountId,
    });

    res.status(200).json({
      success: true,
      data: {
        account,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Authorized Reviewer: approve application.
 */
const approveVendorBankAccount = async (req, res, next) => {
  try {
    const account = await vendorBankAccountService.reviewApplication({
      vendorId: req.params.id,
      bankAccountId: req.params.accountId,
      reviewerId: req.user._id,
      action: "approve",
      reason: req.body?.reason,
      req,
    });

    res.status(200).json({
      success: true,
      message: "Bank account application approved successfully",
      data: {
        account,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Authorized Reviewer: reject application.
 */
const rejectVendorBankAccount = async (req, res, next) => {
  try {
    const account = await vendorBankAccountService.reviewApplication({
      vendorId: req.params.id,
      bankAccountId: req.params.accountId,
      reviewerId: req.user._id,
      action: "reject",
      reason: req.body.reason,
      req,
    });

    res.status(200).json({
      success: true,
      message: "Bank account application rejected",
      data: {
        account,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Authorized Reviewer: mark application as under review.
 */
const markVendorBankAccountUnderReview = async (req, res, next) => {
  try {
    const account = await vendorBankAccountService.reviewApplication({
      vendorId: req.params.id,
      bankAccountId: req.params.accountId,
      reviewerId: req.user._id,
      action: "under_review",
      reason: req.body?.reason,
      req,
    });

    res.status(200).json({
      success: true,
      message: "Application marked as under review",
      data: {
        account,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Privileged Unmasking: decrypt raw account number for authorized auditor.
 */
const unmaskVendorBankAccount = async (req, res, next) => {
  try {
    const result = await vendorBankAccountService.unmaskBankAccount({
      vendorId: req.params.id,
      bankAccountId: req.params.accountId,
      actorId: req.user._id,
      reason: req.body.reason,
      req,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Superadmin: add bank account administratively.
 */
const adminAddVendorBankAccount = async (req, res, next) => {
  try {
    const account = await vendorBankAccountService.adminAddBankAccount({
      vendorId: req.params.id,
      actorId: req.user._id,
      accountData: req.body,
      reason: req.body.reason,
      autoApprove: Boolean(req.body.autoApprove),
      setActive: Boolean(req.body.setActive),
      req,
    });

    res.status(201).json({
      success: true,
      message: "Bank account created administratively",
      data: {
        account,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Superadmin: edit bank account details administratively.
 */
const adminUpdateVendorBankAccount = async (req, res, next) => {
  try {
    const account = await vendorBankAccountService.adminUpdateBankAccount({
      vendorId: req.params.id,
      bankAccountId: req.params.accountId,
      actorId: req.user._id,
      updateData: req.body,
      reason: req.body.reason,
      req,
    });

    res.status(200).json({
      success: true,
      message: "Bank account updated successfully",
      data: {
        account,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Superadmin: toggle active status of bank account administratively.
 */
const adminSetStatusVendorBankAccount = async (req, res, next) => {
  try {
    const account = await vendorBankAccountService.adminSetStatusBankAccount({
      vendorId: req.params.id,
      bankAccountId: req.params.accountId,
      actorId: req.user._id,
      isActive: req.body.isActive,
      reason: req.body.reason,
      req,
    });

    res.status(200).json({
      success: true,
      message: "Bank account status updated",
      data: {
        account,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Superadmin: safely soft-delete an eligible bank account.
 */
const adminDeleteVendorBankAccount = async (req, res, next) => {
  try {
    const result = await vendorBankAccountService.adminDeleteBankAccount({
      vendorId: req.params.id,
      bankAccountId: req.params.accountId,
      actorId: req.user._id,
      reason: req.body.reason,
      req,
    });

    res.status(200).json({
      success: true,
      message: "Bank account safely archived",
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMyBankAccounts,
  submitMyBankAccount,
  switchMyActiveBankAccount,
  resubmitMyBankAccount,
  listPendingApplications,
  getVendorBankAccounts,
  getVendorBankAccountById,
  approveVendorBankAccount,
  rejectVendorBankAccount,
  markVendorBankAccountUnderReview,
  unmaskVendorBankAccount,
  adminAddVendorBankAccount,
  adminUpdateVendorBankAccount,
  adminSetStatusVendorBankAccount,
  adminDeleteVendorBankAccount,
};

