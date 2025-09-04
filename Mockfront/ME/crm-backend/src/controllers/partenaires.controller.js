// crm-backend/src/controllers/partenaires.controller.js
import { previewOrCreateInvoice } from "../services/facture.service.js";

// ===== Résolution DB sans modifier config/db.js =====
import * as DB from "../config/db.js";
const getPool =
  (typeof DB.getPool === "function") ? DB.getPool
  : () => (DB.pool || DB.default?.pool || DB.default);

async function withClient(fn) {
  const pool = getPool();
  if (!pool || typeof pool.connect !== "function") {
    throw new Error("DB pool introuvable: expose `getPool()`, `pool`, ou `default.pool` dans config/db.js");
  }
  const client = await pool.connect();
  try { return await fn(client); }
  finally { try { client.release(); } catch {}
  }
}

const PERIODE_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// ---------- Factures: preview / create ----------

// POST /api/partenaires/:id/factures/preview   { periode: "YYYY-MM", rate?: 0.15 }
export async function previewInvoice(req, res, next) {
  try {
    const partnerId = Number(req.params.id);
    const { periode, rate = null } = req.body || {};

    if (!Number.isFinite(partnerId)) {
      return res.status(400).json({ error: "partnerId invalide" });
    }
    if (!PERIODE_RE.test(periode || "")) {
      return res.status(400).json({ error: "periode doit être au format YYYY-MM" });
    }

    const result = await previewOrCreateInvoice({ partnerId, periode, rate, dryRun: true });
    return res.json(result);
  } catch (e) {
    next(e);
  }
}

// POST /api/partenaires/:id/factures          { periode: "YYYY-MM", rate?: 0.15 }
export async function createInvoice(req, res, next) {
  try {
    const partnerId = Number(req.params.id);
    const { periode, rate = null } = req.body || {};

    if (!Number.isFinite(partnerId)) {
      return res.status(400).json({ error: "partnerId invalide" });
    }
    if (!PERIODE_RE.test(periode || "")) {
      return res.status(400).json({ error: "periode doit être au format YYYY-MM" });
    }

    const result = await previewOrCreateInvoice({ partnerId, periode, rate, dryRun: false });
    return res.status(201).json(result);
  } catch (e) {
    next(e);
  }
}

// ---------- Clients du partenaire ----------

