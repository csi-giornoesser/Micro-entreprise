import { proxyRequest } from "../../_lib/proxy";

// Conserve les query params (status, partnerId, operatorId, from, to, format)
export async function GET(req: Request) {
  return proxyRequest(req, "/api/exports/dossiers");
}

export async function POST(req: Request) {
  return proxyRequest(req, "/api/exports/dossiers");
}
