// app/api/_lib/proxy.ts

/**
 * Proxy helper pour relayer une requête Next.js vers l'API Express.
 * - récupère la base URL depuis API_INTERNAL_URL ou NEXT_PUBLIC_API_URL
 * - fusionne les query params entrants
 * - propage headers/cookies (en nettoyant ceux interdits)
 * - retourne la réponse (stream) telle quelle
 */

function getApiBase(): string {
  const base =
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "";

  if (!base) {
    throw new Error(
      "API_INTERNAL_URL (ou NEXT_PUBLIC_API_URL) manquant dans l'environnement"
    );
  }

  let u: URL;
  try {
    u = new URL(base.startsWith("http") ? base : `http://${base}`);
  } catch {
    throw new Error(`API base URL invalide: "${base}"`);
  }
  return u.toString().replace(/\/+$/, "");
}

function mergeQuery(to: URL, from: URL) {
  from.searchParams.forEach((v, k) => {
    if (!to.searchParams.has(k)) to.searchParams.set(k, v);
  });
}

function passthroughRequestHeaders(req: Request, extra?: HeadersInit): Headers {
  const out = new Headers(extra);

  // <-- ancien: for (const [k, v] of req.headers.entries()) { ... }
  req.headers.forEach((v, k) => {
    const key = k.toLowerCase();
    if (["host", "content-length", "connection"].includes(key)) return;
    if (!out.has(k)) out.set(k, v);
  });

  return out;
}
function passthroughResponseHeaders(h: Headers): Headers {
  const out = new Headers();

  // <-- ancien: for (const [k, v] of h.entries()) { ... }
  h.forEach((v, k) => {
    const key = k.toLowerCase();
    if (["transfer-encoding", "connection"].includes(key)) return;
    out.set(k, v);
  });

  return out;
}

export async function proxyRequest(
  req: Request,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const base = getApiBase();

  const target = new URL(
    path.startsWith("/") ? `${base}${path}` : `${base}/${path}`
  );

  const incoming = new URL(req.url);
  mergeQuery(target, incoming);

  const method = (init?.method || req.method || "GET").toUpperCase();

  let body: BodyInit | undefined = init?.body;
  if (!body && method !== "GET" && method !== "HEAD") {
    const ab = await req.arrayBuffer().catch(() => null);
    if (ab) body = ab;
  }

  const headers = passthroughRequestHeaders(req, init?.headers);

  const resp = await fetch(target.toString(), {
    method,
    headers,
    body,
    redirect: "manual",
  });

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: passthroughResponseHeaders(resp.headers),
  });
}

/* Helpers pratiques */
export const proxyGET = (req: Request, path: string) =>
  proxyRequest(req, path, { method: "GET" });

export const proxyPOST = (req: Request, path: string, body?: any) =>
  proxyRequest(req, path, {
    method: "POST",
    body:
      body instanceof Uint8Array || typeof body === "string"
        ? (body as any)
        : body != null
        ? JSON.stringify(body)
        : undefined,
    headers: body != null ? { "content-type": "application/json" } : undefined,
  });

export const proxyPATCH = (req: Request, path: string, body?: any) =>
  proxyRequest(req, path, { method: "PATCH", body: body != null ? JSON.stringify(body) : undefined, headers: body != null ? { "content-type": "application/json" } : undefined });
