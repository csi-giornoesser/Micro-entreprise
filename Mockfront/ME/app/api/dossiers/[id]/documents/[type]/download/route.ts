// app/api/dossiers/[id]/documents/[type]/download/route.ts
import { proxyRequest } from '../../../../../_lib/proxy';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  const { id, type } = await params;
  return proxyRequest(req, `/api/dossiers/${id}/documents/${type}/download`);
}
