import { Router } from "express";
import { getAlerts } from "../controllers/alerts.controller.js";

const router = Router();

// GET /api/alerts
router.get("/", getAlerts);

export default router;
