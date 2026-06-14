"use client"

import * as React from "react"
import {
  Search,
  Plus,
  Trash2,
  ArrowLeft,
  Loader2,
  Package,
  Save,
  CheckCircle2,
  RotateCcw,
  User,
  X,
  ChevronDown,
  ChevronUp,
  Receipt,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { useUser } from "@/app/auth/use-user"

interface Product {
  id: string
  name: string
  sku: string
  purchasePrice: number
  sellingPrice: number
  stock: number
  category: string
}

interface Customer {
  id: string
  name: string
  phone: string
  email?: string
}

interface ReturnItem {
  productId: string
  productName: string
  sku: string
  quantity: number
  salePrice: number
}

interface SaleReturn {
  id: string
  customerName: string
  customerId: string | null
  returnDate: string
  items: ReturnItem[]
  totalAmount: number
  reason?: string
}

export default function SalesReturnPage() {
  const router = useRouter()
  const { user } = useUser()

  const [products, setProducts] = React.useState<Product[]>([])
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [returns, setReturns] = React.useState<SaleReturn[]>([])
  const [loadingData, setLoadingData] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [expandedRow, setExpandedRow] = React.useState<string | null>(null)

  // Form state
  const [returnItems, setReturnItems] = React.useState<ReturnItem[]>([])
  const [productSearch, setProductSearch] = React.useState("")
  const [customerSearch, setCustomerSearch] = React.useState("")
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null)
  const [customerMode, setCustomerMode] = React.useState<"search" | "manual" | "none">("none")
  const [manualCustomerName, setManualCustomerName] = React.useState("")
  const [returnReason, setReturnReason] = React.useState("")
  const [billDate, setBillDate] = React.useState(() => new Date().toISOString().split("T")[0])

  React.useEffect(() => {
    if (!user?.uid) return
    const fetchAll = async () => {
      try {
        setLoadingData(true)
        const [productsRes, customersRes, returnsRes] = await Promise.all([
          fetch("/api/products", { headers: { "x-user-id": user.uid } }),
          fetch("/api/customers", { headers: { "x-user-id": user.uid } }),
          fetch("/api/sales-returns", { headers: { "x-user-id": user.uid } }),
        ])
        if (productsRes.ok) setProducts(await productsRes.json())
        if (customersRes.ok) setCustomers(await customersRes.json())
        if (returnsRes.ok) setReturns(await returnsRes.json())
      } catch (err) {
        console.error(err)
        toast({ variant: "destructive", title: "Failed to load data" })
      } finally {
        setLoadingData(false)
      }
    }
    fetchAll()
  }, [user?.uid])

  const filteredProducts = React.useMemo(() => {
    const q = productSearch.toLowerCase()
    if (!q) return []
    return products.filter(
      p =>
        !returnItems.find(i => i.productId === p.id) &&
        (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    ).slice(0, 6)
  }, [products, productSearch, returnItems])

  const filteredCustomers = React.useMemo(() => {
    const q = customerSearch.toLowerCase()
    if (!q) return []
    return customers.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
    ).slice(0, 5)
  }, [customers, customerSearch])

  const addItem = (product: Product) => {
    setReturnItems(prev => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: 1,
        salePrice: product.sellingPrice,
      },
    ])
    setProductSearch("")
  }

  const removeItem = (id: string) =>
    setReturnItems(prev => prev.filter(i => i.productId !== id))

  const updateItem = (id: string, field: keyof ReturnItem, value: any) =>
    setReturnItems(prev =>
      prev.map(i => i.productId === id ? { ...i, [field]: value } : i)
    )

  const total = returnItems.reduce((acc, i) => acc + i.quantity * i.salePrice, 0)

  const customerName = selectedCustomer?.name ?? manualCustomerName ?? "Walk-in Customer"

  const handleSubmit = async () => {
    if (returnItems.length === 0 || !user?.uid) return
    if (customerMode === "manual" && !manualCustomerName.trim()) {
      toast({ variant: "destructive", title: "Enter customer name" })
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        customerName,
        customerId: selectedCustomer?.id ?? null,
        returnDate: billDate,
        reason: returnReason,
        totalAmount: total,
        items: returnItems,
      }

      const res = await fetch("/api/sales-returns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.uid,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error("Failed to save return")

      const saved = await res.json()
      setReturns(prev => [saved, ...prev])

      await Promise.all(
        returnItems.map(item => {
          const product = products.find(p => p.id === item.productId)
          if (!product) return Promise.resolve()
          return fetch(`/api/products/${item.productId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-user-id": user.uid },
            body: JSON.stringify({ stock: Number(product.stock) + Number(item.quantity) }),
          })
        })
      )

      toast({ title: "Return Processed", description: `₹${total.toLocaleString()} return recorded.` })

      setReturnItems([])
      setSelectedCustomer(null)
      setCustomerSearch("")
      setManualCustomerName("")
      setReturnReason("")
      setCustomerMode("none")
      setBillDate(new Date().toISOString().split("T")[0])
    } catch (err: any) {
      console.error(err)
      toast({ variant: "destructive", title: "Failed", description: err.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setReturnItems([])
    setSelectedCustomer(null)
    setCustomerSearch("")
    setManualCustomerName("")
    setReturnReason("")
    setCustomerMode("none")
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-headline font-bold">
              Sales <span className="text-accent">Return</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Process product returns and restock inventory.</p>
          </div>
        </div>
        <div className="flex gap-2 sm:shrink-0 ml-11 sm:ml-0">
          <Button
            variant="outline"
            className="rounded-xl font-bold uppercase tracking-wider text-[10px] h-8 sm:h-9"
            onClick={resetForm}
            disabled={returnItems.length === 0}
          >
            Clear
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-accent text-accent-foreground font-bold px-4 sm:px-8 rounded-xl shadow-lg shadow-accent/20 h-8 sm:h-9 text-xs sm:text-sm"
            disabled={returnItems.length === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Process Return
          </Button>
        </div>
      </div>

      {/* ── MAIN GRID: stacks on mobile, side-by-side on lg ── */}
      <div className="grid gap-6 lg:grid-cols-4">

        {/* ── LEFT PANEL ── */}
        <div className="lg:col-span-1 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">

          {/* Product Search */}
          <Card className="border-none bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Package className="w-4 h-4" /> Product
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search product..."
                  className="pl-9 h-9 bg-secondary/30 border-none text-xs rounded-lg"
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                />
              </div>
              {filteredProducts.length > 0 && (
                <div className="space-y-1">
                  {filteredProducts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => addItem(p)}
                      className="w-full p-2 rounded-lg border border-transparent hover:border-accent/30 hover:bg-accent/5 flex justify-between items-center group transition-all"
                    >
                      <div className="text-left min-w-0">
                        <p className="font-bold text-[11px] group-hover:text-accent truncate max-w-[140px]">{p.name}</p>
                        <p className="text-[9px] text-muted-foreground">{p.sku}</p>
                      </div>
                      <Badge variant="outline" className="text-[8px] h-4 px-1 shrink-0">₹{p.sellingPrice}</Badge>
                    </button>
                  ))}
                </div>
              )}
              {productSearch && filteredProducts.length === 0 && (
                <p className="text-[10px] text-center py-2 text-muted-foreground italic">No products matched</p>
              )}
            </CardContent>
          </Card>

          {/* Customer */}
          <Card className="border-none bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <User className="w-4 h-4" /> Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customerMode === "none" && (
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="sm" className="w-full rounded-lg text-xs" onClick={() => setCustomerMode("search")}>
                    <Search className="w-3 h-3 mr-2" /> Select Existing
                  </Button>
                  <Button variant="outline" size="sm" className="w-full rounded-lg text-xs" onClick={() => setCustomerMode("manual")}>
                    <Plus className="w-3 h-3 mr-2" /> Enter Manually
                  </Button>
                  <p className="text-[10px] text-center text-muted-foreground">or leave as Walk-in</p>
                </div>
              )}

              {customerMode === "search" && !selectedCustomer && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search customer..."
                      className="pl-9 h-9 bg-secondary/30 border-none text-xs rounded-lg"
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {filteredCustomers.length > 0 && (
                    <div className="space-y-1">
                      {filteredCustomers.map(c => (
                        <button
                          key={c.id}
                          className="w-full p-2 rounded-lg hover:bg-secondary text-left flex flex-col transition-colors"
                          onClick={() => { setSelectedCustomer(c); setCustomerSearch("") }}
                        >
                          <span className="font-bold text-xs">{c.name}</span>
                          <span className="text-[10px] text-muted-foreground">{c.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => setCustomerMode("none")}>
                    <X className="w-3 h-3 mr-1" /> Cancel
                  </Button>
                </div>
              )}

              {customerMode === "search" && selectedCustomer && (
                <div className="p-3 bg-accent/10 rounded-lg border border-accent/20">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{selectedCustomer.name}</p>
                      <p className="text-[10px] text-muted-foreground">{selectedCustomer.phone}</p>
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="h-6 w-6 text-destructive/50 hover:text-destructive shrink-0"
                      onClick={() => { setSelectedCustomer(null); setCustomerMode("none") }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}

              {customerMode === "manual" && (
                <div className="space-y-2">
                  <Input
                    placeholder="Customer name..."
                    className="h-9 bg-secondary/30 border-none text-xs rounded-lg"
                    value={manualCustomerName}
                    onChange={e => setManualCustomerName(e.target.value)}
                    autoFocus
                  />
                  <Button
                    variant="ghost" size="sm"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => { setCustomerMode("none"); setManualCustomerName("") }}
                  >
                    <X className="w-3 h-3 mr-1" /> Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Return Details */}
          <Card className="border-none bg-card shadow-sm sm:col-span-2 lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Receipt className="w-4 h-4" /> Return Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Return Date</Label>
                <Input
                  type="date"
                  className="h-9 bg-secondary/30 border-none text-xs rounded-lg"
                  value={billDate}
                  onChange={e => setBillDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Reason (optional)</Label>
                <Input
                  placeholder="e.g. Defective, Wrong item..."
                  className="h-9 bg-secondary/30 border-none text-xs rounded-lg"
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="lg:col-span-3 space-y-6">

          {/* Return Sheet */}
          <Card className="border-none bg-card shadow-xl overflow-hidden min-h-[300px]">
            <CardHeader className="bg-secondary/20 border-b border-border/50 py-3 md:py-4 flex flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <RotateCcw className="w-4 h-4 md:w-5 md:h-5 text-accent shrink-0" />
                <div className="min-w-0">
                  <CardTitle className="text-base md:text-lg">Return Sheet</CardTitle>
                  <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground truncate">
                    {customerName}
                  </CardDescription>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Refund Total</p>
                <p className="text-xl md:text-3xl font-code font-bold text-accent">₹{total.toLocaleString()}</p>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {/* ── MOBILE: card-based item list ── */}
              <div className="block md:hidden">
                {returnItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 opacity-30 gap-3">
                    <RotateCcw className="w-10 h-10" />
                    <p className="text-sm font-bold">No Items Added</p>
                    <p className="text-xs">Search and select products to return.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {returnItems.map((item, index) => (
                      <div key={item.productId} className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{item.productName}</p>
                            <p className="text-[10px] font-code opacity-60">{item.sku}</p>
                          </div>
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-destructive/30 hover:text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => removeItem(item.productId)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Qty</p>
                            <Input
                              type="number" min={1}
                              className="h-8 text-xs bg-secondary/20 border-none font-bold text-center"
                              value={item.quantity}
                              onChange={e => updateItem(item.productId, "quantity", Number(e.target.value))}
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Sale Price (₹)</p>
                            <Input
                              type="number"
                              className="h-8 text-xs bg-secondary/20 border-none font-bold text-right"
                              value={item.salePrice}
                              onChange={e => updateItem(item.productId, "salePrice", Number(e.target.value))}
                            />
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Subtotal</span>
                          <span className="font-code font-bold text-foreground">
                            ₹{(item.quantity * item.salePrice).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── DESKTOP: table view ── */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader className="bg-secondary/10">
                    <TableRow className="border-border/50">
                      <TableHead className="w-10 text-center text-[10px] font-bold uppercase py-3">#</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase py-3">Product</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase py-3">SKU</TableHead>
                      <TableHead className="w-[110px] text-[10px] font-bold uppercase py-3">Qty</TableHead>
                      <TableHead className="w-[130px] text-[10px] font-bold uppercase py-3">Sale Price (₹)</TableHead>
                      <TableHead className="w-[130px] text-right text-[10px] font-bold uppercase py-3">Subtotal (₹)</TableHead>
                      <TableHead className="w-10 py-3" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returnItems.map((item, index) => (
                      <TableRow key={item.productId} className="border-border/30 group hover:bg-secondary/5">
                        <TableCell className="text-center font-code text-xs text-muted-foreground">{index + 1}</TableCell>
                        <TableCell><p className="font-bold text-sm">{item.productName}</p></TableCell>
                        <TableCell className="font-code text-[11px] opacity-70">{item.sku}</TableCell>
                        <TableCell>
                          <Input
                            type="number" min={1}
                            className="h-8 text-xs bg-secondary/20 border-none font-bold text-center"
                            value={item.quantity}
                            onChange={e => updateItem(item.productId, "quantity", Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="h-8 text-xs bg-secondary/20 border-none font-bold text-right"
                            value={item.salePrice}
                            onChange={e => updateItem(item.productId, "salePrice", Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell className="text-right font-code font-bold">
                          {(item.quantity * item.salePrice).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-destructive/30 hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeItem(item.productId)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {returnItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="h-60 text-center">
                          <div className="flex flex-col items-center justify-center opacity-30 gap-3">
                            <RotateCcw className="w-12 h-12" />
                            <div className="space-y-1">
                              <p className="text-sm font-bold">No Items Added</p>
                              <p className="text-xs">Search and select products to return.</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>

            {returnItems.length > 0 && (
              <CardContent className="bg-secondary/10 border-t border-border/50 py-3 px-4 md:px-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <span>Stock will be restocked on processing</span>
                  <span className="flex items-center gap-1.5 text-accent">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready to Process
                  </span>
                </div>
              </CardContent>
            )}
          </Card>

          {/* ── RETURN HISTORY ── */}
          <Card className="border-none bg-card shadow-sm overflow-hidden">
            <CardHeader className="bg-secondary/20 border-b border-border/50">
              <CardTitle className="font-headline text-lg md:text-xl">Return History</CardTitle>
              <CardDescription>All processed sales returns.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingData ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-accent opacity-50" />
                </div>
              ) : (
                <>
                  {/* ── MOBILE: card list ── */}
                  <div className="block md:hidden divide-y divide-border/30">
                    {returns.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 opacity-40 gap-3">
                        <RotateCcw className="w-10 h-10" />
                        <p className="font-medium text-sm">No returns found.</p>
                      </div>
                    ) : returns.map(r => (
                      <div key={r.id} className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="bg-accent/10 p-1.5 rounded-lg shrink-0">
                              <User className="w-3.5 h-3.5 text-accent" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-accent text-sm truncate">{r.customerName}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(r.returnDate).toLocaleDateString()} · {r.items.length} products
                              </p>
                            </div>
                          </div>
                          <p className="font-bold text-accent shrink-0 ml-2">₹{r.totalAmount.toLocaleString()}</p>
                        </div>
                        {r.reason && (
                          <p className="text-xs text-muted-foreground">Reason: {r.reason}</p>
                        )}
                        <Button
                          variant="outline" size="sm"
                          className="w-full text-xs rounded-lg"
                          onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}
                        >
                          {expandedRow === r.id ? (
                            <><ChevronUp className="w-3 h-3 mr-1" /> Hide Items</>
                          ) : (
                            <><ChevronDown className="w-3 h-3 mr-1" /> View Items</>
                          )}
                        </Button>
                        {expandedRow === r.id && (
                          <div className="rounded-xl border border-border/30 overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-secondary/30">
                                <tr>
                                  <th className="text-left p-2 pl-3 text-[10px] font-bold uppercase text-muted-foreground">Product</th>
                                  <th className="text-center p-2 text-[10px] font-bold uppercase text-muted-foreground">Qty</th>
                                  <th className="text-right p-2 pr-3 text-[10px] font-bold uppercase text-muted-foreground">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.items.map((item, i) => (
                                  <tr key={i} className="border-t border-border/20">
                                    <td className="p-2 pl-3 font-medium">{item.productName}</td>
                                    <td className="p-2 text-center font-bold">×{item.quantity}</td>
                                    <td className="p-2 pr-3 text-right font-bold text-accent">
                                      ₹{(item.quantity * item.salePrice).toLocaleString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* ── DESKTOP: table ── */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader className="bg-secondary/10">
                        <TableRow className="border-none hover:bg-transparent">
                          <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4 pl-6">Customer</TableHead>
                          <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Date</TableHead>
                          <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Reason</TableHead>
                          <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Items</TableHead>
                          <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Total Refund</TableHead>
                          <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4 text-right pr-6">View</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {returns.length > 0 ? returns.map(r => (
                          <React.Fragment key={r.id}>
                            <TableRow className="border-border/50 hover:bg-secondary/10 transition-colors">
                              <TableCell className="pl-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="bg-accent/10 p-2 rounded-lg shrink-0">
                                    <User className="w-4 h-4 text-accent" />
                                  </div>
                                  <span className="font-bold text-accent">{r.customerName}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(r.returnDate).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{r.reason ?? "—"}</TableCell>
                              <TableCell>
                                <span className="font-bold">{r.items.length}</span>
                                <span className="text-xs text-muted-foreground ml-1">products</span>
                              </TableCell>
                              <TableCell className="font-bold text-accent">₹{r.totalAmount.toLocaleString()}</TableCell>
                              <TableCell className="text-right pr-6">
                                <Button
                                  variant="outline" size="sm"
                                  onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}
                                >
                                  {expandedRow === r.id ? (
                                    <><ChevronUp className="w-3 h-3 mr-1" /> Hide</>
                                  ) : (
                                    <><ChevronDown className="w-3 h-3 mr-1" /> View</>
                                  )}
                                </Button>
                              </TableCell>
                            </TableRow>
                            {expandedRow === r.id && (
                              <TableRow className="bg-secondary/5 hover:bg-secondary/5">
                                <TableCell colSpan={6} className="p-0">
                                  <div className="px-6 py-4 border-t border-border/30">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                                      Returned Products
                                    </p>
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="border-none hover:bg-transparent">
                                          <TableHead className="font-bold uppercase text-[10px] tracking-widest py-2 pl-0">Product</TableHead>
                                          <TableHead className="font-bold uppercase text-[10px] tracking-widest py-2">Qty</TableHead>
                                          <TableHead className="font-bold uppercase text-[10px] tracking-widest py-2">Sale Price</TableHead>
                                          <TableHead className="font-bold uppercase text-[10px] tracking-widest py-2 text-right">Subtotal</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {r.items.map((item, i) => (
                                          <TableRow key={i} className="border-border/20 hover:bg-secondary/10">
                                            <TableCell className="py-2 pl-0">
                                              <div className="flex items-center gap-2">
                                                <Package className="w-3 h-3 text-muted-foreground" />
                                                <span className="font-medium text-sm">{item.productName}</span>
                                              </div>
                                            </TableCell>
                                            <TableCell className="py-2 font-bold">{item.quantity}</TableCell>
                                            <TableCell className="py-2">₹{item.salePrice.toLocaleString()}</TableCell>
                                            <TableCell className="py-2 text-right font-bold text-accent">
                                              ₹{(item.quantity * item.salePrice).toLocaleString()}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                        <TableRow className="border-t border-border/50 hover:bg-transparent">
                                          <TableCell colSpan={3} className="py-3 pl-0 text-right font-bold uppercase text-[10px] tracking-widest text-muted-foreground">
                                            Total Refund
                                          </TableCell>
                                          <TableCell className="py-3 text-right font-bold text-lg text-accent">
                                            ₹{r.totalAmount.toLocaleString()}
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
                                <RotateCcw className="w-10 h-10" />
                                <p className="font-medium">No returns found.</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}