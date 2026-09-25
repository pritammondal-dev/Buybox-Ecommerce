const GiftCard = require("../models/GiftCard");
const GiftCardTransaction = require("../models/GiftCardTransaction");
const Customer = require("../models/Customer");
const apiResponse = require("../utils/apiResponse");
const AppError = require("../errors/AppError");

const checkBalance = async (req, res) => {
  const { code } = req.body;
  if (!code || !code.trim()) {
    throw new AppError("Gift card code is required", 400, "INVALID_CODE");
  }

  const normalizedCode = code.trim().toUpperCase();
  const card = await GiftCard.findOne({ code: normalizedCode });

  if (!card) {
    throw new AppError("Gift card code not recognized. Please check the code and try again.", 404, "CARD_NOT_FOUND");
  }

  const isExpired = new Date(card.expiresAt) < new Date();
  if (isExpired && card.status === "active") {
    card.status = "expired";
    await card.save();
  }

  return apiResponse.sendSuccess(res, {
    message: "Gift card details verified",
    data: {
      code: card.code,
      currentBalance: card.currentBalance.toString(),
      currency: card.currency,
      status: card.status,
      expiresAt: card.expiresAt,
    },
  });
};

const claimGiftCard = async (req, res) => {
  const { code } = req.body;
  const userId = req.user.id;

  if (!code || !code.trim()) {
    throw new AppError("Gift card code is required", 400, "INVALID_CODE");
  }

  const customer = await Customer.findOne({ userId });
  if (!customer) {
    throw new AppError("Customer profile not found", 404, "CUSTOMER_NOT_FOUND");
  }

  const normalizedCode = code.trim().toUpperCase();
  const card = await GiftCard.findOne({ code: normalizedCode });

  if (!card) {
    throw new AppError("Gift card not found. Please verify the code.", 404, "CARD_NOT_FOUND");
  }

  if (card.status !== "active") {
    throw new AppError(`Gift card cannot be claimed because it is ${card.status}`, 400, "CARD_NOT_ACTIVE");
  }

  if (card.expiresAt && new Date(card.expiresAt) < new Date()) {
    card.status = "expired";
    await card.save();
    throw new AppError("Gift card has expired and cannot be claimed", 400, "CARD_EXPIRED");
  }

  if (card.claimedByCustomerId) {
    if (card.claimedByCustomerId.toString() === customer._id.toString()) {
      return apiResponse.sendSuccess(res, {
        message: "This gift card is already linked to your account",
        data: {
          code: card.code,
          currentBalance: card.currentBalance.toString(),
          currency: card.currency,
          expiresAt: card.expiresAt,
        },
      });
    }
    throw new AppError("This gift card has already been claimed by another account", 409, "ALREADY_CLAIMED");
  }

  // Atomically claim the card to guarantee concurrency protection against race conditions
  const claimedCard = await GiftCard.findOneAndUpdate(
    {
      _id: card._id,
      status: "active",
      claimedByCustomerId: null,
      expiresAt: { $gt: new Date() },
    },
    {
      claimedByCustomerId: customer._id,
      claimedAt: new Date(),
    },
    { new: true }
  );

  if (!claimedCard) {
    const freshCard = await GiftCard.findById(card._id);
    if (freshCard?.claimedByCustomerId) {
      if (freshCard.claimedByCustomerId.toString() === customer._id.toString()) {
        return apiResponse.sendSuccess(res, {
          message: "This gift card is already linked to your account",
          data: {
            code: freshCard.code,
            currentBalance: freshCard.currentBalance.toString(),
            currency: freshCard.currency,
            expiresAt: freshCard.expiresAt,
          },
        });
      }
      throw new AppError("This gift card has already been claimed by another account", 409, "ALREADY_CLAIMED");
    }
    throw new AppError("Gift card is no longer active or has expired", 400, "CARD_NOT_CLAIMABLE");
  }

  await GiftCardTransaction.create({
    giftCardId: claimedCard._id,
    customerId: customer._id,
    amount: claimedCard.currentBalance,
    type: "claim",
    notes: `Card ${claimedCard.code} claimed to account`,
  });

  return apiResponse.sendSuccess(res, {
    message: "Gift card successfully claimed to your account",
    data: {
      code: claimedCard.code,
      currentBalance: claimedCard.currentBalance.toString(),
      currency: claimedCard.currency,
      expiresAt: claimedCard.expiresAt,
    },
  });
};

const getMyGiftCards = async (req, res) => {
  const userId = req.user.id;
  const customer = await Customer.findOne({ userId });

  if (!customer) {
    return apiResponse.sendSuccess(res, {
      message: "My gift cards",
      data: [],
    });
  }

  const cards = await GiftCard.find({ claimedByCustomerId: customer._id })
    .sort({ createdAt: -1 })
    .lean();

  return apiResponse.sendSuccess(res, {
    message: "Gift cards retrieved successfully",
    data: cards.map((c) => ({
      _id: c._id,
      code: c.code,
      currentBalance: c.currentBalance?.toString() || "0.00",
      initialBalance: c.initialBalance?.toString() || "0.00",
      currency: c.currency,
      status: c.status,
      expiresAt: c.expiresAt,
      claimedAt: c.claimedAt,
    })),
  });
};

module.exports = {
  checkBalance,
  claimGiftCard,
  getMyGiftCards,
};
