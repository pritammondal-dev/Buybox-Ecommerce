const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const vendorService = require("../services/vendor.service");
const vendorKycService = require("../services/vendor-kyc.service");
const AppError = require("../errors/AppError");

const registerVendor = asyncHandler(async (req, res) => {
  const result = await vendorService.registerVendor(req.body, req.user);

  let message = "Vendor registered successfully. Account pending approval.";
  let statusCode = 201;

  if (result.isExistingApplication) {
    statusCode = 200;
    message = result.emailDelivery?.message || "Existing vendor application retrieved.";
  } else if (result.emailDelivery?.sent === false) {
    message =
      "Vendor application submitted. Verification email could not be delivered at this time; please use the resend code option on the verification screen.";
  } else if (result.user?.isEmailVerified) {
    message = "Vendor application submitted successfully. Account pending administrator review.";
  }

  return sendSuccess(res, {
    statusCode,
    message,
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
      statusCounts: result.statusCounts,
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

const verifyVendorEmailByAdmin = asyncHandler(async (req, res) => {
  const vendor = await vendorService.verifyVendorEmailByAdmin({
    vendorId: req.params.id,
    adminId: req.user.id,
    req,
  });

  return sendSuccess(res, {
    message: "Vendor business email address has been verified successfully by administrator.",
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

const getVendorOverview = asyncHandler(async (req, res) => {
  const result = await vendorService.getVendorOverview(req.params.id);

  return sendSuccess(res, {
    message: "Vendor overview retrieved successfully",
    data: result,
  });
});

const updateVendorAdmin = asyncHandler(async (req, res) => {
  const vendor = await vendorService.updateVendorAdmin(
    req.params.id,
    req.body,
    {
      actorId: req.user.id,
      reason: req.body.reason,
      req,
    }
  );

  return sendSuccess(res, {
    message: "Vendor profile updated successfully",
    data: {
      vendor,
    },
  });
});

const suspendVendor = asyncHandler(async (req, res) => {
  const result = await vendorService.suspendVendor(req.params.id, {
    reason: req.body.reason,
    actorId: req.user.id,
    req,
  });

  return sendSuccess(res, {
    message: result.message,
    data: result.vendor,
  });
});

const reactivateVendor = asyncHandler(async (req, res) => {
  const result = await vendorService.reactivateVendor(req.params.id, {
    reason: req.body.reason,
    actorId: req.user.id,
    req,
  });

  return sendSuccess(res, {
    message: result.message,
    data: result.vendor,
  });
});

const resetVendorPassword = asyncHandler(async (req, res) => {
  const { newPassword, reason } = req.body;
  if (!newPassword || newPassword.length < 8) {
    throw new AppError("New password must be at least 8 characters long", 400, "INVALID_PASSWORD");
  }

  const result = await vendorService.resetVendorPassword(
    req.params.id,
    newPassword,
    reason,
    req.user,
    req
  );

  return sendSuccess(res, {
    message: result.message,
    data: result,
  });
});

const deleteVendor = asyncHandler(async (req, res) => {
  const result = await vendorService.deleteVendor(req.params.id, {
    reason: req.body.reason,
    actorId: req.user.id,
    req,
  });

  return sendSuccess(res, {
    message: result.message,
  });
});


const getMyBranding = asyncHandler(async (req, res) => {
  const vendor = await vendorService.getMyVendorProfile(req.user.id);
  return sendSuccess(res, {
    message: "Store branding retrieved successfully",
    data: {
      branding: vendor.branding || {},
    },
  });
});

const updateMyBranding = asyncHandler(async (req, res) => {
  const branding = await vendorService.updateStoreBranding({
    userId: req.user.id,
    brandingData: req.body,
    req,
  });

  return sendSuccess(res, {
    message: "Store branding updated successfully",
    data: {
      branding,
    },
  });
});

const uploadBrandingAsset = asyncHandler(async (req, res) => {
  const result = await vendorService.uploadStoreBrandingAsset({
    userId: req.user.id,
    file: req.file,
    assetType: req.body.assetType || req.query.type || "branding",
  });

  return sendSuccess(res, {
    message: "Store branding asset uploaded successfully",
    data: result,
  });
});

const getPublicStore = asyncHandler(async (req, res) => {
  const store = await vendorService.getPublicStoreBySlug(req.params.slug);

  return sendSuccess(res, {
    message: "Store profile fetched successfully",
    data: {
      store,
    },
  });
});

const getMyKycStatus = asyncHandler(async (req, res) => {
  const kycData = await vendorKycService.getMyKycDetails(req.user.id);

  return sendSuccess(res, {
    message: "Vendor KYC details retrieved successfully",
    data: kycData,
  });
});

const uploadMyKycDocument = asyncHandler(async (req, res) => {
  const result = await vendorKycService.uploadKycDocument({
    userId: req.user.id,
    file: req.file,
    documentCategory: req.body.documentCategory,
    documentType: req.body.documentType,
    documentNumber: req.body.documentNumber,
    req,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "KYC document uploaded successfully and queued for review",
    data: result,
  });
});

const downloadMyKycDocument = asyncHandler(async (req, res) => {
  const { stream, mimeType, fileOriginalName, fileSize } =
    await vendorKycService.downloadKycDocument({
      documentId: req.params.documentId,
      actorUserId: req.user.id,
      isStaff: false,
    });

  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Length", fileSize);
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(fileOriginalName)}"`
  );
  return stream.pipe(res);
});

const listKycQueue = asyncHandler(async (req, res) => {
  const result = await vendorKycService.listKycReviewQueue(req.query);

  return sendSuccess(res, {
    message: "KYC review queue retrieved successfully",
    data: result,
  });
});

const reviewKycDocument = asyncHandler(async (req, res) => {
  const result = await vendorKycService.reviewKycDocument({
    vendorId: req.params.id,
    documentId: req.params.documentId,
    status: req.body.status,
    rejectionReason: req.body.rejectionReason,
    reviewerId: req.user.id,
    req,
  });

  return sendSuccess(res, {
    message: `KYC document ${req.body.status} successfully`,
    data: result,
  });
});

const downloadVendorKycDocument = asyncHandler(async (req, res) => {
  const { stream, mimeType, fileOriginalName, fileSize } =
    await vendorKycService.downloadKycDocument({
      vendorId: req.params.id,
      documentId: req.params.documentId,
      actorUserId: req.user.id,
      isStaff: true,
    });

  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Length", fileSize);
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(fileOriginalName)}"`
  );
  return stream.pipe(res);
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
  getVendorOverview,
  updateVendorAdmin,
  suspendVendor,
  reactivateVendor,
  resetVendorPassword,
  deleteVendor,
  verifyVendorEmailByAdmin,
  getMyBranding,
  updateMyBranding,
  uploadBrandingAsset,
  getPublicStore,
  getMyKycStatus,
  uploadMyKycDocument,
  downloadMyKycDocument,
  listKycQueue,
  reviewKycDocument,
  downloadVendorKycDocument,
};