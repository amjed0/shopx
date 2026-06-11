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
  Loader2
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

  const handleCompleteSale = async () => {
    if (billItems.length === 0 || !user?.uid) return

    const saleData = {
      date: new Date().toISOString(),
      customerId: selectedCustomer?.id || "walk-in",
      customerName: selectedCustomer?.name || "Walk-in Customer",
      total: subtotal,
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
          body: JSON.stringify({ outstandingBalance: selectedCustomer.outstandingBalance + subtotal }),
        })
      }

      setBillItems([])
      setSelectedCustomer(null)
      toast({ title: "Sale Confirmed ✓", description: "Transaction completed successfully." })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Sale Failed", description: err.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <h1 className="text-3xl font-headline font-bold flex items-center gap-3">
          <FileText className="text-primary" /> Billing Terminal
        </h1>

        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle className="text-lg">Customer Selection</CardTitle>
            {!selectedCustomer && (
              <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-full">
                    <UserPlus className="w-4 h-4 mr-2" /> New Customer
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
                <Input placeholder="Search existing customer by name or phone..." className="pl-9 bg-secondary/30 border-none rounded-xl" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
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
              </div>
            ) : (
              <div className="flex justify-between items-center p-4 bg-primary/10 rounded-xl border border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    {selectedCustomer.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{selectedCustomer.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedCustomer.phone}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-xs text-primary hover:bg-primary/10" onClick={() => setSelectedCustomer(null)}>Change Customer</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search inventory by name or SKU..." className="pl-9 bg-secondary/30 border-none rounded-xl h-11" value={productSearch} onChange={e => setProductSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 max-h-[500px] overflow-y-auto">
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

      <div className="space-y-6">
        <Card className="h-fit sticky top-24 border-none shadow-xl bg-card/50 backdrop-blur-sm">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-xl font-headline flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              Review Invoice
              {billItems.length > 0 && <Badge className="ml-2">{billItems.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
              {billItems.map(item => (
                <div key={item.product.id} className="flex justify-between items-center group">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold truncate max-w-[150px]">{item.product.name}</p>
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

            <Separator className="bg-border/50" />

            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Items Subtotal</span>
                <span>₹{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-2xl font-bold text-foreground">
                <span>Grand Total</span>
                <span className="text-primary">₹{subtotal.toLocaleString()}</span>
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
            </div>

            <Button
              className="w-full h-14 bg-accent text-accent-foreground font-bold text-lg rounded-2xl shadow-xl shadow-accent/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
              onClick={handleCompleteSale}
              disabled={billItems.length === 0 || isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Processing...</>
              ) : (
                <><CheckCircle2 className="w-5 h-5 mr-2" /> Complete Sale</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
