import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISupplierPayment extends Document {
  userId: string;
  supplierId: string;
  amount: number;
  paymentMode: string;
  note: string;
  createdAt: string;
}

const SupplierPaymentSchema = new Schema<ISupplierPayment>({
  userId: { type: String, required: true, index: true },
  supplierId: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  paymentMode: { type: String, required: true, default: 'Cash' },
  note: { type: String, default: '' },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

if (process.env.NODE_ENV !== 'production') {
  delete mongoose.models.SupplierPayment;
}

const SupplierPayment: Model<ISupplierPayment> =
  mongoose.models.SupplierPayment || mongoose.model<ISupplierPayment>('SupplierPayment', SupplierPaymentSchema);

export default SupplierPayment;

