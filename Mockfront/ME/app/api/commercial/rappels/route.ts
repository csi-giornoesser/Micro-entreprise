import { proxyRequest } from "../../_lib/proxy";

export async function GET(req: Request) {
  return proxyRequest(req, "/api/commercial/rappels");
}

export async function POST(req: Request) {
  return proxyRequest(req, "/api/commercial/rappels");
}
