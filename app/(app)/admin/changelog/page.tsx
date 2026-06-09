import { readChangelogFromRepo } from "@/presentation/changelog/changelog";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassPanel } from "@/components/glass/glass-primitives";
import Link from "next/link";

function renderFormattedText(text: string) {
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  const splitParts = text.split(regex);
  
  return splitParts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const boldText = part.slice(2, -2).replace(/^["']|["']$/g, '');
      return (
        <strong key={index} className="font-semibold text-foreground/90">
          {boldText}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      const codeText = part.slice(1, -1);
      return (
        <code key={index} className="mx-0.5 rounded bg-black/5 px-1.5 py-0.5 font-mono text-xs text-accent break-words dark:bg-white/5">
          {codeText}
        </code>
      );
    }
    return part;
  });
}

function getSectionBadge(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("added")) {
    return "bg-success/10 text-success dark:bg-success/20";
  }
  if (lower.includes("fixed")) {
    return "bg-accent/10 text-accent dark:bg-accent/20";
  }
  if (lower.includes("changed")) {
    return "bg-purple-500/10 text-purple-600 dark:text-purple-400 dark:bg-purple-500/20";
  }
  return "bg-muted/10 text-muted";
}

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
          <GlassPanel key={v.version} className="flex flex-col gap-4 p-5 transition hover:shadow-md">
            <div className="flex items-baseline justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-accent">v{v.version}</span>
                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent dark:bg-accent/20">
                  Rilis
                </span>
              </div>
              {v.date && <span className="text-xs text-muted">{v.date}</span>}
            </div>

            <div className="space-y-4">
              {v.sections.map((sec, idx) => {
                const badgeClass = getSectionBadge(sec.title);
                return (
                  <div key={idx} className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}>
                        {sec.title.split("—")[0]?.trim() || "Info"}
                      </span>
                      <h3 className="text-sm font-semibold text-foreground/80">
                        {sec.title.replace(/^(added|fixed|changed|removed)\s*—\s*/i, "")}
                      </h3>
                    </div>
                    <ul className="space-y-1.5 pl-1">
                      {sec.bullets.slice(0, 3).map((bullet, bIdx) => (
                        <li key={bIdx} className="flex items-start gap-2 text-sm leading-relaxed text-muted">
                          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent/60" />
                          <span className="min-w-0 break-words">{renderFormattedText(bullet)}</span>
                        </li>
                      ))}
                      {sec.bullets.length > 3 && (
                        <li className="pl-3 text-xs text-muted/60">
                          + {sec.bullets.length - 3} item lainnya...
                        </li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 flex justify-end">
              <Link
                href={`/admin/changelog/${v.version}`}
                className="text-xs font-medium text-accent hover:underline flex items-center gap-0.5"
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

