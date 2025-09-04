// app/api/dossiers/[id]/pieces/[piece_key]/upload/route.ts
import { proxyRequest } from "../../../../../_lib/proxy";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; piece_key: string }> }
) {
  const { id, piece_key } = await params;
  return proxyRequest(req, `/api/dossiers/${id}/pieces/${piece_key}/upload`);
}
