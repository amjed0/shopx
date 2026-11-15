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
    console.error('GET /api/suppliers error:', error);
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
    console.log('Supplier payload:', data);

    // Remove client-sent ids so Mongoose generates a fresh _id
    const { id, _id, ...rest } = data;

    const name = typeof rest.name === 'string' ? rest.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });
    }

    const newSupplier = new Supplier({
      ...rest,
      name,
      // Invoices rarely contain a contact person, so fall back to the supplier name
      contactPerson:
        typeof rest.contactPerson === 'string' && rest.contactPerson.trim()
          ? rest.contactPerson.trim()
          : name,
      phone: typeof rest.phone === 'string' ? rest.phone.trim() : '',
      userId,
      
    });

    await newSupplier.save();

    const obj = newSupplier.toObject();
    const { _id: savedId, ...savedRest } = obj;
    return NextResponse.json({ id: savedId.toString(), ...savedRest }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/suppliers error:', error);

    if (error.name === 'ValidationError') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      return NextResponse.json(
        { error: `Supplier with this ${field} already exists` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}