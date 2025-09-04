import { proxyRequest } from "../../../_lib/proxy";

// proxyRequest conserve les query params (search, statut, dateDebut, dateFin, showBlocked, commission, limit)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyRequest(req, `/api/partenaires/${id}/clients`);
}
