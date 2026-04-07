const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const suppliersController = require("../controllers/suppliers.controller");

const router = express.Router();

router.get("/", asyncHandler(suppliersController.list));
router.post("/", asyncHandler(suppliersController.create));
router.get("/:id/payment-summary", asyncHandler(suppliersController.paymentSummary));
router.post("/:id/archive", asyncHandler(suppliersController.archive));
router.post("/:id/restore", asyncHandler(suppliersController.restore));
router.post("/:id/orders", asyncHandler(suppliersController.addOrder));
router.patch("/:id/orders/:orderId", asyncHandler(suppliersController.patchOrder));
router.delete("/:id/orders/:orderId", asyncHandler(suppliersController.removeOrder));
router.post("/:id/invoices", asyncHandler(suppliersController.addInvoice));
router.patch("/:id/invoices/:invoiceId", asyncHandler(suppliersController.patchInvoice));
router.delete("/:id/invoices/:invoiceId", asyncHandler(suppliersController.removeInvoice));
router.get("/:id", asyncHandler(suppliersController.getById));
router.patch("/:id", asyncHandler(suppliersController.update));

module.exports = router;
