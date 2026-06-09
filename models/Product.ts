import mongoose, { Schema, model, models } from 'mongoose';

const ProductSchema = new Schema({
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
  createdAt: { type: Date, default: Date.now },
});

if (process.env.NODE_ENV === 'development' && mongoose.models.Product) {
  delete mongoose.models.Product;
}

const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
export default Product;
