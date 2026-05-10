const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const archiveController = require("../controllers/archive.controller");

const router = express.Router();
router.use(express.json({ limit: "12mb" }));

router.get("/financial", asyncHandler(archiveController.getFinancial));
router.get("/financial/compare-month", asyncHandler(archiveController.getCompareMonth));

router.get("/orders", asyncHandler(archiveController.listOrders));
router.post("/orders/:id/hide", asyncHandler(archiveController.hideOrder));
router.post("/orders/:id/unhide", asyncHandler(archiveController.unhideOrder));

router.get("/cassa-invoices", asyncHandler(archiveController.listCassaInvoices));
router.post("/cassa-invoices", asyncHandler(archiveController.postCassaInvoice));
router.post("/cassa-invoices/sync", asyncHandler(archiveController.syncCassaInvoices));

router.get("/purchase-invoices", asyncHandler(archiveController.listPurchase));
router.post("/purchase-invoices", asyncHandler(archiveController.postPurchase));
router.delete("/purchase-invoices/:id", asyncHandler(archiveController.deletePurchase));
router.get("/purchase-invoices/:id/file", asyncHandler(archiveController.downloadPurchaseFile));

module.exports = router;
