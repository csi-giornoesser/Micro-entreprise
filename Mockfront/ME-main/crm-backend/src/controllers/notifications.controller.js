// crm-backend/src/controllers/notifications.controller.js
import { getPool } from "../config/db.js";

const ALLOWED_CANALS = new Set(["email", "sms"]);

// POST /api/notifications
export async function createNotification(req, res, next) {
  try {
    const {
      type,
      client_id,
      dossier_id,
      canal = "email",
      scheduled_for,
      message = null,
    } = req.body || {};

    // validations basiques
    if (!type || !client_id || !dossier_id || !scheduled_for) {
      return res.status(400).json({
        error: "type, client_id, dossier_id, scheduled_for requis",
        code: "BAD_REQUEST",
      });
    }
    if (!ALLOWED_CANALS.has(String(canal))) {
      return res.status(400).json({
        error: "canal invalide (email|sms)",
        code: "BAD_CANAL",
      });
    }

    // normaliser la date (ISO)
    const when = new Date(scheduled_for);
    if (Number.isNaN(when.getTime())) {
      return res.status(400).json({
        error: "scheduled_for invalide (date)",
        code: "BAD_DATE",
      });
    }
    const scheduledISO = when.toISOString();

    // id “unique” compatible avec ton historique (migrated:/sent-…)
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const c = await getPool().connect();
    try {
      // status a un DEFAULT 'pending' dans ton schéma → pas besoin de le passer
      await c.query(
        `
        INSERT INTO core.notifications_queue
          (id, type, client_id, dossier_id, canal, scheduled_for, message)
        VALUES
          ($1,  $2,   $3,        $4,         $5,    $6,            $7)
        `,
        [id, String(type), Number(client_id), Number(dossier_id), String(canal), scheduledISO, message]
      );

      return res.status(201).json({
        id,
        scheduled_for: scheduledISO,
        status: "pending",
      });
    } finally {
      c.release();
    }
  } catch (e) {
    console.error("Erreur API notifications (POST):", e);
    next(e);
  }
}
