"use client"

import * as React from "react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { Bell, Search, Loader2, X } from "lucide-react"
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
  const [mobileSearchOpen, setMobileSearchOpen] = React.useState(false)

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

  if (!session) return null

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background font-body w-full">
        <AppSidebar />

        <SidebarInset className="flex flex-col flex-1 min-w-0">

          {/* ── HEADER ── */}
          <header className="sticky top-0 z-30 flex h-14 md:h-16 shrink-0 items-center gap-2 border-b bg-background/80 backdrop-blur-md px-3 md:px-6">

            {/* Mobile search overlay — replaces entire header when open */}
            {mobileSearchOpen ? (
              <div className="flex flex-1 items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    autoFocus
                    placeholder="Search products, invoices, customers..."
                    className="pl-9 bg-muted/40 border-none focus-visible:ring-1 focus-visible:ring-primary h-9 rounded-full w-full"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setMobileSearchOpen(false)}
                  aria-label="Close search"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                {/* Left side */}
                <div className="flex flex-1 items-center gap-2 md:gap-4 min-w-0">
                  <SidebarTrigger className="-ml-1 shrink-0" />
                  <Separator orientation="vertical" className="h-4 shrink-0 hidden md:block" />

                  {/* Desktop search */}
                  <div className="relative w-full max-w-sm hidden md:flex items-center">
                    <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search products, invoices, customers..."
                      className="pl-9 bg-muted/40 border-none focus-visible:ring-1 focus-visible:ring-primary h-9 rounded-full"
                    />
                  </div>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-1 md:gap-2 shrink-0">
                  {/* Mobile search trigger */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden text-muted-foreground hover:text-foreground"
                    onClick={() => setMobileSearchOpen(true)}
                    aria-label="Open search"
                  >
                    <Search className="h-5 w-5" />
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

                  {/* New Bill */}
                  <Button
                    onClick={() => router.push("/sales/new")}
                    className="bg-primary text-primary-foreground font-semibold px-3 md:px-6 rounded-full shadow-lg shadow-primary/20 text-xs md:text-sm h-8 md:h-9"
                  >
                    <span className="hidden sm:inline">New Bill</span>
                    <span className="sm:hidden">+ Bill</span>
                  </Button>
                </div>
              </>
            )}
          </header>

          {/* ── MAIN CONTENT ── */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 w-full max-w-7xl mx-auto">
            {children}
          </main>

        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}