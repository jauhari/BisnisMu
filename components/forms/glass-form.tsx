"use client";

import type { FormHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown, Clock3, Search } from "lucide-react";
import { cn } from "@/presentation/theme/cn";
import { glassTokens } from "@/presentation/theme/tokens";
import { GlassCalendar } from "./glass-calendar";

export function GlassForm({ children, className, ...props }: { children: ReactNode; className?: string } & FormHTMLAttributes<HTMLFormElement>) { return <form className={cn("grid gap-5", className)} noValidate {...props}>{children}</form>; }
export function GlassField({ label, error, children }: { label: string; error?: string; children: ReactNode }) { return <label className="group grid gap-2"><span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>{children}{error ? <span className="text-sm text-danger">{error}</span> : null}</label>; }
export function GlassInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) { return <input className={cn(glassTokens.focus, "h-11 rounded-md border border-border bg-white/60 px-3 text-sm tabular-nums shadow-sm backdrop-blur dark:bg-white/8", className)} {...props} />; }

function useDismissible(open: boolean, setOpen: (value: boolean) => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    function onPointer(event: MouseEvent) { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); }
    if (open) { document.addEventListener("keydown", onKey); document.addEventListener("mousedown", onPointer); }
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onPointer); };
  }, [open, setOpen]);
  return ref;
}

function Trigger({ children, className, open, icon }: { children?: ReactNode; className?: string; open?: boolean; icon?: ReactNode }) {
  const triggerProps = className !== undefined ? { className: cn(glassTokens.focus, glassTokens.interactive, "flex h-11 w-full items-center justify-between rounded-md border border-border bg-white/60 px-3 text-sm dark:bg-white/8", className) } : { className: cn(glassTokens.focus, glassTokens.interactive, "flex h-11 w-full items-center justify-between rounded-md border border-border bg-white/60 px-3 text-sm dark:bg-white/8") };
  return <button type="button" {...triggerProps}>{icon ? <span className="mr-2 text-muted">{icon}</span> : null}<span className="flex-1 text-left">{children}</span><ChevronDown className={cn("h-4 w-4 text-muted transition", open ? "rotate-180" : "rotate-0")} /></button>;
}

