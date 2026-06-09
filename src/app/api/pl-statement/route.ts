import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Sale from '../../../../models/Sale';
import Purchase from '../../../../models/Purchase';
import Expense from '../../../../models/Expense';
import Product from '../../../../models/Product';

export async function GET(request: Request) {
  try {
    await dbConnect();

    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to date params are required' }, { status: 400 });
    }

    const fromStr = from;
    const toStr = to + 'T23:59:59.999Z';

    // ── SALES ──
    const sales = await Sale.find({
      userId,
      date: { $gte: from, $lte: to },
    }).lean();

    const totalRevenue = sales.reduce(
      (sum: number, s: any) => sum + (Number(s.total) || 0), 0
    );

    const revenueBreakdown = sales.map((s: any) => ({
      label: s.customerName
        ? `Sale — ${s.customerName}`
        : `Invoice #${s._id.toString().slice(-6).toUpperCase()}`,
      amount: Number(s.total) || 0,
      date: new Date(s.date).toISOString(),
    }));

    // ── PURCHASES ──
    const purchases = await Purchase.find({
      userId,
      createdAt: { $gte: fromStr, $lte: toStr },
    }).lean();

    const totalPurchaseOrders = purchases.reduce(
      (sum: number, p: any) =>
        sum + (Number(p.purchasePrice) * Number(p.quantity) || 0),
      0
    );

    // ← Single combined row for all purchases
    const purchaseExpenseBreakdown = totalPurchaseOrders > 0
      ? [{
          label: 'Purchase Orders',
          amount: totalPurchaseOrders,
          type: 'Purchase',
          date: purchases.reduce((latest: string, p: any) =>
            p.createdAt > latest ? p.createdAt : latest,
            purchases[0]?.createdAt ?? new Date().toISOString()
          ),
        }]
      : [];

    // ── EXPENSES ──
    const expenses = await Expense.find({
      userId,
      createdAt: { $gte: fromStr, $lte: toStr },
    }).lean();

    const totalExpenses = expenses.reduce(
      (sum: number, e: any) => sum + (Number(e.amount) || 0), 0
    );

    const expenseBreakdown = expenses.map((e: any) => ({
      label: e.description || e.category || 'Expense',
      amount: Number(e.amount) || 0,
      type: e.category || 'Expense',
      date: new Date(e.createdAt).toISOString(),
    }));

    // ── CALCULATIONS ──
    const grossProfit = totalRevenue - totalPurchaseOrders ;
    const netProfit = grossProfit - totalExpenses;

    // ── COMBINED EXPENSE BREAKDOWN ──
    const allExpenseBreakdown = [
      ...purchaseExpenseBreakdown,
      ...expenseBreakdown,
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      totalRevenue,
      totalPurchaseOrders,
      totalExpenses,
      grossProfit,
      netProfit,
      revenueBreakdown,
      expenseBreakdown: allExpenseBreakdown,
    });

  } catch (error: any) {
    console.error('[P&L Route Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}