import { NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/mongodb';
import User from '../../../../../models/User';
import Shop from '../../../../../models/Shop';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { name, email, password } = body;

   if (!name || !email || !password) {
  return NextResponse.json(
    { error: 'Name, email and password are required' },
    { status: 400 }
  );
}

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    const existingShop = await Shop.findOne({ email: normalizedEmail });
    const userId: string =
      existingShop?.userId
        ? String(existingShop.userId)
        : new mongoose.Types.ObjectId().toString();

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      _id: userId,
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });
    await newUser.save();

    const userPayload = { uid: userId, email: normalizedEmail };

    return NextResponse.json({ user: userPayload }, { status: 201 });

  } catch (error: any) {
    console.error('[signup]', error);

    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}