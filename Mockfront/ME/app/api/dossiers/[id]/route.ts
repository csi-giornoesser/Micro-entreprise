// app/api/dossiers/[id]/route.ts
import { proxyRequest } from "../../_lib/proxy";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyRequest(req, `/api/dossiers/${id}`);
}
