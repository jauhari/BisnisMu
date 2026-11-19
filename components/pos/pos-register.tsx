"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { GlassCard, GlassPanel } from "../glass/glass-primitives";
import { useListQuery } from "@/presentation/query/dashboard-hooks";
import { useQueryClient } from "@tanstack/react-query";
import { formatRupiah } from "@/presentation/format/number";
import { MoneyField } from "@/components/forms/financial-inputs";
import { GlassDataSelect, GlassInput, GlassDateTimePicker } from "@/components/forms/glass-form";

interface Product { id: string; sku: string; name: string; type: string; sellPrice?: string | number | null; buyPrice?: string | number | null; provider?: string | null; providerCode?: string | null; }
interface CartLine { id: string; sku: string; name: string; type: string; qty: number; unitPrice: number; costPrice: number; }
interface Customer { id: string; name: string; }
interface Account { id: string; code: string; name: string; groupCode: number; isPostingAllowed: boolean; children?: Account[]; }

const idr = (v: number) => formatRupiah(v);
const flattenAccounts = (nodes: Account[]): Account[] => nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]);

function profitInfo(unitPrice: number, costPrice: number, qty = 1) {
  const profit = (unitPrice - costPrice) * qty;
  const pct = costPrice > 0 ? ((unitPrice - costPrice) / costPrice * 100) : null;
  return { profit, pct };
}

async function postJson(path: string, body: unknown): Promise<any> {
  const res = await fetch(path, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || json?.code || `Gagal (${res.status})`);
  return json;
}

