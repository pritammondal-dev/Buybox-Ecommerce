const vendorRepository = require("../repositories/vendor.repository");
const AppError = require("../errors/AppError");

const getMyVendorProfile = async (userId) => {
  const vendor = await vendorRepository.findByUserId(userId);

  if (!vendor) {
    throw new AppError(
      "Vendor profile not found",
      404,
      "VENDOR_NOT_FOUND"
    );
  }

  return vendor;
};

const createVendorProfile = async (userId, data) => {
  const existingVendor =
    await vendorRepository.findByUserId(userId);

  if (existingVendor) {
    throw new AppError(
      "Vendor profile already exists",
      409,
      "VENDOR_ALREADY_EXISTS"
    );
  }

  const existingSlug =
    await vendorRepository.findBySlug(data.businessSlug);

  if (existingSlug) {
    throw new AppError(
      "Business slug is already in use",
      409,
      "BUSINESS_SLUG_ALREADY_EXISTS"
    );
  }

  return vendorRepository.create({
    userId,
    ...data,
    onboardingStatus: "pending",
    isActive: false,
  });
};

const updateMyVendorProfile = async (
  userId,
  data
) => {
  if (data.businessSlug) {
    const existingVendor =
      await vendorRepository.findBySlug(
        data.businessSlug
      );

    if (
      existingVendor &&
      existingVendor.userId.toString() !== userId.toString()
    ) {
      throw new AppError(
        "Business slug is already in use",
        409,
        "BUSINESS_SLUG_ALREADY_EXISTS"
      );
    }
  }

  const vendor =
    await vendorRepository.updateByUserId(
      userId,
      data
    );

  if (!vendor) {
    throw new AppError(
      "Vendor profile not found",
      404,
      "VENDOR_NOT_FOUND"
    );
  }

  return vendor;
};

const listVendors = async () => {
  return vendorRepository.findAll();
};

const getVendorById = async (vendorId) => {
  const vendor =
    await vendorRepository.findById(vendorId);

  if (!vendor) {
    throw new AppError(
      "Vendor not found",
      404,
      "VENDOR_NOT_FOUND"
    );
  }

  return vendor;
};

const updateVendorStatus = async (
  vendorId,
  onboardingStatus,
  extraData = {}
) => {
  const vendor =
    await vendorRepository.updateById(
      vendorId,
      {
        onboardingStatus,
        ...extraData,
      }
    );

  if (!vendor) {
    throw new AppError(
      "Vendor not found",
      404,
      "VENDOR_NOT_FOUND"
    );
  }

  return vendor;
};

module.exports = {
  getMyVendorProfile,
  createVendorProfile,
  updateMyVendorProfile,
  listVendors,
  getVendorById,
  updateVendorStatus,
};