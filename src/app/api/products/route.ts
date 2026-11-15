import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import Product from '../../../../models/Product';
import Purchase from '../../../../models/Purchase';

// Convert numeric fields to numbers, default MRP to 0, strip fields the client must not set
function cleanProductPayload(data: any) {
  const out: any = { ...data };
  delete out._id;
  delete out.id;
  delete out.userId;

  for (const f of ['purchasePrice', 'sellingPrice', 'mrp', 'stock', 'minStock']) {
    if (out[f] !== undefined && out[f] !== null && out[f] !== '') {
      const n = Number(out[f]);
      out[f] = Number.isFinite(n) ? n : 0;
    }
  }
  if (out.mrp === undefined || out.mrp === null || out.mrp === '') out.mrp = 0;
  return out;
}

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
    const data = cleanProductPayload(await request.json());

    const newProduct = new Product({
      ...data,
      userId,
    });

    await newProduct.save();

    const stockQty = Number(data.stock !== undefined ? data.stock : newProduct.stock);
    const supplierId = data.supplierId || newProduct.supplierId;
    const purchasePrice = Number(data.purchasePrice !== undefined ? data.purchasePrice : newProduct.purchasePrice);

    const hasStock = stockQty > 0;
    const hasSupplier = !!supplierId && supplierId !== '';

    if (hasStock && hasSupplier && !data.skipPurchase) {
      await Purchase.create({
        userId,
        supplierId: supplierId,
        productId: newProduct._id.toString(),
        productName: newProduct.name,
        itemCode: newProduct.sku,
        quantity: stockQty,
        purchasePrice: purchasePrice,
      });
    }

    const obj = newProduct.toObject();
    obj.id = obj._id.toString();
    delete obj._id;

    if (global.io) {
      global.io.emit('inventory_update', {
        action: 'create',
        product: obj,
      });
    }

    return NextResponse.json(obj, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
