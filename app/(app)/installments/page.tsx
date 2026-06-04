"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MoneyField } from "@/components/forms/financial-inputs";
import { useQueryClient } from "@tanstack/react-query";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { GlassSkeleton } from "@/components/feedback/glass-feedback";
import { useListQuery } from "@/presentation/query/dashboard-hooks";
import { GlassDataSelect, GlassDatePicker, GlassInput } from "@/components/forms/glass-form";

interface Account { id: string; code: string; name: string; groupCode: number; isPostingAllowed: boolean; children?: Account[]; }
interface Customer { id: string; name: string; }
interface Schedule { id: string; sequence: number; dueDate: string; amount: string; paidAmount: string; status: string; }
interface Plan { id: string; planNumber: string; customerId: string; description: string; totalAmount: string; downPayment: string; financedAmount: string; tenor: number; status: string; schedules: Schedule[]; }

const flatten = (nodes: Account[]): Account[] => nodes.flatMap((n) => [n, ...flatten(n.children ?? [])]);
const idr = (v: string | number) => "Rp " + Math.round(Number(v)).toLocaleString("id-ID");
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

function printSchedule(plan: Plan, customerName: string) {
  const paidTotal = plan.schedules.reduce((s, x) => s + Number(x.paidAmount), 0);
  const outstanding = Number(plan.totalAmount) - Number(plan.downPayment) - paidTotal;
  const rows = plan.schedules.map((s) => `<tr><td>${s.sequence}</td><td>${String(s.dueDate).slice(0, 10)}</td><td class="r">${idr(s.amount)}</td><td class="r">${idr(s.paidAmount)}</td><td>${s.status === "PAID" ? "Lunas" : s.status === "PARTIAL" ? "Sebagian" : "Belum"}</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Jadwal Angsuran ${esc(plan.planNumber)}</title><style>
    body{font-family:Inter,Arial,sans-serif;padding:32px;color:#0b1220}
    h1{font-size:20px;margin:0 0 4px}.muted{color:#64748b;font-size:13px}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}
    .grid div{font-size:12px;color:#64748b}.grid b{display:block;font-size:15px;color:#0b1220;margin-top:2px}
    table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
    th,td{border:1px solid #e2e8f0;padding:8px 10px;text-align:left}th{background:#f8fafc}
    td.r,th.r{text-align:right}.foot{margin-top:24px;font-size:12px;color:#64748b}
  </style></head><body>
    <h1>Jadwal Angsuran</h1>
    <div class="muted">${esc(plan.planNumber)} &middot; ${esc(customerName)} &middot; ${esc(plan.description)}</div>
    <div class="grid">
      <div>Total<b>${idr(plan.totalAmount)}</b></div>
      <div>Uang muka (DP)<b>${idr(plan.downPayment)}</b></div>
      <div>Dibiayai<b>${idr(plan.financedAmount)}</b></div>
      <div>Sisa<b>${idr(outstanding)}</b></div>
    </div>
    <table><thead><tr><th>#</th><th>Jatuh tempo</th><th class="r">Jumlah</th><th class="r">Dibayar</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="foot">Angsuran flat tanpa bunga, ${plan.tenor}x. Dicetak ${new Date().toLocaleString("id-ID")}.</p>
    <script>window.onload=function(){window.print();}</script>
  </body></html>`;
  const w = window.open("", "_blank", "noopener,noreferrer,width=800,height=900");
  if (w) { w.document.write(html); w.document.close(); }
}

async function postJson(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || json?.message || json?.code || `Gagal (${res.status})`);
  return json;
}

