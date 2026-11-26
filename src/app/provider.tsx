"use client"

import * as React from "react"
import { SessionProvider } from "next-auth/react"
import { ShopRoleProvider } from "@/hooks/useShopRole"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ShopRoleProvider>{children}</ShopRoleProvider>
    </SessionProvider>
  )
}
