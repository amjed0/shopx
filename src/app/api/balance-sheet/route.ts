import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import mongoose from 'mongoose';

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

// ── CashBook schema — reads from your existing cashbook collection ─────────────
// Adjust field names below to match your actual cashbook documents
const CashBookSchema = new mongoose.Schema({
  userId: String,
  date: String,                  // "YYYY-MM-DD" or ISO string
  type: String,                  // "income" | "expense" | "receipt" | "payment"
  category: String,              // e.g. "salary", "rent", "tax", "warranty"
  description: String,
  amount: Number,
  createdAt: { type: Date, default: Date.now },
});

const Sale      = mongoose.models.Sale      || mongoose.model('Sale',      SaleSchema);
const Product   = mongoose.models.Product   || mongoose.model('Product',   ProductSchema);
const Purchase  = mongoose.models.Purchase  || mongoose.model('Purchase',  PurchaseSchema);
const CashBook  = mongoose.models.CashBook  || mongoose.model('CashBook',  CashBookSchema);

// ── Helper: sum cashbook entries by category keywords ────────────────────────
function sumByCategory(entries: any[], keywords: string[]): number {
  return entries
    .filter((e: any) => keywords.some(k => (e.category || '').toLowerCase().includes(k.toLowerCase())))
    .reduce((acc: number, e: any) => acc + Math.abs(e.amount || 0), 0);
}

export async function GET(request: Request) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    const yearStart = `${year}-01-01`;
    const yearEnd   = `${year}-12-31T23:59:59.999Z`;

    // ── Fetch all data for the year ───────────────────────────────────────────
    const [sales, products, purchases, cashbookEntries] = await Promise.all([
      Sale.find({ userId, date: { $gte: yearStart, $lte: yearEnd } }).lean(),
      Product.find({ userId }).lean(),
      Purchase.find({ userId, createdAt: { $gte: new Date(yearStart), $lte: new Date(yearEnd) } }).lean(),
      CashBook.find({ userId, date: { $gte: yearStart, $lte: yearEnd } }).lean(),
    ]);

    // ── Monthly P&L breakdown ─────────────────────────────────────────────────
    const months = Array.from({ length: 12 }, (_, i) => {
      const monthStr = String(i + 1).padStart(2, '0');
      const prefix   = `${year}-${monthStr}`;
      const label    = new Date(`${prefix}-01`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

      const monthlySales = (sales as any[]).filter((s: any) => (s.date || '').startsWith(prefix));
      const revenue      = monthlySales.reduce((acc: number, s: any) => acc + (s.total || 0), 0);
      const orders       = monthlySales.length;

      const monthlyPurchases = (purchases as any[]).filter((p: any) => {
        const d = new Date(p.createdAt);
        return d.getFullYear() === year && d.getMonth() === i;
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
    // Current Assets — derived from your real data
    const cash = sumByCategory(
      (cashbookEntries as any[]).filter((e: any) => e.type === 'income' || e.type === 'receipt'),
      ['cash', 'bank', 'opening']
    ) - sumByCategory(
      (cashbookEntries as any[]).filter((e: any) => e.type === 'expense' || e.type === 'payment'),
      ['cash', 'bank']
    )

    // Accounts Receivable: sum of sales not yet paid
    const accountsReceivable = (sales as any[])
      .filter((s: any) => s.status === 'pending')
      .reduce((a: number, s: any) => a + (s.total || 0), 0);

    // Prepaid Expenses: cashbook entries categorised as prepaid / advance
    const prepaidExpenses = sumByCategory(cashbookEntries as any[], ['prepaid', 'advance payment', 'advance']);

    // Inventory: current stock at purchase price (real-time, not year-filtered)
    const inventory = stockValue;

    // Non-Current Assets: from cashbook capital expenditure entries
    const equipment = sumByCategory(cashbookEntries as any[], ['equipment', 'machinery', 'computer', 'furniture']);
    const property  = sumByCategory(cashbookEntries as any[], ['property', 'land', 'building', 'office']);
    const goodwill  = sumByCategory(cashbookEntries as any[], ['goodwill', 'intangible', 'brand']);

    // Current Liabilities
    const accountsPayable = (purchases as any[])
      .filter((p: any) => p.status === 'pending')
      .reduce((a: number, p: any) => a + (p.purchasePrice || 0) * (p.quantity || 0), 0);

    const accruedExpenses   = sumByCategory(cashbookEntries as any[], ['accrued', 'outstanding expense']);
    const unearnedRevenue   = sumByCategory(cashbookEntries as any[], ['unearned', 'advance received', 'deposit received']);
    const salariesPayable   = sumByCategory(cashbookEntries as any[], ['salary', 'wages', 'payroll']);
    const incomeTaxesPayable = sumByCategory(cashbookEntries as any[], ['income tax', 'tds', 'tax payable']);
    const warrantyLiability  = sumByCategory(cashbookEntries as any[], ['warranty', 'guarantee']);

    // Long-Term Liabilities
    const longTermDebt             = sumByCategory(cashbookEntries as any[], ['loan', 'term loan', 'borrowing', 'mortgage']);
    const otherLongTermLiabilities = sumByCategory(cashbookEntries as any[], ['deferred', 'long term liability']);

    // Equity
    const equityCapital   = sumByCategory(cashbookEntries as any[], ['capital', 'owner equity', 'share capital', 'equity']);
    const retainedEarnings = totalGrossProfit; // running profit for the year is retained earnings

    const consolidatedBS = {
      cash: Math.max(0, cash),
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
      year,
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