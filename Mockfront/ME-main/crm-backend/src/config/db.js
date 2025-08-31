// crm-backend/src/config/db.js
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const { Pool } = pg;

// -------- Filet de sécurité : charge .env si nécessaire --------
(function ensureEnvLoaded() {
  if (process.env.DATABASE_URL) return; // déjà présent

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const candidates = [
    path.resolve(__dirname, "../.env"),     // crm-backend/.env si on lance depuis src/
    path.resolve(__dirname, "../../.env"),  // répertoire parent
    path.resolve(process.cwd(), ".env"),    // cwd
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
      console.log(`[db/env] 📦 .env chargé par fallback: ${p}`);
      break;
    }
  }

  if (!process.env.DATABASE_URL) {
    console.error("[db/env] ❌ DATABASE_URL introuvable après fallback");
  }
})();
// ----------------------------------------------------------------

let pool = globalThis.__PG_POOL;
if (!pool) {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    // On jette pour éviter le fallback implicite vers 127.0.0.1
    throw new Error("DATABASE_URL is required");
  }

  let cfg;
  try {
    const u = new URL(connectionString);
    const isLocal = /^(localhost|127\.0\.0\.1|::1)$/.test(u.hostname);
    const sslmode = u.searchParams.get("sslmode");

    console.log(
      "[DB] host:", u.hostname,
      "port:", u.port || "5432",
      "db:", u.pathname.slice(1),
      "sslmode:", sslmode || "(none)"
    );

    cfg = {
      host: u.hostname,
      port: Number(u.port || 5432),
      database: decodeURIComponent(u.pathname.slice(1)),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      ssl: !isLocal ? { rejectUnauthorized: false } : undefined, // SSL pour Neon/Render, pas en local
    };
  } catch (e) {
    console.warn("[DB] URL parse failed, fallback to connectionString:", e?.message || e);
    cfg = { connectionString, ssl: { rejectUnauthorized: false } };
  }

  pool = new Pool(cfg);
  globalThis.__PG_POOL = pool;

  // Test non bloquant
  pool.query("SELECT 1").then(
    () => console.log("[DB] ✅ pool prêt"),
    (err) => console.error("[DB] ❌ échec initial:", err?.message || err)
  );
}

export const getPool = () => pool;
export const query = (text, params) => pool.query(text, params);

export async function withClient(fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function assertDbConnection() {
  const { rows } = await query("SELECT now() AS now");
  return rows[0].now;
}