export function PosRegisterShell() {
  const qc = useQueryClient();
  const products = useListQuery<Product[]>("/api/inventory/products", ["list", "inventory-products"]);
  const customers = useListQuery<Customer[]>("/api/sales/customers", ["list", "sales-customers"]);
  const accounts = useListQuery<Account[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);

  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");
  const [arAccountId, setArAccountId] = useState("");
  const [revenueAccountId, setRevenueAccountId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"TUNAI" | "UTANG" | "CICILAN">("TUNAI");
  const [tenor, setTenor] = useState("3");
  const [downPayment, setDownPayment] = useState("");
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Quick-add customer
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [addingCust, setAddingCust] = useState(false);

  const productList: Product[] = products.data?.data ?? [];
  const customerList: Customer[] = customers.data?.data ?? [];
  const flatAccounts = useMemo(() => flattenAccounts(accounts.data?.data ?? []), [accounts.data]);
  const cashOptions = useMemo(() => flatAccounts.filter((a) => a.isPostingAllowed && a.groupCode === 1), [flatAccounts]);
  const revenueOptions = useMemo(() => flatAccounts.filter((a) => a.isPostingAllowed && a.groupCode === 4), [flatAccounts]);

  useEffect(() => { if (!customerId && customerList[0]) setCustomerId(customerList[0].id); }, [customerId, customerList]);
  useEffect(() => { if (!cashAccountId && cashOptions.length) setCashAccountId((cashOptions.find((a) => a.code === "110101") ?? cashOptions[0]!).id); }, [cashAccountId, cashOptions]);
  useEffect(() => { if (!arAccountId && cashOptions.length) setArAccountId((cashOptions.find((a) => a.code === "110201") ?? cashOptions[0]!).id); }, [arAccountId, cashOptions]);
  useEffect(() => { if (!revenueAccountId && revenueOptions.length) setRevenueAccountId((revenueOptions.find((a) => a.code === "410101") ?? revenueOptions[0]!).id); }, [revenueAccountId, revenueOptions]);

  async function quickAddCustomer() {
    if (!newCustName.trim()) return;
    setAddingCust(true);
    try {
      const res = await postJson("/api/contacts", { name: newCustName.trim(), type: "CUSTOMER", phone: newCustPhone || undefined });
      const newId = res.data?.customer?.id;
      if (newId) setCustomerId(newId);
      void qc.invalidateQueries({ queryKey: ["list", "sales-customers"] });
      setNewCustName(""); setNewCustPhone(""); setShowAddCustomer(false);
    } catch { /* ignore — customer list will refresh */ }
    finally { setAddingCust(false); }
  }

  const debitAccountId = paymentMethod === "TUNAI" ? cashAccountId : arAccountId;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return productList;
    return productList.filter((p) => `${p.name} ${p.sku} ${p.provider ?? ""} ${p.providerCode ?? ""}`.toLowerCase().includes(q));
  }, [productList, query]);

  const total = cart.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
  const totalCost = cart.reduce((sum, line) => sum + line.qty * line.costPrice, 0);
  const totalProfit = total - totalCost;
  const totalProfitPct = totalCost > 0 ? (totalProfit / totalCost * 100) : null;
  const itemCount = cart.reduce((sum, line) => sum + line.qty, 0);

  function addToCart(product: Product) {
    setResult(null);
    const sell = Number(product.sellPrice ?? 0);
    const buy = Number(product.buyPrice ?? 0);
    setCart((prev) => {
      const existing = prev.find((line) => line.id === product.id);
      if (existing) return prev.map((line) => line.id === product.id ? { ...line, qty: line.qty + 1 } : line);
      return [...prev, { id: product.id, sku: product.sku, name: product.name, type: product.type, qty: 1, unitPrice: sell, costPrice: buy }];
    });
  }

  const setQty = (id: string, qty: number) => setCart((prev) => prev.map((line) => line.id === id ? { ...line, qty: Math.max(1, qty) } : line));
  const setPrice = (id: string, unitPrice: number) => setCart((prev) => prev.map((line) => line.id === id ? { ...line, unitPrice: Math.max(0, unitPrice) } : line));
  const setCost = (id: string, costPrice: number) => setCart((prev) => prev.map((line) => line.id === id ? { ...line, costPrice: Math.max(0, costPrice) } : line));
  const removeLine = (id: string) => setCart((prev) => prev.filter((line) => line.id !== id));

  const methodLabel = paymentMethod === "TUNAI" ? "Tunai" : paymentMethod === "UTANG" ? "Utang" : "Cicilan";
  const dpNum = Number(downPayment) || 0;
  const tenorNum = Number(tenor) || 0;
  const canCheckout = cart.length > 0 && !!customerId && !!debitAccountId && !!revenueAccountId && total > 0 && !submitting && (paymentMethod !== "CICILAN" || (tenorNum >= 1 && dpNum < total));

  async function checkout() {
    if (!canCheckout) return;
    setSubmitting(true); setResult(null);
    try {
      const order = await postJson("/api/sales/orders", {
        customerId,
        saleDate: new Date(saleDate).toISOString(),
        description: `Penjualan POS (${methodLabel.toLowerCase()})`,
        revenueSettlementAccountId: revenueAccountId,
        arAccountId: debitAccountId,
        items: cart.map((line) => ({ productId: line.id, quantity: line.qty, unitPrice: line.unitPrice, unitCost: line.costPrice > 0 ? line.costPrice : undefined })),
      });
      await postJson("/api/sales/orders/confirm", { salesOrderId: order.data.id });
      if (paymentMethod === "CICILAN") {
        const body: Record<string, unknown> = { customerId, description: `Cicilan POS ${order.data.salesNumber}`, totalAmount: total, tenor: tenorNum, startDate: new Date().toISOString(), arAccountId: debitAccountId, salesOrderId: order.data.id };
        if (dpNum > 0) { body.downPayment = dpNum; body.dpCashAccountId = cashAccountId; }
        const plan = await postJson("/api/installments", body);
        setResult({ ok: true, msg: `${order.data.salesNumber} → Cicilan ${plan.data.planNumber} (${tenorNum}x) — ${idr(total)}` });
      } else {
        setResult({ ok: true, msg: `${order.data.salesNumber} (${methodLabel}) berhasil — ${idr(total)}` });
      }
      setCart([]); setDownPayment("");
    } catch (error) {
      setResult({ ok: false, msg: error instanceof Error ? error.message : "Checkout gagal." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-8rem)] gap-4 xl:grid-cols-[1fr_420px]">
      {/* Produk */}
      <GlassPanel className="grid grid-rows-[auto_1fr] gap-4">
        <div className="flex items-center gap-2 rounded-md border border-border bg-white/60 px-3 dark:bg-white/8">
          <Search className="h-4 w-4 text-muted" />
          <GlassInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari produk — nama, SKU, provider, kode PPOB…" className="h-11 w-full border-0 bg-transparent shadow-none backdrop-blur-none" />
        </div>
        {products.isLoading ? (
          <div className="grid place-items-center text-sm text-muted">Memuat produk…</div>
        ) : productList.length === 0 ? (
          <div className="grid place-items-center text-sm text-muted">Belum ada produk. Tambahkan di Inventory → Products.</div>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center text-sm text-muted">Tidak ada produk yang cocok.</div>
        ) : (
          <div className="grid content-start gap-3 md:grid-cols-3 xl:grid-cols-4">
            {filtered.map((product) => {
              const sell = Number(product.sellPrice ?? 0);
              const buy = Number(product.buyPrice ?? 0);
              const { pct } = profitInfo(sell, buy);
              return (
                <button key={product.id} type="button" onClick={() => addToCart(product)} className="text-left transition hover:scale-[1.02] active:scale-95">
                  <GlassCard className="grid h-full gap-1">
                    <span className="font-medium leading-tight">{product.name}</span>
                    <span className="text-xs text-muted">{product.sku}{product.providerCode ? ` · ${product.providerCode}` : ""}</span>
                    <span className="text-sm font-semibold tabular-nums">{sell ? idr(sell) : "—"}</span>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wide text-muted">{product.type}</span>
                      {buy > 0 && sell > 0 ? (
                        <span className={`text-[11px] font-medium ${sell > buy ? "text-success" : "text-danger"}`}>
                          {pct !== null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%` : ""}
                        </span>
                      ) : null}
                    </div>
                  </GlassCard>
                </button>
              );
            })}
          </div>
        )}
      </GlassPanel>

      {/* Keranjang */}
      <GlassPanel className="grid grid-rows-[auto_1fr_auto] gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Keranjang</h2>
          {cart.length > 0 ? <button type="button" onClick={() => setCart([])} className="text-xs text-muted underline-offset-2 hover:underline">Kosongkan</button> : null}
        </div>

        <div className="grid content-start gap-2 overflow-auto rounded-lg border border-border p-3">
          {cart.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Keranjang kosong.</p>
          ) : cart.map((line) => {
            const { profit, pct } = profitInfo(line.unitPrice, line.costPrice, line.qty);
            const isDigital = line.type === "DIGITAL";
            return (
              <div key={line.id} className="grid gap-2 rounded-md border border-border/70 bg-white/50 p-3 dark:bg-white/5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    <p className="text-xs text-muted">{line.sku}</p>
                  </div>
                  <button type="button" onClick={() => removeLine(line.id)} className="text-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-0.5">
                    <span className="text-[11px] text-muted">Harga jual</span>
                    <MoneyField
                      value={String(line.unitPrice)}
                      onChange={(raw) => setPrice(line.id, Number(raw) || 0)}
                      className="h-7 rounded-md border border-border bg-transparent px-2 text-right text-sm"
                    />
                  </label>
                  <label className="grid gap-0.5">
                    <span className={`text-[11px] ${isDigital ? "font-medium text-accent" : "text-muted"}`}>
                      Harga modal{isDigital ? " (PPOB)" : ""}
                    </span>
                    <MoneyField
                      value={String(line.costPrice)}
                      onChange={(raw) => setCost(line.id, Number(raw) || 0)}
                      className={`h-7 rounded-md border px-2 text-right text-sm ${isDigital ? "border-accent/60 bg-accent/5" : "border-border bg-transparent"}`}
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setQty(line.id, line.qty - 1)} className="grid h-7 w-7 place-items-center rounded-md border border-border"><Minus className="h-3 w-3" /></button>
                    <GlassInput type="number" min={1} value={line.qty} onChange={(e) => setQty(line.id, Number(e.target.value) || 1)} className="h-7 w-12 text-center" />
                    <button type="button" onClick={() => setQty(line.id, line.qty + 1)} className="grid h-7 w-7 place-items-center rounded-md border border-border"><Plus className="h-3 w-3" /></button>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums">{idr(line.qty * line.unitPrice)}</p>
                    {line.costPrice > 0 ? (
                      <p className={`text-[11px] tabular-nums ${profit >= 0 ? "text-success" : "text-danger"}`}>
                        Profit {idr(profit)}{pct !== null ? ` (${pct.toFixed(1)}%)` : ""}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-3">
          {/* Tanggal & jam transaksi */}
          <label className="grid gap-1 text-xs">
            Tanggal &amp; jam transaksi
            <GlassDateTimePicker value={saleDate} onChange={setSaleDate} className="h-9" />
          </label>

          {/* Rekap profit */}
          {cart.length > 0 && totalCost > 0 ? (
            <div className="rounded-lg border border-border/60 bg-white/40 px-3 py-2 text-xs dark:bg-white/5">
              <div className="grid grid-cols-3 gap-2 text-muted">
                <div>Omset<p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">{idr(total)}</p></div>
                <div>Modal<p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">{idr(totalCost)}</p></div>
                <div className={totalProfit >= 0 ? "text-success" : "text-danger"}>
                  Profit
                  <p className="mt-0.5 text-sm font-bold tabular-nums">
                    {idr(totalProfit)}
                    {totalProfitPct !== null ? <span className="ml-1 text-[11px] font-normal">({totalProfitPct.toFixed(1)}%)</span> : null}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-2 text-xs">
            <div className="flex gap-2">
              {(["TUNAI", "UTANG", "CICILAN"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setPaymentMethod(m)} className={`h-9 flex-1 rounded-md border text-sm ${paymentMethod === m ? "border-foreground bg-foreground text-background" : "border-border"}`}>
                  {m === "TUNAI" ? "Tunai" : m === "UTANG" ? "Utang" : "Cicilan"}
                </button>
              ))}
            </div>
            {paymentMethod === "CICILAN" ? (
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1">Tenor (x)<GlassInput type="number" min={1} value={tenor} onChange={(e) => setTenor(e.target.value)} className="h-9 text-foreground" /></label>
                <label className="grid gap-1">Uang muka (DP)
                <MoneyField value={downPayment} onChange={(raw) => setDownPayment(raw)} className="h-9 rounded-md border border-border bg-transparent px-2 text-sm text-foreground" />
              </label>
                {tenorNum >= 1 ? <p className="col-span-2 text-[11px] text-muted">≈ {idr((total - dpNum) / tenorNum)} / bulan × {tenorNum}{dpNum > 0 ? " (DP diterima di kas)" : ""}</p> : null}
              </div>
            ) : null}
            <div className="grid gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Pelanggan</span>
                <button type="button" onClick={() => setShowAddCustomer((v) => !v)} title="Tambah pelanggan baru" className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-accent hover:bg-accent/10">
                  {showAddCustomer ? <X className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                  {showAddCustomer ? "Batal" : "Tambah baru"}
                </button>
              </div>
              {showAddCustomer ? (
                <div className="grid gap-2 rounded-lg border border-accent/40 bg-accent/5 p-2">
                  <GlassInput value={newCustName} onChange={(e) => setNewCustName(e.target.value)} placeholder="Nama pelanggan *" className="h-8" autoFocus />
                  <GlassInput value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} placeholder="Nomor telepon (opsional)" className="h-8" />
                  <button type="button" disabled={addingCust || !newCustName.trim()} onClick={() => void quickAddCustomer()} className="h-8 rounded-md bg-accent text-xs font-medium text-white disabled:opacity-40">
                    {addingCust ? "Menyimpan…" : "Simpan & pilih"}
                  </button>
                </div>
              ) : (
                <GlassDataSelect
                  value={customerId}
                  onChange={setCustomerId}
                  options={customerList.map((c) => ({ value: c.id, label: c.name }))}
                  placeholder="Pilih pelanggan…"
                  className="h-9"
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {paymentMethod === "TUNAI" ? (
                <label className="grid gap-1">Terima di (kas/bank)
                  <GlassDataSelect value={cashAccountId} onChange={setCashAccountId} options={cashOptions.map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }))} placeholder="Pilih akun…" className="h-9" />
                </label>
              ) : (
                <label className="grid gap-1">Akun piutang
                  <GlassDataSelect value={arAccountId} onChange={setArAccountId} options={cashOptions.map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }))} placeholder="Pilih akun…" className="h-9" />
                </label>
              )}
              <label className="grid gap-1">Akun pendapatan
                <GlassDataSelect value={revenueAccountId} onChange={setRevenueAccountId} options={revenueOptions.map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }))} placeholder="Pilih akun…" className="h-9" />
              </label>
            </div>
          </div>

          {result ? <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-success" : "text-danger"}`}>{result.msg}</p> : null}
          <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
            <span className="text-muted">{itemCount} item</span>
            <span className="text-lg font-semibold tabular-nums">{idr(total)}</span>
          </div>
          <button type="button" onClick={checkout} disabled={!canCheckout} className="h-14 rounded-md bg-foreground text-background disabled:opacity-40">
            {submitting ? "Memproses…" : "Checkout  F8"}
          </button>
        </div>
      </GlassPanel>
    </div>
  );
}
