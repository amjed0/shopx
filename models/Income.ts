import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IIncome extends Document {
  userId: string;
  category: string;
  description: string;
  amount: number;
  paymentMode: string;
  note?: string;
  createdAt: string;
}

const IncomeSchema = new Schema<IIncome>({
  userId: { type: String, required: true, index: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  paymentMode: { type: String, required: true, default: 'Cash' },
  note: { type: String },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const Income: Model<IIncome> =
  mongoose.models.Income || mongoose.model<IIncome>('Income', IncomeSchema);

export default Income;