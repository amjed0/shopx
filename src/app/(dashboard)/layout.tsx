"use client"

import * as React from "react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { Bell, Search, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <SidebarProvider>
      {/* ── ROOT WRAPPER: full height, no overflow bleed ── */}
      <div className="flex min-h-screen w-full overflow-hidden bg-background font-body">
        <AppSidebar />

        <SidebarInset className="flex flex-col min-w-0 flex-1">

          {/* ── HEADER ── */}
          <header className="sticky top-0 z-30 flex h-14 md:h-16 shrink-0 items-center gap-2 border-b bg-background/80 backdrop-blur-md px-3 md:px-6">

            <div className="flex flex-1 items-center gap-2 md:gap-4 min-w-0">
              {/* Sidebar toggle — always visible */}
              <SidebarTrigger className="-ml-1 shrink-0" />
              <Separator orientation="vertical" className="h-4 shrink-0" />

              {/* Search — hidden on mobile, shown from md up */}
              <div className="relative hidden md:flex items-center w-full max-w-sm">
                <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search products, invoices, customers..."
                  className="pl-9 bg-muted/40 border-none focus-visible:ring-1 focus-visible:ring-primary h-9 rounded-full"
                />
              </div>
            </div>

            <div className="flex items-center gap-1 md:gap-3 shrink-0">
              {/* Mobile search icon — tappable on small screens */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden text-muted-foreground hover:text-foreground"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </Button>

              {/* Bell notification */}
              <Button
                variant="ghost"
                size="icon"
                className="relative text-muted-foreground hover:text-foreground"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-accent animate-pulse" />
              </Button>

              <div className="hidden md:block h-8 w-[1px] bg-border mx-1" />

              {/* New Bill — shortened label on mobile */}
              <Button
                onClick={() => router.push("/sales/new")}
                className="bg-primary text-primary-foreground font-semibold px-3 md:px-6 rounded-full shadow-lg shadow-primary/20 text-xs md:text-sm h-8 md:h-9"
              >
                <span className="md:hidden">+ Bill</span>
                <span className="hidden md:inline">New Bill</span>
              </Button>
            </div>
          </header>

          {/* ── MAIN CONTENT ── */}
          {/* 
            - p-4 on mobile, p-6 on md, p-10 on lg
            - max-w-7xl keeps wide-screen content from stretching too far
            - overflow-y-auto so the main area scrolls, not the body
          */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 w-full max-w-7xl mx-auto">
            {children}
          </main>

        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}