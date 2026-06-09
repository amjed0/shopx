import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Product from '../../../../models/Product';
import Purchase from '../../../../models/Purchase';

export async function GET(request: Request) {
  try {
    await dbConnect();

    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');

    const query: any = { userId };
    if (supplierId) query.supplierId = supplierId;

    const purchases = await Purchase.find(query).sort({ createdAt: -1 });

    const result = purchases.map((p: any) => {
      const obj = p.toObject() as any;
      obj.id = obj._id.toString();
      delete obj._id;
      return obj;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(error);
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

    const body = await request.json();
    const { supplierId, productId, productName, quantity, purchasePrice } = body;

    const purchase = await Purchase.create({
      userId,
      supplierId,
      productId,
      productName,
      quantity,
      purchasePrice,
    });

    const obj = purchase.toObject() as any;
    obj.id = obj._id.toString();
    delete obj._id;

    return NextResponse.json(obj);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await dbConnect();

    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { productId, quantity, purchasePrice, supplierId } = body;

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }
    if (quantity === undefined || quantity === null) {
      return NextResponse.json({ error: 'Quantity is required' }, { status: 400 });
    }

    const product = await Product.findOne({ _id: productId, userId });
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    product.stock = Number(product.stock || 0) + Number(quantity);
    if (purchasePrice !== undefined) {
      product.purchasePrice = Number(purchasePrice);
    }
    await product.save();

    if (supplierId) {
      await Purchase.create({
        userId,
        supplierId,
        productId,
        productName: product.name,
        quantity: Number(quantity),
        purchasePrice: Number(purchasePrice ?? product.purchasePrice ?? 0),
      });
    }

    const obj = product.toObject() as any;
    obj.id = obj._id.toString();
    delete obj._id;

    return NextResponse.json(obj);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}