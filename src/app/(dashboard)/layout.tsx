"use client"

import * as React from "react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { Bell, Loader2, User, LogOut, ArrowLeftRight, Crown, UserCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSession, signOut } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { useShopRole } from "@/hooks/useShopRole"
import { canAccessPath } from "../../../lib/permissions"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const { role, empName, empId, permissions, hasPermission, loading: roleLoading, lockShop } = useShopRole()
  const router = useRouter()
  const pathname = usePathname()

  // Hooks must run before any early return
  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  React.useEffect(() => {
    if (status === "authenticated" && !roleLoading && !role) {
      router.replace("/shop-login")
    }
  }, [status, roleLoading, role, router])

  React.useEffect(() => {
    if (role === "EMPLOYEE" && !roleLoading && !canAccessPath(role, permissions, pathname)) {
      router.replace("/unauthorized")
    }
  }, [role, roleLoading, permissions, pathname, router])

  // Immediate synchronous redirect if launched from phone shortcut saved on /purchases/suppliers
  if (typeof window !== "undefined") {
    const isLaunchedFresh = !sessionStorage.getItem("shopx_session_started")
    if (isLaunchedFresh && window.location.pathname === "/purchases/suppliers") {
      sessionStorage.setItem("shopx_session_started", "true")
      window.location.replace("/dashboard")
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )
    }
  }

  if (status === "loading" || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!session || !role) return null

  const userName = session.user?.name ?? "User"
  const userEmail = session.user?.email ?? ""

  const handleLogout = async () => {
    sessionStorage.removeItem("shopx_session_started")
    await fetch("/api/shop-role/logout", { method: "POST", credentials: "include" }).catch(() => {})
    signOut({ callbackUrl: "/login" })
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background font-body w-full">
        <AppSidebar />

        <SidebarInset className="flex flex-col flex-1 min-w-0">

          {/* ── HEADER ── */}
          <header className="sticky top-0 z-30 flex h-14 md:h-16 shrink-0 items-center gap-2 border-b bg-background/80 backdrop-blur-md px-3 md:px-6">

            {/* Left side */}
            <div className="flex flex-1 items-center gap-2 md:gap-4 min-w-0">
              <SidebarTrigger className="-ml-1 shrink-0" />
              <Separator orientation="vertical" className="h-4 shrink-0 hidden md:block" />
            </div>

            {/* Right side */}
            <div className="flex items-center gap-1 md:gap-2 shrink-0">
              {/* Role Badge & Switch Role */}
              <Badge
                variant="outline"
                className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold border ${
                  role === "OWNER"
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                }`}
              >
                {role === "OWNER" ? (
                  <Crown className="w-3 h-3" />
                ) : (
                  <UserCheck className="w-3 h-3" />
                )}
                {role === "OWNER" ? "Owner" : `${empName || "Employee"}${empId ? ` (${empId})` : ""}`}
              </Badge>

              <Button
                variant="ghost"
                size="sm"
                onClick={lockShop}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground h-8 px-2.5"
                title="Switch Role / Lock Shop"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Switch Role</span>
              </Button>

              {/* Notifications */}
              <Button
                variant="ghost"
                size="icon"
                className="relative text-muted-foreground hover:text-foreground"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-accent animate-pulse" />
              </Button>

              <div className="hidden sm:block h-8 w-[1px] bg-border mx-1" />

              {/* New Bill (Desktop only - mobile uses bottom navigation bar) */}
              {hasPermission("billing") && (
                <Button
                  onClick={() => router.push("/sales/new")}
                  className="hidden md:inline-flex bg-primary text-primary-foreground font-semibold px-4 md:px-6 rounded-full shadow-lg shadow-primary/20 text-xs md:text-sm h-8 md:h-9"
                >
                  New Bill
                </Button>
              )}

              {/* ── PROFILE MENU ── */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full h-9 w-9 shrink-0 bg-primary/10 text-primary hover:bg-primary/20"
                    aria-label="Open profile menu"
                  >
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <p className="text-sm font-medium leading-none truncate">{userName}</p>
                    {userEmail && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{userEmail}</p>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => router.push("/profile")}
                    className="cursor-pointer"
                  >
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={lockShop}
                    className="cursor-pointer"
                  >
                    <ArrowLeftRight className="mr-2 h-4 w-4" />
                    Switch Role / Lock Shop
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* ── MAIN CONTENT ── */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 lg:p-10 pb-24 md:pb-6 w-full max-w-7xl mx-auto min-w-0">
            {children}
          </main>

          {/* ── MOBILE BOTTOM NAVIGATION ── */}
          <MobileBottomNav />

        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
