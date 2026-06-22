"use strict";

const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const ctrl = require("../controllers/sessions.controller");

router.get("/", asyncHandler(ctrl.list));
router.delete("/:id", asyncHandler(ctrl.revoke));

module.exports = router;
