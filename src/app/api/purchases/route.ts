import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../../../lib/mongodb';
import Product from '../../../../models/Product';
import Purchase from '../../../../models/Purchase';
import Supplier from '../../../../models/Supplier';

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

    const purchases = await Purchase.find(query).sort({ billingDate: -1, createdAt: -1 });

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
    let {
  supplierId, productId, productName, itemCode, quantity, purchasePrice, taxRate, taxAmount, billingDate,
  billId, billTotal, discount, roundOff, paidAmount, paymentMode,
} = body;

    // Handle missing or invalid supplier gracefully by linking to or creating a default supplier
    if (!supplierId || supplierId === 'undefined' || supplierId === 'null') {
      let defaultSupplier = await Supplier.findOne({ userId, name: 'Cash / Direct Purchase' });
      if (!defaultSupplier) {
        defaultSupplier = await Supplier.create({
          userId,
          name: 'Cash / Direct Purchase',
          contactPerson: 'Counter',
          phone: '',
          email: '',
          address: '',
        });
      }
      supplierId = defaultSupplier._id.toString();
    }

    const cleanName = productName && String(productName).trim() ? String(productName).trim() : 'Unnamed Item';
    const qty = Math.max(1, Number(quantity) || 1);
    const cost = Math.max(0, Number(purchasePrice) || 0);

    // If productId is missing, temporary, or not a valid ObjectId, find or create the product in MongoDB Atlas
    let finalProductId = productId ? String(productId) : '';
    if (!finalProductId || finalProductId.startsWith('temp-') || finalProductId.startsWith('past-') || !mongoose.Types.ObjectId.isValid(finalProductId)) {
      let prod = await Product.findOne({ userId, name: cleanName });
      if (!prod && itemCode) {
        prod = await Product.findOne({ userId, sku: String(itemCode).trim() });
      }
      if (!prod) {
        prod = await Product.create({
          userId,
          name: cleanName,
          sku: itemCode ? String(itemCode).trim() : `SX-${Math.floor(1000 + Math.random() * 9000)}`,
          category: 'General',
          purchasePrice: cost,
          sellingPrice: Math.round(cost * 1.25),
          mrp: 0,
          stock: qty,
          minStock: 2,
          supplierId: String(supplierId),
        });
      }
      finalProductId = prod._id.toString();
    }

   const num = (v: any) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));

const purchase = await Purchase.create({
  userId,
  supplierId: String(supplierId),
  productId: finalProductId,
  productName: cleanName,
  itemCode: itemCode ? String(itemCode).trim() : '',
  quantity: qty,
  purchasePrice: cost,
  taxRate: Number(taxRate) || 0,
  taxAmount: Number(taxAmount) || 0,
  billingDate: billingDate || new Date().toISOString().split('T')[0],
  ...(billId ? { billId: String(billId) } : {}),
  ...(num(billTotal) !== undefined ? { billTotal: num(billTotal) } : {}),
  ...(num(discount) !== undefined ? { discount: num(discount) } : {}),
  ...(num(roundOff) !== undefined ? { roundOff: num(roundOff) } : {}),
  ...(num(paidAmount) !== undefined ? { paidAmount: num(paidAmount) } : {}),
  ...(paymentMode ? { paymentMode: String(paymentMode) } : {}),
});

    const obj = purchase.toObject() as any;
    obj.id = obj._id.toString();
    delete obj._id;

    return NextResponse.json(obj, { status: 201 });
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
    const { productId, quantity, purchasePrice, supplierId, sellingPrice, mrp, billingDate } = body;

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
    if (sellingPrice !== undefined && Number(sellingPrice) > 0) {
      product.sellingPrice = Number(sellingPrice);
    }
    if (mrp !== undefined && Number(mrp) > 0) {
      product.set('mrp', Number(mrp));
    }
    await product.save();

    if (supplierId) {
      await Purchase.create({
        userId,
        supplierId,
        productId,
        productName: product.name,
        itemCode: product.sku,
        quantity: Number(quantity),
        purchasePrice: Number(purchasePrice ?? product.purchasePrice ?? 0),
        billingDate: billingDate || new Date().toISOString().split('T')[0],
      });
    }

    const obj = product.toObject() as any;
    obj.id = obj._id.toString();
    delete obj._id;

    if (global.io) {
      global.io.emit('inventory_update', {
        action: 'update',
        productId: productId,
        product: obj,
      });
    }

    return NextResponse.json(obj);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}