const express = require("express");
const rewardController = require("../controllers/reward.controller");
const authenticate = require("../middlewares/authentication.middleware");

const router = express.Router();

router.use(authenticate);

router.get("/my", rewardController.getMyRewards);

module.exports = router;
