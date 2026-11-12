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
  Percent,
  Receipt,
  Share2,
  Printer,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Building2,
  Phone,
  RotateCcw,
  UserCheck,
  Check,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { useUser } from "@/app/auth/use-user"
import { Product } from "../../inventory/page"
import { useSocket } from "@/hooks/useSocket"

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
  price: number
  taxRate: number // GST rate %
  taxAmount: number // GST amount in ₹
}

interface ShopProfile {
  companyName?: string
  gstNumber?: string
  phone?: string
  email?: string
  location?: string
}

interface PastSale {
  id: string
  billNumber?: string
  date: string
  customerName: string
  customerPhone?: string
  total: number
  subtotal?: number
  discount?: number
  taxAmount?: number
  paymentMethod: string
  items: Array<{
    productId: string
    productName: string
    sku?: string
    quantity: number
    price: number
    taxRate?: number
    taxAmount?: number
  }>
}

function formatToDDMMYYYY(dateStr: string): string {
  if (!dateStr) return dateStr
  if (dateStr.includes("T")) dateStr = dateStr.split("T")[0]
  if (!dateStr.includes("-")) return dateStr
  const [y, m, d] = dateStr.split("-")
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`
}

function cleanIndianPhone(rawPhone?: string): string | null {
  if (!rawPhone) return null
  const digits = rawPhone.replace(/\D/g, "")
  if (digits.length === 10) return digits
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1)
  if (digits.length > 10) return digits.slice(-10)
  return null
}

export default function NewBillPage() {
  const { user } = useUser()

  // ── Shop Profile ──
  const [shopProfile, setShopProfile] = React.useState<ShopProfile | null>(null)

  // ── Date & Bill Navigator ──
  const [billingDate, setBillingDate] = React.useState<string>(() => new Date().toISOString().split("T")[0])
  const [pastSales, setPastSales] = React.useState<PastSale[]>([])
  const [currentBillIndex, setCurrentBillIndex] = React.useState<number>(-1) // -1 = new bill

  // ── Customer state ──
  const [customerSearch, setCustomerSearch] = React.useState("")
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null)
  const [manualCustomerName, setManualCustomerName] = React.useState("")
  const [manualCustomerPhone, setManualCustomerPhone] = React.useState("")
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = React.useState(false)
  const [isAddingCustomer, setIsAddingCustomer] = React.useState(false)

  // ── Inventory & Billing ──
  const [productSearch, setProductSearch] = React.useState("")
  const [billItems, setBillItems] = React.useState<BillItem[]>([])
  const [paymentMethod, setPaymentMethod] = React.useState<string>("upi")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // ── Discount ──
  const [discountType, setDiscountType] = React.useState<"flat" | "percent">("flat")
  const [discountValue, setDiscountValue] = React.useState<number>(0)

  // ── Invoice Dialog & WhatsApp ──
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = React.useState(false)
  const [generatedInvoiceData, setGeneratedInvoiceData] = React.useState<any>(null)

  // ── Data lists ──
  const [products, setProducts] = React.useState<Product[]>([])
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [productSalesCount, setProductSalesCount] = React.useState<Record<string, number>>({})

  // Fetch initial data: Products, Customers, Sales, Shop Profile
  const fetchAllData = React.useCallback(async () => {
    if (!user?.uid) return
    const headers = { "x-user-id": user.uid }

    try {
      const [productsRes, customersRes, salesRes, profileRes] = await Promise.all([
        fetch("/api/products", { headers }),
        fetch("/api/customers", { headers }),
        fetch("/api/sales", { headers }),
        fetch(`/api/shop_profiles/${user.uid}`, { headers }).catch(() => null),
      ])

      if (productsRes.ok) {
        const prodData = await productsRes.json()
        setProducts(Array.isArray(prodData) ? prodData : [])
      }

      if (customersRes.ok) {
        const custData = await customersRes.json()
        setCustomers(Array.isArray(custData) ? custData : [])
      }

      if (salesRes.ok) {
        const salesData = await salesRes.json()
        if (Array.isArray(salesData)) {
          // Sort oldest to newest for sequential past bills
          const sorted = [...salesData].sort((a, b) => (a.date || "").localeCompare(b.date || ""))
          setPastSales(sorted)

          // Calculate top selling product frequency
          const counts: Record<string, number> = {}
          salesData.forEach(sale => {
            if (Array.isArray(sale.items)) {
              sale.items.forEach((item: any) => {
                const pId = item.productId || item.product?.id
                if (pId) {
                  counts[pId] = (counts[pId] || 0) + (Number(item.quantity) || 1)
                }
              })
            }
          })
          setProductSalesCount(counts)
        }
      }

      if (profileRes && profileRes.ok) {
        const pData = await profileRes.json()
        if (pData) setShopProfile(pData)
      }
    } catch (err) {
      console.error("Failed fetching sales billing data:", err)
    }
  }, [user?.uid])

  React.useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  useSocket((data) => {
    if (!user?.uid) return
    if (data.action === "update" && data.product) {
      setProducts(prev => prev.map(p => p.id === data.product.id ? data.product : p))
    } else if (data.action === "delete" && data.productId) {
      setProducts(prev => prev.filter(p => p.id !== data.productId))
    } else if (data.action === "create" && data.product) {
      setProducts(prev => {
        if (prev.some(p => p.id === data.product.id)) return prev
        return [...prev, data.product].sort((a, b) => a.name.localeCompare(b.name))
      })
    }
  })

  // Bill numbering: Sequential number based on past sales count + 1
  const nextBillNumber = React.useMemo(() => {
    return pastSales.length + 1
  }, [pastSales.length])

  const activeBillNumber = React.useMemo(() => {
    if (currentBillIndex >= 0 && pastSales[currentBillIndex]) {
      return pastSales[currentBillIndex].billNumber || `${pastSales[currentBillIndex].id.slice(-6).toUpperCase()}`
    }
    return `${nextBillNumber}`
  }, [currentBillIndex, pastSales, nextBillNumber])

  // Customer resolution: Picked from DB or manually typed in form
  const resolvedCustomerName = selectedCustomer?.name || manualCustomerName.trim() || "Walk-in Customer"
  const resolvedCustomerPhone = selectedCustomer?.phone || manualCustomerPhone.trim() || ""
  const customerPreviousBalance = selectedCustomer?.outstandingBalance || 0

  const filteredCustomers = customerSearch.length > 0
    ? customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch))
    : []

  const displayProducts = React.useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (q) {
      return products
        .filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
        .slice(0, 5)
    }
    const sorted = [...products].sort((a, b) => (productSalesCount[b.id] || 0) - (productSalesCount[a.id] || 0))
    return sorted.slice(0, 5)
  }, [productSearch, products, productSalesCount])

  // Cart operations
  const addItem = (product: Product) => {
    setBillItems(prev => {
      const existing = prev.find(item => item.product.id === product.id)
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                taxAmount: item.taxRate > 0 ? Number((((item.quantity + 1) * item.price * item.taxRate) / 100).toFixed(2)) : 0,
              }
            : item
        )
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          price: product.sellingPrice,
          taxRate: 0,
          taxAmount: 0,
        },
      ]
    })
    toast({ title: "Added to Bill", description: product.name })
  }

  const removeItem = (productId: string) => setBillItems(prev => prev.filter(item => item.product.id !== productId))

  const updateItemQuantity = (productId: string, quantity: number) => {
    const validQty = Math.max(1, quantity)
    setBillItems(prev =>
      prev.map(item => {
        if (item.product.id !== productId) return item
        const taxAmount = item.taxRate > 0 ? Number(((validQty * item.price * item.taxRate) / 100).toFixed(2)) : 0
        return { ...item, quantity: validQty, taxAmount }
      })
    )
  }

  const updateItemPrice = (productId: string, price: number) => {
    const validPrice = Math.max(0, price)
    setBillItems(prev =>
      prev.map(item => {
        if (item.product.id !== productId) return item
        const taxAmount = item.taxRate > 0 ? Number(((item.quantity * validPrice * item.taxRate) / 100).toFixed(2)) : 0
        return { ...item, price: validPrice, taxAmount }
      })
    )
  }

  const updateItemTaxRate = (productId: string, taxRate: number) => {
    const validRate = Math.max(0, taxRate)
    setBillItems(prev =>
      prev.map(item => {
        if (item.product.id !== productId) return item
        const taxAmount = Number(((item.quantity * item.price * validRate) / 100).toFixed(2))
        return { ...item, taxRate: validRate, taxAmount }
      })
    )
  }

  const updateItemTaxAmount = (productId: string, taxAmount: number) => {
    const validAmount = Math.max(0, taxAmount)
    setBillItems(prev =>
      prev.map(item => {
        if (item.product.id !== productId) return item
        const base = item.quantity * item.price
        const taxRate = base > 0 ? Number(((validAmount / base) * 100).toFixed(1)) : 0
        return { ...item, taxAmount: validAmount, taxRate }
      })
    )
  }

  // Financial calculations
  const itemsSubtotal = billItems.reduce((acc, item) => acc + (item.price * item.quantity), 0)
  const totalTaxAmount = billItems.reduce((acc, item) => acc + (item.taxAmount || 0), 0)
  const preDiscountTotal = itemsSubtotal + totalTaxAmount

  const discountAmount = React.useMemo(() => {
    if (!discountValue || discountValue <= 0) return 0
    const raw = discountType === "percent"
      ? (preDiscountTotal * discountValue) / 100
      : discountValue
    return Math.min(Math.max(raw, 0), preDiscountTotal)
  }, [discountType, discountValue, preDiscountTotal])

  const grandTotal = Math.max(preDiscountTotal - discountAmount, 0)
  const totalWithPreviousDue = grandTotal + customerPreviousBalance

  // Register new customer dialog submission
  const handleAddCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user?.uid) return
    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const phone = formData.get("phone") as string
    const email = formData.get("email") as string

    if (!name || !phone) {
      toast({ variant: "destructive", title: "Required Fields", description: "Name and Phone are required." })
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
      if (!res.ok) throw new Error("Failed to register customer")
      const newCustomer = await res.json()
      setCustomers(prev => [...prev, newCustomer])
      setSelectedCustomer(newCustomer)
      setManualCustomerName(newCustomer.name)
      setManualCustomerPhone(newCustomer.phone)
      setIsCustomerDialogOpen(false)
      toast({ title: "Customer Registered ✓", description: `${name} selected for this bill.` })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setIsAddingCustomer(false)
    }
  }

  // Bill Navigator handlers
  const handlePrevBill = () => {
    if (pastSales.length === 0) return
    let targetIndex = currentBillIndex
    if (targetIndex === -1) {
      targetIndex = pastSales.length - 1
    } else if (targetIndex > 0) {
      targetIndex -= 1
    } else {
      return
    }
    loadPastSale(targetIndex)
  }

  const handleNextBill = () => {
    if (pastSales.length === 0 || currentBillIndex === -1) return
    if (currentBillIndex < pastSales.length - 1) {
      loadPastSale(currentBillIndex + 1)
    } else {
      handleResetToNewBill()
    }
  }

  const loadPastSale = (index: number) => {
    const sale = pastSales[index]
    if (!sale) return
    setCurrentBillIndex(index)
    setBillingDate(sale.date ? sale.date.split("T")[0] : new Date().toISOString().split("T")[0])
    setManualCustomerName(sale.customerName || "")
    setManualCustomerPhone(sale.customerPhone || "")
    const cust = customers.find(c => c.name === sale.customerName || c.id === (sale as any).customerId)
    setSelectedCustomer(cust || null)
    setPaymentMethod(sale.paymentMethod || "cash")

    // Map sale items to billing cart items
    const mapped = (sale.items || []).map((it: any) => {
      const prod = products.find(p => p.id === it.productId || p.name.toLowerCase() === it.productName.toLowerCase())
      const pCost = it.price || prod?.sellingPrice || 0
      const pQty = it.quantity || 1
      const pTaxRate = it.taxRate || 0
      const pTaxAmount = it.taxAmount || (pTaxRate > 0 ? (pQty * pCost * pTaxRate) / 100 : 0)
      return {
        product: prod || {
          id: it.productId || `prod-${Math.random().toString(36).slice(2)}`,
          name: it.productName,
          sku: it.sku || "SX-SKU",
          purchasePrice: 0,
          sellingPrice: pCost,
          stock: 99,
          minStock: 2,
          category: "General",
        },
        quantity: pQty,
        price: pCost,
        taxRate: pTaxRate,
        taxAmount: pTaxAmount,
      }
    })
    setBillItems(mapped)
    setDiscountValue(sale.discount || 0)
    setDiscountType("flat")
    toast({
      title: `Viewing Past Bill #${sale.billNumber || sale.id.slice(-6).toUpperCase()}`,
      description: `Customer: ${sale.customerName} • Total: ₹${sale.total.toLocaleString()}`,
    })
  }

  const handleResetToNewBill = () => {
    setCurrentBillIndex(-1)
    setBillItems([])
    setSelectedCustomer(null)
    setManualCustomerName("")
    setManualCustomerPhone("")
    setBillingDate(new Date().toISOString().split("T")[0])
    setDiscountValue(0)
    toast({ title: "New Bill Entry", description: "Terminal cleared for new sale." })
  }

  const handlePrevDate = () => {
    const d = new Date(billingDate)
    d.setDate(d.getDate() - 1)
    setBillingDate(d.toISOString().split("T")[0])
  }

  const handleNextDate = () => {
    const todayStr = new Date().toISOString().split("T")[0]
    const d = new Date(billingDate)
    d.setDate(d.getDate() + 1)
    const nextStr = d.toISOString().split("T")[0]
    if (nextStr <= todayStr) {
      setBillingDate(nextStr)
    }
  }

  // ── WhatsApp Message Formatter ──
  const buildWhatsAppMessage = (invoice: any) => {
    const divider = "──────────────────────────"
    const store = invoice.storeName || shopProfile?.companyName || "SHOPX STORE"
    const gst = invoice.storeGst || shopProfile?.gstNumber || ""
    const phone = invoice.storePhone || shopProfile?.phone || ""
    const loc = invoice.storeLocation || shopProfile?.location || ""

    let text = `*🧾 INVOICE / BILL*\n`
    text += `*${store}*\n`
    if (gst) text += `GSTIN: *${gst}*\n`
    if (phone) text += `Tel: ${phone}\n`
    if (loc) text += `Address: ${loc}\n`
    text += `${divider}\n`
    text += `*Bill No:* #${invoice.billNumber}\n`
    text += `*Date:* ${invoice.date}\n`
    text += `*Customer:* ${invoice.customerName}\n`
    if (invoice.customerPhone) text += `*Mobile:* +91 ${invoice.customerPhone}\n`
    text += `${divider}\n`
    text += `*ITEMS:*\n`

    invoice.items.forEach((item: any, idx: number) => {
      const lineTotal = (item.quantity * item.price) + (item.taxAmount || 0)
      text += `${idx + 1}. *${item.name}*\n`
      text += `   ${item.quantity} x ₹${item.price.toLocaleString()}`
      if (item.taxRate > 0) {
        text += ` (+${item.taxRate}% GST: ₹${item.taxAmount.toLocaleString()})`
      }
      text += ` = *₹${lineTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}*\n`
    })

    text += `${divider}\n`
    text += `*Subtotal:* ₹${invoice.subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}\n`
    if (invoice.totalTax > 0) {
      text += `*Total GST/Tax:* +₹${invoice.totalTax.toLocaleString(undefined, { maximumFractionDigits: 2 })}\n`
    }
    if (invoice.discount > 0) {
      text += `*Discount:* -₹${invoice.discount.toLocaleString(undefined, { maximumFractionDigits: 2 })}\n`
    }
    text += `*BILL TOTAL:* *₹${invoice.grandTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}*\n`

    if (invoice.previousDue > 0) {
      text += `*Previous Credit Due:* ₹${invoice.previousDue.toLocaleString(undefined, { maximumFractionDigits: 2 })}\n`
      text += `*NET OUTSTANDING PAYABLE:* *₹${(invoice.grandTotal + invoice.previousDue).toLocaleString(undefined, { maximumFractionDigits: 2 })}*\n`
    }

    text += `*Payment Mode:* ${invoice.paymentMethod.toUpperCase()}\n`
    text += `${divider}\n`
    text += `Thank you for your business! 🙏`
    return text
  }

  // ── WhatsApp Share Trigger ──
  const handleShareWhatsApp = (overridePhone?: string) => {
    const rawTargetPhone = overridePhone || resolvedCustomerPhone
    const clean10 = cleanIndianPhone(rawTargetPhone)

    if (!clean10) {
      toast({
        variant: "destructive",
        title: "Invalid Mobile Number",
        description: "Please provide a valid 10-digit Indian phone number (e.g. 9876543210) to share via WhatsApp.",
      })
      return
    }

    const invoice = generatedInvoiceData || {
      storeName: shopProfile?.companyName || "ShopX Store",
      storeGst: shopProfile?.gstNumber || "",
      storePhone: shopProfile?.phone || "",
      storeLocation: shopProfile?.location || "",
      billNumber: activeBillNumber,
      date: formatToDDMMYYYY(billingDate),
      customerName: resolvedCustomerName,
      customerPhone: clean10,
      items: billItems.map(i => ({
        name: i.product.name,
        quantity: i.quantity,
        price: i.price,
        taxRate: i.taxRate,
        taxAmount: i.taxAmount,
      })),
      subtotal: itemsSubtotal,
      totalTax: totalTaxAmount,
      discount: discountAmount,
      grandTotal,
      previousDue: customerPreviousBalance,
      paymentMethod,
    }

    const message = buildWhatsAppMessage(invoice)
    const waUrl = `https://wa.me/91${clean10}?text=${encodeURIComponent(message)}`
    window.open(waUrl, "_blank")
    toast({
      title: "Opening WhatsApp 🚀",
      description: `Opening WhatsApp chat with +91 ${clean10}`,
    })
  }

  // ── Generate Bill / Invoice Summary Screen ──
  const handleGenerateBill = () => {
    if (billItems.length === 0) {
      toast({ variant: "destructive", title: "Empty Cart", description: "Add products before generating a bill." })
      return
    }

    const invoiceData = {
      storeName: shopProfile?.companyName || "ShopX Store",
      storeGst: shopProfile?.gstNumber || "",
      storePhone: shopProfile?.phone || "",
      storeEmail: shopProfile?.email || "",
      storeLocation: shopProfile?.location || "",
      billNumber: activeBillNumber,
      date: formatToDDMMYYYY(billingDate),
      rawDate: billingDate,
      customerName: resolvedCustomerName,
      customerPhone: resolvedCustomerPhone,
      items: billItems.map(i => ({
        name: i.product.name,
        sku: i.product.sku,
        quantity: i.quantity,
        price: i.price,
        taxRate: i.taxRate,
        taxAmount: i.taxAmount,
      })),
      subtotal: itemsSubtotal,
      totalTax: totalTaxAmount,
      discount: discountAmount,
      grandTotal,
      previousDue: customerPreviousBalance,
      netPayable: totalWithPreviousDue,
      paymentMethod,
    }

    setGeneratedInvoiceData(invoiceData)
    setIsInvoiceModalOpen(true)
  }

  // ── Complete & Commit Sale ──
  const handleCompleteSale = async () => {
    if (billItems.length === 0 || !user?.uid) return

    if (paymentMethod === "credit" && !selectedCustomer) {
      toast({
        variant: "destructive",
        title: "Customer Required",
        description: "Please select or register a customer before billing on Shop Credit.",
      })
      return
    }

    const saleData = {
      billNumber: activeBillNumber,
      date: new Date(billingDate).toISOString(),
      customerId: selectedCustomer?.id || "walk-in",
      customerName: resolvedCustomerName,
      customerPhone: resolvedCustomerPhone,
      subtotal: itemsSubtotal,
      taxAmount: totalTaxAmount,
      discount: discountAmount,
      total: grandTotal,
      status: paymentMethod === "credit" ? "pending" : "paid",
      paymentMethod,
      items: billItems.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        sku: item.product.sku,
        quantity: item.quantity,
        price: item.price,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
      })),
    }

    try {
      setIsSubmitting(true)

      // Step 1: Save sale
      const saleRes = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.uid },
        body: JSON.stringify(saleData),
      })
      if (!saleRes.ok) throw new Error("Failed to save sale")
      const savedSale = await saleRes.json()

      // Step 2: Update inventory stock
      await Promise.all(
        billItems.map(item =>
          fetch(`/api/products/${item.product.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-user-id": user.uid },
            body: JSON.stringify({ stock: item.product.stock - item.quantity }),
          })
        )
      )

      // Step 3: Update customer outstanding balance if credit sale
      if (paymentMethod === "credit" && selectedCustomer) {
        await fetch(`/api/customers/${selectedCustomer.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-user-id": user.uid },
          body: JSON.stringify({ outstandingBalance: selectedCustomer.outstandingBalance + grandTotal }),
        })
      }

      // Step 4: Record cashbook entry for revenue
      if (paymentMethod !== "credit") {
        await fetch("/api/cashbook", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": user.uid },
          body: JSON.stringify({
            type: "income",
            category: "Sales Revenue",
            description: `Sale #${activeBillNumber} to ${resolvedCustomerName}`,
            amount: grandTotal,
            paymentMode: paymentMethod.toUpperCase(),
            note: `Bill #${activeBillNumber}`,
          }),
        }).catch(() => null)
      }

      // Open invoice modal so user can view/print/WhatsApp the completed bill
      setGeneratedInvoiceData({
        storeName: shopProfile?.companyName || "ShopX Store",
        storeGst: shopProfile?.gstNumber || "",
        storePhone: shopProfile?.phone || "",
        storeLocation: shopProfile?.location || "",
        billNumber: activeBillNumber,
        date: formatToDDMMYYYY(billingDate),
        customerName: resolvedCustomerName,
        customerPhone: resolvedCustomerPhone,
        items: billItems.map(i => ({
          name: i.product.name,
          sku: i.product.sku,
          quantity: i.quantity,
          price: i.price,
          taxRate: i.taxRate,
          taxAmount: i.taxAmount,
        })),
        subtotal: itemsSubtotal,
        totalTax: totalTaxAmount,
        discount: discountAmount,
        grandTotal,
        previousDue: customerPreviousBalance,
        netPayable: totalWithPreviousDue,
        paymentMethod,
      })
      setIsInvoiceModalOpen(true)

      // Refresh data
      fetchAllData()

      toast({
        title: "Sale Confirmed ✓",
        description: `Bill #${activeBillNumber} saved successfully.`,
      })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Sale Failed", description: err.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isCreditMissingCustomer = paymentMethod === "credit" && !selectedCustomer

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500 pb-12">
      {/* ── 1. HEADER & QUICK NAVIGATION ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-primary/10 text-primary">
            <FileText className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-headline font-bold">
              Sales <span className="text-primary">Terminal</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Billing with GST, Credit Balances & One-Click WhatsApp Sharing.
            </p>
          </div>
        </div>

        {/* Store GST indicator badge */}
        <div className="flex items-center gap-2">
          {shopProfile?.gstNumber ? (
            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[11px] font-code font-bold py-1 px-2.5">
              Shop GST: {shopProfile.gstNumber}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-400 text-[10px] font-semibold py-1 px-2">
              No Shop GST (Add in Profile)
            </Badge>
          )}
        </div>
      </div>

      {/* ── 2. BILL NAVIGATOR BAR: Date & Bill Number Steppers ── */}
      <div className="bg-card border border-border/60 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {/* Bill Number Stepper < Bill #N > */}
          <div className="flex items-center bg-secondary/40 border border-border/50 rounded-xl p-1 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg hover:bg-secondary text-foreground hover:text-primary"
              onClick={handlePrevBill}
              disabled={pastSales.length === 0 || currentBillIndex === 0}
              title="Previous Past Bill"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="px-2 text-center min-w-[90px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block leading-tight">
                Bill No
              </span>
              <span className="text-xs font-bold font-code text-primary">
                {currentBillIndex === -1 ? `Bill #${nextBillNumber}` : `Bill #${activeBillNumber}`}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg hover:bg-secondary text-foreground hover:text-primary"
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
              className="h-7 w-7 rounded-lg hover:bg-secondary text-foreground hover:text-primary shrink-0"
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
                <Calendar className="w-3 h-3 text-primary" />
                <span className="text-xs font-bold font-code text-foreground">
                  {formatToDDMMYYYY(billingDate)}
                </span>
                {billingDate === new Date().toISOString().split("T")[0] ? (
                  <Badge className="text-[8px] px-1 py-0 h-3.5 bg-primary/20 text-primary font-bold">
                    Today
                  </Badge>
                ) : (
                  <Badge className="text-[8px] px-1 py-0 h-3.5 bg-blue-500/20 text-blue-400 font-bold">
                    Selected
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
              className="h-7 w-7 rounded-lg hover:bg-secondary text-foreground hover:text-primary shrink-0"
              onClick={handleNextDate}
              title="Next Date"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {pastSales.length > 0 && (
            <Badge variant="outline" className="text-[10px] font-code h-7 px-2.5 bg-secondary/20">
              {pastSales.length} Recorded Sale{pastSales.length === 1 ? "" : "s"}
            </Badge>
          )}
        </div>

        {/* Current State / Reset to New Bill */}
        <div className="flex items-center gap-2">
          {currentBillIndex !== -1 ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-xs py-1 px-2.5 font-bold">
                Reviewing Bill #{activeBillNumber}
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="default"
                className="h-8 text-xs font-bold bg-primary text-primary-foreground rounded-xl shadow-sm gap-1"
                onClick={handleResetToNewBill}
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
              {billItems.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-bold border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 rounded-xl gap-1 transition-colors"
                  onClick={handleResetToNewBill}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 3. TOP ROW: Customer & Billing Input Form + Product Selector ── */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Customer Input & Credit Card */}
        <Card className="lg:col-span-1 border border-border/60 shadow-sm flex flex-col justify-between">
          <CardHeader className="flex flex-row justify-between items-center p-4 sm:p-5 pb-2">
            <div>
              <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary" /> Customer &amp; Billing Info
              </CardTitle>
              <CardDescription className="text-[11px]">
                Search customer or type directly (+91).
              </CardDescription>
            </div>
            {!selectedCustomer && (
              <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-full text-xs h-7 px-2.5">
                    <UserPlus className="w-3 h-3 mr-1" /> New
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-md rounded-2xl p-4 sm:p-6">
                  <form onSubmit={handleAddCustomer}>
                    <DialogHeader>
                      <DialogTitle>Register New Customer</DialogTitle>
                      <DialogDescription>Save customer details with Indian phone number for credit tracking and WhatsApp billing.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-4">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Customer Full Name *</Label>
                        <Input name="name" placeholder="e.g. Rahul Sharma" required />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">10-Digit Mobile Phone *</Label>
                        <div className="flex">
                          <span className="inline-flex items-center px-3 text-xs font-code font-bold bg-secondary/50 border border-r-0 border-border rounded-l-md text-muted-foreground">
                            +91
                          </span>
                          <Input name="phone" placeholder="9876543210" className="rounded-l-none font-code font-bold" required />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Email (Optional)</Label>
                        <Input name="email" type="email" placeholder="customer@example.com" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" className="w-full" disabled={isAddingCustomer}>
                        {isAddingCustomer && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Save &amp; Select Customer
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>

          <CardContent className="p-4 sm:p-5 pt-1 space-y-3">
            {/* Direct Input / Customer Selector */}
            {!selectedCustomer ? (
              <div className="space-y-2.5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search customer name or phone..."
                    className="pl-9 bg-secondary/30 border-border/40 rounded-xl text-xs h-9"
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                  />
                  {customerSearch && filteredCustomers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-card border border-border rounded-xl mt-1.5 z-50 shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                      {filteredCustomers.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full p-2.5 text-left hover:bg-secondary text-xs flex items-center justify-between border-b border-border/20 last:border-0"
                          onClick={() => {
                            setSelectedCustomer(c)
                            setManualCustomerName(c.name)
                            setManualCustomerPhone(c.phone)
                            setCustomerSearch("")
                          }}
                        >
                          <div>
                            <p className="font-bold text-foreground">{c.name}</p>
                            <p className="text-[10px] text-muted-foreground font-code">📞 +91 {c.phone}</p>
                          </div>
                          {c.outstandingBalance > 0 && (
                            <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                              Due: ₹{c.outstandingBalance}
                            </Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Direct quick fields if user does not want to search */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/30">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Customer Name</Label>
                    <Input
                      placeholder="Customer name"
                      className="h-8 text-xs bg-secondary/20"
                      value={manualCustomerName}
                      onChange={e => setManualCustomerName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Phone (+91)</Label>
                    <Input
                      placeholder="10-digit number"
                      className="h-8 text-xs font-code font-bold bg-secondary/20"
                      value={manualCustomerPhone}
                      onChange={e => setManualCustomerPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-foreground truncate">{selectedCustomer.name}</p>
                    <p className="text-[11px] font-code font-bold text-primary mt-0.5">
                      📞 +91 {selectedCustomer.phone}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] font-bold text-primary hover:bg-primary/20 px-2"
                    onClick={() => {
                      setSelectedCustomer(null)
                      setManualCustomerName("")
                      setManualCustomerPhone("")
                    }}
                  >
                    Change
                  </Button>
                </div>

                {/* Outstanding Credit Balance Card */}
                {selectedCustomer.outstandingBalance > 0 ? (
                  <div className="p-2 bg-amber-500/15 border border-amber-500/30 rounded-lg flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-amber-300">Previous Credit Balance:</span>
                    <span className="text-xs font-code font-bold text-amber-300">
                      ₹{selectedCustomer.outstandingBalance.toLocaleString()}
                    </span>
                  </div>
                ) : (
                  <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <Check className="w-3 h-3" /> No pending credit due
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Selector / Fast Add (Top 5) */}
        <Card className="lg:col-span-2 border border-border/60 shadow-sm flex flex-col justify-between">
          <CardHeader className="p-4 sm:p-5 pb-2 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search inventory by item name or SKU..."
                className="pl-9 bg-secondary/30 border-border/40 rounded-xl h-10 text-xs sm:text-sm"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="font-semibold uppercase tracking-wider text-[11px] text-primary flex items-center gap-1.5 truncate">
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{productSearch ? "Search Results (Top 5)" : "🔥 Fast Add (Top 5 Best Sellers)"}</span>
              </span>
              <span className="text-[10px] font-code shrink-0">{displayProducts.length} items</span>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 pt-0 grid gap-2 sm:grid-cols-2 max-h-[190px] overflow-y-auto">
            {displayProducts.map(p => (
              <div
                key={p.id}
                className="p-2.5 sm:p-3 border border-border/50 rounded-xl hover:bg-secondary/50 cursor-pointer transition-colors group flex justify-between items-center"
                onClick={() => addItem(p)}
              >
                <div className="min-w-0 pr-2">
                  <p className="font-bold text-xs group-hover:text-primary transition-colors truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground font-code">{p.sku} • Stock: {p.stock}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-primary font-bold text-sm">₹{p.sellingPrice.toLocaleString()}</p>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] text-primary hover:bg-primary/20 px-1.5 py-0">
                    + Add
                  </Button>
                </div>
              </div>
            ))}
            {displayProducts.length === 0 && (
              <div className="col-span-full py-6 text-center text-muted-foreground text-xs italic">
                No items found. Add products in Inventory.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 4. REVIEW INVOICE & DYNAMIC ITEMS TABLE ── */}
      <Card className="border border-border/60 shadow-xl bg-card">
        <CardHeader className="p-4 sm:p-5 border-b border-border/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <CardTitle className="text-base sm:text-lg font-headline flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary shrink-0" />
            <span>Billing Invoice Sheet</span>
            {billItems.length > 0 && <Badge className="ml-1.5">{billItems.length}</Badge>}
          </CardTitle>

          <div className="flex flex-wrap items-center gap-2">
            {/* Generate Bill Button */}
            <Button
              type="button"
              variant="outline"
              className="h-10 px-4 font-bold rounded-xl border-primary/40 text-primary hover:bg-primary/10 gap-1.5 shadow-sm"
              onClick={handleGenerateBill}
              disabled={billItems.length === 0}
            >
              <Receipt className="w-4 h-4" />
              <span>Generate Bill</span>
            </Button>

            {/* Complete Sale Button */}
            <Button
              className="h-10 px-5 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 hover:brightness-110 transition-all gap-1.5"
              onClick={handleCompleteSale}
              disabled={billItems.length === 0 || isSubmitting || isCreditMissingCustomer}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> Complete Sale</>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 sm:p-0">
          <div className="grid gap-0 lg:grid-cols-3">
            {/* Items Table (Left 2 columns) */}
            <div className="lg:col-span-2 border-b lg:border-b-0 lg:border-r border-border/50 overflow-x-auto">
              <Table className="min-w-[620px] w-full">
                <TableHeader className="bg-secondary/20">
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="w-8 text-center text-[10px] font-bold uppercase py-2.5 px-2">#</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase py-2.5 px-2 min-w-[150px]">Product</TableHead>
                    <TableHead className="w-[100px] text-center text-[10px] font-bold uppercase py-2.5 px-1">Qty</TableHead>
                    <TableHead className="w-[100px] text-right text-[10px] font-bold uppercase py-2.5 px-1">Price (₹)</TableHead>
                    <TableHead className="w-[80px] text-center text-[10px] font-bold uppercase py-2.5 px-1">GST (%)</TableHead>
                    <TableHead className="w-[90px] text-right text-[10px] font-bold uppercase py-2.5 px-1">GST (₹)</TableHead>
                    <TableHead className="w-[110px] text-right text-[10px] font-bold uppercase py-2.5 px-2">Total (₹)</TableHead>
                    <TableHead className="w-10 py-2.5 px-1" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billItems.map((item, idx) => {
                    const rowLine = (item.quantity * item.price) + (item.taxAmount || 0)

                    return (
                      <TableRow key={item.product.id} className="border-border/30 hover:bg-secondary/10 group">
                        <TableCell className="text-center font-code text-xs text-muted-foreground py-2 px-2">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="py-2 px-2">
                          <p className="font-bold text-xs text-foreground truncate">{item.product.name}</p>
                          <p className="text-[10px] text-muted-foreground font-code">{item.product.sku}</p>
                        </TableCell>

                        {/* Qty Stepper */}
                        <TableCell className="py-2 px-1 text-center">
                          <div className="flex items-center justify-center bg-secondary/50 rounded-lg p-0.5 border border-border/40 w-fit mx-auto">
                            <button
                              type="button"
                              className="w-5 h-6 rounded flex items-center justify-center hover:bg-background text-xs font-bold"
                              onClick={() => updateItemQuantity(item.product.id, item.quantity - 1)}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={e => updateItemQuantity(item.product.id, Number(e.target.value) || 1)}
                              className="w-8 text-center text-xs font-bold bg-transparent border-none focus:outline-none"
                            />
                            <button
                              type="button"
                              className="w-5 h-6 rounded flex items-center justify-center hover:bg-background text-xs font-bold"
                              onClick={() => updateItemQuantity(item.product.id, item.quantity + 1)}
                            >
                              +
                            </button>
                          </div>
                        </TableCell>

                        {/* Unit Price */}
                        <TableCell className="py-2 px-1 text-right">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={item.price}
                            onChange={e => updateItemPrice(item.product.id, Number(e.target.value) || 0)}
                            className="w-20 h-7 text-xs font-code font-bold text-right bg-secondary/30 border border-slate-600 rounded px-1.5 focus:border-primary focus:outline-none ml-auto block"
                          />
                        </TableCell>

                        {/* GST % */}
                        <TableCell className="py-2 px-1 text-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="any"
                            placeholder="0"
                            value={item.taxRate || ""}
                            onChange={e => updateItemTaxRate(item.product.id, Number(e.target.value) || 0)}
                            className="w-14 h-7 text-xs font-code font-bold text-center bg-secondary/30 border border-slate-600 text-cyan-400 rounded px-1 focus:border-cyan-400 focus:outline-none mx-auto block"
                          />
                        </TableCell>

                        {/* GST ₹ */}
                        <TableCell className="py-2 px-1 text-right">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            placeholder="0"
                            value={item.taxAmount || ""}
                            onChange={e => updateItemTaxAmount(item.product.id, Number(e.target.value) || 0)}
                            className="w-16 h-7 text-xs font-code font-bold text-right bg-secondary/30 border border-slate-600 text-cyan-400 rounded px-1.5 focus:border-cyan-400 focus:outline-none ml-auto block"
                          />
                        </TableCell>

                        {/* Row Total */}
                        <TableCell className="py-2 px-2 text-right font-code font-bold text-xs text-foreground">
                          ₹{rowLine.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </TableCell>

                        {/* Delete */}
                        <TableCell className="py-2 px-1 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive/50 hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeItem(item.product.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}

                  {billItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="h-44 text-center">
                        <div className="flex flex-col items-center justify-center opacity-40 gap-2">
                          <ShoppingCart className="w-10 h-10" />
                          <p className="text-xs font-bold">Billing Cart Empty</p>
                          <p className="text-[11px]">Click items above or search inventory to add.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Billing Summary & Settlement (Right column) */}
            <div className="p-4 sm:p-5 space-y-4 bg-secondary/10 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Items Subtotal:</span>
                    <span className="font-code font-bold text-foreground">₹{itemsSubtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>

                  {totalTaxAmount > 0 && (
                    <div className="flex justify-between text-cyan-400">
                      <span>Total GST / Tax:</span>
                      <span className="font-code font-bold">+ ₹{totalTaxAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  {/* Discount input */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Label className="text-muted-foreground text-xs shrink-0">Discount</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        value={discountValue || ""}
                        onChange={e => setDiscountValue(Math.max(0, Number(e.target.value) || 0))}
                        placeholder="0"
                        className="h-7 w-16 text-right bg-secondary/30 border-border/50 rounded-lg text-xs font-code font-bold"
                      />
                      <div className="flex items-center bg-secondary/50 rounded-lg p-0.5 border border-border/30">
                        <Button
                          type="button"
                          variant={discountType === "flat" ? "default" : "ghost"}
                          size="icon"
                          className="h-6 w-6 text-xs rounded-md"
                          onClick={() => setDiscountType("flat")}
                          title="Flat amount (₹)"
                        >
                          ₹
                        </Button>
                        <Button
                          type="button"
                          variant={discountType === "percent" ? "default" : "ghost"}
                          size="icon"
                          className="h-6 w-6 text-xs rounded-md"
                          onClick={() => setDiscountType("percent")}
                          title="Percentage (%)"
                        >
                          <Percent className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-destructive">
                      <span>Discount Applied:</span>
                      <span className="font-code font-bold">- ₹{discountAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  <Separator className="bg-border/60 my-2" />

                  <div className="flex justify-between text-base sm:text-lg font-bold text-foreground">
                    <span>Grand Total:</span>
                    <span className="text-primary font-code">₹{grandTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>

                  {customerPreviousBalance > 0 && (
                    <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs space-y-1">
                      <div className="flex justify-between text-amber-300">
                        <span>Previous Due:</span>
                        <span className="font-code font-bold">₹{customerPreviousBalance.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold text-amber-400 pt-1 border-t border-amber-500/20">
                        <span>Net Payable:</span>
                        <span className="font-code">₹{totalWithPreviousDue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Settlement Method Selector */}
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Settlement Method
                  </Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'upi', label: 'UPI / Scan', icon: Zap },
                      { id: 'cash', label: 'Cash', icon: Banknote },
                      { id: 'card', label: 'Card', icon: CreditCard },
                      { id: 'credit', label: 'Shop Credit', icon: History }
                    ].map(m => (
                      <Button
                        key={m.id}
                        type="button"
                        variant={paymentMethod === m.id ? "default" : "outline"}
                        className={cn(
                          "h-9 justify-start gap-1.5 rounded-xl transition-all px-2 text-xs",
                          paymentMethod === m.id ? "bg-primary text-primary-foreground shadow-md scale-[1.01]" : "hover:bg-secondary/60"
                        )}
                        onClick={() => setPaymentMethod(m.id)}
                      >
                        <m.icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-bold uppercase text-[10px] truncate">{m.label}</span>
                      </Button>
                    ))}
                  </div>
                  {isCreditMissingCustomer && (
                    <p className="text-[10px] text-destructive font-bold">
                      Select or register a customer above for Shop Credit billing.
                    </p>
                  )}
                </div>
              </div>

              {/* Bottom Quick Action: WhatsApp Share & Generate Bill */}
              <div className="pt-3 border-t border-border/40 space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-9 rounded-xl border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-bold text-xs gap-1.5"
                  onClick={() => handleShareWhatsApp()}
                  disabled={billItems.length === 0}
                >
                  <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Send Bill via WhatsApp</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 5. COMPLETE BILL GENERATION & INVOICE SUMMARY MODAL ── */}
      <Dialog open={isInvoiceModalOpen} onOpenChange={setIsInvoiceModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
          {generatedInvoiceData && (
            <div className="space-y-4">
              <DialogHeader className="border-b border-border/50 pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <DialogTitle className="text-xl font-bold font-headline flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-primary" /> Invoice Summary
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Official tax & sales receipt generated for this purchase.
                    </DialogDescription>
                  </div>
                  <Badge className="bg-primary/20 text-primary border-primary/40 text-xs px-2.5 py-0.5 self-start sm:self-auto font-code">
                    Bill #{generatedInvoiceData.billNumber}
                  </Badge>
                </div>
              </DialogHeader>

              {/* Invoice Printable View */}
              <div id="printable-invoice" className="bg-card border border-border/60 rounded-xl p-4 sm:p-5 space-y-4 text-xs">
                {/* Store Header */}
                <div className="flex justify-between items-start border-b border-border/40 pb-3 gap-3">
                  <div>
                    <h2 className="text-base font-bold text-foreground uppercase tracking-wide">
                      {generatedInvoiceData.storeName}
                    </h2>
                    {generatedInvoiceData.storeGst && (
                      <p className="text-[11px] font-code font-bold text-emerald-400 mt-0.5">
                        GSTIN: {generatedInvoiceData.storeGst}
                      </p>
                    )}
                    {generatedInvoiceData.storePhone && (
                      <p className="text-[11px] text-muted-foreground font-code">
                        📞 {generatedInvoiceData.storePhone}
                      </p>
                    )}
                    {generatedInvoiceData.storeLocation && (
                      <p className="text-[11px] text-muted-foreground">
                        📍 {generatedInvoiceData.storeLocation}
                      </p>
                    )}
                  </div>
                  <div className="text-right space-y-0.5 font-code">
                    <p className="text-muted-foreground uppercase text-[10px] font-bold">Tax Invoice</p>
                    <p className="font-bold text-primary">#{generatedInvoiceData.billNumber}</p>
                    <p className="text-muted-foreground text-[10px]">Date: {generatedInvoiceData.date}</p>
                    <Badge variant="outline" className="text-[9px] font-bold uppercase mt-1">
                      {generatedInvoiceData.paymentMethod}
                    </Badge>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="p-3 bg-secondary/30 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-muted-foreground block">Billed To</span>
                    <p className="font-bold text-sm text-foreground">{generatedInvoiceData.customerName}</p>
                    {generatedInvoiceData.customerPhone && (
                      <p className="text-xs font-code text-primary font-bold">
                        📞 +91 {generatedInvoiceData.customerPhone}
                      </p>
                    )}
                  </div>
                  {generatedInvoiceData.previousDue > 0 && (
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] font-bold uppercase text-amber-400 block">Existing Due Balance</span>
                      <span className="font-code font-bold text-amber-300 text-xs">
                        ₹{generatedInvoiceData.previousDue.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Itemized Table */}
                <div className="border border-border/40 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-secondary/40">
                      <TableRow className="border-border/40">
                        <TableHead className="py-2 text-[10px] font-bold uppercase">Item</TableHead>
                        <TableHead className="py-2 text-[10px] font-bold uppercase text-center">Qty</TableHead>
                        <TableHead className="py-2 text-[10px] font-bold uppercase text-right">Rate (₹)</TableHead>
                        {generatedInvoiceData.totalTax > 0 && (
                          <TableHead className="py-2 text-[10px] font-bold uppercase text-right">GST</TableHead>
                        )}
                        <TableHead className="py-2 text-[10px] font-bold uppercase text-right">Amount (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {generatedInvoiceData.items.map((it: any, i: number) => {
                        const line = (it.quantity * it.price) + (it.taxAmount || 0)
                        return (
                          <TableRow key={i} className="border-border/30">
                            <TableCell className="py-2">
                              <p className="font-bold">{it.name}</p>
                              {it.sku && <p className="text-[9px] text-muted-foreground font-code">{it.sku}</p>}
                            </TableCell>
                            <TableCell className="py-2 text-center font-bold">{it.quantity}</TableCell>
                            <TableCell className="py-2 text-right font-code">₹{it.price.toLocaleString()}</TableCell>
                            {generatedInvoiceData.totalTax > 0 && (
                              <TableCell className="py-2 text-right font-code text-cyan-400">
                                {it.taxRate > 0 ? `${it.taxRate}% (₹${it.taxAmount})` : "-"}
                              </TableCell>
                            )}
                            <TableCell className="py-2 text-right font-code font-bold">
                              ₹{line.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Financial Breakdown */}
                <div className="space-y-1.5 pt-2 border-t border-border/40">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Items Subtotal:</span>
                    <span className="font-code font-bold">₹{generatedInvoiceData.subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                  {generatedInvoiceData.totalTax > 0 && (
                    <div className="flex justify-between text-cyan-400">
                      <span>Total GST / Tax:</span>
                      <span className="font-code font-bold">+ ₹{generatedInvoiceData.totalTax.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {generatedInvoiceData.discount > 0 && (
                    <div className="flex justify-between text-destructive">
                      <span>Discount:</span>
                      <span className="font-code font-bold">- ₹{generatedInvoiceData.discount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm sm:text-base font-bold text-foreground pt-1 border-t border-border/40">
                    <span>Invoice Total:</span>
                    <span className="text-primary font-code">₹{generatedInvoiceData.grandTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>

                  {generatedInvoiceData.previousDue > 0 && (
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-1">
                      <div className="flex justify-between text-amber-300">
                        <span>Previous Outstanding Credit:</span>
                        <span className="font-code font-bold">₹{generatedInvoiceData.previousDue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold text-amber-400 text-sm pt-1 border-t border-amber-500/20">
                        <span>Total Balance Payable:</span>
                        <span className="font-code">₹{(generatedInvoiceData.grandTotal + generatedInvoiceData.previousDue).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-center text-[10px] text-muted-foreground pt-2 border-t border-border/30 italic">
                  Thank you for shopping with us! Have a wonderful day.
                </div>
              </div>

              {/* Dialog Action Buttons */}
              <DialogFooter className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs gap-1.5"
                  onClick={() => window.print()}
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Receipt
                </Button>

                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs gap-1.5 shadow-md shadow-emerald-600/20"
                  onClick={() => handleShareWhatsApp()}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Send Bill via WhatsApp
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-xl text-xs"
                  onClick={() => setIsInvoiceModalOpen(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
