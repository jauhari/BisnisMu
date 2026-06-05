import { readChangelogFromRepo } from "@/presentation/changelog/changelog";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassPanel } from "@/components/glass/glass-primitives";
import Link from "next/link";

export default async function Page() {
  const changelog = await readChangelogFromRepo();

  return (
    <div className="grid gap-6">
      <WorkspaceHeader
        eyebrow="Sistem"
        title="Changelog"
        description="Riwayat perubahan dan pembaruan aplikasi BisnisMu."
      />

      <div className="grid gap-4">
        {changelog.versions.map((v) => (
          <GlassPanel key={v.version} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between border-b border-border/60 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-accent">v{v.version}</span>
                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
                  Rilis
                </span>
              </div>
              {v.date && <span className="text-xs text-muted">{v.date}</span>}
            </div>

            <div className="space-y-3">
              {v.sections.map((sec, idx) => (
                <div key={idx} className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground/80">{sec.title}</h3>
                  <ul className="list-inside list-disc pl-1 space-y-0.5">
                    {sec.bullets.slice(0, 3).map((bullet, bIdx) => (
                      <li key={bIdx} className="text-xs text-muted truncate">
                        {bullet}
                      </li>
                    ))}
                    {sec.bullets.length > 3 && (
                      <li className="text-[11px] text-muted/60 list-none pl-4">
                        + {sec.bullets.length - 3} item lainnya...
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-2 flex justify-end">
              <Link
                href={`/admin/changelog/${v.version}`}
                className="text-xs font-medium text-accent hover:underline"
              >
                Lihat rincian lengkap →
              </Link>
            </div>
          </GlassPanel>
        ))}
      </div>
    </div>
  );
}
