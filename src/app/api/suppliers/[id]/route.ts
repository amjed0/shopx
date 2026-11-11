import { NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/mongodb';
import Supplier from '../../../../../models/Supplier';

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

    const updatedSupplier = await Supplier.findOneAndUpdate(
      { _id: id, userId },
      { $set: data },
      { new: true }
    );

    if (!updatedSupplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const obj = updatedSupplier.toObject();
    const { _id, ...rest } = obj;
    return NextResponse.json({ id: _id.toString(), ...rest });
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
    const deletedSupplier = await Supplier.findOneAndDelete({ _id: id, userId });

    if (!deletedSupplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
