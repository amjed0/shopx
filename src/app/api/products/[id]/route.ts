import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../../../../lib/mongodb';
import Product from '../../../../../models/Product';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }
    const data = await request.json();

    // Never let the client change ownership or the id
    delete data._id;
    delete data.id;
    delete data.userId;

    // Numeric fields (includes the new mrp)
    for (const f of ['purchasePrice', 'sellingPrice', 'mrp', 'stock', 'minStock']) {
      if (data[f] !== undefined && data[f] !== null && data[f] !== '') {
        const n = Number(data[f]);
        data[f] = Number.isFinite(n) ? n : 0;
      }
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: id, userId },
      { $set: data },
      { new: true }
    );

    if (!updatedProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const obj = updatedProduct.toObject();
    obj.id = obj._id.toString();
    delete obj._id;

    if (global.io) {
      global.io.emit('inventory_update', {
        action: 'update',
        productId: id,
        product: obj,
      });
    }

    return NextResponse.json(obj);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }
    const deletedProduct = await Product.findOneAndDelete({ _id: id, userId });

    if (!deletedProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    if (global.io) {
      global.io.emit('inventory_update', {
        action: 'delete',
        productId: id,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
