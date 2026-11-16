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
import { cn } from "@/lib/utils"
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
import { findBestProductMatch } from "@/lib/product-fuzzy-matcher"
import {
  Bill,
  SupplierPaymentRecord,
  groupPurchasesIntoBills,
  toArray,
} from "@/lib/purchase-bills"

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
  mrp?: number                     // printed MRP from supplier bill
  stock: number
  minStock: number
  category: string
}

interface PurchaseItem {
  rowId: string                    // unique per sheet row (used for React key, edit, delete)
  purchaseId?: string              // id of the saved purchase record (only for rows of a saved bill)
  productId: string
  productName: string
  sku: string
  billItemCode?: string
  hsnCode?: string
  generatedSku?: string
  isManuallyEditedSku?: boolean
  quantity: number | string
  purchasePrice: number | string
  sellingPrice: number | string    // SELLING PRICE (typed manually or auto margin)
  mrp?: number | string            // MRP printed on the bill (reference)
  sellingManual?: boolean          // true when user typed the selling price by hand
  category: string
  minStock: number | string        // Alert Level
  taxRate?: number | string        // GST %
  taxAmount?: number | string      // GST ₹
  isNewProduct?: boolean
}

// Item shape returned by the AI invoice scanner
type ScannedItem = ScanResult["items"][number]

