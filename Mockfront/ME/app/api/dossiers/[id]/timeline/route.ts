// app/api/dossiers/[id]/timeline/route.ts
import { proxyRequest } from "../../../_lib/proxy";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyRequest(req, `/api/dossiers/${id}/timeline`);
}
