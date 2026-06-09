import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Supplier from '../../../../models/Supplier';

export async function GET(request: Request) {
  try {
    await dbConnect();
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const suppliers = await Supplier.find({ userId }).sort({ name: 1 }).lean();
    const formatted = suppliers.map((s: any) => {
      const { _id, ...rest } = s;
      return { id: _id.toString(), ...rest };
    });
    return NextResponse.json(formatted);
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
    const newSupplier = new Supplier({
      ...data,
      userId,
      createdAt: new Date().toISOString(),
    });
    await newSupplier.save();
    const obj = newSupplier.toObject();
    const { _id, ...rest } = obj;
    return NextResponse.json({ id: _id.toString(), ...rest }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}