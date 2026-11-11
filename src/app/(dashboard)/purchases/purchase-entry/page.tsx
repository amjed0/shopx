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
  X,
  Calendar,
  CreditCard,
  Building2,
  Phone,
  Mail,
  MapPin,
  UserCheck
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
import { InvoiceScanner, ScanResult } from "@/components/purchases/invoice-scanner"

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
  quantity: number | string
  purchasePrice: number | string
  sellingPrice: number | string    // MRP
  category: string
  minStock: number | string        // Alert Level
  isNewProduct?: boolean
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

  // Billing Date & Payment (Credit)
  const [billingDate, setBillingDate] = React.useState<string>(() => new Date().toISOString().split("T")[0])
  const [paidAmount, setPaidAmount] = React.useState<string>("")
  const [paymentMode, setPaymentMode] = React.useState<string>("Cash")

  // Fast Add Product Dialog State
  const [isAddProductOpen, setIsAddProductOpen] = React.useState(false)
  const [isNewCategoryMode, setIsNewCategoryMode] = React.useState(false)
  const [selectedCategory, setSelectedCategory] = React.useState("")
  const [newCategoryNameInput, setNewCategoryNameInput] = React.useState("")
  const [isCreatingProduct, setIsCreatingProduct] = React.useState(false)
  const [quickSelectSearch, setQuickSelectSearch] = React.useState("")

  // Inline Category Creator for Table
  const [inlineNewCategoryOpen, setInlineNewCategoryOpen] = React.useState(false)
  const [inlineNewCategoryItemIndex, setInlineNewCategoryItemIndex] = React.useState<number | null>(null)
  const [inlineCategoryInput, setInlineCategoryInput] = React.useState("")
  const [customCategories, setCustomCategories] = React.useState<string[]>([])

  // Scanned Supplier Confirmation Dialog
  const [scannedSupplierOpen, setScannedSupplierOpen] = React.useState(false)
  const [scannedSupplierForm, setScannedSupplierForm] = React.useState({
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
  })
  const [isSavingSupplier, setIsSavingSupplier] = React.useState(false)

  const generateSKU = () => `SX-${Math.floor(1000 + Math.random() * 9000)}`

  const [newProductForm, setNewProductForm] = React.useState({
    name: "",
    sku: generateSKU(),
    purchasePrice: "",
    sellingPrice: "",
    stock: "0",
    minStock: "2"
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

  const categories = React.useMemo(() => {
    const list = Array.from(new Set([...products.map(p => p.category), ...customCategories])).filter(Boolean).sort()
    return list.length > 0 ? list : ["General", "Retail", "Electronics", "Groceries", "Spare Parts"]
  }, [products, customCategories])

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

  const addItem = (product: {
    id: string
    name: string
    sku: string
    purchasePrice: number
    sellingPrice?: number
    category?: string
    minStock?: number
  }) => {
    setPurchaseItems(prev => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: 1,
        purchasePrice: product.purchasePrice || 0,
        sellingPrice: product.sellingPrice || Math.round((product.purchasePrice || 0) * 1.25),
        category: product.category || "General",
        minStock: product.minStock || 2,
        isNewProduct: false,
      }
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
      setNewProductForm({ name: "", sku: generateSKU(), purchasePrice: "", sellingPrice: "", stock: "0", minStock: "2" })
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

  // Handle scanned AI invoice result
  const handleScanComplete = async (result: ScanResult) => {
    if (!user?.uid) return

    // 1. If billing date was extracted, apply it
    if (result.invoiceDate) {
      setBillingDate(result.invoiceDate)
    }

    // 2. Supplier Matching / Registration Prompt
    if (result.supplierName && !selectedSupplier) {
      const match = suppliers.find(
        s => s.name.toLowerCase().includes(result.supplierName!.toLowerCase()) ||
             result.supplierName!.toLowerCase().includes(s.name.toLowerCase())
      )
      if (match) {
        setSelectedSupplier(match)
        toast({ title: "Supplier Matched", description: `Selected ${match.name}` })
      } else {
        // Prompt to register new supplier with extracted details
        setScannedSupplierForm({
          name: result.supplierName || "",
          contactPerson: result.supplierContactPerson || "",
          phone: result.supplierPhone || "",
          email: result.supplierEmail || "",
          address: result.supplierAddress || "",
        })
        setScannedSupplierOpen(true)
      }
    }

    // 3. Process scanned items
    const newItems: PurchaseItem[] = []

    for (const item of result.items) {
      // Check if product exists
      const existing = products.find(
        p => p.name.toLowerCase().trim() === item.name.toLowerCase().trim() ||
             p.name.toLowerCase().includes(item.name.toLowerCase()) ||
             item.name.toLowerCase().includes(p.name.toLowerCase())
      )

      if (existing) {
        newItems.push({
          productId: existing.id,
          productName: existing.name,
          sku: existing.sku,
          quantity: item.quantity,
          purchasePrice: item.purchasePrice || existing.purchasePrice,
          sellingPrice: item.sellingPrice || existing.sellingPrice || Math.round((item.purchasePrice || existing.purchasePrice) * 1.25),
          category: item.category || existing.category || "General",
          minStock: existing.minStock || 2,
          isNewProduct: false,
        })
      } else {
        // Will be registered as a new product in the sheet
        const tempSku = generateSKU()
        newItems.push({
          productId: `temp-${Math.random().toString(36).slice(2)}`,
          productName: item.name,
          sku: tempSku,
          quantity: item.quantity,
          purchasePrice: item.purchasePrice || 0,
          sellingPrice: item.sellingPrice || Math.round((item.purchasePrice || 0) * 1.25),
          category: item.category || "General",
          minStock: 2,
          isNewProduct: true,
        })
      }
    }

    if (newItems.length > 0) {
      setPurchaseItems(prev => {
        const merged = [...prev]
        for (const item of newItems) {
          const idx = merged.findIndex(m => m.productName.toLowerCase() === item.productName.toLowerCase())
          if (idx >= 0) {
            merged[idx] = {
              ...merged[idx],
              quantity: Number(merged[idx].quantity || 0) + Number(item.quantity || 1),
              purchasePrice: item.purchasePrice || merged[idx].purchasePrice,
              sellingPrice: item.sellingPrice || merged[idx].sellingPrice,
            }
          } else {
            merged.push(item)
          }
        }
        return merged
      })
      toast({
        title: "Products Extracted ✨",
        description: `Added ${newItems.length} product(s) to the acquisition sheet.`,
      })
    }
  }

  // Save new supplier from scanned prompt
  const handleSaveScannedSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.uid || !scannedSupplierForm.name.trim()) return

    setIsSavingSupplier(true)
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.uid },
        credentials: "include",
        body: JSON.stringify(scannedSupplierForm),
      })
      if (!res.ok) throw new Error("Failed to register supplier")
      const saved = await res.json()
      setSuppliers(prev => [saved, ...prev])
      setSelectedSupplier(saved)
      setScannedSupplierOpen(false)
      toast({ title: "Supplier Registered", description: `${saved.name} selected for this bill.` })
    } catch (err: any) {
      console.error(err)
      toast({ variant: "destructive", title: "Registration Failed", description: err.message })
    } finally {
      setIsSavingSupplier(false)
    }
  }

  // Inline category add
  const handleAddInlineCategory = () => {
    if (!inlineCategoryInput.trim()) return
    const cat = inlineCategoryInput.trim()
    setCustomCategories(prev => Array.from(new Set([...prev, cat])))
    if (inlineNewCategoryItemIndex !== null && purchaseItems[inlineNewCategoryItemIndex]) {
      const item = purchaseItems[inlineNewCategoryItemIndex]
      updateItem(item.productId, "category", cat)
    }
    setInlineCategoryInput("")
    setInlineNewCategoryOpen(false)
    setInlineNewCategoryItemIndex(null)
  }

  const total = purchaseItems.reduce((acc, i) => acc + (Number(i.quantity) || 0) * (Number(i.purchasePrice) || 0), 0)
  const numPaid = paidAmount === "" ? total : Number(paidAmount) || 0
  const balanceDue = Math.max(0, total - numPaid)
  const isCredit = balanceDue > 0

  // Commit purchase
  const handleComplete = async () => {
    if (!selectedSupplier || purchaseItems.length === 0 || !user?.uid) return
    setIsSubmitting(true)
    try {
      const supplierId = (selectedSupplier as any)._id || selectedSupplier.id

      // 1. Process each item: create new product if needed, then update stock/prices & save purchase
      for (const item of purchaseItems) {
        let finalProductId = item.productId

        // If product was temp/new or not found in DB, create it first
        const existing = products.find(p => p.id === item.productId || p.name.toLowerCase() === item.productName.toLowerCase())
        if (!existing || item.isNewProduct || item.productId.startsWith("temp-")) {
          const createRes = await fetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": user.uid },
            credentials: "include",
            body: JSON.stringify({
              name: item.productName,
              sku: item.sku || generateSKU(),
              category: item.category || "General",
              purchasePrice: Number(item.purchasePrice),
              sellingPrice: Number(item.sellingPrice),
              stock: Number(item.quantity),
              minStock: Number(item.minStock || 2),
              supplierId,
            }),
          })
          if (!createRes.ok) throw new Error(`Failed to create product ${item.productName}`)
          const created = await createRes.json()
          finalProductId = created.id || created._id
        } else {
          // Existing product: update stock, purchase price, selling price (MRP), category, minStock
          finalProductId = existing.id
          const patchRes = await fetch(`/api/products/${existing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-user-id": user.uid },
            credentials: "include",
            body: JSON.stringify({
              stock: Number(existing.stock || 0) + Number(item.quantity),
              purchasePrice: Number(item.purchasePrice),
              sellingPrice: Number(item.sellingPrice),
              category: item.category,
              minStock: Number(item.minStock),
            }),
          })
          if (!patchRes.ok) throw new Error(`Failed updating ${item.productName}`)
        }

        // Save Purchase Record (per product line item)
        const purchaseRes = await fetch("/api/purchases", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": user.uid },
          credentials: "include",
          body: JSON.stringify({
            supplierId,
            productId: finalProductId,
            productName: item.productName,
            quantity: Number(item.quantity),
            purchasePrice: Number(item.purchasePrice),
            billingDate,
          }),
        })
        if (!purchaseRes.ok) {
          console.error("Purchase save failed for", item.productName)
        }
      }

      // 2. If an upfront payment was made, record it to Supplier Payments & Cashbook
      if (numPaid > 0) {
        try {
          await fetch("/api/supplier-payments", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": user.uid },
            credentials: "include",
            body: JSON.stringify({
              supplierId,
              amount: numPaid,
              paymentMode,
              note: `Paid on Bill (${billingDate}) - Total: ₹${total.toLocaleString()}`,
            }),
          })

          // Also record cashbook expense entry
          await fetch("/api/cashbook", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": user.uid },
            credentials: "include",
            body: JSON.stringify({
              type: "expense",
              category: "Purchase / Stock",
              description: `Payment to ${selectedSupplier.name} (Bill ${billingDate})`,
              amount: numPaid,
              paymentMode,
              note: isCredit ? `Partial payment. Due Balance: ₹${balanceDue.toLocaleString()}` : "Fully paid bill",
            }),
          })
        } catch (payErr) {
          console.error("Payment log failed:", payErr)
        }
      }

      toast({ 
        title: "Purchase Completed", 
        description: `Successfully processed ${purchaseItems.length} products.${isCredit ? ` Balance Due: ₹${balanceDue.toLocaleString()}` : ""}` 
      })
      router.push("/purchases/purchase-history")
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
            <p className="text-xs sm:text-sm text-muted-foreground">High-speed procurement sheet with AI scanning & credit tracking.</p>
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

          {/* Billing Date Card */}
          <Card className="border-none bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Billing Date
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                type="date"
                className="h-9 bg-secondary/30 border-none text-xs rounded-lg font-bold"
                value={billingDate}
                onChange={e => setBillingDate(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Supplier Selector */}
          <Card className="border-none bg-card shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Truck className="w-4 h-4" /> Supplier
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] font-bold text-accent uppercase tracking-widest hover:bg-accent/10 px-1.5"
                onClick={() => {
                  setScannedSupplierForm({ name: "", contactPerson: "", phone: "", email: "", address: "" })
                  setScannedSupplierOpen(true)
                }}
              >
                <PlusCircle className="w-3 h-3 mr-1" /> New
              </Button>
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
                          <span className="text-[10px] text-muted-foreground">{s.contactPerson} • {s.phone}</span>
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
                      <p className="text-[10px] text-muted-foreground">{selectedSupplier.phone || selectedSupplier.contactPerson}</p>
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

          {/* AI Invoice Scanner */}
          <InvoiceScanner onScanComplete={handleScanComplete} disabled={isSubmitting} />

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
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Selling ₹ (MRP)</p>
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
                        <p className="text-[9px] text-muted-foreground font-code">{p.sku} • {p.category}</p>
                      </div>
                      <Badge variant="outline" className="text-[8px] h-4 px-1 py-0 opacity-50 font-code shrink-0">₹{p.purchasePrice}</Badge>
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
            <CardHeader className="bg-secondary/20 border-b border-border/50 py-3 md:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <Calculator className="w-4 h-4 md:w-5 md:h-5 text-accent shrink-0" />
                <div className="min-w-0">
                  <CardTitle className="text-base md:text-lg">Acquisition Sheet</CardTitle>
                  <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                    Bulk Editor with Category, MRP & Alert Level
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Bill Total</p>
                  <p className="text-xl md:text-2xl font-code font-bold text-accent">₹{total.toLocaleString()}</p>
                </div>
                {isCredit && (
                  <div className="pl-4 border-l border-border/50">
                    <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wider mb-0.5">Balance Due</p>
                    <p className="text-xl md:text-2xl font-code font-bold text-amber-500">₹{balanceDue.toLocaleString()}</p>
                  </div>
                )}
              </div>
            </CardHeader>

            {/* Credit / Payment Bar */}
            <div className="bg-secondary/10 border-b border-border/30 px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> Amount Paid Now (₹)
                </Label>
                <Input
                  type="number"
                  placeholder={`Full amount ₹${total}`}
                  style={{ color: '#ffffff', backgroundColor: '#1a2232' }}
                  className="h-9 mt-1 text-xs border border-slate-600 font-bold rounded-lg"
                  value={paidAmount}
                  onChange={e => setPaidAmount(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payment Mode</Label>
                <Select value={paymentMode} onValueChange={setPaymentMode}>
                  <SelectTrigger className="h-8 mt-1 text-xs bg-background border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end justify-start sm:justify-end gap-2 pt-1 sm:pt-0">
                {isCredit ? (
                  <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold py-1 px-2.5 text-xs">
                    Credit Bill • Balance: ₹{balanceDue.toLocaleString()}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold py-1 px-2.5 text-xs">
                    Fully Paid
                  </Badge>
                )}
              </div>
            </div>

            <CardContent className="p-0">
              {/* ── UNIFIED TABLE (Mobile & Desktop) ── */}
              <div className="w-full overflow-x-auto">
                <Table className="min-w-[760px] w-full">
                  <TableHeader className="bg-secondary/20 border-b border-border/50">
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="w-10 text-center text-[10px] font-bold uppercase py-3 px-2">#</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase py-3 px-2 min-w-[160px]">Item Name</TableHead>
                      <TableHead className="w-[160px] text-[10px] font-bold uppercase py-3 px-2">Category</TableHead>
                      <TableHead className="w-[85px] text-[10px] font-bold uppercase py-3 px-2 text-center">Qty</TableHead>
                      <TableHead className="w-[115px] text-[10px] font-bold uppercase py-3 px-2 text-right">Cost (₹)</TableHead>
                      <TableHead className="w-[115px] text-[10px] font-bold uppercase py-3 px-2 text-right">MRP (₹)</TableHead>
                      <TableHead className="w-[85px] text-[10px] font-bold uppercase py-3 px-2 text-center">Alert Lvl</TableHead>
                      <TableHead className="w-[110px] text-right text-[10px] font-bold uppercase py-3 px-2">Subtotal (₹)</TableHead>
                      <TableHead className="w-10 py-3 px-2" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseItems.map((item, index) => (
                      <TableRow key={item.productId} className="border-border/30 group hover:bg-secondary/10">
                        <TableCell className="text-center font-code text-xs text-muted-foreground py-2.5 px-2">{index + 1}</TableCell>
                        <TableCell className="py-2.5 px-2">
                          <p className="font-bold text-xs text-foreground">{item.productName}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-code text-[10px] text-muted-foreground">{item.sku}</span>
                            {item.isNewProduct && (
                              <Badge className="text-[8px] bg-accent/20 text-accent hover:bg-accent/30 px-1 py-0 h-3.5">
                                Auto Add
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Category with inline selector + create */}
                        <TableCell className="py-2.5 px-2">
                          <div className="flex items-center gap-1 min-w-[140px]">
                            <Select
                              value={item.category}
                              onValueChange={val => updateItem(item.productId, "category", val)}
                            >
                              <SelectTrigger className="h-9 text-xs bg-[#1a2232] border border-slate-600 text-foreground flex-1 rounded-lg">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 hover:bg-accent/10 text-accent"
                              onClick={() => {
                                setInlineNewCategoryItemIndex(index)
                                setInlineNewCategoryOpen(true)
                              }}
                              title="Create New Category"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>

                        {/* Qty */}
                        <TableCell className="py-2.5 px-2 text-center">
                          <Input
                            type="number"
                            min={1}
                            style={{ color: '#ffffff', backgroundColor: '#1a2232' }}
                            className="w-16 h-9 px-2 text-xs border border-slate-600 font-bold text-center rounded-lg shadow-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 mx-auto"
                            value={item.quantity ?? ""}
                            onChange={e => updateItem(item.productId, "quantity", e.target.value === "" ? "" : Number(e.target.value))}
                          />
                        </TableCell>

                        {/* Purchase Price (Cost) */}
                        <TableCell className="py-2.5 px-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            style={{ color: '#fbbf24', backgroundColor: '#1a2232' }}
                            className="w-24 h-9 px-2 text-xs border border-slate-600 font-bold text-right font-code rounded-lg shadow-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400 ml-auto"
                            value={item.purchasePrice ?? ""}
                            onChange={e => updateItem(item.productId, "purchasePrice", e.target.value === "" ? "" : Number(e.target.value))}
                          />
                        </TableCell>

                        {/* MRP (Selling Price) */}
                        <TableCell className="py-2.5 px-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            style={{ color: '#34d399', backgroundColor: '#1a2232' }}
                            className="w-24 h-9 px-2 text-xs border border-slate-600 font-bold text-right font-code rounded-lg shadow-sm focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 ml-auto"
                            value={item.sellingPrice ?? ""}
                            onChange={e => updateItem(item.productId, "sellingPrice", e.target.value === "" ? "" : Number(e.target.value))}
                          />
                        </TableCell>

                        {/* Alert Level (minStock) */}
                        <TableCell className="py-2.5 px-2 text-center">
                          <Input
                            type="number"
                            min={0}
                            style={{ color: '#ffffff', backgroundColor: '#1a2232' }}
                            className="w-16 h-9 px-2 text-xs border border-slate-600 font-bold text-center rounded-lg shadow-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 mx-auto"
                            value={item.minStock ?? ""}
                            onChange={e => updateItem(item.productId, "minStock", e.target.value === "" ? "" : Number(e.target.value))}
                          />
                        </TableCell>

                        {/* Subtotal */}
                        <TableCell className="py-2.5 px-2 text-right font-code font-bold text-foreground">
                          ₹{((Number(item.quantity) || 0) * (Number(item.purchasePrice) || 0)).toLocaleString()}
                        </TableCell>

                        {/* Remove */}
                        <TableCell className="py-2.5 px-2 text-center">
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-destructive/40 hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeItem(item.productId)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {purchaseItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="h-72 text-center">
                          <div className="flex flex-col items-center justify-center opacity-30 gap-3">
                            <Package className="w-12 h-12" />
                            <div className="space-y-1">
                              <p className="text-sm font-bold">Terminal Empty</p>
                              <p className="text-xs">Scan an invoice with AI or add products manually.</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}

                    {/* ── TABLE FOOTER SUMMARY ROW ── */}
                    {purchaseItems.length > 0 && (
                      <TableRow className="bg-secondary/30 border-t-2 border-border/70 font-bold hover:bg-secondary/30">
                        <TableCell colSpan={3} className="py-3 px-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Total ({purchaseItems.length} Products):
                        </TableCell>
                        <TableCell className="py-3 px-2 text-center text-xs font-bold text-foreground">
                          {purchaseItems.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0)}
                        </TableCell>
                        <TableCell colSpan={3} />
                        <TableCell className="py-3 px-2 text-right font-code font-bold text-base text-accent">
                          ₹{total.toLocaleString()}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>

            {/* ── BOTTOM TOTALS & COMMIT ENTRY BAR ── */}
            {purchaseItems.length > 0 && (
              <CardContent className="bg-secondary/20 border-t border-border/60 p-4 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left: Bill metadata & credit breakdown */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">
                        {selectedSupplier ? selectedSupplier.name : "No Supplier Selected"}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-code">
                        • {billingDate}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {isCredit ? (
                        <>
                          <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-500 font-bold">
                            Paid: ₹{numPaid.toLocaleString()}
                          </Badge>
                          <Badge variant="outline" className="border-amber-500/60 bg-amber-500/20 text-amber-400 font-bold">
                            Balance Due: ₹{balanceDue.toLocaleString()} (Credit)
                          </Badge>
                        </>
                      ) : (
                        <Badge variant="outline" className="border-emerald-500/50 bg-emerald-500/10 text-emerald-400 font-bold">
                          ✓ Fully Paid (₹{numPaid.toLocaleString()})
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Right: Bill Total & Big Commit Entry Button */}
                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-4 sm:gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/30">
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Bill Total</p>
                      <p className="text-2xl sm:text-3xl font-code font-bold text-accent">₹{total.toLocaleString()}</p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="rounded-xl font-bold uppercase tracking-wider text-[10px] h-11 px-4"
                        onClick={() => setPurchaseItems([])}
                      >
                        Clear
                      </Button>
                      <Button
                        onClick={handleComplete}
                        className="bg-accent text-accent-foreground font-bold px-6 sm:px-8 rounded-xl shadow-lg shadow-accent/25 h-11 text-sm sm:text-base hover:brightness-110 transition-all"
                        disabled={purchaseItems.length === 0 || !selectedSupplier || isSubmitting}
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        ) : (
                          <Save className="w-5 h-5 mr-2" />
                        )}
                        Commit Entry
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      {/* ── INLINE NEW CATEGORY DIALOG ── */}
      <Dialog open={inlineNewCategoryOpen} onOpenChange={setInlineNewCategoryOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Add New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs">Category Name</Label>
            <Input
              placeholder="e.g. Spare Parts, Beverages..."
              className="h-9 text-xs"
              value={inlineCategoryInput}
              onChange={e => setInlineCategoryInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleAddInlineCategory()
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              size="sm"
              className="w-full text-xs"
              onClick={handleAddInlineCategory}
              disabled={!inlineCategoryInput.trim()}
            >
              Add Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── SCANNED NEW SUPPLIER CONFIRMATION / REGISTRATION DIALOG ── */}
      <Dialog open={scannedSupplierOpen} onOpenChange={setScannedSupplierOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveScannedSupplier}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-accent" /> Register New Supplier
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Extracted from the uploaded bill. Edit and confirm to save this vendor to your supplier registry.
              </p>
            </DialogHeader>

            <div className="grid gap-3 py-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Vendor / Company Name *</Label>
                <Input
                  className="h-9 text-xs"
                  value={scannedSupplierForm.name}
                  onChange={e => setScannedSupplierForm({ ...scannedSupplierForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-muted-foreground" /> Contact Person
                  </Label>
                  <Input
                    className="h-9 text-xs"
                    placeholder="Name"
                    value={scannedSupplierForm.contactPerson}
                    onChange={e => setScannedSupplierForm({ ...scannedSupplierForm, contactPerson: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <Phone className="w-3 h-3 text-muted-foreground" /> Phone
                  </Label>
                  <Input
                    className="h-9 text-xs"
                    placeholder="Phone"
                    value={scannedSupplierForm.phone}
                    onChange={e => setScannedSupplierForm({ ...scannedSupplierForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Mail className="w-3 h-3 text-muted-foreground" /> Email
                </Label>
                <Input
                  type="email"
                  className="h-9 text-xs"
                  placeholder="vendor@example.com"
                  value={scannedSupplierForm.email}
                  onChange={e => setScannedSupplierForm({ ...scannedSupplierForm, email: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-muted-foreground" /> Address
                </Label>
                <Input
                  className="h-9 text-xs"
                  placeholder="Address"
                  value={scannedSupplierForm.address}
                  onChange={e => setScannedSupplierForm({ ...scannedSupplierForm, address: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setScannedSupplierOpen(false)}
              >
                Skip
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingSupplier || !scannedSupplierForm.name.trim()}
                className="bg-accent text-accent-foreground text-xs font-bold"
              >
                {isSavingSupplier && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />}
                Save & Select Supplier
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  )
}
