import { prisma } from "@/presentation/api/prisma";
import { handleApi } from "@/presentation/api/route-handler";
import { requireGodModeContext } from "@/presentation/auth/session";
import {
  RESET_GROUPS,
  expandGroups,
  isValidGroup,
  resetBusinessData,
  type ResetGroupKey,
} from "@/presentation/admin/reset-data";

function clientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return request.headers.get("x-real-ip");
}

/** Metadata grup + daftar bisnis untuk halaman reset. */
export async function GET(request: Request) {
  return handleApi(async () => {
    await requireGodModeContext(request);
    const businesses = await prisma.business.findMany({
      select: { id: true, name: true, type: true, status: true },
      orderBy: { name: "asc" },
    });
    return { groups: RESET_GROUPS, businesses };
  });
}

/** Eksekusi reset data — HANYA SUPER_ADMIN. */
export async function POST(request: Request) {
  return handleApi(async () => {
    // requireGodModeContext default hanya mengizinkan SUPER_ADMIN, sehingga
    // SUPPORT_AGENT/DEVELOPER (yang lolos middleware God Mode) tetap ditolak
    // untuk aksi destruktif ini.
    const ctx = await requireGodModeContext(request);

    const body = await request.json() as {
      businessId?: unknown;
      groups?: unknown;
      confirmName?: unknown;
      dryRun?: unknown;
    };

    const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
    const confirmName = typeof body.confirmName === "string" ? body.confirmName.trim() : "";
    const rawGroups = Array.isArray(body.groups) ? body.groups : [];
    const dryRun = body.dryRun === true;

    if (!businessId) throw new Error("businessId wajib diisi.");

    const invalid = rawGroups.filter((g) => typeof g !== "string" || !isValidGroup(g));
    if (invalid.length) throw new Error(`Grup tidak dikenal: ${invalid.join(", ")}`);
    const groups = rawGroups as ResetGroupKey[];
    if (groups.length === 0) throw new Error("Pilih minimal satu kategori data untuk direset.");

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true },
    });
    if (!business) throw new Error("Bisnis tidak ditemukan.");

    const expandedGroups = expandGroups(groups);

    // ── Pratinjau (dry-run): hitung tanpa menghapus, tanpa konfirmasi/audit. ──
    if (dryRun) {
      let preview;
      try {
        preview = await resetBusinessData(prisma, businessId, groups, { dryRun: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Pratinjau gagal.";
        throw new Error(
          `Kombinasi kategori ini tidak konsisten: ada data lain yang masih mengacu ke data yang ingin dihapus. Detail: ${message}`,
        );
      }
      return {
        dryRun: true,
        businessId,
        businessName: business.name,
        requestedGroups: groups,
        executedGroups: preview.executedGroups,
        autoIncluded: expandedGroups.filter((g) => !groups.includes(g)),
        deletedByTable: preview.deletedByTable,
        totalDeleted: preview.totalDeleted,
      };
    }

    // ── Eksekusi nyata: wajib konfirmasi nama bisnis. ──
    if (confirmName !== business.name) {
      throw new Error("Konfirmasi gagal: ketik nama bisnis dengan tepat untuk melanjutkan.");
    }

    let result;
    try {
      result = await resetBusinessData(prisma, businessId, groups);
    } catch (err) {
      // Pelanggaran FK (subset grup tidak konsisten) -> transaksi rollback, tidak ada data terhapus.
      const message = err instanceof Error ? err.message : "Reset gagal.";
      throw new Error(
        `Reset dibatalkan, tidak ada data yang dihapus. Kemungkinan ada data yang masih mengacu ke data yang ingin dihapus. Detail: ${message}`,
      );
    }

    await prisma.godModeAuditLog.create({
      data: {
        actorId: ctx.actorUserId,
        action: "BUSINESS_DATA_RESET",
        targetType: "business",
        targetId: businessId,
        detail: {
          businessName: business.name,
          requestedGroups: groups,
          executedGroups: result.executedGroups,
          deletedByTable: result.deletedByTable,
          totalDeleted: result.totalDeleted,
        },
        ipAddress: clientIp(request),
      },
    });

    return {
      businessId,
      businessName: business.name,
      requestedGroups: groups,
      executedGroups: result.executedGroups,
      autoIncluded: expandedGroups.filter((g) => !groups.includes(g)),
      deletedByTable: result.deletedByTable,
      totalDeleted: result.totalDeleted,
    };
  });
}
