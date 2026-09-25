const ProductQuestion = require("../models/ProductQuestion");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const User = require("../models/User");
const AppError = require("../errors/AppError");
const apiResponse = require("../utils/apiResponse");

const getProductQuestions = async (req, res) => {
  const { productId } = req.params;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = {
    productId,
    status: "approved",
  };

  const [questions, total] = await Promise.all([
    ProductQuestion.find(filter)
      .sort({ helpfulCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ProductQuestion.countDocuments(filter),
  ]);

  return apiResponse.sendSuccess(res, {
    message: "Questions retrieved successfully",
    data: questions,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
};

const createQuestion = async (req, res) => {
  const { productId, question } = req.body;
  const userId = req.user.id;

  if (!productId || !question || !question.trim()) {
    throw new AppError("Product ID and question are required", 400, "INVALID_INPUT");
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }

  const customer = await Customer.findOne({ userId });
  const user = await User.findById(userId);

  const newQuestion = await ProductQuestion.create({
    productId,
    customerId: customer?._id || userId,
    userId,
    userName: user?.name || user?.firstName || "Customer",
    question: question.trim(),
    status: "approved",
  });

  return apiResponse.sendSuccess(res, {
    statusCode: 201,
    message: "Question submitted successfully",
    data: newQuestion,
  });
};

const addAnswer = async (req, res) => {
  const { questionId } = req.params;
  const { answer } = req.body;
  const userId = req.user.id;

  if (!answer || !answer.trim()) {
    throw new AppError("Answer text is required", 400, "INVALID_INPUT");
  }

  const questionDoc = await ProductQuestion.findById(questionId);
  if (!questionDoc) {
    throw new AppError("Question not found", 404, "QUESTION_NOT_FOUND");
  }

  const user = await User.findById(userId);
  const role = req.user.role === "admin" ? "admin" : req.user.role === "vendor" ? "vendor" : "customer";

  const newAnswer = {
    authorId: userId,
    authorName: user?.name || user?.firstName || "Customer",
    authorRole: role,
    answer: answer.trim(),
    helpfulCount: 0,
    helpfulVoters: [],
    isVerified: role !== "customer",
  };

  questionDoc.answers.push(newAnswer);
  await questionDoc.save();

  return apiResponse.sendSuccess(res, {
    statusCode: 201,
    message: "Answer added successfully",
    data: questionDoc,
  });
};

const markQuestionHelpful = async (req, res) => {
  const { questionId } = req.params;
  const userId = req.user.id;

  const questionDoc = await ProductQuestion.findById(questionId);
  if (!questionDoc) {
    throw new AppError("Question not found", 404, "QUESTION_NOT_FOUND");
  }

  const alreadyVoted = questionDoc.helpfulVoters.some(
    (id) => id.toString() === userId.toString()
  );

  if (!alreadyVoted) {
    questionDoc.helpfulVoters.push(userId);
    questionDoc.helpfulCount = questionDoc.helpfulVoters.length;
    await questionDoc.save();
  }

  return apiResponse.sendSuccess(res, {
    message: "Vote recorded",
    data: {
      helpfulCount: questionDoc.helpfulCount,
    },
  });
};

const markAnswerHelpful = async (req, res) => {
  const { questionId, answerId } = req.params;
  const userId = req.user.id;

  const questionDoc = await ProductQuestion.findById(questionId);
  if (!questionDoc) {
    throw new AppError("Question not found", 404, "QUESTION_NOT_FOUND");
  }

  const answer = questionDoc.answers.id(answerId);
  if (!answer) {
    throw new AppError("Answer not found", 404, "ANSWER_NOT_FOUND");
  }

  const alreadyVoted = answer.helpfulVoters.some(
    (id) => id.toString() === userId.toString()
  );

  if (!alreadyVoted) {
    answer.helpfulVoters.push(userId);
    answer.helpfulCount = answer.helpfulVoters.length;
    await questionDoc.save();
  }

  return apiResponse.sendSuccess(res, {
    message: "Vote recorded",
    data: {
      helpfulCount: answer.helpfulCount,
    },
  });
};

const { resolveApprovedVendor } = require("../middlewares/vendor.middleware");
const { encodeSecureId } = require("../utils/secure-id.util");

const getMyVendorQuestions = async (req, res) => {
  const vendor = await resolveApprovedVendor(req.user.id);

  const vendorProducts = await Product.find({
    vendorId: vendor._id,
    deletedAt: null,
  }).select("_id title").lean();
  const productIds = vendorProducts.map((p) => p._id);
  const productMap = new Map(vendorProducts.map((p) => [p._id.toString(), p]));

  if (productIds.length === 0) {
    return apiResponse.sendSuccess(res, {
      message: "Vendor questions retrieved successfully",
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = { productId: { $in: productIds } };
  if (req.query.unanswered === "true") {
    filter.answers = { $size: 0 };
  }

  const [questions, total] = await Promise.all([
    ProductQuestion.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ProductQuestion.countDocuments(filter),
  ]);

  const items = questions.map((q) => {
    const product = productMap.get(q.productId?.toString());
    return {
      _id: q._id,
      secureId: encodeSecureId("question", q._id),
      product: {
        _id: q.productId,
        secureId: encodeSecureId("product", q.productId),
        title: product?.title || "Product",
      },
      question: q.question,
      userName: q.userName,
      status: q.status,
      answers: q.answers || [],
      helpfulCount: q.helpfulCount,
      createdAt: q.createdAt,
    };
  });

  return apiResponse.sendSuccess(res, {
    message: "Vendor questions retrieved successfully",
    data: items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
};

module.exports = {
  getProductQuestions,
  createQuestion,
  addAnswer,
  markQuestionHelpful,
  markAnswerHelpful,
  getMyVendorQuestions,
};
