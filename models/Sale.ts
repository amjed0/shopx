import { Schema, model, models, Document } from 'mongoose';

// ── Sale Item ──
export interface ISaleItem {
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  price: number;
  taxRate?: number;
  taxAmount?: number;
}

const SaleItemSchema = new Schema<ISaleItem>({
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  sku: { type: String },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  taxRate: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
}, { _id: false });

// ── Sale ──
export interface ISale extends Document {
  billNumber?: string;
  invoiceNumber?: string;
  date: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  subtotal?: number;
  discount?: number;
  taxRate?: number;
  taxAmount?: number;
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
    billNumber: { type: String },
    invoiceNumber: { type: String },
    date: { type: String, required: true },
    customerId: { type: String, required: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String },
    subtotal: { type: Number },
    discount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    status: { type: String, enum: ['paid', 'pending', 'returned'], required: true },
    paymentMethod: { type: String, enum: ['cash', 'upi', 'card', 'credit'], required: true },
    items: [SaleItemSchema],
    userId: { type: String, required: true },
  },
  { timestamps: true, strict: false }
);

const Sale = models.Sale || model<ISale>('Sale', SaleSchema);
export default Sale;