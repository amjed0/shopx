import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../../../../lib/mongodb';
import Sale from '../../../../../models/Sale';
import Product from '../../../../../models/Product';
import Customer from '../../../../../models/Customer';
import Income from '../../../../../models/Income';

type RouteContext = {
  params: Promise<{ id: string }>;          
};

export async function GET(
  request: Request,
  { params }: RouteContext
) {
  try {
    await dbConnect();

    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid sale ID' }, { status: 400 });
    }

    const sale = await Sale.findOne({ _id: id, userId }).lean();

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...sale,
      id: String(sale._id),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sale' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: RouteContext
) {
  await dbConnect();

  const userId = request.headers.get('x-user-id');

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid sale ID' }, { status: 400 });
  }

  const data = await request.json();

  const allowedPaymentMethods = ['cash', 'upi', 'card', 'credit'];

  if (!allowedPaymentMethods.includes(data.paymentMethod)) {
    return NextResponse.json(
      { error: 'Invalid payment method' },
      { status: 400 }
    );
  }

  if (
    !Array.isArray(data.items) ||
    data.items.length === 0 ||
    !data.items.every((item: any) =>
      item.productId &&
      Number.isInteger(Number(item.quantity)) &&
      Number(item.quantity) > 0 &&
      Number.isFinite(Number(item.price)) &&
      Number(item.price) >= 0 &&
      Number.isFinite(Number(item.taxAmount || 0)) &&
      Number(item.taxAmount || 0) >= 0
    )
  ) {
    return NextResponse.json(
      { error: 'Invalid bill items' },
      { status: 400 }
    );
  }

  const session = await mongoose.startSession();

  try {
    let updatedSale: any = null;
    const updatedProductsToEmit: any[] = [];

    await session.withTransaction(async () => {
      const oldSale = await Sale.findOne({
        _id: id,
        userId,
      }).session(session);

      if (!oldSale) {
        throw new Error('Sale not found');
      }

      if (oldSale.status === 'returned') {
        throw new Error('A returned sale cannot be edited');
      }

      const oldQuantities: Record<string, number> = {};
      const newQuantities: Record<string, number> = {};

      for (const item of oldSale.items) {
        oldQuantities[item.productId] =
          (oldQuantities[item.productId] || 0) + item.quantity;
      }

      for (const item of data.items) {
        newQuantities[item.productId] =
          (newQuantities[item.productId] || 0) +
          Number(item.quantity);
      }

      const productIds = new Set([
        ...Object.keys(oldQuantities),
        ...Object.keys(newQuantities),
      ]);

      const objectIdList = Array.from(productIds)
        .filter((pid) => mongoose.Types.ObjectId.isValid(pid))
        .map((pid) => new mongoose.Types.ObjectId(pid));
      const rawIdList = Array.from(productIds);

      // Single fast bulk find query for all affected products
      const foundProducts = await Product.find({
        $or: [
          ...(objectIdList.length > 0 ? [{ _id: { $in: objectIdList } }] : []),
          { sku: { $in: rawIdList } },
        ],
        userId,
      }).session(session);

      const productMap = new Map<string, any>();
      for (const p of foundProducts) {
        productMap.set(p._id.toString(), p);
        if (p.sku) productMap.set(p.sku, p);
      }

      // Adjust stock using the difference between old and new quantities
      for (const productId of productIds) {
        const oldQty = oldQuantities[productId] || 0;
        const newQty = newQuantities[productId] || 0;
        const stockChange = oldQty - newQty;

        if (stockChange === 0) continue;

        const actualProduct = productMap.get(productId);
        if (!actualProduct) {
          throw new Error(`Product not found: ${productId}`);
        }

        const result = await Product.findOneAndUpdate(
          {
            _id: actualProduct._id,
            userId,
            ...(stockChange < 0
              ? { stock: { $gte: Math.abs(stockChange) } }
              : {}),
          },
          { $inc: { stock: stockChange } },
          { session, new: true }
        );

        if (!result) {
          throw new Error(
            `Insufficient stock for ${actualProduct.name}`
          );
        }

        updatedProductsToEmit.push(result);
      }

      // Recalculate customer credit balances
      const oldWasCredit = oldSale.paymentMethod === 'credit';
      const newIsCredit = data.paymentMethod === 'credit';

      const oldCustomerId = oldSale.customerId;
      const newCustomerId = data.customerId;

      if (newIsCredit && (!newCustomerId || newCustomerId === 'walk-in')) {
        throw new Error('A customer is required for credit billing');
      }

      if (oldWasCredit && oldCustomerId && oldCustomerId !== 'walk-in') {
        const query = mongoose.Types.ObjectId.isValid(oldCustomerId)
          ? { _id: oldCustomerId, userId }
          : { phone: oldCustomerId, userId };

        await Customer.updateOne(
          query,
          { $inc: { outstandingBalance: -oldSale.total } },
          { session }
        );
      }

      if (newIsCredit) {
        const query = mongoose.Types.ObjectId.isValid(newCustomerId)
          ? { _id: newCustomerId, userId }
          : { phone: newCustomerId, userId };

        const newCustomer = await Customer.findOne(query).session(session);

        if (!newCustomer) {
          throw new Error('Customer not found for credit billing');
        }

        await Customer.updateOne(
          { _id: newCustomer._id, userId },
          { $inc: { outstandingBalance: Number(data.total) } },
          { session }
        );
      }

      // Update cashbook income entry
      const billNum = oldSale.billNumber || id.slice(-6).toUpperCase();
      if (newIsCredit) {
        await Income.deleteMany({ userId, note: `Bill #${billNum}` }).session(session);
      } else {
        const existingIncome = await Income.findOne({ userId, note: `Bill #${billNum}` }).session(session);
        if (existingIncome) {
          existingIncome.amount = Number(data.total) || 0;
          existingIncome.paymentMode = (data.paymentMethod || 'cash').toUpperCase();
          existingIncome.description = `Sale #${billNum} to ${data.customerName || 'Walk-in Customer'}`;
          await existingIncome.save({ session });
        } else {
          await Income.create(
            [
              {
                userId,
                category: 'Sales Revenue',
                description: `Sale #${billNum} to ${data.customerName || 'Walk-in Customer'}`,
                amount: Number(data.total) || 0,
                paymentMode: (data.paymentMethod || 'cash').toUpperCase(),
                note: `Bill #${billNum}`,
              },
            ],
            { session }
          );
        }
      }

      // Update the existing sale
      oldSale.billNumber = data.billNumber ?? oldSale.billNumber;
      oldSale.date = data.date ?? oldSale.date;
      oldSale.customerId = newCustomerId || 'walk-in';
      oldSale.customerName = data.customerName || 'Walk-in Customer';
      oldSale.customerPhone = data.customerPhone || '';
      oldSale.customerEmail = data.customerEmail || '';
      oldSale.subtotal = Number(data.subtotal) || 0;
      oldSale.taxAmount = Number(data.taxAmount) || 0;
      oldSale.discount = Number(data.discount) || 0;
      oldSale.total = Number(data.total) || 0;
      oldSale.paymentMethod = data.paymentMethod;
      oldSale.status = newIsCredit ? 'pending' : 'paid';
      oldSale.items = data.items.map((item: any) => ({
        productId: String(item.productId),
        productName: item.productName,
        sku: item.sku || '',
        quantity: Number(item.quantity),
        price: Number(item.price),
        taxRate: Number(item.taxRate) || 0,
        taxAmount: Number(item.taxAmount) || 0,
      }));

      await oldSale.save({ session });

      updatedSale = oldSale.toObject();
    });

    // Real-time socket events after transaction commits
    if ((global as any).io) {
      (global as any).io.emit('update_sale', {
        ...updatedSale,
        id: String(updatedSale._id),
      });

      for (const prod of updatedProductsToEmit) {
        const pObj = prod.toObject ? prod.toObject() : prod;
        pObj.id = pObj._id.toString();
        delete pObj._id;
        (global as any).io.emit('inventory_update', {
          action: 'update',
          productId: pObj.id,
          product: pObj,
        });
      }
    }

    return NextResponse.json({
      ...updatedSale,
      id: String(updatedSale._id),
      message: 'Sale updated successfully',
    });
  } catch (error: any) {
    console.error('Sale update error:', error);

    return NextResponse.json(
      { error: error.message || 'Failed to update sale' },
      { status: 400 }
    );
  } finally {
    await session.endSession();
  }
}
