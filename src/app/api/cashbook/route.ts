import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Expense from '../../../../models/Expense';
import Income from '../../../../models/Income';

export async function POST(request: Request) {
  try {
    await dbConnect();
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { type, category, description, amount, paymentMode, note } = body;

    if (!category || !description || !amount) {
      return NextResponse.json(
        { error: 'category, description and amount are required' },
        { status: 400 }
      );
    }

    const data = {
      userId,
      category,
      description,
      amount: Number(amount),
      paymentMode: paymentMode || 'Cash',
      note: note || '',
    };

    const entry = type === 'income'
      ? await Income.create(data)    // → saves to incomes collection
      : await Expense.create(data);  // → saves to expenses collection

    const obj = entry.toObject() as any;
    const { _id, ...rest } = obj;
    return NextResponse.json({ id: _id.toString(), ...rest }, { status: 201 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    await dbConnect();
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const query: any = { userId };
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = from;
      if (to) query.createdAt.$lte = to + 'T23:59:59.999Z';
    }

    let results: any[] = [];

    if (!type || type === 'income') {
      const incomes = await Income.find(query).sort({ createdAt: -1 }).lean();
      results = [
        ...results,
        ...incomes.map((e: any) => ({ id: e._id.toString(), type: 'income', ...e })),
      ];
    }

    if (!type || type === 'expense') {
      const expenses = await Expense.find(query).sort({ createdAt: -1 }).lean();
      results = [
        ...results,
        ...expenses.map((e: any) => ({ id: e._id.toString(), type: 'expense', ...e })),
      ];
    }

    results.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json(results);
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
    const type = searchParams.get('type');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    if (type === 'income') {
      await Income.deleteOne({ _id: id, userId });
    } else {
      await Expense.deleteOne({ _id: id, userId });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}