// crm-backend/src/routes/partenaires.routes.js
import express from "express";
import {
  listPartnerClients,
  listPartnerInteractions,
  createPartnerInteraction,
  listPartnerInvoices,
  postPartnerInvoices,   // endpoint unifié: preview/create via body (action|dryRun)
  getInvoicePdf,
  postCloseMonth,        // sans :id dans le path
  getPartnerOverview,
  // Endpoints optionnels si tu veux les exposer séparément :
  // previewInvoice,
  // createInvoice,
} from "../controllers/partenaires.controller.js";

const router = express.Router();

// Clients
router.get("/:id/clients", listPartnerClients);

// Interactions
router.get("/:id/interactions", listPartnerInteractions);
router.post("/:id/interactions", express.json(), createPartnerInteraction);

// Invoices - listing
router.get("/:id/invoices", listPartnerInvoices);

// Invoices - endpoint unifié (preview/create via body { action: "preview"|"create", ... })
router.post("/:id/invoices", express.json(), postPartnerInvoices);

// (Optionnels si tu exposes séparément)
// router.post("/:id/factures/preview", express.json(), previewInvoice);
// router.post("/:id/factures",        express.json(), createInvoice);

// PDF facture
router.get("/:id/invoices/:invoiceId/pdf", getInvoicePdf);

// Clôture mensuelle (pas d'id dans l’URL)
router.post("/close-month", express.json(), postCloseMonth);

// Overview partenaire (à garder en dernier pour éviter des collisions de routes)
router.get("/:id", getPartnerOverview);

export default router;
