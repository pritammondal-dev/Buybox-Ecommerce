const mongoose = require("mongoose");
const SavedView = require("../models/SavedView");
const AppError = require("../errors/AppError");

/**
 * List saved views for a resource.
 * Returns views owned by the user plus any views marked as isShared: true.
 */
const listSavedViews = async (resource, user) => {
  const userId = user?._id || user?.id;
  if (!userId) {
    throw new AppError("Authentication required", 401, "AUTHENTICATION_REQUIRED");
  }

  const query = {
    resource,
    $or: [{ userId }, { isShared: true }],
  };

  return SavedView.find(query)
    .populate("userId", "firstName lastName email")
    .sort({ isDefault: -1, createdAt: -1 })
    .lean();
};

/**
 * Get single saved view with IDOR protection.
 */
const getSavedViewById = async (viewId, user) => {
  if (!mongoose.isValidObjectId(viewId)) {
    throw new AppError("Invalid saved view ID", 400, "INVALID_ID");
  }

  const userId = user?._id || user?.id;
  const view = await SavedView.findById(viewId).populate("userId", "firstName lastName email").lean();

  if (!view) {
    throw new AppError("Saved view not found", 404, "SAVED_VIEW_NOT_FOUND");
  }

  // Ownership check: must be owner or shared or superadmin
  const isOwner = view.userId?._id?.toString() === userId.toString();
  const isSuperadmin = user?.role === "super_admin";
  if (!isOwner && !view.isShared && !isSuperadmin) {
    throw new AppError("You do not have access to this saved view", 403, "SAVED_VIEW_ACCESS_DENIED");
  }

  return view;
};

/**
 * Create a new saved view owned by the current user.
 */
const createSavedView = async (payload, user) => {
  const userId = user?._id || user?.id;
  if (!userId) {
    throw new AppError("Authentication required", 401, "AUTHENTICATION_REQUIRED");
  }

  const { name, resource, filters, sort, columns, isShared, isDefault } = payload;

  if (isDefault) {
    // Unset existing default for this user and resource
    await SavedView.updateMany({ userId, resource, isDefault: true }, { isDefault: false });
  }

  return SavedView.create({
    name,
    resource,
    filters: filters || {},
    sort: sort || { field: "createdAt", order: "desc" },
    columns: columns || [],
    isShared: Boolean(isShared),
    isDefault: Boolean(isDefault),
    userId,
  });
};

/**
 * Update an existing saved view.
 * Only the owner or superadmin can update.
 */
const updateSavedView = async (viewId, payload, user) => {
  if (!mongoose.isValidObjectId(viewId)) {
    throw new AppError("Invalid saved view ID", 400, "INVALID_ID");
  }

  const userId = user?._id || user?.id;
  const view = await SavedView.findById(viewId);

  if (!view) {
    throw new AppError("Saved view not found", 404, "SAVED_VIEW_NOT_FOUND");
  }

  const isOwner = view.userId.toString() === userId.toString();
  const isSuperadmin = user?.role === "super_admin";
  if (!isOwner && !isSuperadmin) {
    throw new AppError("You can only modify your own saved views", 403, "SAVED_VIEW_MUTATION_DENIED");
  }

  if (payload.isDefault) {
    await SavedView.updateMany(
      { userId, resource: view.resource, _id: { $ne: viewId } },
      { isDefault: false }
    );
  }

  if (payload.name !== undefined) view.name = payload.name;
  if (payload.filters !== undefined) view.filters = payload.filters;
  if (payload.sort !== undefined) view.sort = payload.sort;
  if (payload.columns !== undefined) view.columns = payload.columns;
  if (payload.isShared !== undefined) view.isShared = payload.isShared;
  if (payload.isDefault !== undefined) view.isDefault = payload.isDefault;

  await view.save();
  return view;
};

/**
 * Delete a saved view with strict ownership validation.
 */
const deleteSavedView = async (viewId, user) => {
  if (!mongoose.isValidObjectId(viewId)) {
    throw new AppError("Invalid saved view ID", 400, "INVALID_ID");
  }

  const userId = user?._id || user?.id;
  const view = await SavedView.findById(viewId);

  if (!view) {
    throw new AppError("Saved view not found", 404, "SAVED_VIEW_NOT_FOUND");
  }

  const isOwner = view.userId.toString() === userId.toString();
  const isSuperadmin = user?.role === "super_admin";
  if (!isOwner && !isSuperadmin) {
    throw new AppError("You can only delete your own saved views", 403, "SAVED_VIEW_DELETE_DENIED");
  }

  await SavedView.deleteOne({ _id: viewId });
  return { deleted: true, id: viewId };
};

module.exports = {
  listSavedViews,
  getSavedViewById,
  createSavedView,
  updateSavedView,
  deleteSavedView,
};
