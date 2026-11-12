"use client"

import * as React from "react"
import {
  Truck,
  ArrowLeft,
  Loader2,
  Package,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Receipt,
  ShoppingCart,
  BadgeDollarSign,
  Calendar,
  Search,
  IndianRupee,
  Download,
  FileText,
  FileSpreadsheet,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useRouter } from "next/navigation"
import { useUser } from "@/app/auth/use-user"
import { toast } from "@/hooks/use-toast"

interface Purchase {
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

interface Supplier {
  id: string
  name: string
  email: string
  phone: string
  contactPerson: string
}

interface ProductInfo {
  id: string
  name: string
  sku?: string
}

interface DateGroup {
  date: string            // e.g. "2026-11-12"
  displayDate: string     // e.g. "12/11/2026"
  relativeLabel: string | null // "Today" | "Yesterday" | null
  purchases: Purchase[]
  totalQty: number
  totalAmount: number
  productCount: number    // unique product count
  supplierNames: string[] // distinct supplier names on that day
}

function formatToDDMMYYYY(dateStr: string): string {
  if (!dateStr || !dateStr.includes("-")) return dateStr
  const [y, m, d] = dateStr.split("-")
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`
}

function getRelativeDateLabel(dateStr: string): string | null {
  const today = new Date().toISOString().split("T")[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
  if (dateStr === today) return "Today"
  if (dateStr === yesterday) return "Yesterday"
  return null
}

export default function PurchaseHistoryPage() {
  const router = useRouter()
  const { user } = useUser()
  const [purchases, setPurchases] = React.useState<Purchase[]>([])
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([])
  const [products, setProducts] = React.useState<ProductInfo[]>([])
  const [loading, setLoading] = React.useState(true)
  const [expandedDates, setExpandedDates] = React.useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = React.useState("")

  // Date Stepper State: Defaults to Today (e.g. "2026-11-12") or "ALL"
  const todayStr = React.useMemo(() => new Date().toISOString().split("T")[0], [])
  const [selectedDate, setSelectedDate] = React.useState<string | "ALL">(todayStr)

  // Export Modal State & Scope Controls
  type ExportScope = "today" | "yesterday" | "month" | "year" | "custom" | "all"
  const [isExportOpen, setIsExportOpen] = React.useState(false)
  const [exportScope, setExportScope] = React.useState<ExportScope>("today")
  const [customExportStartDate, setCustomExportStartDate] = React.useState<string>(() => new Date().toISOString().split("T")[0])
  const [customExportEndDate, setCustomExportEndDate] = React.useState<string>(() => new Date().toISOString().split("T")[0])
  const [exportMonth, setExportMonth] = React.useState<string>(() => new Date().toISOString().slice(0, 7))
  const [exportYear, setExportYear] = React.useState<string>(() => new Date().getFullYear().toString())

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

    stream += `BT /F2 16 Tf 0.05 0.1 0.2 rg ${margin} ${pageHeight - margin - 20} Td (${esc(title)}) Tj ET\n`
    stream += `BT /F1 9 Tf 0.4 0.45 0.5 rg ${margin} ${pageHeight - margin - 35} Td (${esc(subtitle)}) Tj ET\n`
    const dateStr = `Exported: ${new Date().toLocaleDateString()}`
    stream += `BT /F1 8 Tf 0.5 0.5 0.5 rg ${pageWidth - margin - 100} ${pageHeight - margin - 20} Td (${esc(dateStr)}) Tj ET\n`

    const headerLineY = pageHeight - margin - 45
    stream += `0.0 0.5 0.8 RG 1.5 w ${margin} ${headerLineY} m ${pageWidth - margin} ${headerLineY} l S\n`

    const colCount = Math.max(1, headers.length)
    const colWidth = contentWidth / colCount

    let currentY = headerLineY - 18
    stream += `0.94 0.96 0.98 rg ${margin} ${currentY - 4} ${contentWidth} 18 re f\n`
    stream += `0.8 0.85 0.9 RG 0.5 w ${margin} ${currentY - 4} ${contentWidth} 18 re s\n`

    headers.forEach((h, idx) => {
      const x = margin + idx * colWidth + 5
      stream += `BT /F2 9 Tf 0.1 0.15 0.2 rg ${x} ${currentY + 1} Td (${esc(h)}) Tj ET\n`
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
        stream += `BT /F1 8.5 Tf 0.2 0.2 0.2 rg ${x} ${currentY} Td (${esc(cellText)}) Tj ET\n`
      })

      currentY -= 16
    })

    if (summary && summary.length > 0) {
      currentY -= 12
      stream += `0.0 0.5 0.8 RG 1 w ${margin} ${currentY + 10} m ${pageWidth - margin} ${currentY + 10} l S\n`
      summary.forEach((s) => {
        const sumText = `${s.label}: ${String(s.value).replace(/₹/g, "Rs. ")}`
        stream += `BT /F2 9.5 Tf 0.05 0.3 0.6 rg ${margin + 10} ${currentY} Td (${esc(sumText)}) Tj ET\n`
        currentY -= 14
      })
    }

    stream += `BT /F1 8 Tf 0.6 0.6 0.6 rg ${margin} 25 Td (ShopX Elite Procurement System) Tj ET\n`

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

  const exportToCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = [
      headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(","),
      ...rows.map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    ].join("\r\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `${filename}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast({ title: "Excel / CSV Exported ✓", description: `Downloaded ${filename}.csv` })
  }

