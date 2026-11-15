"use client"

import * as React from "react"
import {
  IndianRupee,
  Search,
  Loader2,
  User,
  Phone,
  Mail,
  Calendar,
  CheckCircle,
  FileText,
  Plus,
  ArrowLeft,
  Truck,
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Building2,
  Filter,
  AlertCircle,
  Check,
  RotateCcw,
  Receipt,
  Eye,
  History,
  ChevronLeft,
  ChevronRight,
  Download,
  Package,
  FileSpreadsheet,
  ExternalLink,
  Layers,
  Wallet,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useUser } from "@/app/auth/use-user"
import { useShop } from "@/hooks/useShop"
import { toast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface Customer {
  id: string
  name: string
  phone: string
  email?: string
  outstandingBalance: number
  createdAt: string
}

interface SaleItem {
  productId: string
  productName: string
  quantity: number
  price: number
}

interface Sale {
  id: string
  billNumber?: string
  invoiceNumber?: string
  date: string
  customerId: string
  customerName: string
  customerPhone?: string
  customerEmail?: string
  total: number
  status: "paid" | "pending" | "returned"
  paymentMethod: "cash" | "upi" | "card" | "credit"
  items: SaleItem[]
  createdAt?: string
}

interface Supplier {
  id: string
  name: string
  contactPerson?: string
  phone?: string
  email?: string
  address?: string
  gstNumber?: string
  createdAt?: string
}

interface PurchaseRecord {
  id: string
  supplierId: string
  productId: string
  productName: string
  itemCode?: string
  quantity: number
  purchasePrice: number
  billingDate?: string
  createdAt: string
}

interface SupplierPaymentRecord {
  id: string
  supplierId: string
  amount: number
  paymentMode: string
  note?: string
  createdAt: string
}

interface CashbookEntry {
  id: string
  type: "income" | "expense"
  category: string
  description: string
  amount: number
  paymentMode: string
  note?: string
  createdAt: string
}

interface CustomerCreditSummary {
  customer: Customer
  totalBilled: number
  totalPaid: number
  outstandingCredit: number
  invoicesCount: number
  lastDate?: string
}

interface SupplierCreditSummary {
  supplier: Supplier
  totalPurchased: number
  totalPaid: number
  outstandingCredit: number
  purchasesCount: number
  lastDate?: string
}

interface ExportData {
  title: string
  subtitle: string
  filename: string
  headers: string[]
  rows: (string | number)[][]
  summary?: { label: string; value: string }[]
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n)

const formatDate = (s: string) => {
  if (!s) return "—"
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function CreditTrackingPage() {
  const { user } = useUser()
  const { data: shopData } = useShop(user?.uid)
  const companyName = shopData?.companyName?.trim() || shopData?.ownerName?.trim() || "ShopX"
  const companyContact = [shopData?.location, shopData?.phone].filter(Boolean).join(" • ")

  const [loading, setLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState<"overview" | "customers" | "suppliers">("overview")

  // Customer Data States
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [sales, setSales] = React.useState<Sale[]>([])
  const [customerSearchQuery, setCustomerSearchQuery] = React.useState("")
  const [customerFilterMode, setCustomerFilterMode] = React.useState<"all" | "due" | "cleared">("due")
  const [cashbookIncomes, setCashbookIncomes] = React.useState<CashbookEntry[]>([])

  // Supplier Data States
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([])
  const [purchases, setPurchases] = React.useState<PurchaseRecord[]>([])
  const [supplierPayments, setSupplierPayments] = React.useState<SupplierPaymentRecord[]>([])
  const [supplierSearchQuery, setSupplierSearchQuery] = React.useState("")
  const [supplierFilterMode, setSupplierFilterMode] = React.useState<"all" | "due" | "cleared">("due")

  // Customer Collect Payment Dialog State
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null)
  const [customerPaymentAmount, setCustomerPaymentAmount] = React.useState("")
  const [customerPaymentMode, setCustomerPaymentMode] = React.useState("Cash")
  const [customerPaymentNote, setCustomerPaymentNote] = React.useState("")
  const [submittingCustomerPayment, setSubmittingCustomerPayment] = React.useState(false)

  // Customer Details & Ledger Modal State
  const [selectedCustomerForBills, setSelectedCustomerForBills] = React.useState<Customer | null>(null)
  const [selectedCustomerDate, setSelectedCustomerDate] = React.useState<string | "ALL">("ALL")
  const [customerLedgerTab, setCustomerLedgerTab] = React.useState<"products" | "invoices" | "payments">("products")

  // Supplier Details & Inward Bills Modal State
  const [selectedSupplierForBills, setSelectedSupplierForBills] = React.useState<SupplierCreditSummary | null>(null)
  const [selectedSupplierDate, setSelectedSupplierDate] = React.useState<string | "ALL">("ALL")
  const [supplierLedgerTab, setSupplierLedgerTab] = React.useState<"inwards" | "payments">("inwards")

  // Supplier Pay Dialog State
  const [selectedSupplierForPay, setSelectedSupplierForPay] = React.useState<SupplierCreditSummary | null>(null)
  const [supplierPayAmount, setSupplierPayAmount] = React.useState("")
  const [supplierPayMode, setSupplierPayMode] = React.useState("Cash")
  const [supplierPayNote, setSupplierPayNote] = React.useState("")
  const [submittingSupplierPay, setSubmittingSupplierPay] = React.useState(false)

  // Universal Export Modal State
  const [isExportOpen, setIsExportOpen] = React.useState(false)
  const [exportData, setExportData] = React.useState<ExportData | null>(null)
  const [showSheetsGuide, setShowSheetsGuide] = React.useState(false)

  // Fetch all accounting, sales, customers, suppliers, purchases, cashbook and supplier payments
  const fetchData = React.useCallback(async () => {
    if (!user?.uid) return
    setLoading(true)
    try {
      const [custRes, salesRes, supRes, purRes, payRes, cashRes] = await Promise.all([
        fetch("/api/customers", { headers: { "x-user-id": user.uid } }),
        fetch("/api/sales", { headers: { "x-user-id": user.uid } }),
        fetch("/api/suppliers", { headers: { "x-user-id": user.uid } }),
        fetch("/api/purchases", { headers: { "x-user-id": user.uid } }),
        fetch("/api/supplier-payments", { headers: { "x-user-id": user.uid } }),
        fetch("/api/cashbook?type=income", { headers: { "x-user-id": user.uid } }),
      ])

      if (custRes.ok) setCustomers(await custRes.json())
      if (salesRes.ok) setSales(await salesRes.json())
      if (supRes.ok) setSuppliers(await supRes.json())
      if (purRes.ok) setPurchases(await purRes.json())
      if (payRes.ok) {
        const pData = await payRes.json()
        setSupplierPayments(Array.isArray(pData) ? pData : pData.payments || [])
      }
      if (cashRes.ok) {
        const cData = await cashRes.json()
        setCashbookIncomes(Array.isArray(cData) ? cData : [])
      }
    } catch (err) {
      console.error(err)
      toast({
        variant: "destructive",
        title: "Error fetching data",
        description: "Failed to load credit and ledger records.",
      })
    } finally {
      setLoading(false)
    }
  }, [user?.uid])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── CUSTOMER CREDITS COMPUTATIONS ──
  const customerCredits = React.useMemo((): CustomerCreditSummary[] => {
    return customers.map(c => {
      const custSales = sales.filter(s => s.customerId === c.id)
      const totalBilled = custSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0)
      const outstandingCredit = Number(c.outstandingBalance) || 0
      const totalPaid = Math.max(0, totalBilled - outstandingCredit)

      const allDates = custSales.map(s => s.date || (s.createdAt ? s.createdAt.split("T")[0] : "")).filter(Boolean)
      allDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      const lastDate = allDates[0]

      return {
        customer: c,
        totalBilled,
        totalPaid,
        outstandingCredit,
        invoicesCount: custSales.length,
        lastDate,
      }
    })
  }, [customers, sales])

  const creditCustomersWithBalance = React.useMemo(() => {
    return customerCredits.filter(c => c.outstandingCredit > 0)
  }, [customerCredits])

  const totalCustomerCreditOutstanding = React.useMemo(() => {
    return customerCredits.reduce((acc, c) => acc + c.outstandingCredit, 0)
  }, [customerCredits])

  const filteredCustomerCredits = React.useMemo(() => {
    return customerCredits.filter(item => {
      const matchesSearch =
        item.customer.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
        item.customer.phone.includes(customerSearchQuery) ||
        (item.customer.email && item.customer.email.toLowerCase().includes(customerSearchQuery.toLowerCase()))

      const matchesFilter =
        customerFilterMode === "all"
          ? true
          : customerFilterMode === "due"
          ? item.outstandingCredit > 0
          : item.outstandingCredit === 0

      return matchesSearch && matchesFilter
    })
  }, [customerCredits, customerSearchQuery, customerFilterMode])

  const creditSales = React.useMemo(() => {
    return sales.filter(s => s.paymentMethod === "credit")
  }, [sales])

  // ── SUPPLIER CREDITS COMPUTATIONS ──
  const supplierCredits = React.useMemo((): SupplierCreditSummary[] => {
    return suppliers.map(sup => {
      const supPurchases = purchases.filter(p => p.supplierId === sup.id)
      const supPayments = supplierPayments.filter(p => p.supplierId === sup.id)

      const totalPurchased = supPurchases.reduce(
        (acc, p) => acc + ((Number(p.quantity) || 1) * (Number(p.purchasePrice) || 0)),
        0
      )
      const totalPaid = supPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
      const outstandingCredit = Math.max(0, totalPurchased - totalPaid)

      const allDates = [
        ...supPurchases.map(p => p.billingDate || p.createdAt),
        ...supPayments.map(p => p.createdAt),
      ].filter(Boolean)
      allDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      const lastDate = allDates[0]

      return {
        supplier: sup,
        totalPurchased,
        totalPaid,
        outstandingCredit,
        purchasesCount: supPurchases.length,
        lastDate,
      }
    })
  }, [suppliers, purchases, supplierPayments])

  const creditSuppliersWithBalance = React.useMemo(() => {
    return supplierCredits.filter(s => s.outstandingCredit > 0)
  }, [supplierCredits])

  const totalSupplierCreditOutstanding = React.useMemo(() => {
    return supplierCredits.reduce((acc, s) => acc + s.outstandingCredit, 0)
  }, [supplierCredits])

  const filteredSupplierCredits = React.useMemo(() => {
    return supplierCredits.filter(item => {
      const matchesSearch =
        item.supplier.name.toLowerCase().includes(supplierSearchQuery.toLowerCase()) ||
        (item.supplier.phone && item.supplier.phone.includes(supplierSearchQuery)) ||
        (item.supplier.contactPerson &&
          item.supplier.contactPerson.toLowerCase().includes(supplierSearchQuery.toLowerCase()))

      const matchesFilter =
        supplierFilterMode === "all"
          ? true
          : supplierFilterMode === "due"
          ? item.outstandingCredit > 0
          : item.outstandingCredit === 0

      return matchesSearch && matchesFilter
    })
  }, [supplierCredits, supplierSearchQuery, supplierFilterMode])

  // Net position: Receivables (Customers owe us) - Payables (We owe Suppliers)
  const netCreditBalance = totalCustomerCreditOutstanding - totalSupplierCreditOutstanding

  // ── ACTIVE CUSTOMER MODAL COMPUTATIONS (LEDGER LIKE SUPPLIER PURCHASE HISTORY) ──
  const activeCustomerSales = React.useMemo(() => {
    if (!selectedCustomerForBills) return []
    return sales
      .filter(s => s.customerId === selectedCustomerForBills.id)
      .sort((a, b) => new Date(b.date || b.createdAt || "").getTime() - new Date(a.date || a.createdAt || "").getTime())
  }, [sales, selectedCustomerForBills])

  // Flattened itemized products list (matching supplier purchase ledger table)
  const activeCustomerItems = React.useMemo(() => {
    const list: Array<{
      id: string
      saleId: string
      billNumber: string
      date: string
      productName: string
      quantity: number
      price: number
      total: number
      paymentMethod: string
      status: string
    }> = []

    activeCustomerSales.forEach(s => {
      const billNum = s.billNumber || s.invoiceNumber || s.id.slice(-6).toUpperCase()
      const d = s.date ? s.date.split("T")[0] : (s.createdAt ? s.createdAt.split("T")[0] : "—")
      if (s.items && s.items.length > 0) {
        s.items.forEach((it, idx) => {
          const qty = Number(it.quantity) || 1
          const pr = Number(it.price) || 0
          list.push({
            id: `${s.id}-${idx}`,
            saleId: s.id,
            billNumber: billNum,
            date: d,
            productName: it.productName || "Product",
            quantity: qty,
            price: pr,
            total: qty * pr,
            paymentMethod: s.paymentMethod,
            status: s.status,
          })
        })
      } else {
        list.push({
          id: s.id,
          saleId: s.id,
          billNumber: billNum,
          date: d,
          productName: "Sales Bill",
          quantity: 1,
          price: Number(s.total) || 0,
          total: Number(s.total) || 0,
          paymentMethod: s.paymentMethod,
          status: s.status,
        })
      }
    })

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [activeCustomerSales])

  // Unique billing dates for active customer
  const customerUniqueDates = React.useMemo(() => {
    const dates = Array.from(new Set(activeCustomerItems.map(it => it.date))).filter(d => d && d !== "—").sort().reverse()
    return dates
  }, [activeCustomerItems])

  // Filtered customer items based on selectedCustomerDate
  const displayedCustomerItems = React.useMemo(() => {
    if (selectedCustomerDate === "ALL") return activeCustomerItems
    return activeCustomerItems.filter(it => it.date === selectedCustomerDate)
  }, [activeCustomerItems, selectedCustomerDate])

  // Filtered customer sales bills based on selectedCustomerDate
  const displayedCustomerSales = React.useMemo(() => {
    if (selectedCustomerDate === "ALL") return activeCustomerSales
    return activeCustomerSales.filter(s => {
      const d = s.date ? s.date.split("T")[0] : (s.createdAt ? s.createdAt.split("T")[0] : "")
      return d === selectedCustomerDate
    })
  }, [activeCustomerSales, selectedCustomerDate])

  // Customer collection payments from Cashbook incomes
  const activeCustomerPayments = React.useMemo(() => {
    if (!selectedCustomerForBills) return []
    const custNameLower = selectedCustomerForBills.name.toLowerCase()
    return cashbookIncomes.filter(inc => {
      const desc = (inc.description || "").toLowerCase()
      const note = (inc.note || "").toLowerCase()
      return (
        inc.category === "Customer Credit Collection" &&
        (desc.includes(custNameLower) || note.includes(custNameLower))
      )
    })
  }, [cashbookIncomes, selectedCustomerForBills])

  const customerTotalQty = React.useMemo(() => {
    return displayedCustomerItems.reduce((acc, it) => acc + it.quantity, 0)
  }, [displayedCustomerItems])

  const customerTotalAmount = React.useMemo(() => {
    return displayedCustomerItems.reduce((acc, it) => acc + it.total, 0)
  }, [displayedCustomerItems])

  // Date Stepper Handlers for Customer Ledger
  const handlePrevCustomerDate = () => {
    if (customerUniqueDates.length === 0) return
    if (selectedCustomerDate === "ALL") {
      setSelectedCustomerDate(customerUniqueDates[0])
    } else {
      const currentIdx = customerUniqueDates.indexOf(selectedCustomerDate)
      if (currentIdx < customerUniqueDates.length - 1) {
        setSelectedCustomerDate(customerUniqueDates[currentIdx + 1])
      }
    }
  }

  const handleNextCustomerDate = () => {
    if (customerUniqueDates.length === 0 || selectedCustomerDate === "ALL") return
    const currentIdx = customerUniqueDates.indexOf(selectedCustomerDate)
    if (currentIdx > 0) {
      setSelectedCustomerDate(customerUniqueDates[currentIdx - 1])
    } else if (currentIdx === 0) {
      setSelectedCustomerDate("ALL")
    }
  }

  // ── ACTIVE SUPPLIER MODAL COMPUTATIONS (STEPPER & INWARD LEDGER) ──
  const activeSupplierPurchases = React.useMemo(() => {
    if (!selectedSupplierForBills) return []
    return purchases
      .filter(p => p.supplierId === selectedSupplierForBills.supplier.id)
      .sort((a, b) => {
        const dA = a.billingDate || a.createdAt || ""
        const dB = b.billingDate || b.createdAt || ""
        return dB.localeCompare(dA)
      })
  }, [purchases, selectedSupplierForBills])

  const supplierUniqueDates = React.useMemo(() => {
    const dates = Array.from(new Set(activeSupplierPurchases.map(p => {
      return p.billingDate || (p.createdAt ? p.createdAt.split("T")[0] : "")
    }))).filter(Boolean).sort().reverse()
    return dates
  }, [activeSupplierPurchases])

  const displayedSupplierPurchases = React.useMemo(() => {
    if (selectedSupplierDate === "ALL") return activeSupplierPurchases
    return activeSupplierPurchases.filter(p => {
      const d = p.billingDate || (p.createdAt ? p.createdAt.split("T")[0] : "")
      return d === selectedSupplierDate
    })
  }, [activeSupplierPurchases, selectedSupplierDate])

  const activeSupplierPayments = React.useMemo(() => {
    if (!selectedSupplierForBills) return []
    return supplierPayments
      .filter(p => p.supplierId === selectedSupplierForBills.supplier.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [supplierPayments, selectedSupplierForBills])

  const supplierTotalQty = React.useMemo(() => {
    return displayedSupplierPurchases.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0)
  }, [displayedSupplierPurchases])

  const supplierTotalSpend = React.useMemo(() => {
    return displayedSupplierPurchases.reduce(
      (acc, p) => acc + (Number(p.quantity) || 0) * (Number(p.purchasePrice) || 0),
      0
    )
  }, [displayedSupplierPurchases])

  const handlePrevSupplierDate = () => {
    if (supplierUniqueDates.length === 0) return
    if (selectedSupplierDate === "ALL") {
      setSelectedSupplierDate(supplierUniqueDates[0])
    } else {
      const currentIdx = supplierUniqueDates.indexOf(selectedSupplierDate)
      if (currentIdx < supplierUniqueDates.length - 1) {
        setSelectedSupplierDate(supplierUniqueDates[currentIdx + 1])
      }
    }
  }

  const handleNextSupplierDate = () => {
    if (supplierUniqueDates.length === 0 || selectedSupplierDate === "ALL") return
    const currentIdx = supplierUniqueDates.indexOf(selectedSupplierDate)
    if (currentIdx > 0) {
      setSelectedSupplierDate(supplierUniqueDates[currentIdx - 1])
    } else if (currentIdx === 0) {
      setSelectedSupplierDate("ALL")
    }
  }

  // ── EXPORT ENGINE (PDF, EXCEL / CSV, GOOGLE SHEETS) ──
  const exportToCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = [
      headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(","),
      ...rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")),
    ].join("\r\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `${filename}.csv`)
    document.body.appendChild(link)
    link.click()

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link)
      }
      URL.revokeObjectURL(url)
    }, 2000)

    toast({ title: "Excel / CSV Exported ✓", description: `Downloaded ${filename}.csv` })
  }

  const exportToGoogleSheets = (filename: string, headers: string[], rows: (string | number)[][]) => {
    exportToCSV(filename, headers, rows)

    try {
      const tsvContent = [
        headers.join("\t"),
        ...rows.map(r => r.map(c => String(c ?? "").replace(/\t/g, " ").replace(/\r?\n/g, " ")).join("\t")),
      ].join("\r\n")

      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(tsvContent).then(() => {
          setShowSheetsGuide(true)
          toast({
            title: "Data Copied for Google Sheets ✓",
            description: "Table copied to clipboard! Press Ctrl + V in cell A1.",
          })
        }).catch(() => {
          setShowSheetsGuide(true)
        })
      } else {
        setShowSheetsGuide(true)
      }
    } catch {
      setShowSheetsGuide(true)
    }
  }

  const buildPdfBlob = (
    title: string,
    subtitle: string,
    headers: string[],
    rows: (string | number)[][],
    summary?: { label: string; value: string }[]
  ): Blob => {
    const pageWidth = 595.28
    const pageHeight = 841.89
    const margin = 36
    const contentWidth = pageWidth - margin * 2

    let stream = ""
    const esc = (txt: any) =>
      String(txt ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)")

    // Title
    stream += `BT /F2 16 Tf 0.05 0.1 0.2 rg ${margin} ${pageHeight - margin - 20} Td (${esc(title)}) Tj ET\n`
    // Subtitle
    stream += `BT /F1 9 Tf 0.4 0.45 0.5 rg ${margin} ${pageHeight - margin - 35} Td (${esc(subtitle)}) Tj ET\n`
    // Date
    const dateStr = `Exported: ${new Date().toLocaleDateString()}`
    stream += `BT /F1 8 Tf 0.5 0.5 0.5 rg ${pageWidth - margin - 110} ${pageHeight - margin - 20} Td (${esc(dateStr)}) Tj ET\n`

    // Accent Line
    const headerLineY = pageHeight - margin - 45
    stream += `0.95 0.4 0.1 RG 1.5 w ${margin} ${headerLineY} m ${pageWidth - margin} ${headerLineY} l S\n`

    const colCount = Math.max(1, headers.length)
    const colWidth = contentWidth / colCount

    let currentY = headerLineY - 18
    stream += `0.94 0.96 0.98 rg ${margin} ${currentY - 4} ${contentWidth} 18 re f\n`
    stream += `0.8 0.85 0.9 RG 0.5 w ${margin} ${currentY - 4} ${contentWidth} 18 re s\n`

    headers.forEach((h, idx) => {
      const x = margin + idx * colWidth + 5
      stream += `BT /F2 8.5 Tf 0.1 0.15 0.2 rg ${x} ${currentY + 1} Td (${esc(h)}) Tj ET\n`
    })

    currentY -= 18

    rows.forEach((row, rowIdx) => {
      if (currentY < margin + 40) return
      if (rowIdx % 2 === 1) {
        stream += `0.98 0.98 0.99 rg ${margin} ${currentY - 4} ${contentWidth} 16 re f\n`
      }
      stream += `0.9 0.92 0.94 RG 0.5 w ${margin} ${currentY - 4} ${contentWidth} 16 re s\n`

      row.forEach((cell, idx) => {
        const x = margin + idx * colWidth + 5
        const cellText = String(cell ?? "").replace(/₹/g, "Rs. ")
        stream += `BT /F1 8 Tf 0.2 0.2 0.2 rg ${x} ${currentY} Td (${esc(cellText)}) Tj ET\n`
      })

      currentY -= 16
    })

    if (summary && summary.length > 0) {
      currentY -= 12
      stream += `0.95 0.4 0.1 RG 1 w ${margin} ${currentY + 10} m ${pageWidth - margin} ${currentY + 10} l S\n`
      summary.forEach(s => {
        const sumText = `${s.label}: ${String(s.value).replace(/₹/g, "Rs. ")}`
        stream += `BT /F2 9 Tf 0.1 0.15 0.2 rg ${margin + 10} ${currentY} Td (${esc(sumText)}) Tj ET\n`
        currentY -= 14
      })
    }

    stream += `BT /F1 8 Tf 0.6 0.6 0.6 rg ${margin} 25 Td (${esc(companyName)} — Credit & Ledger Management) Tj ET\n`

    const objects: string[] = []
    objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`)
    objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`)
    objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n`)

    const enc = new TextEncoder()
    const streamBytes = enc.encode(stream)
    objects.push(`4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream\nendobj\n`)
    objects.push(`5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`)
    objects.push(`6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`)

    const header = "%PDF-1.4\n"
    let body = ""
    const xref: string[] = ["xref\n0 7\n0000000000 65535 f \n"]
    let currentOffset = enc.encode(header).length

    for (let i = 0; i < objects.length; i++) {
      const offsetStr = String(currentOffset).padStart(10, "0")
      xref.push(`${offsetStr} 00000 n \n`)
      body += objects[i]
      currentOffset += enc.encode(objects[i]).length
    }

    const startxref = currentOffset
    const trailer = `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`
    const fullPdfStr = header + body + xref.join("") + trailer
    return new Blob([enc.encode(fullPdfStr)], { type: "application/pdf" })
  }

  const exportToPDF = async (
    title: string,
    subtitle: string,
    headers: string[],
    rows: (string | number)[][],
    summary?: { label: string; value: string }[],
    filename?: string
  ) => {
    const safeFilename = filename || `Credit_Export_${new Date().toISOString().split("T")[0]}`
    try {
      if (!(window as any).jspdf) {
        await new Promise((resolve, reject) => {
          const s1 = document.createElement("script")
          s1.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
          s1.onload = () => {
            const s2 = document.createElement("script")
            s2.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"
            s2.onload = resolve
            s2.onerror = reject
            document.head.appendChild(s2)
          }
          s1.onerror = reject
          document.head.appendChild(s1)
        })
      }

      if ((window as any).jspdf?.jsPDF) {
        const { jsPDF } = (window as any).jspdf
        const doc = new jsPDF()

        doc.setFontSize(16)
        doc.setTextColor(30, 41, 59)
        doc.text(title, 14, 18)

        doc.setFontSize(9)
        doc.setTextColor(100, 116, 139)
        doc.text(subtitle, 14, 25)
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 140, 18)

        doc.setDrawColor(249, 115, 22)
        doc.setLineWidth(0.8)
        doc.line(14, 28, 196, 28)

        const tableBody = rows.map(r => r.map(c => String(c ?? "")))

        ;(doc as any).autoTable({
          head: [headers],
          body: tableBody,
          startY: 32,
          theme: "striped",
          headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: "bold" },
          styles: { fontSize: 8, cellPadding: 2.5 },
          margin: { left: 14, right: 14 },
        })

        if (summary && summary.length > 0) {
          const finalY = (doc as any).lastAutoTable?.finalY || 100
          doc.setFontSize(9)
          doc.setTextColor(15, 23, 42)
          let currentY = finalY + 10
          summary.forEach(s => {
            doc.text(`${s.label}: ${s.value}`, 14, currentY)
            currentY += 6
          })
        }

        doc.save(`${safeFilename}.pdf`)
        toast({ title: "PDF Exported ✓", description: `Saved ${safeFilename}.pdf` })
        return
      }
    } catch (e) {
      console.warn("jsPDF CDN unavailable, falling back to vector PDF:", e)
    }

    const fallbackBlob = buildPdfBlob(title, subtitle, headers, rows, summary)
    const url = URL.createObjectURL(fallbackBlob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `${safeFilename}.pdf`)
    document.body.appendChild(link)
    link.click()

    setTimeout(() => {
      if (document.body.contains(link)) document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }, 2000)

    toast({ title: "PDF Exported ✓", description: `Saved ${safeFilename}.pdf` })
  }

  // Export Trigger for Customer Ledger
  const handleExportCustomerLedger = () => {
    if (!selectedCustomerForBills) return
    const cust = selectedCustomerForBills
    const safeComp = companyName.replace(/[^a-zA-Z0-9_-]/g, "_")
    const safeCust = cust.name.replace(/[^a-zA-Z0-9_-]/g, "_")
    const filename = `${safeComp}_Customer_${safeCust}_Ledger_${selectedCustomerDate}`

    const headers = ["#", "Product Name", "Bill #", "Date", "Qty", "Price", "Total", "Status"]
    const rows = displayedCustomerItems.map((it, idx) => [
      idx + 1,
      it.productName,
      `#${it.billNumber}`,
      it.date,
      it.quantity,
      `Rs. ${it.price}`,
      `Rs. ${it.total}`,
      it.status === "paid" ? "Settled" : "Credit Due",
    ])

    const summary = [
      { label: "Filtered View", value: selectedCustomerDate === "ALL" ? "All Dates" : selectedCustomerDate },
      { label: "Total Quantity", value: `${customerTotalQty} units` },
      { label: "Total Billed in View", value: formatCurrency(customerTotalAmount) },
      { label: "Current Balance Due", value: formatCurrency(cust.outstandingBalance) },
    ]

    setExportData({
      title: `${cust.name} — Customer Credit & Sales Ledger`,
      subtitle: `${companyName} • Phone: ${cust.phone || "N/A"} • Outstanding Balance: ${formatCurrency(cust.outstandingBalance)}`,
      filename,
      headers,
      rows,
      summary,
    })
    setIsExportOpen(true)
  }

  // Export Trigger for Supplier Ledger
  const handleExportSupplierLedger = () => {
    if (!selectedSupplierForBills) return
    const sup = selectedSupplierForBills.supplier
    const safeComp = companyName.replace(/[^a-zA-Z0-9_-]/g, "_")
    const safeSup = sup.name.replace(/[^a-zA-Z0-9_-]/g, "_")
    const filename = `${safeComp}_Supplier_${safeSup}_Ledger_${selectedSupplierDate}`

    const headers = ["#", "Product Name", "Item Code", "Date", "Qty", "Cost", "Total"]
    const rows = displayedSupplierPurchases.map((p, idx) => {
      const qty = Number(p.quantity) || 1
      const cost = Number(p.purchasePrice) || 0
      return [
        idx + 1,
        p.productName,
        p.itemCode || "—",
        p.billingDate || (p.createdAt ? p.createdAt.split("T")[0] : "—"),
        qty,
        `Rs. ${cost}`,
        `Rs. ${qty * cost}`,
      ]
    })

    const summary = [
      { label: "Filtered View", value: selectedSupplierDate === "ALL" ? "All Dates" : selectedSupplierDate },
      { label: "Total Quantity", value: `${supplierTotalQty} units` },
      { label: "Total Spent in View", value: formatCurrency(supplierTotalSpend) },
      { label: "Outstanding Credit Payable", value: formatCurrency(selectedSupplierForBills.outstandingCredit) },
    ]

    setExportData({
      title: `${sup.name} — Supplier Purchases & Credit Ledger`,
      subtitle: `${companyName} • Contact: ${sup.contactPerson || "N/A"} • Phone: ${sup.phone || "N/A"}`,
      filename,
      headers,
      rows,
      summary,
    })
    setIsExportOpen(true)
  }

  // ── RECORD CUSTOMER PAYMENT (COLLECT DUE) ──
  const handleRecordCustomerPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCustomer || !user?.uid) return

    const amount = parseFloat(customerPaymentAmount)
    if (isNaN(amount) || amount <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid payment amount.",
      })
      return
    }

    if (amount > selectedCustomer.outstandingBalance) {
      toast({
        variant: "destructive",
        title: "Excess Payment",
        description: `Payment cannot exceed outstanding balance of ${formatCurrency(selectedCustomer.outstandingBalance)}.`,
      })
      return
    }

    setSubmittingCustomerPayment(true)
    try {
      const newBalance = Math.max(0, selectedCustomer.outstandingBalance - amount)
      const res = await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.uid,
        },
        body: JSON.stringify({ outstandingBalance: newBalance }),
      })

      if (!res.ok) throw new Error("Failed to record customer payment")

      // Also record in Cashbook as Income
      await fetch("/api/cashbook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.uid },
        body: JSON.stringify({
          type: "income",
          category: "Customer Credit Collection",
          description: `Credit payment from ${selectedCustomer.name}`,
          amount: amount,
          paymentMode: customerPaymentMode,
          note: customerPaymentNote || `Collected credit due balance`,
        }),
      }).catch(console.error)

      toast({
        title: "Payment Collected ✓",
        description: `Collected ${formatCurrency(amount)} from ${selectedCustomer.name} (${customerPaymentMode}).`,
      })

      setCustomers(prev =>
        prev.map(c => (c.id === selectedCustomer.id ? { ...c, outstandingBalance: newBalance } : c))
      )

      if (newBalance === 0) {
        const pendingSales = creditSales.filter(s => s.customerId === selectedCustomer.id && s.status === "pending")
        for (const sale of pendingSales) {
          await fetch(`/api/sales/${sale.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-user-id": user.uid },
            body: JSON.stringify({ status: "paid" }),
          }).catch(console.error)
        }
      }

      fetchData()
      setSelectedCustomer(null)
      setCustomerPaymentAmount("")
      setCustomerPaymentNote("")

      if (selectedCustomerForBills && selectedCustomerForBills.id === selectedCustomer.id) {
        setSelectedCustomerForBills({ ...selectedCustomerForBills, outstandingBalance: newBalance })
      }
    } catch (err) {
      console.error(err)
      toast({
        variant: "destructive",
        title: "Error Recording Payment",
        description: "Failed to record customer payment.",
      })
    } finally {
      setSubmittingCustomerPayment(false)
    }
  }

  // ── RECORD SUPPLIER PAYMENT ──
  const handleRecordSupplierPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSupplierForPay || !user?.uid) return

    const amount = parseFloat(supplierPayAmount)
    if (isNaN(amount) || amount <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid payment amount.",
      })
      return
    }

    setSubmittingSupplierPay(true)
    try {
      const res = await fetch("/api/supplier-payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.uid,
        },
        body: JSON.stringify({
          supplierId: selectedSupplierForPay.supplier.id,
          amount: amount,
          paymentMode: supplierPayMode,
          note: supplierPayNote || `Payment to ${selectedSupplierForPay.supplier.name}`,
        }),
      })

      if (!res.ok) throw new Error("Failed to record supplier payment")
      const newPay = await res.json()

      // Also record in cashbook expenses
      await fetch("/api/cashbook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.uid },
        body: JSON.stringify({
          type: "expense",
          category: "Supplier Payment",
          description: `Supplier Payment: ${selectedSupplierForPay.supplier.name}`,
          amount: amount,
          paymentMode: supplierPayMode,
          note: supplierPayNote || `Payment toward outstanding credit`,
        }),
      }).catch(console.error)

      toast({
        title: "Payment Recorded ✓",
        description: `Paid ${formatCurrency(amount)} to ${selectedSupplierForPay.supplier.name} (${supplierPayMode}).`,
      })

      setSupplierPayments(prev => [newPay, ...prev])
      fetchData()
      setSelectedSupplierForPay(null)
      setSupplierPayAmount("")
      setSupplierPayNote("")
    } catch (err) {
      console.error(err)
      toast({
        variant: "destructive",
        title: "Error Recording Payment",
        description: "Failed to log supplier payment.",
      })
    } finally {
      setSubmittingSupplierPay(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm font-medium">Loading credit tracking ledgers...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* ────────────────────────────────────────────────────────── */}
      {/* PAGE HEADER & TAB NAVIGATION */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/50">
        <div>
          <h1 className="text-2xl sm:text-3xl font-headline font-bold text-foreground flex items-center gap-2">
            <span>Credit</span>
            <span className="text-primary">Ledger &amp; Tracking</span>
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            Manage customer credit collections (receivables) and vendor supplier payables with full invoice ledgers.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="inline-flex rounded-xl bg-secondary/60 p-1 text-xs font-semibold self-start sm:self-auto border border-border/40">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
              activeTab === "overview" ? "bg-card shadow-sm text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("customers")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
              activeTab === "customers" ? "bg-card shadow-sm text-orange-500 font-bold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <User className="w-3.5 h-3.5" />
            <span>Customers ({creditCustomersWithBalance.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("suppliers")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
              activeTab === "suppliers" ? "bg-card shadow-sm text-rose-500 font-bold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Suppliers ({creditSuppliersWithBalance.length})</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* SUMMARY KPI METRIC CARDS */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Customer Receivables */}
        <Card className="border-none bg-card shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Customer Receivables</p>
              <h3 className="text-2xl font-bold font-headline text-orange-500 mt-1">
                {formatCurrency(totalCustomerCreditOutstanding)}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {creditCustomersWithBalance.length} customer(s) with dues
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
              <ArrowDownLeft className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Supplier Payables */}
        <Card className="border-none bg-card shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Supplier Payables</p>
              <h3 className="text-2xl font-bold font-headline text-rose-500 mt-1">
                {formatCurrency(totalSupplierCreditOutstanding)}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {creditSuppliersWithBalance.length} supplier(s) to pay
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Net Position */}
        <Card className="border-none bg-card shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Net Credit Balance</p>
              <h3
                className={cn(
                  "text-2xl font-bold font-headline mt-1",
                  netCreditBalance >= 0 ? "text-emerald-500" : "text-amber-500"
                )}
              >
                {formatCurrency(netCreditBalance)}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {netCreditBalance >= 0 ? "Net Positive (Receivable > Payable)" : "Net Negative (Payable > Receivable)"}
              </p>
            </div>
            <div
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                netCreditBalance >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
              )}
            >
              <IndianRupee className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Total Credit Transactions */}
        <Card className="border-none bg-card shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Credit Invoices</p>
              <h3 className="text-2xl font-bold font-headline text-foreground mt-1">
                {creditSales.length}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {purchases.length} inward purchases logged
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-secondary text-primary flex items-center justify-center shrink-0">
              <Receipt className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* SECTION 1: CUSTOMERS CREDIT LEDGER TABLE (MATCHING SUPPLIER TABLE) */}
      {/* ────────────────────────────────────────────────────────── */}
      {(activeTab === "overview" || activeTab === "customers") && (
        <Card className="border-none bg-card shadow-sm">
          <CardHeader className="pb-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-orange-500" />
                <CardTitle className="font-headline text-lg sm:text-xl">Customer Credit Ledger (Receivables)</CardTitle>
                <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-500 border-orange-500/30 font-bold">
                  {formatCurrency(totalCustomerCreditOutstanding)} Due
                </Badge>
              </div>
              <CardDescription>
                Customer accounts with sales bills. Click &quot;View Bills&quot; to inspect invoice breakdown or &quot;Collect Due&quot; to log payment.
              </CardDescription>
            </div>

            {/* Filter Toggle + Search (Matching Supplier Table) */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="inline-flex rounded-lg bg-secondary/40 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCustomerFilterMode("due")}
                  className={cn(
                    "px-3 py-1 rounded-md transition-all",
                    customerFilterMode === "due"
                      ? "bg-card shadow-sm text-orange-500 font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Due Only ({creditCustomersWithBalance.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerFilterMode("all")}
                  className={cn(
                    "px-3 py-1 rounded-md transition-all",
                    customerFilterMode === "all"
                      ? "bg-card shadow-sm text-foreground font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All ({customerCredits.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerFilterMode("cleared")}
                  className={cn(
                    "px-3 py-1 rounded-md transition-all",
                    customerFilterMode === "cleared"
                      ? "bg-card shadow-sm text-emerald-500 font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Cleared ({customerCredits.filter(c => c.outstandingCredit === 0).length})
                </button>
              </div>

              <div className="relative flex-1 md:w-60 md:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search customer, phone..."
                  value={customerSearchQuery}
                  onChange={e => setCustomerSearchQuery(e.target.value)}
                  className="pl-8 bg-secondary/30 border-none rounded-xl text-xs h-9"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filteredCustomerCredits.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs space-y-1">
                <User className="w-8 h-8 mx-auto opacity-30 mb-2" />
                <p className="font-semibold">No customers found matching your filter.</p>
                <p className="text-[11px] opacity-75">All customer ledgers may be fully settled.</p>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <Table className="min-w-[720px] w-full">
                  <TableHeader className="bg-secondary/15">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="font-bold uppercase text-[10px] w-12">#</TableHead>
                      <TableHead className="font-bold uppercase text-[10px]">Customer Name</TableHead>
                      <TableHead className="font-bold uppercase text-[10px]">Phone Number</TableHead>
                      <TableHead className="font-bold uppercase text-[10px]">Total Purchases (Billed)</TableHead>
                      <TableHead className="font-bold uppercase text-[10px]">Amount Paid</TableHead>
                      <TableHead className="font-bold uppercase text-[10px]">Credit Due (Receivable)</TableHead>
                      <TableHead className="font-bold uppercase text-[10px]">Status</TableHead>
                      <TableHead className="text-right font-bold uppercase text-[10px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomerCredits.map((item, idx) => {
                      const isDue = item.outstandingCredit > 0
                      return (
                        <TableRow key={item.customer.id} className="border-border/30 hover:bg-secondary/5">
                          <TableCell className="text-xs text-muted-foreground font-mono">{idx + 1}</TableCell>
                          <TableCell className="font-medium text-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold text-xs shrink-0">
                                {item.customer.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold truncate text-foreground">{item.customer.name}</p>
                                {item.customer.email && (
                                  <p className="text-[11px] text-muted-foreground truncate">{item.customer.email}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.customer.phone || "—"}</TableCell>
                          <TableCell className="text-xs font-semibold">
                            {formatCurrency(item.totalBilled)}
                            <span className="block text-[10px] font-normal text-muted-foreground">
                              {item.invoicesCount} bills
                            </span>
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(item.totalPaid)}
                          </TableCell>
                          <TableCell className="font-bold text-sm">
                            <span className={cn(isDue ? "text-orange-500" : "text-emerald-500")}>
                              {formatCurrency(item.outstandingCredit)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {isDue ? (
                              <Badge variant="outline" className="border-orange-500/30 text-orange-500 bg-orange-500/5 text-[9px] font-bold uppercase">
                                Balance Due
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/5 text-[9px] font-bold uppercase">
                                Settled
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end items-center gap-1.5">
                              {/* View Bills Button */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedCustomerForBills(item.customer)
                                  setSelectedCustomerDate("ALL")
                                  setCustomerLedgerTab("products")
                                }}
                                className="rounded-full text-xs h-8 px-2.5 gap-1 border-border/60 hover:bg-secondary/60 text-foreground"
                                title="View customer purchase ledger and bills"
                              >
                                <FileText className="w-3.5 h-3.5 text-orange-500" />
                                <span>View Bills</span>
                              </Button>

                              {/* Collect Payment Button */}
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedCustomer(item.customer)
                                  setCustomerPaymentAmount(item.outstandingCredit > 0 ? String(item.outstandingCredit) : "")
                                  setCustomerPaymentMode("Cash")
                                  setCustomerPaymentNote("")
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs h-8 px-3 font-semibold shadow-sm gap-1"
                                title="Collect payment from customer"
                              >
                                <ArrowDownLeft className="w-3.5 h-3.5" />
                                <span>Collect Due</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* SECTION 2: SUPPLIERS CREDIT LEDGER TABLE */}
      {/* ────────────────────────────────────────────────────────── */}
      {(activeTab === "overview" || activeTab === "suppliers") && (
        <Card className="border-none bg-card shadow-sm">
          <CardHeader className="pb-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-rose-500" />
                <CardTitle className="font-headline text-lg sm:text-xl">Supplier Credits Ledger (Payables)</CardTitle>
                <Badge variant="outline" className="text-xs bg-rose-500/10 text-rose-500 border-rose-500/30 font-bold">
                  {formatCurrency(totalSupplierCreditOutstanding)} Due
                </Badge>
              </div>
              <CardDescription>
                Outstanding balances owed to vendors for inward purchase stock. Click &quot;View Inwards&quot; to inspect purchase records or &quot;Pay Supplier&quot; to record payments.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="inline-flex rounded-lg bg-secondary/40 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setSupplierFilterMode("due")}
                  className={cn(
                    "px-3 py-1 rounded-md transition-all",
                    supplierFilterMode === "due"
                      ? "bg-card shadow-sm text-rose-500 font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Due Only ({creditSuppliersWithBalance.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSupplierFilterMode("all")}
                  className={cn(
                    "px-3 py-1 rounded-md transition-all",
                    supplierFilterMode === "all"
                      ? "bg-card shadow-sm text-foreground font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All ({supplierCredits.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSupplierFilterMode("cleared")}
                  className={cn(
                    "px-3 py-1 rounded-md transition-all",
                    supplierFilterMode === "cleared"
                      ? "bg-card shadow-sm text-emerald-500 font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Cleared ({supplierCredits.filter(s => s.outstandingCredit === 0).length})
                </button>
              </div>

              <div className="relative flex-1 md:w-60 md:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search supplier, phone..."
                  value={supplierSearchQuery}
                  onChange={e => setSupplierSearchQuery(e.target.value)}
                  className="pl-8 bg-secondary/30 border-none rounded-xl text-xs h-9"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filteredSupplierCredits.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs space-y-1">
                <Truck className="w-8 h-8 mx-auto opacity-30 mb-2" />
                <p className="font-semibold">No suppliers found matching your filter.</p>
                <p className="text-[11px] opacity-75">All supplier accounts may be fully cleared.</p>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <Table className="min-w-[720px] w-full">
                  <TableHeader className="bg-secondary/15">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="font-bold uppercase text-[10px] w-12">#</TableHead>
                      <TableHead className="font-bold uppercase text-[10px]">Supplier Name</TableHead>
                      <TableHead className="font-bold uppercase text-[10px]">Phone / Contact</TableHead>
                      <TableHead className="font-bold uppercase text-[10px]">Total Purchases</TableHead>
                      <TableHead className="font-bold uppercase text-[10px]">Amount Paid</TableHead>
                      <TableHead className="font-bold uppercase text-[10px]">Credit Due (Payable)</TableHead>
                      <TableHead className="font-bold uppercase text-[10px]">Status</TableHead>
                      <TableHead className="text-right font-bold uppercase text-[10px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSupplierCredits.map((item, idx) => {
                      const isDue = item.outstandingCredit > 0
                      return (
                        <TableRow key={item.supplier.id} className="border-border/30 hover:bg-secondary/5">
                          <TableCell className="text-xs text-muted-foreground font-mono">{idx + 1}</TableCell>
                          <TableCell className="font-medium text-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold text-xs shrink-0">
                                {item.supplier.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold truncate text-foreground">{item.supplier.name}</p>
                                {item.supplier.contactPerson && (
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    Contact: {item.supplier.contactPerson}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {item.supplier.phone || "—"}
                          </TableCell>
                          <TableCell className="text-xs font-semibold">
                            {formatCurrency(item.totalPurchased)}
                            <span className="block text-[10px] font-normal text-muted-foreground">
                              {item.purchasesCount} bills
                            </span>
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(item.totalPaid)}
                          </TableCell>
                          <TableCell className="font-bold text-sm">
                            <span className={cn(isDue ? "text-rose-500" : "text-emerald-500")}>
                              {formatCurrency(item.outstandingCredit)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {isDue ? (
                              <Badge variant="outline" className="border-rose-500/30 text-rose-500 bg-rose-500/5 text-[9px] font-bold uppercase">
                                Balance Due
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/5 text-[9px] font-bold uppercase">
                                Settled
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end items-center gap-1.5">
                              {/* View Inwards Button */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedSupplierForBills(item)
                                  setSelectedSupplierDate("ALL")
                                  setSupplierLedgerTab("inwards")
                                }}
                                className="rounded-full text-xs h-8 px-2.5 gap-1 border-border/60 hover:bg-secondary/60 text-foreground"
                                title="View inward purchase records and payments"
                              >
                                <FileText className="w-3.5 h-3.5 text-rose-500" />
                                <span>View Inwards</span>
                              </Button>

                              {/* Pay Supplier Button */}
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedSupplierForPay(item)
                                  setSupplierPayAmount(item.outstandingCredit > 0 ? String(item.outstandingCredit) : "")
                                  setSupplierPayMode("Cash")
                                  setSupplierPayNote("")
                                }}
                                className="bg-rose-600 hover:bg-rose-700 text-white rounded-full text-xs h-8 px-3 font-semibold shadow-sm gap-1"
                                title="Record payment to supplier"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Pay Supplier</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}



      {/* ────────────────────────────────────────────────────────── */}
      {/* DIALOG: CUSTOMER CREDIT & BILLS LEDGER (MATCHING PURCHASE SUPPLIERS LEDGER TABLE) */}
      {/* ────────────────────────────────────────────────────────── */}
      <Dialog
        open={!!selectedCustomerForBills}
        onOpenChange={open => {
          if (!open) {
            setSelectedCustomerForBills(null)
            setSelectedCustomerDate("ALL")
          }
        }}
      >
        <DialogContent className="max-w-4xl w-[96vw] max-h-[92vh] flex flex-col p-4 sm:p-6 rounded-2xl bg-card border-none">
          {selectedCustomerForBills && (() => {
            const isDue = selectedCustomerForBills.outstandingBalance > 0

            return (
              <>
                <DialogHeader className="shrink-0 pb-3 border-b border-border/40">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-500/15 text-orange-500 flex items-center justify-center font-bold text-base shrink-0">
                        {selectedCustomerForBills.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <DialogTitle className="text-lg sm:text-xl font-headline font-bold flex items-center gap-2">
                          <span>{selectedCustomerForBills.name}</span>
                          {isDue ? (
                            <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] uppercase font-bold">
                              Credit Due: {formatCurrency(selectedCustomerForBills.outstandingBalance)}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/5 text-[10px] font-bold">
                              All Cleared
                            </Badge>
                          )}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-3">
                          <span>📞 {selectedCustomerForBills.phone || "No phone"}</span>
                          {selectedCustomerForBills.email && <span>✉️ {selectedCustomerForBills.email}</span>}
                          <span>📅 Since {formatDate(selectedCustomerForBills.createdAt)}</span>
                        </DialogDescription>
                      </div>
                    </div>

                    {/* Top Action Buttons: Export & Collect Due */}
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleExportCustomerLedger}
                        className="h-8 text-xs font-bold gap-1.5 rounded-xl border-orange-500/40 text-orange-500 hover:bg-orange-500/10"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export</span>
                      </Button>

                      {isDue && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedCustomer(selectedCustomerForBills)
                            setCustomerPaymentAmount(String(selectedCustomerForBills.outstandingBalance))
                            setCustomerPaymentMode("Cash")
                            setCustomerPaymentNote("")
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-8 px-3.5 font-bold shadow-sm shrink-0 gap-1.5"
                        >
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                          <span>Collect Due</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* ── DATE NAVIGATION STEPPER & VIEW SELECTOR (LIKE SUPPLIERS LEDGER) ── */}
                  <div className="bg-secondary/20 border border-border/50 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-3 mt-3">
                    {/* Stepper < Billing Date > */}
                    <div className="flex items-center bg-secondary/50 border border-border/50 rounded-lg p-0.5 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-md hover:bg-secondary text-foreground hover:text-orange-500"
                        onClick={handlePrevCustomerDate}
                        disabled={customerUniqueDates.length === 0}
                        title="Previous Billing Date"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <div className="px-2 text-center min-w-[120px]">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block leading-tight">
                          {selectedCustomerDate === "ALL" ? "All Dates" : "Billing Date"}
                        </span>
                        <span className="text-xs font-bold font-mono text-orange-500">
                          {selectedCustomerDate === "ALL" ? "View All Dates" : selectedCustomerDate}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-md hover:bg-secondary text-foreground hover:text-orange-500"
                        onClick={handleNextCustomerDate}
                        disabled={customerUniqueDates.length === 0 || selectedCustomerDate === "ALL"}
                        title="Next Billing Date"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* All Sales History Button & View Mode Selector */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={selectedCustomerDate === "ALL" ? "default" : "outline"}
                        className="h-8 text-xs font-bold rounded-lg px-3 transition-all"
                        onClick={() => setSelectedCustomerDate("ALL")}
                      >
                        All Sales History ({activeCustomerItems.length})
                      </Button>
                      {selectedCustomerDate !== "ALL" && (
                        <Badge variant="outline" className="text-[10px] font-mono h-7 px-2 border-orange-500/40 text-orange-500">
                          {displayedCustomerItems.length} product(s) on {selectedCustomerDate}
                        </Badge>
                      )}

                      {/* Ledger Tabs */}
                      <div className="inline-flex rounded-lg bg-secondary/40 p-0.5 text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setCustomerLedgerTab("products")}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[11px] transition-all flex items-center gap-1",
                            customerLedgerTab === "products"
                              ? "bg-card shadow-sm text-foreground font-bold"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Package className="w-3 h-3" />
                          <span>Itemized Products</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomerLedgerTab("invoices")}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[11px] transition-all flex items-center gap-1",
                            customerLedgerTab === "invoices"
                              ? "bg-card shadow-sm text-foreground font-bold"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <FileText className="w-3 h-3" />
                          <span>Invoices ({displayedCustomerSales.length})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomerLedgerTab("payments")}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[11px] transition-all flex items-center gap-1",
                            customerLedgerTab === "payments"
                              ? "bg-card shadow-sm text-foreground font-bold"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <History className="w-3 h-3" />
                          <span>Collections ({activeCustomerPayments.length})</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Summary Metric Strip (Matching Supplier History Sheet) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
                    <div className="bg-secondary/20 p-2.5 rounded-xl border border-border/40">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Filtered View</p>
                      <p className="text-sm font-bold text-foreground truncate mt-0.5">
                        {selectedCustomerDate === "ALL" ? "All Dates" : selectedCustomerDate}
                      </p>
                    </div>
                    <div className="bg-secondary/20 p-2.5 rounded-xl border border-border/40">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Quantity</p>
                      <p className="text-sm font-bold font-mono text-foreground mt-0.5">
                        {customerTotalQty} units
                      </p>
                    </div>
                    <div className="bg-orange-500/10 p-2.5 rounded-xl border border-orange-500/25">
                      <p className="text-[10px] uppercase font-bold text-orange-500 tracking-wider">Total Billed in View</p>
                      <p className="text-sm font-bold font-mono text-orange-500 mt-0.5">
                        {formatCurrency(customerTotalAmount)}
                      </p>
                    </div>
                    <div className="bg-secondary/20 p-2.5 rounded-xl border border-border/40">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Current Balance Due</p>
                      <p className="text-sm font-bold font-mono text-foreground mt-0.5">
                        {formatCurrency(selectedCustomerForBills.outstandingBalance)}
                      </p>
                    </div>
                  </div>
                </DialogHeader>

                {/* ── TAB 1: ITEMIZED PRODUCTS LEDGER TABLE (EXACT MATCH TO PURCHASE SUPPLIERS TABLE) ── */}
                {customerLedgerTab === "products" && (
                  <div className="overflow-y-auto overflow-x-auto flex-1 min-h-[220px] mt-2 rounded-xl border border-border/40">
                    {displayedCustomerItems.length === 0 ? (
                      <div className="text-center py-14 text-muted-foreground text-xs space-y-1">
                        <Package className="w-8 h-8 mx-auto opacity-30 mb-2" />
                        <p className="font-semibold">No sales product records found for this date.</p>
                        <p className="text-[11px] opacity-75">Click &quot;All Sales History&quot; to view all records.</p>
                      </div>
                    ) : (
                      <Table className="min-w-[650px] w-full">
                        <TableHeader className="bg-secondary/25 sticky top-0 z-10 backdrop-blur-sm">
                          <TableRow className="border-border/50 hover:bg-transparent">
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 pl-4">Product Name</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3">Bill Number</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3">Billing Date</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-center">Qty</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-right">Price (₹)</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-right">Total (₹)</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-right pr-4">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayedCustomerItems.map((it, idx) => (
                            <TableRow key={it.id || idx} className="border-border/40 hover:bg-secondary/15 transition-colors">
                              <TableCell className="pl-4 py-3 font-medium text-xs text-foreground">
                                {it.productName}
                              </TableCell>
                              <TableCell className="py-3 font-mono text-xs font-bold text-muted-foreground">
                                #{it.billNumber}
                              </TableCell>
                              <TableCell className="py-3 text-xs text-muted-foreground font-mono">
                                {it.date}
                              </TableCell>
                              <TableCell className="py-3 text-center font-bold font-mono text-xs">
                                {it.quantity}
                              </TableCell>
                              <TableCell className="py-3 text-right font-mono text-xs text-amber-500 font-bold">
                                ₹{it.price.toLocaleString()}
                              </TableCell>
                              <TableCell className="py-3 text-right font-bold font-mono text-xs text-emerald-500">
                                ₹{it.total.toLocaleString()}
                              </TableCell>
                              <TableCell className="py-3 text-right pr-4">
                                <Badge
                                  variant={it.status === "paid" ? "outline" : "secondary"}
                                  className={
                                    it.status === "paid"
                                      ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5 text-[9px] font-bold uppercase"
                                      : "border-amber-500/30 text-amber-500 bg-amber-500/5 text-[9px] font-bold uppercase"
                                  }
                                >
                                  {it.status === "paid" ? "Settled" : "Credit Due"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}

                {/* ── TAB 2: INVOICES SUMMARY TABLE ── */}
                {customerLedgerTab === "invoices" && (
                  <div className="overflow-y-auto overflow-x-auto flex-1 min-h-[220px] mt-2 rounded-xl border border-border/40">
                    {displayedCustomerSales.length === 0 ? (
                      <div className="text-center py-14 text-muted-foreground text-xs space-y-1">
                        <FileText className="w-8 h-8 mx-auto opacity-30 mb-2" />
                        <p className="font-semibold">No sales bills found for this selection.</p>
                      </div>
                    ) : (
                      <Table className="min-w-[650px] w-full">
                        <TableHeader className="bg-secondary/25 sticky top-0 z-10 backdrop-blur-sm">
                          <TableRow className="border-none hover:bg-transparent">
                            <TableHead className="font-bold uppercase text-[10px] w-12 pl-4">#</TableHead>
                            <TableHead className="font-bold uppercase text-[10px]">Bill Number</TableHead>
                            <TableHead className="font-bold uppercase text-[10px]">Date</TableHead>
                            <TableHead className="font-bold uppercase text-[10px]">Purchased Items</TableHead>
                            <TableHead className="font-bold uppercase text-[10px]">Payment Mode</TableHead>
                            <TableHead className="font-bold uppercase text-[10px]">Total Amount</TableHead>
                            <TableHead className="text-right font-bold uppercase text-[10px] pr-4">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayedCustomerSales.map((sale, sIdx) => (
                            <TableRow key={sale.id} className="border-border/30 hover:bg-secondary/5">
                              <TableCell className="pl-4 text-xs text-muted-foreground font-mono">{sIdx + 1}</TableCell>
                              <TableCell className="font-mono text-xs font-bold text-foreground">
                                #{sale.billNumber || sale.id.slice(-6).toUpperCase()}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{formatDate(sale.date)}</TableCell>
                              <TableCell className="text-xs">
                                <div className="space-y-0.5 max-w-xs">
                                  {sale.items && sale.items.length > 0 ? (
                                    sale.items.map((it, itIdx) => (
                                      <div key={itIdx} className="text-[11px] flex items-center justify-between gap-2">
                                        <span className="font-medium text-foreground truncate">{it.productName}</span>
                                        <span className="text-muted-foreground shrink-0 font-mono">
                                          {it.quantity} × ₹{it.price}
                                        </span>
                                      </div>
                                    ))
                                  ) : (
                                    <span className="text-muted-foreground italic text-[11px]">No item details</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] font-bold uppercase bg-secondary/30">
                                  {sale.paymentMethod}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-bold text-sm text-foreground">
                                {formatCurrency(sale.total)}
                              </TableCell>
                              <TableCell className="text-right pr-4">
                                <Badge
                                  variant={sale.status === "paid" ? "outline" : "secondary"}
                                  className={
                                    sale.status === "paid"
                                      ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5 text-[9px] font-bold uppercase"
                                      : "border-amber-500/30 text-amber-500 bg-amber-500/5 text-[9px] font-bold uppercase"
                                  }
                                >
                                  {sale.status === "paid" ? "Settled" : "Credit Due"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}

                {/* ── TAB 3: CUSTOMER COLLECTIONS LOG ── */}
                {customerLedgerTab === "payments" && (
                  <div className="overflow-y-auto overflow-x-auto flex-1 min-h-[220px] mt-2 rounded-xl border border-border/40">
                    {activeCustomerPayments.length === 0 ? (
                      <div className="text-center py-14 text-muted-foreground text-xs space-y-1">
                        <History className="w-8 h-8 mx-auto opacity-30 mb-2" />
                        <p className="font-semibold">No payment collection logs found for this customer.</p>
                        <p className="text-[11px] opacity-75">Click &quot;Collect Due&quot; above to log received payments.</p>
                      </div>
                    ) : (
                      <Table className="min-w-[550px] w-full">
                        <TableHeader className="bg-secondary/25 sticky top-0 z-10 backdrop-blur-sm">
                          <TableRow className="border-none hover:bg-transparent">
                            <TableHead className="font-bold uppercase text-[10px] w-12 pl-4">#</TableHead>
                            <TableHead className="font-bold uppercase text-[10px]">Date</TableHead>
                            <TableHead className="font-bold uppercase text-[10px]">Payment Mode</TableHead>
                            <TableHead className="font-bold uppercase text-[10px]">Description / Note</TableHead>
                            <TableHead className="text-right font-bold uppercase text-[10px] pr-4">Amount Collected</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeCustomerPayments.map((p, pIdx) => (
                            <TableRow key={p.id} className="border-border/30 hover:bg-secondary/5">
                              <TableCell className="pl-4 text-xs text-muted-foreground font-mono">{pIdx + 1}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] font-bold bg-secondary/30">
                                  {p.paymentMode}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {p.note || p.description}
                              </TableCell>
                              <TableCell className="text-right pr-4 font-bold text-sm text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(p.amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}

                <DialogFooter className="mt-3 shrink-0 flex flex-row items-center justify-between sm:justify-between w-full">
                  <span className="text-xs text-muted-foreground">
                    Showing {displayedCustomerItems.length} product entries across {displayedCustomerSales.length} invoice(s)
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setSelectedCustomerForBills(null)}>
                    Close
                  </Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* ────────────────────────────────────────────────────────── */}
      {/* DIALOG: VIEW SUPPLIER INWARD BILLS & DETAILS */}
      {/* ────────────────────────────────────────────────────────── */}
      <Dialog
        open={!!selectedSupplierForBills}
        onOpenChange={open => {
          if (!open) {
            setSelectedSupplierForBills(null)
            setSelectedSupplierDate("ALL")
          }
        }}
      >
        <DialogContent className="max-w-4xl w-[96vw] max-h-[92vh] flex flex-col p-4 sm:p-6 rounded-2xl bg-card border-none">
          {selectedSupplierForBills && (() => {
            const isDue = selectedSupplierForBills.outstandingCredit > 0

            return (
              <>
                <DialogHeader className="shrink-0 pb-3 border-b border-border/40">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center font-bold text-base shrink-0">
                        {selectedSupplierForBills.supplier.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <DialogTitle className="text-lg sm:text-xl font-headline font-bold flex items-center gap-2">
                          <span>{selectedSupplierForBills.supplier.name}</span>
                          {isDue ? (
                            <Badge className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] uppercase font-bold">
                              Payable Due: {formatCurrency(selectedSupplierForBills.outstandingCredit)}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/5 text-[10px] font-bold">
                              All Cleared
                            </Badge>
                          )}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-3">
                          <span>📞 {selectedSupplierForBills.supplier.phone || "No phone"}</span>
                          {selectedSupplierForBills.supplier.contactPerson && (
                            <span>👤 Contact: {selectedSupplierForBills.supplier.contactPerson}</span>
                          )}
                          {selectedSupplierForBills.supplier.gstNumber && (
                            <span>🏷️ GST: {selectedSupplierForBills.supplier.gstNumber}</span>
                          )}
                        </DialogDescription>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleExportSupplierLedger}
                        className="h-8 text-xs font-bold gap-1.5 rounded-xl border-rose-500/40 text-rose-500 hover:bg-rose-500/10"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export</span>
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedSupplierForPay(selectedSupplierForBills)
                          setSupplierPayAmount(selectedSupplierForBills.outstandingCredit > 0 ? String(selectedSupplierForBills.outstandingCredit) : "")
                          setSupplierPayMode("Cash")
                          setSupplierPayNote("")
                        }}
                        className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs h-8 px-3.5 font-bold shadow-sm shrink-0 gap-1.5"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Pay Supplier</span>
                      </Button>
                    </div>
                  </div>

                  {/* Date Stepper & Filter Navigation Bar */}
                  <div className="bg-secondary/20 border border-border/50 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-3 mt-3">
                    <div className="flex items-center bg-secondary/50 border border-border/50 rounded-lg p-0.5 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-md hover:bg-secondary text-foreground hover:text-rose-500"
                        onClick={handlePrevSupplierDate}
                        disabled={supplierUniqueDates.length === 0}
                        title="Previous Billing Date"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <div className="px-2 text-center min-w-[120px]">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block leading-tight">
                          {selectedSupplierDate === "ALL" ? "All Dates" : "Billing Date"}
                        </span>
                        <span className="text-xs font-bold font-mono text-rose-500">
                          {selectedSupplierDate === "ALL" ? "View All Dates" : selectedSupplierDate}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-md hover:bg-secondary text-foreground hover:text-rose-500"
                        onClick={handleNextSupplierDate}
                        disabled={supplierUniqueDates.length === 0 || selectedSupplierDate === "ALL"}
                        title="Next Billing Date"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={selectedSupplierDate === "ALL" ? "default" : "outline"}
                        className="h-8 text-xs font-bold rounded-lg px-3 transition-all"
                        onClick={() => setSelectedSupplierDate("ALL")}
                      >
                        All Inward Records ({activeSupplierPurchases.length})
                      </Button>
                      {selectedSupplierDate !== "ALL" && (
                        <Badge variant="outline" className="text-[10px] font-mono h-7 px-2 border-rose-500/40 text-rose-500">
                          {displayedSupplierPurchases.length} product(s) on {selectedSupplierDate}
                        </Badge>
                      )}

                      <div className="inline-flex rounded-lg bg-secondary/40 p-0.5 text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setSupplierLedgerTab("inwards")}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[11px] transition-all flex items-center gap-1",
                            supplierLedgerTab === "inwards"
                              ? "bg-card shadow-sm text-foreground font-bold"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Package className="w-3 h-3" />
                          <span>Inward Items</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSupplierLedgerTab("payments")}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[11px] transition-all flex items-center gap-1",
                            supplierLedgerTab === "payments"
                              ? "bg-card shadow-sm text-foreground font-bold"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <History className="w-3 h-3" />
                          <span>Payments ({activeSupplierPayments.length})</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Summary Metric Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
                    <div className="bg-secondary/20 p-2.5 rounded-xl border border-border/40">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Filtered View</p>
                      <p className="text-sm font-bold text-foreground truncate mt-0.5">
                        {selectedSupplierDate === "ALL" ? "All Dates" : selectedSupplierDate}
                      </p>
                    </div>
                    <div className="bg-secondary/20 p-2.5 rounded-xl border border-border/40">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Quantity</p>
                      <p className="text-sm font-bold font-mono text-foreground mt-0.5">
                        {supplierTotalQty} units
                      </p>
                    </div>
                    <div className="bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/25">
                      <p className="text-[10px] uppercase font-bold text-rose-500 tracking-wider">Total Spent in View</p>
                      <p className="text-sm font-bold font-mono text-rose-500 mt-0.5">
                        {formatCurrency(supplierTotalSpend)}
                      </p>
                    </div>
                    <div className="bg-secondary/20 p-2.5 rounded-xl border border-border/40">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Credit Due (Payable)</p>
                      <p className="text-sm font-bold font-mono text-rose-500 mt-0.5">
                        {formatCurrency(selectedSupplierForBills.outstandingCredit)}
                      </p>
                    </div>
                  </div>
                </DialogHeader>

                {/* Inward Purchases Table */}
                {supplierLedgerTab === "inwards" && (
                  <div className="overflow-y-auto overflow-x-auto flex-1 min-h-[220px] mt-2 rounded-xl border border-border/40">
                    {displayedSupplierPurchases.length === 0 ? (
                      <div className="text-center py-14 text-muted-foreground text-xs space-y-1">
                        <Truck className="w-8 h-8 mx-auto opacity-30 mb-2" />
                        <p className="font-semibold">No inward purchases found for this selection.</p>
                      </div>
                    ) : (
                      <Table className="min-w-[650px] w-full">
                        <TableHeader className="bg-secondary/25 sticky top-0 z-10 backdrop-blur-sm">
                          <TableRow className="border-border/50 hover:bg-transparent">
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 pl-4">Product Name</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3">Item Code</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3">Billing Date</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-center">Qty</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-right">Cost (₹)</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-right pr-4">Total (₹)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayedSupplierPurchases.map((p, pIdx) => {
                            const qty = Number(p.quantity) || 1
                            const cost = Number(p.purchasePrice) || 0
                            return (
                              <TableRow key={p.id || pIdx} className="border-border/40 hover:bg-secondary/15 transition-colors">
                                <TableCell className="pl-4 py-3 font-medium text-xs text-foreground">
                                  {p.productName}
                                </TableCell>
                                <TableCell className="py-3 text-xs font-mono text-muted-foreground">
                                  {p.itemCode || "—"}
                                </TableCell>
                                <TableCell className="py-3 text-xs text-muted-foreground font-mono">
                                  {p.billingDate || (p.createdAt ? p.createdAt.split("T")[0] : "—")}
                                </TableCell>
                                <TableCell className="py-3 text-center font-bold font-mono text-xs">
                                  {qty}
                                </TableCell>
                                <TableCell className="py-3 text-right font-mono text-xs text-amber-500 font-bold">
                                  ₹{cost.toLocaleString()}
                                </TableCell>
                                <TableCell className="py-3 text-right pr-4 font-bold font-mono text-xs text-emerald-500">
                                  ₹{(qty * cost).toLocaleString()}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}

                {/* Supplier Payments Table */}
                {supplierLedgerTab === "payments" && (
                  <div className="overflow-y-auto overflow-x-auto flex-1 min-h-[220px] mt-2 rounded-xl border border-border/40">
                    {activeSupplierPayments.length === 0 ? (
                      <div className="text-center py-14 text-muted-foreground text-xs space-y-1">
                        <History className="w-8 h-8 mx-auto opacity-30 mb-2" />
                        <p className="font-semibold">No payments recorded to this supplier yet.</p>
                      </div>
                    ) : (
                      <Table className="min-w-[550px] w-full">
                        <TableHeader className="bg-secondary/25 sticky top-0 z-10 backdrop-blur-sm">
                          <TableRow className="border-none hover:bg-transparent">
                            <TableHead className="font-bold uppercase text-[10px] w-12 pl-4">#</TableHead>
                            <TableHead className="font-bold uppercase text-[10px]">Date</TableHead>
                            <TableHead className="font-bold uppercase text-[10px]">Payment Mode</TableHead>
                            <TableHead className="font-bold uppercase text-[10px]">Note / Remarks</TableHead>
                            <TableHead className="text-right font-bold uppercase text-[10px] pr-4">Amount Paid</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeSupplierPayments.map((p, idx) => (
                            <TableRow key={p.id} className="border-border/30 hover:bg-secondary/5">
                              <TableCell className="pl-4 text-xs text-muted-foreground font-mono">{idx + 1}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] bg-secondary/30">
                                  {p.paymentMode}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{p.note || "—"}</TableCell>
                              <TableCell className="text-right pr-4 font-bold text-xs text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(p.amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}

                <DialogFooter className="mt-3 shrink-0 flex flex-row items-center justify-between sm:justify-between w-full">
                  <span className="text-xs text-muted-foreground">
                    Showing {displayedSupplierPurchases.length} inward record(s) &amp; {activeSupplierPayments.length} payment(s)
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setSelectedSupplierForBills(null)}>
                    Close
                  </Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* ────────────────────────────────────────────────────────── */}
      {/* DIALOG: COLLECT CUSTOMER PAYMENT */}
      {/* ────────────────────────────────────────────────────────── */}
      <Dialog open={!!selectedCustomer} onOpenChange={open => !open && setSelectedCustomer(null)}>
        <DialogContent className="sm:max-w-[460px] rounded-2xl bg-card border-none">
          <form onSubmit={handleRecordCustomerPayment}>
            <DialogHeader>
              <DialogTitle className="text-xl font-headline font-bold flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
                <span>Collect Customer Payment</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Record payment collected from <strong>{selectedCustomer?.name}</strong> to reduce or clear their credit balance.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-3">
              <div className="p-3 bg-secondary/30 border border-border/50 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Customer Phone:</span>
                  <span className="font-semibold text-foreground">
                    {selectedCustomer?.phone || "No phone"}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border/50 pt-1.5 font-bold">
                  <span>Current Credit Due Balance:</span>
                  <span className="text-orange-500 font-headline text-sm">
                    {selectedCustomer ? formatCurrency(selectedCustomer.outstandingBalance) : "₹0"}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="customerAmount" className="text-xs font-bold text-foreground">
                    Amount Received (₹)
                  </label>
                  {selectedCustomer && selectedCustomer.outstandingBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => setCustomerPaymentAmount(String(selectedCustomer.outstandingBalance))}
                      className="text-[11px] text-primary hover:underline font-semibold"
                    >
                      Collect Full Due ({formatCurrency(selectedCustomer.outstandingBalance)})
                    </button>
                  )}
                </div>
                <Input
                  id="customerAmount"
                  type="number"
                  placeholder="e.g. 500"
                  value={customerPaymentAmount}
                  onChange={e => setCustomerPaymentAmount(e.target.value)}
                  className="bg-secondary/30 border-none rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Payment Mode</label>
                <Select value={customerPaymentMode} onValueChange={setCustomerPaymentMode}>
                  <SelectTrigger className="w-full bg-secondary/30 border-none rounded-xl text-xs h-10">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="UPI">UPI / GPay / PhonePe / Paytm</SelectItem>
                    <SelectItem value="Card">Debit / Credit Card</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="customerNote" className="text-xs font-bold text-foreground">
                  Note / Remarks (Optional)
                </label>
                <Input
                  id="customerNote"
                  placeholder="e.g. Settlement for Bill #1042 via GPay"
                  value={customerPaymentNote}
                  onChange={e => setCustomerPaymentNote(e.target.value)}
                  className="bg-secondary/30 border-none rounded-xl text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelectedCustomer(null)}
                className="rounded-full text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingCustomerPayment}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 rounded-full text-xs shadow-sm"
              >
                {submittingCustomerPayment ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...
                  </>
                ) : (
                  "Record Customer Payment"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ────────────────────────────────────────────────────────── */}
      {/* DIALOG: RECORD SUPPLIER PAYMENT */}
      {/* ────────────────────────────────────────────────────────── */}
      <Dialog open={!!selectedSupplierForPay} onOpenChange={open => !open && setSelectedSupplierForPay(null)}>
        <DialogContent className="sm:max-w-[450px] rounded-2xl bg-card border-none">
          <form onSubmit={handleRecordSupplierPayment}>
            <DialogHeader>
              <DialogTitle className="text-xl font-headline font-bold flex items-center gap-2">
                <Truck className="w-5 h-5 text-rose-500" />
                <span>Pay Supplier</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Record payment made to <strong>{selectedSupplierForPay?.supplier.name}</strong> to reduce payables.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-3">
              <div className="p-3 bg-secondary/30 border border-border/50 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Total Inward Purchases:</span>
                  <span className="font-semibold text-foreground">
                    {selectedSupplierForPay ? formatCurrency(selectedSupplierForPay.totalPurchased) : "₹0"}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Total Paid to Date:</span>
                  <span className="font-semibold text-emerald-500">
                    {selectedSupplierForPay ? formatCurrency(selectedSupplierForPay.totalPaid) : "₹0"}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border/50 pt-1.5 font-bold">
                  <span>Current Credit Due:</span>
                  <span className="text-rose-500 font-headline text-sm">
                    {selectedSupplierForPay ? formatCurrency(selectedSupplierForPay.outstandingCredit) : "₹0"}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="supplierAmount" className="text-xs font-bold text-foreground">
                  Payment Amount (₹)
                </label>
                <Input
                  id="supplierAmount"
                  type="number"
                  placeholder="e.g. 5000"
                  value={supplierPayAmount}
                  onChange={e => setSupplierPayAmount(e.target.value)}
                  className="bg-secondary/30 border-none rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Payment Mode</label>
                <Select value={supplierPayMode} onValueChange={setSupplierPayMode}>
                  <SelectTrigger className="w-full bg-secondary/30 border-none rounded-xl text-xs h-10">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="UPI">UPI / GPay / PhonePe</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="supplierNote" className="text-xs font-bold text-foreground">
                  Note / Remarks (Optional)
                </label>
                <Input
                  id="supplierNote"
                  placeholder="e.g. Part payment for Invoice #102"
                  value={supplierPayNote}
                  onChange={e => setSupplierPayNote(e.target.value)}
                  className="bg-secondary/30 border-none rounded-xl text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelectedSupplierForPay(null)}
                className="rounded-full text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingSupplierPay}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold px-6 rounded-full text-xs shadow-sm"
              >
                {submittingSupplierPay ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...
                  </>
                ) : (
                  "Record Supplier Payment"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ────────────────────────────────────────────────────────── */}
      {/* EXPORT FORMAT SELECTOR MODAL (PDF / EXCEL / GOOGLE SHEETS) */}
      {/* ────────────────────────────────────────────────────────── */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-card border-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Download className="w-5 h-5 text-primary" /> Export Ledger Data
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Choose the format to export <strong className="text-foreground">{exportData?.title}</strong>:
            </DialogDescription>
          </DialogHeader>

          {exportData && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-4">
              {/* PDF Document */}
              <button
                type="button"
                onClick={() => {
                  exportToPDF(
                    exportData.title,
                    exportData.subtitle,
                    exportData.headers,
                    exportData.rows,
                    exportData.summary,
                    exportData.filename
                  )
                  setIsExportOpen(false)
                }}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/60 bg-secondary/20 hover:bg-rose-500/10 hover:border-rose-500/50 transition-all text-center group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-foreground">PDF Document</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Vector Print (.pdf)</span>
              </button>

              {/* Excel Spreadsheet (.csv) */}
              <button
                type="button"
                onClick={() => {
                  exportToCSV(exportData.filename, exportData.headers, exportData.rows)
                  setIsExportOpen(false)
                }}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/60 bg-secondary/20 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all text-center group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-foreground">Excel Sheet</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Spreadsheet (.csv)</span>
              </button>

              {/* Google Sheets */}
              <button
                type="button"
                onClick={() => {
                  exportToGoogleSheets(exportData.filename, exportData.headers, exportData.rows)
                  setIsExportOpen(false)
                }}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/60 bg-secondary/20 hover:bg-blue-500/10 hover:border-blue-500/50 transition-all text-center group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-blue-500/15 text-blue-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <ExternalLink className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-foreground">Google Sheets</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Cloud Sheets (.tsv)</span>
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Google Sheets Assistant Guide Dialog */}
      <Dialog open={showSheetsGuide} onOpenChange={setShowSheetsGuide}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-card border-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <ExternalLink className="w-5 h-5 text-blue-500" />
              <span>How to View in Google Sheets</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Google Sheets always opens with an empty grid. Follow either quick step below:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <p className="font-bold text-blue-500 text-sm mb-1">Method 1 (Instant — 1 Second):</p>
              <p className="text-muted-foreground">
                Your data has been copied to your clipboard! In your newly opened sheet, click cell <strong>A1</strong> and press <kbd className="bg-secondary px-1.5 py-0.5 rounded font-mono font-bold text-foreground">Ctrl + V</kbd> (or <kbd className="bg-secondary px-1.5 py-0.5 rounded font-mono font-bold text-foreground">Cmd + V</kbd> on Mac).
              </p>
            </div>

            <div className="p-3 rounded-xl bg-secondary/30 border border-border/50">
              <p className="font-bold text-foreground mb-1">Method 2 (Using Downloaded File):</p>
              <p className="text-muted-foreground">
                In Google Sheets, click <strong>File</strong> → <strong>Import</strong> → <strong>Upload</strong> tab, and select the CSV file automatically downloaded to your Downloads folder.
              </p>
            </div>
          </div>

          <DialogFooter className="flex sm:justify-between items-center w-full mt-2">
            <a
              href="https://sheets.new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-blue-500 hover:underline"
            >
              <span>Open New Sheet (sheets.new)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <Button size="sm" onClick={() => setShowSheetsGuide(false)} className="rounded-xl text-xs px-4">
              Got it!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
