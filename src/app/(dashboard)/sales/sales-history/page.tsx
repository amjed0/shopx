"use client"

import * as React from "react"
import {
  ShoppingBag,
  FileText,
  IndianRupee,
  CreditCard,
  Wallet,
  Search,
  Loader2,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useCollection, useFirestore, collection, query } from "@/firebase"

export interface Sale {
  id: string
  date: string
  customerId: string
  customerName: string
  total: number
  status: "paid" | "pending" | "returned"
  paymentMethod: "cash" | "upi" | "card" | "credit"
  items: { productId: string; productName: string; quantity: number; price: number }[]
}

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-accent/10 text-accent border-none",
  pending: "bg-orange-500/10 text-orange-400 border-none",
  returned: "bg-destructive/10 text-destructive border-none",
}

const METHOD_STYLE: Record<string, string> = {
  cash: "border-green-500/30 text-green-400",
  upi: "border-blue-500/30 text-blue-400",
  card: "border-purple-500/30 text-purple-400",
  credit: "border-orange-500/30 text-orange-400",
}

export default function SalesHistoryPage() {
  const router = useRouter()
  const firestore = useFirestore()

  const salesQuery = React.useMemo(() => {
    if (!firestore) return null
    return query(collection(firestore, "sales"))
  }, [firestore])

  const { data: sales = [], loading } = useCollection<Sale>(salesQuery)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [expandedSaleId, setExpandedSaleId] = React.useState<string | null>(null)

  const filteredSales = React.useMemo(() => {
    const q = searchQuery.toLowerCase()
    if (!q) return sales
    return sales.filter(
      s =>
        s.customerName?.toLowerCase().includes(q) ||
        s.id?.toLowerCase().includes(q) ||
        s.paymentMethod?.toLowerCase().includes(q) ||
        s.status?.toLowerCase().includes(q)
    )
  }, [sales, searchQuery])

  const stats = React.useMemo(() => {
    const today = new Date().toISOString().split("T")[0]
    const todaySales = sales.filter(s => s.date?.startsWith(today))
    const totalGross = sales.reduce((acc, s) => acc + (s.total || 0), 0)
    const digitalCount = sales.filter(s => ["upi", "card"].includes(s.paymentMethod)).length
    const creditTotal = sales
      .filter(s => s.paymentMethod === "credit")
      .reduce((acc, s) => acc + (s.total || 0), 0)

    return {
      todayCount: todaySales.length,
      gross: totalGross,
      digitalPercent: sales.length ? Math.round((digitalCount / sales.length) * 100) : 0,
      credit: creditTotal,
    }
  }, [sales])

  const toggleExpand = (id: string) =>
    setExpandedSaleId(prev => (prev === id ? null : id))

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
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
              Sales <span className="text-primary">Registry</span>
            </h1>
            <p className="text-muted-foreground">Track billing history, returns, and payment status.</p>
          </div>
        </div>
        <Button
          onClick={() => router.push("/sales/new")}
          className="bg-primary text-primary-foreground gap-2 font-bold px-8 py-6 rounded-full shadow-lg shadow-primary/20"
        >
          <ShoppingBag className="w-5 h-5" />
          Create New Bill
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-xl">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Today's Invoices</p>
              <p className="text-2xl font-bold font-headline">{stats.todayCount}</p>
            </div>
          </div>
        </Card>
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-4">
            <div className="bg-accent/10 p-3 rounded-xl">
              <IndianRupee className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Gross Sales</p>
              <p className="text-2xl font-bold font-headline">₹{stats.gross.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-4">
            <div className="bg-orange-500/10 p-3 rounded-xl">
              <Wallet className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Digital Mix</p>
              <p className="text-2xl font-bold font-headline">{stats.digitalPercent}%</p>
            </div>
          </div>
        </Card>
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-4">
            <div className="bg-purple-500/10 p-3 rounded-xl">
              <CreditCard className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Credit Sales</p>
              <p className="text-2xl font-bold font-headline">₹{stats.credit.toLocaleString()}</p>
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
              <CardTitle className="font-headline text-xl">Recent Transactions</CardTitle>
              <CardDescription>Click a row to expand item details.</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search invoice or customer..."
                className="pl-9 h-9 w-72 bg-secondary/50 border-none rounded-full"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/10">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="w-8 py-4 pl-4" />
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Status</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Customer</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Date</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Method</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4 text-right pr-6">
                    Total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map(sale => (
                  <React.Fragment key={sale.id}>
                    <TableRow
                      className="border-border/50 hover:bg-secondary/10 transition-colors cursor-pointer"
                      onClick={() => toggleExpand(sale.id)}
                    >
                      <TableCell className="pl-4 py-4">
                        {expandedSaleId === sale.id ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-50" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_STYLE[sale.status] || "bg-secondary border-none"}>
                          {sale.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold">{sale.customerName}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(sale.date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "uppercase font-bold text-[9px] tracking-tighter rounded",
                            METHOD_STYLE[sale.paymentMethod] || "text-muted-foreground"
                          )}
                        >
                          {sale.paymentMethod}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-code font-bold text-lg pr-6">
                        ₹{(sale.total || 0).toLocaleString()}
                      </TableCell>
                    </TableRow>

                    {/* Expanded items row */}
                    {expandedSaleId === sale.id && (
                      <TableRow className="bg-secondary/5 border-border/30">
                        <TableCell colSpan={6} className="py-0">
                          <div className="py-4 px-6 space-y-2">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-2">
                              Items in this Invoice
                            </p>
                            <div className="rounded-xl overflow-hidden border border-border/30">
                              <table className="w-full text-sm">
                                <thead className="bg-secondary/30">
                                  <tr>
                                    <th className="text-left p-2 pl-4 text-[10px] font-bold uppercase text-muted-foreground">Product</th>
                                    <th className="text-center p-2 text-[10px] font-bold uppercase text-muted-foreground">Qty</th>
                                    <th className="text-right p-2 text-[10px] font-bold uppercase text-muted-foreground">Unit Price</th>
                                    <th className="text-right p-2 pr-4 text-[10px] font-bold uppercase text-muted-foreground">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(sale.items || []).map((item, i) => (
                                    <tr key={i} className="border-t border-border/20 hover:bg-secondary/10">
                                      <td className="p-2 pl-4 font-bold">{item.productName}</td>
                                      <td className="p-2 text-center">
                                        <Badge variant="secondary" className="bg-secondary/50 border-none font-code text-xs">
                                          ×{item.quantity}
                                        </Badge>
                                      </td>
                                      <td className="p-2 text-right text-muted-foreground font-code">₹{item.price}</td>
                                      <td className="p-2 pr-4 text-right font-bold font-code">
                                        ₹{(item.quantity * item.price).toLocaleString()}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="flex justify-end pt-1">
                              <p className="text-xs text-muted-foreground">
                                Invoice ID:{" "}
                                <span className="font-code text-foreground">
                                  {sale.id?.slice(-12).toUpperCase()}
                                </span>
                              </p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}

                {filteredSales.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center gap-3 opacity-40">
                        <FileText className="w-10 h-10" />
                        <p className="font-medium">No transactions found.</p>
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
