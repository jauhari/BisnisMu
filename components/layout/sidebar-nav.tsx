"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard, ScanLine, ShoppingCart, Truck, Package, Wallet, Scale, ListChecks,
  Smartphone, BookOpen, BarChart3, Settings, ChevronRight, ClipboardPen, BadgeDollarSign, Users, type LucideIcon,
} from "lucide-react";
import { navigation, NAV_GROUPS, type NavItem } from "@/presentation/navigation/navigation";

const OPEN_KEY = "bisnismu:sidebar-open";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard, scan: ClipboardPen, transactions: ListChecks, pos: ScanLine, sales: ShoppingCart, purchase: Truck,
  inventory: Package, cash: Wallet, arap: Scale, float: Smartphone,
  accounting: BookOpen, reports: BarChart3, settings: Settings, admin: Settings, payroll: BadgeDollarSign, contacts: Users,
};

function isHrefActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}
function isItemActive(pathname: string, item: NavItem): boolean {
  if (isHrefActive(pathname, item.href)) return true;
  return (item.children ?? []).some((c) => pathname === c.href);
}

export function SidebarNav({ collapsed = false, onNavigate = () => {} }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname() ?? "";
  // Akordeon: hanya satu submenu terbuka. undefined = ikuti menu aktif;
  // string/null = pilihan manual pengguna, direset setiap pindah halaman
  // supaya sidebar kembali ringkas.
  const [openHref, setOpenHref] = useState<string | null | undefined>(undefined);
  const activeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOpenHref(undefined);
    try { localStorage.removeItem(OPEN_KEY); } catch { /* ignore */ }
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [pathname]);

  const toggle = (href: string, currentlyOpen: boolean) => setOpenHref(currentlyOpen ? null : href);

  // Mode rail (collapsed): ikon saja, tanpa grup/submenu.
  if (collapsed) {
    return (
      <nav className="grid gap-1" aria-label="Navigasi utama">
        {navigation.map((item) => {
          const Icon = ICONS[item.icon ?? ""] ?? LayoutDashboard;
          const active = isItemActive(pathname, item);
          return (
            <Link key={item.href} href={item.href} onClick={onNavigate} title={item.title} aria-label={item.title} aria-current={active ? "page" : undefined}
              className={`relative flex items-center justify-center rounded-lg py-2.5 transition ${active ? "bg-accent/12 text-accent" : "text-muted hover:bg-white/70 hover:text-foreground dark:hover:bg-white/10"}`}>
              {active ? <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-accent" /> : null}
              <Icon className="h-[18px] w-[18px]" />
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="grid gap-5" aria-label="Navigasi utama">
      {NAV_GROUPS.map((group) => {
        const items = navigation.filter((i) => i.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group} className="grid gap-1">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{group}</p>
            {items.map((item) => {
              const Icon = ICONS[item.icon ?? ""] ?? LayoutDashboard;
              const active = isItemActive(pathname, item);
              const hasChildren = (item.children?.length ?? 0) > 0;
              const expanded = openHref === undefined ? active : openHref === item.href;
              return (
                <div key={item.href} ref={active ? activeRef : undefined}>
                  <div className={`group relative flex items-center rounded-lg transition ${active ? "bg-accent/12 text-accent" : "text-muted hover:bg-white/70 hover:text-foreground dark:hover:bg-white/10"}`}>
                    {active ? <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-accent" /> : null}
                    <Link href={item.href} onClick={onNavigate} aria-current={active && !hasChildren ? "page" : undefined} className="flex flex-1 items-center gap-3 px-3 py-2 text-sm font-medium">
                      <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-accent" : "text-muted group-hover:text-foreground"}`} />
                      <span>{item.title}</span>
                    </Link>
                    {hasChildren ? (
                      <button type="button" aria-label={`Buka submenu ${item.title}`} aria-expanded={expanded} onClick={() => toggle(item.href, expanded)} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:text-foreground">
                        <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
                      </button>
                    ) : null}
                  </div>
                  {hasChildren && expanded ? (
                    <div className="ml-[26px] mt-0.5 grid gap-0.5 border-l border-border/60 pl-3">
                      {item.children!.map((child) => {
                        const childActive = pathname === child.href;
                        return (
                          <Link key={child.href} href={child.href} onClick={onNavigate} aria-current={childActive ? "page" : undefined} className={`rounded-md px-3 py-1.5 text-[13px] transition ${childActive ? "font-medium text-accent" : "text-muted hover:bg-white/60 hover:text-foreground dark:hover:bg-white/10"}`}>
                            {child.title}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
