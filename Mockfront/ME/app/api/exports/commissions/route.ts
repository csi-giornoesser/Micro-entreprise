import { proxyRequest } from "../../_lib/proxy";

// Conserve tous les query params (partnerId, from, to, format, groupBy…)
export async function GET(req: Request) {
  return proxyRequest(req, "/api/exports/commissions");
}
