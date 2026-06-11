"use client"

import * as React from "react"
import {
  IndianRupee,
  TrendingUp,
  Package,
  AlertTriangle,
  Zap
} from "lucide-react"
import { StatCard } from "@/components/dashboard/stat-card"
import { SalesChart } from "@/components/dashboard/sales-chart"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { useUser } from "@/app/auth/use-user"

export interface Product {
  _id: string
  name: string
  category: string
  purchasePrice: number
  stock: number
  minStock: number
}

export interface Sale {
  _id: string
  date: string
  total: number
  customerName?: string
  paymentMethod: string
}

interface ShopData {
  ownerName?: string
}

function useShop(uid: string | null) {
  const [data, setData] = React.useState<ShopData | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!uid) { setLoading(false); return }
    fetch(`/api/shop_profiles/${uid}`)
      .then((r) => r.ok ? r.json() : null)
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [uid])

  return { data, loading }
}

function useProducts(uid: string | null) {
  const [data, setData] = React.useState<Product[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!uid) { setLoading(false); return }
    fetch("/api/products", {
      headers: { "x-user-id": uid },
      credentials: "include",
    })
      .then((r) => r.ok ? r.json() : [])
      .then((json) => setData(Array.isArray(json) ? json : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [uid])

  return { data, loading }
}

function useSales(uid: string | null) {
  const [data, setData] = React.useState<Sale[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!uid) { setLoading(false); return }
    fetch("/api/sales?sort=date:desc", {
      headers: { "x-user-id": uid },
      credentials: "include",
    })
      .then((r) => r.ok ? r.json() : [])
      .then((json) => setData(Array.isArray(json) ? json : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [uid])

  return { data, loading }
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  const uid = user?.uid ?? null

  const { data: shopData, loading: shopLoading } = useShop(uid)
  const { data: products } = useProducts(uid)
  const { data: allSales } = useSales(uid)

  const recentSales = React.useMemo(() => allSales.slice(0, 5), [allSales])

  const stats = React.useMemo(() => {
    const today = new Date().toISOString().split("T")[0]
    const todaySales = allSales.filter((s) => s.date.startsWith(today))
    const totalToday = todaySales.reduce((acc, s) => acc + s.total, 0)

    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()
    const monthlySalesData = allSales.filter((s) => {
      const d = new Date(s.date)
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear
    })
    const totalMonthly = monthlySalesData.reduce((acc, s) => acc + s.total, 0)

    const stockValue = products.reduce((acc, p) => acc + p.purchasePrice * p.stock, 0)
    const lowStock = products.filter((p) => p.stock <= p.minStock)

    return {
      todaySales: totalToday,
      monthlySales: totalMonthly,
      stockValue,
      lowStockCount: lowStock.length,
      lowStockItems: lowStock.slice(0, 3),
    }
  }, [products, allSales])

  const isLoading = userLoading || shopLoading
  const greetingName = isLoading ? "" : shopData?.ownerName || ""

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Badge className="bg-primary/10 text-primary border-none mb-2 px-3 py-1 text-[10px] tracking-widest uppercase font-bold">
            ShopX Elite Overview
          </Badge>
          <h1 className="text-4xl font-headline font-bold tracking-tight text-foreground">
            Good Morning,{" "}
            {isLoading ? (
              <span className="inline-block h-9 w-40 rounded-lg bg-primary/10 animate-pulse align-middle" />
            ) : (
              <span className="text-primary">{greetingName}</span>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">Here is what is happening with your shop today.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-border hover:bg-muted font-semibold rounded-full"
          >
            Export Report
          </Button>
          <Button
            onClick={() => router.push("/sales/new")}
            className="bg-primary text-primary-foreground font-semibold px-6 rounded-full shadow-lg shadow-primary/20"
          >
            New Bill
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Sales"
          value={`₹${stats.todaySales.toLocaleString()}`}
          icon={IndianRupee}
          trend={{ value: "Live", positive: true }}
          colorClass="bg-primary/10 text-primary"
        />
        <StatCard
          title="Monthly Sales"
          value={`₹${(stats.monthlySales / 1000).toFixed(1)}K`}
          icon={TrendingUp}
          trend={{ value: "Actual", positive: true }}
          colorClass="bg-accent/10 text-accent"
        />
        <StatCard
          title="Stock Value"
          value={`₹${(stats.stockValue / 1000).toFixed(1)}K`}
          icon={Package}
          description="Total inventory on hand"
          colorClass="bg-purple-500/10 text-purple-400"
        />
        <StatCard
          title="Low Stock"
          value={stats.lowStockCount}
          icon={AlertTriangle}
          trend={{ value: "Alert", positive: false }}
          colorClass="bg-orange-500/10 text-orange-400"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <SalesChart />

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-none bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                  <Zap className="w-5 h-5 text-accent" />
                  Fast Moving Items
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {products.slice(0, 3).map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between p-3 rounded-xl bg-secondary/30"
                  >
                    <div>
                      <p className="text-sm font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.category}</p>
                    </div>
                    <Badge variant="outline" className="border-accent/50 text-accent font-code">
                      Stable
                    </Badge>
                  </div>
                ))}
                {products.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No products in inventory.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-none bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  Low Stock Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {stats.lowStockItems.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between p-3 rounded-xl bg-destructive/5"
                  >
                    <div>
                      <p className="text-sm font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">In Stock: {item.stock}</p>
                    </div>
                    <Button
                      onClick={() => router.push("/inventory")}
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[10px] text-destructive hover:bg-destructive/10 uppercase tracking-widest font-bold"
                    >
                      Restock
                    </Button>
                  </div>
                ))}
                {stats.lowStockItems.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    All stock levels are healthy.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="border-none bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="font-headline text-lg">Recent Sales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentSales.map((sale) => (
                <div
                  key={sale._id}
                  className="flex items-center justify-between group cursor-pointer hover:bg-secondary/20 p-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      {sale.customerName?.charAt(0) || "W"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{sale.customerName || "Walk-in"}</p>
                      <p className="text-xs text-muted-foreground">
                        ₹{sale.total.toLocaleString()} •{" "}
                        {new Date(sale.date).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-accent">
                    {sale.paymentMethod.toUpperCase()}
                  </Badge>
                </div>
              ))}
              {recentSales.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No recent transactions.
                </p>
              )}
              <Button
                onClick={() => router.push("/sales")}
                variant="ghost"
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                View All Transactions
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}