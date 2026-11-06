const partnerBankService = require("../services/partner-bank.service");

/**
 * List partner banks (supports both admin management and vendor bank selection)
 */
const listPartnerBanks = async (req, res, next) => {
  try {
    const result = await partnerBankService.listPartnerBanks({
      search: req.query.search,
      country: req.query.country,
      state: req.query.state,
      isActive: req.query.isActive,
      isEligibleForNewApplications: req.query.isEligibleForNewApplications,
      page: req.query.page,
      limit: req.query.limit,
      all: req.query.all === "true",
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
 * Get partner bank details by ID
 */
const getPartnerBankById = async (req, res, next) => {
  try {
    const bank = await partnerBankService.getPartnerBankById(req.params.id);

    res.status(200).json({
      success: true,
      data: {
        bank,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Superadmin: Register a new partner bank in directory
 */
const createPartnerBank = async (req, res, next) => {
  try {
    const bank = await partnerBankService.createPartnerBank({
      bankData: req.body,
      creatorId: req.user._id,
      req,
    });

    res.status(201).json({
      success: true,
      message: "Partner bank registered successfully",
      data: {
        bank,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Superadmin: Update partner bank metadata
 */
const updatePartnerBank = async (req, res, next) => {
  try {
    const bank = await partnerBankService.updatePartnerBank({
      bankId: req.params.id,
      updateData: req.body,
      updaterId: req.user._id,
      req,
    });

    res.status(200).json({
      success: true,
      message: "Partner bank updated successfully",
      data: {
        bank,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Superadmin: Enable or disable partner bank status
 */
const togglePartnerBankStatus = async (req, res, next) => {
  try {
    const bank = await partnerBankService.togglePartnerBankStatus({
      bankId: req.params.id,
      isActive: req.body.isActive,
      isEligibleForNewApplications: req.body.isEligibleForNewApplications,
      reason: req.body.reason,
      updaterId: req.user._id,
      req,
    });

    res.status(200).json({
      success: true,
      message: "Partner bank status updated successfully",
      data: {
        bank,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listPartnerBanks,
  getPartnerBankById,
  createPartnerBank,
  updatePartnerBank,
  togglePartnerBankStatus,
};

