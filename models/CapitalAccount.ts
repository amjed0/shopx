import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFixedAsset {
  id?: string;
  name: string;
  amount: number;
  category: string;
  date?: string;
}

export interface IBankLoan {
  bankName: string;
  loanAmount: number;
  interestRate?: number;
  startDate?: string;
  note?: string;
}

export interface IRenovation {
  description: string;
  amount: number;
  date?: string;
  note?: string;
}

export interface ICapitalAccount extends Document {
  userId: string;
  businessType: 'new' | 'existing';
  ownerCapital: number;
  fixedAssets: IFixedAsset[];
  bankLoans: IBankLoan[];
  renovations: IRenovation[];
  openingStockManual: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Clear cached model in dev
if (process.env.NODE_ENV !== 'production') {
  delete mongoose.models.CapitalAccount;
}

const FixedAssetSchema = new Schema({
  id: { type: String },
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  category: {
    type: String,
    default: 'other',
  },
  date: { type: String },
}, { _id: false });

const BankLoanSchema = new Schema({
  id: { type: String },
  bankName: { type: String, required: true },
  loanAmount: { type: Number, required: true },
  interestRate: { type: Number },
  startDate: { type: String },
  note: { type: String },
}, { _id: false });

const RenovationSchema = new Schema({
  id: { type: String },
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: String },
  note: { type: String },
}, { _id: false });

const CapitalAccountSchema = new Schema<ICapitalAccount>(
  {
    userId: { type: String, required: true, index: true },
    businessType: { type: String, enum: ['new', 'existing'], default: 'new' },
    ownerCapital: { type: Number, default: 0 },
    fixedAssets: { type: [FixedAssetSchema], default: [] },
    bankLoans: { type: [BankLoanSchema], default: [] },
    renovations: { type: [RenovationSchema], default: [] },
    openingStockManual: { type: Number, default: 0 },
    notes: { type: String },
  },
  { strict: false, timestamps: true }
);

const CapitalAccount: Model<ICapitalAccount> =
  mongoose.models.CapitalAccount ||
  mongoose.model<ICapitalAccount>('CapitalAccount', CapitalAccountSchema);

export default CapitalAccount;
