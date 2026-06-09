import { NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/mongodb';
import User from '../../../../../models/User';
import Shop from '../../../../../models/Shop';
import { hashPassword, setSessionCookie } from '../../../../../lib/session';
import mongoose from 'mongoose';

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 });
    }

    // Check if a shop already exists with this email (link existing data)
    const existingShop = await Shop.findOne({ email: normalizedEmail });
    let userId: string;

    if (existingShop && existingShop.userId) {
      userId = String(existingShop.userId);
    } else {
      userId = new mongoose.Types.ObjectId().toString();
    }

    // Hash password and save new user
    const hashedPassword = hashPassword(password);
    const newUser = new User({
      _id: userId,
      email: normalizedEmail,
      password: hashedPassword,
    });
    await newUser.save();

    // Set session cookie
    const userPayload = { uid: userId, email: normalizedEmail };
    await setSessionCookie(userPayload);

    return NextResponse.json({ user: userPayload }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}