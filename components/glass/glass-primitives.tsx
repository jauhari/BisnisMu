"use client";

import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/presentation/theme/cn";
import { glassTokens } from "@/presentation/theme/tokens";

type DivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

function trapTabKey(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  const root = event.currentTarget;
  const selectors = 'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
  const focusable = Array.from(root.querySelectorAll<HTMLElement>(selectors)).filter((node) => !node.hasAttribute("disabled") && node.tabIndex !== -1);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

function useOverlayFocus(open: boolean, root: HTMLElement | null) {
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root?.querySelector<HTMLElement>('button,[href],input,textarea,[tabindex]:not([tabindex="-1"])')?.focus();
    return () => previousFocus.current?.focus();
  }, [open, root]);
}

export function GlassCard({ className, ...props }: DivProps) { return <div className={cn(glassTokens.surface, "rounded-lg p-5", className)} {...props} />; }
export function GlassPanel({ className, ...props }: DivProps) { return <section className={cn(glassTokens.panel, "rounded-lg p-6", className)} {...props} />; }
export function GlassSheet({ className, ...props }: DivProps) { return <div className={cn(glassTokens.surface, "rounded-lg p-4", className)} {...props} />; }
export function GlassStatsCard({ title, value, detail, className }: { title: string; value: ReactNode; detail?: ReactNode; className?: string }) { const labelId = useId(); return <GlassCard className={cn("min-h-28", className)} role="group" aria-labelledby={labelId}><p id={labelId} className="text-sm text-muted">{title}</p><div className="mt-3 text-2xl font-semibold tabular-nums">{value}</div>{detail ? <div className="mt-2 text-sm text-muted">{detail}</div> : null}</GlassCard>; }
export function GlassMetricCard(props: Parameters<typeof GlassStatsCard>[0]) { return <GlassStatsCard {...props} />; }
export function GlassKpiCard(props: Parameters<typeof GlassStatsCard>[0]) { return <GlassStatsCard {...props} />; }
export function GlassChartCard({ title, children, className }: DivProps & { title: string }) { const titleId = useId(); return <GlassCard className={cn("min-h-80", className)} role="region" aria-labelledby={titleId}><div className="mb-4 flex items-center justify-between"><h2 id={titleId} className="text-base font-semibold">{title}</h2></div>{children}</GlassCard>; }

export function GlassModal({ children, className }: DivProps) { return <div role="dialog" aria-modal="true" className={cn(glassTokens.surface, "rounded-lg p-6", className)}>{children}</div>; }
export function GlassDialog({ open = true, children, className }: { open?: boolean; children?: ReactNode; className?: string }) { const reduced = useReducedMotion(); const bodyRef = useRef<HTMLDivElement | null>(null); useOverlayFocus(open, bodyRef.current); return <AnimatePresence>{open ? <motion.div initial={reduced ? false : { opacity: 0, scale: 0.98 }} animate={reduced ? {} : { opacity: 1, scale: 1 }} exit={reduced ? {} : { opacity: 0, scale: 0.98 }} transition={{ duration: reduced ? 0 : 0.16 }}><div ref={bodyRef} onKeyDown={trapTabKey}><GlassModal className={className}>{children}</GlassModal></div></motion.div> : null}</AnimatePresence>; }
export function GlassDrawer({ open = true, children, className }: { open?: boolean; children?: ReactNode; className?: string }) { const reduced = useReducedMotion(); const bodyRef = useRef<HTMLElement | null>(null); useOverlayFocus(open, bodyRef.current); return <AnimatePresence>{open ? <motion.aside ref={bodyRef} initial={reduced ? false : { x: 40, opacity: 0 }} animate={reduced ? {} : { x: 0, opacity: 1 }} exit={reduced ? {} : { x: 40, opacity: 0 }} transition={{ duration: reduced ? 0 : 0.18 }} onKeyDown={trapTabKey} className={cn(glassTokens.surface, "h-full w-full max-w-xl rounded-l-lg p-6", className)}>{children}</motion.aside> : null}</AnimatePresence>; }
export function GlassPopover({ open = true, children, className }: { open?: boolean; children?: ReactNode; className?: string }) { const reduced = useReducedMotion(); return <AnimatePresence>{open ? <motion.div initial={reduced ? false : { opacity: 0, y: 6 }} animate={reduced ? {} : { opacity: 1, y: 0 }} exit={reduced ? {} : { opacity: 0, y: 6 }} transition={{ duration: reduced ? 0 : 0.14 }} className={cn(glassTokens.surface, "rounded-lg p-3", className)}>{children}</motion.div> : null}</AnimatePresence>; }
export function GlassTooltip({ children }: { children: ReactNode }) { const reduced = useReducedMotion(); return <motion.span initial={reduced ? false : { opacity: 0, y: 4 }} animate={reduced ? {} : { opacity: 1, y: 0 }} role="tooltip" className="rounded-md border border-white/20 bg-foreground px-2 py-1 text-xs text-background shadow-lg">{children}</motion.span>; }
export function GlassDropdown(props: { open?: boolean; children?: ReactNode; className?: string }) { return <GlassPopover {...props} />; }
export function GlassContextMenu(props: { open?: boolean; children?: ReactNode; className?: string }) { return <GlassPopover {...props} />; }
export function GlassToast({ className, children }: { className?: string; children?: ReactNode }) { const reduced = useReducedMotion(); return <motion.div initial={reduced ? false : { opacity: 0, y: 10 }} animate={reduced ? {} : { opacity: 1, y: 0 }} role="status" aria-live="polite" className={cn(glassTokens.surface, "rounded-lg px-4 py-3", className)}>{children}</motion.div>; }
export function GlassNotificationCenter(props: DivProps) { return <GlassPanel aria-label="Notification center" {...props} />; }
export function GlassCommandPalette({ open = true, children, className }: { open?: boolean; children?: ReactNode; className?: string }) { return <GlassDialog open={open} className={cn("mx-auto max-w-2xl", className)}>{children}</GlassDialog>; }
export function GlassTabs({ tabs, active }: { tabs: Array<{ id: string; label: string }>; active: string }) { const activeIndex = tabs.findIndex((tab) => tab.id === active); return <div role="tablist" aria-orientation="horizontal" className="inline-flex rounded-lg border border-border bg-white/50 p-1 backdrop-blur dark:bg-white/8">{tabs.map((tab, index) => <button key={tab.id} role="tab" tabIndex={index === activeIndex ? 0 : -1} aria-selected={tab.id === active} type="button" className={cn("rounded-md px-3 py-2 text-sm transition", tab.id === active ? "bg-foreground text-background" : "text-muted hover:text-foreground")}>{tab.label}</button>)}</div>; }
export function GlassDialogActionBar({ children, className }: DivProps) { return <div className={cn("mt-6 flex items-center justify-end gap-3 border-t border-border pt-4", className)}>{children}</div>; }
export function GlassEmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <GlassCard className="flex min-h-72 flex-col items-center justify-center text-center"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>{action ? <div className="mt-5">{action}</div> : null}</GlassCard>; }
export function GlassErrorState({ title, description }: { title: string; description: string }) { return <GlassCard className="border-danger/30 bg-danger/5" role="alert"><h2 className="text-lg font-semibold text-danger">{title}</h2><p className="mt-2 text-sm leading-6 text-muted">{description}</p></GlassCard>; }
export function GlassSkeleton({ className }: { className?: string }) { return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-foreground/10 motion-reduce:animate-none", className)} />; }
