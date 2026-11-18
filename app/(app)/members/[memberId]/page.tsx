"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassDataSelect, GlassDatePicker, GlassField, GlassInput } from "@/components/forms/glass-form";
import { useListQuery } from "@/presentation/query/dashboard-hooks";

const SAVING_TYPES = [
  { value: "POKOK", label: "Simpanan Pokok" },
  { value: "WAJIB", label: "Simpanan Wajib" },
  { value: "SUKARELA", label: "Simpanan Sukarela" },
];

const DIRECTIONS = [
  { value: "DEPOSIT", label: "Setoran" },
  { value: "WITHDRAWAL", label: "Penarikan" },
];

function toNum(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function rp(value: unknown): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(toNum(value));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function apiJson(path: string, method: string, body?: unknown) {
  const init: RequestInit = { method, credentials: "include", headers: { "content-type": "application/json" } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(path, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || json?.message || `Gagal (${res.status})`);
  return json;
}

export default function Page() {
  const params = useParams<{ memberId: string }>();
  const memberId = params.memberId;
  const qc = useQueryClient();

  const detail = useListQuery<any>(`/api/members/${memberId}`, ["member", memberId]);
  const coa = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "coa"]);

  const data = (detail.data as any)?.data ?? null;
  const accounts: any[] = (coa.data as any)?.data ?? [];

  const accountOptions = useMemo(
    () => accounts.map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` })),
    [accounts],
  );
  const cashOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.subtype === "cash" || a.subtype === "bank")
        .map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` })),
    [accounts],
  );
  const equityOptions = useMemo(
    () =>
      accounts
        .filter((a) => String(a.code).startsWith("3"))
        .map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` })),
    [accounts],
  );
  const receivableOptions = useMemo(
    () =>
      accounts
        .filter((a) => String(a.code).startsWith("1"))
        .map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` })),
    [accounts],
  );
  const interestOptions = useMemo(
    () =>
      accounts
        .filter((a) => String(a.code).startsWith("4"))
        .map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` })),
    [accounts],
  );

  // ── form simpanan ─────────────────────────────────────────────────────────
  const [savingType, setSavingType] = useState("WAJIB");
  const [savingDirection, setSavingDirection] = useState("DEPOSIT");
  const [savingAccountId, setSavingAccountId] = useState("");
  const [savingCashAccountId, setSavingCashAccountId] = useState("");
  const [savingAmount, setSavingAmount] = useState("");
  const [savingDate, setSavingDate] = useState(today());
  const [savingBusy, setSavingBusy] = useState(false);

  // ── form pinjaman ─────────────────────────────────────────────────────────
  const [loanAccountId, setLoanAccountId] = useState("");
  const [loanCashAccountId, setLoanCashAccountId] = useState("");
  const [loanPrincipal, setLoanPrincipal] = useState("");
  const [loanTerm, setLoanTerm] = useState("12");
  const [loanRate, setLoanRate] = useState("");
  const [loanDate, setLoanDate] = useState(today());
  const [loanBusy, setLoanBusy] = useState(false);

  // ── form bayar angsuran ───────────────────────────────────────────────────
  const [payTarget, setPayTarget] = useState<{ loanId: string; installmentNo: number; total: number } | null>(null);
  const [payCashAccountId, setPayCashAccountId] = useState("");
  const [payInterestAccountId, setPayInterestAccountId] = useState("");
  const [payDate, setPayDate] = useState(today());
  const [payBusy, setPayBusy] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["member", memberId] });
    qc.invalidateQueries({ queryKey: ["list"] });
  };

  async function submitSaving() {
    if (!savingAccountId || !savingCashAccountId || !savingAmount) {
      toast.error("Akun simpanan, akun kas, dan jumlah wajib diisi");
      return;
    }
    setSavingBusy(true);
    try {
      await apiJson(`/api/members/${memberId}/savings`, "POST", {
        type: savingType,
        direction: savingDirection,
        savingsAccountId: savingAccountId,
        cashAccountId: savingCashAccountId,
        amount: savingAmount,
        transactionDate: savingDate,
      });
      toast.success("Transaksi simpanan terposting");
      setSavingAmount("");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan");
    } finally {
      setSavingBusy(false);
    }
  }

  async function submitLoan() {
    if (!loanAccountId || !loanCashAccountId || !loanPrincipal) {
      toast.error("Akun piutang, akun kas, dan pokok wajib diisi");
      return;
    }
    setLoanBusy(true);
    try {
      const payload: Record<string, unknown> = {
        loanAccountId,
        cashAccountId: loanCashAccountId,
        principal: loanPrincipal,
        disbursedOn: loanDate,
        termMonths: Number(loanTerm) || 12,
      };
      if (loanRate.trim() !== "") payload.interestRateBps = Number(loanRate);
      await apiJson(`/api/members/${memberId}/loans`, "POST", payload);
      toast.success("Pinjaman dicairkan dan jadwal angsuran dibuat");
      setLoanPrincipal("");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mencairkan pinjaman");
    } finally {
      setLoanBusy(false);
    }
  }

  async function submitPayment() {
    if (!payTarget || !payCashAccountId) {
      toast.error("Akun kas wajib diisi");
      return;
    }
    setPayBusy(true);
    try {
      const payload: Record<string, unknown> = {
        installmentNo: payTarget.installmentNo,
        cashAccountId: payCashAccountId,
        paidOn: payDate,
      };
      if (payInterestAccountId) payload.interestIncomeAccountId = payInterestAccountId;
      await apiJson(`/api/members/${memberId}/loans/${payTarget.loanId}/installments`, "POST", payload);
      toast.success("Angsuran dibayar");
      setPayTarget(null);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membayar angsuran");
    } finally {
      setPayBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="grid gap-6">
        <WorkspaceHeader eyebrow="Koperasi" title="Kartu Anggota" description="Memuat data anggota…" />
      </div>
    );
  }

  const member = data.member;
  const savings = data.savings ?? {};
  const savingsRows = (data.recentSavings ?? []).map((s: any) => ({
    id: s.id,
    transactionDate: String(s.transactionDate).slice(0, 10),
    type: SAVING_TYPES.find((t) => t.value === s.type)?.label ?? s.type,
    direction: DIRECTIONS.find((d) => d.value === s.direction)?.label ?? s.direction,
    amount: rp(s.amount),
    note: s.note ?? "—",
  }));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <WorkspaceHeader
          eyebrow={`Anggota ${member.memberNumber}`}
          title={member.name}
          description={[member.phone, member.address].filter(Boolean).join(" · ") || "Kartu simpanan dan pinjaman anggota"}
        />
        <Link href="/members" className="h-9 rounded-md border border-border px-3 text-sm leading-9">
          ← Daftar anggota
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Simpanan Pokok", value: savings.POKOK },
          { label: "Simpanan Wajib", value: savings.WAJIB },
          { label: "Simpanan Sukarela", value: savings.SUKARELA },
          { label: "Sisa Pinjaman", value: data.loanOutstanding },
        ].map((card) => (
          <GlassPanel key={card.label} className="grid gap-1">
            <span className="text-xs uppercase tracking-wide text-muted">{card.label}</span>
            <span className="text-lg font-semibold">{rp(card.value)}</span>
          </GlassPanel>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
          <GlassPanel className="grid gap-3">
            <p className="text-sm font-semibold">Riwayat simpanan</p>
            <GlassTable
              tableId={`member-savings-${memberId}`}
              columns={[
                { key: "transactionDate", header: "Tanggal" },
                { key: "type", header: "Jenis" },
                { key: "direction", header: "Arah" },
                { key: "amount", header: "Jumlah" },
                { key: "note", header: "Catatan" },
              ]}
              rows={savingsRows}
              empty="Belum ada transaksi simpanan."
            />
          </GlassPanel>

          <GlassPanel className="grid gap-3">
            <p className="text-sm font-semibold">Pinjaman</p>
            {(data.loans ?? []).length === 0 ? (
              <p className="text-sm text-muted">Belum ada pinjaman.</p>
            ) : (
              <div className="grid gap-3">
                {(data.loans ?? []).map((loan: any) => (
                  <div key={loan.id} className="grid gap-2 rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{loan.loanNumber}</span>
                      <span className="text-muted">
                        Pokok {rp(loan.principal)} · {loan.termMonths} bulan · bunga {(loan.interestRateBps / 100).toFixed(2)}%/bln
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          loan.status === "PAID" ? "bg-success/12 text-success" : "bg-accent/12 text-accent"
                        }`}
                      >
                        {loan.status === "PAID" ? "Lunas" : "Berjalan"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(loan.installments ?? []).map((inst: any) => {
                        const total = toNum(inst.principalDue) + toNum(inst.interestDue);
                        const paid = inst.status === "PAID";
                        return (
                          <button
                            key={inst.id}
                            type="button"
                            disabled={paid}
                            onClick={() =>
                              setPayTarget({ loanId: loan.id, installmentNo: inst.installmentNo, total })
                            }
                            className={`rounded-md border px-2 py-1 text-xs transition ${
                              paid
                                ? "border-success/40 bg-success/10 text-success"
                                : "border-border hover:bg-white/60 dark:hover:bg-white/10"
                            }`}
                            title={`Jatuh tempo ${String(inst.dueDate).slice(0, 10)}`}
                          >
                            #{inst.installmentNo} · {rp(total)}
                            {paid ? " ✓" : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassPanel>
        </div>

        <div className="grid gap-4">
          <GlassPanel className="grid gap-3">
            <p className="text-sm font-semibold">Catat simpanan</p>
            <GlassField label="Jenis">
              <GlassDataSelect value={savingType} onChange={setSavingType} options={SAVING_TYPES} />
            </GlassField>
            <GlassField label="Arah">
              <GlassDataSelect value={savingDirection} onChange={setSavingDirection} options={DIRECTIONS} />
            </GlassField>
            <GlassField label="Akun simpanan">
              <GlassDataSelect value={savingAccountId} onChange={setSavingAccountId} options={equityOptions} placeholder="Pilih akun ekuitas" />
            </GlassField>
            <GlassField label="Akun kas/bank">
              <GlassDataSelect value={savingCashAccountId} onChange={setSavingCashAccountId} options={cashOptions} placeholder="Pilih akun kas" />
            </GlassField>
            <GlassField label="Jumlah">
              <GlassInput value={savingAmount} onChange={(e) => setSavingAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="100000" />
            </GlassField>
            <GlassField label="Tanggal">
              <GlassDatePicker value={savingDate} onChange={setSavingDate} />
            </GlassField>
            <button
              type="button"
              onClick={submitSaving}
              disabled={savingBusy}
              className="h-9 rounded-md bg-foreground text-sm font-medium text-background disabled:opacity-50"
            >
              {savingBusy ? "Menyimpan…" : "Posting simpanan"}
            </button>
          </GlassPanel>

          <GlassPanel className="grid gap-3">
            <p className="text-sm font-semibold">Cairkan pinjaman</p>
            <GlassField label="Akun piutang pinjaman">
              <GlassDataSelect value={loanAccountId} onChange={setLoanAccountId} options={receivableOptions} placeholder="Pilih akun aset" />
            </GlassField>
            <GlassField label="Akun kas/bank">
              <GlassDataSelect value={loanCashAccountId} onChange={setLoanCashAccountId} options={cashOptions} placeholder="Pilih akun kas" />
            </GlassField>
            <GlassField label="Pokok pinjaman">
              <GlassInput value={loanPrincipal} onChange={(e) => setLoanPrincipal(e.target.value.replace(/[^0-9]/g, ""))} placeholder="1000000" />
            </GlassField>
            <GlassField label="Tenor (bulan)">
              <GlassInput value={loanTerm} onChange={(e) => setLoanTerm(e.target.value.replace(/[^0-9]/g, ""))} placeholder="12" />
            </GlassField>
            <GlassField label="Bunga (basis poin, opsional)">
              <GlassInput value={loanRate} onChange={(e) => setLoanRate(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Kosongkan = pakai setting" />
            </GlassField>
            <GlassField label="Tanggal cair">
              <GlassDatePicker value={loanDate} onChange={setLoanDate} />
            </GlassField>
            <button
              type="button"
              onClick={submitLoan}
              disabled={loanBusy}
              className="h-9 rounded-md bg-foreground text-sm font-medium text-background disabled:opacity-50"
            >
              {loanBusy ? "Memproses…" : "Cairkan pinjaman"}
            </button>
          </GlassPanel>

          {payTarget ? (
            <GlassPanel className="grid gap-3 border-accent/40 bg-accent/5">
              <p className="text-sm font-semibold">Bayar angsuran #{payTarget.installmentNo}</p>
              <p className="text-xs text-muted">Total {rp(payTarget.total)}</p>
              <GlassField label="Akun kas/bank">
                <GlassDataSelect value={payCashAccountId} onChange={setPayCashAccountId} options={cashOptions} placeholder="Pilih akun kas" />
              </GlassField>
              <GlassField label="Akun pendapatan bunga">
                <GlassDataSelect
                  value={payInterestAccountId}
                  onChange={setPayInterestAccountId}
                  options={interestOptions}
                  placeholder="Wajib jika ada bunga"
                />
              </GlassField>
              <GlassField label="Tanggal bayar">
                <GlassDatePicker value={payDate} onChange={setPayDate} />
              </GlassField>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={submitPayment}
                  disabled={payBusy}
                  className="h-9 flex-1 rounded-md bg-foreground text-sm font-medium text-background disabled:opacity-50"
                >
                  {payBusy ? "Memproses…" : "Bayar"}
                </button>
                <button type="button" onClick={() => setPayTarget(null)} className="h-9 rounded-md border border-border px-3 text-sm">
                  Batal
                </button>
              </div>
            </GlassPanel>
          ) : null}

          <GlassPanel className="grid gap-2">
            <p className="text-sm font-semibold">Akun belum diatur?</p>
            <p className="text-xs text-muted">
              Modul ini memakai akun dari Bagan Akun. Pastikan sudah ada akun simpanan (grup 3), kas/bank (subtype cash/bank),
              piutang pinjaman (grup 1), dan pendapatan bunga (grup 4).
            </p>
            <Link href="/accounting/chart-of-accounts" className="text-xs text-accent underline">
              Buka Bagan Akun →
            </Link>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
