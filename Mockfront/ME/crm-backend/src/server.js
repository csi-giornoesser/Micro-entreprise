// crm-backend/src/server.js
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// ---------- .env : préfère crm-backend/.env plutôt que src/.env ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Core & middlewares ----------
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { applyMiddlewares } from "./middlewares/index.js";
import { notFound, errorHandler } from "./middlewares/errorHandler.js";
import { assertDbConnection } from "./config/db.js";

// ---------- Routes ----------
import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import clientsRoutes from "./routes/clients.routes.js";
import entreprisesRoutes from "./routes/entreprises.routes.js";
import alertsRoutes from "./routes/alerts.routes.js";
import commercialRoutes from "./routes/commercial.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import exportsRoutes from "./routes/exports.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import partenairesRoutes from "./routes/partenaires.routes.js";
import ticketsRoutes from "./routes/tickets.routes.js";
import dossiersRoutes from "./routes/dossiers.routes.js";

const app = express();

// ---------- Middlewares globaux ----------
applyMiddlewares?.(app); // si tu as des middlewares maison
app.use(express.json({ limit: "2mb" }));

const corsOptions = {
  origin: (process.env.CORS_ORIGIN || "http://localhost:3000").split(","),
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.disable("x-powered-by");
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Limiter uniquement le POST /api/auth/login
app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ---------- Health checks ----------
const startedAt = new Date();

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "crm-backend",
    env: process.env.NODE_ENV || "development",
    uptime_s: Math.round(process.uptime()),
    started_at: startedAt.toISOString(),
    now: new Date().toISOString(),
  });
});

app.get("/ready", async (_req, res) => {
  try {
    await assertDbConnection();
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(503).json({ ok: false, error: "db_unreachable" });
  }
});

// ---------- Garde-fou pour les routes ----------
function pickRouter(mod, name) {
  const candidate = mod?.default ?? mod?.router ?? mod;
  const looksLikeRouter =
    typeof candidate === "function" ||
    (candidate && typeof candidate.use === "function" && typeof candidate.handle === "function");

  if (!looksLikeRouter) {
    console.error(`❌ [routes] ${name} n'exporte pas un Router Express valide. Reçu:`, candidate);
    throw new TypeError(
      `[routes] ${name} must export un Express Router (export default ou 'export const router').`
    );
  }
  return candidate;
}

// ---------- Mount routes (sécurisé) ----------
app.use("/api/auth",          pickRouter(authRoutes,          "authRoutes"));
app.use("/api/users",         pickRouter(usersRoutes,         "usersRoutes"));
app.use("/api/clients",       pickRouter(clientsRoutes,       "clientsRoutes"));
app.use("/api/entreprises",   pickRouter(entreprisesRoutes,   "entreprisesRoutes"));
app.use("/api/alerts",        pickRouter(alertsRoutes,        "alertsRoutes"));
app.use("/api/commercial",    pickRouter(commercialRoutes,    "commercialRoutes"));
app.use("/api/dashboard",     pickRouter(dashboardRoutes,     "dashboardRoutes"));
app.use("/api/exports",       pickRouter(exportsRoutes,       "exportsRoutes"));
app.use("/api/notifications", pickRouter(notificationsRoutes, "notificationsRoutes"));
app.use("/api/partenaires",   pickRouter(partenairesRoutes,   "partenairesRoutes"));
app.use("/api/tickets",       pickRouter(ticketsRoutes,       "ticketsRoutes"));
app.use("/api/dossiers",      pickRouter(dossiersRoutes,      "dossiersRoutes"));

// ---------- 404 + error handler ----------
app.use(notFound);
app.use(errorHandler);

// ---------- Start ----------
const PORT = Number(process.env.PORT || 8000);
const server = app.listen(PORT, () => {
  console.log(`✅ API CRM écoute sur http://localhost:${PORT}`);
  console.log(
    `🌐 CORS_ORIGIN: ${(process.env.CORS_ORIGIN || "http://localhost:3000")
      .split(",")
      .join(", ")}`
  );
});
server.on("error", (err) => console.error("❌ listen error:", err.message));
