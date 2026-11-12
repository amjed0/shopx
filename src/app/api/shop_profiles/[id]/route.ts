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
    console.log("Looking for userId:", id);
    const shop = await Shop.findOne({ userId: id });
    console.log("Shop found:", shop);
    if (!shop) {
      return NextResponse.json(null);
    }
    const obj = shop.toObject();
    obj.id = obj.userId;
    if (!obj.businessCategory) {
      obj.businessCategory = 'retail';
    }
    return NextResponse.json(obj);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const data = await request.json();

    const existingShop = await Shop.findOne({ userId: id });

    // Validate required fields only if creating a brand new profile
    if (!existingShop && (!data.ownerName || !data.companyName)) {
      return NextResponse.json(
        { error: 'ownerName and companyName are required' },
        { status: 400 }
      );
    }

    const updateFields: Record<string, any> = { userId: id };
    if (data.ownerName !== undefined) updateFields.ownerName = data.ownerName;
    if (data.companyName !== undefined) updateFields.companyName = data.companyName;
    if (data.location !== undefined) updateFields.location = data.location;
    if (data.phone !== undefined) updateFields.phone = data.phone;
    if (data.email !== undefined) updateFields.email = data.email;
    if (data.gstNumber !== undefined) updateFields.gstNumber = data.gstNumber;
    if (data.businessCategory !== undefined) updateFields.businessCategory = data.businessCategory;

    const shop = await Shop.findOneAndUpdate(
      { userId: id },
      { $set: updateFields },
      { new: true, upsert: true, runValidators: true }
    );

    const obj = shop.toObject();
    obj.id = obj.userId;
    if (!obj.businessCategory) {
      obj.businessCategory = 'retail';
    }
    return NextResponse.json(obj);
  } catch (error: any) {
    console.error('[shop_profile POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return POST(request, { params });
}