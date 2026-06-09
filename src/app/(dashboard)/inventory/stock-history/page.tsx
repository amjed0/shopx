"use client"

import * as React from "react"
import {
  ArrowLeft,
  ArrowDownCircle,
  ArrowUpCircle,
  Package,
  Search,
  Loader2,
  TrendingDown,
  History,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useCollection, useFirestore, collection, query } from "@/firebase"

interface SaleItem {
  productId: string
  productName: string
  quantity: number
  price: number
}

interface Sale {
  id: string
  date: string
  customerName: string
  total: number
  status: string
  paymentMethod: string
  items: SaleItem[]
}

interface Product {
  id: string
  name: string
  sku: string
  category: string
  stock: number
  minStock: number
}

interface StockEntry {
  id: string
  date: string
  productId: string
  productName: string
  sku: string
  category: string
  change: number
  reference: string
}

export default function StockHistoryPage() {
  const router = useRouter()
  const firestore = useFirestore()

  const salesQuery = React.useMemo(() => {
    if (!firestore) return null
    return query(collection(firestore, "sales"))
  }, [firestore])

  const productsQuery = React.useMemo(() => {
    if (!firestore) return null
    return query(collection(firestore, "products"))
  }, [firestore])

  const { data: sales = [], loading: salesLoading } = useCollection<Sale>(salesQuery)
  const { data: products = [], loading: productsLoading } = useCollection<Product>(productsQuery)

  const loading = salesLoading || productsLoading
  const [searchQuery, setSearchQuery] = React.useState("")

  // Build product lookup map
  const productMap = React.useMemo(() => {
    const map: Record<string, Product> = {}
    products.forEach(p => { map[p.id] = p })
    return map
  }, [products])

  // Derive stock movements from sales
  const stockEntries = React.useMemo((): StockEntry[] => {
    const entries: StockEntry[] = []
    sales.forEach(sale => {
      if (sale.status === "returned") return
      ;(sale.items || []).forEach(item => {
        entries.push({
          id: `${sale.id}-${item.productId}`,
          date: sale.date,
          productId: item.productId,
          productName: item.productName,
          sku: productMap[item.productId]?.sku || "—",
          category: productMap[item.productId]?.category || "—",
          change: -item.quantity,
          reference: `INV-${sale.id.slice(-6).toUpperCase()}`,
        })
      })
    })
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return entries
  }, [sales, productMap])

  // Search filter
  const filteredEntries = React.useMemo(() => {
    const q = searchQuery.toLowerCase()
    if (!q) return stockEntries
    return stockEntries.filter(
      e =>
        e.productName.toLowerCase().includes(q) ||
        e.sku.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.reference.toLowerCase().includes(q)
    )
  }, [stockEntries, searchQuery])

  // Stats
  const stats = React.useMemo(() => {
    const totalUnitsOut = stockEntries.reduce((acc, e) => acc + Math.abs(e.change), 0)
    const uniqueProducts = new Set(stockEntries.map(e => e.productId)).size
    const todayStr = new Date().toISOString().split("T")[0]
    const todayEntries = stockEntries.filter(e => e.date?.startsWith(todayStr))
    const todayUnits = todayEntries.reduce((acc, e) => acc + Math.abs(e.change), 0)
    return { totalUnitsOut, uniqueProducts, todayUnits, todayCount: todayEntries.length }
  }, [stockEntries])

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-secondary"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-4xl font-headline font-bold text-foreground">
              Stock <span className="text-primary">History</span>
            </h1>
            <p className="text-muted-foreground">All inventory movements from your sales.</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="rounded-full font-bold"
          onClick={() => router.push("/inventory")}
        >
          <Package className="w-4 h-4 mr-2" />
          View Catalog
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-3 rounded-xl">
              <History className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Movements</p>
              <p className="text-2xl font-bold">{stockEntries.length}</p>
            </div>
          </div>
        </Card>
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-destructive/10 p-3 rounded-xl">
              <TrendingDown className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Units Sold</p>
              <p className="text-2xl font-bold">{stats.totalUnitsOut}</p>
            </div>
          </div>
        </Card>
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-accent/10 p-3 rounded-xl">
              <Package className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Products Moved</p>
              <p className="text-2xl font-bold">{stats.uniqueProducts}</p>
            </div>
          </div>
        </Card>
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500/10 p-3 rounded-xl">
              <ArrowDownCircle className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Today's Units</p>
              <p className="text-2xl font-bold">{stats.todayUnits}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
        </div>
      ) : (
        <Card className="border-none bg-card shadow-sm overflow-hidden">
          <CardHeader className="bg-secondary/20 border-b border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="font-headline text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Movement Log
              </CardTitle>
              <CardDescription>Stock changes from all completed sales.</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search product, SKU, reference..."
                className="pl-9 rounded-full bg-secondary/30 border-none h-9 w-64 text-xs"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/10">
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="font-bold uppercase text-[10px] py-4 pl-6">Type</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] py-4">Product</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] py-4">Category</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] py-4">Invoice</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] py-4">Date & Time</TableHead>
                  <TableHead className="text-right font-bold uppercase text-[10px] py-4 pr-6">Units</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map(entry => (
                  <TableRow
                    key={entry.id}
                    className="border-border/20 hover:bg-secondary/5 transition-colors"
                  >
                    <TableCell className="pl-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="bg-destructive/10 p-1.5 rounded-lg">
                          <ArrowDownCircle className="w-3.5 h-3.5 text-destructive" />
                        </div>
                        <Badge className="bg-destructive/10 text-destructive border-none text-[9px] font-bold uppercase">
                          Sold
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-bold text-sm">{entry.productName}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-code">{entry.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[9px] uppercase font-bold bg-secondary/50 border-none">
                        {entry.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-code text-muted-foreground">{entry.reference}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <span className={cn("font-code font-bold text-base text-destructive")}>
                        {entry.change}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}

                {filteredEntries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-52 text-center">
                      <div className="flex flex-col items-center gap-3 opacity-40">
                        <History className="w-10 h-10" />
                        <p className="font-medium">
                          {stockEntries.length === 0
                            ? "No stock movements yet. Make your first sale!"
                            : "No results match your search."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
