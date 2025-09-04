// app/api/tickets/route.ts
import { proxyRequest } from "../_lib/proxy";

export async function GET(req: Request) {
  return proxyRequest(req, "/api/tickets");
}

export async function POST(req: Request) {
  return proxyRequest(req, "/api/tickets");
}
