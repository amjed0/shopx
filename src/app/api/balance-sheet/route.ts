import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import mongoose from 'mongoose';
import CapitalAccount from '../../../../models/CapitalAccount';
import Expense from '../../../../models/Expense';
import Income from '../../../../models/Income';
import { requirePermission } from '../../../../lib/rbac';

// ── Reuse existing models safely ──────────────────────────────────────────────
const SaleSchema = new mongoose.Schema({
  date: String,
  customerId: String,
  customerName: String,
  total: Number,
  status: String,
  paymentMethod: String,
  items: [{ productId: String, productName: String, quantity: Number, price: Number }],
  userId: String,
});

const ProductSchema = new mongoose.Schema({
  name: String,
  sku: String,
  category: String,
  purchasePrice: Number,
  sellingPrice: Number,
  stock: Number,
  minStock: Number,
  supplierId: String,
  supplierName: String,
  userId: String,
  createdAt: Date,
});

const PurchaseSchema = new mongoose.Schema({
  userId: String,
  supplierId: String,
  productId: String,
  productName: String,
  quantity: Number,
  purchasePrice: Number,
  createdAt: { type: Date, default: Date.now },
});

const Sale     = mongoose.models.Sale     || mongoose.model('Sale',     SaleSchema);
const Product  = mongoose.models.Product  || mongoose.model('Product',  ProductSchema);
const Purchase = mongoose.models.Purchase || mongoose.model('Purchase', PurchaseSchema);
// NOTE: Expense and Income are imported from real models above

// ── Helper: sum cashbook entries by category or description keywords ──────────
// Matches against both the `category` field AND `description` field (case-insensitive)
function sumByCategory(entries: any[], keywords: string[]): number {
  return entries
    .filter((e: any) => {
      const cat  = (e.category    || '').toLowerCase();
      const desc = (e.description || '').toLowerCase();
      return keywords.some(k => {
        const kl = k.toLowerCase();
        return cat.includes(kl) || desc.includes(kl);
      });
    })
    .reduce((acc: number, e: any) => acc + Math.abs(Number(e.amount) || 0), 0);
}

