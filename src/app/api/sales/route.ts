import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Sale from '../../../../models/Sale';

export async function GET(request: Request) {
  try {
    await dbConnect();
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const sales = await Sale.find({ userId }).sort({ date: -1 });
    const formattedSales = sales.map((s) => {
      const obj = s.toObject();
      obj.id = obj._id.toString();
      delete obj._id;
      return obj;
    });
    return NextResponse.json(formattedSales);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const data = await request.json();
    const newSale = new Sale({
      ...data,
      userId,
    });
    await newSale.save();
    const obj = newSale.toObject();
    obj.id = obj._id.toString();
    delete obj._id;
    return NextResponse.json(obj, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

