// crm-backend/src/lib/actor.js

// Convertit proprement une valeur header en entier ou null
function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Récupère un header (Express: req.headers['x-...'])
function getHeader(req, name) {
  if (!req || !req.headers) return null;
  const v = req.headers[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v ?? null;
}

/**
 * getActor(req)
 * Détermine le "contexte acteur" (role/partnerId/clientId) à partir des headers.
 * Headers supportés:
 *   - x-role:          admin | operator | partner_user | client_user
 *   - x-partner-id:    entier
 *   - x-client-id:     entier
 *
 * Par défaut role=admin si absent (utile pour le CRM interne).
 */
export function getActor(req) {
  const rawRole = (getHeader(req, "x-role") || "admin").toString().toLowerCase();

  const allowed = new Set(["admin", "operator", "partner_user", "client_user"]);
  const role = allowed.has(rawRole) ? rawRole : "admin";

  const partnerId = toInt(getHeader(req, "x-partner-id"));
  const clientId  = toInt(getHeader(req, "x-client-id"));

  return { role, partnerId, clientId };
}

/**
 * Middleware optionnel: ajoute req.actor
 * (tu peux l'utiliser si tu veux éviter d’appeler getActor(req) partout)
 */
export function actorMiddleware(req, _res, next) {
  req.actor = getActor(req);
  next();
}
