"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ShieldAlert, ArrowLeft, Crown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useShopRole } from "@/hooks/useShopRole"
import { getDefaultEmployeeRoute } from "../../../lib/permissions"

export default function UnauthorizedPage() {
  const router = useRouter()
  const { permissions, lockShop } = useShopRole()
  const fallbackRoute = getDefaultEmployeeRoute(permissions)

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-none bg-card shadow-2xl text-center">
        <CardHeader className="space-y-3 pt-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-destructive/15 text-destructive flex items-center justify-center">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <CardTitle className="text-2xl font-headline font-bold">
            Unauthorized Access
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            This section is restricted to the <strong>Shop Owner</strong>. Employees do not have permission to view analytics, accounting, or management settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3 pb-8 pt-2 justify-center">
          <Button
            onClick={() => router.push(fallbackRoute)}
            className="gap-2 rounded-xl font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            Go to Allowed Page
          </Button>
          <Button
            variant="outline"
            onClick={lockShop}
            className="gap-2 rounded-xl font-bold"
          >
            <Crown className="w-4 h-4" />
            Switch to Owner
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
