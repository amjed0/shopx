import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPurchase extends Document {
  userId: string;
  supplierId: string;
  productId: string;
  productName: string;
  itemCode?: string;
  quantity: number;
  purchasePrice: number;
  taxRate?: number;
  taxAmount?: number;
  billingDate: string;
  createdAt: string;

  // Bill-level details (the same value is saved on every row of one bill)
  billId?: string;
  billTotal?: number;
  discount?: number;
  roundOff?: number;
  paidAmount?: number;
  paymentMode?: string;
}

const PurchaseSchema = new Schema<IPurchase>({
  userId: { type: String, required: true, index: true },
  supplierId: { type: String, required: true, index: true },
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  itemCode: { type: String },
  quantity: { type: Number, required: true },
  purchasePrice: { type: Number, required: true },
  taxRate: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  billingDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
  createdAt: { type: String, default: () => new Date().toISOString() },

  // No defaults on purpose: old purchases without these fields must stay "unknown"
  // (purchase-bills.ts treats a missing paidAmount as "not recorded", not as 0)
  billId: { type: String, index: true },
  billTotal: { type: Number },
  discount: { type: Number },
  roundOff: { type: Number },
  paidAmount: { type: Number },
  paymentMode: { type: String },
}, { strict: false });

// Clear cached model in dev
if (process.env.NODE_ENV !== 'production') {
  delete mongoose.models.Purchase;
}

const Purchase: Model<IPurchase> =
  mongoose.models.Purchase || mongoose.model<IPurchase>('Purchase', PurchaseSchema);

export default Purchase;
