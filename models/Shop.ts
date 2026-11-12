import mongoose, { Schema, model, models } from 'mongoose';

const ShopSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true },
    ownerName: { type: String, required: true },
    companyName: { type: String, required: true },
    location: { type: String },
    phone: { type: String },
    email: { type: String },
    gstNumber: { type: String },
    businessCategory: { type: String, default: 'retail' },
    createdAt: { type: Date, default: Date.now },
  },
  { strict: false }
);

if (process.env.NODE_ENV === 'development' && mongoose.models.Shop) {
  delete mongoose.models.Shop;
}

const Shop = models.Shop || model('Shop', ShopSchema);
export default Shop;