import mongoose, { Schema, model, models } from 'mongoose';

const NoteSubSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, default: '' },
    content: { type: String, default: '' },
    category: { type: String, default: 'General' },
    dueDate: { type: String, default: '' },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false }
);

const ProductSchema = new Schema(
  {
    name: { type: String, required: true },
    sku: { type: String, required: true },
    category: { type: String, required: true },
    supplier: { type: String, default: '' },
    supplierId: { type: String, default: '' },
    supplierName: { type: String, default: '' },
    purchasePrice: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },
    stock: { type: Number, required: true },
    minStock: { type: Number, required: true },
    userId: { type: String, required: true },
    notes: { type: [NoteSubSchema], default: [] },
    remarks: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { strict: false }
);

if (process.env.NODE_ENV === 'development' && mongoose.models.Product) {
  delete mongoose.models.Product;
}

const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
export default Product;
