import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IExpense extends Document {
  userId: string;
  category: string;
  description: string;
  amount: number;
  paymentMode: string;
  note?: string;
  createdAt: string;
}

const ExpenseSchema = new Schema<IExpense>({
  userId: { type: String, required: true, index: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  paymentMode: { type: String, required: true, default: 'Cash' },
  note: { type: String },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const Expense: Model<IExpense> =
  mongoose.models.Expense || mongoose.model<IExpense>('Expense', ExpenseSchema);

export default Expense;