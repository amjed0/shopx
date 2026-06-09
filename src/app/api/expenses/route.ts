import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Expense from '../../../../models/Expense';

export async function GET(request: Request) {
  try {
    await dbConnect();
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const query: any = { userId };
    if (category && category !== 'all') query.category = category;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = from;
      if (to) query.createdAt.$lte = to + 'T23:59:59.999Z';
    }

    const expenses = await Expense.find(query).sort({ createdAt: -1 }).lean();
    const result = expenses.map((e: any) => {
      const { _id, ...rest } = e;
      return { id: _id.toString(), ...rest };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { category, description, amount, paymentMode, note } = body;

    if (!category || !description || !amount) {
      return NextResponse.json({ error: 'category, description and amount are required' }, { status: 400 });
    }

    const expense = await Expense.create({
      userId,
      category,
      description,
      amount: Number(amount),
      paymentMode: paymentMode || 'Cash',
      note: note || '',
    });

    const obj = expense.toObject() as any;
    const { _id, ...rest } = obj;
    return NextResponse.json({ id: _id.toString(), ...rest }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await dbConnect();
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    await Expense.deleteOne({ _id: id, userId });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}