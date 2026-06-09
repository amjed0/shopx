
"use client"

import * as React from "react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { Bell, Search, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useUser } from "@/firebase"
import { useRouter } from "next/navigation"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useUser()
  const router = useRouter()

  React.useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return null
  }
 
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background font-body">
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b bg-background/80 backdrop-blur-md px-6">
            <div className="flex flex-1 items-center gap-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <div className="relative w-full max-w-sm hidden md:flex items-center">
                <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search products, invoices, customers..." 
                  className="pl-9 bg-muted/40 border-none focus-visible:ring-1 focus-visible:ring-primary h-9 rounded-full"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                <Bell className="h-5 w-5" />
                <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-accent animate-pulse" />
              </Button>
              <div className="h-8 w-[1px] bg-border mx-2" />
              <Button
                          onClick={() => router.push("/sales/new")}
                          className="bg-primary text-primary-foreground font-semibold px-6 rounded-full shadow-lg shadow-primary/20"
                        >
                          New Bill
                        </Button>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-6 lg:p-10 max-w-7xl mx-auto w-full">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}