import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { jwtVerify } from "jose"
import {
  EmployeePermissions,
  canAccessPath,
  requiredPermissionForApi,
  normalizePermissions,
  getDefaultEmployeeRoute,
} from "../lib/permissions"

const ROLE_SECRET = new TextEncoder().encode(
  process.env.SHOP_ROLE_SECRET || "shopx-role-secret-2026-change-me"
)
const ROLE_COOKIE = "shopx-role-token"

interface VerifiedRole {
  role: "OWNER" | "EMPLOYEE"
  permissions: EmployeePermissions
}

async function verifyRoleCookie(
  req: NextRequest,
  expectedUserId: string
): Promise<VerifiedRole | null> {
  const raw = req.cookies.get(ROLE_COOKIE)?.value
  if (!raw) return null
  try {
    const { payload } = await jwtVerify(raw, ROLE_SECRET)
    if (payload.userId !== expectedUserId) return null
    if (payload.role === "OWNER" || payload.role === "EMPLOYEE") {
      return {
        role: payload.role,
        permissions: normalizePermissions(
          payload.permissions as Record<string, unknown> | undefined
        ),
      }
    }
    return null
  } catch {
    return null
  }
}

export async function middleware(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET || "shopxsupersecretkey2026"
  const token = await getToken({ req, secret })
  const { pathname } = req.nextUrl

  const isApi = pathname.startsWith("/api/")

  // 1. Unauthenticated users
  if (!token) {
    if (pathname === "/login" || pathname === "/signup") {
      return NextResponse.next()
    }
    if (isApi) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const userId = String(token.id || token.sub || "")
  const roleData = await verifyRoleCookie(req, userId)
  const role = roleData?.role ?? null
  const permissions = roleData?.permissions

  // 2. API protection (Stage 2 RBAC)
  if (isApi) {
    if (pathname.startsWith("/api/shop-role") || pathname.startsWith("/api/auth")) {
      return NextResponse.next()
    }

    const reqPerm = requiredPermissionForApi(pathname, req.method)
    if (reqPerm === "OWNER_ONLY") {
      if (role !== "OWNER") {
        return NextResponse.json(
          { error: "Unauthorized Access: Owner permission required." },
          { status: 403 }
        )
      }
    } else if (reqPerm) {
      // Note: For EMPLOYEE, individual API route handlers also verify live DB permissions
      // via requirePermission(req, reqPerm) so updates take effect immediately.
      if (!role) {
        return NextResponse.json(
          { error: "Unauthorized Access: Please select a shop role." },
          { status: 403 }
        )
      }
    }

    return NextResponse.next()
  }

  // 3. Auth & root pages when already logged into Stage 1
  if (pathname === "/login" || pathname === "/signup" || pathname === "/") {
    if (role === "OWNER") {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
    if (role === "EMPLOYEE") {
      return NextResponse.redirect(new URL(getDefaultEmployeeRoute(permissions), req.url))
    }
    return NextResponse.redirect(new URL("/shop-login", req.url))
  }

  // 4. Stage 2 login & unauthorized pages
  if (pathname === "/shop-login" || pathname === "/unauthorized") {
    return NextResponse.next()
  }

  // 5. Require Stage 2 role selection for all dashboard routes
  if (!role) {
    return NextResponse.redirect(new URL("/shop-login", req.url))
  }

  // 6. Enforce per-employee page permissions (note: layout also checks live DB permissions)
  // Allow middleware to pass if token has permission, or let layout/API enforce live state
  if (role === "EMPLOYEE" && !canAccessPath(role, permissions, pathname)) {
    return NextResponse.redirect(new URL("/unauthorized", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/signup",
    "/shop-login",
    "/unauthorized",
    "/dashboard/:path*",
    "/analytics/:path*",
    "/sales/:path*",
    "/inventory/:path*",
    "/accounting/:path*",
    "/purchases/:path*",
    "/reports/:path*",
    "/customers/:path*",
    "/settings/:path*",
    "/profile/:path*",
    "/managment/:path*",
    "/api/analytics/:path*",
    "/api/balance-sheet/:path*",
    "/api/pl-statement/:path*",
    "/api/capital/:path*",
    "/api/cashbook/:path*",
    "/api/expenses/:path*",
    "/api/employees/:path*",
    "/api/supplier-payments/:path*",
    "/api/shop_profiles/:path*",
  ],
}