export default function Page() {
  const qc = useQueryClient();
  const plans = useListQuery<Plan[]>("/api/installments", ["list", "installments"]);
  const customers = useListQuery<Customer[]>("/api/sales/customers", ["list", "sales-customers"]);
  const accounts = useListQuery<Account[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);

  const flat = useMemo(() => flatten(accounts.data?.data ?? []), [accounts.data]);
  const assetOptions = useMemo(() => flat.filter((a) => a.isPostingAllowed && a.groupCode === 1), [flat]);
  const revenueOptions = useMemo(() => flat.filter((a) => a.isPostingAllowed && a.groupCode === 4), [flat]);
  const customerList = customers.data?.data ?? [];
  const planList = plans.data?.data ?? [];

  const [form, setForm] = useState({ customerId: "", description: "", totalAmount: "", downPayment: "", tenor: "3", startDate: new Date().toISOString().slice(0, 10), arAccountId: "", revenueAccountId: "", dpCashAccountId: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { if (!form.customerId && customerList[0]) set("customerId", customerList[0].id); }, [customerList]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!form.arAccountId && assetOptions.length) set("arAccountId", (assetOptions.find((a) => a.code === "110201") ?? assetOptions[0]!).id); }, [assetOptions]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!form.dpCashAccountId && assetOptions.length) set("dpCashAccountId", (assetOptions.find((a) => a.code === "110101") ?? assetOptions[0]!).id); }, [assetOptions]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!form.revenueAccountId && revenueOptions.length) set("revenueAccountId", (revenueOptions.find((a) => a.code === "410101") ?? revenueOptions[0]!).id); }, [revenueOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  if (plans.isLoading || accounts.isLoading) return <GlassSkeleton className="h-72" />;

  const refresh = () => qc.invalidateQueries({ queryKey: ["list", "installments"] });

  async function createPlan() {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { customerId: form.customerId, description: form.description || "Cicilan", totalAmount: Number(form.totalAmount), tenor: Number(form.tenor), startDate: new Date(form.startDate).toISOString(), arAccountId: form.arAccountId, revenueAccountId: form.revenueAccountId };
      const dp = Number(form.downPayment) || 0;
      if (dp > 0) { body.downPayment = dp; body.dpCashAccountId = form.dpCashAccountId; }
      const res = await postJson("/api/installments", body);
      toast.success(`Rencana cicilan ${res.data.planNumber} dibuat.`);
      setForm((f) => ({ ...f, description: "", totalAmount: "", downPayment: "" }));
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal."); }
    finally { setBusy(false); }
  }

  async function paySchedule(plan: Plan, sch: Schedule) {
    const remaining = Number(sch.amount) - Number(sch.paidAmount);
    const cashId = (assetOptions.find((a) => a.code === "110101") ?? assetOptions[0])?.id;
    if (!cashId) return;
    setBusy(true);
    try {
      await postJson("/api/installments/pay", { scheduleId: sch.id, cashAccountId: cashId, amount: remaining, paymentDate: new Date().toISOString() });
      toast.success(`Angsuran #${sch.sequence} (${plan.planNumber}) dibayar ${idr(remaining)}.`);
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal."); }
    finally { setBusy(false); }
  }

  const customerName = (id: string) => customerList.find((c) => c.id === id)?.name ?? id;

  return <div className="grid gap-6">
    <WorkspaceHeader eyebrow="AR/AP" title="Cicilan" description="Penjualan kredit dengan jadwal angsuran flat (tanpa bunga). Uang muka opsional, posting piutang & pembayaran otomatis." />
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <GlassPanel className="grid gap-3 self-start">
        <h2 className="text-sm font-semibold">Rencana cicilan baru</h2>
        <label className="grid gap-1 text-xs">Pelanggan
          <GlassDataSelect value={form.customerId} onChange={(v) => set("customerId", v)} placeholder="Pilih pelanggan" options={customerList.map((c) => ({ value: c.id, label: c.name }))} className="h-9" />
        </label>
        <label className="grid gap-1 text-xs">Keterangan
          <GlassInput value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="cth: Cicilan TV LED" className="h-9" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs">Total harga
            <MoneyField value={form.totalAmount} onChange={(raw) => set("totalAmount", raw)} placeholder="1.000.000" className="h-9 rounded-md border border-border bg-transparent px-2 text-sm" />
          </label>
          <label className="grid gap-1 text-xs">Uang muka (DP)
            <MoneyField value={form.downPayment} onChange={(raw) => set("downPayment", raw)} placeholder="0" className="h-9 rounded-md border border-border bg-transparent px-2 text-sm" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs">Tenor (x)
            <GlassInput type="number" min={1} value={form.tenor} onChange={(e) => set("tenor", e.target.value)} className="h-9" />
          </label>
          <label className="grid gap-1 text-xs">Mulai
            <GlassDatePicker value={form.startDate} onChange={(v) => set("startDate", v)} className="h-9" />
          </label>
        </div>
        <label className="grid gap-1 text-xs">Akun piutang
          <GlassDataSelect value={form.arAccountId} onChange={(v) => set("arAccountId", v)} placeholder="Pilih akun piutang" options={assetOptions.map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }))} className="h-9" />
        </label>
        <label className="grid gap-1 text-xs">Akun pendapatan
          <GlassDataSelect value={form.revenueAccountId} onChange={(v) => set("revenueAccountId", v)} placeholder="Pilih akun pendapatan" options={revenueOptions.map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }))} className="h-9" />
        </label>
        {Number(form.downPayment) > 0 ? (
          <label className="grid gap-1 text-xs">Terima DP di (kas/bank)
            <GlassDataSelect value={form.dpCashAccountId} onChange={(v) => set("dpCashAccountId", v)} placeholder="Pilih akun kas/bank" options={assetOptions.map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }))} className="h-9" />
          </label>
        ) : null}
        {form.totalAmount && Number(form.tenor) > 0 ? <p className="text-xs text-muted">≈ {idr((Number(form.totalAmount) - (Number(form.downPayment) || 0)) / Number(form.tenor))} / bulan selama {form.tenor}x</p> : null}
        <button type="button" onClick={createPlan} disabled={busy || !form.customerId || !form.totalAmount || Number(form.totalAmount) <= 0} className="h-10 rounded-md bg-foreground text-sm font-medium text-background disabled:opacity-40">{busy ? "Memproses…" : "Buat rencana cicilan"}</button>
      </GlassPanel>

      <div className="grid gap-4 self-start">
        {planList.length === 0 ? <GlassPanel><p className="py-8 text-center text-sm text-muted">Belum ada rencana cicilan.</p></GlassPanel> : planList.map((plan) => {
          const paid = plan.schedules.reduce((s, x) => s + Number(x.paidAmount), 0);
          const outstanding = Number(plan.totalAmount) - Number(plan.downPayment) - paid;
          return <GlassPanel key={plan.id} className="grid gap-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-semibold">{plan.planNumber} · {customerName(plan.customerId)}</p><p className="text-xs text-muted">{plan.description}</p></div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => printSchedule(plan, customerName(plan.customerId))} className="h-7 rounded-md border border-border px-3 text-xs">Cetak</button>
                <span className={`rounded-md px-2 py-1 text-xs ${plan.status === "COMPLETED" ? "bg-success/15 text-success" : "bg-accent/15 text-accent"}`}>{plan.status === "COMPLETED" ? "Lunas" : "Aktif"}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted sm:grid-cols-4">
              <div>Total<p className="text-sm font-medium text-foreground tabular-nums">{idr(plan.totalAmount)}</p></div>
              <div>DP<p className="text-sm font-medium text-foreground tabular-nums">{idr(plan.downPayment)}</p></div>
              <div>Dibiayai<p className="text-sm font-medium text-foreground tabular-nums">{idr(plan.financedAmount)}</p></div>
              <div>Sisa<p className="text-sm font-medium text-foreground tabular-nums">{idr(outstanding)}</p></div>
            </div>
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-white/60 text-xs text-muted dark:bg-white/5"><tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Jatuh tempo</th><th className="px-3 py-2 text-right">Jumlah</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Aksi</th></tr></thead>
                <tbody>{plan.schedules.map((s) => <tr key={s.id} className="border-t border-border/60"><td className="px-3 py-2">{s.sequence}</td><td className="px-3 py-2">{String(s.dueDate).slice(0, 10)}</td><td className="px-3 py-2 text-right tabular-nums">{idr(s.amount)}</td><td className="px-3 py-2 text-center"><span className={`text-xs ${s.status === "PAID" ? "text-success" : s.status === "PARTIAL" ? "text-accent" : "text-muted"}`}>{s.status === "PAID" ? "Lunas" : s.status === "PARTIAL" ? "Sebagian" : "Belum"}</span></td><td className="px-3 py-2 text-right">{s.status !== "PAID" ? <button type="button" disabled={busy} onClick={() => paySchedule(plan, s)} className="h-7 rounded-md border border-border px-3 text-xs disabled:opacity-40">Bayar</button> : "—"}</td></tr>)}</tbody>
              </table>
            </div>
          </GlassPanel>;
        })}
      </div>
    </div>
  </div>;
}
