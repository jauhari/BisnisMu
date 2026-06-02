"use client";

import type { DragEvent, KeyboardEvent, ReactNode, UIEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type ColumnOrderState, type ColumnSizingState, type RowSelectionState, type SortingState, type VisibilityState } from "@tanstack/react-table";
import { ArrowLeftRight, CheckSquare, EyeOff, GripVertical, Search, SlidersHorizontal } from "lucide-react";
import { GlassCard } from "../glass/glass-primitives";
import { loadTableLayout, saveTableLayout } from "@/presentation/state/table-layout";

export interface GlassTableColumn<T> { key: keyof T | string; header: string; render?: (row: T) => ReactNode; sticky?: boolean; }

function buildColumn<T extends object>(column: GlassTableColumn<T>): ColumnDef<T> {
  return {
    id: String(column.key),
    accessorFn: (row) => (row as Record<string, unknown>)[String(column.key)],
    header: () => <div className="flex items-center gap-2"><GripVertical className="h-3.5 w-3.5 text-muted" />{column.header}</div>,
    size: 180,
    minSize: 120,
    cell: ({ row }) => <div className="tabular-nums">{column.render ? column.render(row.original) : String((row.original as Record<string, unknown>)[String(column.key)] ?? "")}</div>
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

export function GlassTable<T extends object>({ columns, rows, empty = "No data", tableId = "default-table" }: { columns: GlassTableColumn<T>[]; rows: T[]; empty?: string; tableId?: string }) {
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

  const table = useReactTable({
    data: virtualRowsSource,
    columns: columns.map(buildColumn),
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

  return <GlassCard className="overflow-hidden p-0">
    <div className="border-b border-border px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-white/60 px-3 dark:bg-white/8"><Search className="h-4 w-4 text-muted" /><input value={search} onChange={(event) => { setSearch(event.target.value); setVirtualStart(0); setActiveCell({ row: 0, col: 0 }); }} placeholder="Search rows" className="h-10 w-full border-0 bg-transparent text-sm outline-none" /></div>
        <div className="flex flex-wrap items-center gap-2"><button type="button" className="flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm"><SlidersHorizontal className="h-4 w-4" />Filters</button><button type="button" onClick={() => exportCsv(tableId, exportHeaders, exportRows)} className="h-10 rounded-md border border-border px-3 text-sm">Export CSV</button><button type="button" onClick={() => exportSpreadsheetXml(tableId, exportHeaders, exportRows)} className="h-10 rounded-md border border-border px-3 text-sm">Export Excel</button><button type="button" onClick={() => exportPrintHtml(tableId, exportHeaders, exportRows)} className="h-10 rounded-md border border-border px-3 text-sm">Export PDF</button></div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs"><CheckSquare className="h-3 w-3" />{selectedCount} selected</span>{table.getAllLeafColumns().map((column) => <div key={column.id} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"><button type="button" aria-label={`Hide or show ${column.id}`} onClick={() => column.toggleVisibility(!column.getIsVisible())}><EyeOff className="h-3 w-3" /></button><span>{column.id}</span><button type="button" aria-label={`Move ${column.id} left`} onClick={() => setColumnOrder((current) => { const index = current.indexOf(column.id); if (index <= 0) return current; const next = [...current]; const a = next[index - 1]; const b = next[index]; if (a === undefined || b === undefined) return current; next[index - 1] = b; next[index] = a; return next; })}><ArrowLeftRight className="h-3 w-3 rotate-180" /></button><button type="button" aria-label={`Move ${column.id} right`} onClick={() => setColumnOrder((current) => { const index = current.indexOf(column.id); if (index < 0 || index >= current.length - 1) return current; const next = [...current]; const a = next[index]; const b = next[index + 1]; if (a === undefined || b === undefined) return current; next[index] = b; next[index + 1] = a; return next; })}><ArrowLeftRight className="h-3 w-3" /></button></div>)}<span className="rounded-md border border-border px-2 py-1 text-xs">{virtualRowsSource.length}/{totalRows} rows</span></div>
    </div>
    <div className="max-h-[640px] overflow-auto" onScroll={onScroll}>
      <table className="w-full border-separate border-spacing-0 text-sm" role="grid" aria-rowcount={totalRows} aria-colcount={visibleColumns.length + 1}>
        <thead className="sticky top-0 z-10 bg-white/85 backdrop-blur dark:bg-surface/90">{table.getHeaderGroups().map((headerGroup) => <tr key={headerGroup.id}><th className="sticky left-0 z-20 border-b border-border bg-white/85 px-3 py-3 dark:bg-surface/90"><input aria-label="Select all visible rows" type="checkbox" checked={table.getIsAllPageRowsSelected()} onChange={table.getToggleAllPageRowsSelectedHandler()} /></th>{headerGroup.headers.map((header, index) => <th key={header.id} draggable onDragStart={() => onDragStart(header.id)} onDragOver={onDragOver} onDrop={() => onDrop(header.id)} style={{ width: header.getSize() }} className={index === 0 ? "sticky left-12 z-10 border-b border-border bg-white/85 px-4 py-3 text-left font-medium text-muted dark:bg-surface/90" : "relative border-b border-border px-4 py-3 text-left font-medium text-muted"}><button type="button" onClick={header.column.getToggleSortingHandler()?.bind(header.column)} className="w-full cursor-grab text-left active:cursor-grabbing">{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</button><div onMouseDown={header.getResizeHandler()} onTouchStart={header.getResizeHandler()} className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-border/60" /></th>)}</tr>)}</thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? <tr><td colSpan={columns.length + 1} className="px-4 py-12 text-center text-muted">{empty}</td></tr> : <>
            {topSpacer > 0 ? <tr><td colSpan={columns.length + 1} style={{ height: topSpacer }} /></tr> : null}
            {table.getRowModel().rows.map((row, rowIndex) => <tr key={row.id} className="hover:bg-white/50 dark:hover:bg-white/5"><td className="sticky left-0 z-10 border-b border-border/70 bg-white/85 px-3 py-3 dark:bg-surface/90"><input aria-label={`Select row ${rowIndex + 1}`} type="checkbox" checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} /></td>{row.getVisibleCells().map((cell, colIndex) => <td key={cell.id} tabIndex={activeCell.row === rowIndex && activeCell.col === colIndex ? 0 : -1} onFocus={() => setActiveCell({ row: rowIndex, col: colIndex })} onKeyDown={(event) => onCellKeyDown(event, rowIndex, colIndex)} className={indexCellClass(colIndex)}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}
            {bottomSpacer > 0 ? <tr><td colSpan={columns.length + 1} style={{ height: bottomSpacer }} /></tr> : null}
          </>}
        </tbody>
      </table>
    </div>
  </GlassCard>;
}

function indexCellClass(index: number): string {
  return index === 0 ? "sticky left-12 z-10 border-b border-border/70 bg-white/85 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-surface/90" : "border-b border-border/70 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring";
}
