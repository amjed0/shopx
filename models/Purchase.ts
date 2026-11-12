import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPurchase extends Document {
  userId: string;
  supplierId: string;
  productId: string;
  productName: string;
  itemCode?: string;
  quantity: number;
  purchasePrice: number;
  billingDate: string;
  createdAt: string;
}

const PurchaseSchema = new Schema<IPurchase>({
  userId: { type: String, required: true, index: true },
  supplierId: { type: String, required: true, index: true },
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  itemCode: { type: String },
  quantity: { type: Number, required: true },
  purchasePrice: { type: Number, required: true },
  billingDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
  createdAt: { type: String, default: () => new Date().toISOString() },
}, { strict: false });

// Clear cached model in dev
if (process.env.NODE_ENV !== 'production') {
  delete mongoose.models.Purchase;
}

const Purchase: Model<IPurchase> =
  mongoose.models.Purchase || mongoose.model<IPurchase>('Purchase', PurchaseSchema);

export default Purchase;
