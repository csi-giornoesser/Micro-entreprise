// app/api/partenaires/[id]/invoices/[invoiceId]/pdf/route.ts
import { proxyRequest } from "../../../../../_lib/proxy";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  const { id, invoiceId } = await params;
  return proxyRequest(req, `/api/partenaires/${id}/invoices/${invoiceId}/pdf`);
}
