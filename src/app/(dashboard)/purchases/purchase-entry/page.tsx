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
  UserCheck,
  Sparkles,
  TrendingUp,
  Edit2,
  Layers,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCcw,
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
  gstNumber?: string
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
  taxRate?: number | string        // GST %
  taxAmount?: number | string      // GST ₹
  isNewProduct?: boolean
}

interface BillGroup {
  billNumber: number
  date: string
  supplierId: string
  supplierName: string
  supplierPhone: string
  items: Array<{
    productName: string
    sku?: string
    quantity: number
    purchasePrice: number
    taxRate?: number
    taxAmount?: number
    category?: string
  }>
  totalAmount: number
  totalQty: number
}

function formatToDDMMYYYY(dateStr: string): string {
  if (!dateStr || !dateStr.includes("-")) return dateStr
  const [y, m, d] = dateStr.split("-")
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`
}

function normalizeCategoryName(rawCat: string, existingList?: string[]): string {
  if (!rawCat || typeof rawCat !== "string") return "General"
  let cat = rawCat.trim()
  if (!cat) return "General"

  const lower = cat.toLowerCase()
  let singular = cat

  // Remove plural endings 's', 'es', 'ies'
  if (lower.endsWith("ies") && lower.length > 4) {
    singular = cat.slice(0, -3) + "y"
  } else if (lower.endsWith("es") && !["glasses", "shoes", "clothes"].includes(lower)) {
    singular = cat.slice(0, -2)
  } else if (lower.endsWith("s") && !["gas", "glass", "brass", "status", "electronics", "lens", "jeans"].includes(lower)) {
    singular = cat.slice(0, -1)
  }

  // Title Case
  singular = singular
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")

  // Match against existing categories
  if (existingList && Array.isArray(existingList) && existingList.length > 0) {
    const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
    const targetNorm = clean(singular)
    const rawNorm = clean(cat)

    const exact = existingList.find(e => clean(e) === targetNorm || clean(e) === rawNorm)
    if (exact) return exact

    const stemMatch = existingList.find(e => {
      const eNorm = clean(e)
      return (eNorm.length >= 4 && targetNorm.includes(eNorm)) || (targetNorm.length >= 4 && eNorm.includes(targetNorm))
    })
    if (stemMatch) return stemMatch
  }

  return singular
}

export default function NewPurchasePage() {
  const router = useRouter()
  const { user } = useUser()

  const [suppliers, setSuppliers] = React.useState<Supplier[]>([])
  const [products, setProducts] = React.useState<Product[]>([])
  const [productSalesCount, setProductSalesCount] = React.useState<Record<string, number>>({})
  const [selectedSupplier, setSelectedSupplier] = React.useState<Supplier | null>(null)
  const [supplierSearch, setSupplierSearch] = React.useState("")
  const [productSearch, setProductSearch] = React.useState("")
  const [purchaseItems, setPurchaseItems] = React.useState<PurchaseItem[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [loadingData, setLoadingData] = React.useState(true)

  // Bill Navigator State
  const [pastBills, setPastBills] = React.useState<BillGroup[]>([])
  const [currentBillIndex, setCurrentBillIndex] = React.useState<number>(-1)  // -1 = new bill
  const [isBillViewOpen, setIsBillViewOpen] = React.useState(false)
  const [viewingBill, setViewingBill] = React.useState<BillGroup | null>(null)
  const [scannerKey, setScannerKey] = React.useState(0)

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
  const [detectedGstForSupplier, setDetectedGstForSupplier] = React.useState<string | null>(null)
  const [isUpdatingSupplierGst, setIsUpdatingSupplierGst] = React.useState(false)
  const [scannedSupplierOpen, setScannedSupplierOpen] = React.useState(false)
  const [scannedSupplierForm, setScannedSupplierForm] = React.useState({
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    gstNumber: "",
  })
  const [isSavingSupplier, setIsSavingSupplier] = React.useState(false)

  // Edit Selected Supplier Dialog
  const [isEditSupplierOpen, setIsEditSupplierOpen] = React.useState(false)
  const [editSupplierForm, setEditSupplierForm] = React.useState({
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    gstNumber: "",
  })
  const [isUpdatingSupplier, setIsUpdatingSupplier] = React.useState(false)

  const generateSKU = () => `SX-${Math.floor(1000 + Math.random() * 9000)}`

  const [newProductForm, setNewProductForm] = React.useState({
    name: "",
    sku: generateSKU(),
    purchasePrice: "",
    sellingPrice: "",
    stock: "0",
    minStock: "2"
  })

  const fetchAll = React.useCallback(async () => {
    if (!user?.uid) return
    const headers = { "x-user-id": user.uid }
    try {
      setLoadingData(true)
      const [suppliersRes, productsRes, salesRes, purchasesRes] = await Promise.all([
        fetch("/api/suppliers", { headers, credentials: "include" }),
        fetch("/api/products", { headers, credentials: "include" }),
        fetch("/api/sales", { headers, credentials: "include" }).catch(() => null),
        fetch("/api/purchases", { headers, credentials: "include" }).catch(() => null),
      ])
      let fetchedSuppliers: Supplier[] = []
      if (suppliersRes.ok) {
        fetchedSuppliers = await suppliersRes.json()
        setSuppliers(fetchedSuppliers)
      }
      if (productsRes.ok) setProducts(await productsRes.json())

      // Calculate sales count per product to rank top sellers
      if (salesRes && salesRes.ok) {
        const salesData = await salesRes.json()
        const counts: Record<string, number> = {}
        if (Array.isArray(salesData)) {
          salesData.forEach((s: any) => {
            if (Array.isArray(s.items)) {
              s.items.forEach((it: any) => {
                const pid = it.productId || it.product?.id
                if (pid) {
                  counts[pid] = (counts[pid] || 0) + (Number(it.quantity) || 1)
                }
              })
            }
          })
        }
        setProductSalesCount(counts)
      }

      // Group past purchases into sequential bills for Bill Navigator
      if (purchasesRes && purchasesRes.ok) {
        const purchasesData = await purchasesRes.json()
        if (Array.isArray(purchasesData) && purchasesData.length > 0) {
          // Sort oldest to newest
          const sorted = [...purchasesData].sort((a, b) => {
            const dateA = a.billingDate || (a.createdAt ? a.createdAt.split("T")[0] : "")
            const dateB = b.billingDate || (b.createdAt ? b.createdAt.split("T")[0] : "")
            if (dateA !== dateB) return dateA.localeCompare(dateB)
            return (a.createdAt || "").localeCompare(b.createdAt || "")
          })

          const groups: { [key: string]: BillGroup } = {}
          sorted.forEach(p => {
            const d = p.billingDate || (p.createdAt ? p.createdAt.split("T")[0] : "Unknown")
            const sId = p.supplierId || "unknown"
            const key = `${d}_${sId}`
            if (!groups[key]) {
              const supp = fetchedSuppliers.find(s => s.id === sId || (s as any)._id === sId)
              groups[key] = {
                billNumber: 0,
                date: d,
                supplierId: sId,
                supplierName: supp?.name || "Unknown Supplier",
                supplierPhone: supp?.phone || "",
                items: [],
                totalAmount: 0,
                totalQty: 0,
              }
            }
            const qty = Number(p.quantity) || 1
            const price = Number(p.purchasePrice) || 0
            const taxRate = Number(p.taxRate) || 0
            const taxAmount = Number(p.taxAmount) || 0
            groups[key].items.push({
              productName: p.productName || "Product",
              sku: p.itemCode || "",
              quantity: qty,
              purchasePrice: price,
              taxRate,
              taxAmount,
            })
            groups[key].totalQty += qty
            groups[key].totalAmount += (qty * price) + taxAmount
          })

          const billList = Object.values(groups).map((bg, idx) => ({
            ...bg,
            billNumber: idx + 1,
          }))
          setPastBills(billList)
        }
      }
    } catch (err) {
      console.error(err)
      toast({ variant: "destructive", title: "Failed to load data" })
    } finally {
      setLoadingData(false)
    }
  }, [user?.uid])

  React.useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const loadBillData = (bill: BillGroup) => {
    setBillingDate(bill.date)
    const supp = suppliers.find(s => s.id === bill.supplierId || (s as any)._id === bill.supplierId)
    setSelectedSupplier(supp || {
      id: bill.supplierId,
      name: bill.supplierName,
      phone: bill.supplierPhone,
      contactPerson: "",
      email: "",
      address: "",
      gstNumber: (bill as any).supplierGst || "",
    })

    setPurchaseItems(bill.items.map(it => {
      const prod = products.find(p =>
        p.name.toLowerCase() === it.productName.toLowerCase() ||
        (it.sku && p.sku && p.sku.toLowerCase() === it.sku.toLowerCase())
      )
      return {
        productId: prod?.id || `past-${Math.random().toString(36).slice(2)}`,
        productName: it.productName,
        sku: it.sku || prod?.sku || "",
        quantity: it.quantity,
        purchasePrice: it.purchasePrice,
        taxRate: it.taxRate || 0,
        taxAmount: it.taxAmount || 0,
        sellingPrice: prod?.sellingPrice || Math.round(it.purchasePrice * 1.25),
        category: it.category || prod?.category || "General",
        minStock: prod?.minStock || 2,
        isNewProduct: false,
      }
    }))
  }

  const handlePrevBill = () => {
    if (pastBills.length === 0) return
    let targetIndex = currentBillIndex
    if (targetIndex === -1) {
      targetIndex = pastBills.length - 1
    } else if (targetIndex > 0) {
      targetIndex -= 1
    } else {
      return
    }
    setCurrentBillIndex(targetIndex)
    loadBillData(pastBills[targetIndex])
    toast({ title: `Viewing Bill #${pastBills[targetIndex].billNumber}`, description: `Date: ${pastBills[targetIndex].date} • ${pastBills[targetIndex].supplierName}` })
  }

  const handleNextBill = () => {
    if (pastBills.length === 0 || currentBillIndex === -1) return
    if (currentBillIndex < pastBills.length - 1) {
      const targetIndex = currentBillIndex + 1
      setCurrentBillIndex(targetIndex)
      loadBillData(pastBills[targetIndex])
      toast({ title: `Viewing Bill #${pastBills[targetIndex].billNumber}`, description: `Date: ${pastBills[targetIndex].date} • ${pastBills[targetIndex].supplierName}` })
    } else {
      handleResetToNewBill()
    }
  }

  const handlePrevDate = () => {
    if (currentBillIndex === -1 && pastBills.length === 0) {
      const d = new Date(billingDate)
      d.setDate(d.getDate() - 1)
      setBillingDate(d.toISOString().split("T")[0])
      return
    }
    const dates = Array.from(new Set(pastBills.map(b => b.date))).sort()
    const currentIdx = dates.indexOf(billingDate)
    let targetDate = dates[0]
    if (currentIdx > 0) {
      targetDate = dates[currentIdx - 1]
    } else if (currentIdx === -1) {
      const prevDates = dates.filter(d => d < billingDate)
      targetDate = prevDates.length > 0 ? prevDates[prevDates.length - 1] : dates[dates.length - 1]
    } else {
      const d = new Date(billingDate)
      d.setDate(d.getDate() - 1)
      setBillingDate(d.toISOString().split("T")[0])
      return
    }
    const billIdx = pastBills.findIndex(b => b.date === targetDate)
    if (billIdx >= 0) {
      setCurrentBillIndex(billIdx)
      loadBillData(pastBills[billIdx])
    } else {
      setBillingDate(targetDate)
    }
  }

  const handleNextDate = () => {
    const todayStr = new Date().toISOString().split("T")[0]
    if (currentBillIndex === -1) {
      const d = new Date(billingDate)
      d.setDate(d.getDate() + 1)
      const nextStr = d.toISOString().split("T")[0]
      if (nextStr <= todayStr) {
        setBillingDate(nextStr)
      }
      return
    }
    const dates = Array.from(new Set(pastBills.map(b => b.date))).sort()
    const currentIdx = dates.indexOf(billingDate)
    if (currentIdx >= 0 && currentIdx < dates.length - 1) {
      const targetDate = dates[currentIdx + 1]
      const billIdx = pastBills.findIndex(b => b.date === targetDate)
      if (billIdx >= 0) {
        setCurrentBillIndex(billIdx)
        loadBillData(pastBills[billIdx])
      } else {
        setBillingDate(targetDate)
      }
    } else {
      handleResetToNewBill()
    }
  }

  const handleResetToNewBill = () => {
    setCurrentBillIndex(-1)
    setPurchaseItems([])
    setSelectedSupplier(null)
    setDetectedGstForSupplier(null)
    setBillingDate(new Date().toISOString().split("T")[0])
    setPaidAmount("")
    setScannerKey(k => k + 1)
    toast({ title: "New Bill Entry", description: "Sheet cleared for fresh purchase entry." })
  }

  const categories = React.useMemo(() => {
    const list = Array.from(new Set([...products.map(p => p.category), ...customCategories])).filter(Boolean).sort()
    return list.length > 0 ? list : ["General", "Retail", "Electronics", "Groceries", "Spare Parts"]
  }, [products, customCategories])

  // Fast Add Display Products: Exactly 5 items (Best Selling or Search Results)
  const fastAddDisplayProducts = React.useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (q) {
      return products
        .filter(p => !purchaseItems.some(i => i.productId === p.id))
        .filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
        .slice(0, 5)
    }
    // No search query: prioritize top selling products
    const available = products.filter(p => !purchaseItems.some(i => i.productId === p.id))
    const sorted = [...available].sort((a, b) => (productSalesCount[b.id] || 0) - (productSalesCount[a.id] || 0))
    return sorted.slice(0, 5)
  }, [productSearch, products, purchaseItems, productSalesCount])

  const quickSelectProducts = React.useMemo(() => {
    const q = quickSelectSearch.toLowerCase()
    if (!q) return []
    return products.filter(p =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    ).slice(0, 5)
  }, [products, quickSelectSearch])

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    (s.phone && s.phone.includes(supplierSearch))
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
    setPurchaseItems(prev => {
      // Check if product is already in the acquisition sheet by id, sku, or name
      const pSku = (product.sku || "").trim().toLowerCase()
      const pName = (product.name || "").trim().toLowerCase()
      const existingIdx = prev.findIndex(item => {
        if (item.productId === product.id) return true
        const itSku = (item.sku || "").trim().toLowerCase()
        if (pSku && itSku && pSku === itSku) return true
        if (item.productName.trim().toLowerCase() === pName) return true
        return false
      })

      if (existingIdx >= 0) {
        toast({
          title: "Product Already Added ✓",
          description: `Increased quantity for "${product.name}" (#${existingIdx + 1}).`,
        })
        return prev.map((item, idx) =>
          idx === existingIdx
            ? { ...item, quantity: Number(item.quantity || 1) + 1 }
            : item
        )
      }

      return [
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
          taxRate: 0,
          taxAmount: 0,
          isNewProduct: false,
        }
      ]
    })
    setProductSearch("")
  }

  const removeItem = (id: string) =>
    setPurchaseItems(prev => prev.filter(i => i.productId !== id))

  const updateItem = (id: string, field: keyof PurchaseItem, value: any) => {
    setPurchaseItems(prev => prev.map(i => {
      if (i.productId !== id) return i
      const updated = { ...i, [field]: value }
      const qty = Number(updated.quantity) || 0
      const cost = Number(updated.purchasePrice) || 0

      if (field === "taxRate") {
        const rate = Number(value) || 0
        updated.taxAmount = rate > 0 ? Number(((qty * cost * rate) / 100).toFixed(2)) : 0
      } else if (field === "taxAmount") {
        const tAmt = Number(value) || 0
        const base = qty * cost
        if (base > 0 && tAmt > 0) {
          updated.taxRate = Number(((tAmt / base) * 100).toFixed(1))
        }
      } else if (field === "quantity" || field === "purchasePrice") {
        const rate = Number(updated.taxRate) || 0
        if (rate > 0) {
          updated.taxAmount = Number(((qty * cost * rate) / 100).toFixed(2))
        }
      }
      return updated
    }))
  }

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
      minStock: Number(newProductForm.minStock || 2),
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

  // Handle scanned AI invoice result with Smart Auto-Supplier Matching
  const handleScanComplete = async (result: ScanResult) => {
    if (!user?.uid) return

    // 1. If billing date was extracted from bill, apply it and show notification
    if (result.invoiceDate) {
      setBillingDate(result.invoiceDate)
      toast({
        title: "Bill Date Detected 📅",
        description: `Set bill date to ${formatToDDMMYYYY(result.invoiceDate)} from scanned invoice.`,
      })
    }

    // 2. Extract and preserve Supplier GSTIN if scanned
    if (result.supplierGst) {
      setDetectedGstForSupplier(result.supplierGst)
    }

    // 3. Smart Supplier Matching: Normalize and match existing vendor
    if (result.supplierName && !selectedSupplier) {
      const normalize = (str: string) =>
        str
          .toLowerCase()
          .replace(/\b(ltd|limited|pvt|private|co|company|enterprises|enterprise|stores|store|traders|trader|agency|distributors|distributor|shop|corp|corporation)\b/g, "")
          .replace(/[^a-z0-9]/g, "")
          .trim()

      const scannedNorm = normalize(result.supplierName)
      const cleanPhone = (p?: string | null) => (p || "").replace(/\D/g, "").slice(-10)
      const scannedPhone = cleanPhone(result.supplierPhone)

      const match = suppliers.find(s => {
        // Match by last 10 digits of mobile number if phone was extracted
        if (scannedPhone && cleanPhone(s.phone) && scannedPhone === cleanPhone(s.phone)) {
          return true
        }
        // Match by exact or normalized name
        const sNorm = normalize(s.name)
        if (sNorm && scannedNorm && (sNorm === scannedNorm || sNorm.includes(scannedNorm) || scannedNorm.includes(sNorm))) {
          return true
        }
        return false
      })

      if (match) {
        setSelectedSupplier(match)
        toast({ 
          title: "Supplier Auto-Selected ✓", 
          description: `Matched existing vendor: ${match.name} (${match.phone})` 
        })
      } else {
        // Only prompt to register new supplier if not matched in existing list
        setScannedSupplierForm({
          name: result.supplierName || "",
          contactPerson: result.supplierContactPerson || "",
          phone: result.supplierPhone || "",
          email: result.supplierEmail || "",
          address: result.supplierAddress || "",
          gstNumber: result.supplierGst || "",
        })
        setScannedSupplierOpen(true)
      }
    }

    // 3. Process scanned items with strict de-duplication (# serialNumber, itemCode, name) & category normalization
    const dedupedScanItems: ScannedItem[] = []
    const seenScanKeys = new Map<string, number>()

    for (const rawItem of result.items) {
      const sNum = rawItem.serialNumber !== undefined && rawItem.serialNumber !== null ? String(rawItem.serialNumber).trim() : ""
      const sCode = (rawItem.itemCode || "").trim().toLowerCase()
      const sName = (rawItem.name || "").trim().toLowerCase()

      // Unique key: prefer serial number if present, else item code, else product name
      const key = sNum ? `sn_${sNum}` : (sCode ? `code_${sCode}` : `name_${sName}`)

      if (seenScanKeys.has(key)) {
        // Merge quantity instead of adding a duplicate row!
        const existingIdx = seenScanKeys.get(key)!
        dedupedScanItems[existingIdx].quantity = (Number(dedupedScanItems[existingIdx].quantity) || 1) + (Number(rawItem.quantity) || 1)
      } else {
        seenScanKeys.set(key, dedupedScanItems.length)
        dedupedScanItems.push({ ...rawItem })
      }
    }

    const newItems: PurchaseItem[] = []

    for (const item of dedupedScanItems) {
      const scannedCode = (item.itemCode || "").trim().toLowerCase()
      const scannedName = (item.name || "").trim().toLowerCase()

      // Match against existing inventory:
      // 1. Direct Item Code == Existing SKU match
      // 2. Exact product name match
      // 3. Clean alphanumeric string match
      const existing = products.find(p => {
        const pSku = (p.sku || "").trim().toLowerCase()
        const pName = (p.name || "").trim().toLowerCase()
        if (scannedCode && pSku && scannedCode === pSku) return true
        if (scannedName && pName && scannedName === pName) return true
        const cleanP = pName.replace(/[^a-z0-9]/g, "")
        const cleanS = scannedName.replace(/[^a-z0-9]/g, "")
        if (cleanP && cleanS && cleanP.length > 3 && cleanS.length > 3 && (cleanP === cleanS || cleanP.includes(cleanS) || cleanS.includes(cleanP))) return true
        return false
      })

      // Normalize category: ensure singular form and match existing categories
      const matchedCat = normalizeCategoryName(item.category || existing?.category || "General", categories)
      if (matchedCat && !categories.includes(matchedCat)) {
        setCustomCategories(prev => Array.from(new Set([...prev, matchedCat])))
      }

      const itemQty = item.quantity || 1
      const itemCost = item.purchasePrice || (existing?.purchasePrice || 0)
      const itemTaxRate = item.taxRate !== undefined && item.taxRate !== null ? Number(item.taxRate) : 0
      let itemTaxAmount = item.taxAmount !== undefined && item.taxAmount !== null ? Number(item.taxAmount) : 0
      if (itemTaxRate > 0 && itemTaxAmount === 0) {
        itemTaxAmount = Number(((itemQty * itemCost * itemTaxRate) / 100).toFixed(2))
      }

      if (existing) {
        // USE EXISTING PRODUCT: Keep existing name and existing SKU to prevent duplicates!
        newItems.push({
          productId: existing.id,
          productName: existing.name,
          sku: existing.sku || item.itemCode || generateSKU(),
          quantity: itemQty,
          purchasePrice: itemCost,
          sellingPrice: item.sellingPrice || existing.sellingPrice || Math.round(itemCost * 1.25),
          category: matchedCat,
          minStock: existing.minStock || 2,
          taxRate: itemTaxRate,
          taxAmount: itemTaxAmount,
          isNewProduct: false,
        })
      } else {
        // TRULY NEW PRODUCT: Use bill's item code as SKU if present
        const itemSku = (item.itemCode || "").trim() || generateSKU()
        newItems.push({
          productId: `temp-${Math.random().toString(36).slice(2)}`,
          productName: item.name,
          sku: itemSku,
          quantity: itemQty,
          purchasePrice: itemCost,
          sellingPrice: item.sellingPrice || Math.round(itemCost * 1.25),
          category: matchedCat,
          minStock: 2,
          taxRate: itemTaxRate,
          taxAmount: itemTaxAmount,
          isNewProduct: true,
        })
      }
    }

    if (newItems.length > 0) {
      // Starting new bill entry: clear any previous/past items so new bill sheet is completely clean!
      setCurrentBillIndex(-1)
      setPaidAmount("")
      setPurchaseItems(newItems)
      toast({
        title: "Products Extracted ✨",
        description: `Loaded ${newItems.length} unique product(s) into fresh acquisition sheet.`,
      })
    }
  }

  // Bulk Category Application: Change all products to a selected category in one click
  const handleApplyCategoryToAll = (targetCategory?: string) => {
    const cat = targetCategory || purchaseItems[0]?.category
    if (!cat) {
      toast({ variant: "destructive", title: "No Category", description: "Select a category first." })
      return
    }
    setPurchaseItems(prev => prev.map(item => ({ ...item, category: cat })))
    toast({
      title: "Category Applied to All ✓",
      description: `All ${purchaseItems.length} products changed to "${cat}".`,
    })
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

  // Open edit dialog for currently selected supplier
  const handleOpenEditSupplier = () => {
    if (!selectedSupplier) return
    setEditSupplierForm({
      name: selectedSupplier.name || "",
      contactPerson: selectedSupplier.contactPerson || "",
      phone: selectedSupplier.phone || "",
      email: selectedSupplier.email || "",
      address: selectedSupplier.address || "",
      gstNumber: selectedSupplier.gstNumber || "",
    })
    setIsEditSupplierOpen(true)
  }

  // Quick update supplier GST from bill
  const handleUpdateSupplierGst = async () => {
    if (!user?.uid || !selectedSupplier || !detectedGstForSupplier) return
    setIsUpdatingSupplierGst(true)
    try {
      const res = await fetch(`/api/suppliers/${selectedSupplier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": user.uid },
        credentials: "include",
        body: JSON.stringify({ gstNumber: detectedGstForSupplier }),
      })
      if (!res.ok) throw new Error("Failed to update supplier GST")
      const updated = await res.json()
      setSuppliers(prev => prev.map(s => s.id === updated.id ? updated : s))
      setSelectedSupplier(updated)
      toast({
        title: "Supplier GSTIN Updated ✓",
        description: `Saved GSTIN ${detectedGstForSupplier} for ${updated.name}`,
      })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update Failed", description: err.message })
    } finally {
      setIsUpdatingSupplierGst(false)
    }
  }

  // Save updated supplier
  const handleUpdateSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.uid || !selectedSupplier || !editSupplierForm.name.trim()) return
    setIsUpdatingSupplier(true)
    try {
      const res = await fetch(`/api/suppliers/${selectedSupplier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": user.uid },
        credentials: "include",
        body: JSON.stringify(editSupplierForm),
      })
      if (!res.ok) throw new Error("Failed to update supplier")
      const updated = await res.json()
      setSuppliers(prev => prev.map(s => s.id === updated.id ? updated : s))
      setSelectedSupplier(updated)
      setIsEditSupplierOpen(false)
      toast({ title: "Supplier Updated", description: `${updated.name} details saved.` })
    } catch (err: any) {
      console.error(err)
      toast({ variant: "destructive", title: "Update Failed", description: err.message })
    } finally {
      setIsUpdatingSupplier(false)
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

  const totalTax = purchaseItems.reduce((acc, i) => acc + (Number(i.taxAmount) || 0), 0)
  const total = purchaseItems.reduce((acc, i) => {
    const base = (Number(i.quantity) || 0) * (Number(i.purchasePrice) || 0)
    const tax = Number(i.taxAmount) || 0
    return acc + base + tax
  }, 0)
  const numPaid = paidAmount === "" ? total : Number(paidAmount) || 0
  const balanceDue = Math.max(0, total - numPaid)
  const isCredit = balanceDue > 0

  // Commit purchase
  const handleComplete = async () => {
    if (!selectedSupplier || purchaseItems.length === 0 || !user?.uid) return
    setIsSubmitting(true)
    try {
      const supplierId = (selectedSupplier as any)._id || selectedSupplier.id

      for (const item of purchaseItems) {
        let finalProductId = item.productId

        // Strict de-duplication: match by existing ID, or matching SKU / Item Code, or matching product name
        const itemSku = (item.sku || "").trim().toLowerCase()
        const itemName = (item.productName || "").trim().toLowerCase()

        const existing = products.find(p => {
          if (p.id === item.productId) return true
          const pSku = (p.sku || "").trim().toLowerCase()
          if (itemSku && pSku && itemSku === pSku) return true
          const pName = (p.name || "").trim().toLowerCase()
          if (itemName && pName && itemName === pName) return true
          return false
        })

        if (existing) {
          // EXISTING PRODUCT: Update stock, latest MRP, latest cost, and keep same SKU/title to prevent duplicates!
          finalProductId = existing.id
          const patchRes = await fetch(`/api/products/${existing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-user-id": user.uid },
            credentials: "include",
            body: JSON.stringify({
              stock: Number(existing.stock || 0) + Number(item.quantity),
              purchasePrice: Number(item.purchasePrice),
              sellingPrice: Number(item.sellingPrice), // Update latest MRP
              category: item.category || existing.category,
              minStock: Number(item.minStock || existing.minStock || 2),
            }),
          })
          if (!patchRes.ok) throw new Error(`Failed updating ${item.productName}`)
        } else {
          // TRULY NEW PRODUCT: Create once in inventory
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
              skipPurchase: true, // Prevents duplicate purchase creation since we create purchase below
            }),
          })
          if (!createRes.ok) throw new Error(`Failed to create product ${item.productName}`)
          const created = await createRes.json()
          finalProductId = created.id || created._id
        }

        // Always save the exact purchase price and billing date in Purchase History
        const purchaseRes = await fetch("/api/purchases", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": user.uid },
          credentials: "include",
          body: JSON.stringify({
            supplierId,
            productId: finalProductId,
            productName: item.productName,
            itemCode: item.sku || "",
            quantity: Number(item.quantity),
            purchasePrice: Number(item.purchasePrice), // Exactly preserved historical purchase cost
            taxRate: Number(item.taxRate) || 0,
            taxAmount: Number(item.taxAmount) || 0,
            billingDate,
          }),
        })
        if (!purchaseRes.ok) {
          console.error("Purchase save failed for", item.productName)
        }
      }

      // Record upfront payment to SupplierPayments & Cashbook
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
        title: "Purchase Completed ✓", 
        description: `Successfully processed ${purchaseItems.length} products.${isCredit ? ` Balance Due: ₹${balanceDue.toLocaleString()}` : ""}` 
      })
      handleResetToNewBill()
      fetchAll()
    } catch (err: any) {
      console.error("UPDATE ERROR:", err)
      toast({ variant: "destructive", title: "Operation Failed", description: err.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 w-full max-w-full pb-10 animate-in fade-in duration-500">

      {/* ── 1. HEADER & QUICK NAVIGATION ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-headline font-bold">
              Inward <span className="text-accent">Bulk Terminal</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Sheet interface for procurement with AI scanning & credit tracking.</p>
          </div>
        </div>

        {/* Quick Nav Buttons: History & Suppliers */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push("/purchases/purchase-history")}
            className="h-9 px-3 text-xs font-bold gap-1.5 rounded-xl border-border/60 hover:bg-secondary/60 hover:text-accent shadow-sm"
          >
            <Receipt className="w-4 h-4 text-accent" />
            <span>History</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push("/purchases/suppliers")}
            className="h-9 px-3 text-xs font-bold gap-1.5 rounded-xl border-border/60 hover:bg-secondary/60 hover:text-accent shadow-sm"
          >
            <Truck className="w-4 h-4 text-accent" />
            <span>Suppliers</span>
          </Button>
        </div>
      </div>

      {/* ── BILL NAVIGATOR BAR: Date & Bill Number Steppers ── */}
      <div className="bg-card border border-border/60 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          
          {/* Bill Number Stepper < Bill #N > */}
          <div className="flex items-center bg-secondary/40 border border-border/50 rounded-xl p-1 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg hover:bg-secondary text-foreground hover:text-accent"
              onClick={handlePrevBill}
              disabled={pastBills.length === 0 || currentBillIndex === 0}
              title="Previous Past Bill"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="px-2 text-center min-w-[90px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block leading-tight">Bill No</span>
              <span className="text-xs font-bold font-code text-accent">
                {currentBillIndex === -1 ? `New Entry` : `Bill #${pastBills[currentBillIndex]?.billNumber}`}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg hover:bg-secondary text-foreground hover:text-accent"
              onClick={handleNextBill}
              disabled={currentBillIndex === -1}
              title="Next Bill (or New Bill)"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Bill Date Stepper & Picker < Bill Date: DD/MM/YYYY > */}
          <div className="flex items-center bg-secondary/40 border border-border/50 rounded-xl p-1 gap-1 relative group">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg hover:bg-secondary text-foreground hover:text-accent shrink-0"
              onClick={handlePrevDate}
              title="Previous Date"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="px-2 text-center min-w-[130px] relative cursor-pointer" title="Click to pick or change bill date">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block leading-tight">
                Bill Date
              </span>
              <div className="flex items-center justify-center gap-1.5">
                <Calendar className="w-3 h-3 text-accent" />
                <span className="text-xs font-bold font-code text-foreground">
                  {formatToDDMMYYYY(billingDate)}
                </span>
                {billingDate === new Date().toISOString().split("T")[0] ? (
                  <Badge className="text-[8px] px-1 py-0 h-3.5 bg-accent/20 text-accent font-bold">
                    Today
                  </Badge>
                ) : (
                  <Badge className="text-[8px] px-1 py-0 h-3.5 bg-blue-500/20 text-blue-400 font-bold">
                    Invoice
                  </Badge>
                )}
              </div>
              <input
                type="date"
                value={billingDate}
                onChange={e => {
                  if (e.target.value) setBillingDate(e.target.value)
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Change bill date"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg hover:bg-secondary text-foreground hover:text-accent shrink-0"
              onClick={handleNextDate}
              title="Next Date"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Past Bills Count */}
          {pastBills.length > 0 && (
            <Badge variant="outline" className="text-[10px] font-code h-7 px-2.5 bg-secondary/20">
              {pastBills.length} Past Bill{pastBills.length === 1 ? "" : "s"}
            </Badge>
          )}
        </div>

        {/* Current State / Reset to New Bill */}
        <div className="flex items-center gap-2">
          {currentBillIndex !== -1 ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-xs py-1 px-2.5 font-bold">
                Reviewing Bill #{pastBills[currentBillIndex]?.billNumber} • {pastBills[currentBillIndex]?.supplierName}
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="default"
                className="h-8 text-xs font-bold bg-accent text-accent-foreground hover:brightness-110 rounded-xl shadow-sm gap-1"
                onClick={handleResetToNewBill}
                title="Exit review and start a clear new bill"
              >
                <Plus className="w-3.5 h-3.5" />
                New Bill (Clear)
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs py-1 px-2.5 font-bold">
                ✓ New Bill Entry
              </Badge>
              {(purchaseItems.length > 0 || selectedSupplier) && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-bold border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 rounded-xl gap-1 transition-colors"
                  onClick={handleResetToNewBill}
                  title="Clear entire sheet and start fresh"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Clear Sheet
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 2. TOP CONTROLS ROW: 3 Responsive Cards Above the Acquisition Sheet ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">

        {/* Card 1: Supplier Selector */}
        <Card className="border-none bg-card shadow-sm flex flex-col">
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-accent" /> Supplier
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
          <CardContent className="px-4 pb-4 flex-1 flex flex-col justify-center">
            {!selectedSupplier ? (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search vendor / phone..."
                  className="pl-9 h-10 bg-secondary/30 border-none text-xs rounded-lg font-bold"
                  value={supplierSearch}
                  onChange={e => setSupplierSearch(e.target.value)}
                />
                {supplierSearch && filteredSuppliers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-card border border-border/80 rounded-xl mt-2 z-50 shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                    {filteredSuppliers.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        className="w-full p-2.5 text-left hover:bg-secondary/60 flex flex-col border-b border-border/20 last:border-0 transition-colors"
                        onClick={() => { setSelectedSupplier(s); setSupplierSearch("") }}
                      >
                        <span className="font-bold text-xs text-foreground">{s.name}</span>
                        <span className="text-[11px] text-accent font-semibold mt-0.5">📞 {s.phone || "No phone"}</span>
                        {s.contactPerson && (
                          <span className="text-[10px] text-muted-foreground">{s.contactPerson}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-2.5 bg-accent/10 rounded-lg border border-accent/25">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs text-foreground truncate">{selectedSupplier.name}</p>
                    <p className="text-[11px] text-accent font-semibold mt-0.5">
                      📞 {selectedSupplier.phone || "No phone added"}
                    </p>
                    {selectedSupplier.contactPerson && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        Contact: {selectedSupplier.contactPerson}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">GSTIN:</span>
                      <span className="text-[10px] font-code font-bold text-foreground">
                        {selectedSupplier.gstNumber || "Not recorded"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-accent/80 hover:text-accent hover:bg-accent/10"
                      onClick={handleOpenEditSupplier}
                      title="Edit Supplier Details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setSelectedSupplier(null)}
                      title="Unselect Supplier"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Auto-detected Bill GST Update Banner */}
                {detectedGstForSupplier && selectedSupplier.gstNumber !== detectedGstForSupplier && (
                  <div className="mt-2 p-2 bg-amber-500/15 border border-amber-500/40 rounded-lg flex flex-col gap-1.5 animate-in fade-in">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-amber-400 font-bold">New Bill GST Found:</span>
                      <span className="font-code font-bold text-amber-300">{detectedGstForSupplier}</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="h-6 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 px-2 rounded w-full shadow-sm"
                      onClick={handleUpdateSupplierGst}
                      disabled={isUpdatingSupplierGst}
                    >
                      {isUpdatingSupplierGst ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                      Update Supplier GSTIN
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: AI Invoice Scanner */}
        <InvoiceScanner key={scannerKey} onScanComplete={handleScanComplete} disabled={isSubmitting} existingCategories={categories} />

        {/* Card 3: Fast Add Products (Only 5 Best Selling / Search Results) */}
        <Card className="border-none bg-card shadow-sm flex flex-col">
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Fast Add (Top 5)
            </CardTitle>
            <Dialog open={isAddProductOpen} onOpenChange={(open) => {
              setIsAddProductOpen(open)
              if (!open) setQuickSelectSearch("")
            }}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] font-bold text-accent uppercase tracking-widest hover:bg-accent/10 px-1.5">
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
          <CardContent className="px-4 pb-4 space-y-2 flex-1 flex flex-col justify-between">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search or pick top 5..."
                className="pl-8 h-8 bg-secondary/30 border-none text-xs rounded-lg"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1 max-h-[145px] overflow-y-auto pr-0.5">
              {fastAddDisplayProducts.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addItem(p)}
                  className="w-full px-2 py-1.5 rounded-lg border border-transparent hover:border-accent/30 hover:bg-accent/5 flex justify-between items-center group transition-all text-left"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-[11px] group-hover:text-accent truncate">{p.name}</p>
                    <p className="text-[9px] text-muted-foreground font-code">{p.sku} • {p.category}</p>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-code h-4 px-1 py-0 shrink-0">₹{p.purchasePrice}</Badge>
                </button>
              ))}
              {fastAddDisplayProducts.length === 0 && (
                <p className="text-[10px] text-center py-2 text-muted-foreground italic">No products available</p>
              )}
            </div>
          </CardContent>
        </Card>

      </div>

      {/* ── 3. ACQUISITION SHEET (FULL WIDTH under the top controls) ── */}
      <Card className="border-none bg-card shadow-xl overflow-hidden w-full">
        <CardHeader className="bg-secondary/20 border-b border-border/50 py-3 px-4 md:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <Calculator className="w-5 h-5 text-accent shrink-0" />
            <div className="min-w-0">
              <CardTitle className="text-base md:text-lg">Acquisition Sheet</CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Bulk Editor with Category, MRP & Alert Level
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="font-code text-xs py-1 px-3">
              {purchaseItems.length} Product{purchaseItems.length === 1 ? "" : "s"}
            </Badge>
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
              style={{ color: '#ffffff', backgroundColor: '#182030' }}
              className="h-9 mt-1 text-xs border border-slate-600 font-bold rounded-lg font-code"
              value={paidAmount}
              onChange={e => setPaidAmount(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payment Mode</Label>
            <Select value={paymentMode} onValueChange={setPaymentMode}>
              <SelectTrigger className="h-9 mt-1 text-xs bg-background border-border/50">
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
              <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-400 font-bold py-1.5 px-3 text-xs">
                Credit Bill • Balance: ₹{balanceDue.toLocaleString()}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-emerald-500/50 bg-emerald-500/10 text-emerald-400 font-bold py-1.5 px-3 text-xs">
                ✓ Fully Paid
              </Badge>
            )}
          </div>
        </div>

        {/* ── Table (Unified Mobile & Desktop) ── */}
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <Table className="min-w-[940px] w-full">
              <TableHeader className="bg-secondary/20 border-b border-border/50">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="w-10 text-center text-[10px] font-bold uppercase py-3 px-2">#</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase py-3 px-2 min-w-[170px]">Item Name</TableHead>
                  <TableHead className="w-[180px] text-[10px] font-bold uppercase py-3 px-2">
                    <div className="flex items-center justify-between">
                      <span>Category</span>
                      {purchaseItems.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[9px] text-accent font-bold hover:bg-accent/10 tracking-normal"
                          onClick={() => handleApplyCategoryToAll(purchaseItems[0]?.category)}
                          title="Apply 1st item's category to all products"
                        >
                          <Layers className="w-2.5 h-2.5 mr-1" /> Apply 1st to All
                        </Button>
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="w-[75px] text-[10px] font-bold uppercase py-3 px-1 text-center">Qty</TableHead>
                  <TableHead className="w-[105px] text-[10px] font-bold uppercase py-3 px-1 text-right">Cost (₹)</TableHead>
                  <TableHead className="w-[80px] text-[10px] font-bold uppercase py-3 px-1 text-center">GST (%)</TableHead>
                  <TableHead className="w-[95px] text-[10px] font-bold uppercase py-3 px-1 text-right">GST (₹)</TableHead>
                  <TableHead className="w-[105px] text-[10px] font-bold uppercase py-3 px-1 text-right">MRP (₹)</TableHead>
                  <TableHead className="w-[80px] text-[10px] font-bold uppercase py-3 px-1 text-center">Alert Lvl</TableHead>
                  <TableHead className="w-[110px] text-right text-[10px] font-bold uppercase py-3 px-2">Subtotal (₹)</TableHead>
                  <TableHead className="w-10 py-3 px-2" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseItems.map((item, index) => {
                  const lineBase = (Number(item.quantity) || 0) * (Number(item.purchasePrice) || 0)
                  const lineTax = Number(item.taxAmount) || 0
                  const lineSubtotal = lineBase + lineTax

                  return (
                    <TableRow key={item.productId} className="border-border/30 group hover:bg-secondary/10">
                      <TableCell className="text-center font-code text-xs text-muted-foreground py-2.5 px-2">{index + 1}</TableCell>
                      <TableCell className="py-2.5 px-2">
                        <p className="font-bold text-xs text-foreground leading-snug">{item.productName}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">Code:</span>
                          <input
                            type="text"
                            placeholder="Code / SKU"
                            value={item.sku || ""}
                            onChange={e => updateItem(item.productId, "sku", e.target.value)}
                            style={{
                              color: '#38bdf8',
                              backgroundColor: '#0f172a',
                              WebkitTextFillColor: '#38bdf8',
                            }}
                            className="h-5 px-1.5 text-[10px] font-code font-bold border border-slate-600 rounded focus:border-cyan-400 focus:outline-none w-28"
                            title="Item Code / SKU (used for customer search & inventory)"
                          />
                          {item.isNewProduct && (
                            <Badge className="text-[8px] bg-accent/20 text-accent hover:bg-accent/30 px-1 py-0 h-4">
                              New
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
                            <SelectTrigger className="h-9 text-xs bg-[#0f172a] border border-slate-600 text-foreground flex-1 rounded-lg">
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
                            className="h-8 w-8 shrink-0 hover:bg-accent/10 text-muted-foreground hover:text-accent"
                            onClick={() => handleApplyCategoryToAll(item.category)}
                            title={`Apply category "${item.category}" to all items`}
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </Button>
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
                      <TableCell className="py-2.5 px-1 text-center">
                        <input
                          type="number"
                          min={1}
                          style={{
                            color: '#ffffff',
                            backgroundColor: '#0f172a',
                            WebkitTextFillColor: '#ffffff',
                          }}
                          className="w-16 h-9 px-2 text-xs border-2 border-slate-600 font-bold text-center rounded-lg shadow-sm focus:border-cyan-400 focus:outline-none mx-auto block"
                          value={item.quantity ?? 1}
                          onChange={e => updateItem(item.productId, "quantity", e.target.value === "" ? "" : Number(e.target.value))}
                        />
                      </TableCell>

                      {/* Purchase Price (Cost) */}
                      <TableCell className="py-2.5 px-1 text-right">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          style={{
                            color: '#fbbf24',
                            backgroundColor: '#0f172a',
                            WebkitTextFillColor: '#fbbf24',
                          }}
                          className="w-24 h-9 px-2 text-xs border-2 border-slate-600 font-bold text-right font-code rounded-lg shadow-sm focus:border-amber-400 focus:outline-none ml-auto block"
                          value={item.purchasePrice ?? 0}
                          onChange={e => updateItem(item.productId, "purchasePrice", e.target.value === "" ? "" : Number(e.target.value))}
                        />
                      </TableCell>

                      {/* GST (%) */}
                      <TableCell className="py-2.5 px-1 text-center">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="any"
                          placeholder="0%"
                          style={{
                            color: '#38bdf8',
                            backgroundColor: '#0f172a',
                            WebkitTextFillColor: '#38bdf8',
                          }}
                          className="w-16 h-9 px-1 text-xs border-2 border-slate-600 font-bold text-center font-code rounded-lg shadow-sm focus:border-cyan-400 focus:outline-none mx-auto block"
                          value={item.taxRate ?? 0}
                          onChange={e => updateItem(item.productId, "taxRate", e.target.value === "" ? "" : Number(e.target.value))}
                        />
                      </TableCell>

                      {/* GST (₹) */}
                      <TableCell className="py-2.5 px-1 text-right">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          placeholder="0"
                          style={{
                            color: '#38bdf8',
                            backgroundColor: '#0f172a',
                            WebkitTextFillColor: '#38bdf8',
                          }}
                          className="w-20 h-9 px-1.5 text-xs border-2 border-slate-600 font-bold text-right font-code rounded-lg shadow-sm focus:border-cyan-400 focus:outline-none ml-auto block"
                          value={item.taxAmount ?? 0}
                          onChange={e => updateItem(item.productId, "taxAmount", e.target.value === "" ? "" : Number(e.target.value))}
                        />
                      </TableCell>

                      {/* MRP (Selling Price) */}
                      <TableCell className="py-2.5 px-1 text-right">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          style={{
                            color: '#34d399',
                            backgroundColor: '#0f172a',
                            WebkitTextFillColor: '#34d399',
                          }}
                          className="w-24 h-9 px-2 text-xs border-2 border-slate-600 font-bold text-right font-code rounded-lg shadow-sm focus:border-emerald-400 focus:outline-none ml-auto block"
                          value={item.sellingPrice ?? 0}
                          onChange={e => updateItem(item.productId, "sellingPrice", e.target.value === "" ? "" : Number(e.target.value))}
                        />
                      </TableCell>

                      {/* Alert Level (minStock) */}
                      <TableCell className="py-2.5 px-1 text-center">
                        <input
                          type="number"
                          min={0}
                          style={{
                            color: '#38bdf8',
                            backgroundColor: '#0f172a',
                            WebkitTextFillColor: '#38bdf8',
                          }}
                          className="w-16 h-9 px-2 text-xs border-2 border-slate-600 font-bold text-center rounded-lg shadow-sm focus:border-cyan-400 focus:outline-none mx-auto block"
                          value={item.minStock ?? 2}
                          onChange={e => updateItem(item.productId, "minStock", e.target.value === "" ? "" : Number(e.target.value))}
                        />
                      </TableCell>

                      {/* Subtotal */}
                      <TableCell className="py-2.5 px-2 text-right font-code font-bold text-foreground">
                        ₹{lineSubtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
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
                  )
                })}
                {purchaseItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="h-72 text-center">
                      <div className="flex flex-col items-center justify-center opacity-30 gap-3">
                        <Package className="w-12 h-12" />
                        <div className="space-y-1">
                          <p className="text-sm font-bold">Terminal Empty</p>
                          <p className="text-xs">Scan an invoice with AI or pick from Fast Add.</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {/* Table Summary Row */}
                {purchaseItems.length > 0 && (
                  <TableRow className="bg-secondary/30 border-t-2 border-border/70 font-bold hover:bg-secondary/30">
                    <TableCell colSpan={3} className="py-3 px-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Sheet Total ({purchaseItems.length} Products):
                    </TableCell>
                    <TableCell className="py-3 px-1 text-center text-xs font-bold text-foreground">
                      {purchaseItems.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0)}
                    </TableCell>
                    <TableCell />
                    <TableCell colSpan={2} className="py-3 px-1 text-right text-xs font-bold text-cyan-400 font-code">
                      +₹{totalTax.toLocaleString(undefined, { maximumFractionDigits: 2 })} GST
                    </TableCell>
                    <TableCell colSpan={2} />
                    <TableCell className="py-3 px-2 text-right font-code font-bold text-base text-accent">
                      ₹{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        {/* ── 4. BOTTOM TOTALS & COMMIT ENTRY BAR ── */}
        {purchaseItems.length > 0 && (
          <CardContent className="bg-secondary/20 border-t border-border/60 p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Left: Supplier info & phone */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">
                    {selectedSupplier ? selectedSupplier.name : "No Supplier Selected"}
                  </span>
                  {selectedSupplier?.phone && (
                    <span className="text-xs text-accent font-semibold font-code">
                      • 📞 {selectedSupplier.phone}
                    </span>
                  )}
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

              {/* Right: Bill Total & Big Bottom Commit Entry Button */}
              <div className="flex flex-wrap items-center justify-between sm:justify-end gap-4 sm:gap-6 pt-3 sm:pt-0 border-t sm:border-t-0 border-border/30">
                <div className="text-left sm:text-right">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Bill Total</p>
                  <p className="text-2xl sm:text-3xl font-code font-bold text-accent">₹{total.toLocaleString()}</p>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex gap-2">
                    {currentBillIndex !== -1 ? (
                      <Button
                        type="button"
                        onClick={handleResetToNewBill}
                        className="bg-accent text-accent-foreground font-bold px-6 sm:px-8 rounded-xl shadow-lg shadow-accent/25 h-11 text-sm sm:text-base hover:brightness-110 transition-all gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Start New Bill (Clear)
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl font-bold uppercase tracking-wider text-[10px] h-11 px-4 gap-1.5 hover:text-destructive hover:border-destructive/40"
                          onClick={handleResetToNewBill}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Clear Sheet
                        </Button>
                        <Button
                          type="button"
                          onClick={handleComplete}
                          className={`font-bold px-6 sm:px-8 rounded-xl shadow-lg h-11 text-sm sm:text-base transition-all ${
                            purchaseItems.length === 0 || !selectedSupplier
                              ? "bg-muted text-muted-foreground border border-red-500/50 cursor-not-allowed opacity-60"
                              : "bg-accent text-accent-foreground shadow-accent/25 hover:brightness-110"
                          }`}
                          disabled={purchaseItems.length === 0 || !selectedSupplier || isSubmitting}
                        >
                          {isSubmitting ? (
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          ) : (
                            <Save className="w-5 h-5 mr-2" />
                          )}
                          Commit Entry
                        </Button>
                      </>
                    )}
                  </div>
                  {/* Red validation hints when Commit Entry is disabled */}
                  {currentBillIndex === -1 && (purchaseItems.length === 0 || !selectedSupplier) && (
                    <div className="flex flex-col items-end gap-0.5">
                      {!selectedSupplier && (
                        <p className="text-[11px] font-semibold text-red-400 flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          Select a supplier first
                        </p>
                      )}
                      {purchaseItems.length === 0 && (
                        <p className="text-[11px] font-semibold text-red-400 flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          Add at least one product
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

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

      {/* ── SCANNED NEW SUPPLIER REGISTRATION DIALOG ── */}
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
                    <Phone className="w-3 h-3 text-muted-foreground" /> Full Mobile Number *
                  </Label>
                  <Input
                    className="h-9 text-xs font-code font-bold"
                    placeholder="e.g. 9876543210"
                    value={scannedSupplierForm.phone}
                    onChange={e => setScannedSupplierForm({ ...scannedSupplierForm, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-muted-foreground" /> GSTIN / GST No.
                  </Label>
                  <Input
                    className="h-9 text-xs font-code font-bold uppercase tracking-wide"
                    placeholder="e.g. 32AAAAA0000A1Z5"
                    value={scannedSupplierForm.gstNumber}
                    onChange={e => setScannedSupplierForm({ ...scannedSupplierForm, gstNumber: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                Save &amp; Select Supplier
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── EDIT SELECTED SUPPLIER DIALOG ── */}
      <Dialog open={isEditSupplierOpen} onOpenChange={setIsEditSupplierOpen}>
        <DialogContent className="sm:max-w-md">
          {selectedSupplier && (
            <form onSubmit={handleUpdateSupplier}>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-accent" /> Edit Supplier Details
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Update vendor contact information and phone number.
                </p>
              </DialogHeader>

              <div className="grid gap-3 py-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Vendor / Company Name *</Label>
                  <Input
                    className="h-9 text-xs"
                    value={editSupplierForm.name}
                    onChange={e => setEditSupplierForm({ ...editSupplierForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <Phone className="w-3 h-3 text-muted-foreground" /> Full Mobile Number *
                    </Label>
                    <Input
                      className="h-9 text-xs font-code font-bold"
                      placeholder="e.g. 9876543210"
                      value={editSupplierForm.phone}
                      onChange={e => setEditSupplierForm({ ...editSupplierForm, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <CreditCard className="w-3 h-3 text-muted-foreground" /> GSTIN / GST No.
                    </Label>
                    <Input
                      className="h-9 text-xs font-code font-bold uppercase tracking-wide"
                      placeholder="e.g. 32AAAAA0000A1Z5"
                      value={editSupplierForm.gstNumber}
                      onChange={e => setEditSupplierForm({ ...editSupplierForm, gstNumber: e.target.value.toUpperCase() })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <Mail className="w-3 h-3 text-muted-foreground" /> Email
                    </Label>
                    <Input
                      type="email"
                      className="h-9 text-xs"
                      placeholder="vendor@example.com"
                      value={editSupplierForm.email}
                      onChange={e => setEditSupplierForm({ ...editSupplierForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" /> Address
                    </Label>
                    <Input
                      className="h-9 text-xs"
                      placeholder="Address"
                      value={editSupplierForm.address}
                      onChange={e => setEditSupplierForm({ ...editSupplierForm, address: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setIsEditSupplierOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isUpdatingSupplier || !editSupplierForm.name.trim()}
                  className="bg-accent text-accent-foreground text-xs font-bold"
                >
                  {isUpdatingSupplier && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}