// GET /api/partenaires/:id/clients
export async function listPartnerClients(req, res, next) {
  const partnerId = Number(req.params.id);
  if (!Number.isFinite(partnerId)) {
    return res.status(400).json({ error: "bad id" });
  }

  const search      = String(req.query.search || "").trim();
  const statut      = req.query.statut || "tous";
  const dateDebut   = req.query.dateDebut || null;
  const dateFin     = req.query.dateFin || null;
  const showBlocked = String(req.query.showBlocked || "") === "true";
  const commission  = req.query.commission;
  const limit       = Math.min(Number(req.query.limit || 1000), 5000);

  try {
    const rows = await withClient(async (conn) => {
      const conds = ["d.partenaire_id = $1"];
      const vals  = [partnerId];
      let i = 2;

      if (statut && statut !== "tous") { conds.push(`d.statut = $${i++}`); vals.push(statut); }
      if (dateDebut) { conds.push(`d.date_creation >= $${i++}::date`); vals.push(dateDebut); }
      if (dateFin)   { conds.push(`d.date_creation <= $${i++}::date`); vals.push(dateFin); }
      if (showBlocked) conds.push(`COALESCE(array_length(d.blocages,1),0) > 0`);
      if (commission && !Number.isNaN(Number(commission))) {
        conds.push(`COALESCE(d.commission_partenaire_eur,0) >= $${i++}::numeric`);
        vals.push(commission);
      }
      if (search) {
        conds.push(`(
          (COALESCE(c.prenom,'') || ' ' || COALESCE(c.nom,'')) ILIKE $${i} OR
          COALESCE(c.email,'') ILIKE $${i} OR
          COALESCE(e.denomination,'') ILIKE $${i} OR
          CAST(d.id AS text) ILIKE $${i}
        )`);
        vals.push(`%${search}%`);
        i++;
      }

      const sql = `
        SELECT
          d.id                    AS dossier_id,
          d.client_id,
          d.entreprise_id,
          d.statut,
          d.date_creation,
          d.date_creation_effective,
          d.derniere_modification,
          d.blocages,
          d.commission_partenaire_eur,
          c.prenom, c.nom, c.email, c.telephone,
          e.denomination AS entreprise_nom,
          e.forme        AS entreprise_forme,
          CASE 
            WHEN (e.service_paiement->>'statut') = 'Payé' THEN
              COALESCE((e.service_paiement->>'montant')::numeric, 0) * p.taux_commission / 100.0
            ELSE 0
          END AS commission_calculee,
          p.taux_commission
        FROM core.dossiers d
        JOIN core.clients     c ON c.id = d.client_id
        JOIN core.entreprises e ON e.id = d.entreprise_id
        JOIN core.partenaires p ON p.id = d.partenaire_id
        WHERE ${conds.join(" AND ")}
        ORDER BY d.date_creation DESC
        LIMIT $${i}
      `;
      vals.push(limit);

      const { rows } = await conn.query(sql, vals);
      return rows;
    });

    const clients = rows.map(r => ({
      id: r.client_id,
      dossier_id: r.dossier_id,
      entreprise_id: r.entreprise_id,
      nom: r.nom,
      prenom: r.prenom,
      email: r.email,
      telephone: r.telephone,
      statut: r.statut,
      date_creation: r.date_creation,
      date_creation_effective: r.date_creation_effective,
      derniere_modification: r.derniere_modification,
      blocages: r.blocages || [],
      commission: Number(r.commission_calculee) || Number(r.commission_partenaire_eur) || 0,
      taux_commission: Number(r.taux_commission) || 0,
      entreprise_nom: r.entreprise_nom,
      entreprise_forme: r.entreprise_forme,
      fullName: `${r.prenom ?? ""} ${r.nom ?? ""}`.trim(),
      hasBlocked: Array.isArray(r.blocages) && r.blocages.length > 0,
      isCompleted: r.statut === "valide",
      isRejected: r.statut === "rejete",
    }));

    return res.json({ clients });
  } catch (e) {
    console.error("GET /api/partenaires/:id/clients error:", e);
    next(e);
  }
}

// ---------- Interactions partenaire ----------

