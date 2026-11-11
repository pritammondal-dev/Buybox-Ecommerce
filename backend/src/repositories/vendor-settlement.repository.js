const { VendorSettlement } = require("../models/VendorSettlement");

const create = async (data, options = {}) => {
  const documents = await VendorSettlement.create([data], {
    session: options.session,
  });

  return documents[0];
};

const findById = async (id, options = {}) => {
  return VendorSettlement.findById(id).session(options.session || null);
};

const findBySettlementNumber = async (settlementNumber, options = {}) => {
  return VendorSettlement.findOne({ settlementNumber }).session(
    options.session || null
  );
};

const findByIdempotencyKey = async (
  vendorId,
  idempotencyKey,
  options = {}
) => {
  return VendorSettlement.findOne({
    vendorId,
    idempotencyKey,
  }).session(options.session || null);
};

const findByVendorId = async (vendorId, options = {}) => {
  return VendorSettlement.find({
    vendorId,
  })
    .session(options.session || null)
    .sort({ createdAt: -1 });
};

const findByPeriod = async (
  vendorId,
  periodStart,
  periodEnd,
  options = {}
) => {
  return VendorSettlement.findOne({
    vendorId,
    periodStart,
    periodEnd,
  }).session(options.session || null);
};

const updateById = async (id, data, options = {}) => {
  return VendorSettlement.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
    session: options.session,
  });
};

const findAll = async ({ filter = {}, skip = 0, limit = 20, sort = { createdAt: -1 } } = {}) => {
  const [items, total] = await Promise.all([
    VendorSettlement.find(filter)
      .populate("vendorId", "businessName storeName businessSlug email phone")
      .populate("orderIds", "orderNumber status grandTotal placedAt")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    VendorSettlement.countDocuments(filter),
  ]);

  return { items, total };
};

const findPaginatedByVendor = async ({
  vendorId,
  page = 1,
  limit = 20,
  status,
  startDate,
  endDate,
  search,
  options = {},
}) => {
  const mongoose = require("mongoose");
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const match = {
    vendorId:
      vendorId instanceof mongoose.Types.ObjectId
        ? vendorId
        : new mongoose.Types.ObjectId(vendorId),
  };

  if (status && status !== "all") {
    match.status = status;
  }

  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), "i");
    match.$or = [
      { settlementNumber: searchRegex },
      { payoutReference: searchRegex },
    ];
  }

  const pipeline = [
    { $match: match },
    {
      $facet: {
        paginatedItems: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: safeLimit },
        ],
        totalCount: [{ $count: "count" }],
        summary: [
          {
            $group: {
              _id: null,
              totalGrossVolume: { $sum: "$grossSales" },
              totalSettledAmount: {
                $sum: {
                  $cond: [{ $eq: ["$status", "paid"] }, "$netPayable", 0],
                },
              },
              pendingDisbursements: {
                $sum: {
                  $cond: [{ $ne: ["$status", "paid"] }, "$netPayable", 0],
                },
              },
            },
          },
        ],
      },
    },
  ];

  const aggregateQuery = VendorSettlement.aggregate(pipeline);
  if (options.session) {
    aggregateQuery.session(options.session);
  }
  const [result] = await aggregateQuery;

  const paginatedItems = result?.paginatedItems || [];
  const totalCount = result?.totalCount?.[0]?.count || 0;
  const summaryResult = result?.summary?.[0] || {
    totalGrossVolume: 0,
    totalSettledAmount: 0,
    pendingDisbursements: 0,
  };

  return {
    items: paginatedItems,
    total: totalCount,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(totalCount / safeLimit) || 1,
    summary: {
      totalGrossVolume: Number(summaryResult.totalGrossVolume?.toString() || 0).toFixed(2),
      totalSettledAmount: Number(summaryResult.totalSettledAmount?.toString() || 0).toFixed(2),
      pendingDisbursements: Number(summaryResult.pendingDisbursements?.toString() || 0).toFixed(2),
    },
  };
};

module.exports = {
  create,
  findById,
  findBySettlementNumber,
  findByIdempotencyKey,
  findByVendorId,
  findByPeriod,
  updateById,
  findAll,
  findPaginatedByVendor,
};