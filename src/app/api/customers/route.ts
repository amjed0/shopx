import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Customer from '../../../../models/Customer';

export async function GET(request: Request) {
  try {
    await dbConnect();
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const customers = await Customer.find({ userId }).sort({ name: 1 });
    const formattedCustomers = customers.map((c) => {
      const obj = c.toObject();
      obj.id = obj._id.toString();
      delete obj._id;
      return obj;
    });
    return NextResponse.json(formattedCustomers);
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
    const newCustomer = new Customer({
      ...data,
      userId,
    });
    await newCustomer.save();
    const obj = newCustomer.toObject();
    obj.id = obj._id.toString();
    delete obj._id;
    return NextResponse.json(obj, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
