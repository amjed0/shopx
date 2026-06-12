import type { Metadata } from "next"
import Providers from "@/app/provider"
import "./globals.css"

export const metadata: Metadata = {
  title: "ShopX",
  description: "ShopX Elite POS",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}