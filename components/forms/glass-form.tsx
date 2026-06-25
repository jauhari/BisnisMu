"use client";

import type { FormHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Eye, EyeOff, Search } from "lucide-react";
import { cn } from "@/presentation/theme/cn";
import { glassTokens } from "@/presentation/theme/tokens";
import { formatDateLong } from "@/presentation/format/number";
import { GlassCalendar } from "./glass-calendar";

// Hook: hitung posisi dropdown berdasarkan trigger element
function useDropdownRect(open: boolean, triggerRef: React.RefObject<HTMLElement | null>) {
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  useEffect(() => {
    if (open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    } else {
      setRect(null);
    }
  }, [open, triggerRef]);
  return rect;
}

// Portal wrapper — render children langsung ke body agar bebas dari stacking context parent
function DropdownPortal({ children, rect, minWidth, portalRef }: { children: ReactNode; rect: { top: number; left: number; width: number }; minWidth?: number; portalRef?: React.RefObject<HTMLDivElement | null> }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(
    <div ref={portalRef} style={{ position: "fixed", top: rect.top, left: rect.left, minWidth: minWidth ?? rect.width, zIndex: 9999 }}>
      {children}
    </div>,
    document.body
  );
}

export function GlassForm({ children, className, ...props }: { children: ReactNode; className?: string } & FormHTMLAttributes<HTMLFormElement>) { return <form className={cn("grid gap-5", className)} noValidate {...props}>{children}</form>; }
export function GlassField({ label, error, children }: { label: string; error?: string; children: ReactNode }) { return <label className="group grid gap-2"><span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>{children}{error ? <span className="text-sm text-danger">{error}</span> : null}</label>; }
export const GlassInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(glassTokens.focus, "h-11 rounded-md border border-border bg-white/60 px-3 text-sm tabular-nums shadow-sm backdrop-blur dark:bg-white/8", className)} {...props} />
);
GlassInput.displayName = "GlassInput";