  const exportToGoogleSheets = (filename: string, headers: string[], rows: (string | number)[][]) => {
    exportToCSV(filename, headers, rows)
    window.open("https://sheets.new", "_blank")
    toast({
      title: "Google Sheets Export ✓",
      description: "Downloaded CSV and opened Google Sheets (Import -> Upload).",
    })
  }

  const exportToPDF = async (
    title: string,
    subtitle: string,
    headers: string[],
    rows: (string | number)[][],
    summary?: { label: string; value: string }[],
    filename?: string
  ) => {
    const safeFilename = filename || `Purchases_${new Date().toISOString().split("T")[0]}`

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
        doc.setTextColor(15, 23, 42)
        doc.text(title, 14, 18)
        doc.setFontSize(9)
        doc.setTextColor(100, 116, 139)
        doc.text(subtitle, 14, 25)

        const sanitizedHeaders = headers.map(h => String(h).replace(/₹/g, "INR"))
        const sanitizedRows = rows.map(r => r.map(c => String(c ?? "").replace(/₹/g, "Rs. ")))

        ;(doc as any).autoTable({
          startY: 30,
          head: [sanitizedHeaders],
          body: sanitizedRows,
          theme: "striped",
          headStyles: { fillColor: [2, 132, 199] },
          styles: { fontSize: 8.5 },
        })

        if (summary && summary.length > 0) {
          const finalY = (doc as any).lastAutoTable.finalY + 8
          summary.forEach((s, idx) => {
            doc.setFontSize(9)
            doc.setTextColor(30, 41, 59)
            doc.text(`${s.label}: ${String(s.value).replace(/₹/g, "Rs. ")}`, 14, finalY + (idx * 5.5))
          })
        }

        doc.save(`${safeFilename}.pdf`)
        toast({ title: "PDF Downloaded ✓", description: `Saved ${safeFilename}.pdf to Downloads.` })
        return
      }
    } catch (cdnErr) {
      console.warn("CDN PDF unavailable, using native generator fallback:", cdnErr)
    }

    const blob = buildPdfBlob(title, subtitle, headers, rows, summary)
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `${safeFilename}.pdf`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast({ title: "PDF Downloaded ✓", description: `Saved ${safeFilename}.pdf to Downloads.` })
  }

  // Load all purchases, suppliers, and products
  React.useEffect(() => {
    if (!user?.uid) return
    const fetchAll = async () => {
      try {
        setLoading(true)
        const [purchasesRes, suppliersRes, productsRes] = await Promise.all([
          fetch("/api/purchases", { headers: { "x-user-id": user.uid } }),
          fetch("/api/suppliers", { headers: { "x-user-id": user.uid } }),
          fetch("/api/products", { headers: { "x-user-id": user.uid } }),
        ])
        if (purchasesRes.ok) {
          const data = await purchasesRes.json()
          setPurchases(Array.isArray(data) ? data : [])
        }
        if (suppliersRes.ok) {
          const data = await suppliersRes.json()
          setSuppliers(Array.isArray(data) ? data : [])
        }
        if (productsRes.ok) {
          const data = await productsRes.json()
          setProducts(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        console.error(err)
        toast({ title: "Error", description: "Could not load purchase history.", variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [user?.uid])

  // Maps for fast lookups
  const supplierMap = React.useMemo(() => {
    const map = new Map<string, Supplier>()
    suppliers.forEach(s => map.set(s.id, s))
    return map
  }, [suppliers])

  const productMap = React.useMemo(() => {
    const map = new Map<string, ProductInfo>()
    products.forEach(p => map.set(p.id, p))
    return map
  }, [products])

  const getItemCode = React.useCallback((p: Purchase): string => {
    if (p.itemCode && p.itemCode.trim()) return p.itemCode
    const prod = productMap.get(p.productId)
    if (prod?.sku && prod.sku.trim()) return prod.sku
    return "—"
  }, [productMap])

  // Deduplicate identical twin purchases created within close timeframe by the dual POST bug
  const cleanPurchases = React.useMemo(() => {
    const seen = new Map<string, Purchase>()
    const result: Purchase[] = []

    // Sort by createdAt ascending so the earliest is kept
    const sorted = [...purchases].sort((a, b) => {
      const tA = new Date(a.createdAt || 0).getTime()
      const tB = new Date(b.createdAt || 0).getTime()
      return tA - tB
    })

    for (const p of sorted) {
      const date = p.billingDate || (p.createdAt ? p.createdAt.split("T")[0] : "")
      const key = `${date}_${p.supplierId}_${p.productId || p.productName}_${p.quantity}_${p.purchasePrice}`
      const existing = seen.get(key)
      if (existing) {
        const diffMs = Math.abs(
          new Date(p.createdAt || 0).getTime() - new Date(existing.createdAt || 0).getTime()
        )
        // If created within 2 minutes of each other with identical values, skip twin duplicate
        if (diffMs < 120000) {
          continue
        }
      }
      seen.set(key, p)
      result.push(p)
    }

    return result
  }, [purchases])

  // Unique Bill Count: Count unique bills by date + supplierId
  const totalBills = React.useMemo(() => {
    const billKeys = new Set(
      cleanPurchases.map(p => `${p.billingDate || (p.createdAt ? p.createdAt.split("T")[0] : "")}_${p.supplierId}`)
    )
    return billKeys.size
  }, [cleanPurchases])

  const totalSpent = React.useMemo(() =>
    cleanPurchases.reduce((acc, p) => acc + (Number(p.quantity) || 0) * (Number(p.purchasePrice) || 0), 0),
  [cleanPurchases])

  const totalItems = React.useMemo(() =>
    cleanPurchases.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0),
  [cleanPurchases])

  const todayPurchases = React.useMemo(() =>
    cleanPurchases.filter(p => (p.billingDate || p.createdAt?.split("T")[0]) === todayStr),
  [cleanPurchases, todayStr])

  const todayTotal = React.useMemo(() =>
    todayPurchases.reduce((acc, p) => acc + (Number(p.quantity) || 0) * (Number(p.purchasePrice) || 0), 0),
  [todayPurchases])

  // Group by billing date, latest on top
  const dateGroups = React.useMemo((): DateGroup[] => {
    const map: Record<string, DateGroup> = {}

    cleanPurchases.forEach(p => {
      const date = p.billingDate || (p.createdAt ? p.createdAt.split("T")[0] : "Unknown")
      if (!map[date]) {
        map[date] = {
          date,
          displayDate: formatToDDMMYYYY(date),
          relativeLabel: getRelativeDateLabel(date),
          purchases: [],
          totalQty: 0,
          totalAmount: 0,
          productCount: 0,
          supplierNames: [],
        }
      }
      map[date].purchases.push(p)
      map[date].totalQty += Number(p.quantity) || 0
      map[date].totalAmount += (Number(p.quantity) || 0) * (Number(p.purchasePrice) || 0)
    })

    // Count unique products per date, collect unique supplier names
    Object.values(map).forEach(g => {
      const productIds = new Set(g.purchases.map(p => p.productId))
      g.productCount = productIds.size

      const supIds = new Set(g.purchases.map(p => p.supplierId))
      g.supplierNames = Array.from(supIds)
        .map(id => supplierMap.get(id)?.name ?? "Unknown")
        .filter(Boolean)
        .slice(0, 3)
    })

    // Sort groups: latest date first
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date))
  }, [cleanPurchases, supplierMap])

  // Auto-expand all dates by default
  React.useEffect(() => {
    const allDates = new Set(dateGroups.map(g => g.date))
    setExpandedDates(allDates)
  }, [dateGroups])

  // Apply search query filter
  const filteredGroups = React.useMemo((): DateGroup[] => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return dateGroups

    return dateGroups
      .map(g => ({
        ...g,
        purchases: g.purchases.filter(p => {
          const sup = supplierMap.get(p.supplierId)
          const code = getItemCode(p).toLowerCase()
          return (
            p.productName.toLowerCase().includes(q) ||
            code.includes(q) ||
            (sup && sup.name.toLowerCase().includes(q)) ||
            g.date.includes(q) ||
            formatToDDMMYYYY(g.date).includes(q)
          )
        }),
      }))
      .filter(g => g.purchases.length > 0)
      .map(g => ({
        ...g,
        totalQty: g.purchases.reduce((s, p) => s + (Number(p.quantity) || 0), 0),
        totalAmount: g.purchases.reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.purchasePrice) || 0), 0),
        productCount: new Set(g.purchases.map(p => p.productId)).size,
        supplierNames: Array.from(new Set(g.purchases.map(p => supplierMap.get(p.supplierId)?.name ?? "Unknown"))).slice(0, 3),
      }))
  }, [dateGroups, searchQuery, supplierMap, getItemCode])

  // Filter groups according to Date Stepper (selectedDate)
  const displayedGroups = React.useMemo(() => {
    if (selectedDate === "ALL") return filteredGroups
    return filteredGroups.filter(g => g.date === selectedDate)
  }, [filteredGroups, selectedDate])

  // Date Stepper Handlers
  const stepDate = (deltaDays: number) => {
    const base = selectedDate === "ALL" ? new Date() : new Date(selectedDate)
    base.setDate(base.getDate() + deltaDays)
    const newDateStr = base.toISOString().split("T")[0]
    if (newDateStr <= todayStr) {
      setSelectedDate(newDateStr)
    }
  }

  const toggleDate = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  // ── Reactive Export Dataset (Calculated for selected scope) ──
  const activeExportData = React.useMemo(() => {
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0]

    let filtered: Purchase[] = []
    let scopeLabel = ""
    let filenameSuffix = ""

    const getPDate = (p: Purchase) => p.billingDate || (p.createdAt ? p.createdAt.split("T")[0] : "")

    if (exportScope === "today") {
      filtered = cleanPurchases.filter(p => getPDate(p) === todayStr)
      scopeLabel = `Today (${formatToDDMMYYYY(todayStr)})`
      filenameSuffix = `Today_${todayStr}`
    } else if (exportScope === "yesterday") {
      filtered = cleanPurchases.filter(p => getPDate(p) === yesterdayStr)
      scopeLabel = `Yesterday (${formatToDDMMYYYY(yesterdayStr)})`
      filenameSuffix = `Yesterday_${yesterdayStr}`
    } else if (exportScope === "month") {
      filtered = cleanPurchases.filter(p => getPDate(p).startsWith(exportMonth))
      const [y, m] = exportMonth.split("-")
      const monthDate = new Date(Number(y), Number(m) - 1, 1)
      const monthName = !isNaN(monthDate.getTime())
        ? monthDate.toLocaleString("en-IN", { month: "long", year: "numeric" })
        : exportMonth
      scopeLabel = `Monthly (${monthName})`
      filenameSuffix = `Month_${exportMonth}`
    } else if (exportScope === "year") {
      filtered = cleanPurchases.filter(p => getPDate(p).startsWith(exportYear))
      scopeLabel = `Yearly (Year ${exportYear})`
      filenameSuffix = `Year_${exportYear}`
    } else if (exportScope === "custom") {
      filtered = cleanPurchases.filter(p => {
        const d = getPDate(p)
        return d >= customExportStartDate && d <= customExportEndDate
      })
      scopeLabel = `Date Wise (${formatToDDMMYYYY(customExportStartDate)} to ${formatToDDMMYYYY(customExportEndDate)})`
      filenameSuffix = `Range_${customExportStartDate}_to_${customExportEndDate}`
    } else {
      // "all"
      filtered = cleanPurchases
      scopeLabel = "All Data (All Time)"
      filenameSuffix = `All_${todayStr}`
    }

    const itemsCount = filtered.length
    const totalUnits = filtered.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0)
    const totalAmount = filtered.reduce((acc, p) => acc + (Number(p.quantity) || 0) * (Number(p.purchasePrice) || 0), 0)

    const headers = ["#", "Item Code", "Product Name", "Supplier", "Phone", "Billing Date", "Qty", "Cost (₹)", "Subtotal (₹)"]
    const rows = filtered.map((p, idx) => {
      const sup = supplierMap.get(p.supplierId)
      const qty = Number(p.quantity) || 1
      const cost = Number(p.purchasePrice) || 0
      const code = getItemCode(p)
      return [
        idx + 1,
        code,
        p.productName || "Product",
        sup?.name || "N/A",
        sup?.phone || "N/A",
        formatToDDMMYYYY(getPDate(p)),
        qty,
        `₹${cost.toLocaleString()}`,
        `₹${(qty * cost).toLocaleString()}`,
      ]
    })

    return {
      filtered,
      scopeLabel,
      itemsCount,
      totalUnits,
      totalAmount,
      title: `Purchase Report — ${scopeLabel}`,
      subtitle: `${itemsCount} Items • ${totalUnits} Units • Total Spent: ₹${totalAmount.toLocaleString()}`,
      filename: `Purchases_${filenameSuffix}`,
      headers,
      rows,
      summary: [
        { label: "Report Period", value: scopeLabel },
        { label: "Purchase Records", value: String(itemsCount) },
        { label: "Total Units", value: String(totalUnits) },
        { label: "Total Spent", value: `₹${totalAmount.toLocaleString()}` },
      ],
    }
  }, [cleanPurchases, exportScope, todayStr, exportMonth, exportYear, customExportStartDate, customExportEndDate, supplierMap, getItemCode])

  // Open Export Modal
  const handleExportAll = () => {
    setExportScope("all")
    setIsExportOpen(true)
  }

  // Export single date group (opens modal pre-selected to this date)
  const handleExportGroup = (group: DateGroup) => {
    setExportScope("custom")
    setCustomExportStartDate(group.date)
    setCustomExportEndDate(group.date)
    setIsExportOpen(true)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-secondary shrink-0"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-headline font-bold text-foreground">
              Purchase <span className="text-accent">History</span>
            </h1>
            <p className="text-muted-foreground text-sm">All inward purchases grouped by billing date — bill-wise totals &amp; SKU tracking.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAll}
            className="h-9 px-3 text-xs font-bold gap-1.5 rounded-xl border-border/60 hover:bg-secondary/60 hover:text-accent shadow-sm"
          >
            <Download className="w-4 h-4 text-accent" />
            <span>Export History</span>
          </Button>
          <Button
            onClick={() => router.push("/purchases/purchase-entry")}
            className="h-9 px-4 text-xs font-bold bg-accent text-accent-foreground hover:brightness-110 rounded-xl shadow-sm"
          >
            + New Purchase
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-accent/10 p-2.5 rounded-xl">
              <Calendar className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Today's Purchases</p>
              <p className="text-xl font-bold font-headline text-accent">₹{todayTotal.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Bills</p>
              <p className="text-xl font-bold font-headline">{totalBills}</p>
            </div>
          </div>
        </Card>
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/10 p-2.5 rounded-xl">
              <ShoppingCart className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Units</p>
              <p className="text-xl font-bold font-headline">{totalItems}</p>
            </div>
          </div>
        </Card>
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2.5 rounded-xl">
              <BadgeDollarSign className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Spent</p>
              <p className="text-xl font-bold font-headline text-emerald-400">₹{totalSpent.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Date Stepper & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card border border-border/60 p-3 rounded-2xl shadow-sm">
        {/* Left: Interactive Date Stepper `< Date >` */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-secondary/30 border border-border/50 rounded-xl p-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => stepDate(-1)}
              className="h-8 w-8 rounded-lg hover:bg-secondary text-foreground hover:text-accent shrink-0"
              title="Previous Day (Yesterday / Earlier)"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="px-3 py-0.5 text-center min-w-[150px]">
              {selectedDate === "ALL" ? (
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block leading-tight">
                    All History
                  </span>
                  <span className="text-xs font-bold font-code text-accent">
                    All Dates
                  </span>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-xs font-bold font-code text-foreground">
                      {formatToDDMMYYYY(selectedDate)}
                    </span>
                    {getRelativeDateLabel(selectedDate) && (
                      <Badge className="text-[9px] bg-accent/20 text-accent hover:bg-accent/30 px-1.5 py-0 h-4 font-bold">
                        {getRelativeDateLabel(selectedDate)}
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-code">
                    {new Date(selectedDate).toLocaleDateString("en-IN", { weekday: "short" })}
                  </span>
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => stepDate(1)}
              disabled={selectedDate === "ALL" || selectedDate >= todayStr}
              className="h-8 w-8 rounded-lg hover:bg-secondary text-foreground hover:text-accent disabled:opacity-20 shrink-0"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Quick Date Toggles */}
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant={selectedDate === "ALL" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDate("ALL")}
              className={`h-9 px-3 text-xs font-bold rounded-xl transition-all ${
                selectedDate === "ALL"
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "border-border/60 hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              All Dates
            </Button>

            {selectedDate !== todayStr && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(todayStr)}
                className="h-9 px-2.5 text-xs font-bold rounded-xl border-border/60 hover:bg-secondary/60 text-accent"
              >
                Today
              </Button>
            )}
          </div>
        </div>

        {/* Right: Search Input with text-base to prevent mobile auto-zoom */}
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search item code, product, vendor..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-secondary/30 border-border/40 rounded-xl text-base sm:text-sm focus-visible:ring-accent"
          />
        </div>
      </div>

      {/* Date Groups Listing */}
      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-10 h-10 animate-spin text-accent opacity-50" />
        </div>
      ) : displayedGroups.length === 0 ? (
        <Card className="border-none bg-card shadow-sm p-8 text-center">
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="bg-secondary/40 p-4 rounded-full">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-bold text-base text-foreground">
                {selectedDate === "ALL"
                  ? "No purchase history found"
                  : `No purchases recorded on ${formatToDDMMYYYY(selectedDate)}${
                      getRelativeDateLabel(selectedDate) ? ` (${getRelativeDateLabel(selectedDate)})` : ""
                    }`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedDate === "ALL"
                  ? "No inward purchase records exist matching your search."
                  : "You can click '<' to view earlier days, jump to 'All Dates', or create a new entry."}
              </p>
            </div>
            <div className="flex items-center gap-2 mt-2">
              {selectedDate !== "ALL" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDate("ALL")}
                  className="text-xs font-bold rounded-xl"
                >
                  View All Dates
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => router.push("/purchases/purchase-entry")}
                className="text-xs font-bold bg-accent text-accent-foreground rounded-xl"
              >
                + New Purchase
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {displayedGroups.map(group => {
            const isExpanded = expandedDates.has(group.date)
            const isToday = group.date === todayStr
            const isYesterday = group.relativeLabel === "Yesterday"

            return (
              <Card
                key={group.date}
                className={`border-none shadow-md overflow-hidden transition-all ${isToday ? "ring-1 ring-accent/40" : ""}`}
              >
                {/* ── ACCORDION HEADER (always visible) ── */}
                <button
                  type="button"
                  onClick={() => toggleDate(group.date)}
                  className="w-full text-left"
                >
                  <div className={`flex items-center justify-between gap-3 px-4 sm:px-6 py-4 transition-colors hover:bg-secondary/20 ${isExpanded ? "bg-secondary/20 border-b border-border/50" : "bg-card"}`}>
                    
                    {/* Left: Date + Badge */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2.5 rounded-xl shrink-0 ${isToday ? "bg-accent/20" : "bg-secondary/40"}`}>
                        <Calendar className={`w-4 h-4 ${isToday ? "text-accent" : "text-muted-foreground"}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-bold font-code text-base sm:text-lg ${isToday ? "text-accent" : "text-foreground"}`}>
                            {group.displayDate}
                          </span>
                          {group.relativeLabel && (
                            <Badge className={`text-[9px] px-2 py-0.5 h-5 font-bold ${
                              isToday
                                ? "bg-accent/20 text-accent hover:bg-accent/30"
                                : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                            }`}>
                              {group.relativeLabel}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground font-code hidden sm:inline">
                            ({new Date(group.date).toLocaleDateString("en-IN", { weekday: "short" })})
                          </span>
                        </div>
                        {/* Supplier names preview */}
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {group.supplierNames.length > 0
                            ? group.supplierNames.join(" · ")
                            : "No supplier recorded"}
                          {group.supplierNames.length >= 3 && " ···"}
                        </p>
                      </div>
                    </div>

                    {/* Right: Summary stats + toggle icon */}
                    <div className="flex items-center gap-3 sm:gap-5 shrink-0">
                      {/* Total Qty */}
                      <div className="text-center hidden sm:block">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Qty</p>
                        <p className="font-bold text-sm font-code">{group.totalQty}</p>
                      </div>
                      {/* Product count */}
                      <div className="text-center hidden sm:block">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Products</p>
                        <p className="font-bold text-sm font-code">{group.purchases.length}</p>
                      </div>
                      {/* Total Amount */}
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Day Total</p>
                        <p className={`font-bold text-base sm:text-lg font-code ${isToday ? "text-accent" : "text-emerald-400"}`}>
                          ₹{group.totalAmount.toLocaleString()}
                        </p>
                      </div>
                      {/* Toggle icon */}
                      <div className={`p-1.5 rounded-lg transition-colors ${isExpanded ? "bg-accent/20 text-accent" : "bg-secondary/40 text-muted-foreground"}`}>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </div>
                </button>

                {/* ── EXPANDED PURCHASE DETAIL TABLE ── */}
                {isExpanded && (
                  <CardContent className="p-0">
                    {/* Header bar inside expanded section with export day button */}
                    <div className="px-4 py-2.5 bg-secondary/10 border-b border-border/30 flex items-center justify-between gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span><span className="font-bold text-foreground">{group.purchases.length}</span> purchases</span>
                        <span>•</span>
                        <span><span className="font-bold text-foreground">{group.totalQty}</span> total units</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px] font-bold gap-1 text-accent hover:bg-accent/10 px-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleExportGroup(group)
                        }}
                      >
                        <Download className="w-3 h-3" />
                        Export Day
                      </Button>
                    </div>

                    <div className="overflow-x-auto">
                      <Table className="min-w-[700px]">
                        <TableHeader className="bg-secondary/10">
                          <TableRow className="border-border/30 hover:bg-transparent">
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 pl-5 w-[45px]">#</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 w-[120px]">Item Code</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3">Product Name</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3">Supplier / Vendor</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-center w-[75px]">Qty</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-right w-[115px]">Purchase Cost</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-right pr-5 w-[115px]">Subtotal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.purchases.map((p, i) => {
                            const sup = supplierMap.get(p.supplierId)
                            const code = getItemCode(p)
                            return (
                              <TableRow
                                key={p.id || i}
                                className="border-border/20 hover:bg-secondary/10 transition-colors"
                              >
                                <TableCell className="py-3 pl-5 text-xs text-muted-foreground font-code">
                                  {i + 1}
                                </TableCell>
                                <TableCell className="py-3">
                                  <span className="font-code text-xs font-semibold px-2 py-0.5 rounded bg-secondary/60 text-foreground border border-border/40 inline-block">
                                    {code}
                                  </span>
                                </TableCell>
                                <TableCell className="py-3">
                                  <div className="flex items-center gap-2">
                                    <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    <span className="font-bold text-sm text-foreground">{p.productName}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-3">
                                  <div>
                                    <p className="text-xs font-bold text-foreground">{sup?.name ?? "Unknown"}</p>
                                    {sup?.phone && (
                                      <p className="text-[10px] text-muted-foreground font-code">📞 {sup.phone}</p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="py-3 text-center font-bold font-code">
                                  {p.quantity}
                                </TableCell>
                                <TableCell className="py-3 text-right font-code text-amber-400 font-bold text-sm">
                                  ₹{Number(p.purchasePrice).toLocaleString()}
                                </TableCell>
                                <TableCell className="py-3 text-right pr-5 font-code font-bold text-emerald-400 text-sm">
                                  ₹{((Number(p.quantity) || 0) * (Number(p.purchasePrice) || 0)).toLocaleString()}
                                </TableCell>
                              </TableRow>
                            )
                          })}

                          {/* Day Total Row */}
                          <TableRow className="bg-secondary/20 border-t-2 border-border/60 hover:bg-secondary/20">
                            <TableCell colSpan={4} className="py-3 pl-5">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Day Total — {group.displayDate} {group.relativeLabel ? `(${group.relativeLabel})` : ""}
                              </span>
                            </TableCell>
                            <TableCell className="py-3 text-center">
                              <span className="font-bold font-code text-sm">{group.totalQty}</span>
                              <span className="text-[10px] text-muted-foreground ml-1">units</span>
                            </TableCell>
                            <TableCell className="py-3 text-right text-xs text-muted-foreground">
                              {group.purchases.length} items
                            </TableCell>
                            <TableCell className="py-3 text-right pr-5">
                              <span className={`font-bold font-code text-lg ${isToday ? "text-accent" : "text-emerald-400"}`}>
                                ₹{group.totalAmount.toLocaleString()}
                              </span>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* ── EXPORT MODAL (RANGE SELECTOR + PDF / EXCEL / GOOGLE SHEETS) ── */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Download className="w-5 h-5 text-accent" /> Export Purchase Data
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Select what period to export and choose your download format.
            </p>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Step 1: Select Scope / Range */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                1. Select Export Period
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {[
                  { id: "today", label: "Today" },
                  { id: "yesterday", label: "Yesterday" },
                  { id: "month", label: "Monthly" },
                  { id: "year", label: "Yearly" },
                  { id: "custom", label: "Date Wise" },
                  { id: "all", label: "All Data" },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setExportScope(tab.id as any)}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all text-center ${
                      exportScope === tab.id
                        ? "bg-accent text-accent-foreground border-accent shadow-sm"
                        : "bg-secondary/20 hover:bg-secondary/50 text-foreground border-border/50"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-controls for specific scopes */}
            {exportScope === "month" && (
              <div className="p-3 bg-secondary/10 rounded-xl border border-border/40 space-y-1.5">
                <label className="text-xs font-bold text-foreground block">Select Month:</label>
                <Input
                  type="month"
                  value={exportMonth}
                  onChange={e => e.target.value && setExportMonth(e.target.value)}
                  className="h-9 text-xs font-code bg-card"
                />
              </div>
            )}

            {exportScope === "year" && (
              <div className="p-3 bg-secondary/10 rounded-xl border border-border/40 space-y-1.5">
                <label className="text-xs font-bold text-foreground block">Select Year:</label>
                <div className="flex gap-2">
                  {[
                    new Date().getFullYear().toString(),
                    (new Date().getFullYear() - 1).toString(),
                    (new Date().getFullYear() - 2).toString(),
                  ].map(y => (
                    <Button
                      key={y}
                      type="button"
                      variant={exportYear === y ? "default" : "outline"}
                      size="sm"
                      onClick={() => setExportYear(y)}
                      className="h-8 text-xs font-bold font-code"
                    >
                      {y}
                    </Button>
                  ))}
                  <Input
                    type="number"
                    min="2000"
                    max="2100"
                    value={exportYear}
                    onChange={e => e.target.value && setExportYear(e.target.value)}
                    className="h-8 w-24 text-xs font-code bg-card"
                    placeholder="YYYY"
                  />
                </div>
              </div>
            )}

            {exportScope === "custom" && (
              <div className="p-3 bg-secondary/10 rounded-xl border border-border/40 space-y-2">
                <label className="text-xs font-bold text-foreground block">Select Date Range (From - To):</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-1">From Date</span>
                    <Input
                      type="date"
                      value={customExportStartDate}
                      onChange={e => e.target.value && setCustomExportStartDate(e.target.value)}
                      className="h-9 text-xs font-code bg-card"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-1">To Date</span>
                    <Input
                      type="date"
                      value={customExportEndDate}
                      onChange={e => e.target.value && setCustomExportEndDate(e.target.value)}
                      className="h-9 text-xs font-code bg-card"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Scope Summary Preview Box */}
            <div className="p-3.5 rounded-xl border border-accent/20 bg-accent/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <p className="text-[11px] font-bold text-accent uppercase tracking-wide">
                  {activeExportData.scopeLabel}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ready to export{" "}
                  <span className="font-bold text-foreground">{activeExportData.itemsCount}</span> purchase items
                  ({activeExportData.totalUnits} units)
                </p>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                  Total Purchases
                </span>
                <span className="font-bold font-code text-base text-accent">
                  ₹{activeExportData.totalAmount.toLocaleString()}
                </span>
              </div>
            </div>

            {activeExportData.itemsCount === 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center">
                <p className="text-xs text-amber-400 font-bold">
                  No purchase records found for this period.
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Try selecting a different date range or "All Data".
                </p>
              </div>
            )}

            {/* Step 2: Format Selector */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                2. Choose Format &amp; Download
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* PDF Document */}
                <button
                  type="button"
                  disabled={activeExportData.itemsCount === 0}
                  onClick={() => {
                    exportToPDF(
                      activeExportData.title,
                      activeExportData.subtitle,
                      activeExportData.headers,
                      activeExportData.rows,
                      activeExportData.summary,
                      activeExportData.filename
                    )
                    setIsExportOpen(false)
                  }}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/60 bg-secondary/20 hover:bg-rose-500/10 hover:border-rose-500/50 transition-all text-center group cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="w-12 h-12 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <FileText className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-foreground">PDF Document</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">Download .pdf</span>
                </button>

                {/* Microsoft Excel */}
                <button
                  type="button"
                  disabled={activeExportData.itemsCount === 0}
                  onClick={() => {
                    exportToCSV(
                      activeExportData.filename,
                      activeExportData.headers,
                      activeExportData.rows
                    )
                    setIsExportOpen(false)
                  }}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/60 bg-secondary/20 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all text-center group cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-foreground">Excel Spreadsheet</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">Microsoft Excel .csv</span>
                </button>

                {/* Google Sheets */}
                <button
                  type="button"
                  disabled={activeExportData.itemsCount === 0}
                  onClick={() => {
                    exportToGoogleSheets(
                      activeExportData.filename,
                      activeExportData.headers,
                      activeExportData.rows
                    )
                    setIsExportOpen(false)
                  }}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/60 bg-secondary/20 hover:bg-blue-500/10 hover:border-blue-500/50 transition-all text-center group cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-500/15 text-blue-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <ExternalLink className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-foreground">Google Sheets</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">Open &amp; Import</span>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setIsExportOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
