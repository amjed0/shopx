import mongoose, { Schema, model, models } from 'mongoose';

const ShopSchema = new Schema({
  userId: { type: String, required: true, unique: true },
  ownerName: { type: String, required: true },
  companyName: { type: String, required: true },
  location: { type: String },
  phone: { type: String },
  email: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const Shop = models.Shop || model('Shop', ShopSchema);
export default Shop;