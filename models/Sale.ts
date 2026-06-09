import { Schema, model, models, Document } from 'mongoose';

// ── Sale Item ──
export interface ISaleItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

const SaleItemSchema = new Schema<ISaleItem>({
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
});

// ── Sale ──
export interface ISale extends Document {
  date: string;
  customerId: string;
  customerName: string;
  total: number;
  status: 'paid' | 'pending' | 'returned';
  paymentMethod: 'cash' | 'upi' | 'card' | 'credit';
  items: ISaleItem[];
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

const SaleSchema = new Schema<ISale>(
  {
    date: { type: String, required: true },
    customerId: { type: String, required: true },
    customerName: { type: String, required: true },
    total: { type: Number, required: true },
    status: { type: String, enum: ['paid', 'pending', 'returned'], required: true },
    paymentMethod: { type: String, enum: ['cash', 'upi', 'card', 'credit'], required: true },
    items: [SaleItemSchema],
    userId: { type: String, required: true },
  },
  { timestamps: true }
);

const Sale = models.Sale || model<ISale>('Sale', SaleSchema);
export default Sale;