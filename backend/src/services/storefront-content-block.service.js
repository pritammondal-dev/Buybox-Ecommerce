const mongoose = require("mongoose");

const storefrontContentBlockRepository = require("../repositories/storefront-content-block.repository");
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

const getBlockById = async (blockId) => {
  validateObjectId(blockId, "content block ID");

  const block =
    await storefrontContentBlockRepository.findById(
      blockId
    );

  if (!block) {
    throw new AppError(
      "Storefront content block not found",
      404,
      "STOREFRONT_CONTENT_BLOCK_NOT_FOUND"
    );
  }

  return block;
};

const getBlockByKey = async (key) => {
  const block =
    await storefrontContentBlockRepository.findByKey(
      key
    );

  if (!block) {
    throw new AppError(
      "Storefront content block not found",
      404,
      "STOREFRONT_CONTENT_BLOCK_NOT_FOUND"
    );
  }

  return block;
};

const listBlocks = async (filter = {}) => {
  return storefrontContentBlockRepository.findMany(
    filter
  );
};

const getActiveBlocks = async () => {
  const now = new Date();

  return storefrontContentBlockRepository.findActive({
    $or: [
      { startsAt: null },
      { startsAt: { $lte: now } },
    ],
    $and: [
      {
        $or: [
          { endsAt: null },
          { endsAt: { $gte: now } },
        ],
      },
    ],
  });
};

const createBlock = async (data, userId) => {
  validateObjectId(userId, "user ID");

  const existing =
    await storefrontContentBlockRepository.findByKey(
      data.key
    );

  if (existing) {
    throw new AppError(
      "A content block with this key already exists",
      409,
      "STOREFRONT_CONTENT_BLOCK_EXISTS"
    );
  }

  if (
    data.startsAt &&
    data.endsAt &&
    new Date(data.startsAt) >= new Date(data.endsAt)
  ) {
    throw new AppError(
      "startsAt must be before endsAt",
      400,
      "INVALID_CONTENT_BLOCK_SCHEDULE"
    );
  }

  return storefrontContentBlockRepository.create({
    ...data,
    createdBy: userId,
    updatedBy: userId,
  });
};

const updateBlock = async (
  blockId,
  data,
  userId
) => {
  validateObjectId(userId, "user ID");

  const block = await getBlockById(blockId);

  const update = {
    ...data,
    updatedBy: userId,
  };

  if (data.key && data.key !== block.key) {
    const existing =
      await storefrontContentBlockRepository.findByKey(
        data.key
      );

    if (
      existing &&
      existing._id.toString() !== block._id.toString()
    ) {
      throw new AppError(
        "A content block with this key already exists",
        409,
        "STOREFRONT_CONTENT_BLOCK_EXISTS"
      );
    }
  }

  const startsAt =
    data.startsAt !== undefined
      ? data.startsAt
      : block.startsAt;

  const endsAt =
    data.endsAt !== undefined
      ? data.endsAt
      : block.endsAt;

  if (
    startsAt &&
    endsAt &&
    new Date(startsAt) >= new Date(endsAt)
  ) {
    throw new AppError(
      "startsAt must be before endsAt",
      400,
      "INVALID_CONTENT_BLOCK_SCHEDULE"
    );
  }

  return storefrontContentBlockRepository.updateById(
    blockId,
    update
  );
};

const deleteBlock = async (blockId) => {
  await getBlockById(blockId);

  await storefrontContentBlockRepository.deleteById(
    blockId
  );

  return {
    id: blockId,
  };
};

module.exports = {
  getBlockById,
  getBlockByKey,
  listBlocks,
  getActiveBlocks,
  createBlock,
  updateBlock,
  deleteBlock,
};