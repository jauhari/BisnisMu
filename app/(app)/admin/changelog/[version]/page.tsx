import { readChangelogFromRepo } from "@/presentation/changelog/changelog";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassPanel } from "@/components/glass/glass-primitives";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ version: string }>;
}

export default async function Page({ params }: PageProps) {
  const { version } = await params;
  const changelog = await readChangelogFromRepo();
  const v = changelog.versions.find((x) => x.version === version);

  if (!v) {
    notFound();
  }

  return (
    <div className="grid gap-6">
      <WorkspaceHeader
        eyebrow="Changelog"
        title={`Versi ${v.version}`}
        description={v.date ? `Dirilis pada ${v.date}` : "Tanggal rilis tidak tersedia"}
      />

      <div className="flex items-center gap-2">
        <Link
          href="/admin/changelog"
          className="text-xs font-medium text-muted hover:text-foreground hover:underline"
        >
          ← Kembali ke daftar
        </Link>
      </div>

      <GlassPanel className="grid gap-6">
        {v.sections.map((sec, idx) => (
          <div key={idx} className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground/90 border-b border-border/40 pb-1">
              {sec.title}
            </h3>
            <ul className="list-inside list-disc pl-2 space-y-1">
              {sec.bullets.map((bullet, bIdx) => (
                <li key={bIdx} className="text-xs text-muted leading-relaxed">
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </GlassPanel>
    </div>
  );
}
