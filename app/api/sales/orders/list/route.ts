import { handleApi } from "@/presentation/api/route-handler";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";

export async function GET(request: Request) {
  return handleApi(async () => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search") ?? undefined;
    const sortBy = (url.searchParams.get("sortBy") as "saleDate" | "salesNumber" | "totalAmount" | null) ?? undefined;
    const sortOrder = (url.searchParams.get("sortOrder") as "asc" | "desc" | null) ?? undefined;
    const page = url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined;
    const pageSize = url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : undefined;
    const input: Record<string, unknown> = {};
    if (search !== undefined) input.search = search;
    if (sortBy !== undefined) input.sortBy = sortBy;
    if (sortOrder !== undefined) input.sortOrder = sortOrder;
    if (page !== undefined) input.page = page;
    if (pageSize !== undefined) input.pageSize = pageSize;
    return serverServices.sales.repo.listSalesOrders(await requireTenantContext(request) as any, input as any);
  });
}
