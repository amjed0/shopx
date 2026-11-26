"use client"

import * as React from "react"
import {
  LayoutDashboard,
  Box,
  ShoppingCart,
  Truck,
  Users,
  Calculator,
  BarChart3,
  ChevronRight,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  ArrowLeftRight,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarGroup,
  useSidebar,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import * as VisuallyHidden from "@radix-ui/react-visually-hidden"
import { useSession, signOut } from "next-auth/react"
import { useShop } from "@/hooks/useShop"
import { useShopRole } from "@/hooks/useShopRole"
import { PermissionKey } from "../../../lib/permissions"

interface NavSubItem {
  title: string
  url: string
  permission?: PermissionKey
  ownerOnly?: boolean
}

interface NavItem {
  title: string
  icon: React.ElementType
  url: string
  permission?: PermissionKey
  anyPermission?: PermissionKey[]
  ownerOnly?: boolean
  items?: NavSubItem[]
}

const navigation: NavItem[] = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    url: "/dashboard",
    permission: "dashboard",
  },
  {
    title: "Inventory",
    icon: Box,
    url: "/inventory",
    anyPermission: ["productView", "inventoryManagement"],
    items: [
      { title: "Products", url: "/inventory", permission: "productView" },
      { title: "Stock Alerts", url: "/inventory/stock-alert", permission: "inventoryManagement" },
      { title: "Stock History", url: "/inventory/stock-history", permission: "inventoryManagement" },
    ],
  },
  {
    title: "Sales",
    icon: ShoppingCart,
    url: "/sales",
    anyPermission: ["billing", "salesEntry"],
    items: [
      { title: "New Bill", url: "/sales/new", permission: "billing" },
      { title: "Sales History", url: "/sales/sales-history", permission: "salesEntry" },
      { title: "Returns", url: "/sales/sales-return", permission: "salesEntry" },
    ],
  },
  {
    title: "Purchases",
    icon: Truck,
    url: "/purchases",
    anyPermission: ["purchaseEntry", "management"],
    items: [
      { title: "Suppliers", url: "/purchases/suppliers", permission: "management" },
      { title: "Purchase Entry", url: "/purchases/purchase-entry", permission: "purchaseEntry" },
      { title: "History", url: "/purchases/purchase-history", permission: "purchaseEntry" },
    ],
  },
  {
    title: "Management",
    icon: Users,
    url: "/managment",
    anyPermission: ["management"],
    items: [
      { title: "Customers", url: "/managment/customers", permission: "management" },
      { title: "Credit Tracking", url: "/managment/credit-tracking", permission: "management" },
      { title: "Employees", url: "/managment/employees", ownerOnly: true },
    ],
  },
  {
    title: "Accounting",
    icon: Calculator,
    url: "/accounting",
    anyPermission: ["accounting", "balanceSheet"],
    items: [
      { title: "Cash Book", url: "/accounting/cashbook", permission: "accounting" },
      { title: "Capital Account", url: "/accounting/capital", permission: "accounting" },
      { title: "P&L Statement", url: "/accounting/pl-statement", permission: "accounting" },
      { title: "Balance Sheet", url: "/accounting/balance-sheet", permission: "balanceSheet" },
      { title: "GST Reports", url: "/accounting/gst-reports", permission: "accounting" },
    ],
  },
  {
    title: "Analytics",
    icon: BarChart3,
    url: "/analytics",
    permission: "dashboard",
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { state, setOpenMobile, isMobile } = useSidebar()
  const { data: session, status } = useSession()
  const { role, empName, empId, hasPermission, lockShop } = useShopRole()

  const userId = session?.user?.id ?? null
  const { data: shopData, loading: shopLoading, isVehicleDealer } = useShop(userId)

  const isLoading = status === "loading" || shopLoading

  const visibleNavigation = React.useMemo(() => {
    if (role === "OWNER") return navigation

    const isSubAllowed = (sub: NavSubItem) => {
      if (sub.ownerOnly) return false
      if (!sub.permission) return true
      // inventoryManagement also grants productView
      if (sub.permission === "productView" && hasPermission("inventoryManagement")) return true
      return hasPermission(sub.permission)
    }

    return navigation
      .map((item) => {
        if (item.ownerOnly) return null
        if (item.permission && !hasPermission(item.permission)) return null
        if (item.anyPermission && !item.anyPermission.some((p) => hasPermission(p))) return null
        if (item.items) {
          const filteredSubs = item.items.filter(isSubAllowed)
          if (filteredSubs.length === 0) return null
          return { ...item, items: filteredSubs }
        }
        return item
      })
      .filter((x): x is NavItem => x !== null)
  }, [role, hasPermission])

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await fetch("/api/shop-role/logout", { method: "POST", credentials: "include" }).catch(() => {})
      await signOut({ redirect: false })
      router.push("/login")
    } catch (error) {
      console.error("Logout failed", error)
    }
  }

  // Close mobile sidebar when navigating
  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="h-14 md:h-16 flex items-center px-4 justify-between">
        <VisuallyHidden.Root>
          <span>Navigation Sidebar</span>
        </VisuallyHidden.Root>
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg shrink-0">
            <ShieldCheck className="w-5 h-5 text-primary-foreground" />
          </div>
          {state !== "collapsed" && (
            <span className="font-headline font-bold text-xl tracking-tight text-foreground">
              Shop<span className="text-primary">X</span>
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {visibleNavigation.map((item) => (
              <Collapsible
                key={item.title}
                asChild
                defaultOpen={pathname.startsWith(item.url)}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  {item.items ? (
                    <>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip={item.title} className="touch-manipulation">
                          <item.icon className="w-4 h-4 shrink-0" />
                          <span>{item.title}</span>
                          <ChevronRight className="ml-auto w-4 h-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={pathname === subItem.url}
                                className="touch-manipulation"
                              >
                                <Link href={subItem.url} onClick={handleNavClick}>
                                  {subItem.title}
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </>
                  ) : (
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.url}
                      tooltip={item.title}
                      className="touch-manipulation"
                    >
                      <Link href={item.url} onClick={handleNavClick}>
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              </Collapsible>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 md:p-4">
        <div className="flex flex-col gap-3 md:gap-4">
          <div
            role="button"
            onClick={() => { router.push("/profile"); handleNavClick() }}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-sidebar-accent transition-colors cursor-pointer group touch-manipulation"
          >
            <Avatar className="h-9 w-9 rounded-lg border-2 border-primary/20 group-hover:border-primary/50 transition-colors shrink-0">
              <AvatarImage src={`https://picsum.photos/seed/${userId || "shopx"}/40/40`} />
              <AvatarFallback className="rounded-lg bg-primary text-primary-foreground font-bold">
                {session?.user?.email?.charAt(0).toUpperCase() || "SX"}
              </AvatarFallback>
            </Avatar>

            {state !== "collapsed" && (
              <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                {isLoading ? (
                  <>
                    <span className="h-3 w-24 rounded bg-muted-foreground/20 animate-pulse mb-1" />
                    <span className="h-2 w-16 rounded bg-muted-foreground/10 animate-pulse" />
                  </>
                ) : (
                  <>
                    <span className="truncate font-bold text-foreground">
                      {role === "EMPLOYEE"
                        ? empName || "Employee"
                        : shopData?.ownerName || ""}
                    </span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        {role === "EMPLOYEE"
                          ? `${empId || "STAFF"} · ${shopData?.companyName || ""}`
                          : shopData?.companyName || ""}
                      </span>
                      {isVehicleDealer && (
                        <span className="text-[9px] px-1 py-0 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold shrink-0">
                          Dealer
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {state !== "collapsed" && (
              <UserIcon className="h-4 w-4 text-muted-foreground opacity-50 shrink-0" />
            )}
          </div>

          {state !== "collapsed" ? (
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-3 font-bold transition-all rounded-xl touch-manipulation"
                onClick={() => { lockShop(); handleNavClick() }}
              >
                <ArrowLeftRight className="h-4 w-4 shrink-0" />
                <span>Switch Role / Lock</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="w-full justify-start gap-3 bg-secondary/50 text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-bold transition-all rounded-xl touch-manipulation"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Exit Terminal</span>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="w-full h-9 text-muted-foreground hover:text-foreground rounded-xl touch-manipulation"
                onClick={() => { lockShop(); handleNavClick() }}
                title="Switch Role / Lock Shop"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-full h-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl touch-manipulation"
                onClick={handleLogout}
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}