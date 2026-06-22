const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const cantinaController = require("../controllers/cantina.controller");

router.get("/ai", asyncHandler(cantinaController.aiSnapshot));
router.get("/", asyncHandler(cantinaController.list));
router.get("/:id", asyncHandler(cantinaController.getById));
router.post("/", asyncHandler(cantinaController.create));
router.patch("/:id/stock", asyncHandler(cantinaController.adjustStock));
router.patch("/:id", asyncHandler(cantinaController.update));
router.delete("/:id", asyncHandler(cantinaController.remove));

module.exports = router;
