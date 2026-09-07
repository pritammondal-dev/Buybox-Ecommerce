const mongoose = require("mongoose");

const storefrontRedirectRepository = require("../repositories/storefront-redirect.repository");
const AppError = require("../errors/AppError");

const validateObjectId = (value, fieldName) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(
      `Invalid ${fieldName}`,
      400,
      `INVALID_${fieldName.toUpperCase()}`
    );
  }
};

const normalizePath = (path) => {
  const trimmedPath = path.trim();

  if (!trimmedPath.startsWith("/")) {
    return `/${trimmedPath}`;
  }

  return trimmedPath;
};

const getRedirectById = async (redirectId) => {
  validateObjectId(redirectId, "redirect ID");

  const redirect =
    await storefrontRedirectRepository.findById(
      redirectId
    );

  if (!redirect) {
    throw new AppError(
      "Storefront redirect not found",
      404,
      "STOREFRONT_REDIRECT_NOT_FOUND"
    );
  }

  return redirect;
};

const getActiveRedirect = async (sourcePath) => {
  const normalizedSourcePath = normalizePath(sourcePath);

  return storefrontRedirectRepository.findActiveBySourcePath(
    normalizedSourcePath
  );
};

const listRedirects = async (filter = {}) => {
  return storefrontRedirectRepository.findMany(filter);
};

const createRedirect = async (data, userId) => {
  validateObjectId(userId, "user ID");

  const sourcePath = normalizePath(data.sourcePath);
  const destinationPath = normalizePath(
    data.destinationPath
  );

  if (sourcePath === destinationPath) {
    throw new AppError(
      "Source and destination paths cannot be the same",
      400,
      "INVALID_REDIRECT_PATHS"
    );
  }

  const existing =
    await storefrontRedirectRepository.findBySourcePath(
      sourcePath
    );

  if (existing) {
    throw new AppError(
      "A redirect with this source path already exists",
      409,
      "STOREFRONT_REDIRECT_EXISTS"
    );
  }

  return storefrontRedirectRepository.create({
    ...data,
    sourcePath,
    destinationPath,
    createdBy: userId,
    updatedBy: userId,
  });
};

const updateRedirect = async (
  redirectId,
  data,
  userId
) => {
  validateObjectId(userId, "user ID");

  const redirect = await getRedirectById(redirectId);

  const update = {};

  if (data.sourcePath !== undefined) {
    update.sourcePath = normalizePath(data.sourcePath);
  }

  if (data.destinationPath !== undefined) {
    update.destinationPath = normalizePath(
      data.destinationPath
    );
  }

  if (
    update.sourcePath &&
    update.destinationPath &&
    update.sourcePath === update.destinationPath
  ) {
    throw new AppError(
      "Source and destination paths cannot be the same",
      400,
      "INVALID_REDIRECT_PATHS"
    );
  }

  if (
    update.sourcePath &&
    update.sourcePath !== redirect.sourcePath
  ) {
    const existing =
      await storefrontRedirectRepository.findBySourcePath(
        update.sourcePath
      );

    if (
      existing &&
      existing._id.toString() !== redirect._id.toString()
    ) {
      throw new AppError(
        "A redirect with this source path already exists",
        409,
        "STOREFRONT_REDIRECT_EXISTS"
      );
    }
  }

  if (data.statusCode !== undefined) {
    update.statusCode = data.statusCode;
  }

  if (data.isActive !== undefined) {
    update.isActive = data.isActive;
  }

  update.updatedBy = userId;

  return storefrontRedirectRepository.updateById(
    redirectId,
    update
  );
};

const deleteRedirect = async (redirectId) => {
  await getRedirectById(redirectId);

  await storefrontRedirectRepository.deleteById(
    redirectId
  );

  return {
    id: redirectId,
  };
};

module.exports = {
  getRedirectById,
  getActiveRedirect,
  listRedirects,
  createRedirect,
  updateRedirect,
  deleteRedirect,
};
