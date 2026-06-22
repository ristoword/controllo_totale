"use strict";

const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const ctrl = require("../controllers/notifications.controller");

router.get("/", asyncHandler(ctrl.list));
router.post("/", asyncHandler(ctrl.create));
router.post("/mark-all-read", asyncHandler(ctrl.markAllRead));
router.post("/:id/read", asyncHandler(ctrl.markRead));
router.delete("/:id", asyncHandler(ctrl.remove));

module.exports = router;