// GET /api/partenaires/:id/interactions
export async function listPartnerInteractions(req, res, next) {
  try {
    const partnerId = Number(req.params.id);
    if (!Number.isFinite(partnerId)) {
      return res.status(400).json({ error: "ID partenaire invalide" });
    }

    const limit = Number(req.query.limit || 50);
    const type  = req.query.type || null;

    const data = await withClient(async (conn) => {
      const { rows: partenaires } = await conn.query(
        `SELECT id, nom, referent FROM core.partenaires WHERE id = $1`,
        [partnerId]
      );
      if (!partenaires.length) return { notFound: true };

      let q = `
        SELECT 
          id, partner_id, date_interaction, type_interaction, direction,
          sujet, notes, participant, duree_minutes, statut,
          prochaine_action, rappel_date, created_by, created_at
        FROM core.partner_interactions
        WHERE partner_id = $1
      `;
      const params = [partnerId];
      let i = 2;
      if (type && type !== "all") {
        q += ` AND type_interaction = $${i++}`;
        params.push(type);
      }
      q += ` ORDER BY date_interaction DESC LIMIT $${i}`;
      params.push(limit);

      const { rows: interactions } = await conn.query(q, params);

      const { rows: prochaines } = await conn.query(
        `
        SELECT id, sujet, prochaine_action, rappel_date, type_interaction
        FROM core.partner_interactions
        WHERE partner_id = $1 
          AND prochaine_action IS NOT NULL 
          AND statut != 'termine'
          AND (rappel_date IS NULL OR rappel_date >= CURRENT_DATE)
        ORDER BY COALESCE(rappel_date, date_interaction) ASC
        LIMIT 10
        `,
        [partnerId]
      );

      const { rows: stats } = await conn.query(
        `
        SELECT 
          COUNT(*) as total_interactions,
          COUNT(CASE WHEN date_interaction >= NOW() - INTERVAL '30 days' THEN 1 END) as interactions_30j,
          COUNT(CASE WHEN type_interaction = 'appel' THEN 1 END) as nb_appels,
          COUNT(CASE WHEN type_interaction = 'reunion' THEN 1 END) as nb_reunions,
          COUNT(CASE WHEN prochaine_action IS NOT NULL AND statut != 'termine' THEN 1 END) as actions_en_attente,
          MAX(date_interaction) as derniere_interaction
        FROM core.partner_interactions
        WHERE partner_id = $1
        `,
        [partnerId]
      );

      const { rows: partnerUsers } = await conn.query(
        `SELECT nom, email, role FROM core.partner_users WHERE partner_id = $1 ORDER BY nom`,
        [partnerId]
      );

      const { rows: historicParticipants } = await conn.query(
        `
        SELECT DISTINCT participant
        FROM core.partner_interactions
        WHERE partner_id = $1 AND participant IS NOT NULL AND participant != ''
        ORDER BY participant
        `,
        [partnerId]
      );

      return {
        partenaire: partenaires[0],
        interactions,
        prochaines,
        stats: stats[0] || {},
        partnerUsers,
        historicParticipants,
      };
    });

    if (data?.notFound) return res.status(404).json({ error: "Partenaire introuvable" });

    const suggestedContacts = [];
    const referent = data.partenaire?.referent;
    if (referent?.nom) {
      suggestedContacts.push({
        nom: referent.nom,
        email: referent.email || "",
        type: "Référent principal",
        display: `${referent.nom}${referent.email ? ` (${referent.email})` : ""} - Référent`,
      });
    }
    for (const user of data.partnerUsers) {
      if (user.nom) {
        suggestedContacts.push({
          nom: user.nom,
          email: user.email || "",
          type: `Utilisateur ${user.role}`,
          display: `${user.nom}${user.email ? ` (${user.email})` : ""} - ${user.role}`,
        });
      }
    }
    const existing = new Set(suggestedContacts.map(c => c.nom?.toLowerCase?.() || ""));
    for (const p of data.historicParticipants) {
      const name = (p.participant || "").toLowerCase();
      if (name && !existing.has(name)) {
        suggestedContacts.push({
          nom: p.participant,
          email: "",
          type: "Contact historique",
          display: `${p.participant} - Contact historique`,
        });
      }
    }

    return res.json({
      partenaire: data.partenaire,
      interactions: data.interactions,
      prochaines_actions: data.prochaines,
      stats: data.stats,
      suggested_contacts: suggestedContacts,
      references: {
        types: [
          { value: "appel",   label: "Appel téléphonique" },
          { value: "email",   label: "Email" },
          { value: "reunion", label: "Réunion" },
          { value: "relance", label: "Relance commerciale" },
          { value: "note",    label: "Note interne" },
        ],
        directions: [
          { value: "entrant",        label: "Entrant" },
          { value: "sortant",        label: "Sortant" },
          { value: "bidirectionnel", label: "Bidirectionnel" },
        ],
      },
    });
  } catch (e) {
    console.error("Erreur GET interactions partenaire:", e);
    next(e);
  }
}

