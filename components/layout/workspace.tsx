import type { ReactNode } from "react";
import { GlassPanel } from "../glass/glass-primitives";

export function WorkspaceHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-accent">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          {description}
        </p>
      </div>
      {action ? <div className="min-w-0 lg:shrink-0">{action}</div> : null}
    </section>
  );
}

/**
 * Dua kolom utama + panel samping. Panel samping diletakkan DI DALAM kolom utama
 * (bukan sebagai grid sibling), supaya saat satu kolom grid minmax(0,1fr) jadi
 * lebih sempit, isi tabel di dalamnya tidak lagi memaksa lebar MyContainer dan
 * memicu gulir horizontal di seluruh halaman.
 */
export function SplitWorkspace({
  main,
  side,
}: {
  main: ReactNode;
  side: ReactNode;
}) {
  return (
    <div className="workspace-split grid min-w-0 gap-5">
      <div className="order-1 grid min-w-0 gap-5">
        {main}
        <aside className="grid min-w-0 grid-cols-1 content-start gap-3 sm:gap-4 xl:grid-cols-2">
          {side}
        </aside>
      </div>
    </div>
  );
}
export function DetailPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <GlassPanel className="min-w-0 p-4 sm:p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-3 break-words text-sm leading-6 text-muted sm:mt-4">
        {children}
      </div>
    </GlassPanel>
  );
}
