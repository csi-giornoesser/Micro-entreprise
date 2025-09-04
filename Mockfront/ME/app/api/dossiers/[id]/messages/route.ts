// app/api/dossiers/[id]/messages/route.ts
import { proxyRequest } from "../../../_lib/proxy";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyRequest(req, `/api/dossiers/${id}/messages`);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyRequest(req, `/api/dossiers/${id}/messages`);
}
