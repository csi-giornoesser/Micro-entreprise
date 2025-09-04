import { proxyRequest } from "../../_lib/proxy";

export async function GET(
  req: Request,
  context: any
) {
  return proxyRequest(req, `/api/clients/${context.params.id}`);
}
