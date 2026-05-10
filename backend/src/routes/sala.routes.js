// backend/src/routes/sala.routes.js
const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const salaController = require("../controllers/sala.controller");
const { requireAuth } = require("../middleware/requireAuth.middleware");

const router = express.Router();

// Tutti gli endpoint richiedono autenticazione
router.get("/tables", requireAuth, asyncHandler(salaController.listTables));
router.post("/tables", requireAuth, asyncHandler(salaController.createTable));
router.patch("/tables/:id", requireAuth, asyncHandler(salaController.updateTable));
router.patch("/tables/:id/status", requireAuth, asyncHandler(salaController.patchStatus));
router.delete("/tables/:id", requireAuth, asyncHandler(salaController.deleteTable));

module.exports = router;
