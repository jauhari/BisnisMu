import { DashboardDateRange, DashboardError, DashboardInput, DashboardOverview, FloatDashboardAnalytics, InventoryDashboardAnalytics, RankedAmount, SalesDashboardAnalytics } from "./dashboard-types";

/** Sign of (a - b) without precision loss from casting large bigints to Number. */
function cmpBigInt(a: bigint, b: bigint): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export class DashboardEngine {
  getDashboardOverview(range: DashboardDateRange, input: DashboardInput): DashboardOverview {
    const activeSalesOrders = (input.salesOrders ?? []).filter((order) => this.inRange(range, order.businessId, order.saleDate) && order.status !== "VOID");
    const activeCashTransactions = (input.cashTransactions ?? []).filter((tx) => tx.businessId === range.businessId && tx.status === "POSTED" && tx.transactionDate >= range.startsOn && tx.transactionDate <= range.endsOn);

    const salesTrendItems = activeSalesOrders.map((order) => ({ date: order.saleDate, amount: order.totalAmount }));
    const cashTrendItems = activeCashTransactions.map((tx) => ({ date: tx.transactionDate, amount: tx.type === "CASH_IN" ? tx.amount : -tx.amount }));

    return {
      businessId: range.businessId,
      startsOn: range.startsOn,
      endsOn: range.endsOn,
      sales: this.getSalesAnalytics(range, input),
      profitability: this.getProfitabilityAnalytics(input),
      cash: this.getCashAnalytics(range, input),
      receivable: this.getReceivableAnalytics(range, input),
      payable: this.getPayableAnalytics(range, input),
      inventory: this.getInventoryAnalytics(range, input),
      float: this.getFloatAnalytics(range, input),
      customer: this.getCustomerAnalytics(range, input),
      vendor: this.getVendorAnalytics(range, input),
      salesTrend: this.getTrendPoints(range.startsOn, range.endsOn, salesTrendItems),
      cashTrend: this.getTrendPoints(range.startsOn, range.endsOn, cashTrendItems)
    };
  }

  getSalesAnalytics(range: DashboardDateRange, input: DashboardInput): SalesDashboardAnalytics {
    const orders = (input.salesOrders ?? []).filter((order) => this.inRange(range, order.businessId, order.saleDate) && order.status !== "VOID");
    const today = this.asOf(range);
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const prevMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    const prevMonthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0, 23, 59, 59, 999));
    const salesToday = orders.filter((order) => this.sameUtcDate(order.saleDate, today)).reduce((sum, order) => sum + order.totalAmount, 0n);
    const salesThisMonth = (input.salesOrders ?? []).filter((order) => order.businessId === range.businessId && order.status !== "VOID" && order.saleDate >= monthStart && order.saleDate <= today).reduce((sum, order) => sum + order.totalAmount, 0n);
    const previousMonthSales = (input.salesOrders ?? []).filter((order) => order.businessId === range.businessId && order.status !== "VOID" && order.saleDate >= prevMonthStart && order.saleDate <= prevMonthEnd).reduce((sum, order) => sum + order.totalAmount, 0n);
    const salesGrowth = salesThisMonth - previousMonthSales;
    return { salesToday, salesThisMonth, salesGrowth, topProducts: this.topSalesProducts(orders, input), topCategories: this.topSalesCategories(orders, input) };
  }

  getInventoryAnalytics(range: DashboardDateRange, input: DashboardInput): InventoryDashboardAnalytics {
    const threshold = range.lowStockThreshold ?? 5n;
    const products = (input.products ?? []).filter((product) => product.businessId === range.businessId);
    const productById = new Map(products.map((product) => [product.id, product]));
    const balances = (input.inventoryBalances ?? []).filter((balance) => balance.businessId === range.businessId);
    const movements = (input.inventoryMovements ?? []).filter((movement) => this.inRange(range, movement.businessId, movement.movementDate));
    const inventoryValue = balances.reduce((sum, balance) => sum + balance.inventoryValue, 0n);
    const lowStockItems = balances.filter((balance) => balance.quantity <= threshold).map((balance) => ({ productId: balance.productId, sku: productById.get(balance.productId)?.sku ?? balance.productId, name: productById.get(balance.productId)?.name ?? balance.productId, quantity: balance.quantity, inventoryValue: balance.inventoryValue })).sort((a, b) => cmpBigInt(a.quantity, b.quantity) || a.name.localeCompare(b.name));
    const stockOutTotals = new Map<string, bigint>();
    for (const movement of movements.filter((movement) => movement.type === "STOCK_OUT" || movement.type === "DIGITAL_CONSUMPTION")) stockOutTotals.set(movement.productId, (stockOutTotals.get(movement.productId) ?? 0n) + movement.quantity);
    const ranked = [...stockOutTotals.entries()].map(([id, quantity]) => ({ id, name: productById.get(id)?.name ?? id, amount: quantity, count: 1, quantity })).sort((a, b) => cmpBigInt(b.quantity!, a.quantity!) || a.name.localeCompare(b.name));
    return { inventoryValue, lowStockItems, fastMovingItems: ranked.slice(0, 5), slowMovingItems: ranked.slice().reverse().slice(0, 5) };
  }

  getCashAnalytics(range: DashboardDateRange, input: DashboardInput) {
    const cashBalances = (input.cashBalances ?? []).filter((balance) => balance.businessId === range.businessId);
    const cashOnHand = cashBalances.filter((balance) => balance.subtype === "cash").reduce((sum, balance) => sum + balance.balance, 0n);
    const bankBalance = cashBalances.filter((balance) => balance.subtype === "bank").reduce((sum, balance) => sum + balance.balance, 0n);
    const today = this.asOf(range);
    const cashFlowToday = (input.cashTransactions ?? []).filter((tx) => tx.businessId === range.businessId && tx.status === "POSTED" && this.sameUtcDate(tx.transactionDate, today)).reduce((sum, tx) => sum + (tx.type === "CASH_OUT" ? -tx.amount : tx.type === "CASH_IN" ? tx.amount : 0n), 0n);
    return { cashOnHand, bankBalance, cashFlowToday };
  }

  getFloatAnalytics(range: DashboardDateRange, input: DashboardInput): FloatDashboardAnalytics {
    const threshold = range.lowFloatThreshold ?? 100000n;
    const accounts = (input.floatAccounts ?? []).filter((account) => account.businessId === range.businessId);
    const transactions = (input.floatTransactions ?? []).filter((tx) => this.inRange(range, tx.businessId, tx.transactionDate));
    const today = this.asOf(range);
    const totalFloatBalance = accounts.reduce((sum, account) => sum + account.currentBalance, 0n);
    const floatUsageToday = transactions.filter((tx) => tx.type === "CONSUME" && this.sameUtcDate(tx.transactionDate, today)).reduce((sum, tx) => sum + tx.amount, 0n);
    const byProvider = new Map<string, { provider: string; balance: bigint; accountCount: number }>();
    for (const account of accounts) { const row = byProvider.get(account.provider) ?? { provider: account.provider, balance: 0n, accountCount: 0 }; row.balance += account.currentBalance; row.accountCount += 1; byProvider.set(account.provider, row); }
    return { totalFloatBalance, floatUsageToday, lowFloatProviders: [...byProvider.values()].filter((row) => row.balance <= threshold).sort((a, b) => cmpBigInt(a.balance, b.balance) || a.provider.localeCompare(b.provider)) };
  }

  getCustomerAnalytics(range: DashboardDateRange, input: DashboardInput) {
    const customers = (input.customers ?? []).filter((customer) => customer.businessId === range.businessId);
    const invoices = (input.invoices ?? []).filter((invoice) => invoice.businessId === range.businessId);
    const deposits = (input.customerWallets ?? []).filter((wallet) => wallet.businessId === range.businessId).reduce((sum, wallet) => sum + wallet.currentBalance, 0n);
    return { activeCustomers: customers.filter((customer) => customer.isActive).length, topCustomers: this.topByCustomer(invoices, customers), customerDepositBalance: deposits };
  }

  getVendorAnalytics(range: DashboardDateRange, input: DashboardInput) {
    const vendors = (input.vendors ?? []).filter((vendor) => vendor.businessId === range.businessId);
    const bills = (input.bills ?? []).filter((bill) => bill.businessId === range.businessId);
    return { topVendors: this.topByVendor(bills, vendors), vendorOutstandingBalance: bills.reduce((sum, bill) => sum + this.outstanding(bill.subtotal, bill.paidAmount), 0n) };
  }

  private getProfitabilityAnalytics(input: DashboardInput) { const grossProfit = input.profitAndLoss?.grossProfit ?? 0n; const netProfit = input.profitAndLoss?.netIncome ?? 0n; const revenue = input.profitAndLoss?.revenue.total ?? 0n; return { grossProfit, netProfit, profitMargin: revenue === 0n ? 0 : Number((netProfit * 10000n) / revenue) / 100 }; }
  private getReceivableAnalytics(range: DashboardDateRange, input: DashboardInput) { const asOf = this.asOf(range); const invoices = (input.invoices ?? []).filter((invoice) => invoice.businessId === range.businessId && invoice.status !== "VOID"); return { totalReceivable: invoices.reduce((sum, invoice) => sum + this.outstanding(invoice.subtotal, invoice.paidAmount), 0n), overdueReceivable: invoices.filter((invoice) => invoice.dueDate < asOf && invoice.status !== "PAID").reduce((sum, invoice) => sum + this.outstanding(invoice.subtotal, invoice.paidAmount), 0n) }; }
  private getPayableAnalytics(range: DashboardDateRange, input: DashboardInput) { const asOf = this.asOf(range); const bills = (input.bills ?? []).filter((bill) => bill.businessId === range.businessId && bill.status !== "VOID"); return { totalPayable: bills.reduce((sum, bill) => sum + this.outstanding(bill.subtotal, bill.paidAmount), 0n), overduePayable: bills.filter((bill) => bill.dueDate < asOf && bill.status !== "PAID").reduce((sum, bill) => sum + this.outstanding(bill.subtotal, bill.paidAmount), 0n) }; }

  private topSalesProducts(orders: NonNullable<DashboardInput["salesOrders"]>, input: DashboardInput): RankedAmount[] { const products = new Map((input.products ?? []).map((p) => [p.id, p])); const rows = new Map<string, RankedAmount>(); for (const order of orders) for (const item of order.items) { const row = rows.get(item.productId) ?? { id: item.productId, name: products.get(item.productId)?.name ?? item.productId, amount: 0n, count: 0, quantity: 0n }; row.amount += item.lineTotal; row.count += 1; row.quantity = (row.quantity ?? 0n) + item.quantity; rows.set(item.productId, row); } return this.rank(rows); }
  private topSalesCategories(orders: NonNullable<DashboardInput["salesOrders"]>, input: DashboardInput): RankedAmount[] { const products = new Map((input.products ?? []).map((p) => [p.id, p])); const categories = new Map((input.productCategories ?? []).map((c) => [c.id, c])); const rows = new Map<string, RankedAmount>(); for (const order of orders) for (const item of order.items) { const product = products.get(item.productId); const id = product?.categoryId ?? "uncategorized"; const row = rows.get(id) ?? { id, name: categories.get(id)?.name ?? "Uncategorized", amount: 0n, count: 0, quantity: 0n }; row.amount += item.lineTotal; row.count += 1; row.quantity = (row.quantity ?? 0n) + item.quantity; rows.set(id, row); } return this.rank(rows); }
  private topByCustomer(invoices: NonNullable<DashboardInput["invoices"]>, customers: NonNullable<DashboardInput["customers"]>): RankedAmount[] { const names = new Map(customers.map((c) => [c.id, c.name])); const rows = new Map<string, RankedAmount>(); for (const invoice of invoices) { const row = rows.get(invoice.customerId) ?? { id: invoice.customerId, name: names.get(invoice.customerId) ?? invoice.customerId, amount: 0n, count: 0 }; row.amount += invoice.subtotal; row.count += 1; rows.set(invoice.customerId, row); } return this.rank(rows); }
  private topByVendor(bills: NonNullable<DashboardInput["bills"]>, vendors: NonNullable<DashboardInput["vendors"]>): RankedAmount[] { const names = new Map(vendors.map((v) => [v.id, v.name])); const rows = new Map<string, RankedAmount>(); for (const bill of bills) { const row = rows.get(bill.vendorId) ?? { id: bill.vendorId, name: names.get(bill.vendorId) ?? bill.vendorId, amount: 0n, count: 0 }; row.amount += bill.subtotal; row.count += 1; rows.set(bill.vendorId, row); } return this.rank(rows); }
  private rank(rows: Map<string, RankedAmount>): RankedAmount[] { return [...rows.values()].sort((a, b) => cmpBigInt(b.amount, a.amount) || a.name.localeCompare(b.name)).slice(0, 5); }
  private outstanding(total: bigint, paid: bigint): bigint { const value = total - paid; return value > 0n ? value : 0n; }
  private asOf(range: DashboardDateRange): Date { return range.asOf ?? range.endsOn; }
  private inRange(range: DashboardDateRange, businessId: string, date: Date): boolean { if (businessId !== range.businessId) return false; if (date < range.startsOn || date > range.endsOn) return false; return true; }
  private sameUtcDate(a: Date, b: Date): boolean { return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate(); }

  private getTrendPoints(startsOn: Date, endsOn: Date, items: { date: Date; amount: bigint }[]): { label: string; value: number }[] {
    const daysDiff = Math.ceil((endsOn.getTime() - startsOn.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 8) {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const points: { [key: string]: bigint } = {};
      const currentDate = new Date(startsOn);
      const labels: string[] = [];
      
      while (currentDate <= endsOn) {
        const key = (currentDate.toISOString().split("T")[0] as string) || "";
        points[key] = 0n;
        const label = `${dayNames[currentDate.getUTCDay()]} ${String(currentDate.getUTCDate()).padStart(2, "0")}`;
        labels.push(label);
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }
      
      for (const item of items) {
        const key = (item.date.toISOString().split("T")[0] as string) || "";
        if (points[key] !== undefined) points[key] += item.amount;
      }
      
      return Object.keys(points).map((key, i) => ({
        label: labels[i] || key,
        value: Number(points[key])
      }));
    } else if (daysDiff <= 31) {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const points: { [key: string]: bigint } = {};
      const currentDate = new Date(startsOn);
      const labels: string[] = [];
      
      while (currentDate <= endsOn) {
        const key = (currentDate.toISOString().split("T")[0] as string) || "";
        points[key] = 0n;
        const label = `${String(currentDate.getUTCDate()).padStart(2, "0")} ${months[currentDate.getUTCMonth()]}`;
        labels.push(label);
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }
      
      for (const item of items) {
        const key = (item.date.toISOString().split("T")[0] as string) || "";
        if (points[key] !== undefined) points[key] += item.amount;
      }
      
      return Object.keys(points).map((key, i) => ({
        label: labels[i] || key,
        value: Number(points[key])
      }));
    } else if (daysDiff <= 186) {
      const points: { label: string; value: number }[] = [];
      const currentDate = new Date(startsOn);
      let weekNum = 1;
      
      while (currentDate <= endsOn) {
        const weekStart = new Date(currentDate);
        const weekEnd = new Date(currentDate);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
        if (weekEnd > endsOn) weekEnd.setTime(endsOn.getTime());
        
        const amount = items
          .filter(item => item.date >= weekStart && item.date <= weekEnd)
          .reduce((sum, item) => sum + item.amount, 0n);
        
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const label = `W${weekNum} (${weekStart.getUTCDate()} ${months[weekStart.getUTCMonth()]})`;
        points.push({ label, value: Number(amount) });
        
        currentDate.setUTCDate(currentDate.getUTCDate() + 7);
        weekNum++;
      }
      return points;
    } else {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const points: { [key: string]: bigint } = {};
      const currentDate = new Date(startsOn);
      const labels: string[] = [];
      
      while (currentDate <= endsOn) {
        const key = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, "0")}`;
        points[key] = 0n;
        const label = `${months[currentDate.getUTCMonth()]} ${currentDate.getUTCFullYear()}`;
        if (!labels.includes(label)) labels.push(label);
        currentDate.setUTCMonth(currentDate.getUTCMonth() + 1);
        currentDate.setUTCDate(1);
      }
      
      for (const item of items) {
        const key = `${item.date.getUTCFullYear()}-${String(item.date.getUTCMonth() + 1).padStart(2, "0")}`;
        if (points[key] !== undefined) points[key] += item.amount;
      }
      
      return Object.keys(points).map((key, i) => ({
        label: labels[i] || key,
        value: Number(points[key])
      }));
    }
  }
}
