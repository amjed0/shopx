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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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

  // GROUP PURCHASES BY SUPPLIER
  const grouped = React.useMemo(() => {
    const map: Record<string, GroupedPurchase> = {}

    purchases.forEach(p => {
      if (!map[p.supplierId]) {
        const supplier = suppliers.find(s => s.id === p.supplierId) ?? null
        map[p.supplierId] = {
          supplier,
          supplierId: p.supplierId,
          purchases: [],
          totalProducts: 0,
          totalAmount: 0,
          latestDate: p.createdAt,
        }
      }
      map[p.supplierId].purchases.push(p)
      map[p.supplierId].totalProducts += p.quantity
      map[p.supplierId].totalAmount += p.quantity * p.purchasePrice
      if (p.createdAt > map[p.supplierId].latestDate) {
        map[p.supplierId].latestDate = p.createdAt
      }
    })

    return Object.values(map).sort((a, b) => b.latestDate.localeCompare(a.latestDate))
  }, [purchases, suppliers])

  const totalSpent = React.useMemo(() =>
    purchases.reduce((acc, p) => acc + p.quantity * p.purchasePrice, 0),
  [purchases])

  const totalItems = React.useMemo(() =>
    purchases.reduce((acc, p) => acc + p.quantity, 0),
  [purchases])

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
              Purchase <span className="text-accent">History</span>
            </h1>
            <p className="text-muted-foreground">All inward stock purchases grouped by supplier.</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-3 max-w-3xl">
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
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Items</p>
              <p className="text-2xl font-bold font-headline">{totalItems}</p>
            </div>
          </div>
        </Card>
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-4">
            <div className="bg-green-500/10 p-3 rounded-xl">
              <BadgeDollarSign className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Spent</p>
              <p className="text-2xl font-bold font-headline">₹{totalSpent.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-accent opacity-50" />
        </div>
      ) : (
        <Card className="border-none bg-card shadow-sm overflow-hidden">
          <CardHeader className="bg-secondary/20 border-b border-border/50">
            <CardTitle className="font-headline text-xl">All Purchases</CardTitle>
            <CardDescription>Grouped by supplier. Click View to expand products.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/10">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4 pl-6">Supplier</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Email</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Last Purchase</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Total Products</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Total Amount</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4 text-right pr-6">View</TableHead>
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
                      <TableCell className="text-xs text-muted-foreground">
                        {group.supplier?.email ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(group.latestDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <span className="font-bold">{group.totalProducts}</span>
                        <span className="text-xs text-muted-foreground ml-1">units</span>
                      </TableCell>
                      <TableCell className="font-bold text-accent">
                        ₹{group.totalAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExpandedRow(
                            expandedRow === group.supplierId ? null : group.supplierId
                          )}
                        >
                          {expandedRow === group.supplierId ? (
                            <><ChevronUp className="w-3 h-3 mr-1" /> Hide</>
                          ) : (
                            <><ChevronDown className="w-3 h-3 mr-1" /> View</>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>

                    {/* EXPANDED PRODUCTS ROW */}
                    {expandedRow === group.supplierId && (
                      <TableRow className="bg-secondary/5 hover:bg-secondary/5">
                        <TableCell colSpan={6} className="p-0">
                          <div className="px-6 py-4 border-t border-border/30">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                              Purchase Breakdown
                            </p>
                            <Table>
                              <TableHeader>
                                <TableRow className="border-none hover:bg-transparent">
                                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-2 pl-0">Product Name</TableHead>
                                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-2">Date</TableHead>
                                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-2">Quantity</TableHead>
                                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-2">Purchase Price</TableHead>
                                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-2 text-right">Subtotal</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.purchases.map((p, i) => (
                                  <TableRow key={i} className="border-border/20 hover:bg-secondary/10">
                                    <TableCell className="py-2 pl-0">
                                      <div className="flex items-center gap-2">
                                        <Package className="w-3 h-3 text-muted-foreground" />
                                        <span className="font-medium text-sm">{p.productName}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground py-2">
                                      {new Date(p.createdAt).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="py-2">
                                      <span className="font-bold">{p.quantity}</span>
                                    </TableCell>
                                    <TableCell className="py-2">
                                      ₹{p.purchasePrice.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right py-2 font-bold text-accent">
                                      ₹{(p.quantity * p.purchasePrice).toLocaleString()}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {/* SUBTOTAL ROW */}
                                <TableRow className="border-t border-border/50 hover:bg-transparent">
                                  <TableCell colSpan={4} className="py-3 pl-0 text-right font-bold uppercase text-[10px] tracking-widest text-muted-foreground">
                                    Total
                                  </TableCell>
                                  <TableCell className="py-3 text-right font-bold text-lg text-accent">
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
                        <p className="font-medium">No purchase history found.</p>
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