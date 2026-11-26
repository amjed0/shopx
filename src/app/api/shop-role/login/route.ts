/**
 * POST /api/shop-role/login
 * Stage-2 login: Owner pin or Employee ID + PIN
 * Returns a signed JWT stored in an HTTP-only cookie: shopx-role-token
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import dbConnect from '../../../../../lib/mongodb';
import ShopEmployee from '../../../../../models/ShopEmployee';
import User from '../../../../../models/User';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import {
  EmployeePermissions,
  OWNER_PERMISSIONS,
  normalizePermissions,
} from '../../../../../lib/permissions';

const ROLE_SECRET = new TextEncoder().encode(
  process.env.SHOP_ROLE_SECRET || 'shopx-role-secret-2026-change-me'
);
const COOKIE_NAME = 'shopx-role-token';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await req.json();
    const { mode, pin, employeeId } = body as {
      mode: 'OWNER' | 'EMPLOYEE';
      pin?: string;
      employeeId?: string;
    };

    if (!mode || !['OWNER', 'EMPLOYEE'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }

    await dbConnect();

    let role: 'OWNER' | 'EMPLOYEE' = mode;
    let empName = '';
    let empId = '';
    let permissions: EmployeePermissions = { ...OWNER_PERMISSIONS };

    if (mode === 'OWNER') {
      if (!pin) return NextResponse.json({ error: 'Password required' }, { status: 400 });

      let user: any = null;
      try {
        user = await User.findById(userId).lean();
      } catch {
        user = null;
      }
      if (!user && session.user?.email) {
        user = await User.findOne({ email: session.user.email.toLowerCase().trim() }).lean();
      }
      if (!user) return NextResponse.json({ error: 'Owner account not found' }, { status: 404 });

      const valid = await bcrypt.compare(pin, user.password);
      if (!valid) return NextResponse.json({ error: 'Invalid owner password' }, { status: 401 });

      empName = user.name || user.email;
      permissions = { ...OWNER_PERMISSIONS };
    } else {
      // Employee: look up by employeeId for this shop
      if (!employeeId || !pin) {
        return NextResponse.json({ error: 'Employee ID and password/PIN are required' }, { status: 400 });
      }

      const normalizedEmpId = employeeId.trim().toUpperCase();
      const emp = await ShopEmployee.findOne({
        $or: [{ shopId: userId }, { userId }],
        employeeId: normalizedEmpId,
      });

      if (!emp) {
        return NextResponse.json(
          { error: `Employee "${normalizedEmpId}" not found. Ask Owner to create it in Profile.` },
          { status: 404 }
        );
      }
      if (!emp.isActive) {
        return NextResponse.json(
          { error: 'This employee account is disabled. Contact the Shop Owner.' },
          { status: 403 }
        );
      }

      const valid = await bcrypt.compare(pin, emp.pin);
      if (!valid) return NextResponse.json({ error: 'Invalid Employee password/PIN' }, { status: 401 });

      empName = emp.name;
      empId = emp.employeeId;
      permissions = normalizePermissions(emp.permissions as any);
    }

    // Sign a short-lived JWT (8 hours)
    const token = await new SignJWT({ userId, role, empName, empId, permissions })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(ROLE_SECRET);

    const res = NextResponse.json({
      ok: true,
      role,
      name: empName,
      employeeId: empId,
      permissions,
    });

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60,
      secure: process.env.NODE_ENV === 'production',
    });

    return res;
  } catch (err: any) {
    console.error('[shop-role/login]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
