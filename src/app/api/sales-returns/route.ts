import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import SaleReturn from '../../../../models/SaleReturn';

export async function GET(request: Request) {
  try {
    await dbConnect();
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const returns = await SaleReturn.find({ userId }).sort({ createdAt: -1 });
    const result = returns.map((r: any) => {
      const obj = r.toObject() as any;
      obj.id = obj._id.toString();
      delete obj._id;
      return obj;
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

    const data = await request.json();
    const newReturn = await SaleReturn.create({ ...data, userId });
    const obj = newReturn.toObject() as any;
    obj.id = obj._id.toString();
    delete obj._id;
    return NextResponse.json(obj, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}