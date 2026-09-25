const express = require("express");
const campaignController = require("../controllers/campaign.controller");

const router = express.Router();

// Public storefront campaign routes
router.get("/active", campaignController.getActiveCampaigns);
router.get("/slug/:slug", campaignController.getCampaignBySlug);

module.exports = router;
