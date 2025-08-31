// crm-backend/src/routes/dossiers.routes.js
import express from "express";
import multer from "multer";

import {
  downloadDossierDocument,
  listDossierDocuments,
  completeFormStep,
  getDossierMessages,
  postDossierMessage,
  uploadDossierPiece,
  getDossierPieces,
  getDossierTimeline,
  patchDossier,
  listDossiers,
} from "../controllers/dossiers.controller.js";

const router = express.Router();

// Multer en mémoire (la vraie limite est checkée côté contrôleur via règles DB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 Mo garde-fou
});

// Upload pièce
router.post("/:id/pieces/:piece_key/upload", upload.single("file"), uploadDossierPiece);

// Liste des documents (compat: POST)
router.post("/:id/documents", listDossierDocuments);

// Download d’un type de document
router.get("/:id/documents/:type/download", downloadDossierDocument);

// Étape formulaire
router.post("/:id/etapes/formulaire/completer", completeFormStep);

// Messages
router.get("/:id/messages", getDossierMessages);
router.post("/:id/messages", express.json(), postDossierMessage);

// Pièces (état + règles)
router.get("/:id/pieces", getDossierPieces);

// Timeline
router.get("/:id/timeline", getDossierTimeline);

// Mise à jour dossier
router.patch("/:id", express.json(), patchDossier);

// Liste dossiers
router.get("/", listDossiers);

export default router;
