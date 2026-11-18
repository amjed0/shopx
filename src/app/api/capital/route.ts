import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import CapitalAccount from '../../../../models/CapitalAccount';

export async function GET(request: Request) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    const headerUserId = request.headers.get('x-user-id');
    const userId = session?.user?.id || headerUserId;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const account = await CapitalAccount.findOne({ userId }).lean();

    if (!account) {
      return NextResponse.json({
        businessType: 'new',
        ownerCapital: 0,
        fixedAssets: [],
        bankLoans: [],
        renovations: [],
        openingStockManual: 0,
        notes: '',
      });
    }

    const obj = account as any;
    obj.id = obj._id?.toString();
    delete obj._id;
    return NextResponse.json(obj);
  } catch (error: any) {
    console.error('[Capital GET Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    const headerUserId = request.headers.get('x-user-id');
    const userId = session?.user?.id || headerUserId;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      businessType,
      ownerCapital,
      fixedAssets,
      bankLoans,
      renovations,
      openingStockManual,
      notes,
    } = body;

    const updateData = {
      userId,
      businessType: businessType === 'existing' ? 'existing' : 'new',
      ownerCapital: Math.max(0, Number(ownerCapital) || 0),
      fixedAssets: Array.isArray(fixedAssets)
        ? fixedAssets.map((a: any) => ({
            id: a.id || `fa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: String(a.name || '').trim(),
            amount: Math.max(0, Number(a.amount) || 0),
            category: a.category || 'other',
            date: a.date || new Date().toISOString().split('T')[0],
          }))
        : [],
      bankLoans: Array.isArray(bankLoans)
        ? bankLoans.map((l: any) => ({
            id: l.id || `loan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            bankName: String(l.bankName || '').trim(),
            loanAmount: Math.max(0, Number(l.loanAmount) || 0),
            interestRate: Number(l.interestRate) || 0,
            startDate: l.startDate || new Date().toISOString().split('T')[0],
            note: String(l.note || '').trim(),
          }))
        : [],
      renovations: Array.isArray(renovations)
        ? renovations.map((r: any) => ({
            id: r.id || `reno-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            description: String(r.description || '').trim(),
            amount: Math.max(0, Number(r.amount) || 0),
            date: r.date || new Date().toISOString().split('T')[0],
            note: String(r.note || '').trim(),
          }))
        : [],
      openingStockManual: Math.max(0, Number(openingStockManual) || 0),
      notes: typeof notes === 'string' ? notes.trim() : '',
    };

    const saved = await CapitalAccount.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const obj = saved.toObject() as any;
    obj.id = obj._id?.toString();
    delete obj._id;

    return NextResponse.json(obj, { status: 200 });
  } catch (error: any) {
    console.error('[Capital POST Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

