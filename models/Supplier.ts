import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISupplier extends Document {
  userId: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address?: string;
  createdAt: string;
}

const SupplierSchema = new Schema<ISupplier>({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  contactPerson: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  address: { type: String },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const Supplier: Model<ISupplier> =
  mongoose.models.Supplier || mongoose.model<ISupplier>('Supplier', SupplierSchema);

export default Supplier;