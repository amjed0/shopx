"use client"

import * as React from "react"
import { 
  Plus, 
  Search, 
  Box, 
  AlertCircle, 
  Package, 
  Tag, 
  X,
  PlusCircle,
  Edit2,
  RefreshCw,
  MoreVertical,
  Pencil,
  Loader2,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useUser } from "@/app/auth/use-user"

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  supplierId?: string;
  supplierName?: string;
}

export default function InventoryPage() {
  const { user } = useUser()

  // ── PRODUCTS STATE (from MongoDB API) ──
  const [products, setProducts] = React.useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = React.useState(true)

  const fetchProducts = React.useCallback(async () => {
    if (!user?.uid) return
    try {
      setLoadingProducts(true)
      const res = await fetch("/api/products", {
        headers: { "x-user-id": user.uid },
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to fetch products")
      const data: Product[] = await res.json()
      setProducts(data)
    } catch (err) {
      console.error("Failed to load products", err)
      toast({ variant: "destructive", title: "Error", description: "Could not load products." })
    } finally {
      setLoadingProducts(false)
    }
  }, [user?.uid])

 React.useEffect(() => {
  fetchProducts()
}, [fetchProducts])




  const [showOnlyLowStock, setShowOnlyLowStock] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  
  // Add Product Dialog State
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [isNewCategoryMode, setIsNewCategoryMode] = React.useState(false)
  const [selectedCategory, setSelectedCategory] = React.useState("")
  const [newCategoryNameInput, setNewCategoryNameInput] = React.useState("")
  const [searchInAdd, setSearchInAdd] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  
  const generateSKU = () => `SX-${Math.floor(1000 + Math.random() * 9000)}`

  // Form State for "Add Product"
  const [formData, setFormData] = React.useState({
    name: "",
    sku: "",
    purchasePrice: "",
    sellingPrice: "",
    stock: "",
    minStock: ""
  })

  // Edit Product Dialog State
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [productToEdit, setProductToEdit] = React.useState<Product | null>(null)
  const [editCategoryMode, setEditCategoryMode] = React.useState(false)
  const [editSelectedCategory, setEditSelectedCategory] = React.useState("")
  const [editNewCategoryInput, setEditNewCategoryInput] = React.useState("")
  const [isEditSubmitting, setIsEditSubmitting] = React.useState(false)
  const [editSelectedSupplier, setEditSelectedSupplier] = React.useState("")

  // Category Rename State
  const [isRenameDialogOpen, setIsRenameDialogOpen] = React.useState(false)
  const [categoryToRename, setCategoryToRename] = React.useState("")
  const [newCategoryName, setNewCategoryName] = React.useState("")

  // ── SUPPLIER STATES ──
  const [suppliers, setSuppliers] = React.useState<{ id: string; name: string }[]>([])
  const [selectedSupplier, setSelectedSupplier] = React.useState("")

  // ── FETCH SUPPLIERS FROM API ──
  React.useEffect(() => {
    if (!user?.uid) return
    fetch("/api/suppliers", {
      headers: { "x-user-id": user.uid },
      credentials: "include",
    })
      .then(res => res.ok ? res.json() : [])
      .then((data: { id: string; name: string }[]) => {
        setSuppliers(data)
      })
      .catch(err => console.error("Failed to load suppliers", err))
  }, [user?.uid])

  // Group products by category
  const categories = React.useMemo(() => 
    Array.from(new Set(products.map(p => p.category))).sort(),
  [products])
  
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLowStock = showOnlyLowStock ? p.stock <= p.minStock : true;
    return matchesSearch && matchesLowStock;
  })

  const groupedProducts = React.useMemo(() => {
    return categories.reduce((acc, category) => {
      const categoryProducts = filteredProducts.filter(p => p.category === category)
      if (categoryProducts.length > 0) {
        acc[category] = categoryProducts
      }
      return acc
    }, {} as Record<string, Product[]>)
  }, [categories, filteredProducts])

  const suggestionsInAdd = React.useMemo(() => {
    if (searchInAdd.length < 2) return []
    return products.filter(p => 
      p.name.toLowerCase().includes(searchInAdd.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchInAdd.toLowerCase())
    ).slice(0, 3)
  }, [searchInAdd, products])

  const resetAddForm = () => {
    setFormData({ 
      name: "", 
      sku: generateSKU(), 
      purchasePrice: "", 
      sellingPrice: "", 
      stock: "", 
      minStock: "" 
    })
    setNewCategoryNameInput("")
    setSelectedCategory("")
    setIsNewCategoryMode(false)
    setSearchInAdd("")
    setSelectedSupplier("")
  }

  // ── ADD PRODUCT via MongoDB API ──
  const handleAddProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user?.uid) return

    const category = isNewCategoryMode ? newCategoryNameInput : selectedCategory
    
    if (!category) {
      toast({ variant: "destructive", title: "Missing Category", description: "Please select an existing category or create a new one." })
      return
    }

    const productData = {
      name: formData.name,
      sku: formData.sku || generateSKU(),
      category: category,
      purchasePrice: Number(formData.purchasePrice),
      sellingPrice: Number(formData.sellingPrice),
      stock: Number(formData.stock),
      minStock: Number(formData.minStock),
      supplierId: selectedSupplier || "",
      supplierName: suppliers.find(s => s.id === selectedSupplier)?.name ?? "",
    }

    try {
      setIsSubmitting(true)
      const res = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.uid,
        },
        credentials: "include",
        body: JSON.stringify(productData),
      })
      if (!res.ok) throw new Error("Failed to add product")
      const newProduct = await res.json()
      setProducts(prev => [...prev, newProduct].sort((a, b) => a.name.localeCompare(b.name)))
      setIsAddDialogOpen(false)
      resetAddForm()
      toast({ title: "Product Initialized", description: `${productData.name} has been added to inventory.` })
    } catch (err) {
      console.error(err)
      toast({ variant: "destructive", title: "Error", description: "Could not add product." })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── DELETE PRODUCT via MongoDB API ──
  const handleDeleteProduct = async (productId: string) => {
    if (!user?.uid) return
    if (!confirm("Are you sure you want to delete this product? This action cannot be undone.")) return

    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
        headers: {
          "x-user-id": user.uid,
        },
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to delete product")
      
      setProducts(prev => prev.filter(p => p.id !== productId))
      toast({ title: "Product Deleted", description: "Product has been successfully removed." })
    } catch (err) {
      console.error(err)
      toast({ variant: "destructive", title: "Error", description: "Could not delete product." })
    }
  }

  // ── EDIT PRODUCT via MongoDB API ──
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
      category: category,
      purchasePrice: Number(formDataEdit.get("purchasePrice")),
      sellingPrice: Number(formDataEdit.get("sellingPrice")),
      stock: Number(formDataEdit.get("stock")),
      minStock: Number(formDataEdit.get("minStock")),
      supplierId: editSelectedSupplier || "",
      supplierName: suppliers.find(s => s.id === editSelectedSupplier)?.name ?? "",
    }

    try {
      setIsEditSubmitting(true)
      const res = await fetch(`/api/products/${productToEdit.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.uid,
        },
        credentials: "include",
        body: JSON.stringify(updatedData),
      })
      if (!res.ok) throw new Error("Failed to update product")
      const updated = await res.json()
      setProducts(prev => prev.map(p => p.id === updated.id ? updated : p))
      setIsEditDialogOpen(false)
      toast({ title: "Product Updated", description: "Changes saved successfully." })
    } catch (err) {
      console.error(err)
      toast({ variant: "destructive", title: "Error", description: "Could not update product." })
    } finally {
      setIsEditSubmitting(false)
    }
  }

  // ── RENAME CATEGORY via MongoDB API (batch update) ──
  const handleRenameCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!categoryToRename || !newCategoryName || !user?.uid) return

    const toUpdate = products.filter(p => p.category === categoryToRename)

    try {
      await Promise.all(toUpdate.map(p =>
        fetch(`/api/products/${p.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user.uid,
          },
          credentials: "include",
          body: JSON.stringify({ category: newCategoryName }),
        })
      ))
      setProducts(prev => prev.map(p => 
        p.category === categoryToRename ? { ...p, category: newCategoryName } : p
      ))
      setIsRenameDialogOpen(false)
      setNewCategoryName("")
      toast({ title: "Category Renamed", description: `Updated ${toUpdate.length} product(s) to "${newCategoryName}".` })
    } catch (err) {
      console.error(err)
      toast({ variant: "destructive", title: "Error", description: "Could not rename category." })
    }
  }

  const lowStockCount = products.filter(p => p.stock <= p.minStock).length

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold text-foreground">Inventory Vault</h1>
          <p className="text-muted-foreground">Manage products and track real-time stock levels.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if(open) {
              resetAddForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-primary rounded-full px-6">
                <Plus className="w-4 h-4 mr-2" /> Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleAddProduct}>
                <DialogHeader><DialogTitle>New Product Entry</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-6">
                  {/* Quick Select */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Quick Select Existing</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input 
                        placeholder="Search for common items..." 
                        value={searchInAdd} 
                        onChange={e => setSearchInAdd(e.target.value)}
                        className="pl-8 h-9 text-xs"
                      />
                    </div>
                    {suggestionsInAdd.length > 0 && (
                      <div className="bg-muted/50 rounded-lg p-1 space-y-1">
                        {suggestionsInAdd.map(p => (
                          <button key={p.id} type="button" onClick={() => {
                            setFormData({
                              name: p.name, 
                              sku: generateSKU(),
                              purchasePrice: p.purchasePrice.toString(),
                              sellingPrice: p.sellingPrice.toString(), 
                              stock: "",
                              minStock: p.minStock.toString()
                            })
                            setSelectedCategory(p.category)
                            setIsNewCategoryMode(false)
                            setSearchInAdd("")
                          }} className="block w-full text-left p-2 hover:bg-secondary rounded text-xs transition-colors flex items-center justify-between">
                            <span>{p.name}</span>
                            <span className="text-[9px] font-bold uppercase opacity-50">{p.category}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Name</Label>
                    <Input className="col-span-3" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                  </div>

                  {/* SKU */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">SKU</Label>
                    <div className="col-span-3 flex gap-2">
                      <Input value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} required />
                      <Button type="button" variant="ghost" size="icon" onClick={() => setFormData({...formData, sku: generateSKU()})}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Category */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Category</Label>
                    <div className="col-span-3 flex gap-2">
                      {isNewCategoryMode ? (
                        <Input 
                          placeholder="Type new category..." 
                          value={newCategoryNameInput}
                          onChange={(e) => setNewCategoryNameInput(e.target.value)}
                          autoFocus 
                          required={isNewCategoryMode}
                        />
                      ) : (
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          setIsNewCategoryMode(!isNewCategoryMode);
                          if (!isNewCategoryMode) setSelectedCategory("");
                          else setNewCategoryNameInput("");
                        }}
                        className={cn(isNewCategoryMode && "text-destructive hover:text-destructive hover:bg-destructive/10")}
                        title={isNewCategoryMode ? "Cancel new category" : "Add new category"}
                      >
                        {isNewCategoryMode ? <X className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Supplier */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Supplier</Label>
                    <div className="col-span-3">
                      <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Prices */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold">Purchase ₹</Label>
                      <Input type="number" placeholder="Cost" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: e.target.value})} required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold">Selling ₹</Label>
                      <Input type="number" placeholder="Price" value={formData.sellingPrice} onChange={e => setFormData({...formData, sellingPrice: e.target.value})} required />
                    </div>
                  </div>

                  {/* Stock */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold">Stock Qty</Label>
                      <Input type="number" placeholder="Stock" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold">Alert Level</Label>
                      <Input type="number" placeholder="Min" value={formData.minStock} onChange={e => setFormData({...formData, minStock: e.target.value})} required />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Initialize Product
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="p-4 flex items-center gap-4 border-none bg-card shadow-sm">
          <Box className="text-primary" />
          <div><p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Total Products</p><p className="text-2xl font-bold">{products.length}</p></div>
        </Card>
        <Card 
          onClick={() => setShowOnlyLowStock(!showOnlyLowStock)} 
          className={cn(
            "p-4 flex items-center gap-4 cursor-pointer transition-all border-none shadow-sm", 
            showOnlyLowStock ? "bg-destructive/10 ring-2 ring-destructive" : "bg-card hover:bg-muted/50"
          )}
        >
          <AlertCircle className="text-destructive" />
          <div>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Low Stock</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{lowStockCount}</p>
              {showOnlyLowStock && <Badge variant="destructive" className="text-[8px] h-4">FILTER ACTIVE</Badge>}
            </div>
          </div>
        </Card>
      </div>

      <Card className="border-none bg-card shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-headline">Catalog</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search..." className="w-64 pl-9 rounded-full bg-secondary/30 border-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            {showOnlyLowStock && (
              <Button variant="ghost" size="sm" onClick={() => setShowOnlyLowStock(false)} className="text-xs gap-1 h-8 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20">
                <X className="w-3 h-3" /> Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingProducts ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
            </div>
          ) : (
            <Accordion type="multiple" defaultValue={categories}>
              {Object.keys(groupedProducts).sort().map(category => (
                <AccordionItem key={category} value={category} className="border-border/50">
                  <div className="flex items-center justify-between pr-4 group">
                    <AccordionTrigger className="hover:no-underline flex-1">
                      <div className="flex items-center gap-3">
                        <Tag className="w-4 h-4 text-primary" />
                        <span className="font-bold text-lg">{category}</span>
                        <Badge variant="secondary" className="rounded-md bg-secondary/50">{groupedProducts[category].length} Items</Badge>
                      </div>
                    </AccordionTrigger>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setCategoryToRename(category); setNewCategoryName(category); setIsRenameDialogOpen(true); }}>
                          <Pencil className="mr-2 h-4 w-4" /> Rename Category
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <AccordionContent>
                    <Table>
                      <TableHeader className="bg-secondary/20">
                        <TableRow className="border-none hover:bg-transparent">
                          <TableHead className="font-bold uppercase text-[10px]">Info</TableHead>
                          <TableHead className="font-bold uppercase text-[10px]">Supplier</TableHead>
                          <TableHead className="font-bold uppercase text-[10px]">Price</TableHead>
                          <TableHead className="font-bold uppercase text-[10px]">Stock Status</TableHead>
                          <TableHead className="text-right font-bold uppercase text-[10px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupedProducts[category].map(p => (
                          <TableRow key={p.id} className="border-border/30 hover:bg-secondary/10">
                            <TableCell>
                              <div>
                                <p className="font-bold">{p.name}</p>
                                <p className="text-[10px] uppercase font-code opacity-60">{p.sku}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {p.supplierName ? (
                                <span className="text-xs font-medium text-muted-foreground">{p.supplierName}</span>
                              ) : (
                                <span className="text-[10px] opacity-30 italic">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold">₹{p.sellingPrice}</span>
                                <span className="text-[9px] text-muted-foreground">Buy: ₹{p.purchasePrice}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className={cn("font-bold text-lg", p.stock <= p.minStock ? 'text-destructive' : 'text-accent')}>
                                  {p.stock}
                                </span>
                                {p.stock <= p.minStock && (
                                  <Badge variant="destructive" className="text-[8px] px-1 py-0 h-3 leading-none font-bold uppercase">Low</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="rounded-full hover:bg-primary/10 hover:text-primary gap-1"
                                  onClick={() => { 
                                    setProductToEdit(p); 
                                    setEditSelectedCategory(p.category); 
                                    setEditSelectedSupplier(p.supplierId || "");
                                    setEditCategoryMode(false);
                                    setIsEditDialogOpen(true); 
                                  }}
                                >
                                  <Edit2 className="w-3 h-3" /> Edit
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="rounded-full hover:bg-destructive/10 hover:text-destructive gap-1"
                                  onClick={() => handleDeleteProduct(p.id)}
                                >
                                  <Trash2 className="w-3 h-3" /> Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              ))}
              {Object.keys(groupedProducts).length === 0 && !loadingProducts && (
                <div className="flex flex-col items-center justify-center py-20 opacity-30 gap-3">
                  <Package className="w-12 h-12" />
                  <p className="font-medium">No products found. Add your first product!</p>
                </div>
              )}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Rename Category Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <form onSubmit={handleRenameCategory}>
            <DialogHeader>
              <DialogTitle>Rename Category</DialogTitle>
              <DialogDescription>
                This will update the category for all products currently in "{categoryToRename}".
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <Label>New Category Name</Label>
              <Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full">Rename Everywhere</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          {productToEdit && (
            <form onSubmit={handleEditProduct}>
              <DialogHeader><DialogTitle>Edit Product: {productToEdit.name}</DialogTitle></DialogHeader>
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
                        setEditCategoryMode(!editCategoryMode);
                        if (!editCategoryMode) setEditSelectedCategory("");
                        else setEditNewCategoryInput("");
                      }}
                      title={editCategoryMode ? "Cancel new category" : "Add new category"}
                    >
                      {editCategoryMode ? <X className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Supplier */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Supplier</Label>
                    <div className="col-span-3">
                      <Select value={editSelectedSupplier} onValueChange={setEditSelectedSupplier}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Purchase ₹</Label>
                    <Input name="purchasePrice" type="number" defaultValue={productToEdit.purchasePrice} />
                  </div>
                  <div className="space-y-1">
                    <Label>Selling ₹</Label>
                    <Input name="sellingPrice" type="number" defaultValue={productToEdit.sellingPrice} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Current Stock</Label>
                    <Input name="stock" type="number" defaultValue={productToEdit.stock} />
                  </div>
                  <div className="space-y-1">
                    <Label>Alert at Qty</Label>
                    <Input name="minStock" type="number" defaultValue={productToEdit.minStock} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isEditSubmitting}>
                  {isEditSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
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