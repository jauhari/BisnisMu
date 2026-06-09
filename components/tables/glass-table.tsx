"use client";

import type { DragEvent, KeyboardEvent, ReactNode, UIEvent } from "react";
import React, { useEffect, useMemo, useState } from "react";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type ColumnOrderState, type ColumnSizingState, type RowSelectionState, type SortingState, type VisibilityState } from "@tanstack/react-table";
import { Check, ChevronDown, ChevronUp, Columns3, Download, GripVertical, Search } from "lucide-react";
import { GlassCard } from "../glass/glass-primitives";
import { GlassInput } from "@/components/forms/glass-form";
import { loadTableLayout, saveTableLayout } from "@/presentation/state/table-layout";
import { formatNumber } from "@/presentation/format/number";
import { cn } from "@/presentation/theme/cn";

export interface GlassTableColumn<T> { key: keyof T | string; header: string; render?: (row: T) => ReactNode; sticky?: boolean; }

// Kolom bernuansa uang/nominal diformat ribuan otomatis (mis. 10000 → 10.000).
// Sengaja TIDAK mencocokkan kode akun, SKU, kuantitas, urutan, tenor, dsb.
const MONETARY_KEY = /amount|total|balance|debit|credit|value|price|paid|subtotal|payable|receivable|saldo|nominal|harga|nilai|modal|profit|margin|revenue|expense|cogs/i;

function formatCell(key: string, raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const text = String(raw);
  if (text === "" || !MONETARY_KEY.test(key)) return text;
  // Hanya format bila benar-benar angka mentah (boleh negatif/desimal); biarkan yang sudah berformat (mis. "Rp 1.000").
  if (!/^-?\d+(\.\d+)?$/.test(text.trim())) return text;
  return formatNumber(text.trim());
}

function buildColumn<T extends object>(column: GlassTableColumn<T>): ColumnDef<T> {
  return {
    id: String(column.key),
    accessorFn: (row) => (row as Record<string, unknown>)[String(column.key)],
    header: () => <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide"><GripVertical className="h-3.5 w-3.5 text-muted/70" />{column.header}</div>,
    size: 180,
    minSize: 120,
    cell: ({ row }) => <div className="tabular-nums">{column.render ? column.render(row.original) : formatCell(String(column.key), (row.original as Record<string, unknown>)[String(column.key)])}</div>
  };
}