/** Password input with built-in reveal/hide toggle (eye icon). */
export function GlassPasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  const { className, ...rest } = props;

  return (
    <div className="relative">
      <GlassInput
        {...rest}
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted transition hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/40 rounded-r-md"
        aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
        title={visible ? "Sembunyikan password" : "Tampilkan password"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function useDismissible(
  open: boolean,
  setOpen: (value: boolean) => void,
  portalRef?: React.RefObject<HTMLElement | null>
) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      const insideTrigger = ref.current?.contains(target);
      const insidePortal = portalRef?.current?.contains(target);
      if (!insideTrigger && !insidePortal) setOpen(false);
    }
    if (open) { document.addEventListener("keydown", onKey); document.addEventListener("mousedown", onPointer); }
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onPointer); };
  }, [open, setOpen, portalRef]);
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
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useDismissible(open, setOpen, portalRef);
  const rect = useDropdownRect(open, triggerRef);
  const dateObj = value ? new Date(value + "T00:00:00") : undefined;

  function handleSelect(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    onChange?.(`${y}-${m}-${d}`);
    setOpen(false);
  }
  const triggerProps = className !== undefined ? { className } : {};
  return (
    <div ref={(el) => { (rootRef as any).current = el; triggerRef.current = el; }} className="relative">
      <div onClick={() => setOpen((v) => !v)}>
        <Trigger {...triggerProps} open={open} icon={<CalendarDays className="h-4 w-4" />}>
          {value ? formatDateLong(value) : <span className="text-muted">{placeholder}</span>}
        </Trigger>
      </div>
      {open && rect && (
        <DropdownPortal rect={rect} portalRef={portalRef}>
          <div className="drop-shadow-xl">
            <GlassCalendar {...(dateObj ? { value: dateObj } : {})} onSelect={handleSelect} />
          </div>
        </DropdownPortal>
      )}
    </div>
  );
}
export function GlassDateRangePicker({ children, className }: { children?: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<Date | undefined>();
  const [end, setEnd] = useState<Date | undefined>();
  const rootRef = useDismissible(open, setOpen);
  const triggerProps = className !== undefined ? { className } : {};
  const label = start && end ? `${formatDateLong(start)} - ${formatDateLong(end)}` : children;
  return <div ref={rootRef} className="relative"><div onClick={() => setOpen((v) => !v)}><Trigger {...triggerProps} open={open} icon={<CalendarDays className="h-4 w-4" />}>{label}</Trigger></div>{open ? <div className="absolute z-30 mt-2 grid gap-2"><GlassCalendar {...(start ? { value: start } : {})} onSelect={(date) => setStart(date)} /><GlassCalendar {...(end ? { value: end } : {})} onSelect={(date) => { setEnd(date); if (start) setOpen(false); }} /></div> : null}</div>;
}

// ─── Range Calendar (satu kalender, pilih tanggal awal lalu akhir) ──────────────
const RANGE_MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function ymdUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function rangeMonthMatrix(year: number, month: number): Array<Date | null> {
  const startDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(Date.UTC(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function RangeCalendar({ start, end, onPick }: { start?: string; end?: string; onPick: (d: string) => void }) {
  const init = start ? new Date(start + "T00:00:00Z") : new Date();
  const [cursor, setCursor] = useState(() => ({ year: init.getUTCFullYear(), month: init.getUTCMonth() }));
  const cells = useMemo(() => rangeMonthMatrix(cursor.year, cursor.month), [cursor]);

  function prev() { setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 })); }
  function next() { setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 })); }

  return (
    <div style={{ minWidth: 280 }}>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={prev} className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="h-4 w-4" /></button>
        <span className="text-sm font-semibold">{RANGE_MONTH_NAMES[cursor.month]} {cursor.year}</span>
        <button type="button" onClick={next} className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/10"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} className="h-9" />;
          const ds = ymdUTC(cell);
          const isStart = !!start && ds === start;
          const isEnd = !!end && ds === end;
          const inRange = !!start && !!end && ds > start && ds < end;
          const endpoint = isStart || isEnd;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(ds)}
              className={cn(
                "h-9 rounded-md text-sm transition",
                endpoint ? "bg-accent text-white font-semibold" : inRange ? "bg-accent/15 text-foreground" : "hover:bg-black/5 dark:hover:bg-white/10",
              )}
            >
              {cell.getUTCDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Range picker terkontrol dalam SATU popover: klik tanggal awal lalu tanggal akhir.
 * Nilai berupa string "YYYY-MM-DD". `onChange` dipanggil saat menekan "Terapkan".
 */
export function GlassDateRangeField({ start, end, onChange, placeholder = "Pilih rentang tanggal", className }: {
  start?: string;
  end?: string;
  onChange?: (start: string, end: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useDismissible(open, setOpen, portalRef);
  const rect = useDropdownRect(open, triggerRef);
  const [draftStart, setDraftStart] = useState<string | undefined>(start);
  const [draftEnd, setDraftEnd] = useState<string | undefined>(end);

  useEffect(() => { if (open) { setDraftStart(start); setDraftEnd(end); } }, [open, start, end]);

  function pick(dateStr: string) {
    if (!draftStart || (draftStart && draftEnd)) { setDraftStart(dateStr); setDraftEnd(undefined); return; }
    if (dateStr < draftStart) { setDraftStart(dateStr); return; }
    setDraftEnd(dateStr);
  }
  function apply() { if (draftStart && draftEnd) { onChange?.(draftStart, draftEnd); setOpen(false); } }

  const label = start && end
    ? `${formatDateLong(start)} – ${formatDateLong(end)}`
    : <span className="text-muted">{placeholder}</span>;
  const triggerProps = className !== undefined ? { className } : {};

  return (
    <div ref={(el) => { (rootRef as any).current = el; triggerRef.current = el; }} className="relative">
      <div onClick={() => setOpen((v) => !v)}>
        <Trigger {...triggerProps} open={open} icon={<CalendarDays className="h-4 w-4" />}>{label}</Trigger>
      </div>
      {open && rect && (
        <DropdownPortal rect={rect} minWidth={300} portalRef={portalRef}>
          <div className="rounded-lg border border-border bg-white/95 p-3 shadow-xl backdrop-blur dark:bg-slate-950/95">
            <RangeCalendar {...(draftStart ? { start: draftStart } : {})} {...(draftEnd ? { end: draftEnd } : {})} onPick={pick} />
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
              <span className="text-xs text-muted">
                {draftStart ? formatDateLong(draftStart) : "Tanggal awal"}
                {draftEnd ? ` – ${formatDateLong(draftEnd)}` : draftStart ? " – pilih akhir" : ""}
              </span>
              <button
                type="button"
                disabled={!draftStart || !draftEnd}
                onClick={apply}
                className="h-8 shrink-0 rounded-md bg-foreground px-4 text-xs font-medium text-background disabled:opacity-40"
              >
                Terapkan
              </button>
            </div>
          </div>
        </DropdownPortal>
      )}
    </div>
  );
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
  const label = pickedDate ? `${formatDateLong(pickedDate)} · ${time}` : <span className="text-muted">{placeholder}</span>;
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

export interface SelectOption { value: string; label: string; code?: string; name?: string; groupLabel?: string; normalBalance?: string; subtype?: string | null }

function accountOptionParts(option: SelectOption): { code: string; name: string } | null {
  if (option.code && option.name) return { code: option.code, name: option.name };
  const match = option.label.match(/^\s*(\d{3,12})\s*(?:\||-|·)?\s*(.+?)\s*$/);
  if (!match) return null;
  return { code: match[1]!, name: match[2]! };
}

function isAccountOption(option: SelectOption): boolean {
  return Boolean(accountOptionParts(option));
}

function optionSearchText(option: SelectOption): string {
  const account = accountOptionParts(option);
  return [option.label, option.code, option.name, account?.code, account?.name, option.groupLabel, option.normalBalance, option.subtype].filter(Boolean).join(" ").toLowerCase();
}

export function GlassDataSelect({ value, onChange, options, placeholder = "Pilih...", disabled, className }: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useDismissible(open, setOpen, portalRef);
  const rect = useDropdownRect(open, triggerRef);
  const selected = options.find((o) => o.value === value);
  const accountMode = options.some(isAccountOption);
  const queryText = query.trim();
  const filteredOptions = accountMode && queryText
    ? options.filter((option) => optionSearchText(option).includes(queryText.toLowerCase())).slice(0, 5)
    : [];

  if (accountMode) {
    const selectedAccount = selected ? accountOptionParts(selected) : null;
    const displayValue = open ? query : selectedAccount?.name ?? selected?.name ?? selected?.label ?? "";
    return (
      <div ref={rootRef} className="relative">
        <div
          ref={triggerRef as React.RefObject<HTMLDivElement>}
          className={cn("flex h-11 w-full items-center gap-2 rounded-md border border-border bg-white/60 px-3 text-sm shadow-sm transition focus-within:border-accent/35 focus-within:ring-2 focus-within:ring-accent/10 dark:bg-white/8", disabled && "cursor-not-allowed opacity-50", className)}
        >
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            disabled={disabled}
            value={displayValue}
            onFocus={() => { if (!disabled) { setQuery(""); setOpen(true); } }}
            onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
            placeholder={selectedAccount ? `${selectedAccount.code} · ${selectedAccount.name}` : placeholder}
            className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm outline-none ring-0 placeholder:text-muted focus:outline-none focus:ring-0"
          />
          {selectedAccount && !open ? <span className="shrink-0 rounded-md border border-border/70 bg-white/55 px-1.5 py-0.5 text-[10px] font-medium text-muted dark:bg-white/8">{selectedAccount.code}</span> : null}
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
        </div>
        {open && !disabled && queryText && rect && (
          <DropdownPortal rect={rect} portalRef={portalRef}>
            <div className="max-h-64 overflow-auto rounded-lg border border-border bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur dark:bg-slate-950/95">
              {filteredOptions.length === 0 && <p className="px-3 py-2 text-sm text-muted">Tidak ada akun cocok</p>}
              {filteredOptions.map((opt) => {
                const account = accountOptionParts(opt);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { onChange(opt.value); setQuery(""); setOpen(false); }}
                    className={cn("group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition hover:bg-slate-950/5 dark:hover:bg-white/10", opt.value === value && "bg-accent/10 text-accent")}
                  >
                    <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full", opt.value === value ? "bg-accent text-white" : "border border-border/70 text-transparent group-hover:border-accent/35")}>
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground group-hover:text-foreground">{account?.name ?? opt.name ?? opt.label}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted">{[opt.groupLabel, opt.normalBalance].filter(Boolean).join(" · ") || "Chart of Accounts"}</span>
                      </span>
                      {account?.code ? <span className="shrink-0 rounded-md border border-border/70 bg-white/55 px-1.5 py-0.5 text-[10px] font-medium text-muted dark:bg-white/8">{account.code}</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </DropdownPortal>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef as React.RefObject<HTMLButtonElement>}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(glassTokens.focus, "flex h-11 w-full items-center justify-between rounded-md border border-border bg-white/60 px-3 text-sm dark:bg-white/8", !selected && "text-muted", disabled && "cursor-not-allowed opacity-50", className)}
      >
        <span className="flex-1 truncate text-left">{selected ? (selected.name ?? selected.label) : placeholder}</span>
        <ChevronDown className={cn("ml-2 h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && !disabled && rect && (
        <DropdownPortal rect={rect} portalRef={portalRef}>
          <div className="max-h-72 overflow-auto rounded-lg border border-border bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur dark:bg-slate-950/95">
            {options.length === 0 && <p className="px-3 py-2 text-sm text-muted">Tidak ada pilihan</p>}
            {options.map((opt) => {
              const rich = Boolean(opt.code && opt.name);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={cn("group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition hover:bg-slate-950/5 dark:hover:bg-white/10", opt.value === value && "bg-accent/10 text-accent")}
                >
                  <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full", opt.value === value ? "bg-accent text-white" : "border border-border/70 text-transparent group-hover:border-accent/35")}>
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {rich ? (
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                      <span className="truncate font-medium text-foreground group-hover:text-foreground">{opt.name}</span>
                      <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted">
                        {opt.groupLabel ? <span className="rounded bg-slate-950/5 px-1.5 py-0.5 dark:bg-white/10">{opt.groupLabel}</span> : null}
                        {opt.normalBalance ? <span className="rounded bg-slate-950/5 px-1.5 py-0.5 dark:bg-white/10">{opt.normalBalance}</span> : null}
                      </span>
                    </span>
                  ) : (
                    <span className="truncate">{opt.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        </DropdownPortal>
      )}
    </div>
  );
}
