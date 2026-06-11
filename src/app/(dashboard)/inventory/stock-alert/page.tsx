"use client"

import * as React from "react"
import { 
  AlertTriangle, 
  ArrowLeft, 
  Package, 
  Search, 
  X, 
  PlusCircle, 
  Edit2, 
  Loader2 
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useUser } from "@/app/auth/use-user"

export interface Product {
  id: string
  name: string
  sku: string
  category: string
  purchasePrice: number
  sellingPrice: number
  stock: number
  minStock: number
}

export default function StockAlertsPage() {
  const router = useRouter()
  const { user } = useUser()
  const [products, setProducts] = React.useState<Product[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")

  // Edit Product Dialog State
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [productToEdit, setProductToEdit] = React.useState<Product | null>(null)
  const [editCategoryMode, setEditCategoryMode] = React.useState(false)
  const [editSelectedCategory, setEditSelectedCategory] = React.useState("")
  const [editNewCategoryInput, setEditNewCategoryInput] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Fetch products from MongoDB API
  React.useEffect(() => {
    if (!user?.uid) return
    setLoading(true)
    setError(null)
    fetch("/api/products", { headers: { "x-user-id": user.uid } })
      .then(res => {
        if (!res.ok) throw new Error("Failed to load products")
        return res.json()
      })
      .then((data: Product[]) => setProducts(Array.isArray(data) ? data : []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [user?.uid])

  // Categories list for edit dialog
  const categories = React.useMemo(() => 
    Array.from(new Set(products.map(p => p.category))).sort(),
  [products])

  // Filter for low stock and sort from lowest to highest stock
  const lowStockItems = React.useMemo(() => {
    return products
      .filter((p) => p.stock <= p.minStock)
      .sort((a, b) => a.stock - b.stock)
  }, [products])

  // Filtered by search query
  const filteredItems = React.useMemo(() => {
    return lowStockItems.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [lowStockItems, searchQuery])

  // Estimated refill cost
  const totalShortageValue = React.useMemo(() => {
    return lowStockItems.reduce(
      (acc, p) => acc + p.purchasePrice * Math.max(0, p.minStock * 2 - p.stock),
      0
    )
  }, [lowStockItems])

  const handleEditProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!productToEdit || !user?.uid) return

    const formDataEdit = new FormData(e.currentTarget)
    const category = editCategoryMode ? editNewCategoryInput : editSelectedCategory

    if (!category) {
      toast({ variant: "destructive", title: "Error", description: "Category is required." })
      return
    }

    const updatedData = {
      name: formDataEdit.get("name") as string,
      sku: formDataEdit.get("sku") as string,
      category,
      purchasePrice: Number(formDataEdit.get("purchasePrice")),
      sellingPrice: Number(formDataEdit.get("sellingPrice")),
      stock: Number(formDataEdit.get("stock")),
      minStock: Number(formDataEdit.get("minStock")),
    }

    try {
      setIsSubmitting(true)
      const res = await fetch(`/api/products/${productToEdit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": user.uid },
        body: JSON.stringify(updatedData),
      })
      if (!res.ok) throw new Error("Failed to update product")
      const updated = await res.json()
      setProducts(prev => prev.map(p => p.id === updated.id ? updated : p))
      setIsEditDialogOpen(false)
      toast({ title: "Product Updated", description: "Changes saved successfully." })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* ── Header ── */}
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
              Critical <span className="text-destructive">Alerts</span>
            </h1>
            <p className="text-muted-foreground">
              Immediate action required for the following inventory items.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => router.push("/inventory")}
            variant="outline"
            className="rounded-full border-border hover:bg-secondary font-bold"
          >
            View Full Catalog
          </Button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-destructive/10 border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-destructive font-bold uppercase text-[10px] tracking-widest">
              Active Alerts
            </CardDescription>
            <CardTitle className="text-4xl font-headline font-bold text-destructive">
              {lowStockItems.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-primary/10 border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-primary font-bold uppercase text-[10px] tracking-widest">
              Est. Refill Cost
            </CardDescription>
            <CardTitle className="text-4xl font-headline font-bold text-primary">
              ₹{totalShortageValue.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-accent/10 border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-accent font-bold uppercase text-[10px] tracking-widest">
              Items Out of Stock
            </CardDescription>
            <CardTitle className="text-4xl font-headline font-bold text-accent">
              {lowStockItems.filter((p) => p.stock === 0).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <Card className="border-destructive/40 bg-destructive/5 shadow-none">
          <CardContent className="flex items-center gap-3 py-4 text-destructive text-sm font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Failed to load data: {error}</span>
          </CardContent>
        </Card>
      )}

      {/* ── Table ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
        </div>
      ) : (
        <Card className="border-none bg-card shadow-sm overflow-hidden">
          <CardHeader className="bg-secondary/20 border-b border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <CardTitle className="font-headline text-lg">Shortage Registry</CardTitle>
              <Badge variant="outline" className="font-bold text-[8px] bg-secondary/50 border-none ml-2">
                SORT: LOW TO HIGH
              </Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search low stock..." 
                className="w-64 pl-9 rounded-full bg-secondary/30 border-none h-9 text-xs" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/10">
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="font-bold uppercase text-[10px] py-4 pl-6">Product Details</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] py-4">Stock Status</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] py-4">Alert Level</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] py-4">Inventory Health</TableHead>
                  <TableHead className="text-right font-bold uppercase text-[10px] py-4 pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((p) => {
                  const healthPercent = p.minStock > 0 ? Math.min(100, (p.stock / p.minStock) * 100) : 0
                  return (
                    <TableRow
                      key={p.id}
                      className="border-border/20 hover:bg-secondary/5 transition-colors group"
                    >
                      <TableCell className="pl-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-secondary/50 p-2 rounded-lg">
                            <Package className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-bold text-foreground group-hover:text-primary transition-colors">
                              {p.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-code uppercase">
                              {p.sku} • {p.category}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-lg font-bold font-code",
                              p.stock === 0
                                ? "text-destructive animate-pulse"
                                : "text-orange-400"
                            )}
                          >
                            {p.stock}
                          </span>
                          <span className="text-[10px] text-muted-foreground">units left</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-secondary/30 border-none font-code text-[11px]">
                          {p.minStock}
                        </Badge>
                      </TableCell>
                      <TableCell className="w-[200px]">
                        <div className="space-y-1.5">
                          <Progress
                            value={healthPercent}
                            className={cn(
                              "h-1.5",
                              p.stock === 0 ? "[&>div]:bg-destructive" : "[&>div]:bg-orange-500"
                            )}
                          />
                          <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">
                            {p.stock === 0 ? "Critically Empty" : `${healthPercent.toFixed(0)}% of Min Level`}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-full hover:bg-primary/10 hover:text-primary font-bold text-[11px]"
                          onClick={() => {
                            setProductToEdit(p)
                            setEditSelectedCategory(p.category)
                            setEditCategoryMode(false)
                            setIsEditDialogOpen(true)
                          }}
                        >
                          <Edit2 className="w-3 h-3 mr-1.5" /> RESTOCK / EDIT
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}

                {filteredItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3 opacity-50">
                        <Package className="w-12 h-12" />
                        <p className="text-lg font-medium">
                          {lowStockItems.length === 0 
                            ? "All stock levels are healthy." 
                            : "No items match your search."}
                        </p>
                        {lowStockItems.length === 0 && (
                          <Button variant="link" onClick={() => router.push("/inventory")}>
                            Go to Inventory
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit Product / Restock Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          {productToEdit && (
            <form onSubmit={handleEditProduct}>
              <DialogHeader>
                <DialogTitle>Restock & Edit Product</DialogTitle>
                <DialogDescription>
                  Modify inventory details and stock levels for {productToEdit.name}.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-1">
                  <Label>Product Name</Label>
                  <Input name="name" defaultValue={productToEdit.name} required />
                </div>
                <div className="space-y-1">
                  <Label>SKU Code</Label>
                  <Input name="sku" defaultValue={productToEdit.sku} required />
                </div>
                <div className="space-y-1">
                  <Label>Category</Label>
                  <div className="flex gap-2">
                    {editCategoryMode ? (
                      <Input 
                        placeholder="Type new category..." 
                        value={editNewCategoryInput}
                        onChange={(e) => setEditNewCategoryInput(e.target.value)}
                        required 
                      />
                    ) : (
                      <Select value={editSelectedCategory} onValueChange={setEditSelectedCategory}>
                        <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon"
                      onClick={() => {
                        setEditCategoryMode(!editCategoryMode)
                        if (!editCategoryMode) setEditSelectedCategory("")
                        else setEditNewCategoryInput("")
                      }}
                      title={editCategoryMode ? "Cancel new category" : "Add new category"}
                    >
                      {editCategoryMode ? <X className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Purchase Price (₹)</Label>
                    <Input name="purchasePrice" type="number" defaultValue={productToEdit.purchasePrice} required />
                  </div>
                  <div className="space-y-1">
                    <Label>Selling Price (₹)</Label>
                    <Input name="sellingPrice" type="number" defaultValue={productToEdit.sellingPrice} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Current Stock</Label>
                    <Input name="stock" type="number" defaultValue={productToEdit.stock} required />
                  </div>
                  <div className="space-y-1">
                    <Label>Alert at Qty</Label>
                    <Input name="minStock" type="number" defaultValue={productToEdit.minStock} required />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Update Details
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
