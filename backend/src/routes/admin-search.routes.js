const express = require("express");
const adminSearchController = require("../controllers/admin-search.controller");
const authenticate = require("../middlewares/authentication.middleware");

const router = express.Router();

router.use(authenticate);

router.get("/", adminSearchController.globalSearch);

module.exports = router;
