export type ChangelogSection = { title: string; bullets: string[] };
export type ChangelogVersion = { version: string; date: string | null; sections: ChangelogSection[]; raw: string };
export type ChangelogDoc = { versions: ChangelogVersion[] };

export function parseChangelog(markdown: string): ChangelogDoc {
  const lines = markdown.split(/\r?\n/);
  const versions: ChangelogVersion[] = [];

  const versionRe = /^##\s+\[(.+?)\]\s*(?:-\s*([0-9]{4}-[0-9]{2}-[0-9]{2}))?\s*$/;
  const sectionRe = /^###\s+(.+?)\s*$/;
  const bulletRe = /^\s*-\s+(.+?)\s*$/;

  let current: ChangelogVersion | null = null;
  let currentSection: ChangelogSection | null = null;
  const rawLines: string[] = [];

  function flushSection() {
    if (!current || !currentSection) return;
    if (currentSection.title.trim() || currentSection.bullets.length) current.sections.push(currentSection);
    currentSection = null;
  }

  function flushVersion() {
    if (!current) return;
    flushSection();
    current.raw = rawLines.join("\n").trim();
    versions.push(current);
    current = null;
    rawLines.length = 0;
  }

  for (const line of lines) {
    const v = versionRe.exec(line);
    if (v) {
      const version = v[1];
      if (!version) continue;
      flushVersion();
      current = { version: version.trim(), date: v[2] ?? null, sections: [], raw: "" };
      continue;
    }

    if (!current) continue;

    rawLines.push(line);

    const s = sectionRe.exec(line);
    if (s) {
      const title = s[1];
      if (!title) continue;
      flushSection();
      currentSection = { title: title.trim(), bullets: [] };
      continue;
    }

    const b = bulletRe.exec(line);
    if (b) {
      const bullet = b[1];
      if (!bullet) continue;
      if (!currentSection) currentSection = { title: "", bullets: [] };
      currentSection.bullets.push(bullet.trim());
    }
  }

  flushVersion();
  return { versions };
}

export async function readChangelogFromRepo(): Promise<ChangelogDoc> {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const md = await readFile(join(process.cwd(), "CHANGELOG.md"), "utf8");
  return parseChangelog(md);
}
