# Changelog Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah halaman Changelog (index + detail per versi) berbasis `CHANGELOG.md`, hanya untuk akun God Mode, dengan tautan kecil di footer sidebar.

**Architecture:** Server pages membaca dan mem-parse `CHANGELOG.md` menjadi struktur versi/section/bullet. Route `/admin/changelog` menampilkan daftar versi dan ringkasan, route `/admin/changelog/[version]` menampilkan detail 1 versi. Link “Changelog” muncul di footer sidebar hanya untuk platform role God Mode.

**Tech Stack:** Next.js App Router, React 19, Tailwind, Prisma, Vitest.

---

## File Structure

**Create**
- `c:/Users/RYZEN/Projects/C - AkuntansiMu/BisnisMu/src/presentation/changelog/changelog.ts`
- `c:/Users/RYZEN/Projects/C - AkuntansiMu/BisnisMu/app/(app)/admin/changelog/layout.tsx`
- `c:/Users/RYZEN/Projects/C - AkuntansiMu/BisnisMu/app/(app)/admin/changelog/page.tsx`
- `c:/Users/RYZEN/Projects/C - AkuntansiMu/BisnisMu/app/(app)/admin/changelog/[version]/page.tsx`
- `c:/Users/RYZEN/Projects/C - AkuntansiMu/BisnisMu/tests/presentation/changelog-parse.test.ts`

**Modify**
- `c:/Users/RYZEN/Projects/C - AkuntansiMu/BisnisMu/components/layout/app-shell.tsx`

---

## Shared Notes / Constraints

