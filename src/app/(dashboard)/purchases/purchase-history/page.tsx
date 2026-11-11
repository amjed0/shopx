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
  IndianRupee,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

interface DateGroup {
  date: string            // e.g. "2026-11-12"
  displayDate: string     // e.g. "Today" / "Yesterday" / "12 Nov 2026"
  purchases: Purchase[]
  totalQty: number
  totalAmount: number
  productCount: number    // unique product count
  supplierNames: string[] // distinct supplier names on that day
}

function formatDisplayDate(dateStr: string): string {
  const today = new Date().toISOString().split("T")[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
  if (dateStr === today) return "Today"
  if (dateStr === yesterday) return "Yesterday"
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  } catch {
    return dateStr
  }
}

export default function PurchaseHistoryPage() {
  const router = useRouter()
  const { user } = useUser()
  const [purchases, setPurchases] = React.useState<Purchase[]>([])
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([])
  const [loading, setLoading] = React.useState(true)
  const [expandedDates, setExpandedDates] = React.useState<Set<string>>(new Set())
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
        if (purchasesRes.ok) {
          const data = await purchasesRes.json()
          setPurchases(Array.isArray(data) ? data : [])
        }
        if (suppliersRes.ok) {
          const data = await suppliersRes.json()
          setSuppliers(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        console.error(err)
        toast({ title: "Error", description: "Could not load purchase history.", variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [user?.uid])

  // Auto-expand today's date on first load
  React.useEffect(() => {
    const today = new Date().toISOString().split("T")[0]
    setExpandedDates(new Set([today]))
  }, [])

  const supplierMap = React.useMemo(() => {
    const map = new Map<string, Supplier>()
    suppliers.forEach(s => map.set(s.id, s))
    return map
  }, [suppliers])

  // Group by billing date, latest on top
  const dateGroups = React.useMemo((): DateGroup[] => {
    const map: Record<string, DateGroup> = {}

    purchases.forEach(p => {
      const date = p.billingDate || (p.createdAt ? p.createdAt.split("T")[0] : "Unknown")
      if (!map[date]) {
        map[date] = {
          date,
          displayDate: formatDisplayDate(date),
          purchases: [],
          totalQty: 0,
          totalAmount: 0,
          productCount: 0,
          supplierNames: [],
        }
      }
      map[date].purchases.push(p)
      map[date].totalQty += Number(p.quantity) || 0
      map[date].totalAmount += (Number(p.quantity) || 0) * (Number(p.purchasePrice) || 0)
    })

    // Count unique products per date, collect unique supplier names
    Object.values(map).forEach(g => {
      const productIds = new Set(g.purchases.map(p => p.productId))
      g.productCount = productIds.size

      const supIds = new Set(g.purchases.map(p => p.supplierId))
      g.supplierNames = Array.from(supIds)
        .map(id => supplierMap.get(id)?.name ?? "Unknown")
        .filter(Boolean)
        .slice(0, 3)
    })

    // Sort groups: latest date first
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date))
  }, [purchases, supplierMap])

  // Apply search filter across date groups
  const filteredGroups = React.useMemo((): DateGroup[] => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return dateGroups

    return dateGroups
      .map(g => ({
        ...g,
        purchases: g.purchases.filter(p => {
          const sup = supplierMap.get(p.supplierId)
          return (
            p.productName.toLowerCase().includes(q) ||
            (sup && sup.name.toLowerCase().includes(q)) ||
            g.date.includes(q)
          )
        }),
      }))
      .filter(g => g.purchases.length > 0)
      .map(g => ({
        ...g,
        totalQty: g.purchases.reduce((s, p) => s + (Number(p.quantity) || 0), 0),
        totalAmount: g.purchases.reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.purchasePrice) || 0), 0),
        productCount: new Set(g.purchases.map(p => p.productId)).size,
        supplierNames: Array.from(new Set(g.purchases.map(p => supplierMap.get(p.supplierId)?.name ?? "Unknown"))).slice(0, 3),
      }))
  }, [dateGroups, searchQuery, supplierMap])

  const toggleDate = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const totalSpent = React.useMemo(() =>
    purchases.reduce((acc, p) => acc + (Number(p.quantity) || 0) * (Number(p.purchasePrice) || 0), 0),
  [purchases])

  const totalItems = React.useMemo(() =>
    purchases.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0),
  [purchases])

  const todayTotal = React.useMemo(() => {
    const today = new Date().toISOString().split("T")[0]
    const todayGroup = dateGroups.find(g => g.date === today)
    return todayGroup?.totalAmount ?? 0
  }, [dateGroups])

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-secondary shrink-0"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-headline font-bold text-foreground">
              Purchase <span className="text-accent">History</span>
            </h1>
            <p className="text-muted-foreground text-sm">All inward purchases grouped by billing date — latest first.</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-accent/10 p-2.5 rounded-xl">
              <Calendar className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Today's Purchases</p>
              <p className="text-xl font-bold font-headline text-accent">₹{todayTotal.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Bills</p>
              <p className="text-xl font-bold font-headline">{purchases.length}</p>
            </div>
          </div>
        </Card>
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/10 p-2.5 rounded-xl">
              <ShoppingCart className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Units</p>
              <p className="text-xl font-bold font-headline">{totalItems}</p>
            </div>
          </div>
        </Card>
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2.5 rounded-xl">
              <BadgeDollarSign className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Spent</p>
              <p className="text-xl font-bold font-headline text-emerald-400">₹{totalSpent.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search product, supplier, date..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-secondary/30 border-none rounded-xl text-sm"
          />
        </div>
        <p className="text-xs text-muted-foreground font-code hidden sm:block shrink-0">
          {filteredGroups.length} date{filteredGroups.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Date Groups */}
      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-10 h-10 animate-spin text-accent opacity-50" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <Card className="border-none bg-card shadow-sm">
          <div className="flex flex-col items-center gap-3 py-24 opacity-30">
            <Package className="w-12 h-12" />
            <p className="font-semibold">No purchase history found.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map(group => {
            const isExpanded = expandedDates.has(group.date)
            const isToday = group.date === new Date().toISOString().split("T")[0]

            return (
              <Card
                key={group.date}
                className={`border-none shadow-md overflow-hidden transition-all ${isToday ? "ring-1 ring-accent/40" : ""}`}
              >
                {/* ── ACCORDION HEADER (always visible) ── */}
                <button
                  type="button"
                  onClick={() => toggleDate(group.date)}
                  className="w-full text-left"
                >
                  <div className={`flex items-center justify-between gap-3 px-4 sm:px-6 py-4 transition-colors hover:bg-secondary/20 ${isExpanded ? "bg-secondary/20 border-b border-border/50" : "bg-card"}`}>
                    
                    {/* Left: Date + badge */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2.5 rounded-xl shrink-0 ${isToday ? "bg-accent/20" : "bg-secondary/40"}`}>
                        <Calendar className={`w-4 h-4 ${isToday ? "text-accent" : "text-muted-foreground"}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-bold text-base sm:text-lg ${isToday ? "text-accent" : "text-foreground"}`}>
                            {group.displayDate}
                          </span>
                          {isToday && (
                            <Badge className="text-[9px] bg-accent/20 text-accent hover:bg-accent/30 px-2 py-0.5 h-5">
                              Today
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground font-code hidden sm:inline">
                            {group.date}
                          </span>
                        </div>
                        {/* Supplier names preview */}
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {group.supplierNames.length > 0
                            ? group.supplierNames.join(" · ")
                            : "No supplier recorded"}
                          {group.supplierNames.length >= 3 && " ···"}
                        </p>
                      </div>
                    </div>

                    {/* Right: Summary stats + toggle icon */}
                    <div className="flex items-center gap-3 sm:gap-5 shrink-0">
                      {/* Total Qty */}
                      <div className="text-center hidden sm:block">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Qty</p>
                        <p className="font-bold text-sm font-code">{group.totalQty}</p>
                      </div>
                      {/* Product count */}
                      <div className="text-center hidden sm:block">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Products</p>
                        <p className="font-bold text-sm font-code">{group.purchases.length}</p>
                      </div>
                      {/* Total Amount — always visible */}
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Day Total</p>
                        <p className={`font-bold text-base sm:text-lg font-code ${isToday ? "text-accent" : "text-emerald-400"}`}>
                          ₹{group.totalAmount.toLocaleString()}
                        </p>
                      </div>
                      {/* Toggle icon */}
                      <div className={`p-1.5 rounded-lg transition-colors ${isExpanded ? "bg-accent/20 text-accent" : "bg-secondary/40 text-muted-foreground"}`}>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </div>
                </button>

                {/* ── EXPANDED PURCHASE DETAIL TABLE ── */}
                {isExpanded && (
                  <CardContent className="p-0">
                    {/* Mobile qty / product count strip (shows on small screens only) */}
                    <div className="sm:hidden px-4 py-2.5 bg-secondary/10 border-b border-border/30 flex items-center gap-4 text-xs text-muted-foreground">
                      <span><span className="font-bold text-foreground">{group.purchases.length}</span> purchases</span>
                      <span><span className="font-bold text-foreground">{group.totalQty}</span> total qty</span>
                    </div>

                    <div className="overflow-x-auto">
                      <Table className="min-w-[640px]">
                        <TableHeader className="bg-secondary/10">
                          <TableRow className="border-border/30 hover:bg-transparent">
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 pl-5">#</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3">Product Name</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3">Supplier / Vendor</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-center w-[80px]">Qty</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-right w-[120px]">Purchase Cost</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-right pr-5 w-[120px]">Subtotal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.purchases.map((p, i) => {
                            const sup = supplierMap.get(p.supplierId)
                            return (
                              <TableRow
                                key={p.id || i}
                                className="border-border/20 hover:bg-secondary/10 transition-colors"
                              >
                                <TableCell className="py-3 pl-5 text-xs text-muted-foreground font-code">
                                  {i + 1}
                                </TableCell>
                                <TableCell className="py-3">
                                  <div className="flex items-center gap-2">
                                    <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    <span className="font-bold text-sm text-foreground">{p.productName}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-3">
                                  <div>
                                    <p className="text-xs font-bold text-foreground">{sup?.name ?? "Unknown"}</p>
                                    {sup?.phone && (
                                      <p className="text-[10px] text-muted-foreground font-code">📞 {sup.phone}</p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="py-3 text-center font-bold font-code">
                                  {p.quantity}
                                </TableCell>
                                <TableCell className="py-3 text-right font-code text-amber-400 font-bold text-sm">
                                  ₹{Number(p.purchasePrice).toLocaleString()}
                                </TableCell>
                                <TableCell className="py-3 text-right pr-5 font-code font-bold text-emerald-400 text-sm">
                                  ₹{((Number(p.quantity) || 0) * (Number(p.purchasePrice) || 0)).toLocaleString()}
                                </TableCell>
                              </TableRow>
                            )
                          })}

                          {/* Day Total Row */}
                          <TableRow className="bg-secondary/20 border-t-2 border-border/60 hover:bg-secondary/20">
                            <TableCell colSpan={3} className="py-3 pl-5">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Day Total — {group.displayDate}
                              </span>
                            </TableCell>
                            <TableCell className="py-3 text-center">
                              <span className="font-bold font-code text-sm">{group.totalQty}</span>
                              <span className="text-[10px] text-muted-foreground ml-1">units</span>
                            </TableCell>
                            <TableCell className="py-3 text-right text-xs text-muted-foreground">
                              {group.purchases.length} items
                            </TableCell>
                            <TableCell className="py-3 text-right pr-5">
                              <span className={`font-bold font-code text-lg ${isToday ? "text-accent" : "text-emerald-400"}`}>
                                ₹{group.totalAmount.toLocaleString()}
                              </span>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
