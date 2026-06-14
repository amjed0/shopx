"use client"

import * as React from "react"
import { 
  Truck, 
  Search, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  Loader2, 
  Package, 
  Calculator,
  Save,
  CheckCircle2,
  PlusCircle,
  RefreshCw,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useUser } from "@/app/auth/use-user"

interface Supplier {
  id: string
  _id?: string
  name: string
  contactPerson: string
  phone: string
  email: string
  address: string
}

interface Product {
  id: string
  name: string
  sku: string
  purchasePrice: number
  sellingPrice: number
  stock: number
  minStock: number
  category: string
}

interface PurchaseItem {
  productId: string
  productName: string
  sku: string
  quantity: number
  purchasePrice: number
}

export default function NewPurchasePage() {
  const router = useRouter()
  const { user } = useUser()

  const [suppliers, setSuppliers] = React.useState<Supplier[]>([])
  const [products, setProducts] = React.useState<Product[]>([])
  const [selectedSupplier, setSelectedSupplier] = React.useState<Supplier | null>(null)
  const [supplierSearch, setSupplierSearch] = React.useState("")
  const [productSearch, setProductSearch] = React.useState("")
  const [purchaseItems, setPurchaseItems] = React.useState<PurchaseItem[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [loadingData, setLoadingData] = React.useState(true)

  const [isAddProductOpen, setIsAddProductOpen] = React.useState(false)
  const [isNewCategoryMode, setIsNewCategoryMode] = React.useState(false)
  const [selectedCategory, setSelectedCategory] = React.useState("")
  const [newCategoryNameInput, setNewCategoryNameInput] = React.useState("")
  const [isCreatingProduct, setIsCreatingProduct] = React.useState(false)
  const [quickSelectSearch, setQuickSelectSearch] = React.useState("")

  const generateSKU = () => `SX-${Math.floor(1000 + Math.random() * 9000)}`

  const [newProductForm, setNewProductForm] = React.useState({
    name: "",
    sku: generateSKU(),
    purchasePrice: "",
    sellingPrice: "",
    stock: "0",
    minStock: "5"
  })

  React.useEffect(() => {
    if (!user?.uid) return
    const headers = { "x-user-id": user.uid }
    const fetchAll = async () => {
      try {
        setLoadingData(true)
        const [suppliersRes, productsRes] = await Promise.all([
          fetch("/api/suppliers", { headers, credentials: "include" }),
          fetch("/api/products", { headers, credentials: "include" }),
        ])
        if (suppliersRes.ok) setSuppliers(await suppliersRes.json())
        if (productsRes.ok) setProducts(await productsRes.json())
      } catch (err) {
        console.error(err)
        toast({ variant: "destructive", title: "Failed to load data" })
      } finally {
        setLoadingData(false)
      }
    }
    fetchAll()
  }, [user?.uid])

  const categories = React.useMemo(() =>
    Array.from(new Set(products.map(p => p.category))).sort(),
  [products])

  const quickSelectProducts = React.useMemo(() => {
    const q = quickSelectSearch.toLowerCase()
    if (!q) return []
    return products.filter(p =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    ).slice(0, 5)
  }, [products, quickSelectSearch])

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase())
  )

  const filteredProducts = products.filter(p =>
    !purchaseItems.find(item => item.productId === p.id) &&
    (p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
     p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  )

  const addItem = (product: { id: string; name: string; sku: string; purchasePrice: number }) => {
    setPurchaseItems(prev => [
      ...prev,
      { productId: product.id, productName: product.name, sku: product.sku, quantity: 1, purchasePrice: product.purchasePrice }
    ])
    setProductSearch("")
  }

  const removeItem = (id: string) =>
    setPurchaseItems(prev => prev.filter(i => i.productId !== id))

  const updateItem = (id: string, field: keyof PurchaseItem, value: any) =>
    setPurchaseItems(prev => prev.map(i => i.productId === id ? { ...i, [field]: value } : i))

  const handleQuickSelect = (product: Product) => {
    addItem(product)
    setQuickSelectSearch("")
    setIsAddProductOpen(false)
  }

  const handleCreateNewProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.uid) return
    const category = isNewCategoryMode ? newCategoryNameInput : selectedCategory
    if (!category) {
      toast({ variant: "destructive", title: "Missing Category" })
      return
    }
    setIsCreatingProduct(true)
    const productData = {
      name: newProductForm.name,
      sku: newProductForm.sku,
      category,
      purchasePrice: Number(newProductForm.purchasePrice),
      sellingPrice: Number(newProductForm.sellingPrice),
      stock: Number(newProductForm.stock),
      minStock: Number(newProductForm.minStock),
    }
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.uid },
        credentials: "include",
        body: JSON.stringify(productData),
      })
      if (!res.ok) throw new Error("Failed to create product")
      const newProduct = await res.json()
      setProducts(prev => [newProduct, ...prev])
      toast({ title: "Product Initialized", description: `${productData.name} ready for purchase.` })
      addItem(newProduct)
      setIsAddProductOpen(false)
      setNewProductForm({ name: "", sku: generateSKU(), purchasePrice: "", sellingPrice: "", stock: "0", minStock: "5" })
      setSelectedCategory("")
      setNewCategoryNameInput("")
      setIsNewCategoryMode(false)
      setQuickSelectSearch("")
    } catch (err) {
      console.error(err)
      toast({ variant: "destructive", title: "Failed to create product" })
    } finally {
      setIsCreatingProduct(false)
    }
  }

  const total = purchaseItems.reduce((acc, i) => acc + i.quantity * i.purchasePrice, 0)

  const handleComplete = async () => {
    if (!selectedSupplier || purchaseItems.length === 0 || !user?.uid) return
    setIsSubmitting(true)
    try {
      const updateRequests = purchaseItems.map(async (item) => {
        const existingProduct = products.find(p => p.id === item.productId)
        if (!existingProduct) throw new Error(`Product not found: ${item.productName}`)
        const supplierId = (selectedSupplier as any)._id || selectedSupplier.id

        const res = await fetch(`/api/products/${item.productId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-user-id": user.uid },
          credentials: "include",
          body: JSON.stringify({
            stock: Number(existingProduct.stock) + Number(item.quantity),
            purchasePrice: Number(item.purchasePrice),
          }),
        })
        if (!res.ok) throw new Error(`Failed updating ${item.productName}`)

        const purchaseRes = await fetch("/api/purchases", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": user.uid },
          credentials: "include",
          body: JSON.stringify({
            supplierId,
            productId: item.productId,
            productName: item.productName,
            quantity: Number(item.quantity),
            purchasePrice: Number(item.purchasePrice),
          }),
        })
        if (!purchaseRes.ok) {
          const err = await purchaseRes.text()
          console.error("Purchase save failed:", err)
        }
        return res.json()
      })

      await Promise.all(updateRequests)
      toast({ title: "Purchase Completed", description: `Successfully updated ${purchaseItems.length} products.` })
      router.push("/purchases/purchase-entry")
    } catch (err: any) {
      console.error("UPDATE ERROR:", err)
      toast({ variant: "destructive", title: "Operation Failed", description: err.message })
    } finally {
      setIsSubmitting(false)
    }
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
              Inward <span className="text-accent">Bulk Terminal</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Sheet interface for high-speed stock procurement.</p>
          </div>
        </div>
        <div className="flex gap-2 ml-11 sm:ml-0 shrink-0">
          <Button
            variant="outline"
            className="rounded-xl font-bold uppercase tracking-wider text-[10px] h-8 sm:h-9"
            onClick={() => setPurchaseItems([])}
            disabled={purchaseItems.length === 0}
          >
            Clear
          </Button>
          <Button
            onClick={handleComplete}
            className="bg-accent text-accent-foreground font-bold px-4 sm:px-8 rounded-xl shadow-lg shadow-accent/20 h-8 sm:h-9 text-xs sm:text-sm"
            disabled={purchaseItems.length === 0 || !selectedSupplier || isSubmitting}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Commit Entry
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">

        {/* ── LEFT PANEL ── */}
        <div className="lg:col-span-1 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">

          {/* Supplier Selector */}
          <Card className="border-none bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Truck className="w-4 h-4" /> Supplier
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedSupplier ? (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search vendor..."
                    className="pl-9 h-9 bg-secondary/30 border-none text-xs rounded-lg"
                    value={supplierSearch}
                    onChange={e => setSupplierSearch(e.target.value)}
                  />
                  {supplierSearch && filteredSuppliers.length > 0 && (
                    <div className="absolute top-full w-full bg-card border rounded-lg mt-2 z-50 shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                      {filteredSuppliers.map(s => (
                        <button
                          key={s.id}
                          className="w-full p-2.5 text-left hover:bg-secondary flex flex-col"
                          onClick={() => { setSelectedSupplier(s); setSupplierSearch("") }}
                        >
                          <span className="font-bold text-xs">{s.name}</span>
                          <span className="text-[10px] text-muted-foreground">{s.contactPerson}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-accent/10 rounded-lg border border-accent/20 group">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{selectedSupplier.name}</p>
                      <p className="text-[10px] text-muted-foreground">{selectedSupplier.phone}</p>
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="h-6 w-6 text-destructive/50 hover:text-destructive shrink-0"
                      onClick={() => setSelectedSupplier(null)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product Fast Add */}
          <Card className="border-none bg-card shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Plus className="w-4 h-4" /> Fast Add
              </CardTitle>
              <Dialog open={isAddProductOpen} onOpenChange={(open) => {
                setIsAddProductOpen(open)
                if (!open) setQuickSelectSearch("")
              }}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold text-accent uppercase tracking-widest hover:bg-accent/10">
                    <PlusCircle className="w-3 h-3 mr-1" /> New
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                  <form onSubmit={handleCreateNewProduct}>
                    <DialogHeader>
                      <DialogTitle className="text-xl font-bold">New Product Entry</DialogTitle>
                    </DialogHeader>

                    <div className="mt-4 mb-5 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Quick Select Existing</p>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search for common items..."
                          className="pl-10 h-11 bg-secondary/30 border border-primary/30 rounded-xl focus:border-primary"
                          value={quickSelectSearch}
                          onChange={e => setQuickSelectSearch(e.target.value)}
                        />
                      </div>
                      {quickSelectProducts.length > 0 && (
                        <div className="rounded-xl border border-border/50 overflow-hidden">
                          {quickSelectProducts.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              className="w-full p-2.5 text-left hover:bg-secondary/50 flex justify-between items-center border-b border-border/30 last:border-0 transition-colors"
                              onClick={() => handleQuickSelect(p)}
                            >
                              <div className="min-w-0">
                                <p className="font-bold text-xs truncate">{p.name}</p>
                                <p className="text-[10px] text-muted-foreground font-code">{p.sku}</p>
                              </div>
                              <Badge variant="outline" className="text-[9px] font-code shrink-0 ml-2">₹{p.purchasePrice}</Badge>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="h-px bg-border/50 mb-5" />

                    <div className="grid gap-4">
                      <div className="grid grid-cols-4 items-center gap-3">
                        <Label className="text-right font-semibold text-sm">Name</Label>
                        <Input
                          className="col-span-3 h-10 bg-secondary/20 border-none rounded-lg"
                          value={newProductForm.name}
                          onChange={e => setNewProductForm({ ...newProductForm, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-3">
                        <Label className="text-right font-semibold text-sm">SKU</Label>
                        <div className="col-span-3 flex gap-2">
                          <Input
                            className="h-10 bg-secondary/20 border-none rounded-lg flex-1"
                            value={newProductForm.sku}
                            onChange={e => setNewProductForm({ ...newProductForm, sku: e.target.value })}
                            required
                          />
                          <Button
                            type="button" variant="outline" size="icon"
                            className="h-10 w-10 rounded-lg border-border/50 shrink-0"
                            onClick={() => setNewProductForm({ ...newProductForm, sku: generateSKU() })}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-3">
                        <Label className="text-right font-semibold text-sm">Category</Label>
                        <div className="col-span-3 flex gap-2">
                          {isNewCategoryMode ? (
                            <Input
                              placeholder="Category name"
                              className="h-10 bg-secondary/20 border-none rounded-lg flex-1"
                              value={newCategoryNameInput}
                              onChange={e => setNewCategoryNameInput(e.target.value)}
                              required
                            />
                          ) : (
                            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                              <SelectTrigger className="h-10 bg-secondary/20 border-none rounded-lg flex-1">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                          <Button
                            type="button" variant="outline" size="icon"
                            className="h-10 w-10 rounded-lg border-border/50 shrink-0"
                            onClick={() => setIsNewCategoryMode(!isNewCategoryMode)}
                          >
                            {isNewCategoryMode ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-1">
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Purchase ₹</p>
                          <Input
                            type="number" placeholder="Cost"
                            className="h-11 bg-secondary/20 border-none rounded-xl"
                            value={newProductForm.purchasePrice}
                            onChange={e => setNewProductForm({ ...newProductForm, purchasePrice: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Selling ₹</p>
                          <Input
                            type="number" placeholder="Price"
                            className="h-11 bg-secondary/20 border-none rounded-xl"
                            value={newProductForm.sellingPrice}
                            onChange={e => setNewProductForm({ ...newProductForm, sellingPrice: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Stock QTY</p>
                          <Input
                            type="number" placeholder="Stock"
                            className="h-11 bg-secondary/20 border-none rounded-xl"
                            value={newProductForm.stock}
                            onChange={e => setNewProductForm({ ...newProductForm, stock: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Alert Level</p>
                          <Input
                            type="number" placeholder="Min"
                            className="h-11 bg-secondary/20 border-none rounded-xl"
                            value={newProductForm.minStock}
                            onChange={e => setNewProductForm({ ...newProductForm, minStock: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    <DialogFooter className="mt-6">
                      <Button
                        type="submit" disabled={isCreatingProduct}
                        className="w-full h-12 rounded-full bg-primary text-primary-foreground font-bold text-base shadow-lg shadow-primary/20"
                      >
                        {isCreatingProduct && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Initialize Product
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Find existing product..."
                  className="pl-9 h-9 bg-secondary/30 border-none text-xs rounded-lg"
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                />
              </div>
              {loadingData ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-accent opacity-50" />
                </div>
              ) : (
                <div className="space-y-1 max-h-[280px] lg:max-h-[350px] overflow-y-auto pr-1">
                  {filteredProducts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => addItem(p)}
                      className="w-full p-2 rounded-lg border border-transparent hover:border-accent/30 hover:bg-accent/5 flex justify-between items-center group transition-all"
                    >
                      <div className="text-left min-w-0">
                        <p className="font-bold text-[11px] group-hover:text-accent truncate max-w-[140px]">{p.name}</p>
                        <p className="text-[9px] text-muted-foreground font-code">{p.sku}</p>
                      </div>
                      <Badge variant="outline" className="text-[8px] h-4 px-1 py-0 opacity-50 font-code shrink-0">{p.stock}</Badge>
                    </button>
                  ))}
                  {productSearch && filteredProducts.length === 0 && (
                    <p className="text-[10px] text-center py-4 text-muted-foreground italic">No products matched</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT PANEL: Acquisition Sheet ── */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-none bg-card shadow-xl overflow-hidden min-h-[300px]">
            <CardHeader className="bg-secondary/20 border-b border-border/50 py-3 md:py-4 flex flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <Calculator className="w-4 h-4 md:w-5 md:h-5 text-accent shrink-0" />
                <div className="min-w-0">
                  <CardTitle className="text-base md:text-lg">Acquisition Sheet</CardTitle>
                  <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground hidden sm:block">
                    Excel-style bulk editor
                  </CardDescription>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Sheet Total</p>
                <p className="text-xl md:text-3xl font-code font-bold text-accent">₹{total.toLocaleString()}</p>
              </div>
            </CardHeader>

            <CardContent className="p-0">

              {/* ── MOBILE: card-based item list ── */}
              <div className="block md:hidden">
                {purchaseItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 opacity-30 gap-3">
                    <Package className="w-10 h-10" />
                    <p className="text-sm font-bold">Terminal Empty</p>
                    <p className="text-xs text-center px-6">Select existing products or create new ones.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {purchaseItems.map((item, index) => (
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
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Cost (₹)</p>
                            <Input
                              type="number"
                              className="h-8 text-xs bg-secondary/20 border-none font-bold text-right"
                              value={item.purchasePrice}
                              onChange={e => updateItem(item.productId, "purchasePrice", Number(e.target.value))}
                            />
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Subtotal</span>
                          <span className="font-code font-bold text-foreground">
                            ₹{(item.quantity * item.purchasePrice).toLocaleString()}
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
                      <TableHead className="w-12 text-center text-[10px] font-bold uppercase py-3">#</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase py-3">Item Name</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase py-3">SKU Code</TableHead>
                      <TableHead className="w-[120px] text-[10px] font-bold uppercase py-3">Qty</TableHead>
                      <TableHead className="w-[150px] text-[10px] font-bold uppercase py-3">Cost (₹)</TableHead>
                      <TableHead className="w-[150px] text-right text-[10px] font-bold uppercase py-3">Subtotal (₹)</TableHead>
                      <TableHead className="w-12 py-3" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseItems.map((item, index) => (
                      <TableRow key={item.productId} className="border-border/30 group hover:bg-secondary/5">
                        <TableCell className="text-center font-code text-xs text-muted-foreground">{index + 1}</TableCell>
                        <TableCell><p className="font-bold text-sm">{item.productName}</p></TableCell>
                        <TableCell className="font-code text-[11px] opacity-70">{item.sku}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="h-8 text-xs bg-secondary/20 border-none font-bold text-center"
                            value={item.quantity}
                            onChange={e => updateItem(item.productId, "quantity", Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="h-8 text-xs bg-secondary/20 border-none font-bold text-right"
                            value={item.purchasePrice}
                            onChange={e => updateItem(item.productId, "purchasePrice", Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell className="text-right font-code font-bold text-foreground">
                          {(item.quantity * item.purchasePrice).toLocaleString()}
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
                    {purchaseItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="h-72 text-center">
                          <div className="flex flex-col items-center justify-center opacity-30 gap-3">
                            <Package className="w-12 h-12" />
                            <div className="space-y-1">
                              <p className="text-sm font-bold">Terminal Empty</p>
                              <p className="text-xs">Select existing products or create new ones.</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>

            {purchaseItems.length > 0 && (
              <CardContent className="bg-secondary/10 border-t border-border/50 py-3 px-4 md:px-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <span>Inward Readiness Verified</span>
                  <span className="flex items-center gap-1.5 text-accent">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Commit Available
                  </span>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}