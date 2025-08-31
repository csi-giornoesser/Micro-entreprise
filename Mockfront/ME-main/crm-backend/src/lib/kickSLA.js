// crm-backend/src/lib/kickSLA.js
import { getPool } from "../config/db.js";

// Throttle: 1 exécution max toutes les 2 minutes
let lastRun = 0;
const MIN_MS_BETWEEN_RUNS = 2 * 60 * 1000;

/**
 * Exécute les jobs SLA côté base:
 *  - core.create_due_tickets(limit)
 *  - core.produce_notifications()
 *  - core.dispatch_due_notifications()
 */
export async function kickSLA(limit = 200) {
  const now = Date.now();

  // Anti-spam: ignore si exécuté récemment
  if (now - lastRun < MIN_MS_BETWEEN_RUNS) {
    // console.log("[kickSLA] Ignoré (délai anti-spam)");
    return;
  }
  lastRun = now;

  try {
    const pool = getPool();

    // 1) Créer/mettre à jour les tickets dus
    await pool.query("SELECT * FROM core.create_due_tickets($1);", [limit]);

    // 2) Produire les notifications selon l’état
    await pool.query("SELECT core.produce_notifications();");

    // 3) Envoyer celles qui sont arrivées à échéance
    await pool.query("SELECT core.dispatch_due_notifications();");

    // console.log("[kickSLA] OK");
  } catch (e) {
    console.warn("[kickSLA] skipped:", e?.message || e);
  }
}
