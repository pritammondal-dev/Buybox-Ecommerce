const express = require("express");
const adminSearchController = require("../controllers/admin-search.controller");

const router = express.Router();

router.get("/", adminSearchController.globalSearch);

module.exports = router;
