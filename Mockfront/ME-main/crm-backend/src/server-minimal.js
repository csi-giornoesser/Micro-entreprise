// crm-backend/src/server-minimal.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// --- charge .env depuis crm-backend/.env (et non src/.env) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });
// --------------------------------------------------------------

// Routes
import alertsRoutes from "./routes/alerts.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import dossiersRoutes from "./routes/dossiers.routes.js";
import clientsRoutes from "./routes/clients.routes.js";
import entreprisesRoutes from "./routes/entreprises.routes.js";
import exportsRoutes from "./routes/exports.routes.js"
import notificationsRoutes from "./routes/notifications.routes.js";
import partenairesRoutes from "./routes/partenaires.routes.js";



// (optionnel) test DB /health/db
import { withClient } from "./config/db.js";

const app = express(); // <<< IMPORTANT: créer l'app AVANT app.use()

// Middlewares
app.use(express.json());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

// Routes
app.use("/api/alerts", alertsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/dossiers", dossiersRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/entreprises", entreprisesRoutes);
app.use("/api/exports", exportsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/partenaires", partenairesRoutes);

// Health checks
app.get("/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get("/health/db", async (_req, res, next) => {
  try {
    await withClient(async (c) => {
      const { rows } = await c.query("SELECT NOW() AS now");
      res.json({ ok: true, db: "connected", now: rows[0].now });
    });
  } catch (e) {
    next(e);
  }
});

// Error handler verbeux
app.use((err, _req, res, _next) => {
  console.error("Erreur:", err?.stack || err);
  res.status(err.status || 500).json({
    error: err?.message || "Internal server error",
    code: err?.code,
  });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`✅ Backend minimal sur http://localhost:${PORT}`);
  console.log(`🌐 CORS: ${process.env.CORS_ORIGIN || "http://localhost:3000"}`);
});
