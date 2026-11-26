"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutGrid,
  ArrowDownUp,
  Plus,
  Truck,
  PieChart,
  Box,
  History,
} from "lucide-react"
import { useShopRole } from "@/hooks/useShopRole"

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  isCenter?: boolean
  matchPrefix?: string
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutGrid,
    matchPrefix: "/dashboard",
  },
  {
    label: "Cash Book",
    href: "/accounting/cashbook",
    icon: ArrowDownUp,
    matchPrefix: "/accounting/cashbook",
  },
  {
    label: "New Bill",
    href: "/sales/new",
    icon: Plus,
    isCenter: true,
    matchPrefix: "/sales/new",
  },
  {
    label: "Purchases",
    href: "/purchases/purchase-entry",
    icon: Truck,
    matchPrefix: "/purchases",
  },
  {
    label: "Analysis",
    href: "/analytics",
    icon: PieChart,
    matchPrefix: "/analytics",
  },
]

const employeeNavItems: NavItem[] = [
  {
    label: "Products",
    href: "/inventory",
    icon: Box,
    matchPrefix: "/inventory",
  },
  {
    label: "Sales",
    href: "/sales/sales-history",
    icon: History,
    matchPrefix: "/sales/sales-history",
  },
  {
    label: "New Bill",
    href: "/sales/new",
    icon: Plus,
    isCenter: true,
    matchPrefix: "/sales/new",
  },
  {
    label: "Purchases",
    href: "/purchases/purchase-entry",
    icon: Truck,
    matchPrefix: "/purchases",
  },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const { role, hasPermission } = useShopRole()

  const activeItems = React.useMemo(() => {
    if (role === "OWNER") return navItems

    const dynamic: NavItem[] = []
    if (hasPermission("dashboard")) {
      dynamic.push({ label: "Dashboard", href: "/dashboard", icon: LayoutGrid, matchPrefix: "/dashboard" })
    } else if (hasPermission("productView") || hasPermission("inventoryManagement")) {
      dynamic.push({ label: "Products", href: "/inventory", icon: Box, matchPrefix: "/inventory" })
    }
    if (hasPermission("accounting")) {
      dynamic.push({ label: "Cash Book", href: "/accounting/cashbook", icon: ArrowDownUp, matchPrefix: "/accounting/cashbook" })
    } else if (hasPermission("salesEntry")) {
      dynamic.push({ label: "Sales", href: "/sales/sales-history", icon: History, matchPrefix: "/sales/sales-history" })
    }
    if (hasPermission("billing")) {
      dynamic.push({ label: "New Bill", href: "/sales/new", icon: Plus, isCenter: true, matchPrefix: "/sales/new" })
    }
    if (hasPermission("purchaseEntry")) {
      dynamic.push({ label: "Purchases", href: "/purchases/purchase-entry", icon: Truck, matchPrefix: "/purchases" })
    }
    if (hasPermission("balanceSheet")) {
      dynamic.push({ label: "Balance", href: "/accounting/balance-sheet", icon: PieChart, matchPrefix: "/accounting/balance-sheet" })
    }
    return dynamic.length > 0 ? dynamic : employeeNavItems
  }, [role, hasPermission])

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 select-none"
    >
      {/* Background with glassmorphism & soft border */}
      <div className="relative bg-[#0b0f19]/95 backdrop-blur-xl border-t border-slate-800/90 px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-10px_30px_rgba(0,0,0,0.55)]">
        
        {/* Glow backdrop behind the center button */}
        <div className="absolute left-1/2 -top-6 -translate-x-1/2 w-24 h-12 bg-teal-500/25 blur-xl pointer-events-none rounded-full" />

        <div className="flex items-end justify-around max-w-md mx-auto relative">
          {activeItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.matchPrefix === "/dashboard"
                ? pathname === "/dashboard"
                : pathname?.startsWith(item.matchPrefix || item.href)

            if (item.isCenter) {
              return (
                <div key={item.href} className="relative flex flex-col items-center -top-4">
                  <Link
                    href={item.href}
                    className="group relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-400 via-teal-400 to-cyan-400 text-white shadow-[0_6px_22px_rgba(20,184,166,0.6)] border-[3.5px] border-[#0c101b] active:scale-90 transition-all duration-200"
                    aria-label="Create New Bill"
                  >
                    <Icon className="w-7 h-7 stroke-[3] text-white transition-transform duration-200 group-hover:rotate-90 drop-shadow-sm" />
                  </Link>
                  <span
                    className={`mt-0.5 text-[10px] font-medium tracking-tight transition-colors ${
                      isActive ? "text-cyan-400 font-bold" : "text-slate-400"
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center py-1 px-1.5 min-w-[58px] active:scale-95 transition-all duration-150"
              >
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 ${
                    isActive
                      ? "text-cyan-400 bg-cyan-500/15 shadow-[0_0_12px_rgba(34,211,238,0.25)]"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 transition-transform duration-200 ${
                      isActive ? "scale-105 stroke-[2.2]" : "stroke-[1.8]"
                    }`}
                  />
                </div>
                <span
                  className={`mt-1 text-[11px] font-medium tracking-tight transition-colors ${
                    isActive
                      ? "text-cyan-400 font-semibold"
                      : "text-slate-400 hover:text-slate-300"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
