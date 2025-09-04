import { proxyRequest } from "../_lib/proxy";

export async function POST(req: Request) {
  return proxyRequest(req, "/api/notifications");
}