export function GlassSelect({ children, className }: { children?: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useDismissible(open, setOpen);
  const triggerProps = className !== undefined ? { className } : {};
  return <div ref={rootRef} className="relative"><div onClick={() => setOpen((value) => !value)}><Trigger {...triggerProps} open={open}>{children}</Trigger></div>{open ? <div className="absolute z-30 mt-2 w-full rounded-lg border border-border bg-white/90 p-2 shadow-lg backdrop-blur dark:bg-slate-950/90"><button type="button" className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-white/60 dark:hover:bg-white/10">Selected option<Check className="h-4 w-4 text-success" /></button><button type="button" className="flex w-full rounded-md px-3 py-2 text-sm hover:bg-white/60 dark:hover:bg-white/10">Alternative option</button></div> : null}</div>;
}
export function GlassMultiSelect(props: Parameters<typeof GlassSelect>[0]) { return <GlassSelect {...props} />; }
export function GlassCombobox({ children, className }: { children?: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useDismissible(open, setOpen);
  const options = useMemo(() => ["Kas", "Bank BCA", "Penjualan", "Utang Usaha"].filter((value) => value.toLowerCase().includes(query.toLowerCase())), [query]);
  const triggerProps = className !== undefined ? { className } : {};
  return <div ref={rootRef} className="relative"><div onClick={() => setOpen(true)}><Trigger {...triggerProps} open={open} icon={<Search className="h-4 w-4" />}>{children}</Trigger></div>{open ? <div className="absolute z-30 mt-2 w-full rounded-lg border border-border bg-white/90 p-2 shadow-lg backdrop-blur dark:bg-slate-950/90"><div className="flex items-center gap-2 rounded-md border border-border px-3"><Search className="h-4 w-4 text-muted" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 w-full border-0 bg-transparent text-sm outline-none" placeholder="Search..." /></div><div className="mt-2 grid gap-1">{options.map((option) => <button key={option} type="button" className="rounded-md px-3 py-2 text-left text-sm hover:bg-white/60 dark:hover:bg-white/10" onClick={() => setOpen(false)}>{option}</button>)}</div></div> : null}</div>;
}
export function GlassDatePicker({ children, className }: { children?: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<Date | undefined>();
  const rootRef = useDismissible(open, setOpen);
  const triggerProps = className !== undefined ? { className } : {};
  return <div ref={rootRef} className="relative"><div onClick={() => setOpen((v) => !v)}><Trigger {...triggerProps} open={open} icon={<CalendarDays className="h-4 w-4" />}>{value ? value.toISOString().slice(0,10) : children}</Trigger></div>{open ? <div className="absolute z-30 mt-2"><GlassCalendar {...(value ? { value } : {})} onSelect={(date) => { setValue(date); setOpen(false); }} /></div> : null}</div>;
}
export function GlassDateRangePicker({ children, className }: { children?: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<Date | undefined>();
  const [end, setEnd] = useState<Date | undefined>();
  const rootRef = useDismissible(open, setOpen);
  const triggerProps = className !== undefined ? { className } : {};
  const label = start && end ? `${start.toISOString().slice(0,10)} - ${end.toISOString().slice(0,10)}` : children;
  return <div ref={rootRef} className="relative"><div onClick={() => setOpen((v) => !v)}><Trigger {...triggerProps} open={open} icon={<CalendarDays className="h-4 w-4" />}>{label}</Trigger></div>{open ? <div className="absolute z-30 mt-2 grid gap-2"><GlassCalendar {...(start ? { value: start } : {})} onSelect={(date) => setStart(date)} /><GlassCalendar {...(end ? { value: end } : {})} onSelect={(date) => { setEnd(date); if (start) setOpen(false); }} /></div> : null}</div>;
}
export function GlassDateTimePicker({ children, className }: { children?: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<Date | undefined>();
  const [time, setTime] = useState("09:00");
  const rootRef = useDismissible(open, setOpen);
  const triggerProps = className !== undefined ? { className } : {};
  const label = value ? `${value.toISOString().slice(0,10)} ${time}` : children;
  return <div ref={rootRef} className="relative"><div onClick={() => setOpen((v) => !v)}><Trigger {...triggerProps} open={open} icon={<Clock3 className="h-4 w-4" />}>{label}</Trigger></div>{open ? <div className="absolute z-30 mt-2 rounded-lg border border-border bg-white/90 p-3 shadow-lg backdrop-blur dark:bg-slate-950/90"><GlassCalendar {...(value ? { value } : {})} onSelect={(date) => setValue(date)} /><input value={time} onChange={(event) => setTime(event.target.value)} className="mt-3 h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm" placeholder="09:00" /><button type="button" className="mt-3 h-10 w-full rounded-md bg-foreground text-background" onClick={() => setOpen(false)}>Apply</button></div> : null}</div>;
}
export function GlassTimePicker({ children, className }: { children?: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState("09:00");
  const rootRef = useDismissible(open, setOpen);
  const triggerProps = className !== undefined ? { className } : {};
  return <div ref={rootRef} className="relative"><div onClick={() => setOpen((v) => !v)}><Trigger {...triggerProps} open={open} icon={<Clock3 className="h-4 w-4" />}>{time || children}</Trigger></div>{open ? <div className="absolute z-30 mt-2 rounded-lg border border-border bg-white/90 p-3 shadow-lg backdrop-blur dark:bg-slate-950/90"><input value={time} onChange={(event) => setTime(event.target.value)} className="h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm" placeholder="09:00" /><button type="button" className="mt-3 h-10 w-full rounded-md bg-foreground text-background" onClick={() => setOpen(false)}>Apply</button></div> : null}</div>;
}
export function GlassFileUploader({ label = "Upload file" }: { label?: string }) { return <button type="button" className={cn(glassTokens.focus, glassTokens.interactive, "flex min-h-28 items-center justify-center rounded-lg border border-dashed border-border bg-white/50 px-4 text-sm text-muted dark:bg-white/8")}>{label}</button>; }
