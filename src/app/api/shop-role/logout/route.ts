/**
 * POST /api/shop-role/logout
 * Clears the shopx-role-token cookie (reverts to no shop-role / locked state)
 */
import { NextResponse } from 'next/server';

const COOKIE_NAME = 'shopx-role-token';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
  return res;
}
