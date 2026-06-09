import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import { getSessionUser } from '../../../../lib/session';
import mongoose from 'mongoose';

// Inline models to avoid import issues
const SaleSchema = new mongoose.Schema({
  date: String,
  customerId: String,
  customerName: String,
  total: Number,
  status: String,
  paymentMethod: String,
  items: [
    {
      productId: String,
      productName: String,
      quantity: Number,
      price: Number,
    },
  ],
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

const Sale =
  mongoose.models.Sale || mongoose.model('Sale', SaleSchema);
const Product =
  mongoose.models.Product || mongoose.model('Product', ProductSchema);

export async function GET(request: Request) {
  try {
    await dbConnect();

    const sessionUser = await getSessionUser();
    if (!sessionUser?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = sessionUser.uid;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from'); // ISO date string
    const to = searchParams.get('to');     // ISO date string

    // Build date filter
    const dateFilter: Record<string, unknown> = { userId };
    if (from || to) {
      const dateRange: Record<string, string> = {};
      if (from) dateRange.$gte = from;
      if (to)   dateRange.$lte = to + 'T23:59:59.999Z';
      dateFilter.date = dateRange;
    }

    // ── 1. Fetch raw data ─────────────────────────────────────────────
    const [allSales, allProducts] = await Promise.all([
      Sale.find(dateFilter).sort({ date: -1 }).lean(),
      Product.find({ userId }).lean(),
    ]);

    // ── 2. Summary KPIs ──────────────────────────────────────────────
    const totalRevenue = allSales.reduce((s: number, sale: any) => s + (sale.total || 0), 0);
    const totalOrders  = allSales.length;
    const avgTicket    = totalOrders ? totalRevenue / totalOrders : 0;

    const totalProducts   = allProducts.length;
    const lowStockCount   = allProducts.filter((p: any) => p.stock <= p.minStock).length;

    // ── 3. Daily revenue for selected period (or last 30 days) ───────
    const periodDays = from && to
      ? Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1
      : 30;

    const clampedDays = Math.min(Math.max(periodDays, 7), 90);

    const dailyMap: Record<string, number> = {};
    for (let i = clampedDays - 1; i >= 0; i--) {
      const d = new Date();
      if (from) {
        const start = new Date(from);
        start.setDate(start.getDate() + (clampedDays - 1 - i));
        dailyMap[start.toISOString().split('T')[0]] = 0;
      } else {
        d.setDate(d.getDate() - i);
        dailyMap[d.toISOString().split('T')[0]] = 0;
      }
    }

    allSales.forEach((sale: any) => {
      const day = (sale.date || '').split('T')[0];
      if (day in dailyMap) dailyMap[day] = (dailyMap[day] || 0) + (sale.total || 0);
    });

    const dailyRevenue = Object.entries(dailyMap).map(([date, amount]) => ({
      date,
      label: new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      amount,
    }));

    // ── 4. Revenue by payment method ─────────────────────────────────
    const paymentMap: Record<string, number> = {};
    allSales.forEach((sale: any) => {
      const m = sale.paymentMethod || 'other';
      paymentMap[m] = (paymentMap[m] || 0) + (sale.total || 0);
    });
    const revenueByPayment = Object.entries(paymentMap).map(([method, amount]) => ({
      method: method.charAt(0).toUpperCase() + method.slice(1),
      amount,
    }));

    // ── 5. Category distribution ──────────────────────────────────────
    const catMap: Record<string, number> = {};
    allProducts.forEach((p: any) => {
      catMap[p.category] = (catMap[p.category] || 0) + 1;
    });
    const categoryData = Object.entries(catMap).map(([name, value]) => ({ name, value }));

    // ── 6. Top-selling products (by quantity sold) ────────────────────
    const productQtyMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    allSales.forEach((sale: any) => {
      (sale.items || []).forEach((item: any) => {
        if (!productQtyMap[item.productId]) {
          productQtyMap[item.productId] = { name: item.productName, qty: 0, revenue: 0 };
        }
        productQtyMap[item.productId].qty     += item.quantity || 0;
        productQtyMap[item.productId].revenue += (item.quantity || 0) * (item.price || 0);
      });
    });

    const topProducts = Object.values(productQtyMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);

    // ── 7. Best sellers by revenue ────────────────────────────────────
    const bestSellers = Object.values(productQtyMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // ── 8. Monthly revenue (last 6 months) ───────────────────────────
    const monthlyMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap[key] = 0;
    }
    allSales.forEach((sale: any) => {
      const key = (sale.date || '').slice(0, 7);
      if (key in monthlyMap) monthlyMap[key] += sale.total || 0;
    });
    const monthlyRevenue = Object.entries(monthlyMap).map(([key, amount]) => ({
      label: new Date(key + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      amount,
    }));

    return NextResponse.json({
      kpis: { totalRevenue, totalOrders, avgTicket, totalProducts, lowStockCount },
      dailyRevenue,
      monthlyRevenue,
      revenueByPayment,
      categoryData,
      topProducts,
      bestSellers,
    });
  } catch (error: any) {
    console.error('[analytics] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}