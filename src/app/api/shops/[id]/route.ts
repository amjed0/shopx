import { NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/mongodb';
import Shop from '../../../../../models/Shop';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const shop = await Shop.findOne({ userId: id });
    if (!shop) {
      return NextResponse.json(null);
    }
    const obj = shop.toObject();
    obj.id = obj.userId;
    return NextResponse.json(obj);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const data = await request.json();
    
    const shop = await Shop.findOneAndUpdate(
      { userId: id },
      { ...data, userId: id },
      { new: true, upsert: true }
    );
    
    const obj = shop.toObject();
    obj.id = obj.userId;
    return NextResponse.json(obj);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
