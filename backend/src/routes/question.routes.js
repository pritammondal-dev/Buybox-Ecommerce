const express = require("express");
const questionController = require("../controllers/question.controller");
const authenticate = require("../middlewares/authentication.middleware");

const { requireRoles } = require("../middlewares/authorization.middleware");
const { ROLES } = require("../constants/auth.constants");

const router = express.Router();

// Vendor-scoped questions
router.get(
  "/vendor/my",
  authenticate,
  requireRoles(ROLES.VENDOR),
  questionController.getMyVendorQuestions
);

// Public: view questions for a product
router.get("/product/:productId", questionController.getProductQuestions);

// Customer / Authenticated actions
router.post("/", authenticate, questionController.createQuestion);
router.post("/:questionId/answers", authenticate, questionController.addAnswer);
router.post("/:questionId/helpful", authenticate, questionController.markQuestionHelpful);
router.post("/:questionId/answers/:answerId/helpful", authenticate, questionController.markAnswerHelpful);

module.exports = router;
