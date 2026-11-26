/**
 * GET /api/shop-role/me
 * Returns the current shop-role & live permissions from DB/cookie, or null.
 * Also refreshes the shopx-role-token cookie when an employee's permissions
 * were updated by the Owner so middleware stays in sync immediately.
 */
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import dbConnect from '../../../../../lib/mongodb';
import ShopEmployee from '../../../../../models/ShopEmployee';
import {
  OWNER_PERMISSIONS,
  normalizePermissions,
} from '../../../../../lib/permissions';

const ROLE_SECRET = new TextEncoder().encode(
  process.env.SHOP_ROLE_SECRET || 'shopx-role-secret-2026-change-me'
);
const COOKIE_NAME = 'shopx-role-token';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ role: null, permissions: null });

    const { payload } = await jwtVerify(token, ROLE_SECRET);
    const role = payload.role as 'OWNER' | 'EMPLOYEE' | null;

    if (role === 'OWNER') {
      return NextResponse.json({
        role: 'OWNER',
        userId: payload.userId,
        empName: payload.empName,
        empId: null,
        permissions: OWNER_PERMISSIONS,
      });
    }

    if (role === 'EMPLOYEE' && payload.empId && payload.userId) {
      await dbConnect();
      const emp = await ShopEmployee.findOne({
        $or: [{ shopId: String(payload.userId) }, { userId: String(payload.userId) }],
        employeeId: String(payload.empId),
      }).lean() as any;

      if (!emp || !emp.isActive) {
        const res = NextResponse.json({ role: null, permissions: null });
        res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
        return res;
      }

      const livePerms = normalizePermissions(emp.permissions);
      const tokenPerms = normalizePermissions(payload.permissions as Record<string, unknown> | undefined);
      const permsChanged = JSON.stringify(livePerms) !== JSON.stringify(tokenPerms);

      const res = NextResponse.json({
        role: 'EMPLOYEE',
        userId: payload.userId,
        empName: emp.name || payload.empName,
        empId: emp.employeeId,
        permissions: livePerms,
      });

      if (permsChanged) {
        const refreshedToken = await new SignJWT({
          userId: payload.userId,
          role: 'EMPLOYEE',
          empName: emp.name || payload.empName,
          empId: emp.employeeId,
          permissions: livePerms,
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime('8h')
          .sign(ROLE_SECRET);

        res.cookies.set(COOKIE_NAME, refreshedToken, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 8 * 60 * 60,
          secure: process.env.NODE_ENV === 'production',
        });
      }

      return res;
    }

    return NextResponse.json({ role: null, permissions: null });
  } catch {
    return NextResponse.json({ role: null, permissions: null });
  }
}
