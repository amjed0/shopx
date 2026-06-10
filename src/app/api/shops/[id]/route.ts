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

    // Validate required fields
    if (!data.ownerName || !data.companyName) {
      return NextResponse.json(
        { error: 'ownerName and companyName are required' },
        { status: 400 }
      );
    }

    const shop = await Shop.findOneAndUpdate(
      { userId: id },
      {
        $set: {
          userId:      id,
          ownerName:   data.ownerName   || '',
          companyName: data.companyName || '',
          location:    data.location    || '',
          phone:       data.phone       || '',
          email:       data.email       || '',
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    const obj = shop.toObject();
    obj.id = obj.userId;
    return NextResponse.json(obj);
  } catch (error: any) {
    console.error('[shop_profile PUT]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}