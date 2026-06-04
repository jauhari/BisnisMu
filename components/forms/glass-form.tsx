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
export function GlassDatePicker({ value, onChange, placeholder = "Pilih tanggal", className }: {
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useDismissible(open, setOpen);
  const dateObj = value ? new Date(value + "T00:00:00") : undefined;

  function handleOpen() {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width });
    }
    setOpen((v) => !v);
  }

  function handleSelect(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    onChange?.(`${y}-${m}-${d}`);
    setOpen(false);
  }
  const triggerProps = className !== undefined ? { className } : {};
  return (
    <div ref={(el) => { (rootRef as any).current = el; (triggerRef as any).current = el; }} className="relative">
      <div onClick={handleOpen}>
        <Trigger {...triggerProps} open={open} icon={<CalendarDays className="h-4 w-4" />}>
          {value || <span className="text-muted">{placeholder}</span>}
        </Trigger>
      </div>
      {open && rect ? (
        <div
          style={{ position: "fixed", top: rect.top, left: rect.left, minWidth: rect.width, zIndex: 9999 }}
          className="drop-shadow-xl"
        >
          <GlassCalendar {...(dateObj ? { value: dateObj } : {})} onSelect={handleSelect} />
        </div>
      ) : null}
    </div>
  );
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
export function GlassDateTimePicker({ value, onChange, placeholder = "Pilih tanggal & waktu", className }: {
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState<Date | undefined>(() => value ? new Date(value) : undefined);
  const [time, setTime] = useState(() => value ? value.slice(11, 16) : "09:00");
  const rootRef = useDismissible(open, setOpen);
  const triggerProps = className !== undefined ? { className } : {};
  const label = pickedDate ? `${pickedDate.toISOString().slice(0, 10)} ${time}` : <span className="text-muted">{placeholder}</span>;
  function handleApply() {
    if (pickedDate) {
      const y = pickedDate.getFullYear();
      const m = String(pickedDate.getMonth() + 1).padStart(2, "0");
      const d = String(pickedDate.getDate()).padStart(2, "0");
      onChange?.(`${y}-${m}-${d}T${time}`);
    }
    setOpen(false);
  }
  return (
    <div ref={rootRef} className="relative">
      <div onClick={() => setOpen((v) => !v)}>
        <Trigger {...triggerProps} open={open} icon={<Clock3 className="h-4 w-4" />}>{label}</Trigger>
      </div>
      {open ? (
        <div className="absolute z-30 mt-2 rounded-lg border border-border bg-white/90 p-3 shadow-lg backdrop-blur dark:bg-slate-950/90">
          <GlassCalendar {...(pickedDate ? { value: pickedDate } : {})} onSelect={(date) => setPickedDate(date)} />
          <GlassInput value={time} onChange={(e) => setTime(e.target.value)} className="mt-3 h-10 w-full bg-transparent shadow-none" placeholder="09:00" />
          <button type="button" className="mt-3 h-10 w-full rounded-md bg-foreground text-sm text-background" onClick={handleApply}>Apply</button>
        </div>
      ) : null}
    </div>
  );
}
export function GlassTimePicker({ value, onChange, placeholder = "Pilih waktu", className }: {
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState(value ?? "09:00");
  const rootRef = useDismissible(open, setOpen);
  const triggerProps = className !== undefined ? { className } : {};
  return (
    <div ref={rootRef} className="relative">
      <div onClick={() => setOpen((v) => !v)}>
        <Trigger {...triggerProps} open={open} icon={<Clock3 className="h-4 w-4" />}>
          {time || <span className="text-muted">{placeholder}</span>}
        </Trigger>
      </div>
      {open ? (
        <div className="absolute z-30 mt-2 rounded-lg border border-border bg-white/90 p-3 shadow-lg backdrop-blur dark:bg-slate-950/90">
          <GlassInput value={time} onChange={(e) => setTime(e.target.value)} className="h-10 w-full bg-transparent shadow-none" placeholder="09:00" />
          <button type="button" className="mt-3 h-10 w-full rounded-md bg-foreground text-sm text-background" onClick={() => { onChange?.(time); setOpen(false); }}>Apply</button>
        </div>
      ) : null}
    </div>
  );
}
export function GlassFileUploader({ label = "Upload file" }: { label?: string }) { return <button type="button" className={cn(glassTokens.focus, glassTokens.interactive, "flex min-h-28 items-center justify-center rounded-lg border border-dashed border-border bg-white/50 px-4 text-sm text-muted dark:bg-white/8")}>{label}</button>; }

export interface SelectOption { value: string; label: string }

export function GlassDataSelect({ value, onChange, options, placeholder = "Pilih...", disabled, className }: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useDismissible(open, setOpen);
  const selected = options.find((o) => o.value === value);
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(glassTokens.focus, "flex h-11 w-full items-center justify-between rounded-md border border-border bg-white/60 px-3 text-sm dark:bg-white/8", !selected && "text-muted", disabled && "cursor-not-allowed opacity-50", className)}
      >
        <span className="flex-1 truncate text-left">{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn("ml-2 h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && !disabled && (
        <div className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-white/90 py-1 shadow-lg backdrop-blur dark:bg-slate-950/90">
          {options.length === 0 && <p className="px-3 py-2 text-sm text-muted">Tidak ada pilihan</p>}
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/60 dark:hover:bg-white/10", opt.value === value && "font-medium text-accent")}
            >
              <Check className={cn("h-3.5 w-3.5 shrink-0", opt.value !== value && "invisible")} />
              <span className="truncate">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
