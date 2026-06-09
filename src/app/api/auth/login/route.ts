import { NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/mongodb';
import User from '../../../../../models/User';
import Shop from '../../../../../models/Shop';
import { verifyPassword, hashPassword, setSessionCookie } from '../../../../../lib/session';

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user in users collection
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // Check if they have an existing shop (automatic first-time login migration)
      const existingShop = await Shop.findOne({ email: normalizedEmail });
      if (existingShop && existingShop.userId) {
        // Create the user document using the existing shop's userId
        const hashedPassword = hashPassword(password);
        user = new User({
          _id: existingShop.userId,
          email: normalizedEmail,
          password: hashedPassword,
        });
        await user.save();
      } else {
        return NextResponse.json({ error: 'User not found' }, { status: 401 });
      }
    } else {
      // User exists — verify password
      const isPasswordCorrect = verifyPassword(password, user.password);
      if (!isPasswordCorrect) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
    }

    // Set session cookie
    const userPayload = { uid: String(user._id), email: user.email };
    await setSessionCookie(userPayload);

    return NextResponse.json({ user: userPayload });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}