const storefrontContentBlockService = require("../services/storefront-content-block.service");
const { sendSuccess } = require("../utils/apiResponse");

const getBlockById = async (req, res, next) => {
  try {
    const block =
      await storefrontContentBlockService.getBlockById(
        req.params.blockId
      );

    return sendSuccess(res, {
      message:
        "Storefront content block fetched successfully",
      data: block,
    });
  } catch (error) {
    next(error);
  }
};

const getBlockByKey = async (req, res, next) => {
  try {
    const block =
      await storefrontContentBlockService.getBlockByKey(
        req.params.key
      );

    return sendSuccess(res, {
      message:
        "Storefront content block fetched successfully",
      data: block,
    });
  } catch (error) {
    next(error);
  }
};

const getActiveBlocks = async (req, res, next) => {
  try {
    const blocks =
      await storefrontContentBlockService.getActiveBlocks();

    return sendSuccess(res, {
      message:
        "Active storefront content blocks fetched successfully",
      data: blocks,
    });
  } catch (error) {
    next(error);
  }
};

const listBlocks = async (req, res, next) => {
  try {
    const blocks =
      await storefrontContentBlockService.listBlocks(
        req.query
      );

    return sendSuccess(res, {
      message:
        "Storefront content blocks fetched successfully",
      data: blocks,
    });
  } catch (error) {
    next(error);
  }
};

const createBlock = async (req, res, next) => {
  try {
    const block =
      await storefrontContentBlockService.createBlock(
        req.body,
        req.user.id
      );

    return sendSuccess(res, {
      statusCode: 201,
      message:
        "Storefront content block created successfully",
      data: block,
    });
  } catch (error) {
    next(error);
  }
};

const updateBlock = async (req, res, next) => {
  try {
    const block =
      await storefrontContentBlockService.updateBlock(
        req.params.blockId,
        req.body,
        req.user.id
      );

    return sendSuccess(res, {
      message:
        "Storefront content block updated successfully",
      data: block,
    });
  } catch (error) {
    next(error);
  }
};

const deleteBlock = async (req, res, next) => {
  try {
    const result =
      await storefrontContentBlockService.deleteBlock(
        req.params.blockId
      );

    return sendSuccess(res, {
      message:
        "Storefront content block deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBlockById,
  getBlockByKey,
  getActiveBlocks,
  listBlocks,
  createBlock,
  updateBlock,
  deleteBlock,
};