// POST /api/partenaires/:id/interactions
export async function createPartnerInteraction(req, res, next) {
  try {
    const partnerId = Number(req.params.id);
    if (!Number.isFinite(partnerId)) {
      return res.status(400).json({ error: "ID partenaire invalide" });
    }

    const {
      type_interaction,
      direction = "sortant",
      sujet,
      notes = "",
      participant = "",
      duree_minutes,
      prochaine_action = "",
      rappel_date,
      created_by = "Opérateur",
    } = req.body || {};

    const validTypes = ["appel", "email", "reunion", "relance", "note"];
    const validDirections = ["entrant", "sortant", "bidirectionnel"];

    if (!type_interaction || !validTypes.includes(type_interaction)) {
      return res.status(400).json({ error: "Type d'interaction invalide" });
    }
    if (!sujet || !sujet.trim()) {
      return res.status(400).json({ error: "Sujet requis" });
    }
    if (direction && !validDirections.includes(direction)) {
      return res.status(400).json({ error: "Direction invalide" });
    }

    const row = await withClient(async (conn) => {
      const { rows: partenaires } = await conn.query(
        `SELECT id FROM core.partenaires WHERE id = $1`,
        [partnerId]
      );
      if (!partenaires.length) return null;

      const { rows } = await conn.query(
        `
        INSERT INTO core.partner_interactions 
          (partner_id, type_interaction, direction, sujet, notes, participant, duree_minutes, prochaine_action, rappel_date, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING id, partner_id, date_interaction, type_interaction, direction, sujet, notes, participant, prochaine_action, rappel_date, created_by
        `,
        [
          partnerId,
          type_interaction,
          direction,
          sujet.trim(),
          notes.trim(),
          participant.trim(),
          duree_minutes ? parseInt(duree_minutes) : null,
          (prochaine_action || "").trim() || null,
          rappel_date || null,
          created_by,
        ]
      );
      return rows[0];
    });

    if (!row) return res.status(404).json({ error: "Partenaire introuvable" });

    return res.status(201).json({
      interaction: row,
      message: "Interaction créée avec succès",
    });
  } catch (e) {
    console.error("Erreur POST interaction partenaire:", e);
    next(e);
  }
}

// ---------- Factures: listing + PDF ----------

// GET /api/partenaires/:id/invoices
export async function listPartnerInvoices(req, res, next) {
  try {
    const partnerId = Number(req.params.id);
    if (!Number.isFinite(partnerId)) {
      return res.status(400).json({ error: "ID partenaire invalide" });
    }

    const rows = await withClient(async (conn) => {
      const { rows } = await conn.query(
        `
        SELECT id, montant, date, statut, periode, echeance, pdf
        FROM core.partner_invoices
        WHERE partenaire_id = $1
        ORDER BY periode DESC, date DESC
        `,
        [partnerId]
      );
      return rows;
    });

    return res.json({ invoices: rows });
  } catch (e) {
    console.error("Erreur GET invoices partenaire:", e);
    next(e);
  }
}

