const mongoose = require("mongoose");

const storefrontAnnouncementBarRepository = require("../repositories/storefront-announcement-bar.repository");
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

const validateSchedule = (startsAt, endsAt) => {
  if (
    startsAt &&
    endsAt &&
    new Date(startsAt) >= new Date(endsAt)
  ) {
    throw new AppError(
      "startsAt must be before endsAt",
      400,
      "INVALID_ANNOUNCEMENT_BAR_SCHEDULE"
    );
  }
};

const getAnnouncementBarById = async (barId) => {
  validateObjectId(barId, "announcement bar ID");

  const bar =
    await storefrontAnnouncementBarRepository.findById(
      barId
    );

  if (!bar) {
    throw new AppError(
      "Storefront announcement bar not found",
      404,
      "STOREFRONT_ANNOUNCEMENT_BAR_NOT_FOUND"
    );
  }

  return bar;
};

const getActiveAnnouncementBars = async () => {
  const now = new Date();

  return storefrontAnnouncementBarRepository.findActive({
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

const listAnnouncementBars = async (filter = {}) => {
  return storefrontAnnouncementBarRepository.findMany(
    filter
  );
};

const createAnnouncementBar = async (data, userId) => {
  validateObjectId(userId, "user ID");
  validateSchedule(data.startsAt, data.endsAt);

  return storefrontAnnouncementBarRepository.create({
    ...data,
    createdBy: userId,
    updatedBy: userId,
  });
};

const updateAnnouncementBar = async (
  barId,
  data,
  userId
) => {
  validateObjectId(userId, "user ID");

  const bar = await getAnnouncementBarById(barId);

  const startsAt =
    data.startsAt !== undefined
      ? data.startsAt
      : bar.startsAt;

  const endsAt =
    data.endsAt !== undefined
      ? data.endsAt
      : bar.endsAt;

  validateSchedule(startsAt, endsAt);

  return storefrontAnnouncementBarRepository.updateById(
    barId,
    {
      ...data,
      updatedBy: userId,
    }
  );
};

const deleteAnnouncementBar = async (barId) => {
  await getAnnouncementBarById(barId);

  await storefrontAnnouncementBarRepository.deleteById(
    barId
  );

  return {
    id: barId,
  };
};

module.exports = {
  getAnnouncementBarById,
  getActiveAnnouncementBars,
  listAnnouncementBars,
  createAnnouncementBar,
  updateAnnouncementBar,
  deleteAnnouncementBar,
};