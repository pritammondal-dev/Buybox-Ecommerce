const Review = require("../models/Review");

const create = (data, options = {}) =>
  Review.create([data], options).then((docs) => docs[0]);

const findById = (reviewId, options = {}) =>
  Review.findById(reviewId).session(options.session || null);

const findByProductAndCustomerOrder = (
  productId,
  customerId,
  orderId,
  options = {}
) =>
  Review.findOne({
    productId,
    customerId,
    orderId,
  }).session(options.session || null);

const findMany = (filter = {}, options = {}) =>
  Review.find(filter)
    .sort({ createdAt: -1 })
    .session(options.session || null);

const updateById = (reviewId, update, options = {}) =>
  Review.findByIdAndUpdate(reviewId, update, {
    new: true,
    runValidators: true,
    session: options.session || null,
  });

const deleteById = (reviewId, options = {}) =>
  Review.findByIdAndDelete(reviewId, {
    session: options.session || null,
  });

const incrementHelpfulCount = (
  reviewId,
  amount = 1,
  options = {}
) =>
  Review.findByIdAndUpdate(
    reviewId,
    {
      $inc: {
        helpfulCount: amount,
      },
    },
    {
      new: true,
      session: options.session || null,
    }
  );

module.exports = {
  create,
  findById,
  findByProductAndCustomerOrder,
  findMany,
  updateById,
  deleteById,
  incrementHelpfulCount,
};