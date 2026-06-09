import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPurchase extends Document {
  userId: string;
  supplierId: string;
  productId: string;
  productName: string;
  quantity: number;
  purchasePrice: number;
  createdAt: string;
}

const PurchaseSchema = new Schema<IPurchase>({
  userId: { type: String, required: true, index: true },
  supplierId: { type: String, required: true, index: true },
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true },
  purchasePrice: { type: Number, required: true },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const Purchase: Model<IPurchase> =
  mongoose.models.Purchase || mongoose.model<IPurchase>('Purchase', PurchaseSchema);

export default Purchase;
