const storefrontMenuService = require("../services/storefront-menu.service");
const { sendSuccess } = require("../utils/apiResponse");

const createMenu = async (req, res, next) => {
  try {
    const menu = await storefrontMenuService.createMenu({
      ...req.body,
      userId: req.user.id,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: "Storefront menu created successfully",
      data: menu,
    });
  } catch (error) {
    next(error);
  }
};

const listMenus = async (req, res, next) => {
  try {
    const menus =
      await storefrontMenuService.listMenus(req.query);

    return sendSuccess(res, {
      message: "Storefront menus fetched successfully",
      data: menus,
    });
  } catch (error) {
    next(error);
  }
};

const getMenuById = async (req, res, next) => {
  try {
    const menu =
      await storefrontMenuService.getMenuById(
        req.params.menuId
      );

    return sendSuccess(res, {
      message: "Storefront menu fetched successfully",
      data: menu,
    });
  } catch (error) {
    next(error);
  }
};

const getActiveMenuByKey = async (req, res, next) => {
  try {
    const menu =
      await storefrontMenuService.getActiveMenuByKey(
        req.params.key
      );

    return sendSuccess(res, {
      message: "Storefront menu fetched successfully",
      data: menu,
    });
  } catch (error) {
    next(error);
  }
};

const updateMenu = async (req, res, next) => {
  try {
    const menu =
      await storefrontMenuService.updateMenu(
        req.params.menuId,
        req.body
      );

    return sendSuccess(res, {
      message: "Storefront menu updated successfully",
      data: menu,
    });
  } catch (error) {
    next(error);
  }
};

const deleteMenu = async (req, res, next) => {
  try {
    const result =
      await storefrontMenuService.deleteMenu(
        req.params.menuId
      );

    return sendSuccess(res, {
      message: "Storefront menu deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createMenu,
  listMenus,
  getMenuById,
  getActiveMenuByKey,
  updateMenu,
  deleteMenu,
};