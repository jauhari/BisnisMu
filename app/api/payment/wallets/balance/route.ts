import { handleApi } from "@/presentation/api/route-handler";
import { serverServices } from "@/presentation/api/server-services";
import { paymentCommand } from "../../_helpers";

export async function POST(request: Request) {
  return handleApi(async () => ({ balance: (await serverServices.payment.getWalletBalance(await paymentCommand(request) as any)).toString() }));
}
