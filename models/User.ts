import mongoose, { Schema, model, models } from 'mongoose';

const UserSchema = new Schema({
  _id: { type: String, required: true }, // Using string type to easily support existing Firebase UIDs and MongoDB ObjectIds
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const User = models.User || model('User', UserSchema);
export default User;
