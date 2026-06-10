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

    // ── Validate required fields ──────────────────────────────────────────────
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ── Check duplicate user ───────────────────────────────────────────────────
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    // ── Determine userId ───────────────────────────────────────────────────────
    // If a shop record already exists for this email (pre-seeded data), reuse
    // its userId so inventory/sales data stays linked. Otherwise generate fresh.
    const existingShop = await Shop.findOne({ email: normalizedEmail });
    const userId: string =
      existingShop?.userId
        ? String(existingShop.userId)
        : new mongoose.Types.ObjectId().toString();

    // ── Create user ────────────────────────────────────────────────────────────
    const hashedPassword = hashPassword(password);
    const newUser = new User({
      _id: userId,
      email: normalizedEmail,
      password: hashedPassword,
    });
    await newUser.save();

    // ── Set session cookie ─────────────────────────────────────────────────────
    const userPayload = { uid: userId, email: normalizedEmail };
    await setSessionCookie(userPayload);

    return NextResponse.json({ user: userPayload }, { status: 201 });

  } catch (error: any) {
    console.error('[signup]', error);

    // Mongoose duplicate-key error (race condition)
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}