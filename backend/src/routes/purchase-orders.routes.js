"use strict";

const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const ctrl = require("../controllers/purchase-orders.controller");

router.get("/", asyncHandler(ctrl.list));
router.get("/report", asyncHandler(ctrl.report));
router.post("/", asyncHandler(ctrl.create));

router.get("/:id", asyncHandler(ctrl.getById));
router.patch("/:id", asyncHandler(ctrl.update));
router.delete("/:id", asyncHandler(ctrl.remove));

router.post("/:id/status", asyncHandler(ctrl.updateStatus));
router.post("/:id/receive", asyncHandler(ctrl.receive));
router.post("/:id/archive", asyncHandler(ctrl.archive));
router.post("/:id/email", asyncHandler(ctrl.email));

module.exports = router;
