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
  Receipt
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
  useSidebar
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useUser, signOut, useDoc, doc, getFirestore } from "@/firebase"

const navigation = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    url: "/dashboard",
  },
  {
    title: "Inventory",
    icon: Box,
    url: "/inventory",
    items: [
      { title: "Products", url: "/inventory" },
      { title: "Stock Alerts", url: "/inventory/stock-alert" },
      { title: "Stock History", url: "/inventory/stock-history" },
    ],
  },
  {
    title: "Sales",
    icon: ShoppingCart,
    url: "/sales",
    items: [
      { title: "New Bill", url: "/sales/new" },
      { title: "Sales History", url: "/sales/sales-history" },
      { title: "Returns", url: "/sales/sales-return" },
    ],
  },
  {
    title: "Purchases",
    icon: Truck,
    url: "/purchases",
    items: [
      { title: "Suppliers", url: "/purchases/suppliers" },
      { title: "Purchase Entry", url: "/purchases/purchase-entry" },
      { title: "History", url: "/purchases/purchase-history" },
    ],
  },
  {
    title: "Management",
    icon: Users,
    url: "/customers",
    items: [
      { title: "Customers", url: "management/customers" },
      { title: "Credit Tracking", url: "management/credit-tracking" },
    ],
  },
  {
    title: "Accounting",
    icon: Calculator,
    url: "/accounting",
    items: [
      { title: "Cash Book", url: "/accounting/cashbook" },
      { title: "P&L Statement", url: "/accounting/pl-statement" },
      { title: "Balance Sheet", url: "/accounting/balance-sheet" },
      { title: "GST Reports", url: "/accounting/gst-reports" },
    ],
  },
  {
    title: "Analytics",
    icon: BarChart3,
    url: "/analytics",
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const { state } = useSidebar()
  const db = getFirestore()

  const shopRef = React.useMemo(
    () => (user ? doc(db, "shops", user.uid) : null),
    [db, user]
  )
  const { data: shopData, loading: shopLoading } = useDoc(shopRef)

  // True while either user session or shop profile is still fetching
  const isLoading = userLoading || shopLoading

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await signOut()
      router.push("/login")
    } catch (error) {
      console.error("Logout failed", error)
    }
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="h-16 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
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
            {navigation.map((item) => (
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
                        <SidebarMenuButton tooltip={item.title}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                          <ChevronRight className="ml-auto w-4 h-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton asChild isActive={pathname === subItem.url}>
                                <Link href={subItem.url}>{subItem.title}</Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </>
                  ) : (
                    <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                      <Link href={item.url}>
                        <item.icon className="w-4 h-4" />
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

      <SidebarFooter className="p-4">
        <div className="flex flex-col gap-4">
          <div
            role="button"
            onClick={() => router.push("/profile")}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-sidebar-accent transition-colors cursor-pointer group"
          >
            <Avatar className="h-9 w-9 rounded-lg border-2 border-primary/20 group-hover:border-primary/50 transition-colors">
              <AvatarImage src={`https://picsum.photos/seed/${user?.uid || "shopx"}/40/40`} />
              <AvatarFallback className="rounded-lg bg-primary text-primary-foreground font-bold">
                {user?.email?.charAt(0).toUpperCase() || "SX"}
              </AvatarFallback>
            </Avatar>

            {state !== "collapsed" && (
              <div className="grid flex-1 text-left text-sm leading-tight">
                {isLoading ? (
                  // Skeleton while loading — no flash of "Owner" / "companyName"
                  <>
                    <span className="h-3 w-24 rounded bg-muted-foreground/20 animate-pulse mb-1" />
                    <span className="h-2 w-16 rounded bg-muted-foreground/10 animate-pulse" />
                  </>
                ) : (
                  <>
                    <span className="truncate font-bold text-foreground">
                      {shopData?.ownerName || user?.email?.split("@")[0] || ""}
                    </span>
                    <span className="truncate text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                      {shopData?.companyName || ""}
                    </span>
                  </>
                )}
              </div>
            )}

            {state !== "collapsed" && (
              <UserIcon className="h-4 w-4 text-muted-foreground opacity-50" />
            )}
          </div>

          {state !== "collapsed" ? (
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start gap-3 bg-secondary/50 text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-bold transition-all rounded-xl"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              <span>Exit Terminal</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="w-full h-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}