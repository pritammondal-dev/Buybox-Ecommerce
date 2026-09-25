const RewardAccount = require("../models/RewardAccount");
const RewardTransaction = require("../models/RewardTransaction");
const Customer = require("../models/Customer");
const apiResponse = require("../utils/apiResponse");

const getMyRewards = async (req, res) => {
  const userId = req.user.id;
  const customer = await Customer.findOne({ userId });

  if (!customer) {
    return apiResponse.sendSuccess(res, {
      message: "Customer rewards profile",
      data: {
        pointsBalance: 0,
        tier: "bronze",
        pointsEarnedTotal: 0,
        pointsRedeemedTotal: 0,
        transactions: [],
      },
    });
  }

  let account = await RewardAccount.findOne({ customerId: customer._id });
  if (!account) {
    account = await RewardAccount.create({
      customerId: customer._id,
      userId,
      pointsBalance: 0,
      tier: "bronze",
    });
  }

  const transactions = await RewardTransaction.find({ customerId: customer._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return apiResponse.sendSuccess(res, {
    message: "Rewards retrieved successfully",
    data: {
      pointsBalance: account.pointsBalance,
      tier: account.tier,
      pointsEarnedTotal: account.pointsEarnedTotal,
      pointsRedeemedTotal: account.pointsRedeemedTotal,
      transactions,
    },
  });
};

module.exports = {
  getMyRewards,
};