// GET /api/partenaires/:id/invoices/:invoiceId/pdf
export async function getInvoicePdf(req, res, next) {
  const partnerId = Number(req.params.id);
  const invoiceId = String(req.params.invoiceId || "");
  if (!Number.isFinite(partnerId) || !invoiceId) {
    return res.status(400).json({ error: "Paramètres manquants" });
  }

  try {
    const { invoice, periodData, companySettings } = await withClient(async (conn) => {
      const { rows: invoiceRows } = await conn.query(
        `
        SELECT 
          pi.*,
          p.nom AS partenaire_nom,
          p.coordonnees_facturation,
          p.paiement,
          p.taux_commission
        FROM core.partner_invoices pi
        JOIN core.partenaires p ON p.id = pi.partenaire_id
        WHERE pi.id = $1 AND pi.partenaire_id = $2
        `,
        [invoiceId, partnerId]
      );
      if (!invoiceRows.length) return { notFound: true };

      const invoice = invoiceRows[0];

      const { rows: periodRows } = await conn.query(
        `SELECT ca, dossiers, periode
           FROM core.partner_period_ca 
          WHERE partenaire_id = $1 AND periode = $2`,
        [partnerId, invoice.periode]
      );

      const { rows: companyRows } = await conn.query(
        `SELECT key, value FROM core.company_settings`
      );
      const companySettings = {};
      for (const r of companyRows) companySettings[r.key] = r.value;

      return { invoice, periodData: periodRows[0] || {}, companySettings };
    });

    if (invoice?.notFound) return res.status(404).json({ error: "Facture introuvable" });

    const html = generateInvoiceHTML({
      invoice,
      partenaire: {
        nom: invoice.partenaire_nom,
        coordonnees: invoice.coordonnees_facturation || {},
        paiement: invoice.paiement || {},
      },
      periodData,
      companySettings,
    });

    const { default: puppeteer } = await import("puppeteer");
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" },
    });
    await browser.close();

    // Marquer comme généré
    await withClient(conn =>
      conn.query(`UPDATE core.partner_invoices SET pdf = $1 WHERE id = $2`,
        [`generated_${Date.now()}`, invoiceId])
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="facture_${invoiceId}.pdf"`);
    return res.status(200).send(pdfBuffer);
  } catch (e) {
    console.error("Erreur génération PDF facture:", e);
    next(e);
  }
}

// Helper HTML (garde ton HTML complet existant)
function generateInvoiceHTML({ invoice, partenaire, periodData, companySettings }) {
  const formatDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "");
  const formatAmount = (a) =>
    Number(a || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `<!DOCTYPE html>...`; // <-- mets ici le HTML complet que tu avais déjà
}

// ---------- Vue d’ensemble + clôture mensuelle ----------

// GET /api/partenaires/:id
export async function getPartnerOverview(req, res, next) {
  const partnerId = Number(req.params?.id);
  if (!Number.isFinite(partnerId)) {
    return res.status(400).json({ error: "bad id" });
  }

  try {
    const payload = await withClient(async (conn) => {
      const { rows: pRows } = await conn.query(
        `
        SELECT id, nom, adresse, integration, type_facturation, taux_commission, segment,
               referent, contrat,
               COALESCE(paiement, '{}'::jsonb)                AS paiement,
               COALESCE(coordonnees_facturation, '{}'::jsonb) AS coordonnees_facturation,
               COALESCE(docs, '{}'::jsonb)                    AS docs,
               COALESCE(ca_total, 0)                          AS ca_total,
               COALESCE(commissions_total, 0)                 AS commissions_total
        FROM core.partenaires
        WHERE id = $1
        `,
        [partnerId]
      );
      if (!pRows.length) return { notFound: true };
      const partenaire = pRows[0];
      const taux = Number(partenaire.taux_commission || 0);

      const { rows: colCheck } = await conn.query(
        `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'core'
          AND table_name   = 'partner_period_ca'
          AND column_name  = 'commissions'
        LIMIT 1
        `
      );
      const hasCommissionsColumn = colCheck.length > 0;

      const aggSql = `
        SELECT
          COALESCE(SUM(ca), 0)::numeric AS ca_total_calc,
          COALESCE(SUM(
            ${hasCommissionsColumn ? "commissions" : "(ca * $2::numeric / 100.0)"}
          ), 0)::numeric AS commissions_total_calc
        FROM core.partner_period_ca
        WHERE partenaire_id = $1
      `;
      const aggParams = hasCommissionsColumn ? [partnerId] : [partnerId, taux];
      const { rows: agg } = await conn.query(aggSql, aggParams);
      const { ca_total_calc = 0, commissions_total_calc = 0 } = agg[0] || {};

      partenaire.ca_total = Number(ca_total_calc);
      partenaire.commissions_total = Number(commissions_total_calc);

      let ca_par_periode = [];
      if (hasCommissionsColumn) {
        const { rows } = await conn.query(
          `
          SELECT
            ppc.periode,
            COALESCE(ppc.ca, 0)::numeric          AS ca,
            COALESCE(ppc.dossiers, 0)::int        AS dossiers,
            COALESCE(ppc.commissions, 0)::numeric AS commissions
          FROM core.partner_period_ca ppc
          WHERE ppc.partenaire_id = $1
          ORDER BY ppc.periode ASC
          `,
          [partnerId]
        );
        ca_par_periode = rows;
      } else {
        const { rows } = await conn.query(
          `
          SELECT
            periode,
            COALESCE(ca, 0)::numeric AS ca,
            COALESCE(dossiers, 0)::int AS dossiers,
            NULL::numeric AS commissions
          FROM core.partner_period_ca
          WHERE partenaire_id = $1
          ORDER BY periode ASC
          `,
          [partnerId]
        );
        ca_par_periode = rows;
      }

      const { rows: factures } = await conn.query(
        `
        SELECT id, montant, date, statut, periode, echeance, pdf
        FROM core.partner_invoices
        WHERE partenaire_id = $1
        ORDER BY periode DESC, date DESC
        `,
        [partnerId]
      );

      const { rows: partner_users } = await conn.query(
        `
        SELECT id, email, nom, role, two_fa_enabled, last_login_at
        FROM core.partner_users
        WHERE partner_id = $1
        ORDER BY email
        `,
        [partnerId]
      );

      const { rows: dossiers } = await conn.query(
        `
        SELECT id, statut, client_id, entreprise_id, blocages, date_creation, derniere_modification
        FROM core.dossiers
        WHERE partenaire_id = $1
        ORDER BY date_creation DESC
        `,
        [partnerId]
      );

      const { rows: partner_exports_history } = await conn.query(
        `
        SELECT id, format, filtres, generated_at, file
        FROM core.partner_exports_history
        WHERE partner_id = $1
        ORDER BY generated_at DESC
        `,
        [partnerId]
      );

      return {
        partenaire,
        ca_par_periode,
        factures,
        partner_users,
        dossiers,
        partner_exports_history,
      };
    });

    if (payload?.notFound) return res.status(404).json({ error: "not found" });

    const sum = (xs, key) => xs.reduce((s, x) => s + Number(x?.[key] || 0), 0);
    const derived_totals = {
      ca_total: sum(payload.ca_par_periode, "ca"),
      commissions_total: sum(payload.ca_par_periode, "commissions"),
      dossiers_payes: sum(payload.ca_par_periode, "dossiers"),
    };

    return res.json({
      ...payload,
      derived_totals,
    });
  } catch (e) {
    console.error("GET /api/partenaires/:id failed:", e);
    next(e);
  }
}

// Helpers
function bounds(periode /* "YYYY-MM" */) {
  const [y, m] = (periode || "").split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const nextStart = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1));
  return {
    startISO: start.toISOString().slice(0, 10),
    nextStartISO: nextStart.toISOString().slice(0, 10),
  };
}
function endOfPeriodISO(periode) {
  const y = Number(periode.slice(0, 4));
  const m = Number(periode.slice(5, 7));
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
}
function genInvoiceId(partnerId, periode) {
  const rnd = Math.floor(100000 + Math.random() * 900000);
  return `F${periode.replace("-", "")}-${partnerId}-${rnd}`;
}

/** POST /api/partenaires/close-month
 *  Body: { partnerId: number, period?: "YYYY-MM" }
 *  - si period absent => mois précédent
 */
export async function postCloseMonth(req, res, next) {
  try {
    const { payload, result } = await withClient(async (client) => {
      const body = req.body || {};
      let { period, partnerId } = body;

      if (!period) {
        const now = new Date();
        const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
        period = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
      }
      if (!partnerId || !Number.isFinite(Number(partnerId))) {
        return { bad: { code: 400, error: "partnerId requis" } };
      }
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
        return { bad: { code: 400, error: "period doit être 'YYYY-MM'" } };
      }
      partnerId = Number(partnerId);

      await client.query("BEGIN");

      const { rows: pRows } = await client.query(
        `SELECT taux_commission FROM core.partenaires WHERE id=$1`,
        [partnerId]
      );
      if (!pRows.length) {
        await client.query("ROLLBACK");
        return { bad: { code: 404, error: "partenaire introuvable" } };
      }
      const rate = Number(pRows[0].taux_commission || 0) / 100;

      const { startISO, nextStartISO } = bounds(period);
      const { rows: dossiers } = await client.query(
        `
        SELECT COALESCE((e.service_paiement->>'montant')::numeric,0) AS fee_eur
        FROM core.dossiers d
        JOIN core.entreprises e ON e.id = d.entreprise_id
        WHERE d.partenaire_id = $1
          AND (e.service_paiement->>'statut') = 'Payé'
          AND COALESCE(d.date_creation_effective, d.date_creation) >= $2::date
          AND COALESCE(d.date_creation_effective, d.date_creation) <  $3::date
        `,
        [partnerId, startISO, nextStartISO]
      );
      const ca = dossiers.reduce((s, d) => s + Number(d.fee_eur || 0), 0);
      const dossiersCount = dossiers.length;
      const commission = Math.round(ca * rate * 100) / 100;

      await client.query(
        `
        INSERT INTO core.partner_period_ca (partenaire_id, periode, ca, dossiers)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (partenaire_id, periode)
        DO UPDATE SET ca = EXCLUDED.ca, dossiers = EXCLUDED.dossiers
        `,
        [partnerId, period, ca, dossiersCount]
      );

      const invoiceDateISO = endOfPeriodISO(period);
      const { rows: existing } = await client.query(
        `SELECT id FROM core.partner_invoices WHERE partenaire_id=$1 AND periode=$2`,
        [partnerId, period]
      );
      const invoiceId = existing[0]?.id ?? genInvoiceId(partnerId, period);

      await client.query(
        `
        INSERT INTO core.partner_invoices (id, partenaire_id, montant, date, statut, periode, echeance, pdf)
        VALUES ($1,$2,$3,$4,'payee',$5,$4,NULL)
        ON CONFLICT (partenaire_id, periode)
        DO UPDATE SET montant=EXCLUDED.montant, date=EXCLUDED.date, statut='payee', echeance=EXCLUDED.echeance
        `,
        [invoiceId, partnerId, commission, invoiceDateISO, period]
      );

      await client.query("COMMIT");

      return {
        result: {
          ok: true,
          period,
          partnerId,
          ca,
          dossiers: dossiersCount,
          commission,
          invoiceId,
          statut: "payee",
          date: invoiceDateISO,
        }
      };
    });

    if (payload?.bad) {
      return res.status(payload.bad.code).json({ error: payload.bad.error });
    }
    return res.json(result);
  } catch (e) {
    console.error("close-month error:", e);
    next(e);
  }
}

export async function postPartnerInvoices(req, res, next) {
  try {
    const partnerId = Number(req.params.id);
    if (!Number.isFinite(partnerId)) {
      return res.status(400).json({ error: "bad id" });
    }

    const body = req.body || {};
    const period = body.period || body.periode;
    const rate   = body.rate ?? null;

    if (!period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      return res.status(400).json({ error: "period must be 'YYYY-MM'" });
    }

    // action: "preview" | "create"  (prioritaire) ; sinon dryRun bool
    const dryRun = (body.dryRun !== undefined)
      ? Boolean(body.dryRun)
      : (body.action === "preview");

    const result = await previewOrCreateInvoice({
      partnerId,
      periode: period,
      rate,
      dryRun,
    });

    return res.status(dryRun ? 200 : 201).json(result);
  } catch (e) {
    console.error("invoice POST error:", e);
    next(e);
  }
}
