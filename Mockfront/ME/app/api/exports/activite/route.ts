import { proxyRequest } from "../../_lib/proxy";

// proxyRequest conserve les query params (from, to, type, format)
export async function GET(req: Request) {
  return proxyRequest(req, "/api/exports/activite");
}
