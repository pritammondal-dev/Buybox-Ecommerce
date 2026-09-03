const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const vendorService = require("../services/vendor.service");

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
  const vendors =
    await vendorService.listVendors();

  return sendSuccess(res, {
    message: "Vendors retrieved successfully",
    data: {
      vendors,
    },
  });
});

const getVendor = asyncHandler(async (req, res) => {
  const vendor =
    await vendorService.getVendorById(
      req.params.id
    );

  return sendSuccess(res, {
    message: "Vendor retrieved successfully",
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
          isActive:
            req.body.onboardingStatus === "approved",
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

module.exports = {
  getMyProfile,
  createMyProfile,
  updateMyProfile,
  listVendors,
  getVendor,
  updateVendorStatus,
};