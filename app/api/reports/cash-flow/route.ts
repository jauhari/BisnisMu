import { handleApi } from "@/presentation/api/route-handler";
import { reportRequestSchema } from "@/presentation/api/request-schemas";
import { parseAndValidate } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await parseAndValidate(request, reportRequestSchema);
    const tenant = await requireTenantContext(request);
    const command = {
      businessId: tenant.businessId,
      actorUserId: tenant.actorUserId,
      ...(body.command.startsOn ? { startsOn: body.command.startsOn } : {}),
      ...(body.command.endsOn ? { endsOn: body.command.endsOn } : {}),
      ...(body.command.asOf ? { asOf: body.command.asOf } : {}),
    };
    return serverServices.reporting.generateCashFlow(command);
  });
}
