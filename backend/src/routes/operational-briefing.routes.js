const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const controller = require("../controllers/operational-briefing.controller");

router.get("/", asyncHandler(controller.getBriefing));
router.post("/narrate", asyncHandler(controller.postNarrate));

module.exports = router;