// Unique id for every row in the acquisition sheet
const newRowId = () => `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

// Unique id for every bill (saved on each purchase row so the bill can be found again)
const newBillId = () => `bill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const isRealProductId = (id?: string) => !!id && !id.startsWith("temp-") && !id.startsWith("past-")

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
  const [pastBills, setPastBills] = React.useState<Bill[]>([])
  const [currentBillIndex, setCurrentBillIndex] = React.useState<number>(-1)  // -1 = new bill
  const [scannerKey, setScannerKey] = React.useState(0)

  // Editing a saved bill + opening a bill from the History page (?bill=KEY)
  const [isEditing, setIsEditing] = React.useState(false)
  const [pendingOpenBillKey, setPendingOpenBillKey] = React.useState<string | null>(null)

  // Invoice Item Code Preference: False by default (first use app codes SX-XXXX). User can tick to use bill item codes.
  const [useBillItemCode, setUseBillItemCode] = React.useState<boolean>(false)

  // Bill-level discount (typed manually) and round-off
  const [discountInput, setDiscountInput] = React.useState<string>("")
  const [roundOffEnabled, setRoundOffEnabled] = React.useState(false)

  const round2 = (n: number) => Number(n.toFixed(2))

  // Billing Date & Payment (Credit)
  const [billingDate, setBillingDate] = React.useState<string>(() => new Date().toISOString().split("T")[0])
  const [paidAmount, setPaidAmount] = React.useState<string>("")
  const [paymentMode, setPaymentMode] = React.useState<string>("Cash")

  // Autocomplete suggestions state for Item Name & Code inputs
  const [activeSuggestionRowId, setActiveSuggestionRowId] = React.useState<string | null>(null)
  const [activeSuggestionField, setActiveSuggestionField] = React.useState<"name" | "sku" | null>(null)
  const [activeSuggestionQuery, setActiveSuggestionQuery] = React.useState<string>("")
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = React.useState<number>(0)

  // Compute matching products for autocomplete dropdown
  const matchingSuggestions = React.useMemo(() => {
    if (!activeSuggestionRowId || !activeSuggestionQuery.trim()) return []
    const q = activeSuggestionQuery.trim().toLowerCase()
    const qClean = q.replace(/[^a-z0-9]/g, "")

    return products
      .filter(p => {
        const pName = (p.name || "").toLowerCase()
        const pSku = (p.sku || "").toLowerCase()
        const pNameClean = pName.replace(/[^a-z0-9]/g, "")
        const pSkuClean = pSku.replace(/[^a-z0-9]/g, "")

        if (activeSuggestionField === "sku") {
          return pSku.includes(q) || pSkuClean.includes(qClean) || pName.includes(q)
        }
        return pName.includes(q) || pNameClean.includes(qClean) || pSku.includes(q)
      })
      .slice(0, 8)
  }, [products, activeSuggestionRowId, activeSuggestionQuery, activeSuggestionField])

  // Apply existing product details to a sheet row
  const applyProductToRow = (rowId: string, product: Product) => {
    setPurchaseItems(prev => prev.map(item => {
      if (item.rowId !== rowId) return item

      const cost = Number(product.purchasePrice) || 0
      const qty = Number(item.quantity) || 1
      const mrp = Number(product.mrp || product.sellingPrice || 0)
      const selling = Number(product.sellingPrice) || (mrp > 0 ? mrp : Math.round(cost * 1.25))
      const taxRate = Number(item.taxRate) || 0
      const taxAmount = taxRate > 0 ? Number(((qty * cost * taxRate) / 100).toFixed(2)) : (Number(item.taxAmount) || 0)

      return {
        ...item,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        generatedSku: product.sku,
        category: product.category || item.category || "General",
        purchasePrice: cost,
        mrp: mrp,
        sellingPrice: selling,
        minStock: Number(product.minStock) || 2,
        taxRate: taxRate,
        taxAmount: taxAmount,
        isNewProduct: false,
        isManuallyEditedSku: false,
      }
    }))

    setActiveSuggestionRowId(null)
    setActiveSuggestionQuery("")
    toast({
      title: "Product Loaded ✓",
      description: `${product.name} (${product.sku}) - In Stock: ${product.stock}`,
    })
  }

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
      const [suppliersRes, productsRes, salesRes, purchasesRes, paymentsRes] = await Promise.all([
        fetch("/api/suppliers", { headers, credentials: "include" }),
        fetch("/api/products", { headers, credentials: "include" }),
        fetch("/api/sales", { headers, credentials: "include" }).catch(() => null),
        fetch("/api/purchases", { headers, credentials: "include" }).catch(() => null),
        fetch("/api/supplier-payments", { headers, credentials: "include" }).catch(() => null),
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

      // Group past purchases into real bills (same numbers as the Purchase History page)
      if (purchasesRes && purchasesRes.ok) {
        const purchasesData = await purchasesRes.json()
        let payments: SupplierPaymentRecord[] | null = null
        if (paymentsRes && paymentsRes.ok) {
          try {
            payments = toArray<SupplierPaymentRecord>(await paymentsRes.json())
          } catch {
            payments = null
          }
        }
        setPastBills(groupPurchasesIntoBills(toArray(purchasesData), payments, fetchedSuppliers))
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

  // Load a saved bill into the sheet (read-only until "Edit Bill" is pressed)
  const loadBillData = (bill: Bill) => {
    setIsEditing(false)
    setBillingDate(bill.date)
    const supp = suppliers.find(s => s.id === bill.supplierId || (s as any)._id === bill.supplierId)
    setSelectedSupplier(supp || {
      id: bill.supplierId,
      name: bill.supplierName,
      phone: bill.supplierPhone,
      contactPerson: "",
      email: "",
      address: "",
      gstNumber: "",
    })

    setPaidAmount(bill.paid !== null ? String(bill.paid) : "")
    setDiscountInput(bill.discount > 0 ? String(bill.discount) : "")
    setRoundOffEnabled(bill.roundOff !== 0)
    if (bill.paymentMode) setPaymentMode(bill.paymentMode)

    setPurchaseItems(bill.items.map(rec => {
      const prod =
        products.find(p => p.id === rec.productId) ||
        products.find(p =>
          p.name.toLowerCase() === rec.productName.toLowerCase() ||
          (rec.itemCode && p.sku && p.sku.toLowerCase() === rec.itemCode.toLowerCase())
        )
      const cost = Number(rec.purchasePrice) || 0
      return {
        rowId: newRowId(),
        purchaseId: rec.id,
        productId: prod?.id || rec.productId || `past-${Math.random().toString(36).slice(2)}`,
        productName: rec.productName,
        sku: rec.itemCode || prod?.sku || "",
        generatedSku: rec.itemCode || prod?.sku || "",
        quantity: rec.quantity,
        purchasePrice: cost,
        taxRate: rec.taxRate || 0,
        taxAmount: rec.taxAmount || 0,
        sellingPrice: prod?.sellingPrice || Math.round(cost * 1.25),
        mrp: prod?.mrp || 0,
        category: prod?.category || "General",
        minStock: prod?.minStock || 2,
        isNewProduct: false,
      }
    }))
  }

  const handlePrevBill = () => {
    if (pastBills.length === 0 || isEditing) return
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
    if (pastBills.length === 0 || currentBillIndex === -1 || isEditing) return
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
    if (isEditing) return
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
    if (isEditing) return
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
    setIsEditing(false)
    setPendingOpenBillKey(null)
    setPurchaseItems([createBlankRow()])
    setSelectedSupplier(null)
    setDetectedGstForSupplier(null)
    setBillingDate(new Date().toISOString().split("T")[0])
    setPaidAmount("")
    setDiscountInput("")
    setRoundOffEnabled(false)
    setScannerKey(k => k + 1)
    toast({ title: "New Bill Entry", description: "Sheet cleared for fresh purchase entry." })
  }

  // Read ?bill=KEY from the URL (sent by the "View Bill" button on the History page)
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const key = new URLSearchParams(window.location.search).get("bill")
    if (key) setPendingOpenBillKey(key)
  }, [])

  // Open the requested bill once the bills have loaded
  React.useEffect(() => {
    if (!pendingOpenBillKey || loadingData) return
    const idx = pastBills.findIndex(b => b.key === pendingOpenBillKey)
    if (idx >= 0) {
      setCurrentBillIndex(idx)
      loadBillData(pastBills[idx])
    } else {
      toast({
        variant: "destructive",
        title: "Bill not found",
        description: "That bill could not be found. It may have been changed or removed.",
      })
    }
    setPendingOpenBillKey(null)
    if (typeof window !== "undefined" && window.location.search.includes("bill=")) {
      window.history.replaceState(null, "", window.location.pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOpenBillKey, pastBills, loadingData])

  const handleStartEdit = () => {
    if (currentBillIndex === -1) return
    setIsEditing(true)
    toast({
      title: "Edit Mode",
      description: "Change items, quantities, prices or the supplier, then press Update Bill.",
    })
  }

  const handleCancelEdit = () => {
    const bill = pastBills[currentBillIndex]
    if (bill) loadBillData(bill)
    else setIsEditing(false)
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
    mrp?: number
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

      const newItem: PurchaseItem = {
        rowId: newRowId(),
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: 1,
        purchasePrice: product.purchasePrice || 0,
        mrp: product.mrp || 0,
        sellingPrice: product.sellingPrice || (product.mrp && product.mrp > 0 ? product.mrp : Math.round((product.purchasePrice || 0) * 1.25)),
        category: product.category || "General",
        minStock: product.minStock || 2,
        taxRate: 0,
        taxAmount: 0,
        isNewProduct: false,
      }

      // If the sheet currently only has 1 blank row, replace it with the selected product
      if (prev.length === 1 && !prev[0].productName.trim() && Number(prev[0].purchasePrice || 0) === 0) {
        return [newItem]
      }

      return [...prev, newItem]
    })
    setProductSearch("")
  }

  // Helper to create a clean blank row for fast manual entry
  const createBlankRow = (cat?: string): PurchaseItem => {
    const autoSku = generateSKU()
    return {
      rowId: newRowId(),
      productId: `temp-${Math.random().toString(36).slice(2)}`,
      productName: "",
      sku: autoSku,
      generatedSku: autoSku,
      billItemCode: "",
      quantity: 1,
      purchasePrice: 0,
      mrp: 0,
      sellingPrice: 0,
      category: cat || categories[0] || "General",
      minStock: 2,
      taxRate: 0,
      taxAmount: 0,
      isNewProduct: true,
    }
  }

  const [pendingFocusCell, setPendingFocusCell] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (pendingFocusCell) {
      const raf = requestAnimationFrame(() => {
        const el = document.getElementById(pendingFocusCell) as HTMLInputElement | null
        if (el) {
          el.focus()
          el.select?.()
          setPendingFocusCell(null)
        }
      })
      return () => cancelAnimationFrame(raf)
    }
  }, [purchaseItems, pendingFocusCell])

  // Ensure there is always at least one row in the acquisition sheet for immediate manual entry.
  // Do NOT add a blank row while a bill from ?bill=KEY is still waiting to be opened,
  // and never overwrite rows that were just loaded (functional update checks the latest state).
  React.useEffect(() => {
    if (loadingData || pendingOpenBillKey) return
    setPurchaseItems(prev => (prev.length === 0 ? [createBlankRow()] : prev))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingData, pendingOpenBillKey, purchaseItems.length])

  const TOTAL_INPUT_COLS = 9

  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    colIndex: number
  ) => {
    const item = purchaseItems[rowIndex]
    const isThisRowSuggesting = activeSuggestionRowId === item?.rowId && matchingSuggestions.length > 0

    // 1. Intercept navigation when autocomplete suggestions popup is active
    if (isThisRowSuggesting) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setHighlightedSuggestionIndex(prev => (prev + 1) % matchingSuggestions.length)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setHighlightedSuggestionIndex(prev => (prev - 1 + matchingSuggestions.length) % matchingSuggestions.length)
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        const selectedProduct = matchingSuggestions[highlightedSuggestionIndex]
        if (selectedProduct) {
          e.preventDefault()
          applyProductToRow(item.rowId, selectedProduct)
          // Focus Qty column
          const nextEl = document.getElementById(`cell-${rowIndex}-2`) as HTMLInputElement | null
          nextEl?.focus()
          nextEl?.select?.()
          return
        }
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setActiveSuggestionRowId(null)
        return
      }
    }

    // 2. Code column (colIndex 1) Enter check: If user typed an existing product code, auto-link it!
    if (colIndex === 1 && e.key === "Enter") {
      const typedSku = (item?.sku || "").trim().toLowerCase()
      if (typedSku) {
        const matched = products.find(p => p.sku.trim().toLowerCase() === typedSku || p.name.trim().toLowerCase() === typedSku)
        if (matched) {
          applyProductToRow(item.rowId, matched)
        }
      }
    }

    if (e.key === "Enter") {
      e.preventDefault()

      if (e.shiftKey) {
        if (colIndex > 0) {
          const prevEl = document.getElementById(`cell-${rowIndex}-${colIndex - 1}`) as HTMLInputElement | null
          prevEl?.focus()
          prevEl?.select?.()
        } else if (rowIndex > 0) {
          const prevRowEl = document.getElementById(`cell-${rowIndex - 1}-${TOTAL_INPUT_COLS - 1}`) as HTMLInputElement | null
          prevRowEl?.focus()
          prevRowEl?.select?.()
        }
        return
      }

      if (colIndex < TOTAL_INPUT_COLS - 1) {
        const nextEl = document.getElementById(`cell-${rowIndex}-${colIndex + 1}`) as HTMLInputElement | null
        if (nextEl) {
          nextEl.focus()
          nextEl.select?.()
        }
      } else {
        // Last column completed!
        if (rowIndex < purchaseItems.length - 1) {
          const nextRowEl = document.getElementById(`cell-${rowIndex + 1}-0`) as HTMLInputElement | null
          if (nextRowEl) {
            nextRowEl.focus()
            nextRowEl.select?.()
          }
        } else {
          // Last row completed: AUTO CREATE NEW ROW and focus its first cell!
          const currentCat = purchaseItems[rowIndex]?.category || categories[0] || "General"
          const newRow = createBlankRow(currentCat)
          setPurchaseItems(prev => [...prev, newRow])
          setPendingFocusCell(`cell-${rowIndex + 1}-0`)
        }
      }
    } else if (e.key === "ArrowDown") {
      if (rowIndex < purchaseItems.length - 1) {
        e.preventDefault()
        const downEl = document.getElementById(`cell-${rowIndex + 1}-${colIndex}`) as HTMLInputElement | null
        downEl?.focus()
        downEl?.select?.()
      }
    } else if (e.key === "ArrowUp") {
      if (rowIndex > 0) {
        e.preventDefault()
        const upEl = document.getElementById(`cell-${rowIndex - 1}-${colIndex}`) as HTMLInputElement | null
        upEl?.focus()
        upEl?.select?.()
      }
    }
  }

  const removeItem = (rowId: string) =>
    setPurchaseItems(prev => {
      const filtered = prev.filter(i => i.rowId !== rowId)
      return filtered.length === 0 ? [createBlankRow()] : filtered
    })

  const updateItem = (rowId: string, field: keyof PurchaseItem, value: any) => {
    setPurchaseItems(prev => prev.map(i => {
      if (i.rowId !== rowId) return i
      const updated = { ...i, [field]: value }
      if (field === "sku") {
        updated.isManuallyEditedSku = true
      }
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
        // Auto-create supplier in database so user is never blocked from saving!
        const suppPayload = {
          name: result.supplierName.trim(),
          contactPerson: result.supplierContactPerson?.trim() || result.supplierName.trim(),
          phone: result.supplierPhone?.trim() || "",
          email: result.supplierEmail?.trim() || "",
          address: result.supplierAddress?.trim() || "",
          gstNumber: result.supplierGst?.trim() || "",
        }
        try {
          const sRes = await fetch("/api/suppliers", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": user.uid },
            credentials: "include",
            body: JSON.stringify(suppPayload),
          })
          if (sRes.ok) {
            const newSupp = await sRes.json()
            setSuppliers(prev => [newSupp, ...prev])
            setSelectedSupplier(newSupp)
            toast({
              title: "Supplier Registered & Selected ✓",
              description: `${newSupp.name} linked to this purchase bill.`,
            })
          } else {
            setScannedSupplierForm(suppPayload)
            setScannedSupplierOpen(true)
          }
        } catch {
          setScannedSupplierForm(suppPayload)
          setScannedSupplierOpen(true)
        }
      }
    }

    // 4. Process scanned items with strict de-duplication:
    // Identify products by full clean name and size.
    // Different sizes (e.g. 110 MM vs 75 MM) are NEVER combined!
    const dedupedScanItems: ScannedItem[] = []
    const seenScanMap = new Map<string, number>()

    for (const rawItem of result.items) {
      const sCode = (rawItem.itemCode || "").trim().toLowerCase()
      const sName = (rawItem.name || "").trim().toLowerCase()
      const cleanName = sName.replace(/[^a-z0-9]/g, "")

      // Product name (with dimensions/size) MUST match for items to be considered duplicates!
      const dedupKey = sCode ? `${cleanName}__${sCode}` : cleanName

      let matchedIdx: number | undefined = undefined
      if (cleanName && seenScanMap.has(dedupKey)) {
        matchedIdx = seenScanMap.get(dedupKey)
      }

      if (matchedIdx !== undefined) {
        // Merge duplicate line on the bill into one single row!
        const existingItem = dedupedScanItems[matchedIdx]
        existingItem.quantity = (Number(existingItem.quantity) || 1) + (Number(rawItem.quantity) || 1)
        existingItem.taxAmount = Number(((Number(existingItem.taxAmount) || 0) + (Number(rawItem.taxAmount) || 0)).toFixed(2))
        if (!existingItem.itemCode && rawItem.itemCode) {
          existingItem.itemCode = rawItem.itemCode
        }
        if (!existingItem.hsnCode && (rawItem as any).hsnCode) {
          existingItem.hsnCode = (rawItem as any).hsnCode
        }
        if (Number(rawItem.mrp) > Number(existingItem.mrp || 0)) {
          existingItem.mrp = rawItem.mrp
        }
      } else {
        const newIdx = dedupedScanItems.length
        if (cleanName) seenScanMap.set(dedupKey, newIdx)
        dedupedScanItems.push({ ...rawItem })
      }
    }

    const newItems: PurchaseItem[] = []
    // Single-entry tracker: ensure NO product ever appears twice or 3 times in the acquisition sheet!
    const sheetMap = new Map<string, number>()

    for (const item of dedupedScanItems) {
      const scannedCode = (item.itemCode || "").trim().toLowerCase()
      const scannedName = (item.name || "").trim().toLowerCase()
      const cleanScanName = scannedName.replace(/[^a-z0-9]/g, "")
      const billCode = (item.itemCode || (item as any).hsnCode || "").trim()

      // Match against existing inventory in stock:
      // Intelligent fuzzy matching (typo tolerant, order independent, size safe)
      const matchResult = findBestProductMatch(item.name || scannedName, scannedCode, products)
      const existing = matchResult?.product || null

      // Normalize category: ensure singular form and match existing categories
      const matchedCat = normalizeCategoryName(item.category || existing?.category || "General", categories)
      if (matchedCat && !categories.includes(matchedCat)) {
        setCustomCategories(prev => Array.from(new Set([...prev, matchedCat])))
      }

      const itemQty = Number(item.quantity) || 1
      const itemCost = item.purchasePrice || (existing?.purchasePrice || 0)
      const itemTaxRate = item.taxRate !== undefined && item.taxRate !== null ? Number(item.taxRate) : 0
      let itemTaxAmount = item.taxAmount !== undefined && item.taxAmount !== null ? Number(item.taxAmount) : 0
      if (itemTaxRate > 0 && itemTaxAmount === 0) {
        itemTaxAmount = Number(((itemQty * Number(itemCost) * itemTaxRate) / 100).toFixed(2))
      }

      const billMrp = Number((item as any).mrp ?? item.sellingPrice ?? 0) || 0
      const itemSelling = existing?.sellingPrice || (billMrp > 0 ? billMrp : Math.round(Number(itemCost) * 1.25))

      // Check if this product was ALREADY added to this bill sheet (merge if already present)
      const sheetDedupKey = existing ? `prod_${existing.id}` : `name_${cleanScanName}`
      let sheetRowIndex: number | undefined = undefined
      if (sheetMap.has(sheetDedupKey)) {
        sheetRowIndex = sheetMap.get(sheetDedupKey)
      }

      if (sheetRowIndex !== undefined) {
        // ALREADY IN SHEET: Merge into the single existing line!
        const targetRow = newItems[sheetRowIndex]
        targetRow.quantity = Number(targetRow.quantity || 0) + itemQty
        targetRow.taxAmount = Number(((Number(targetRow.taxAmount) || 0) + itemTaxAmount).toFixed(2))
        continue
      }

      const targetIdx = newItems.length

      if (existing) {
        // USE EXISTING PRODUCT: MUST ALWAYS USE EXISTING PRODUCT'S ESTABLISHED CODE IN DATABASE!
        newItems.push({
          rowId: newRowId(),
          productId: existing.id,
          productName: existing.name,
          sku: existing.sku,           // Established code in stock (SX-XXXX)
          billItemCode: billCode,
          hsnCode: (item as any).hsnCode || "",
          generatedSku: existing.sku,  // Locked to existing SKU
          isManuallyEditedSku: false,
          quantity: itemQty,
          purchasePrice: itemCost,
          mrp: billMrp > 0 ? billMrp : (existing.mrp || 0),
          sellingPrice: itemSelling,
          category: existing.category || matchedCat,
          minStock: existing.minStock || 2,
          taxRate: itemTaxRate,
          taxAmount: itemTaxAmount,
          isNewProduct: false,
        })
        sheetMap.set(sheetDedupKey, targetIdx)
      } else {
        // TRULY NEW PRODUCT:
        // By default use app code (SX-XXXX); if user ticks useBillItemCode, it switches to bill itemCode
        const autoSku = generateSKU()
        const finalSku = (useBillItemCode && billCode) ? billCode : autoSku

        newItems.push({
          rowId: newRowId(),
          productId: `temp-${Math.random().toString(36).slice(2)}`,
          productName: item.name,
          sku: finalSku,
          billItemCode: billCode,
          hsnCode: (item as any).hsnCode || "",
          generatedSku: autoSku,
          isManuallyEditedSku: false,
          quantity: itemQty,
          purchasePrice: itemCost,
          mrp: billMrp,
          sellingPrice: billMrp > 0 ? billMrp : Math.round(Number(itemCost) * 1.25),
          category: matchedCat,
          minStock: 2,
          taxRate: itemTaxRate,
          taxAmount: itemTaxAmount,
          isNewProduct: true,
        })
        sheetMap.set(sheetDedupKey, targetIdx)
      }
    }

    if (newItems.length > 0) {
      // Starting new bill entry: clear any previous/past items so new bill sheet is completely clean!
      setCurrentBillIndex(-1)
      setIsEditing(false)
      setPaidAmount("")
      setDiscountInput("")
      setPurchaseItems(newItems)
      toast({
        title: "Products Extracted ✨",
        description: `Loaded ${newItems.length} unique product(s) into fresh acquisition sheet without duplicates.`,
      })
    }
  }

  // Toggle Use Bill Item Code:
  // - Already existing products in stock ALWAYS KEEP their established code!
  // - Only new items switch between their bill code and app-generated SX code.
  // - If multiple new items share the same code (e.g. HSN code), make them unique (e.g. 39174000-1).
  const handleToggleUseBillItemCode = (checked: boolean) => {
    setUseBillItemCode(checked)
    let appliedCount = 0
    let noCodeCount = 0

    setPurchaseItems(prev => {
      // First pass: count how many items have each billCode to ensure uniqueness
      const codeUsage = new Map<string, number>()
      const totalCountPerCode = new Map<string, number>()
      if (checked) {
        prev.forEach(it => {
          if (it.isNewProduct && !it.isManuallyEditedSku) {
            const bCode = it.billItemCode?.trim()
            if (bCode) {
              totalCountPerCode.set(bCode, (totalCountPerCode.get(bCode) || 0) + 1)
            }
          }
        })
      }

      return prev.map(item => {
        // 1. Existing products in inventory MUST NEVER have their established code changed!
        if (!item.isNewProduct) {
          return item
        }

        // 2. If user has typed a custom SKU manually in the table, don't overwrite it!
        if (item.isManuallyEditedSku) {
          return item
        }

        const billCode = item.billItemCode?.trim()
        const autoCode = item.generatedSku || generateSKU()

        if (checked) {
          if (billCode) {
            appliedCount++
            const occurrences = totalCountPerCode.get(billCode) || 1
            let uniqueSku = billCode
            if (occurrences > 1) {
              const currentNum = (codeUsage.get(billCode) || 0) + 1
              codeUsage.set(billCode, currentNum)
              uniqueSku = `${billCode}-${currentNum}`
            }
            return {
              ...item,
              sku: uniqueSku,
              generatedSku: autoCode,
            }
          } else {
            noCodeCount++
            return {
              ...item,
              sku: autoCode,
              generatedSku: autoCode,
            }
          }
        } else {
          return {
            ...item,
            sku: autoCode,
            generatedSku: autoCode,
          }
        }
      })
    })

    if (checked) {
      if (appliedCount > 0) {
        toast({
          title: "Using Bill Item Codes ✓",
          description: `Applied supplier bill codes to ${appliedCount} new item(s). Existing products keep their established codes.`,
        })
      } else {
        toast({
          title: "No Supplier Codes on Bill",
          description: "No separate item codes were found on this invoice. Items keep their ShopX app codes (SX-XXXX). You can type custom codes directly in the Code column.",
        })
      }
    } else {
      toast({
        title: "Using App Codes (SX-XXXX) ✓",
        description: "New items switched to auto-generated ShopX codes. Existing products keep their established codes.",
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
      updateItem(item.rowId, "category", cat)
    }
    setInlineCategoryInput("")
    setInlineNewCategoryOpen(false)
    setInlineNewCategoryItemIndex(null)
  }

  // ── Review / edit state of a saved bill ──
  const reviewBill: Bill | null = currentBillIndex >= 0 ? pastBills[currentBillIndex] ?? null : null
  const isReviewLocked = !!reviewBill && !isEditing   // saved bill is shown read-only until "Edit Bill"

  const totalTax = purchaseItems.reduce((acc, i) => acc + (Number(i.taxAmount) || 0), 0)

  // Sum of all lines (cost x qty + GST)
  const subTotal = purchaseItems.reduce((acc, i) => {
    const base = (Number(i.quantity) || 0) * (Number(i.purchasePrice) || 0)
    return acc + base + (Number(i.taxAmount) || 0)
  }, 0)

  // Manual discount (₹), cannot be negative or more than the subtotal
  const discountAmt = Math.min(Math.max(Number(discountInput) || 0, 0), subTotal)
  const afterDiscount = subTotal - discountAmt

  // Round off to the nearest rupee (1192.69 -> 1193.00, round off +0.31)
  const grandTotal = roundOffEnabled ? Math.round(afterDiscount) : afterDiscount
  const roundOffAmt = Number((grandTotal - afterDiscount).toFixed(2))

  // Keep the name "total" so Paid, Balance and Commit still work
  const total = Number(grandTotal.toFixed(2))

  // For a saved bill the paid amount comes from the bill itself (payments are managed in Suppliers)
  const paidUnknown = !!reviewBill && reviewBill.paid === null
  const numPaid = reviewBill
    ? (reviewBill.paid ?? total)
    : (paidAmount === "" ? total : Number(paidAmount) || 0)
  const balanceDue = Math.max(0, total - numPaid)
  const isCredit = balanceDue > 0

  // Rows that really carry a product (the empty spare row at the end is ignored)
  const hasContent = (i: PurchaseItem) => (i.productName || "").trim() !== "" || Number(i.purchasePrice) > 0

  // Commit purchase
  const handleComplete = async () => {
    if (purchaseItems.length === 0 || !user?.uid) return
    const rowsToSave = purchaseItems.filter(hasContent)
    if (rowsToSave.length === 0) {
      toast({ variant: "destructive", title: "Nothing to save", description: "Add at least one product to the bill." })
      return
    }
    setIsSubmitting(true)
    try {
      // Ensure a supplier is selected; if not, automatically select or create a default Cash / Counter supplier
      let currentSupplier = selectedSupplier
      if (!currentSupplier) {
        let defaultSupp = suppliers.find(s =>
          s.name.toLowerCase().includes("cash") ||
          s.name.toLowerCase().includes("counter") ||
          s.name.toLowerCase().includes("direct")
        )
        if (!defaultSupp) {
          const suppRes = await fetch("/api/suppliers", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": user.uid },
            credentials: "include",
            body: JSON.stringify({
              name: "Cash / Counter Purchase",
              contactPerson: "Counter",
              phone: "",
              email: "",
              address: "",
            }),
          })
          if (suppRes.ok) {
            defaultSupp = await suppRes.json()
            setSuppliers(prev => [defaultSupp!, ...prev])
          }
        }
        if (defaultSupp) {
          currentSupplier = defaultSupp
          setSelectedSupplier(defaultSupp)
        }
      }

      const supplierId = (currentSupplier as any)?._id || currentSupplier?.id || ""

      // Every row of this bill carries the same billId so the bill can be found again later
      const billId = newBillId()

      // Local copy of stock so rows for the same product add up correctly,
      // and a product created earlier in this loop is never created twice
      const knownProducts: Product[] = [...products]
      const stockAdded: Record<string, number> = {}

      for (const item of rowsToSave) {
        const itemQty = Math.max(1, Number(item.quantity) || 1)
        const itemCost = Math.max(0, Number(item.purchasePrice) || 0)
        const itemSelling = Math.max(0, Number(item.sellingPrice) || Math.round(itemCost * 1.25))
        const itemMrp = Math.max(0, Number(item.mrp) || 0)
        const itemMinStock = Math.max(0, Number(item.minStock) || 2)
        const itemCategory = (item.category || "General").trim()
        const itemName = (item.productName || "").trim() || "Item"
        const itemSku = (item.sku || "").trim() || generateSKU()

        let finalProductId = item.productId

        // Strict de-duplication: match by existing ID, or matching SKU / Item Code, or matching product name
        const lowerSku = itemSku.toLowerCase()
        const lowerName = itemName.toLowerCase()

        const existing = knownProducts.find(p => {
          if (p.id === item.productId && !item.productId.startsWith('temp-') && !item.productId.startsWith('past-')) return true
          const pSku = (p.sku || "").trim().toLowerCase()
          if (lowerSku && pSku && lowerSku === pSku) return true
          const pName = (p.name || "").trim().toLowerCase()
          if (lowerName && pName && lowerName === pName) return true
          return false
        })

        const isValidExistingId = existing && existing.id && !existing.id.startsWith('temp-') && !existing.id.startsWith('past-')

        if (existing && isValidExistingId) {
          // EXISTING PRODUCT IN STOCK:
          // Update all edited fields: name, sku, category, stock, purchasePrice, sellingPrice, mrp, minStock
          finalProductId = existing.id
          const patchRes = await fetch(`/api/products/${existing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-user-id": user.uid },
            credentials: "include",
            body: JSON.stringify({
              name: itemName,
              sku: itemSku,
              category: itemCategory,
              stock: Number(existing.stock || 0) + (stockAdded[existing.id] || 0) + itemQty,
              purchasePrice: itemCost,
              sellingPrice: itemSelling,
              mrp: itemMrp,
              minStock: itemMinStock,
            }),
          })
          if (!patchRes.ok) throw new Error(`Failed updating ${itemName}`)
          stockAdded[existing.id] = (stockAdded[existing.id] || 0) + itemQty
        } else {
          // TRULY NEW PRODUCT: Create once in inventory in MongoDB Atlas
          const createRes = await fetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": user.uid },
            credentials: "include",
            body: JSON.stringify({
              name: itemName,
              sku: itemSku,
              category: itemCategory,
              purchasePrice: itemCost,
              sellingPrice: itemSelling,
              mrp: itemMrp,
              stock: itemQty,
              minStock: itemMinStock,
              supplierId,
              skipPurchase: true,
            }),
          })
          if (!createRes.ok) throw new Error(`Failed to create product ${itemName}`)
          const created = await createRes.json()
          finalProductId = created.id || created._id

          // Remember it so a later row with the same product updates it instead of creating another
          knownProducts.push({
            id: finalProductId,
            name: itemName,
            sku: itemSku,
            purchasePrice: itemCost,
            sellingPrice: itemSelling,
            mrp: itemMrp,
            stock: itemQty,
            minStock: itemMinStock,
            category: itemCategory,
          })
        }

        // Always save a new purchase log for THIS bill in Purchase History in MongoDB Atlas
        const purchaseRes = await fetch("/api/purchases", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": user.uid },
          credentials: "include",
          body: JSON.stringify({
            supplierId,
            productId: finalProductId,
            productName: itemName,
            itemCode: itemSku,
            quantity: itemQty,
            purchasePrice: itemCost,
            taxRate: Number(item.taxRate) || 0,
            taxAmount: Number(item.taxAmount) || 0,
            billingDate,
            // bill-level details, so the bill can be shown / edited later
            billId,
            billTotal: total,
            discount: discountAmt,
            roundOff: roundOffAmt,
            paidAmount: numPaid,
            paymentMode,
          }),
        })

        if (!purchaseRes.ok) {
          const errBody = await purchaseRes.json().catch(() => ({}))
          console.error("Purchase save failed:", purchaseRes.status, errBody)
          throw new Error(errBody.error || `Purchase save failed for ${itemName} (${purchaseRes.status})`)
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
              note: `Paid on Bill (${billingDate}) - Total: ₹${total.toLocaleString()} [bill:${billId}]`,
            }),
          })

          await fetch("/api/cashbook", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": user.uid },
            credentials: "include",
            body: JSON.stringify({
              type: "expense",
              category: "Purchase / Stock",
              description: `Payment to ${currentSupplier?.name || selectedSupplier?.name || "Supplier"} (Bill ${billingDate})`,
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
        description: `Successfully processed ${rowsToSave.length} products.${isCredit ? ` Balance Due: ₹${balanceDue.toLocaleString()}` : ""}`
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

  // Save the changes made to a saved bill
  //  - changed rows      -> PATCH /api/purchases/[id]
  //  - rows added        -> POST  /api/purchases
  //  - rows removed      -> DELETE /api/purchases/[id]
  //  - product stock is corrected by the difference (new qty - old qty)
  const handleUpdateBill = async () => {
    if (!user?.uid || !reviewBill || !isEditing) return
    const rowsToSave = purchaseItems.filter(hasContent)
    if (rowsToSave.length === 0) {
      toast({ variant: "destructive", title: "Nothing to save", description: "A bill needs at least one product." })
      return
    }

    setIsSubmitting(true)
    const jsonHeaders = { "Content-Type": "application/json", "x-user-id": user.uid }
    const send = async (method: string, url: string, body?: unknown) => {
      const res = await fetch(url, {
        method,
        headers: jsonHeaders,
        credentials: "include",
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const missing = res.status === 404 || res.status === 405
        throw new Error(
          (err as any).error ||
            `${method} ${url} failed (${res.status})${missing ? " — this API route may not exist yet" : ""}`
        )
      }
      return res
    }

    try {
      // Fresh product list so stock changes are based on the real current stock
      let knownProducts: Product[] = [...products]
      try {
        const pr = await fetch("/api/products", { headers: { "x-user-id": user.uid }, credentials: "include" })
        if (pr.ok) {
          const pj = await pr.json()
          if (Array.isArray(pj)) knownProducts = pj
        }
      } catch {
        /* keep the list we already have */
      }

      const supplierId = (selectedSupplier as any)?._id || selectedSupplier?.id || reviewBill.supplierId
      const billId = reviewBill.key

      const ledger: Record<string, number> = {}              // stock change per product
      const productPatches: Record<string, Record<string, unknown>> = {}
      const bump = (id: string, delta: number) => { ledger[id] = (ledger[id] || 0) + delta }

      // 1. take back the quantities of the original bill
      reviewBill.items.forEach(rec => {
        if (isRealProductId(rec.productId)) bump(rec.productId, -(Number(rec.quantity) || 0))
      })

      // 2. work out the product for every row of the edited sheet
      const planned: { item: PurchaseItem; body: Record<string, unknown> }[] = []

      for (const item of rowsToSave) {
        const itemQty = Math.max(1, Number(item.quantity) || 1)
        const itemCost = Math.max(0, Number(item.purchasePrice) || 0)
        const itemSelling = Math.max(0, Number(item.sellingPrice) || Math.round(itemCost * 1.25))
        const itemMrp = Math.max(0, Number(item.mrp) || 0)
        const itemMinStock = Math.max(0, Number(item.minStock) || 2)
        const itemCategory = (item.category || "General").trim()
        const itemName = (item.productName || "").trim() || "Item"
        const itemSku = (item.sku || "").trim() || generateSKU()

        const lowerSku = itemSku.toLowerCase()
        const lowerName = itemName.toLowerCase()

        const existing = knownProducts.find(p => {
          if (isRealProductId(item.productId) && p.id === item.productId) return true
          const pSku = (p.sku || "").trim().toLowerCase()
          if (lowerSku && pSku && lowerSku === pSku) return true
          const pName = (p.name || "").trim().toLowerCase()
          if (lowerName && pName && lowerName === pName) return true
          return false
        })

        let finalProductId = item.productId

        if (existing && isRealProductId(existing.id)) {
          finalProductId = existing.id
          bump(existing.id, itemQty)
          productPatches[existing.id] = {
            name: itemName,
            sku: itemSku,
            category: itemCategory,
            purchasePrice: itemCost,
            sellingPrice: itemSelling,
            mrp: itemMrp,
            minStock: itemMinStock,
          }
        } else if (item.purchaseId && isRealProductId(item.productId)) {
          // the product is no longer in the stock list: keep the old link, do not recreate it
          finalProductId = item.productId
        } else {
          const createRes = await send("POST", "/api/products", {
            name: itemName,
            sku: itemSku,
            category: itemCategory,
            purchasePrice: itemCost,
            sellingPrice: itemSelling,
            mrp: itemMrp,
            stock: itemQty,
            minStock: itemMinStock,
            supplierId,
            skipPurchase: true,
          })
          const created = await createRes.json()
          finalProductId = created.id || created._id
          knownProducts.push({
            id: finalProductId,
            name: itemName,
            sku: itemSku,
            purchasePrice: itemCost,
            sellingPrice: itemSelling,
            mrp: itemMrp,
            stock: itemQty,
            minStock: itemMinStock,
            category: itemCategory,
          })
        }

        planned.push({
          item,
          body: {
            supplierId,
            productId: finalProductId,
            productName: itemName,
            itemCode: itemSku,
            quantity: itemQty,
            purchasePrice: itemCost,
            taxRate: Number(item.taxRate) || 0,
            taxAmount: Number(item.taxAmount) || 0,
            billingDate,
            billId,
            billTotal: total,
            discount: discountAmt,
            roundOff: roundOffAmt,
            ...(reviewBill.paid !== null ? { paidAmount: reviewBill.paid } : {}),
            ...(reviewBill.paymentMode ? { paymentMode: reviewBill.paymentMode } : {}),
          },
        })
      }

      // 3. save the purchase rows (change / add / remove)
      const keptIds = new Set(planned.map(p => p.item.purchaseId).filter(Boolean) as string[])
      for (const { item, body } of planned) {
        if (item.purchaseId) await send("PATCH", `/api/purchases/${item.purchaseId}`, body)
        else await send("POST", "/api/purchases", body)
      }
      for (const rec of reviewBill.items) {
        if (!keptIds.has(rec.id)) await send("DELETE", `/api/purchases/${rec.id}`)
      }

      // 4. correct product stock and product details
      const warnings: string[] = []
      const touched = new Set([...Object.keys(ledger), ...Object.keys(productPatches)])
      for (const id of touched) {
        const delta = ledger[id] || 0
        if (!(id in productPatches) && delta === 0) continue
        const base = Number(knownProducts.find(p => p.id === id)?.stock) || 0
        try {
          await send("PATCH", `/api/products/${id}`, {
            ...(productPatches[id] || {}),
            stock: Math.max(0, base + delta),
          })
        } catch (e: any) {
          warnings.push(e?.message || `Stock update failed for product ${id}`)
        }
      }

      toast({
        title: "Bill Updated ✓",
        description: warnings.length
          ? `Bill saved, but ${warnings.length} product stock update(s) failed. Please check stock.`
          : `Bill #${reviewBill.billNumber} saved with ${planned.length} item(s).`,
        variant: warnings.length ? "destructive" : undefined,
      })

      await fetchAll()
      setPendingOpenBillKey(billId) // reopen the same bill with the saved data
    } catch (err: any) {
      console.error("BILL UPDATE ERROR:", err)
      toast({
        variant: "destructive",
        title: "Could not update bill",
        description: `${err.message}. Some changes may already be saved, so please reload the bill and check.`,
      })
      fetchAll()
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
              disabled={pastBills.length === 0 || currentBillIndex === 0 || isEditing}
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
              disabled={currentBillIndex === -1 || isEditing}
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
              disabled={isEditing}
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
                disabled={isReviewLocked}
                onChange={e => {
                  if (e.target.value) setBillingDate(e.target.value)
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
                title="Change bill date"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg hover:bg-secondary text-foreground hover:text-accent shrink-0"
              onClick={handleNextDate}
              disabled={isEditing}
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

        {/* Current State / Edit / Reset to New Bill */}
        <div className="flex items-center gap-2">
          {currentBillIndex !== -1 ? (
            <div className="flex flex-wrap items-center gap-2">
              {isEditing ? (
                <Badge className="bg-red-500/15 text-red-400 border-red-500/40 text-xs py-1 px-2.5 font-bold">
                  ✎ Editing Bill #{pastBills[currentBillIndex]?.billNumber} • {pastBills[currentBillIndex]?.supplierName}
                </Badge>
              ) : (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-xs py-1 px-2.5 font-bold">
                  Reviewing Bill #{pastBills[currentBillIndex]?.billNumber} • {pastBills[currentBillIndex]?.supplierName}
                </Badge>
              )}

              {isEditing ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-bold rounded-xl gap-1 border-border hover:bg-secondary"
                  onClick={handleCancelEdit}
                  disabled={isSubmitting}
                  title="Throw away the changes and show the saved bill again"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel Edit
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className="h-8 text-xs font-bold bg-accent text-accent-foreground hover:brightness-110 rounded-xl shadow-sm gap-1"
                    onClick={handleStartEdit}
                    title="Change this saved bill"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit Bill
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-bold rounded-xl gap-1 border-border hover:bg-secondary"
                    onClick={handleResetToNewBill}
                    title="Exit review and start a clear new bill"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Bill
                  </Button>
                </>
              )}
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
        <Card className={cn("border-none bg-card shadow-sm flex flex-col", isReviewLocked && "pointer-events-none opacity-60")}>
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-accent" /> Supplier
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] font-bold text-accent uppercase tracking-widest hover:bg-accent/10 px-1.5"
              onClick={() => {
                setScannedSupplierForm({ name: "", contactPerson: "", phone: "", email: "", address: "", gstNumber: "" })
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

        {/* Card 2: AI Invoice Scanner (only for new bills) */}
        <InvoiceScanner key={scannerKey} onScanComplete={handleScanComplete} disabled={isSubmitting || currentBillIndex !== -1} existingCategories={categories} />

        {/* Card 3: Fast Add Products (Only 5 Best Selling / Search Results) */}
        <Card className={cn("border-none bg-card shadow-sm flex flex-col", isReviewLocked && "pointer-events-none opacity-60")}>
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
                Bulk Editor with Category, MRP, Selling Price & Alert Level
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isReviewLocked && (
              <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/40 text-[10px] py-1 px-2.5 font-bold">
                🔒 Saved bill — press “Edit Bill” to change
              </Badge>
            )}
            {isEditing && (
              <Badge className="bg-red-500/15 text-red-400 border border-red-500/40 text-[10px] py-1 px-2.5 font-bold">
                ✎ Editing — press “Update Bill” to save
              </Badge>
            )}
            <Badge variant="secondary" className="font-code text-xs py-1 px-3">
              {purchaseItems.length} Product{purchaseItems.length === 1 ? "" : "s"}
            </Badge>
          </div>
        </CardHeader>

        {/* ── ITEM CODE SETTING BAR: Tickbox for Use Bill Item Codes vs Auto SX Codes (Default: First App Codes) ── */}
        <div className="bg-secondary/15 border-b border-border/40 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-3">
            <label className={cn(
              "flex items-center gap-2 select-none group bg-secondary/30 px-3 py-1.5 rounded-xl border border-border/60 transition-all shadow-sm",
              currentBillIndex === -1 ? "cursor-pointer hover:bg-secondary/60" : "opacity-50 cursor-not-allowed"
            )}>
              <input
                type="checkbox"
                checked={useBillItemCode}
                disabled={currentBillIndex !== -1}
                onChange={e => handleToggleUseBillItemCode(e.target.checked)}
                className="w-4 h-4 rounded text-accent accent-accent cursor-pointer"
              />
              <span className="text-xs font-bold text-foreground group-hover:text-accent transition-colors">
                Use Bill Item Codes
              </span>
              <Badge
                variant="outline"
                className={`text-[9px] px-1.5 py-0 h-4 font-mono font-bold transition-all ${
                  useBillItemCode
                    ? "bg-accent/15 text-accent border-accent/40"
                    : "bg-secondary/40 text-muted-foreground border-border/60"
                }`}
              >
                {useBillItemCode ? "Bill Code ✓" : "App Code (SX-XXXX)"}
              </Badge>
            </label>
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              {useBillItemCode
                ? "• Using item codes from supplier invoice for new items."
                : "• Using internal app codes (SX-XXXX). Tick if you want to use the bill's item codes."}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground hidden md:inline">
              All items in sheet:
            </span>
            <Badge variant="outline" className="text-[9px] border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5">
              Fully Editable (Name, Code, MRP, Cost)
            </Badge>
          </div>
        </div>

        {/* Credit / Payment Bar */}
        <div className="bg-secondary/10 border-b border-border/30 px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <div>
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> {reviewBill ? "Amount Paid On This Bill (₹)" : "Amount Paid Now (₹)"}
            </Label>
            <Input
              type="number"
              placeholder={reviewBill ? "Not recorded" : `Full amount ₹${total}`}
              style={{ color: '#ffffff', backgroundColor: '#182030' }}
              className="h-9 mt-1 text-xs border border-slate-600 font-bold rounded-lg font-code"
              value={paidAmount}
              onChange={e => setPaidAmount(e.target.value)}
              disabled={!!reviewBill}
              title={reviewBill ? "Payments are recorded from the Suppliers page" : undefined}
            />
          </div>
          <div>
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payment Mode</Label>
            <Select value={paymentMode} onValueChange={setPaymentMode} disabled={!!reviewBill}>
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
            {paidUnknown ? (
              <Badge variant="outline" className="border-slate-500/50 bg-slate-500/10 text-slate-300 font-bold py-1.5 px-3 text-xs">
                Payment not recorded
              </Badge>
            ) : isCredit ? (
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

        {/* ── Table (Unified Mobile & Desktop) ──
            The fieldset switches every input, dropdown and button inside the sheet off
            while a saved bill is only being reviewed. */}
        <CardContent className="p-0">
          <fieldset disabled={isReviewLocked} className="min-w-0 border-0 p-0 m-0">
          <div className="w-full overflow-x-auto min-h-[350px] pb-24">
            <Table className="min-w-[1060px] w-full">
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
                  <TableHead className="w-[110px] text-[10px] font-bold uppercase py-3 px-1 text-right">Selling (₹)</TableHead>
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
                    <TableRow key={item.rowId} className="border-border/30 group hover:bg-secondary/10">
                      <TableCell className="text-center font-code text-xs text-muted-foreground py-2.5 px-2">{index + 1}</TableCell>
                      <TableCell className="py-2.5 px-2 relative min-w-[200px]">
                        {/* Editable item name with live autocomplete popup */}
                        <div className="relative">
                          <input
                            id={`cell-${index}-0`}
                            type="text"
                            value={item.productName}
                            onChange={e => {
                              const val = e.target.value
                              updateItem(item.rowId, "productName", val)
                              if (val.trim().length >= 1) {
                                setActiveSuggestionRowId(item.rowId)
                                setActiveSuggestionField("name")
                                setActiveSuggestionQuery(val)
                                setHighlightedSuggestionIndex(0)
                              } else {
                                setActiveSuggestionRowId(null)
                              }
                            }}
                            onKeyDown={e => handleCellKeyDown(e, index, 0)}
                            onFocus={e => {
                              e.target.select()
                              if (item.productName.trim().length >= 1) {
                                setActiveSuggestionRowId(item.rowId)
                                setActiveSuggestionField("name")
                                setActiveSuggestionQuery(item.productName)
                                setHighlightedSuggestionIndex(0)
                              }
                            }}
                            onBlur={() => {
                              setTimeout(() => {
                                setActiveSuggestionRowId(curr => (curr === item.rowId ? null : curr))
                              }, 180)
                            }}
                            placeholder="Item name (Type to search stock...)"
                            style={{ color: '#ffffff', backgroundColor: '#0f172a', WebkitTextFillColor: '#ffffff' }}
                            className="w-full min-w-[160px] h-8 px-2 text-xs font-bold border border-slate-600 rounded focus:border-cyan-400 focus:outline-none"
                            title="Edit item name (Type to search stock, Press Enter to move to Code)"
                            autoComplete="off"
                          />

                          {/* Autocomplete Suggestions Dropdown Popup for Item Name */}
                          {activeSuggestionRowId === item.rowId && activeSuggestionField === "name" && matchingSuggestions.length > 0 && (
                            <div
                              className="absolute top-full left-0 mt-1 w-80 sm:w-96 bg-[#090d16] border border-cyan-500/60 rounded-xl shadow-2xl z-50 overflow-hidden max-h-64 overflow-y-auto backdrop-blur-md"
                              onMouseDown={e => e.preventDefault()}
                            >
                              <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-700 flex items-center justify-between text-[10px] text-muted-foreground">
                                <span className="font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                                  <Package className="w-3 h-3" /> Existing Products ({matchingSuggestions.length})
                                </span>
                                <span className="text-[9px]">↑↓ / Click to pick</span>
                              </div>
                              {matchingSuggestions.map((p, sIdx) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    applyProductToRow(item.rowId, p)
                                    const nextEl = document.getElementById(`cell-${index}-2`) as HTMLInputElement | null
                                    nextEl?.focus()
                                    nextEl?.select?.()
                                  }}
                                  className={`w-full p-2.5 text-left border-b border-slate-800/80 last:border-0 flex justify-between items-center transition-colors ${
                                    sIdx === highlightedSuggestionIndex
                                      ? "bg-cyan-500/20 text-cyan-200"
                                      : "hover:bg-slate-800/60 text-foreground"
                                  }`}
                                >
                                  <div className="min-w-0 pr-2">
                                    <p className="font-bold text-xs truncate text-white">{p.name}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                                      <span className="font-code font-bold text-cyan-400">{p.sku}</span>
                                      <span>•</span>
                                      <span className="truncate">{p.category}</span>
                                      <span>•</span>
                                      <span className={p.stock > 0 ? "text-emerald-400 font-bold" : "text-amber-400 font-semibold"}>
                                        Stock: {p.stock}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <div className="font-code text-xs font-bold text-amber-400">
                                      ₹{p.purchasePrice || 0}
                                    </div>
                                    <div className="text-[9px] text-muted-foreground font-code">
                                      Sell: ₹{p.sellingPrice || 0}
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Item Code Input & Suggestions */}
                        <div className="flex items-center gap-1.5 mt-1 relative">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">Code:</span>
                          <div className="relative">
                            <input
                              id={`cell-${index}-1`}
                              type="text"
                              placeholder="Code / SKU"
                              value={item.sku || ""}
                              onChange={e => {
                                const val = e.target.value
                                updateItem(item.rowId, "sku", val)
                                const trimmed = val.trim().toLowerCase()
                                if (trimmed) {
                                  // Exact match: immediately auto-populate all details!
                                  const exact = products.find(p => p.sku.trim().toLowerCase() === trimmed)
                                  if (exact) {
                                    applyProductToRow(item.rowId, exact)
                                  } else if (val.trim().length >= 2) {
                                    setActiveSuggestionRowId(item.rowId)
                                    setActiveSuggestionField("sku")
                                    setActiveSuggestionQuery(val)
                                    setHighlightedSuggestionIndex(0)
                                  }
                                } else {
                                  if (activeSuggestionRowId === item.rowId) setActiveSuggestionRowId(null)
                                }
                              }}
                              onKeyDown={e => handleCellKeyDown(e, index, 1)}
                              onFocus={e => e.target.select()}
                              onBlur={() => {
                                const trimmed = (item.sku || "").trim().toLowerCase()
                                if (trimmed) {
                                  const exact = products.find(p => p.sku.trim().toLowerCase() === trimmed)
                                  if (exact && item.productId !== exact.id) {
                                    applyProductToRow(item.rowId, exact)
                                  }
                                }
                                setTimeout(() => {
                                  setActiveSuggestionRowId(curr => (curr === item.rowId ? null : curr))
                                }, 180)
                              }}
                              style={{
                                color: '#38bdf8',
                                backgroundColor: '#0f172a',
                                WebkitTextFillColor: '#38bdf8',
                              }}
                              className="h-5 px-1.5 text-[10px] font-code font-bold border border-slate-600 rounded focus:border-cyan-400 focus:outline-none w-28"
                              title="Item Code / SKU (Enter existing code to autofill, Press Enter to move to Qty)"
                              autoComplete="off"
                            />

                            {/* Autocomplete Suggestions Popup for Code */}
                            {activeSuggestionRowId === item.rowId && activeSuggestionField === "sku" && matchingSuggestions.length > 0 && (
                              <div
                                className="absolute top-full left-0 mt-1 w-80 sm:w-96 bg-[#090d16] border border-cyan-500/60 rounded-xl shadow-2xl z-50 overflow-hidden max-h-56 overflow-y-auto backdrop-blur-md"
                                onMouseDown={e => e.preventDefault()}
                              >
                                <div className="px-3 py-1 bg-slate-900 border-b border-slate-700 flex items-center justify-between text-[10px] text-muted-foreground">
                                  <span className="font-bold uppercase tracking-wider text-cyan-400">
                                    Matching Code ({matchingSuggestions.length})
                                  </span>
                                </div>
                                {matchingSuggestions.map((p, sIdx) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => {
                                      applyProductToRow(item.rowId, p)
                                      const nextEl = document.getElementById(`cell-${index}-2`) as HTMLInputElement | null
                                      nextEl?.focus()
                                      nextEl?.select?.()
                                    }}
                                    className={`w-full p-2 text-left border-b border-slate-800/80 last:border-0 flex justify-between items-center transition-colors ${
                                      sIdx === highlightedSuggestionIndex
                                        ? "bg-cyan-500/20 text-cyan-200"
                                        : "hover:bg-slate-800/60 text-foreground"
                                    }`}
                                  >
                                    <div className="min-w-0 pr-2">
                                      <span className="font-code font-bold text-cyan-400 text-xs">{p.sku}</span>
                                      <span className="text-white text-xs ml-2">{p.name}</span>
                                    </div>
                                    <div className="font-code text-xs font-bold text-amber-400 shrink-0">
                                      ₹{p.purchasePrice || 0}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {item.isNewProduct ? (
                            <div className="flex items-center gap-1">
                              <Badge className="text-[8px] bg-accent/20 text-accent hover:bg-accent/30 px-1 py-0 h-4 font-bold">
                                New
                              </Badge>
                              {item.billItemCode ? (
                                <span className="text-[9px] text-cyan-400 font-code font-semibold" title={`Scanned bill code: ${item.billItemCode}`}>
                                  (Bill: {item.billItemCode})
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <Badge className="text-[8px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0 h-4 font-bold" title="Already in stock: uses existing established code.">
                              In Stock ✓ ({item.sku})
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Category with inline selector + create */}
                      <TableCell className="py-2.5 px-2">
                        <div className="flex items-center gap-1 min-w-[140px]">
                          <Select
                            value={item.category}
                            onValueChange={val => updateItem(item.rowId, "category", val)}
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
                          id={`cell-${index}-2`}
                          type="number"
                          min={1}
                          style={{
                            color: '#ffffff',
                            backgroundColor: '#0f172a',
                            WebkitTextFillColor: '#ffffff',
                          }}
                          className="w-16 h-9 px-2 text-xs border-2 border-slate-600 font-bold text-center rounded-lg shadow-sm focus:border-cyan-400 focus:outline-none mx-auto block"
                          value={item.quantity ?? 1}
                          onChange={e => updateItem(item.rowId, "quantity", e.target.value === "" ? "" : Number(e.target.value))}
                          onKeyDown={e => handleCellKeyDown(e, index, 2)}
                          onFocus={e => e.target.select()}
                        />
                      </TableCell>

                      {/* Purchase Price (Cost) */}
                      <TableCell className="py-2.5 px-1 text-right">
                        <input
                          id={`cell-${index}-3`}
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
                          onChange={e => updateItem(item.rowId, "purchasePrice", e.target.value === "" ? "" : Number(e.target.value))}
                          onKeyDown={e => handleCellKeyDown(e, index, 3)}
                          onFocus={e => e.target.select()}
                        />
                      </TableCell>

                      {/* GST (%) */}
                      <TableCell className="py-2.5 px-1 text-center">
                        <input
                          id={`cell-${index}-4`}
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
                          onChange={e => updateItem(item.rowId, "taxRate", e.target.value === "" ? "" : Number(e.target.value))}
                          onKeyDown={e => handleCellKeyDown(e, index, 4)}
                          onFocus={e => e.target.select()}
                        />
                      </TableCell>

                      {/* GST (₹) */}
                      <TableCell className="py-2.5 px-1 text-right">
                        <input
                          id={`cell-${index}-5`}
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
                          onChange={e => updateItem(item.rowId, "taxAmount", e.target.value === "" ? "" : Number(e.target.value))}
                          onKeyDown={e => handleCellKeyDown(e, index, 5)}
                          onFocus={e => e.target.select()}
                        />
                      </TableCell>

                      {/* MRP */}
                      <TableCell className="py-2.5 px-1 text-right">
                        <input
                          id={`cell-${index}-6`}
                          type="number" min={0} step="any"
                          style={{ color: '#a78bfa', backgroundColor: '#0f172a', WebkitTextFillColor: '#a78bfa' }}
                          className="w-24 h-9 px-2 text-xs border-2 border-slate-600 font-bold text-right font-code rounded-lg shadow-sm focus:border-violet-400 focus:outline-none ml-auto block"
                          value={item.mrp ?? 0}
                          onChange={e => updateItem(item.rowId, "mrp", e.target.value === "" ? "" : Number(e.target.value))}
                          onKeyDown={e => handleCellKeyDown(e, index, 6)}
                          onFocus={e => e.target.select()}
                          title="MRP (Maximum Retail Price)"
                        />
                      </TableCell>

                      {/* Selling Price */}
                      <TableCell className="py-2.5 px-1 text-right">
                        <input
                          id={`cell-${index}-7`}
                          type="number" min={0} step="any"
                          style={{ color: '#34d399', backgroundColor: '#0f172a', WebkitTextFillColor: '#34d399' }}
                          className="w-24 h-9 px-2 text-xs border-2 border-slate-600 font-bold text-right font-code rounded-lg shadow-sm focus:border-emerald-400 focus:outline-none ml-auto block"
                          value={item.sellingPrice ?? 0}
                          onChange={e => updateItem(item.rowId, "sellingPrice", e.target.value === "" ? "" : Number(e.target.value))}
                          onKeyDown={e => handleCellKeyDown(e, index, 7)}
                          onFocus={e => e.target.select()}
                          title="Selling Price"
                        />
                      </TableCell>

                      {/* Alert Level (minStock) - LAST COLUMN */}
                      <TableCell className="py-2.5 px-1 text-center">
                        <input
                          id={`cell-${index}-8`}
                          type="number"
                          min={0}
                          style={{
                            color: '#38bdf8',
                            backgroundColor: '#0f172a',
                            WebkitTextFillColor: '#38bdf8',
                          }}
                          className="w-16 h-9 px-2 text-xs border-2 border-slate-600 font-bold text-center rounded-lg shadow-sm focus:border-cyan-400 focus:outline-none mx-auto block"
                          value={item.minStock ?? 2}
                          onChange={e => updateItem(item.rowId, "minStock", e.target.value === "" ? "" : Number(e.target.value))}
                          onKeyDown={e => handleCellKeyDown(e, index, 8)}
                          onFocus={e => e.target.select()}
                          title="Alert Level (Press Enter on last row to auto-create new row)"
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
                          onClick={() => removeItem(item.rowId)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {purchaseItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="h-72 text-center">
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
                    <TableCell colSpan={3} />
                    <TableCell className="py-3 px-2 text-right font-code font-bold text-base text-accent">
                      ₹{subTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          </fieldset>
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
                      • 📞 {selectedSupplier?.phone}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground font-code">
                    • {billingDate}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {paidUnknown ? (
                    <Badge variant="outline" className="border-slate-500/50 bg-slate-500/10 text-slate-300 font-bold">
                      Paid amount not recorded for this bill
                    </Badge>
                  ) : isCredit ? (
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

              {/* Right: Discount, Round off, Bill Total & Commit Entry Button */}
              <div className="flex flex-wrap items-center justify-between sm:justify-end gap-4 sm:gap-6 pt-3 sm:pt-0 border-t sm:border-t-0 border-border/30">
                <div className="text-left sm:text-right space-y-1.5">
                  <div className="flex flex-wrap items-center sm:justify-end gap-3">
                    {/* Manual discount */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Discount ₹</span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        placeholder="0"
                        value={discountInput}
                        onChange={e => setDiscountInput(e.target.value)}
                        disabled={isReviewLocked}
                        style={{ color: '#f87171', backgroundColor: '#0f172a', WebkitTextFillColor: '#f87171' }}
                        className="w-24 h-8 px-2 text-xs border-2 border-slate-600 font-bold text-right font-code rounded-lg focus:border-red-400 focus:outline-none"
                      />
                    </div>

                    {/* Round off tick box */}
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={roundOffEnabled}
                        onChange={e => setRoundOffEnabled(e.target.checked)}
                        disabled={isReviewLocked}
                        className="w-3.5 h-3.5 accent-accent cursor-pointer"
                      />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Round off</span>
                    </label>
                  </div>

                  {/* Breakdown line, shown only when discount or round off is used */}
                  {(discountAmt > 0 || roundOffEnabled) && (
                    <p className="text-[10px] font-code text-muted-foreground">
                      Sub ₹{subTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      {discountAmt > 0 && <> • Disc −₹{discountAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })}</>}
                      {roundOffEnabled && <> • Round off {roundOffAmt >= 0 ? "+" : "−"}₹{Math.abs(roundOffAmt).toFixed(2)}</>}
                    </p>
                  )}

                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Bill Total</p>
                  <p className="text-2xl sm:text-3xl font-code font-bold text-accent">₹{total.toLocaleString()}</p>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex gap-2">
                    {currentBillIndex !== -1 ? (
                      isEditing ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-xl font-bold uppercase tracking-wider text-[10px] h-11 px-4 gap-1.5"
                            onClick={handleCancelEdit}
                            disabled={isSubmitting}
                          >
                            <X className="w-3.5 h-3.5" />
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            onClick={handleUpdateBill}
                            disabled={isSubmitting}
                            className="bg-accent text-accent-foreground font-bold px-6 sm:px-8 rounded-xl shadow-lg shadow-accent/25 h-11 text-sm sm:text-base hover:brightness-110 transition-all"
                          >
                            {isSubmitting ? (
                              <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            ) : (
                              <Save className="w-5 h-5 mr-2" />
                            )}
                            Update Bill
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-xl font-bold uppercase tracking-wider text-[10px] h-11 px-4 gap-1.5"
                            onClick={handleResetToNewBill}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            New Bill
                          </Button>
                          <Button
                            type="button"
                            onClick={handleStartEdit}
                            className="bg-accent text-accent-foreground font-bold px-6 sm:px-8 rounded-xl shadow-lg shadow-accent/25 h-11 text-sm sm:text-base hover:brightness-110 transition-all gap-2"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit Bill
                          </Button>
                        </>
                      )
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
                            purchaseItems.length === 0
                              ? "bg-muted text-muted-foreground border border-red-500/50 cursor-not-allowed opacity-60"
                              : "bg-accent text-accent-foreground shadow-accent/25 hover:brightness-110"
                          }`}
                          disabled={purchaseItems.length === 0 || isSubmitting}
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
                  {/* Validation and helper hints */}
                  {currentBillIndex === -1 && (
                    <div className="flex flex-col items-end gap-0.5">
                      {purchaseItems.length === 0 && (
                        <p className="text-[11px] font-semibold text-red-400 flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          Add at least one product
                        </p>
                      )}
                      {purchaseItems.length > 0 && !selectedSupplier && (
                        <p className="text-[10px] font-semibold text-amber-400/90 flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                          No supplier selected — will save as Cash / Direct Purchase
                        </p>
                      )}
                    </div>
                  )}
                  {isEditing && (
                    <p className="text-[10px] font-semibold text-muted-foreground max-w-[260px] text-right">
                      Stock is corrected by the change in quantity. The paid amount stays the same — only the balance is recalculated.
                    </p>
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
