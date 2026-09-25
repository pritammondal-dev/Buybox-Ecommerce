const express = require("express");
const savedViewController = require("../controllers/saved-view.controller");
const authenticate = require("../middlewares/authentication.middleware");
const validateObjectId = require("../middlewares/validate-object-id.middleware");

const router = express.Router();

router.use(authenticate);

router.get("/", savedViewController.listSavedViews);
router.post("/", savedViewController.createSavedView);
router.get("/:id", validateObjectId("id"), savedViewController.getSavedView);
router.patch("/:id", validateObjectId("id"), savedViewController.updateSavedView);
router.delete("/:id", validateObjectId("id"), savedViewController.deleteSavedView);

module.exports = router;
