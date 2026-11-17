import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET || "shopxsupersecretkey2026"
  const token = await getToken({ req, secret })
  const { pathname } = req.nextUrl

  // 1. If user is already authenticated and visits login or signup, redirect immediately to /dashboard
  if (pathname === "/login" || pathname === "/signup") {
    if (token) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
    return NextResponse.next()
  }

  // 2. If user opens root '/', redirect immediately based on auth state
  if (pathname === "/") {
    if (token) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // 3. Protected dashboard routes: redirect unauthenticated users to /login
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/signup",
    "/dashboard/:path*",
    "/sales/:path*",
    "/inventory/:path*",
    "/accounting/:path*",
    "/purchases/:path*",
    "/reports/:path*",
    "/customers/:path*",
    "/settings/:path*",
    "/profile/:path*",
    "/managment/:path*",
  ],
}

