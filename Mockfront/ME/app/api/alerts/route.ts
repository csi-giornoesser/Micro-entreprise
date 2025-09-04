import { proxyGET } from "../_lib/proxy";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return proxyGET(req, "/api/alerts");
}
