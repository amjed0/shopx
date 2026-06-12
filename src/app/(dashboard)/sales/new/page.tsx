"use client"

import * as React from "react"
import {
  Search,
  Plus,
  Trash2,
  CreditCard,
  Wallet,
  Banknote,
  History,
  CheckCircle2,
  FileText,
  ShoppingCart,
  Zap,
  UserPlus,
  Loader2,
  Percent
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/hooks/use-toast"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useUser } from "@/app/auth/use-user"
import { Product } from "../../inventory/page"

interface Customer {
  id: string
  name: string
  phone: string
  email?: string
  outstandingBalance: number
}

interface BillItem {
  product: Product
  quantity: number
}

export default function NewBillPage() {
  const { user } = useUser()
  const [customerSearch, setCustomerSearch] = React.useState("")
  const [productSearch, setProductSearch] = React.useState("")
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null)
  const [billItems, setBillItems] = React.useState<BillItem[]>([])
  const [paymentMethod, setPaymentMethod] = React.useState<string>("upi")
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isAddingCustomer, setIsAddingCustomer] = React.useState(false)

  // Discount state - either flat amount (₹) or percentage
  const [discountType, setDiscountType] = React.useState<"flat" | "percent">("flat")
  const [discountValue, setDiscountValue] = React.useState<number>(0)

  const [products, setProducts] = React.useState<Product[]>([])
  const [customers, setCustomers] = React.useState<Customer[]>([])

  // Fetch products and customers from MongoDB API
  React.useEffect(() => {
    if (!user?.uid) return

    fetch("/api/products", { headers: { "x-user-id": user.uid } })
      .then(res => res.ok ? res.json() : [])
      .then((data: Product[]) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]))

    fetch("/api/customers", { headers: { "x-user-id": user.uid } })
      .then(res => res.ok ? res.json() : [])
      .then((data: Customer[]) => setCustomers(Array.isArray(data) ? data : []))
      .catch(() => setCustomers([]))
  }, [user?.uid])

  const filteredCustomers = customerSearch.length > 0
    ? customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch))
    : []

  const displayProducts = productSearch.length > 0
    ? products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase()))
    : products

  const addItem = (product: Product) => {
    const existing = billItems.find(item => item.product.id === product.id)
    if (existing) {
      setBillItems(billItems.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
    } else {
      setBillItems([...billItems, { product, quantity: 1 }])
    }
    toast({ title: "Added", description: product.name })
  }

  const removeItem = (productId: string) => setBillItems(billItems.filter(item => item.product.id !== productId))

  const updateQuantity = (productId: string, delta: number) => {
    setBillItems(billItems.map(item => item.product.id === productId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item))
  }

  const handleAddCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user?.uid) return
    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const phone = formData.get("phone") as string
    const email = formData.get("email") as string

    if (!name || !phone) {
      toast({ variant: "destructive", title: "Required Fields", description: "Name and Phone are mandatory." })
      return
    }

    const custData = { name, phone, email: email || "", outstandingBalance: 0 }

    try {
      setIsAddingCustomer(true)
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.uid },
        body: JSON.stringify(custData),
      })
      if (!res.ok) throw new Error("Failed to add customer")
      const newCustomer = await res.json()
      setCustomers(prev => [...prev, newCustomer])
      setSelectedCustomer(newCustomer)
      setIsCustomerDialogOpen(false)
      toast({ title: "Customer Registered", description: `${name} is now selected.` })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setIsAddingCustomer(false)
    }
  }

  const subtotal = billItems.reduce((acc, item) => acc + (item.product.sellingPrice * item.quantity), 0)

  // Compute discount amount based on type, clamped so it never exceeds the subtotal
  const discountAmount = React.useMemo(() => {
    if (!discountValue || discountValue <= 0) return 0
    const raw = discountType === "percent"
      ? (subtotal * discountValue) / 100
      : discountValue
    return Math.min(Math.max(raw, 0), subtotal)
  }, [discountType, discountValue, subtotal])

  const grandTotal = Math.max(subtotal - discountAmount, 0)

  const handleCompleteSale = async () => {
    if (billItems.length === 0 || !user?.uid) return

    // Shop Credit sales must have a registered customer attached
    if (paymentMethod === "credit" && !selectedCustomer) {
      toast({
        variant: "destructive",
        title: "Customer Required",
        description: "Please select or register a customer before billing on Shop Credit."
      })
      return
    }

    const saleData = {
      date: new Date().toISOString(),
      customerId: selectedCustomer?.id || "walk-in",
      customerName: selectedCustomer?.name || "Walk-in Customer",
      subtotal,
      discount: discountAmount,
      total: grandTotal,
      status: paymentMethod === "credit" ? "pending" : "paid",
      paymentMethod,
      items: billItems.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        price: item.product.sellingPrice,
      })),
    }

    try {
      setIsSubmitting(true)

      // Step 1: Create the sale record
      const saleRes = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.uid },
        body: JSON.stringify(saleData),
      })
      if (!saleRes.ok) throw new Error("Failed to save sale")

      // Step 2: Update stock for each product
      await Promise.all(
        billItems.map(item =>
          fetch(`/api/products/${item.product.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-user-id": user.uid },
            body: JSON.stringify({ stock: item.product.stock - item.quantity }),
          })
        )
      )

      // Step 3: Update customer balance if credit
      if (paymentMethod === "credit" && selectedCustomer) {
        await fetch(`/api/customers/${selectedCustomer.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-user-id": user.uid },
          body: JSON.stringify({ outstandingBalance: selectedCustomer.outstandingBalance + grandTotal }),
        })
      }

      setBillItems([])
      setSelectedCustomer(null)
      setDiscountValue(0)
      toast({ title: "Sale Confirmed ✓", description: "Transaction completed successfully." })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Sale Failed", description: err.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isCreditMissingCustomer = paymentMethod === "credit" && !selectedCustomer

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-bold flex items-center gap-3">
        <FileText className="text-primary" /> Billing Terminal
      </h1>

      {/* Top row: small customer selection box (left) + larger product search box (right) */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Customer Selection - small square */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle className="text-lg">Customer</CardTitle>
            {!selectedCustomer && (
              <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-full">
                    <UserPlus className="w-4 h-4 mr-2" /> New
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleAddCustomer}>
                    <DialogHeader>
                      <DialogTitle>Register New Customer</DialogTitle>
                      <DialogDescription>Add a customer to your network for tracking balances and sales.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-6">
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input name="name" placeholder="Enter customer name" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <Input name="phone" placeholder="Enter mobile number" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Email (Optional)</Label>
                        <Input name="email" placeholder="customer@email.com" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" className="w-full" disabled={isAddingCustomer}>
                        {isAddingCustomer && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Create & Select Profile
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
            {!selectedCustomer ? (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by name or phone..." className="pl-9 bg-secondary/30 border-none rounded-xl" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
                {customerSearch && filteredCustomers.length > 0 && (
                  <div className="absolute top-full w-full bg-card border rounded-xl mt-2 z-50 shadow-xl overflow-hidden">
                    {filteredCustomers.map(c => (
                      <button key={c.id} className="w-full p-3 text-left hover:bg-secondary text-sm flex items-center gap-3" onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); }}>
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground">{c.phone}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {paymentMethod === "credit" && (
                  <p className="text-[10px] text-destructive mt-2 font-bold">
                    A customer must be selected for Shop Credit sales.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex justify-between items-center p-3 bg-primary/10 rounded-xl border border-primary/20">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    {selectedCustomer.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{selectedCustomer.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedCustomer.phone}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-xs text-primary hover:bg-primary/10 shrink-0" onClick={() => setSelectedCustomer(null)}>Change</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Search - larger square */}
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader className="pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search inventory by name or SKU..." className="pl-9 bg-secondary/30 border-none rounded-xl h-11" value={productSearch} onChange={e => setProductSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 max-h-[320px] overflow-y-auto">
            {displayProducts.map(p => (
              <div key={p.id} className="p-4 border border-border/50 rounded-xl hover:bg-secondary/50 cursor-pointer transition-colors group" onClick={() => addItem(p)}>
                <div className="flex justify-between items-start mb-1">
                  <p className="font-bold text-sm group-hover:text-primary transition-colors">{p.name}</p>
                  <Badge variant="outline" className="text-[9px] font-code opacity-60 uppercase">{p.sku}</Badge>
                </div>
                <div className="flex justify-between items-end">
                  <p className="text-accent font-bold text-lg">₹{p.sellingPrice.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">In Stock: <span className={p.stock <= p.minStock ? 'text-destructive font-bold' : ''}>{p.stock}</span></p>
                </div>
              </div>
            ))}
            {displayProducts.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground text-sm italic">
                No products found. Add some in Inventory.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: full-width Review Invoice */}
      <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
        <CardHeader className="border-b border-border/50 flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-headline flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Review Invoice
            {billItems.length > 0 && <Badge className="ml-2">{billItems.length}</Badge>}
          </CardTitle>
          <Button
            className="h-11 px-6 bg-accent text-accent-foreground font-bold rounded-2xl shadow-lg shadow-accent/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
            onClick={handleCompleteSale}
            disabled={billItems.length === 0 || isSubmitting || isCreditMissingCustomer}
          >
            {isSubmitting ? (
              <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Processing...</>
            ) : (
              <><CheckCircle2 className="w-5 h-5 mr-2" /> Complete Sale</>
            )}
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Cart items */}
            <div className="lg:col-span-2 space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {billItems.map(item => (
                <div key={item.product.id} className="flex justify-between items-center group">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold truncate max-w-[220px]">{item.product.name}</p>
                    <p className="text-[10px] text-muted-foreground">₹{item.product.sellingPrice.toLocaleString()} per unit</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-secondary/50 rounded-lg p-0.5 border border-border/30">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-background" onClick={() => updateQuantity(item.product.id, -1)}>-</Button>
                      <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-background" onClick={() => updateQuantity(item.product.id, 1)}>+</Button>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/50 hover:text-destructive hover:bg-destructive/10 rounded-md" onClick={() => removeItem(item.product.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {billItems.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-xs text-muted-foreground">Your cart is empty.</p>
                </div>
              )}
            </div>

            {/* Totals, discount & payment */}
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Items Subtotal</span>
                  <span>₹{subtotal.toLocaleString()}</span>
                </div>

                {/* Discount input */}
                <div className="flex items-center justify-between gap-2 text-sm">
                  <Label className="text-muted-foreground shrink-0">Discount</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      value={discountValue || ""}
                      onChange={e => setDiscountValue(Math.max(0, Number(e.target.value) || 0))}
                      placeholder="0"
                      className="h-8 w-20 text-right bg-secondary/30 border-none rounded-lg"
                    />
                    <div className="flex items-center bg-secondary/50 rounded-lg p-0.5 border border-border/30">
                      <Button
                        type="button"
                        variant={discountType === "flat" ? "default" : "ghost"}
                        size="icon"
                        className="h-8 w-8 rounded-md"
                        onClick={() => setDiscountType("flat")}
                        title="Flat amount (₹)"
                      >
                        ₹
                      </Button>
                      <Button
                        type="button"
                        variant={discountType === "percent" ? "default" : "ghost"}
                        size="icon"
                        className="h-8 w-8 rounded-md"
                        onClick={() => setDiscountType("percent")}
                        title="Percentage (%)"
                      >
                        <Percent className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Discount Applied</span>
                    <span>- ₹{discountAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                )}

                <Separator className="bg-border/50 my-2" />

                <div className="flex justify-between text-2xl font-bold text-foreground">
                  <span>Grand Total</span>
                  <span className="text-primary">₹{grandTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Settlement Method</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'upi', label: 'UPI/Scan', icon: Zap },
                    { id: 'cash', label: 'Cash', icon: Banknote },
                    { id: 'card', label: 'Debit/Credit', icon: CreditCard },
                    { id: 'credit', label: 'Shop Credit', icon: History }
                  ].map(m => (
                    <Button
                      key={m.id}
                      variant={paymentMethod === m.id ? "default" : "outline"}
                      className={cn(
                        "h-12 justify-start gap-2 rounded-xl transition-all",
                        paymentMethod === m.id ? "bg-primary shadow-lg shadow-primary/20 scale-[1.02]" : "hover:bg-secondary/50"
                      )}
                      onClick={() => setPaymentMethod(m.id)}
                    >
                      <m.icon className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase">{m.label}</span>
                    </Button>
                  ))}
                </div>
                {isCreditMissingCustomer && (
                  <p className="text-[10px] text-destructive font-bold">
                    Select or register a customer above to use Shop Credit.
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}