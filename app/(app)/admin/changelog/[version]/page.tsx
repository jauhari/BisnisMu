import { readChangelogFromRepo } from "@/presentation/changelog/changelog";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassPanel } from "@/components/glass/glass-primitives";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ version: string }>;
}

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
        <code key={index} className="mx-0.5 rounded bg-black/5 px-1.5 py-0.5 font-mono text-[11px] text-accent dark:bg-white/5">
          {codeText}
        </code>
      );
    }
    return part;
  });
}

function getSectionStyle(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("added")) {
    return {
      borderColor: "border-success/40",
      badgeBg: "bg-success/10 text-success dark:bg-success/20",
      label: "Added"
    };
  }
  if (lower.includes("fixed")) {
    return {
      borderColor: "border-accent/40",
      badgeBg: "bg-accent/10 text-accent dark:bg-accent/20",
      label: "Fixed"
    };
  }
  if (lower.includes("changed")) {
    return {
      borderColor: "border-purple-500/40",
      badgeBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 dark:bg-purple-500/20",
      label: "Changed"
    };
  }
  return {
    borderColor: "border-border/60",
    badgeBg: "bg-muted/10 text-muted",
    label: "Info"
  };
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
          className="rounded-lg border border-border/40 bg-white/40 px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-white/80 hover:text-foreground dark:bg-white/5 dark:hover:bg-white/10"
        >
          ← Kembali ke daftar
        </Link>
      </div>

      <div className="grid gap-4">
        {v.sections.map((sec, idx) => {
          const style = getSectionStyle(sec.title);
          return (
            <GlassPanel key={idx} className={`border-l-4 ${style.borderColor} p-5 transition hover:shadow-md`}>
              <div className="flex items-center gap-2 mb-4">
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.badgeBg}`}>
                  {style.label}
                </span>
                <h3 className="text-[15px] font-bold text-foreground/90">
                  {sec.title.replace(/^(added|fixed|changed|removed)\s*—\s*/i, "")}
                </h3>
              </div>
              <ul className="space-y-3 pl-1">
                {sec.bullets.map((bullet, bIdx) => (
                  <li key={bIdx} className="relative flex items-start gap-2 text-[13px] text-muted leading-relaxed">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
                    <span>{renderFormattedText(bullet)}</span>
                  </li>
                ))}
              </ul>
            </GlassPanel>
          );
        })}
      </div>
    </div>
  );
}

