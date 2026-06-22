"use strict";

const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const ctrl = require("../controllers/ai-proposals.controller");

router.get("/", asyncHandler(ctrl.list));
router.post("/generate", asyncHandler(ctrl.generate));
router.get("/:id", asyncHandler(ctrl.getById));
router.post("/:id/review", asyncHandler(ctrl.review));
router.post("/:id/apply", asyncHandler(ctrl.apply));
router.post("/:id/schedule", asyncHandler(ctrl.schedule));
router.delete("/:id", asyncHandler(ctrl.remove));

module.exports = router;
