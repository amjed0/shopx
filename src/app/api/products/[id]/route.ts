import { NextResponse } from 'next/server';
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
    const data = await request.json();
    
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: id, userId },
      data,
      { new: true }
    );
    
    if (!updatedProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    
    const obj = updatedProduct.toObject();
    obj.id = obj._id.toString();
    delete obj._id;
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
    const deletedProduct = await Product.findOneAndDelete({ _id: id, userId });
    
    if (!deletedProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