function exportCsv(filename: string, headers: string[], rows: string[][]) {
  const body = rows.map((row) => row.map((value) => JSON.stringify(value ?? "")).join(",")).join("\n");
  const blob = new Blob([headers.join(",") + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportSpreadsheetXml(filename: string, headers: string[], rows: string[][]) {
  const headerXml = headers.map((header) => `<Cell><Data ss:Type="String">${header}</Data></Cell>`).join("");
  const rowXml = rows.map((row) => `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${String(cell ?? "")}</Data></Cell>`).join("")}</Row>`).join("");
  const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Export"><Table><Row>${headerXml}</Row>${rowXml}</Table></Worksheet></Workbook>`;
  const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.xls`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportPrintHtml(filename: string, headers: string[], rows: string[][]) {
  const html = `<!doctype html><html><head><title>${filename}</title><style>body{font-family:Inter,Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d1d5db;padding:8px;text-align:left;font-size:12px}th{background:#f8fafc}</style></head><body><h1>${filename}</h1><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${String(cell ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table><script>window.print()</script></body></html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
}

function GlassCheckbox({ checked, onChange, 'aria-label': ariaLabel, indeterminate }: {
  checked: boolean;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  'aria-label'?: string;
  indeterminate?: boolean;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={ariaLabel}
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 cursor-pointer rounded border-border accent-accent"
    />
  );
}

export function GlassTable<T extends object>({ columns, rows, empty = "No data", tableId = "default-table", selectable = true }: { columns: GlassTableColumn<T>[]; rows: T[]; empty?: string; tableId?: string; selectable?: boolean }) {
  const columnIds = columns.map((column) => String(column.key));
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(columnIds);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [dragColumn, setDragColumn] = useState<string | null>(null);
  const [virtualStart, setVirtualStart] = useState(0);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [menu, setMenu] = useState<null | "columns" | "export">(null);
  const rowHeight = 48;
  const viewportRows = 30;

  useEffect(() => {
    const saved = loadTableLayout(tableId);
    if (saved) {
      setSorting(saved.sort);
      setVisibility(Object.fromEntries(saved.hiddenColumns.map((column) => [column, false])));
      if (saved.columnOrder.length) setColumnOrder(saved.columnOrder);
      setColumnSizing(saved.columnWidths);
    }
  }, [tableId]);

  useEffect(() => {
    const hiddenColumns = Object.entries(visibility).filter(([, value]) => value === false).map(([key]) => key);
    saveTableLayout(tableId, { columnOrder, hiddenColumns, columnWidths: columnSizing, sort: sorting });
  }, [tableId, visibility, sorting, columnOrder, columnSizing]);

  const searchedRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => Object.values(row as Record<string, unknown>).some((value) => String(value ?? "").toLowerCase().includes(q)));
  }, [rows, search]);

  const totalRows = searchedRows.length;
  const safeStart = Math.max(0, Math.min(virtualStart, Math.max(0, totalRows - viewportRows)));
  const virtualRowsSource = useMemo(() => searchedRows.slice(safeStart, safeStart + viewportRows), [searchedRows, safeStart]);
  const topSpacer = safeStart * rowHeight;
  const bottomSpacer = Math.max(0, (totalRows - (safeStart + virtualRowsSource.length)) * rowHeight);

  const columnDefs = useMemo(() => columns.map(buildColumn), [columns]);
  const table = useReactTable({
    data: virtualRowsSource,
    columns: columnDefs,
    state: { sorting, columnVisibility: visibility, columnOrder, columnSizing, rowSelection },
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true
  });

  function onScroll(event: UIEvent<HTMLDivElement>) {
    const node = event.currentTarget;
    const nextVirtualStart = Math.max(0, Math.min(totalRows - viewportRows, Math.floor(node.scrollTop / rowHeight)));
    if (nextVirtualStart !== virtualStart) setVirtualStart(nextVirtualStart);
  }

  function onDragStart(columnId: string) { setDragColumn(columnId); }
  function onDragOver(event: DragEvent<HTMLTableHeaderCellElement>) { event.preventDefault(); }
  function onDrop(targetColumnId: string) {
    if (!dragColumn || dragColumn === targetColumnId) return;
    const next = [...columnOrder];
    const from = next.indexOf(dragColumn);
    const to = next.indexOf(targetColumnId);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return;
    next.splice(to, 0, moved);
    setColumnOrder(next);
    setDragColumn(null);
  }

  function onCellKeyDown(event: KeyboardEvent<HTMLTableCellElement>, rowIndex: number, colIndex: number) {
    if (event.key === "ArrowRight") { event.preventDefault(); setActiveCell({ row: rowIndex, col: colIndex + 1 }); }
    if (event.key === "ArrowLeft") { event.preventDefault(); setActiveCell({ row: rowIndex, col: Math.max(0, colIndex - 1) }); }
    if (event.key === "ArrowDown") { event.preventDefault(); setActiveCell({ row: rowIndex + 1, col: colIndex }); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActiveCell({ row: Math.max(0, rowIndex - 1), col: colIndex }); }
  }

  const visibleColumns = table.getVisibleLeafColumns();
  const selectedCount = table.getSelectedRowModel().rows.length;
  const exportHeaders = visibleColumns.map((column) => column.id);
  const exportRows = searchedRows.map((row) => visibleColumns.map((column) => String((row as Record<string, unknown>)[column.id] ?? "")));
  const headerLabel = (id: string) => columns.find((c) => String(c.key) === id)?.header ?? id;
  const moveColumn = (id: string, dir: -1 | 1) => setColumnOrder((current) => {
    const order = current.length ? current : columnIds;
    const i = order.indexOf(id); const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return order;
    const next = [...order]; const tmp = next[i]!; next[i] = next[j]!; next[j] = tmp; return next;
  });
  const orderedColumns = table.getAllLeafColumns();
  const menuBtn = "flex h-9 items-center gap-2 rounded-lg border border-border bg-white/60 px-3 text-sm font-medium transition hover:bg-white/80 dark:bg-white/8 dark:hover:bg-white/12";

  return <GlassCard className="overflow-hidden p-0 shadow-xl shadow-slate-900/5">
    <div className="flex flex-col gap-3 border-b border-border/70 bg-white/35 px-4 py-3 backdrop-blur sm:flex-row sm:items-center dark:bg-white/5">
      <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-white/60 px-3 dark:bg-white/8"><Search className="h-4 w-4 text-muted" /><GlassInput value={search} onChange={(event) => { setSearch(event.target.value); setVirtualStart(0); setActiveCell({ row: 0, col: 0 }); }} placeholder="Cari…" className="h-9 w-full border-0 bg-transparent shadow-none backdrop-blur-none" /></div>
      <div className="flex items-center gap-2">
        {selectedCount > 0 ? <span className="rounded-lg bg-accent/12 px-2.5 py-1 text-xs font-medium text-accent">{selectedCount} dipilih</span> : null}
        <span className="hidden text-xs text-muted sm:inline">{totalRows} baris</span>

        <div className="relative">
          <button type="button" onClick={() => setMenu((m) => m === "columns" ? null : "columns")} className={menuBtn} aria-haspopup="menu" aria-expanded={menu === "columns"}><Columns3 className="h-4 w-4" /><span className="hidden sm:inline">Kolom</span></button>
          {menu === "columns" ? (
            <div className="absolute right-0 z-30 mt-2 w-60 rounded-xl border border-border bg-background p-1.5 shadow-xl">
              <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Tampilkan & urutkan</p>
              {orderedColumns.map((column) => (
                <div key={column.id} className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-white/60 dark:hover:bg-white/8">
                  <button type="button" onClick={() => column.toggleVisibility(!column.getIsVisible())} className="flex flex-1 items-center gap-2 text-left text-sm">
                    <span className={`grid h-4 w-4 place-items-center rounded border ${column.getIsVisible() ? "border-accent bg-accent text-background" : "border-border"}`}>{column.getIsVisible() ? <Check className="h-3 w-3" /> : null}</span>
                    <span className="truncate">{headerLabel(column.id)}</span>
                  </button>
                  <button type="button" aria-label={`Naikkan ${headerLabel(column.id)}`} onClick={() => moveColumn(column.id, -1)} className="grid h-6 w-6 place-items-center rounded text-muted hover:text-foreground"><ChevronUp className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label={`Turunkan ${headerLabel(column.id)}`} onClick={() => moveColumn(column.id, 1)} className="grid h-6 w-6 place-items-center rounded text-muted hover:text-foreground"><ChevronDown className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="relative">
          <button type="button" onClick={() => setMenu((m) => m === "export" ? null : "export")} className={menuBtn} aria-haspopup="menu" aria-expanded={menu === "export"}><Download className="h-4 w-4" /><span className="hidden sm:inline">Ekspor</span></button>
          {menu === "export" ? (
            <div className="absolute right-0 z-30 mt-2 w-44 rounded-xl border border-border bg-background p-1.5 shadow-xl">
              <button type="button" onClick={() => { exportCsv(tableId, exportHeaders, exportRows); setMenu(null); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/60 dark:hover:bg-white/8">Ekspor CSV</button>
              <button type="button" onClick={() => { exportSpreadsheetXml(tableId, exportHeaders, exportRows); setMenu(null); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/60 dark:hover:bg-white/8">Ekspor Excel</button>
              <button type="button" onClick={() => { exportPrintHtml(tableId, exportHeaders, exportRows); setMenu(null); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/60 dark:hover:bg-white/8">Ekspor PDF</button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
    {menu ? <div className="fixed inset-0 z-20" onClick={() => setMenu(null)} aria-hidden /> : null}
    <div className="max-h-[640px] overflow-auto bg-white/30 dark:bg-white/3" onScroll={onScroll}>
      <table className="w-full border-separate border-spacing-0 text-sm" role="grid" aria-rowcount={totalRows} aria-colcount={visibleColumns.length + (selectable ? 1 : 0)}>
        <thead className="sticky top-0 z-10 border-b border-border bg-slate-50/95 shadow-[0_1px_0_hsl(var(--border))] backdrop-blur dark:bg-slate-950/95">{table.getHeaderGroups().map((headerGroup) => <tr key={headerGroup.id}>{selectable ? <th className="sticky left-0 z-20 w-12 border-b border-r border-border/80 bg-slate-50/95 px-3 py-3 dark:bg-slate-950/95"><GlassCheckbox aria-label="Select all visible rows" checked={table.getIsAllPageRowsSelected()} onChange={table.getToggleAllPageRowsSelectedHandler()} /></th> : null}{headerGroup.headers.map((header, index) => <th key={header.id} draggable onDragStart={() => onDragStart(header.id)} onDragOver={onDragOver} onDrop={() => onDrop(header.id)} style={{ width: header.getSize() }} className={index === 0 && selectable ? "sticky left-12 z-10 border-b border-r border-border/80 bg-slate-50/95 px-4 py-3 text-left text-muted dark:bg-slate-950/95" : "relative border-b border-r border-border/80 bg-slate-50/95 px-4 py-3 text-left text-muted last:border-r-0 dark:bg-slate-950/95"}><button type="button" onClick={header.column.getToggleSortingHandler()?.bind(header.column)} className="w-full cursor-grab text-left active:cursor-grabbing">{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</button><div onMouseDown={header.getResizeHandler()} onTouchStart={header.getResizeHandler()} className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-border/60 opacity-50 transition hover:opacity-100" /></th>)}</tr>)}</thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? <tr><td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-12 text-center text-muted">{empty}</td></tr> : <>
            {topSpacer > 0 ? <tr><td colSpan={columns.length + (selectable ? 1 : 0)} style={{ height: topSpacer }} /></tr> : null}
            {table.getRowModel().rows.map((row, rowIndex) => <tr key={row.id} className={cn("group transition-colors", rowIndex % 2 === 0 ? "bg-white/55 dark:bg-white/[0.035]" : "bg-slate-50/70 dark:bg-white/[0.02]", row.getIsSelected() ? "bg-accent/10 hover:bg-accent/14" : "hover:bg-accent/7 dark:hover:bg-accent/10")}>{selectable ? <td className={cn("sticky left-0 z-10 w-12 border-b border-r border-border/60 px-3 py-3 transition-colors", rowIndex % 2 === 0 ? "bg-white/90 dark:bg-slate-950" : "bg-slate-50/95 dark:bg-slate-900", row.getIsSelected() ? "bg-accent/10" : "group-hover:bg-accent/7 dark:group-hover:bg-accent/10")}><GlassCheckbox aria-label={`Select row ${rowIndex + 1}`} checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} /></td> : null}{row.getVisibleCells().map((cell, colIndex) => <td key={cell.id} tabIndex={activeCell.row === rowIndex && activeCell.col === colIndex ? 0 : -1} onFocus={() => setActiveCell({ row: rowIndex, col: colIndex })} onKeyDown={(event) => onCellKeyDown(event, rowIndex, colIndex)} className={indexCellClass(colIndex, selectable)}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}
            {bottomSpacer > 0 ? <tr><td colSpan={columns.length + (selectable ? 1 : 0)} style={{ height: bottomSpacer }} /></tr> : null}
          </>}
        </tbody>
      </table>
    </div>
  </GlassCard>;
}

function indexCellClass(index: number, selectable: boolean): string {
  return index === 0 && selectable ? "sticky left-12 z-10 border-b border-r border-border/60 bg-inherit px-4 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring" : "border-b border-r border-border/60 px-4 py-3 outline-none transition-colors last:border-r-0 focus-visible:ring-2 focus-visible:ring-ring";
}
