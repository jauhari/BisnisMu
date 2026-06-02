import { handleApi } from "@/presentation/api/route-handler";
import { floatTransactionSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await validatedBody(request, floatTransactionSchema) as any;
    switch (body.type) {
      case "CONSUME":
        return serverServices.float.consumeFloat(body);
      case "TRANSFER":
        return serverServices.float.transferFloat(body);
      case "ADJUSTMENT":
        return serverServices.float.adjustFloat(body);
      case "TOPUP":
      default:
        return serverServices.float.topupFloat(body);
    }
  });
}
