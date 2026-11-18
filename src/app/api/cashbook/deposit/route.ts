import { NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/mongodb';
import Expense from '../../../../../models/Expense';
import Income from '../../../../../models/Income';

export async function POST(request: Request) {
  try {
    await dbConnect();
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { amount, bankName, date, note } = body;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return NextResponse.json({ error: 'Valid deposit amount required' }, { status: 400 });
    }

    const targetDate = date ? new Date(date).toISOString() : new Date().toISOString();
    const destination = bankName && bankName.trim() ? bankName.trim() : 'Bank Account';

    // 1. Outflow from Cash Drawer (Saved in Expense collection)
    const expenseEntry = await Expense.create({
      userId,
      category: 'Deposit to Bank',
      description: `Cash deposited to ${destination}`,
      amount: numAmount,
      paymentMode: 'Cash',
      note: note || `Cash deposit into ${destination}`,
      createdAt: targetDate,
    });

    // 2. Inflow into Bank Account (Saved in Income collection)
    const incomeEntry = await Income.create({
      userId,
      category: 'Deposit from Cash',
      description: `Cash deposit received into ${destination}`,
      amount: numAmount,
      paymentMode: 'Bank Transfer',
      note: note || `Cash deposit into ${destination}`,
      createdAt: targetDate,
    });

    return NextResponse.json({
      success: true,
      amount: numAmount,
      destination,
      expenseId: expenseEntry._id.toString(),
      incomeId: incomeEntry._id.toString(),
      message: `₹${numAmount.toLocaleString('en-IN')} deposited to ${destination}. Cash in drawer decreased and bank balance increased.`,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Bank Deposit Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

