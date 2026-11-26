/**
 * /api/employees
 * GET  – list employees for the shop (owner only)
 * POST – create a new employee   (owner only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import dbConnect from '../../../../lib/mongodb';
import ShopEmployee from '../../../../models/ShopEmployee';
import { requireOwner } from '../../../../lib/rbac';
import { normalizePermissions } from '../../../../lib/permissions';

export async function GET(req: NextRequest) {
  const authErr = await requireOwner(req);
  if (authErr) return authErr;

  const session = await getServerSession(authOptions);
  const userId = session!.user!.id;
  await dbConnect();

  const employees = await ShopEmployee.find({ userId }, '-pin').lean();
  return NextResponse.json(employees);
}

export async function POST(req: NextRequest) {
  const authErr = await requireOwner(req);
  if (authErr) return authErr;

  const session = await getServerSession(authOptions);
  const userId = session!.user!.id;
  await dbConnect();

  const body = await req.json();
  const { name, employeeId, pin, phone, permissions } = body as {
    name: string;
    employeeId: string;
    pin: string;
    phone?: string;
    permissions?: Record<string, unknown>;
  };

  if (!name || !employeeId || !pin) {
    return NextResponse.json({ error: 'name, employeeId and pin are required' }, { status: 400 });
  }
  if (pin.length < 4) {
    return NextResponse.json({ error: 'PIN must be at least 4 characters' }, { status: 400 });
  }

  try {
    const emp = new ShopEmployee({
      userId,
      shopId: userId,
      employeeId: employeeId.trim().toUpperCase(),
      name: name.trim(),
      pin,
      phone: phone?.trim(),
      permissions: normalizePermissions(permissions),
    });
    await emp.save();
    const obj = emp.toObject() as any;
    delete obj.pin;
    return NextResponse.json(obj, { status: 201 });
  } catch (err: any) {
    if (err.code === 11000) {
      return NextResponse.json({ error: 'Employee ID already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
