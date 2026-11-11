"use client"

import * as React from "react"
import {
  Truck,
  ArrowLeft,
  Loader2,
  Package,
  ChevronDown,
  ChevronUp,
  Receipt,
  ShoppingCart,
  BadgeDollarSign,
  Calendar,
  Search,
  Layers,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { useUser } from "@/app/auth/use-user"
import { toast } from "@/hooks/use-toast"

interface Purchase {
  id: string
  supplierId: string
  productId: string
  productName: string
  quantity: number
  purchasePrice: number
  billingDate?: string
  createdAt: string
}

interface Supplier {
  id: string
  name: string
  email: string
  phone: string
  contactPerson: string
}

interface GroupedPurchase {
  supplier: Supplier | null
  supplierId: string
  purchases: Purchase[]
  totalProducts: number
  totalAmount: number
  latestDate: string
}

export default function PurchaseHistoryPage() {
  const router = useRouter()
  const { user } = useUser()
  const [purchases, setPurchases] = React.useState<Purchase[]>([])
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([])
  const [loading, setLoading] = React.useState(true)
  const [expandedRow, setExpandedRow] = React.useState<string | null>(null)
  const [viewMode, setViewMode] = React.useState<"date-wise" | "by-supplier">("date-wise")
  const [searchQuery, setSearchQuery] = React.useState("")

  React.useEffect(() => {
    if (!user?.uid) return
    const fetchAll = async () => {
      try {
        setLoading(true)
        const [purchasesRes, suppliersRes] = await Promise.all([
          fetch("/api/purchases", { headers: { "x-user-id": user.uid } }),
          fetch("/api/suppliers", { headers: { "x-user-id": user.uid } }),
        ])
        if (purchasesRes.ok) setPurchases(await purchasesRes.json())
        if (suppliersRes.ok) setSuppliers(await suppliersRes.json())
      } catch (err) {
        console.error(err)
        toast({ title: "Error", description: "Could not load purchase history.", variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [user?.uid])

  // Helper map for fast supplier lookup
  const supplierMap = React.useMemo(() => {
    const map = new Map<string, Supplier>()
    suppliers.forEach(s => map.set(s.id, s))
    return map
  }, [suppliers])

  // 1. DATE-WISE SORTED PURCHASES (Latest on top)
  const chronologicalPurchases = React.useMemo(() => {
    const list = [...purchases].sort((a, b) => {
      const dateA = a.billingDate || a.createdAt || ""
      const dateB = b.billingDate || b.createdAt || ""
      return dateB.localeCompare(dateA)
    })

    const q = searchQuery.trim().toLowerCase()
    if (!q) return list

    return list.filter(p => {
      const sup = supplierMap.get(p.supplierId)
      return (
        p.productName.toLowerCase().includes(q) ||
        (sup && sup.name.toLowerCase().includes(q)) ||
        (p.billingDate && p.billingDate.includes(q))
      )
    })
  }, [purchases, searchQuery, supplierMap])

  // 2. GROUPED BY SUPPLIER (Each group's purchases also sorted latest on top)
  const grouped = React.useMemo(() => {
    const map: Record<string, GroupedPurchase> = {}

    purchases.forEach(p => {
      if (!map[p.supplierId]) {
        const supplier = supplierMap.get(p.supplierId) ?? null
        map[p.supplierId] = {
          supplier,
          supplierId: p.supplierId,
          purchases: [],
          totalProducts: 0,
          totalAmount: 0,
          latestDate: p.billingDate || p.createdAt || "",
        }
      }
      map[p.supplierId].purchases.push(p)
      map[p.supplierId].totalProducts += p.quantity
      map[p.supplierId].totalAmount += p.quantity * p.purchasePrice
      const pDate = p.billingDate || p.createdAt || ""
      if (pDate > map[p.supplierId].latestDate) {
        map[p.supplierId].latestDate = pDate
      }
    })

    // Sort each group's purchases strictly by date descending (latest first)
    Object.values(map).forEach(g => {
      g.purchases.sort((a, b) => {
        const dateA = a.billingDate || a.createdAt || ""
        const dateB = b.billingDate || b.createdAt || ""
        return dateB.localeCompare(dateA)
      })
    })

    const sortedGroups = Object.values(map).sort((a, b) => b.latestDate.localeCompare(a.latestDate))

    const q = searchQuery.trim().toLowerCase()
    if (!q) return sortedGroups

    return sortedGroups.filter(g =>
      (g.supplier && g.supplier.name.toLowerCase().includes(q)) ||
      (g.supplier && g.supplier.contactPerson && g.supplier.contactPerson.toLowerCase().includes(q)) ||
      g.purchases.some(p => p.productName.toLowerCase().includes(q))
    )
  }, [purchases, supplierMap, searchQuery])

  const totalSpent = React.useMemo(() =>
    purchases.reduce((acc, p) => acc + p.quantity * p.purchasePrice, 0),
  [purchases])

  const totalItems = React.useMemo(() =>
    purchases.reduce((acc, p) => acc + p.quantity, 0),
  [purchases])

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
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
              Purchase <span className="text-accent">History</span>
            </h1>
            <p className="text-muted-foreground">Inward procurement logs sorted chronologically with preserved purchase costs.</p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-secondary/30 rounded-xl border border-border/50 self-start md:self-auto">
          <Button
            variant={viewMode === "date-wise" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("date-wise")}
            className="rounded-lg text-xs font-semibold gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" /> Date-Wise (Latest First)
          </Button>
          <Button
            variant={viewMode === "by-supplier" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("by-supplier")}
            className="rounded-lg text-xs font-semibold gap-1.5"
          >
            <Layers className="w-3.5 h-3.5" /> Grouped by Supplier
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3 max-w-3xl">
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-4">
            <div className="bg-accent/10 p-3 rounded-xl">
              <Receipt className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Purchases</p>
              <p className="text-2xl font-bold font-headline">{purchases.length}</p>
            </div>
          </div>
        </Card>
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-xl">
              <ShoppingCart className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Units</p>
              <p className="text-2xl font-bold font-headline">{totalItems}</p>
            </div>
          </div>
        </Card>
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-500/10 p-3 rounded-xl">
              <BadgeDollarSign className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Spent</p>
              <p className="text-2xl font-bold font-headline text-emerald-400">₹{totalSpent.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by product, vendor or date..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-secondary/30 border-none rounded-xl text-xs font-semibold"
          />
        </div>
        <p className="text-xs text-muted-foreground font-code hidden sm:block">
          Showing {viewMode === "date-wise" ? chronologicalPurchases.length : grouped.length} entries
        </p>
      </div>

      {/* ── MAIN CONTENT TABLE ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-accent opacity-50" />
        </div>
      ) : viewMode === "date-wise" ? (
        /* ══════════ VIEW 1: DATE-WISE (LATEST PURCHASES ON TOP) ══════════ */
        <Card className="border-none bg-card shadow-sm overflow-hidden">
          <CardHeader className="bg-secondary/20 border-b border-border/50 py-3 px-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-headline text-lg flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-accent" />
                  Chronological Purchase History
                </CardTitle>
                <CardDescription className="text-xs">
                  All purchase bills sorted strictly by billing date (latest entries on top).
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-code">
                {chronologicalPurchases.length} Items
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader className="bg-secondary/10">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3.5 pl-6 w-[120px]">Billing Date</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3.5">Product Name</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3.5">Supplier / Vendor</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3.5 text-center w-[90px]">Qty</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3.5 text-right w-[130px]">Purchase Cost</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3.5 text-right pr-6 w-[130px]">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chronologicalPurchases.length > 0 ? (
                  chronologicalPurchases.map(p => {
                    const sup = supplierMap.get(p.supplierId)
                    return (
                      <TableRow key={p.id} className="border-border/40 hover:bg-secondary/10 transition-colors">
                        <TableCell className="pl-6 py-3.5 text-xs font-code font-bold text-accent">
                          {p.billingDate || (p.createdAt ? new Date(p.createdAt).toISOString().split("T")[0] : "—")}
                        </TableCell>
                        <TableCell className="py-3.5">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="font-bold text-sm text-foreground">{p.productName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3.5">
                          <div>
                            <p className="font-bold text-xs text-foreground">{sup?.name || "Unknown Supplier"}</p>
                            {sup?.phone && (
                              <p className="text-[10px] text-muted-foreground font-code">📞 {sup.phone}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3.5 text-center font-bold font-code text-sm">
                          {p.quantity}
                        </TableCell>
                        <TableCell className="py-3.5 text-right font-code text-amber-400 font-bold">
                          ₹{p.purchasePrice.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-3.5 text-right pr-6 font-code font-bold text-emerald-400">
                          ₹{(p.quantity * p.purchasePrice).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center gap-3 opacity-40">
                        <Package className="w-10 h-10" />
                        <p className="font-medium">No purchase transactions found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        /* ══════════ VIEW 2: GROUPED BY SUPPLIER (WITH LATEST FIRST BREAKDOWN) ══════════ */
        <Card className="border-none bg-card shadow-sm overflow-hidden">
          <CardHeader className="bg-secondary/20 border-b border-border/50 py-3 px-6">
            <CardTitle className="font-headline text-lg">Purchases by Supplier</CardTitle>
            <CardDescription className="text-xs">Click View to inspect full purchases sorted with latest on top.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader className="bg-secondary/10">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3.5 pl-6">Supplier</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3.5">Contact</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3.5">Latest Purchase</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3.5 text-center">Total Units</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3.5 text-right">Total Amount</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3.5 text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.length > 0 ? grouped.map(group => (
                  <React.Fragment key={group.supplierId}>
                    {/* SUPPLIER ROW */}
                    <TableRow className="border-border/50 hover:bg-secondary/10 transition-colors">
                      <TableCell className="pl-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-accent/10 p-2 rounded-lg">
                            <Truck className="w-4 h-4 text-accent" />
                          </div>
                          <div>
                            <p className="font-bold text-accent">
                              {group.supplier?.name ?? "Unknown Supplier"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {group.supplier?.contactPerson ?? "—"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-code">
                        {group.supplier?.phone ? `📞 ${group.supplier.phone}` : group.supplier?.email || "—"}
                      </TableCell>
                      <TableCell className="text-xs font-code font-bold text-accent">
                        {group.latestDate ? group.latestDate.split("T")[0] : "—"}
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {group.totalProducts}
                      </TableCell>
                      <TableCell className="text-right font-bold font-code text-accent">
                        ₹{group.totalAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-bold rounded-lg"
                          onClick={() => setExpandedRow(
                            expandedRow === group.supplierId ? null : group.supplierId
                          )}
                        >
                          {expandedRow === group.supplierId ? (
                            <><ChevronUp className="w-3.5 h-3.5 mr-1" /> Hide</>
                          ) : (
                            <><ChevronDown className="w-3.5 h-3.5 mr-1" /> View Full History</>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>

                    {/* EXPANDED BREAKDOWN (SORTED LATEST PURCHASE AT THE TOP) */}
                    {expandedRow === group.supplierId && (
                      <TableRow className="bg-secondary/5 hover:bg-secondary/5">
                        <TableCell colSpan={6} className="p-0">
                          <div className="px-6 py-4 border-t border-b border-border/40 bg-secondary/10">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" />
                                Full Purchase History for {group.supplier?.name} (Sorted: Latest on Top)
                              </p>
                              <Badge variant="outline" className="text-[10px] font-code">
                                {group.purchases.length} Records
                              </Badge>
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow className="border-border/30 hover:bg-transparent">
                                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-2 pl-2">Billing Date</TableHead>
                                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-2">Product Name</TableHead>
                                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-2 text-center">Quantity</TableHead>
                                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-2 text-right">Purchase Price (Cost)</TableHead>
                                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-2 text-right pr-2">Subtotal</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.purchases.map((p, i) => (
                                  <TableRow key={p.id || i} className="border-border/20 hover:bg-secondary/20">
                                    <TableCell className="text-xs font-code font-bold text-accent py-2.5 pl-2">
                                      {p.billingDate || (p.createdAt ? new Date(p.createdAt).toISOString().split("T")[0] : "—")}
                                    </TableCell>
                                    <TableCell className="py-2.5">
                                      <div className="flex items-center gap-2">
                                        <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                        <span className="font-bold text-xs text-foreground">{p.productName}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-2.5 text-center font-bold font-code text-xs">
                                      {p.quantity}
                                    </TableCell>
                                    <TableCell className="py-2.5 text-right font-code text-amber-400 font-bold text-xs">
                                      ₹{p.purchasePrice.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right py-2.5 pr-2 font-code font-bold text-emerald-400 text-xs">
                                      ₹{(p.quantity * p.purchasePrice).toLocaleString()}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {/* TOTAL ROW */}
                                <TableRow className="border-t-2 border-border/60 hover:bg-transparent font-bold">
                                  <TableCell colSpan={2} className="py-3 pl-2 text-xs uppercase tracking-wider text-muted-foreground">
                                    Total for {group.supplier?.name}
                                  </TableCell>
                                  <TableCell className="py-3 text-center text-sm font-code">
                                    {group.totalProducts} units
                                  </TableCell>
                                  <TableCell className="py-3 text-right text-xs text-muted-foreground">
                                    Total Inward:
                                  </TableCell>
                                  <TableCell className="py-3 pr-2 text-right text-base text-accent font-code">
                                    ₹{group.totalAmount.toLocaleString()}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center gap-3 opacity-40">
                        <Truck className="w-10 h-10" />
                        <p className="font-medium">No supplier purchase records found.</p>
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
