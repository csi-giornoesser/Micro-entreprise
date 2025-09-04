// app/api/dossiers/route.ts
import { proxyRequest } from "../_lib/proxy";

export async function GET(req: Request) {
  return proxyRequest(req, "/api/dossiers");
}
