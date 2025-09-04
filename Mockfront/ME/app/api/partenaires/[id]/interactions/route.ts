// app/api/partenaires/[id]/interactions/route.ts
import { proxyRequest } from "../../../_lib/proxy";

// conserve ?limit=&type=
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyRequest(req, `/api/partenaires/${id}/interactions`);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyRequest(req, `/api/partenaires/${id}/interactions`);
}
