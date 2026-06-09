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
    const products = await Product.find({ userId }).sort({ name: 1 });
    const formattedProducts = products.map((p) => {
      const obj = p.toObject();
      obj.id = obj._id.toString();
      delete obj._id;
      return obj;
    });
    return NextResponse.json(formattedProducts);
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
    console.log("[DEBUG api/products] Received data:", data);

    const newProduct = new Product({
      ...data,
      userId,
    });
    console.log("[DEBUG api/products] Created Mongoose document before save:", newProduct.toObject());

    await newProduct.save();
    console.log("[DEBUG api/products] Saved Mongoose document:", newProduct.toObject());

    const stockQty = Number(data.stock !== undefined ? data.stock : newProduct.stock);
    const supplierId = data.supplierId || newProduct.supplierId;
    const purchasePrice = Number(data.purchasePrice !== undefined ? data.purchasePrice : newProduct.purchasePrice);

    const hasStock = stockQty > 0;
    const hasSupplier = !!supplierId && supplierId !== '';
    console.log("[DEBUG api/products] Check status:", { hasStock, hasSupplier, stockQty, supplierId });

    if (hasStock && hasSupplier) {
      console.log("[DEBUG api/products] Creating Purchase record for supplierId:", supplierId);
      const purchaseRecord = await Purchase.create({
        userId,
        supplierId: supplierId,
        productId: newProduct._id.toString(),
        productName: newProduct.name,
        quantity: stockQty,
        purchasePrice: purchasePrice,
      });
      console.log("[DEBUG api/products] Created Purchase record:", purchaseRecord.toObject());
    }

    const obj = newProduct.toObject();
    obj.id = obj._id.toString();
    delete obj._id;
    return NextResponse.json(obj, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
