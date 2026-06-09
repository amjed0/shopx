import mongoose, { Schema, model, models } from 'mongoose';

const ReturnItemSchema = new Schema({
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  sku: { type: String },
  quantity: { type: Number, required: true },
  salePrice: { type: Number, required: true },
});

const SaleReturnSchema = new Schema({
  userId: { type: String, required: true },
  customerName: { type: String, required: true },
  customerId: { type: String, default: null },
  returnDate: { type: String, required: true },
  reason: { type: String },
  totalAmount: { type: Number, required: true },
  items: [ReturnItemSchema],
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const SaleReturn = models.SaleReturn || model('SaleReturn', SaleReturnSchema);
export default SaleReturn;