export async function GET(request: NextRequest) {
  try {
    const authErr = await requirePermission(request, 'balanceSheet');
    if (authErr) return authErr;

    await dbConnect();

    const session = await getServerSession(authOptions);
    const headerUserId = (request as any).headers?.get?.('x-user-id');
    const userId = session?.user?.id || headerUserId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    // `fy` = the April-start year of the Indian Financial Year
    // e.g. FY 2025-26 → fy=2025, range: 2025-04-01 to 2026-03-31
    const now = new Date();
    const currentFY = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fy = parseInt(searchParams.get('fy') || searchParams.get('year') || String(currentFY));

    const yearStart = `${fy}-04-01`;
    const yearEnd   = `${fy + 1}-03-31T23:59:59.999Z`;

    // FY months: Apr(fy) to Mar(fy+1) = 12 months
    const FY_MONTHS = [
      { m: 4,  y: fy },   { m: 5,  y: fy },   { m: 6,  y: fy },
      { m: 7,  y: fy },   { m: 8,  y: fy },   { m: 9,  y: fy },
      { m: 10, y: fy },   { m: 11, y: fy },   { m: 12, y: fy },
      { m: 1,  y: fy+1 }, { m: 2,  y: fy+1 }, { m: 3,  y: fy+1 },
    ];

    // ── Fetch all data for the year ───────────────────────────────────────────
    // Expenses & Income use `createdAt` (ISO string) as the date field
    const [sales, products, purchases, expenseEntries, incomeEntries, capitalAccount] = await Promise.all([
      Sale.find({ userId, date: { $gte: yearStart, $lte: yearEnd } }).lean(),
      Product.find({ userId }).lean(),
      Purchase.find({ userId, createdAt: { $gte: new Date(yearStart), $lte: new Date(yearEnd) } }).lean(),
      Expense.find({ userId, createdAt: { $gte: yearStart, $lte: yearEnd } }).lean(),
      Income.find({ userId, createdAt: { $gte: yearStart, $lte: yearEnd } }).lean(),
      CapitalAccount.findOne({ userId }).lean(),
    ]);

    // ── Monthly P&L breakdown (Apr → Mar, 12 months of FY) ───────────────────
    const months = FY_MONTHS.map(({ m, y }) => {
      const monthStr = String(m).padStart(2, '0');
      const prefix   = `${y}-${monthStr}`;
      const label    = new Date(`${prefix}-15`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

      const monthlySales = (sales as any[]).filter((s: any) => (s.date || '').startsWith(prefix));
      const revenue      = monthlySales.reduce((acc: number, s: any) => acc + (s.total || 0), 0);
      const orders       = monthlySales.length;

      const monthlyPurchases = (purchases as any[]).filter((p: any) => {
        const d = new Date(p.createdAt);
        return d.getFullYear() === y && (d.getMonth() + 1) === m;
      });
      const cogs = monthlyPurchases.reduce((acc: number, p: any) => acc + (p.purchasePrice || 0) * (p.quantity || 0), 0);

      const grossProfit = revenue - cogs;
      const netProfit   = grossProfit;

      return { month: label, revenue, cogs, grossProfit, netProfit, orders };
    });

    // ── Annual totals ─────────────────────────────────────────────────────────
    const totalRevenue     = months.reduce((a, m) => a + m.revenue, 0);
    const totalCOGS        = months.reduce((a, m) => a + m.cogs, 0);
    const totalGrossProfit = months.reduce((a, m) => a + m.grossProfit, 0);
    const totalOrders      = months.reduce((a, m) => a + m.orders, 0);
    const grossMargin      = totalRevenue ? (totalGrossProfit / totalRevenue) * 100 : 0;

    // ── Inventory / stock values ──────────────────────────────────────────────
    const stockValue       = (products as any[]).reduce((a: number, p: any) => a + (p.purchasePrice || 0) * (p.stock || 0), 0);
    const stockRetailValue = (products as any[]).reduce((a: number, p: any) => a + (p.sellingPrice  || 0) * (p.stock || 0), 0);
    const totalProducts    = (products as any[]).length;
    const lowStockCount    = (products as any[]).filter((p: any) => p.stock <= p.minStock).length;

    // ── Payment method breakdown ──────────────────────────────────────────────
    const paymentBreakdown: Record<string, number> = {};
    (sales as any[]).forEach((s: any) => {
      const m = s.paymentMethod || 'other';
      paymentBreakdown[m] = (paymentBreakdown[m] || 0) + (s.total || 0);
    });

    // ── Top products ──────────────────────────────────────────────────────────
    const productMap: Record<string, { name: string; revenue: number; qty: number }> = {};
    (sales as any[]).forEach((s: any) => {
      (s.items || []).forEach((item: any) => {
        if (!productMap[item.productId]) productMap[item.productId] = { name: item.productName, revenue: 0, qty: 0 };
        productMap[item.productId].revenue += (item.quantity || 0) * (item.price || 0);
        productMap[item.productId].qty     += item.quantity || 0;
      });
    });
    const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // ── Transaction history ───────────────────────────────────────────────────
    const history = (sales as any[]).map((s: any) => ({
      date:          s.date,
      customerName:  s.customerName || 'Walk-in',
      total:         s.total,
      status:        s.status,
      paymentMethod: s.paymentMethod,
      items:         (s.items || []).length,
    }));

    // ── Consolidated Balance Sheet ────────────────────────────────────────────
    // expenseEntries and incomeEntries come directly from real Expense / Income models
    // Cash on hand: total income received - total expenses paid (all payment modes)
    const totalIncome  = (incomeEntries as any[]).reduce((a: number, e: any) => a + Math.abs(Number(e.amount) || 0), 0);
    const totalExpense = (expenseEntries as any[]).reduce((a: number, e: any) => a + Math.abs(Number(e.amount) || 0), 0);
    const cashFromBooks = Math.max(0, totalIncome - totalExpense);

    // Accounts Receivable: sum of sales not yet paid (credit sales)
    const accountsReceivable = (sales as any[])
      .filter((s: any) => s.status === 'pending' || s.status === 'credit')
      .reduce((a: number, s: any) => a + (s.total || 0), 0);

    // Prepaid Expenses: expense entries categorised as prepaid / advance
    const prepaidExpenses = sumByCategory(expenseEntries as any[], ['prepaid', 'advance payment', 'advance']);

    // ── Capital Account Integration (Owner Capital, Fixed Assets, Bank Loans, Renovations) ──
    const cap = capitalAccount as any;
    const capitalEquipment = (cap?.fixedAssets || [])
      .filter((a: any) => !['property', 'land', 'building'].includes(String(a.category || '').toLowerCase()))
      .reduce((acc: number, a: any) => acc + (Number(a.amount) || 0), 0);

    const capitalProperty = (cap?.fixedAssets || [])
      .filter((a: any) => ['property', 'land', 'building'].includes(String(a.category || '').toLowerCase()))
      .reduce((acc: number, a: any) => acc + (Number(a.amount) || 0), 0);

    const capitalRenovations = (cap?.renovations || [])
      .reduce((acc: number, r: any) => acc + (Number(r.amount) || 0), 0);

    const capitalBankLoans = (cap?.bankLoans || [])
      .reduce((acc: number, l: any) => acc + (Number(l.loanAmount) || 0), 0);

    const capitalOwnerEquity = Number(cap?.ownerCapital) || 0;

    const openingStockFromPurchases = (purchases as any[])
      .filter((p: any) => p.isOpeningStock)
      .reduce((acc: number, p: any) => acc + (Number(p.purchasePrice) || 0) * (Number(p.quantity) || 0), 0);
    const manualOpeningStock = Number(cap?.openingStockManual) || 0;

    // Inventory: current stock at purchase price, plus any manual/purchased opening stock if not yet in products
    const inventory = Math.max(stockValue, openingStockFromPurchases, manualOpeningStock);

    // Non-Current Assets: from cashbook capital expenditure entries + Capital Account fixed assets
    const equipment = sumByCategory(expenseEntries, ['equipment', 'machinery', 'computer', 'furniture', 'maintenance']) + capitalEquipment;
    const property  = sumByCategory(expenseEntries, ['property', 'land', 'building', 'office', 'rent']) + capitalProperty + capitalRenovations;
    const goodwill  = sumByCategory(expenseEntries, ['goodwill', 'intangible', 'brand', 'marketing']);

    // ── Current Liabilities ──────────────────────────────────────────────────
    // Sundry Creditors / Accounts Payable:
    //   (a) Unpaid supplier bills from purchase records
    //   (b) Cashbook: "Supplier Payment" expenses that were credit (not yet settled)
    const supplierUnpaid = (purchases as any[])
      .filter((p: any) => p.status === 'pending' || p.status === 'credit')
      .reduce((a: number, p: any) => a + Math.abs((p.purchasePrice || 0) * (p.quantity || 0)), 0);
    const supplierCashbook = sumByCategory(expenseEntries, ['supplier payment', 'purchase / stock', 'purchase/stock', 'sundry creditor', 'accounts payable']);
    const accountsPayable = supplierUnpaid + supplierCashbook;

    // Outstanding / Accrued Expenses — amounts owed but not yet paid
    // Maps to cashbook: "Salaries" expenses, "Rent", "Electricity", "Transport", "Office Supplies", etc.
    const salariesPayable = sumByCategory(expenseEntries, ['salaries', 'salary', 'wages', 'payroll']);
    const accruedExpenses = sumByCategory(expenseEntries, [
      'rent', 'electricity', 'transport', 'maintenance', 'internet', 'phone',
      'internet & phone', 'food', 'beverage', 'miscellaneous', 'office supplies',
      'accrued', 'outstanding'
    ]);

    // Unearned Revenue / Advance Received — cashbook income entries that are advances
    const unearnedRevenue = sumByCategory(incomeEntries, [
      'advance', 'advance received', 'deposit received', 'unearned',
      'customer credit', 'customer credit collection'
    ]);

    // Tax Payable — GST, TDS, Income Tax entries in cashbook
    const incomeTaxesPayable = sumByCategory(expenseEntries, ['tax', 'gst', 'tds', 'income tax', 'tax payable']);

    // Warranty / Guarantee liability
    const warrantyLiability = sumByCategory(expenseEntries, ['warranty', 'guarantee', 'refund']);

    // ── Long-Term Liabilities ─────────────────────────────────────────────────
    // Bank loans / overdraft from cashbook income side (Loan Received) + Capital Account loans
    const loansFromCashbook = sumByCategory(incomeEntries, ['loan received', 'loan', 'borrowing', 'overdraft', 'bank overdraft', 'term loan', 'mortgage']);
    const longTermDebt = loansFromCashbook + capitalBankLoans;
    const otherLongTermLiabilities = sumByCategory(expenseEntries, ['deferred', 'long term liability']);

    // ── Equity ────────────────────────────────────────────────────────────────
    // Owner capital from cashbook income (Investment) + Capital Account owner equity
    const equityFromCashbook = sumByCategory(incomeEntries, ['investment', 'capital', 'owner equity', 'share capital', 'equity']);
    const equityCapital = equityFromCashbook + capitalOwnerEquity;

    // ── Compute asset and liability totals first ──────────────────────────────
    const cashVal = Math.max(0, cashFromBooks);
    const totalCurrentAssets    = cashVal + accountsReceivable + prepaidExpenses + inventory;
    const totalAssets           = totalCurrentAssets + equipment + property + goodwill;

    const totalCurrentLiabs     = accountsPayable + accruedExpenses + unearnedRevenue +
                                  salariesPayable + incomeTaxesPayable + warrantyLiability;
    const totalLiabilities      = totalCurrentLiabs + longTermDebt + otherLongTermLiabilities;

    // ── Retained Earnings as balancing plug ───────────────────────────────────
    // Accounting identity: Assets = Liabilities + Equity
    // retainedEarnings = Assets − Liabilities − ownerCapital
    // This guarantees the balance sheet always balances.
    // If negative it means expenses exceeded income (net loss).
    const retainedEarnings = totalAssets - totalLiabilities - equityCapital;

    const consolidatedBS = {
      cash: cashVal,
      accountsReceivable,
      prepaidExpenses,
      inventory,
      equipment,
      property,
      goodwill,
      accountsPayable,
      accruedExpenses,
      unearnedRevenue,
      salariesPayable,
      incomeTaxesPayable,
      warrantyLiability,
      longTermDebt,
      otherLongTermLiabilities,
      equityCapital,
      retainedEarnings,
    };

    return NextResponse.json({
      year: fy,       // backward compat (UI reads .year)
      fy,             // new: April-start year of the FY
      fyLabel: `${fy}-${String(fy + 1).slice(2)}`,  // e.g. "2025-26"
      yearStart,
      yearEnd,
      summary: {
        totalRevenue, totalCOGS, totalGrossProfit, totalOrders, grossMargin,
        stockValue, stockRetailValue, totalProducts, lowStockCount,
      },
      months,
      paymentBreakdown,
      topProducts,
      history,
      consolidatedBS,
    });
  } catch (error: any) {
    console.error('[balance-sheet]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}