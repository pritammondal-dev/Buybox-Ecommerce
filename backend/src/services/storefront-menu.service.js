const mongoose = require("mongoose");

const storefrontMenuRepository = require("../repositories/storefront-menu.repository");
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

const normalizeKey = (key) =>
  key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const getMenuById = async (menuId) => {
  validateObjectId(menuId, "menu ID");

  const menu =
    await storefrontMenuRepository.findById(menuId);

  if (!menu) {
    throw new AppError(
      "Storefront menu not found",
      404,
      "STOREFRONT_MENU_NOT_FOUND"
    );
  }

  return menu;
};

const createMenu = async ({
  name,
  key,
  location,
  displayOrder = 0,
  isActive = true,
  items = [],
  userId,
}) => {
  validateObjectId(userId, "user ID");

  const normalizedKey = normalizeKey(key);

  const existingMenu =
    await storefrontMenuRepository.findByKey(normalizedKey);

  if (existingMenu) {
    throw new AppError(
      "A storefront menu with this key already exists",
      409,
      "STOREFRONT_MENU_KEY_EXISTS"
    );
  }

  return storefrontMenuRepository.create({
    name,
    key: normalizedKey,
    location,
    displayOrder,
    isActive,
    items,
    createdBy: userId,
  });
};

const listMenus = async (filter = {}) => {
  return storefrontMenuRepository.findMany(filter);
};

const getMenuByKey = async (key) => {
  const normalizedKey = normalizeKey(key);

  const menu =
    await storefrontMenuRepository.findByKey(normalizedKey);

  if (!menu || !menu.isActive) {
    throw new AppError(
      "Active storefront menu not found",
      404,
      "STOREFRONT_MENU_NOT_FOUND"
    );
  }

  return menu;
};

const getActiveMenuByKey = async (key) => {
  const menu = await getMenuByKey(key);

  menu.items = menu.items
    .filter((item) => item.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return menu;
};

const updateMenu = async (menuId, data) => {
  const menu = await getMenuById(menuId);

  const update = {};

  if (data.name !== undefined) {
    update.name = data.name;
  }

  if (data.key !== undefined) {
    const normalizedKey = normalizeKey(data.key);

    const existingMenu =
      await storefrontMenuRepository.findByKey(normalizedKey);

    if (
      existingMenu &&
      existingMenu._id.toString() !== menu._id.toString()
    ) {
      throw new AppError(
        "A storefront menu with this key already exists",
        409,
        "STOREFRONT_MENU_KEY_EXISTS"
      );
    }

    update.key = normalizedKey;
  }

  const fields = [
    "location",
    "displayOrder",
    "isActive",
    "items",
  ];

  for (const field of fields) {
    if (data[field] !== undefined) {
      update[field] = data[field];
    }
  }

  return storefrontMenuRepository.updateById(
    menuId,
    update
  );
};

const deleteMenu = async (menuId) => {
  await getMenuById(menuId);

  await storefrontMenuRepository.deleteById(menuId);

  return {
    id: menuId,
  };
};

module.exports = {
  createMenu,
  listMenus,
  getMenuById,
  getMenuByKey,
  getActiveMenuByKey,
  updateMenu,
  deleteMenu,
};