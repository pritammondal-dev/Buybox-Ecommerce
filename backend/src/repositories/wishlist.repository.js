const Wishlist = require("../models/Wishlist");

const create = async (data, options = {}) => {
  const documents = await Wishlist.create([data], {
    session: options.session,
  });

  return documents[0];
};

const findByCustomerId = async (customerId, options = {}) => {
  let query = Wishlist.findOne({ customerId }).session(options.session || null);

  if (options.populate) {
    query = query
      .populate({
        path: "items.productId",
        select: "name slug sku price compareAtPrice images status",
      })
      .populate({
        path: "items.productVariantId",
        select: "sku name attributes price stockQuantity stockStatus",
      });
  }

  return query;
};

const findById = async (id, options = {}) => {
  return Wishlist.findById(id).session(options.session || null);
};

const updateById = async (id, data, options = {}) => {
  return Wishlist.findByIdAndUpdate(id, data, {
    new: true,
    returnDocument: "after",
    runValidators: true,
    session: options.session,
  });
};

module.exports = {
  create,
  findByCustomerId,
  findById,
  updateById,
};
