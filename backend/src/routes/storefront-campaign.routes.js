const express = require("express");
const campaignController = require("../controllers/campaign.controller");
const { authenticateOptional } = require("../middlewares/authentication.middleware");

const router = express.Router();

// Public storefront campaign routes
router.get("/active", campaignController.getActiveCampaigns);
router.get("/slug/:slug", authenticateOptional, campaignController.getCampaignBySlug);

module.exports = router;
