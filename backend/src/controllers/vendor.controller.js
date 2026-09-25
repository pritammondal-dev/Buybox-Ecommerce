const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const vendorService = require("../services/vendor.service");

const registerVendor = asyncHandler(async (req, res) => {
  const result = await vendorService.registerVendor(req.body);

  return sendSuccess(res, {
    statusCode: 201,
    message: "Vendor registered successfully. Account pending approval.",
    data: result,
  });
});

const getMyProfile = asyncHandler(async (req, res) => {
  const vendor =
    await vendorService.getMyVendorProfile(
      req.user.id
    );

  return sendSuccess(res, {
    message: "Vendor profile retrieved successfully",
    data: {
      vendor,
    },
  });
});

const createMyProfile = asyncHandler(async (req, res) => {
  const vendor =
    await vendorService.createVendorProfile(
      req.user.id,
      req.body
    );

  return sendSuccess(res, {
    statusCode: 201,
    message: "Vendor profile created successfully",
    data: {
      vendor,
    },
  });
});

const updateMyProfile = asyncHandler(async (req, res) => {
  const vendor =
    await vendorService.updateMyVendorProfile(
      req.user.id,
      req.body
    );

  return sendSuccess(res, {
    message: "Vendor profile updated successfully",
    data: {
      vendor,
    },
  });
});

const listVendors = asyncHandler(async (req, res) => {
  const result = await vendorService.listVendors(req.query);

  return sendSuccess(res, {
    message: "Vendors retrieved successfully",
    data: {
      vendors: result.vendors,
      pagination: result.pagination,
    },
  });
});

const getVendor = asyncHandler(async (req, res) => {
  const vendor = await vendorService.getVendorById(req.params.id);

  return sendSuccess(res, {
    message: "Vendor retrieved successfully",
    data: {
      vendor,
    },
  });
});

const approveVendor = asyncHandler(async (req, res) => {
  const vendor = await vendorService.approveVendor({
    vendorId: req.params.id,
    approvedBy: req.user.id,
    req,
  });

  return sendSuccess(res, {
    message: "Vendor application approved successfully",
    data: {
      vendor,
    },
  });
});

const rejectVendor = asyncHandler(async (req, res) => {
  const vendor = await vendorService.rejectVendor({
    vendorId: req.params.id,
    rejectedBy: req.user.id,
    reason: req.body.reason,
    req,
  });

  return sendSuccess(res, {
    message: "Vendor application rejected",
    data: {
      vendor,
    },
  });
});

const requestChanges = asyncHandler(async (req, res) => {
  const vendor = await vendorService.requestChanges({
    vendorId: req.params.id,
    requestedBy: req.user.id,
    reason: req.body.reason,
    req,
  });

  return sendSuccess(res, {
    message: "Changes requested from vendor applicant",
    data: {
      vendor,
    },
  });
});

const resubmitApplication = asyncHandler(async (req, res) => {
  const vendor = await vendorService.resubmitVendorApplication({
    userId: req.user.id,
    req,
  });

  return sendSuccess(res, {
    message: "Vendor application resubmitted successfully. Account pending review.",
    data: {
      vendor,
    },
  });
});

const updateVendorStatus = asyncHandler(
  async (req, res) => {
    const vendor =
      await vendorService.updateVendorStatus(
        req.params.id,
        req.body.onboardingStatus,
        {
          rejectionReason:
            req.body.rejectionReason || null,
          changesRequestedReason:
            req.body.changesRequestedReason || null,
          isActive:
            req.body.onboardingStatus === "approved",
        },
        {
          actorId: req.user.id,
          req,
        }
      );

    return sendSuccess(res, {
      message: "Vendor status updated successfully",
      data: {
        vendor,
      },
    });
  }
);

const getDashboardAnalytics = asyncHandler(async (req, res) => {
  const vendor = req.vendor || (await vendorService.getMyVendorProfile(req.user.id));
  const analytics = await vendorService.getVendorDashboardAnalytics({
    vendorId: vendor._id,
    range: req.query.range || "30d",
  });

  return sendSuccess(res, {
    message: "Vendor dashboard analytics retrieved successfully",
    data: {
      ...analytics,
      vendor: {
        id: vendor._id,
        businessName: vendor.businessName,
        onboardingStatus: vendor.onboardingStatus,
      },
    },
  });
});

const getActivityLogs = asyncHandler(async (req, res) => {
  const logs = await vendorService.getVendorActivityLogs({
    userId: req.user.id,
  });

  return sendSuccess(res, {
    message: "Vendor activity logs retrieved successfully",
    data: {
      logs,
    },
  });
});

module.exports = {
  registerVendor,
  getMyProfile,
  createMyProfile,
  updateMyProfile,
  listVendors,
  getVendor,
  updateVendorStatus,
  approveVendor,
  rejectVendor,
  requestChanges,
  resubmitApplication,
  getDashboardAnalytics,
  getActivityLogs,
};