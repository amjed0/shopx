import { NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/mongodb';
import Customer from '../../../../../models/Customer';

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
    
    const updatedCustomer = await Customer.findOneAndUpdate(
      { _id: id, userId },
      data,
      { new: true }
    );
    
    if (!updatedCustomer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }
    
    const obj = updatedCustomer.toObject();
    obj.id = obj._id.toString();
    delete obj._id;
    return NextResponse.json(obj);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
