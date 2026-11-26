/**
 * RBAC helpers for Next.js Route Handlers
 *
 * Usage in an API route:
 *   const authErr = await requirePermission(req, 'balanceSheet');
 *   if (authErr) return authErr;
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { jwtVerify } from 'jose';
import dbConnect from './mongodb';
import ShopEmployee from '../models/ShopEmployee';
import {
  PermissionKey,
  EmployeePermissions,
  normalizePermissions,
} from './permissions';

const ROLE_SECRET = new TextEncoder().encode(
  process.env.SHOP_ROLE_SECRET || 'shopx-role-secret-2026-change-me'
);
const COOKIE_NAME = 'shopx-role-token';

export type ShopRole = 'OWNER' | 'EMPLOYEE' | null;

export interface RoleTokenPayload {
  role: ShopRole;
  userId?: string;
  empName?: string;
  empId?: string;
  permissions?: EmployeePermissions;
}

/** Decode the shop-role JWT from the cookie (returns null if missing / invalid) */
export async function getShopRolePayload(req: NextRequest): Promise<RoleTokenPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, ROLE_SECRET);
    return {
      role: (payload.role as ShopRole) ?? null,
      userId: payload.userId as string | undefined,
      empName: payload.empName as string | undefined,
      empId: payload.empId as string | undefined,
      permissions: payload.permissions
        ? normalizePermissions(payload.permissions as Record<string, unknown>)
        : undefined,
    };
  } catch {
    return null;
  }
}

export async function getShopRole(req: NextRequest): Promise<ShopRole> {
  const payload = await getShopRolePayload(req);
  return payload?.role ?? null;
}

/** Returns a 401/403 NextResponse if the caller is NOT an authenticated OWNER, otherwise null */
export async function requireOwner(req: NextRequest): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const payload = await getShopRolePayload(req);
  if (!payload || payload.role !== 'OWNER' || payload.userId !== session.user.id) {
    return NextResponse.json(
      { error: 'Owner access required. Please log in as Owner.' },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Checks if caller is OWNER or an active EMPLOYEE with the given permission enabled in DB.
 * Reads live permissions from MongoDB for employees so Owner updates take effect immediately.
 */
export async function requirePermission(
  req: NextRequest,
  permission: PermissionKey
): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const payload = await getShopRolePayload(req);
  if (!payload || !payload.role || payload.userId !== session.user.id) {
    return NextResponse.json(
      { error: 'Shop role required. Please select Owner or Employee login.' },
      { status: 403 }
    );
  }

  if (payload.role === 'OWNER') {
    return null;
  }

  // Employee: verify live permissions in MongoDB
  if (!payload.empId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await dbConnect();
  const emp = await ShopEmployee.findOne({
    $or: [{ shopId: session.user.id }, { userId: session.user.id }],
    employeeId: payload.empId,
    isActive: true,
  }).lean() as any;

  if (!emp) {
    return NextResponse.json(
      { error: 'Employee account is disabled or removed.' },
      { status: 403 }
    );
  }

  const perms = normalizePermissions(emp.permissions);
  if (!perms[permission]) {
    return NextResponse.json(
      { error: `Unauthorized Access: "${permission}" permission is required.` },
      { status: 403 }
    );
  }

  return null;
}

/** Returns a 401/403 NextResponse if the caller is NOT authenticated with ANY shop role */
export async function requireShopRole(req: NextRequest): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const payload = await getShopRolePayload(req);
  if (!payload || !payload.role || payload.userId !== session.user.id) {
    return NextResponse.json(
      { error: 'Shop role required. Please select Owner or Employee login.' },
      { status: 403 }
    );
  }
  return null;
}
