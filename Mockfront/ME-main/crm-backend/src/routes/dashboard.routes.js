// crm-backend/src/routes/dashboard.routes.js
import express from "express";
import { getDashboard } from "../controllers/dashboard.controller.js";

const router = express.Router();

// GET /api/dashboard
router.get("/", getDashboard);

export default router;