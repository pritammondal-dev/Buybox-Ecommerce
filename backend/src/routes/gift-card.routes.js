const express = require("express");
const giftCardController = require("../controllers/gift-card.controller");
const authenticate = require("../middlewares/authentication.middleware");

const router = express.Router();

// Public / Authenticated balance checker
router.post("/check-balance", giftCardController.checkBalance);

// Authenticated claim & customer list
router.post("/claim", authenticate, giftCardController.claimGiftCard);
router.get("/my", authenticate, giftCardController.getMyGiftCards);

module.exports = router;
