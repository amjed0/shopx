import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import SupplierPayment from '../../../../models/SupplierPayment';
import Purchase from '../../../../models/Purchase';

export async function GET(request: Request) {
  try {
    await dbConnect();
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');

    const query: any = { userId };
    if (supplierId) query.supplierId = supplierId;

    const payments = await SupplierPayment.find(query).sort({ createdAt: -1 }).lean();
    const formatted = payments.map((p: any) => {
      const { _id, ...rest } = p;
      return { id: _id.toString(), ...rest };
    });

    // If supplierId is specified, also return balance info
    if (supplierId) {
      const purchases = await Purchase.find({ userId, supplierId }).lean();
      const totalPurchased = purchases.reduce((sum: number, p: any) => sum + (p.quantity * p.purchasePrice), 0);
      const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0);

      return NextResponse.json({
        payments: formatted,
        totalPurchased,
        totalPaid,
        balance: totalPurchased - totalPaid,
      });
    }

    return NextResponse.json(formatted);
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
    const { supplierId, amount, paymentMode, note } = body;

    if (!supplierId || !amount) {
      return NextResponse.json({ error: 'supplierId and amount are required' }, { status: 400 });
    }

    const payment = await SupplierPayment.create({
      userId,
      supplierId,
      amount: Number(amount),
      paymentMode: paymentMode || 'Cash',
      note: note || '',
    });

    const obj = payment.toObject() as any;
    const { _id, ...rest } = obj;

    // Return updated balance
    const purchases = await Purchase.find({ userId, supplierId }).lean();
    const allPayments = await SupplierPayment.find({ userId, supplierId }).lean();
    const totalPurchased = purchases.reduce((sum: number, p: any) => sum + (p.quantity * p.purchasePrice), 0);
    const totalPaid = allPayments.reduce((sum: number, p: any) => sum + p.amount, 0);

    return NextResponse.json({
      payment: { id: _id.toString(), ...rest },
      totalPurchased,
      totalPaid,
      balance: totalPurchased - totalPaid,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