- “Hanya admin” = platform role God Mode: `SUPER_ADMIN`, `SUPPORT_AGENT`, `DEVELOPER` (mengikuti gate yang sudah dipakai oleh `/api/admin/*` di [middleware.ts](file:///c:/Users/RYZEN/Projects/C%20-%20AkuntansiMu/BisnisMu/middleware.ts)).
- Tidak menambah dependency markdown renderer; parsing dilakukan sederhana dari heading `##`/`###`/bullet `- `.
- Footer sidebar: link kecil, tidak masuk `navigation.ts` (tidak ikut grup menu utama).

---

### Task 1: Parser Changelog (Pure Function + Reader)

**Files:**
- Create: [changelog.ts](file:///c:/Users/RYZEN/Projects/C%20-%20AkuntansiMu/BisnisMu/src/presentation/changelog/changelog.ts)
- Test: [changelog-parse.test.ts](file:///c:/Users/RYZEN/Projects/C%20-%20AkuntansiMu/BisnisMu/tests/presentation/changelog-parse.test.ts)

- [ ] **Step 1: Buat test parsing (failing test)**

```ts
import { describe, expect, it } from "vitest";
import { parseChangelog } from "@/presentation/changelog/changelog";

describe("parseChangelog", () => {
  it("mem-parse versi + section + bullets", () => {
    const md = [
      "# Changelog",
      "",
      "## [0.5.0] - 2026-06-03",
      "",
      "### Added — Feature A",
      "- A1",
      "- A2",
      "",
      "### Fixed — Bug B",
      "- B1",
      "",
      "## [0.4.0] - 2026-06-01",
      "",
      "### Added",
      "- C1",
      "",
    ].join("\n");

    const parsed = parseChangelog(md);
    expect(parsed.versions.length).toBe(2);
    expect(parsed.versions[0].version).toBe("0.5.0");
    expect(parsed.versions[0].date).toBe("2026-06-03");
    expect(parsed.versions[0].sections[0].title).toContain("Added");
    expect(parsed.versions[0].sections[0].bullets).toEqual(["A1", "A2"]);
    expect(parsed.versions[0].sections[1].bullets).toEqual(["B1"]);
  });

  it("mengabaikan teks di luar versi", () => {
    const md = ["# Changelog", "", "Intro", "", "## [0.1.0] - 2026-01-01", "", "### Added", "- X"].join("\n");
    const parsed = parseChangelog(md);
    expect(parsed.versions.length).toBe(1);
    expect(parsed.versions[0].sections[0].bullets).toEqual(["X"]);
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run:

```bash
npm test -- tests/presentation/changelog-parse.test.ts
```

Expected: FAIL karena `parseChangelog` belum ada.

- [ ] **Step 3: Implement `parseChangelog` + tipe data**

```ts
export type ChangelogSection = { title: string; bullets: string[] };
export type ChangelogVersion = { version: string; date: string | null; sections: ChangelogSection[]; raw: string };
export type ChangelogDoc = { versions: ChangelogVersion[] };

export function parseChangelog(markdown: string): ChangelogDoc {
  const lines = markdown.split(/\r?\n/);
  const versions: ChangelogVersion[] = [];

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
    const v = line.match(/^##\s+\[(.+?)\]\s*(?:-\s*([0-9]{4}-[0-9]{2}-[0-9]{2}))?\s*$/);
    if (v) {
      flushVersion();
      current = { version: v[1].trim(), date: v[2] ?? null, sections: [], raw: "" };
      continue;
    }
    if (!current) continue;

    rawLines.push(line);

    const s = line.match(/^###\s+(.+?)\s*$/);
    if (s) {
      flushSection();
      currentSection = { title: s[1].trim(), bullets: [] };
      continue;
    }

    const b = line.match(/^\s*-\s+(.+?)\s*$/);
    if (b) {
      if (!currentSection) currentSection = { title: "", bullets: [] };
      currentSection.bullets.push(b[1].trim());
    }
  }

  flushVersion();
  return { versions };
}
```

- [ ] **Step 4: Tambah helper `readChangelogFromRepo()`**

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function readChangelogFromRepo(): Promise<ChangelogDoc> {
  const md = await readFile(join(process.cwd(), "CHANGELOG.md"), "utf8");
  return parseChangelog(md);
}
```

- [ ] **Step 5: Jalankan test lagi**

Run:

```bash
npm test -- tests/presentation/changelog-parse.test.ts
```

Expected: PASS.

---

### Task 2: Route Guard (Admin-Only) untuk Changelog

**Files:**
- Create: [admin/changelog/layout.tsx](file:///c:/Users/RYZEN/Projects/C%20-%20AkuntansiMu/BisnisMu/app/(app)/admin/changelog/layout.tsx)
- Reference: [(app)/layout.tsx](file:///c:/Users/RYZEN/Projects/C%20-%20AkuntansiMu/BisnisMu/app/(app)/layout.tsx)

- [ ] **Step 1: Buat `layout.tsx` server-side yang enforce God Mode**

Implement pola mirip `requireAppSession()` tetapi cek `session.user.platformRole`:

```tsx
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/presentation/api/prisma";

const ALLOWED = new Set(["SUPER_ADMIN", "SUPPORT_AGENT", "DEVELOPER"]);

async function requireGodModePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("better-auth.session_token")?.value ?? cookieStore.get("__Secure-better-auth.session_token")?.value;
  if (!token) redirect("/login");

  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt <= new Date()) redirect("/login");
  if (!ALLOWED.has((session.user.platformRole ?? "USER") as any)) redirect("/dashboard");
}

export default async function Layout({ children }: { children: ReactNode }) {
  await requireGodModePage();
  return children;
}
```

- [ ] **Step 2: Manual check (smoke)**

Run:

```bash
npm run dev
```

Expected:
- Akun non-admin redirect ke `/dashboard` saat buka `/admin/changelog`.
- Akun admin bisa melihat konten route.

---

### Task 3: Halaman Index Changelog (`/admin/changelog`)

**Files:**
- Create: [admin/changelog/page.tsx](file:///c:/Users/RYZEN/Projects/C%20-%20AkuntansiMu/BisnisMu/app/(app)/admin/changelog/page.tsx)
- Use: [WorkspaceHeader](file:///c:/Users/RYZEN/Projects/C%20-%20AkuntansiMu/BisnisMu/components/layout/workspace.tsx#L4-L6), `GlassPanel`
- Use: `readChangelogFromRepo()` dari Task 1

- [ ] **Step 1: Render list versi + ringkasan**

Rencana UI:
- Header: eyebrow “Sistem”, title “Changelog”, description singkat.
- Panel list: tiap versi menampilkan `version`, `date`, 1–2 bullet pertama dari section pertama (kalau ada).
- Link “Lihat detail” ke `/admin/changelog/${version}`.

---

### Task 4: Halaman Detail Versi (`/admin/changelog/[version]`)

**Files:**
- Create: [admin/changelog/[version]/page.tsx](file:///c:/Users/RYZEN/Projects/C%20-%20AkuntansiMu/BisnisMu/app/(app)/admin/changelog/%5Bversion%5D/page.tsx)

- [ ] **Step 1: Cari versi dari parsed changelog**
- [ ] **Step 2: Jika tidak ditemukan → render state “Tidak ditemukan” + link kembali**
- [ ] **Step 3: Render semua section + bullets**

---

### Task 5: Link Footer Sidebar (Admin-Only)

**Files:**
- Modify: [app-shell.tsx](file:///c:/Users/RYZEN/Projects/C%20-%20AkuntansiMu/BisnisMu/components/layout/app-shell.tsx)
- Reference: [SidebarNav](file:///c:/Users/RYZEN/Projects/C%20-%20AkuntansiMu/BisnisMu/components/layout/sidebar-nav.tsx)

- [ ] **Step 1: Tambah guard `isGodMode` dari `currentUser?.platformRole`**

```ts
const isGodMode = ["SUPER_ADMIN", "SUPPORT_AGENT", "DEVELOPER"].includes((currentUser?.platformRole ?? "USER") as any);
```

- [ ] **Step 2: Tambah link kecil di footer sidebar**

Penempatan: di area bawah sidebar (sebelum tombol Perkecil), style “text-muted” dan hover ringan.

---

### Task 6: Verifikasi Repo

**Files:**
- No changes

- [ ] **Step 1: Jalankan test suite**

```bash
npm test
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

---

## Execution Options

Plan complete and saved to `docs/superpowers/plans/2026-06-05-changelog-pages.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks
2. **Inline Execution** — Execute tasks in this session with checkpoints

Which approach?

