import mongoose, { Schema, model, models } from 'mongoose';

const CustomerSchema = new Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  outstandingBalance: { type: Number, default: 0 },
  userId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Customer = models.Customer || model('Customer', CustomerSchema);
export default Customer;
