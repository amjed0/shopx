import mongoose, { Schema, model, models, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { EmployeePermissions, DEFAULT_EMPLOYEE_PERMISSIONS } from '../lib/permissions';

export interface IShopEmployee extends Document {
  userId: string;        // Owner's userId (links to User)
  shopId: string;        // Shop's _id or userId (same as userId in this app)
  employeeId: string;    // e.g. "EMP001" – set by owner, used to log in
  name: string;
  phone?: string;
  pin: string;           // bcrypt-hashed 4–6 digit PIN or password
  isActive: boolean;
  permissions: EmployeePermissions;
  createdAt: Date;
}

const PermissionsSchema = new Schema<EmployeePermissions>(
  {
    billing:             { type: Boolean, default: DEFAULT_EMPLOYEE_PERMISSIONS.billing },
    salesEntry:          { type: Boolean, default: DEFAULT_EMPLOYEE_PERMISSIONS.salesEntry },
    purchaseEntry:       { type: Boolean, default: DEFAULT_EMPLOYEE_PERMISSIONS.purchaseEntry },
    productView:         { type: Boolean, default: DEFAULT_EMPLOYEE_PERMISSIONS.productView },
    inventoryManagement: { type: Boolean, default: DEFAULT_EMPLOYEE_PERMISSIONS.inventoryManagement },
    dashboard:           { type: Boolean, default: DEFAULT_EMPLOYEE_PERMISSIONS.dashboard },
    balanceSheet:        { type: Boolean, default: DEFAULT_EMPLOYEE_PERMISSIONS.balanceSheet },
    accounting:          { type: Boolean, default: DEFAULT_EMPLOYEE_PERMISSIONS.accounting },
    management:          { type: Boolean, default: DEFAULT_EMPLOYEE_PERMISSIONS.management },
  },
  { _id: false }
);

const ShopEmployeeSchema = new Schema<IShopEmployee>({
  userId:     { type: String, required: true, index: true },
  shopId:     { type: String, required: true, index: true },
  employeeId: { type: String, required: true },
  name:       { type: String, required: true, trim: true },
  phone:      { type: String },
  pin:        { type: String, required: true },   // stored hashed
  isActive:   { type: Boolean, default: true },
  permissions:{ type: PermissionsSchema, default: () => ({ ...DEFAULT_EMPLOYEE_PERMISSIONS }) },
  createdAt:  { type: Date, default: Date.now },
});

// Compound unique: one employeeId per shop
ShopEmployeeSchema.index({ shopId: 1, employeeId: 1 }, { unique: true });

// Hash PIN before save (Mongoose 9 async hook — no `next` callback)
ShopEmployeeSchema.pre('save', async function () {
  if (!this.isModified('pin')) return;
  this.pin = await bcrypt.hash(this.pin, 10);
});

ShopEmployeeSchema.methods.verifyPin = async function (plain: string): Promise<boolean> {
  return bcrypt.compare(plain, this.pin);
};

if (process.env.NODE_ENV === 'development' && mongoose.models.ShopEmployee) {
  delete mongoose.models.ShopEmployee;
}

const ShopEmployee = models.ShopEmployee || model<IShopEmployee>('ShopEmployee', ShopEmployeeSchema);
export default ShopEmployee;
