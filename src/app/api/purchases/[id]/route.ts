import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../../../../lib/mongodb';
import Purchase from '../../../../../models/Purchase';

type Ctx = { params: Promise<{ id: string }> };

function toClient(doc: any) {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  obj.id = obj._id.toString();
  delete obj._id;
  return obj;
}

export async function GET(request: Request, { params }: Ctx) {
  try {
    await dbConnect();
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid purchase ID' }, { status: 400 });
    }

    const purchase = await Purchase.findOne({ _id: id, userId });
    if (!purchase) return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });

    return NextResponse.json(toClient(purchase));
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    await dbConnect();
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid purchase ID' }, { status: 400 });
    }

    const body = await request.json();
    const update: Record<string, any> = {};

    // text fields
    for (const f of ['supplierId', 'productId', 'productName', 'itemCode', 'billingDate', 'billId', 'paymentMode']) {
      if (body[f] !== undefined && body[f] !== null) update[f] = String(body[f]).trim();
    }
    // number fields
    for (const f of ['quantity', 'purchasePrice', 'taxRate', 'taxAmount', 'billTotal', 'discount', 'roundOff', 'paidAmount']) {
      if (body[f] !== undefined && body[f] !== null && body[f] !== '') {
        const n = Number(body[f]);
        update[f] = Number.isFinite(n) ? n : 0;
      }
    }

    if (update.quantity !== undefined) update.quantity = Math.max(1, update.quantity);
    if (update.purchasePrice !== undefined) update.purchasePrice = Math.max(0, update.purchasePrice);

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await Purchase.findOneAndUpdate(
      { _id: id, userId },
      { $set: update },
      { new: true, strict: false }
    );
    if (!updated) return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });

    return NextResponse.json(toClient(updated));
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    await dbConnect();
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid purchase ID' }, { status: 400 });
    }

    const deleted = await Purchase.findOneAndDelete({ _id: id, userId });
    if (!deleted) return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}