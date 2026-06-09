const express = require("express");
const resellerController = require("./reseller.controller");
const { requireReseller } = require("./reseller.middleware");

const router = express.Router();

// Pages
router.get("/reseller-login", resellerController.getResellerLoginPage);
router.get("/reseller-dashboard", requireReseller, resellerController.getResellerDashboardPage);

// Auth APIs
router.post("/api/reseller/login", resellerController.apiLogin);
router.post("/api/reseller/logout", requireReseller, resellerController.apiLogout);

// Data APIs (read-only)
router.get("/api/reseller/dashboard", requireReseller, resellerController.apiGetDashboard);
router.get("/api/reseller/profile", requireReseller, resellerController.apiGetProfile);

module.exports = router;
