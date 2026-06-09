const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const licenseController = require("../controllers/license.controller");
const { requireAuth } = require("../middleware/requireAuth.middleware");
const { requireRole } = require("../middleware/requireRole.middleware");

// GET /api/licenses
router.get("/", asyncHandler(licenseController.getLicense));

// GET /api/licenses/validate?code=...
router.get("/validate", asyncHandler(licenseController.validateCodeQuery));

// POST /api/licenses/verify-code
router.post("/verify-code", asyncHandler(licenseController.verifyCode));

// POST /api/licenses/complete-activation
router.post("/complete-activation", asyncHandler(licenseController.completeActivation));

// POST /api/licenses/activate
router.post("/activate", asyncHandler(licenseController.activateLicense));

// POST /api/licenses/deactivate (owner only)
router.post("/deactivate", requireAuth, requireRole("owner"), asyncHandler(licenseController.deactivateLicense));

// GET /api/licenses/status
router.get("/status", asyncHandler(licenseController.getStatus));

module.exports = router;