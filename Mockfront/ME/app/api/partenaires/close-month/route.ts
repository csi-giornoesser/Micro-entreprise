// app/api/partenaires/close-month/route.ts
import { proxyRequest } from "../../_lib/proxy";

export async function POST(req: Request) {
  return proxyRequest(req, "/api/partenaires/close-month");
}
