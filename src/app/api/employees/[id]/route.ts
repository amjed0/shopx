/**
 * /api/employees/[id]
 * PATCH – update employee (name, phone, pin, isActive) – owner only
 * DELETE – remove employee – owner only
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import dbConnect from '../../../../../lib/mongodb';
import ShopEmployee from '../../../../../models/ShopEmployee';
import { requireOwner } from '../../../../../lib/rbac';
import { normalizePermissions } from '../../../../../lib/permissions';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authErr = await requireOwner(req);
  if (authErr) return authErr;

  const session = await getServerSession(authOptions);
  const userId = session!.user!.id;
  await dbConnect();

  const body = await req.json();
  const emp = await ShopEmployee.findOne({ _id: params.id, userId });
  if (!emp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (body.name  !== undefined) emp.name     = body.name;
  if (body.phone !== undefined) emp.phone    = body.phone;
  if (body.isActive !== undefined) emp.isActive = body.isActive;
  if (body.permissions !== undefined) {
    emp.permissions = normalizePermissions({
      ...(emp.permissions ? JSON.parse(JSON.stringify(emp.permissions)) : {}),
      ...body.permissions,
    });
  }
  if (body.pin   !== undefined) {
    if (body.pin.length < 4) return NextResponse.json({ error: 'PIN too short' }, { status: 400 });
    emp.pin = body.pin; // pre-save hook hashes it
  }

  await emp.save();
  const obj = emp.toObject() as any;
  delete obj.pin;
  return NextResponse.json(obj);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const authErr = await requireOwner(req);
  if (authErr) return authErr;

  const session = await getServerSession(authOptions);
  const userId = session!.user!.id;
  await dbConnect();

  await ShopEmployee.deleteOne({ _id: params.id, userId });
  return NextResponse.json({ ok: true });
}
