import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import { getSessionUser } from '../../../../lib/session';
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

const Sale     = mongoose.models.Sale     || mongoose.model('Sale',     SaleSchema);
const Product  = mongoose.models.Product  || mongoose.model('Product',  ProductSchema);
const Purchase = mongoose.models.Purchase || mongoose.model('Purchase', PurchaseSchema);

export async function GET(request: Request) {
  try {
    await dbConnect();

    const sessionUser = await getSessionUser();
    if (!sessionUser?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = sessionUser.uid;

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    const yearStart = `${year}-01-01`;
    const yearEnd   = `${year}-12-31T23:59:59.999Z`;

    // ── Fetch all data for the year ───────────────────────────────────────────
    const [sales, products, purchases] = await Promise.all([
      Sale.find({ userId, date: { $gte: yearStart, $lte: yearEnd } }).lean(),
      Product.find({ userId }).lean(),
      Purchase.find({ userId, createdAt: { $gte: new Date(yearStart), $lte: new Date(yearEnd) } }).lean(),
    ]);

    // ── Monthly breakdown ─────────────────────────────────────────────────────
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
      const netProfit   = grossProfit; // extend with expenses when available

      return { month: label, revenue, cogs, grossProfit, netProfit, orders };
    });

    // ── Annual totals ─────────────────────────────────────────────────────────
    const totalRevenue     = months.reduce((a, m) => a + m.revenue, 0);
    const totalCOGS        = months.reduce((a, m) => a + m.cogs, 0);
    const totalGrossProfit = months.reduce((a, m) => a + m.grossProfit, 0);
    const totalOrders      = months.reduce((a, m) => a + m.orders, 0);
    const grossMargin      = totalRevenue ? (totalGrossProfit / totalRevenue) * 100 : 0;

    // ── Assets ────────────────────────────────────────────────────────────────
    const stockValue      = (products as any[]).reduce((a: number, p: any) => a + (p.purchasePrice || 0) * (p.stock || 0), 0);
    const stockRetailValue = (products as any[]).reduce((a: number, p: any) => a + (p.sellingPrice || 0) * (p.stock || 0), 0);
    const totalProducts   = (products as any[]).length;
    const lowStockCount   = (products as any[]).filter((p: any) => p.stock <= p.minStock).length;

    // ── Payment method breakdown ──────────────────────────────────────────────
    const paymentBreakdown: Record<string, number> = {};
    (sales as any[]).forEach((s: any) => {
      const m = s.paymentMethod || 'other';
      paymentBreakdown[m] = (paymentBreakdown[m] || 0) + (s.total || 0);
    });

    // ── Top products by revenue ───────────────────────────────────────────────
    const productMap: Record<string, { name: string; revenue: number; qty: number }> = {};
    (sales as any[]).forEach((s: any) => {
      (s.items || []).forEach((item: any) => {
        if (!productMap[item.productId]) productMap[item.productId] = { name: item.productName, revenue: 0, qty: 0 };
        productMap[item.productId].revenue += (item.quantity || 0) * (item.price || 0);
        productMap[item.productId].qty     += item.quantity || 0;
      });
    });
    const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // ── Full transaction history (for download) ───────────────────────────────
    const history = (sales as any[]).map((s: any) => ({
      date:          s.date,
      customerName:  s.customerName || 'Walk-in',
      total:         s.total,
      status:        s.status,
      paymentMethod: s.paymentMethod,
      items:         (s.items || []).length,
    }));

    return NextResponse.json({
      year,
      summary: { totalRevenue, totalCOGS, totalGrossProfit, totalOrders, grossMargin, stockValue, stockRetailValue, totalProducts, lowStockCount },
      months,
      paymentBreakdown,
      topProducts,
      history,
    });
  } catch (error: any) {
    console.error('[balance-sheet]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}