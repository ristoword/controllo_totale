const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const customersController = require("../controllers/customers.controller");

router.get("/ai", asyncHandler(customersController.aiSnapshot));
router.post("/ai/insights", asyncHandler(customersController.aiInsights));
router.get("/", asyncHandler(customersController.list));
router.get("/:id", asyncHandler(customersController.getById));
router.post("/", asyncHandler(customersController.create));
router.put("/:id", asyncHandler(customersController.update));
router.delete("/:id", asyncHandler(customersController.remove));

module.exports = router;
