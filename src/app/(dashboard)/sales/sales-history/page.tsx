"use client"

import * as React from "react"
import {
  ShoppingBag,
  FileText,
  IndianRupee,
  CreditCard,
  Wallet,
  Search,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Receipt,
  Download,
  FileSpreadsheet,
  ExternalLink,
  Package,
  Share2,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
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
import { cn } from "@/lib/utils"
import { useUser } from "@/app/auth/use-user"
import { toast } from "@/hooks/use-toast"

export interface SaleItem {
  productId: string
  productName: string
  sku?: string
  quantity: number
  price: number
  taxRate?: number
  taxAmount?: number
}

export interface Sale {
  id: string
  billNumber?: string
  date: string
  customerId: string
  customerName: string
  customerPhone?: string
  total: number
  subtotal?: number
  discount?: number
  taxAmount?: number
  status: "paid" | "pending" | "returned"
  paymentMethod: "cash" | "upi" | "card" | "credit"
  items: SaleItem[]
  createdAt?: string
}

interface DateGroup {
  date: string // "YYYY-MM-DD"
  displayDate: string // "DD/MM/YYYY"
  relativeLabel: string | null // "Today" | "Yesterday" | null
  sales: Sale[]
  totalInvoices: number
  totalUnits: number
  totalAmount: number
  customerNames: string[]
}

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  pending: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  returned: "bg-destructive/10 text-destructive border border-destructive/30",
}

const METHOD_STYLE: Record<string, string> = {
  cash: "border-green-500/30 text-green-400 bg-green-500/5",
  upi: "border-blue-500/30 text-blue-400 bg-blue-500/5",
  card: "border-purple-500/30 text-purple-400 bg-purple-500/5",
  credit: "border-amber-500/30 text-amber-400 bg-amber-500/5",
}

function formatToDDMMYYYY(dateStr: string): string {
  if (!dateStr) return dateStr
  if (dateStr.includes("T")) dateStr = dateStr.split("T")[0]
  if (!dateStr.includes("-")) return dateStr
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

function cleanIndianPhone(rawPhone?: string): string | null {
  if (!rawPhone) return null
  const digits = rawPhone.replace(/\D/g, "")
  if (digits.length === 10) return digits
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1)
  if (digits.length > 10) return digits.slice(-10)
  return null
}

export default function SalesHistoryPage() {
  const router = useRouter()
  const { user } = useUser()

  const [sales, setSales] = React.useState<Sale[]>([])
  const [loading, setLoading] = React.useState(true)
  const [expandedDates, setExpandedDates] = React.useState<Set<string>>(new Set())
  const [expandedSaleIds, setExpandedSaleIds] = React.useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = React.useState("")

  // Date Stepper State: Defaults to Today (e.g. "2026-11-12") or "ALL"
  const todayStr = React.useMemo(() => new Date().toISOString().split("T")[0], [])
  const [selectedDate, setSelectedDate] = React.useState<string | "ALL">(todayStr)

  // Export Modal State
  const [isExportOpen, setIsExportOpen] = React.useState(false)
  const [exportData, setExportData] = React.useState<{
    title: string
    subtitle: string
    filename: string
    headers: string[]
    rows: (string | number)[][]
    summary?: { label: string; value: string }[]
  } | null>(null)

  // Fetch sales from MongoDB API
  React.useEffect(() => {
    if (!user?.uid) return
    setLoading(true)
    fetch("/api/sales", { headers: { "x-user-id": user.uid } })
      .then(res => (res.ok ? res.json() : []))
      .then((data: Sale[]) => setSales(Array.isArray(data) ? data : []))
      .catch(() => setSales([]))
      .finally(() => setLoading(false))
  }, [user?.uid])

  // Native PDF blob fallback generator
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
      const x = margin + idx * colWidth + 4
      stream += `BT /F2 8.5 Tf 0.1 0.2 0.35 rg ${x} ${currentY} Td (${esc(h)}) Tj ET\n`
    })

    currentY -= 16

    rows.forEach((row, rowIdx) => {
      if (currentY < margin + 60) return
      if (rowIdx % 2 === 1) {
        stream += `0.98 0.98 0.99 rg ${margin} ${currentY - 3} ${contentWidth} 14 re f\n`
      }
      row.forEach((cell, colIdx) => {
        const x = margin + colIdx * colWidth + 4
        stream += `BT /F1 8 Tf 0.15 0.2 0.25 rg ${x} ${currentY} Td (${esc(cell)}) Tj ET\n`
      })
      currentY -= 14
    })

    if (summary && summary.length > 0 && currentY > margin + 40) {
      currentY -= 10
      stream += `0.8 0.85 0.9 RG 0.5 w ${margin} ${currentY} m ${pageWidth - margin} ${currentY} l S\n`
      currentY -= 14
      summary.forEach(s => {
        stream += `BT /F2 8.5 Tf 0.1 0.2 0.35 rg ${margin + 4} ${currentY} Td (${esc(s.label)}: ${esc(s.value)}) Tj ET\n`
        currentY -= 12
      })
    }

    const objects = [
      `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
      `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n`,
      `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`,
      `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
      `6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`,
    ]

    let body = ""
    const xref = ["xref\n0 7\n0000000000 65535 f \n"]
    const enc = new TextEncoder()
    const header = "%PDF-1.4\n"
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
      ...rows.map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")),
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
    const safeFilename = filename || `Sales_${new Date().toISOString().split("T")[0]}`

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
          headStyles: { fillColor: [59, 130, 246] },
          styles: { fontSize: 8.5 },
        })

        if (summary && summary.length > 0) {
          const finalY = (doc as any).lastAutoTable.finalY + 8
          summary.forEach((s, idx) => {
            doc.setFontSize(9)
            doc.setTextColor(30, 41, 59)
            doc.text(`${s.label}: ${String(s.value).replace(/₹/g, "Rs. ")}`, 14, finalY + idx * 5.5)
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

  // ── Overall Stats ──
  const totalInvoicesCount = sales.length
  const totalRevenueAmount = React.useMemo(() => sales.reduce((acc, s) => acc + (s.total || 0), 0), [sales])
  const totalUnitsSoldCount = React.useMemo(() => {
    return sales.reduce((acc, s) => {
      const itemsQty = (s.items || []).reduce((iq, it) => iq + (Number(it.quantity) || 1), 0)
      return acc + itemsQty
    }, 0)
  }, [sales])

  const todaySalesList = React.useMemo(() => {
    return sales.filter(s => {
      const d = s.date?.split("T")[0]
      return d === todayStr
    })
  }, [sales, todayStr])

  const todayRevenueAmount = React.useMemo(() => {
    return todaySalesList.reduce((acc, s) => acc + (s.total || 0), 0)
  }, [todaySalesList])

  // ── Group sales by Date, latest on top ──
  const dateGroups = React.useMemo((): DateGroup[] => {
    const map: Record<string, DateGroup> = {}

    sales.forEach(sale => {
      const d = sale.date?.split("T")[0] || "Unknown"
      if (!map[d]) {
        map[d] = {
          date: d,
          displayDate: formatToDDMMYYYY(d),
          relativeLabel: getRelativeDateLabel(d),
          sales: [],
          totalInvoices: 0,
          totalUnits: 0,
          totalAmount: 0,
          customerNames: [],
        }
      }

      map[d].sales.push(sale)
      map[d].totalInvoices += 1
      map[d].totalAmount += sale.total || 0

      const itemsQty = (sale.items || []).reduce((iq, it) => iq + (Number(it.quantity) || 1), 0)
      map[d].totalUnits += itemsQty
    })

    // Collect distinct customer names per date
    Object.values(map).forEach(g => {
      const names = Array.from(new Set(g.sales.map(s => s.customerName || "Walk-in"))).slice(0, 3)
      g.customerNames = names
    })

    // Sort groups: latest date first
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date))
  }, [sales])

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
        sales: g.sales.filter(s => {
          const billNo = (s.billNumber || s.id.slice(-6)).toLowerCase()
          const custName = (s.customerName || "").toLowerCase()
          const custPhone = (s.customerPhone || "").toLowerCase()
          const method = (s.paymentMethod || "").toLowerCase()
          const hasItem = (s.items || []).some(
            it =>
              (it.productName || "").toLowerCase().includes(q) ||
              (it.sku || "").toLowerCase().includes(q)
          )

          return (
            custName.includes(q) ||
            custPhone.includes(q) ||
            billNo.includes(q) ||
            method.includes(q) ||
            hasItem ||
            g.date.includes(q) ||
            g.displayDate.includes(q)
          )
        }),
      }))
      .filter(g => g.sales.length > 0)
      .map(g => ({
        ...g,
        totalInvoices: g.sales.length,
        totalAmount: g.sales.reduce((acc, s) => acc + (s.total || 0), 0),
        totalUnits: g.sales.reduce(
          (acc, s) => acc + (s.items || []).reduce((iq, it) => iq + (Number(it.quantity) || 1), 0),
          0
        ),
        customerNames: Array.from(new Set(g.sales.map(s => s.customerName || "Walk-in"))).slice(0, 3),
      }))
  }, [dateGroups, searchQuery])

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

  const toggleExpandSale = (id: string) => {
    setExpandedSaleIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // WhatsApp Share for specific sale
  const handleShareSaleWhatsApp = (sale: Sale) => {
    const cleanPhone = cleanIndianPhone(sale.customerPhone)
    if (!cleanPhone) {
      toast({
        variant: "destructive",
        title: "No Phone Number",
        description: "Customer does not have a 10-digit Indian phone number recorded.",
      })
      return
    }

    const divider = "──────────────────────────"
    let text = `*🧾 SALES INVOICE*\n`
    text += `${divider}\n`
    text += `*Bill No:* #${sale.billNumber || sale.id.slice(-6).toUpperCase()}\n`
    text += `*Date:* ${formatToDDMMYYYY(sale.date)}\n`
    text += `*Customer:* ${sale.customerName}\n`
    text += `${divider}\n`
    text += `*ITEMS:*\n`

    ;(sale.items || []).forEach((it, idx) => {
      const line = (it.quantity || 1) * (it.price || 0) + (it.taxAmount || 0)
      text += `${idx + 1}. *${it.productName}*\n`
      text += `   ${it.quantity} x ₹${it.price.toLocaleString()} = *₹${line.toLocaleString()}*\n`
    })

    text += `${divider}\n`
    text += `*Total Amount:* *₹${(sale.total || 0).toLocaleString()}*\n`
    text += `*Payment Method:* ${(sale.paymentMethod || "cash").toUpperCase()}\n`
    text += `*Status:* ${(sale.status || "paid").toUpperCase()}\n`
    text += `${divider}\n`
    text += `Thank you for your purchase! 🙏`

    const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(text)}`
    window.open(waUrl, "_blank")
    toast({ title: "WhatsApp Opened", description: `Sharing invoice with +91 ${cleanPhone}` })
  }

  // Export All Sales
  const handleExportAll = () => {
    const headers = [
      "#",
      "Bill No",
      "Customer",
      "Phone",
      "Date",
      "Payment Mode",
      "Status",
      "Items Count",
      "Total Amount (₹)",
    ]
    const rows = sales.map((s, idx) => {
      const itemsQty = (s.items || []).reduce((iq, it) => iq + (Number(it.quantity) || 1), 0)
      return [
        idx + 1,
        `#${s.billNumber || s.id.slice(-6).toUpperCase()}`,
        s.customerName || "Walk-in Customer",
        s.customerPhone ? `+91 ${s.customerPhone}` : "—",
        formatToDDMMYYYY(s.date),
        (s.paymentMethod || "cash").toUpperCase(),
        (s.status || "paid").toUpperCase(),
        `${itemsQty} items`,
        `₹${(s.total || 0).toLocaleString()}`,
      ]
    })

    setExportData({
      title: "All Sales History",
      subtitle: `Total ${totalInvoicesCount} sales invoices (${totalUnitsSoldCount} items sold) recorded in ShopX`,
      filename: `Sales_All_${todayStr}`,
      headers,
      rows,
      summary: [
        { label: "Total Invoices", value: String(totalInvoicesCount) },
        { label: "Total Units Sold", value: String(totalUnitsSoldCount) },
        { label: "Gross Revenue", value: `₹${totalRevenueAmount.toLocaleString()}` },
      ],
    })
    setIsExportOpen(true)
  }

  // Export Single Date Group
  const handleExportGroup = (group: DateGroup) => {
    const headers = [
      "#",
      "Bill No",
      "Customer",
      "Phone",
      "Time",
      "Payment Mode",
      "Status",
      "Items Count",
      "Total Amount (₹)",
    ]
    const rows = group.sales.map((s, idx) => {
      const itemsQty = (s.items || []).reduce((iq, it) => iq + (Number(it.quantity) || 1), 0)
      const timeStr = s.date?.includes("T")
        ? new Date(s.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
        : "—"

      return [
        idx + 1,
        `#${s.billNumber || s.id.slice(-6).toUpperCase()}`,
        s.customerName || "Walk-in Customer",
        s.customerPhone ? `+91 ${s.customerPhone}` : "—",
        timeStr,
        (s.paymentMethod || "cash").toUpperCase(),
        (s.status || "paid").toUpperCase(),
        `${itemsQty} items`,
        `₹${(s.total || 0).toLocaleString()}`,
      ]
    })

    setExportData({
      title: `Sales — ${group.displayDate} ${group.relativeLabel ? `(${group.relativeLabel})` : ""}`,
      subtitle: `Day Revenue: ₹${group.totalAmount.toLocaleString()} • ${group.totalUnits} items across ${group.sales.length} invoices`,
      filename: `Sales_${group.date}`,
      headers,
      rows,
      summary: [
        { label: "Date", value: `${group.displayDate} (${group.date})` },
        { label: "Total Invoices", value: String(group.sales.length) },
        { label: "Total Units Sold", value: String(group.totalUnits) },
        { label: "Day Total Revenue", value: `₹${group.totalAmount.toLocaleString()}` },
      ],
    })
    setIsExportOpen(true)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16">
      {/* ── 1. HEADER ── */}
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
              Sales <span className="text-primary">History</span>
            </h1>
            <p className="text-muted-foreground text-sm">
              All customer sales grouped by billing date — invoice totals, items &amp; WhatsApp share.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAll}
            className="h-9 px-3 text-xs font-bold gap-1.5 rounded-xl border-border/60 hover:bg-secondary/60 hover:text-primary shadow-sm"
          >
            <Download className="w-4 h-4 text-primary" />
            <span>Export History</span>
          </Button>
          <Button
            onClick={() => router.push("/sales/new")}
            className="h-9 px-4 text-xs font-bold bg-primary text-primary-foreground hover:brightness-110 rounded-xl shadow-sm gap-1.5"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>+ New Bill</span>
          </Button>
        </div>
      </div>

      {/* ── 2. STATS CARDS ── */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Today's Sales</p>
              <p className="text-xl font-bold font-headline text-primary">₹{todayRevenueAmount.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/10 p-2.5 rounded-xl">
              <Receipt className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Invoices</p>
              <p className="text-xl font-bold font-headline">{totalInvoicesCount}</p>
            </div>
          </div>
        </Card>

        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-purple-500/10 p-2.5 rounded-xl">
              <Package className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Units Sold</p>
              <p className="text-xl font-bold font-headline">{totalUnitsSoldCount}</p>
            </div>
          </div>
        </Card>

        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2.5 rounded-xl">
              <IndianRupee className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Gross Revenue</p>
              <p className="text-xl font-bold font-headline text-emerald-400">₹{totalRevenueAmount.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── 3. DATE STEPPER & FILTER BAR ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card border border-border/60 p-3 rounded-2xl shadow-sm">
        {/* Left: Interactive Date Stepper `< Date >` */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-secondary/30 border border-border/50 rounded-xl p-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => stepDate(-1)}
              className="h-8 w-8 rounded-lg hover:bg-secondary text-foreground hover:text-primary shrink-0"
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
                  <span className="text-xs font-bold font-code text-primary">All Dates</span>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-xs font-bold font-code text-foreground">
                      {formatToDDMMYYYY(selectedDate)}
                    </span>
                    {getRelativeDateLabel(selectedDate) && (
                      <Badge className="text-[9px] bg-primary/20 text-primary hover:bg-primary/30 px-1.5 py-0 h-4 font-bold">
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
              className="h-8 w-8 rounded-lg hover:bg-secondary text-foreground hover:text-primary disabled:opacity-20 shrink-0"
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
                  ? "bg-primary text-primary-foreground shadow-sm"
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
                className="h-9 px-2.5 text-xs font-bold rounded-xl border-border/60 hover:bg-secondary/60 text-primary"
              >
                Today
              </Button>
            )}
          </div>
        </div>

        {/* Right: Search Input (text-base prevents mobile keyboard auto-zoom) */}
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search bill no, customer, phone, item..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-secondary/30 border-border/40 rounded-xl text-base sm:text-sm focus-visible:ring-primary"
          />
        </div>
      </div>

      {/* ── 4. DATE GROUPS LISTING (ACCORDION CARDS) ── */}
      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
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
                  ? "No sales transactions found"
                  : `No sales recorded on ${formatToDDMMYYYY(selectedDate)}${
                      getRelativeDateLabel(selectedDate) ? ` (${getRelativeDateLabel(selectedDate)})` : ""
                    }`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedDate === "ALL"
                  ? "No sales records match your search filter."
                  : "Click '<' to view earlier days, jump to 'All Dates', or create a new sale."}
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
                onClick={() => router.push("/sales/new")}
                className="text-xs font-bold bg-primary text-primary-foreground rounded-xl"
              >
                + Create New Bill
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {displayedGroups.map(group => {
            const isExpanded = expandedDates.has(group.date)
            const isToday = group.date === todayStr

            return (
              <Card
                key={group.date}
                className={`border-none shadow-md overflow-hidden transition-all ${
                  isToday ? "ring-1 ring-primary/40" : ""
                }`}
              >
                {/* Accordion Header (Date Group) */}
                <button
                  type="button"
                  onClick={() => toggleDate(group.date)}
                  className="w-full text-left"
                >
                  <div
                    className={`flex items-center justify-between gap-3 px-4 sm:px-6 py-4 transition-colors hover:bg-secondary/20 ${
                      isExpanded ? "bg-secondary/20 border-b border-border/50" : "bg-card"
                    }`}
                  >
                    {/* Left: Date + Relative Badge + Customers Preview */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2.5 rounded-xl shrink-0 ${isToday ? "bg-primary/20" : "bg-secondary/40"}`}>
                        <Calendar className={`w-4 h-4 ${isToday ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`font-bold font-code text-base sm:text-lg ${
                              isToday ? "text-primary" : "text-foreground"
                            }`}
                          >
                            {group.displayDate}
                          </span>
                          {group.relativeLabel && (
                            <Badge
                              className={`text-[9px] px-2 py-0.5 h-5 font-bold ${
                                isToday
                                  ? "bg-primary/20 text-primary hover:bg-primary/30"
                                  : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                              }`}
                            >
                              {group.relativeLabel}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground font-code hidden sm:inline">
                            ({new Date(group.date).toLocaleDateString("en-IN", { weekday: "short" })})
                          </span>
                        </div>
                        {/* Customer preview */}
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {group.customerNames.length > 0
                            ? group.customerNames.join(" · ")
                            : "Walk-in customers"}
                          {group.customerNames.length >= 3 && " ···"}
                        </p>
                      </div>
                    </div>

                    {/* Right: Summary Stats + Toggle Icon */}
                    <div className="flex items-center gap-3 sm:gap-5 shrink-0">
                      {/* Total Invoices */}
                      <div className="text-center hidden sm:block">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Invoices</p>
                        <p className="font-bold text-sm font-code">{group.totalInvoices}</p>
                      </div>
                      {/* Total Units */}
                      <div className="text-center hidden sm:block">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Units</p>
                        <p className="font-bold text-sm font-code">{group.totalUnits}</p>
                      </div>
                      {/* Day Total Amount */}
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Day Total</p>
                        <p
                          className={`font-bold text-base sm:text-lg font-code ${
                            isToday ? "text-primary" : "text-emerald-400"
                          }`}
                        >
                          ₹{group.totalAmount.toLocaleString()}
                        </p>
                      </div>
                      {/* Toggle icon */}
                      <div
                        className={`p-1.5 rounded-lg transition-colors ${
                          isExpanded ? "bg-primary/20 text-primary" : "bg-secondary/40 text-muted-foreground"
                        }`}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                </button>

                {/* ── EXPANDED SALES INVOICE TABLE ── */}
                {isExpanded && (
                  <CardContent className="p-0">
                    {/* Header bar inside expanded section with export day button */}
                    <div className="px-4 py-2.5 bg-secondary/10 border-b border-border/30 flex items-center justify-between gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span>
                          <span className="font-bold text-foreground">{group.sales.length}</span> invoices
                        </span>
                        <span>•</span>
                        <span>
                          <span className="font-bold text-foreground">{group.totalUnits}</span> items sold
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px] font-bold gap-1 text-primary hover:bg-primary/10 px-2"
                        onClick={e => {
                          e.stopPropagation()
                          handleExportGroup(group)
                        }}
                      >
                        <Download className="w-3 h-3" />
                        Export Day
                      </Button>
                    </div>

                    <div className="overflow-x-auto w-full">
                      <Table className="min-w-[720px] w-full">
                        <TableHeader className="bg-secondary/10">
                          <TableRow className="border-border/30 hover:bg-transparent">
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 pl-4 w-[35px]" />
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 w-[110px]">
                              Bill No
                            </TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3">
                              Customer
                            </TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-center w-[90px]">
                              Method
                            </TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-center w-[90px]">
                              Status
                            </TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-center w-[90px]">
                              Items
                            </TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-right w-[110px]">
                              Total (₹)
                            </TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-center pr-4 w-[80px]">
                              Share
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.sales.map((sale, i) => {
                            const isSaleExpanded = expandedSaleIds.has(sale.id)
                            const itemsQty = (sale.items || []).reduce(
                              (iq, it) => iq + (Number(it.quantity) || 1),
                              0
                            )
                            const billNo = sale.billNumber || sale.id.slice(-6).toUpperCase()

                            return (
                              <React.Fragment key={sale.id || i}>
                                <TableRow
                                  className="border-border/20 hover:bg-secondary/10 transition-colors cursor-pointer"
                                  onClick={() => toggleExpandSale(sale.id)}
                                >
                                  {/* Expand Chevron */}
                                  <TableCell className="py-3 pl-4">
                                    {isSaleExpanded ? (
                                      <ChevronDown className="w-4 h-4 text-primary" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-50" />
                                    )}
                                  </TableCell>

                                  {/* Bill No */}
                                  <TableCell className="py-3">
                                    <span className="font-code text-xs font-bold px-2 py-0.5 rounded bg-secondary/60 text-primary border border-border/40 inline-block">
                                      #{billNo}
                                    </span>
                                  </TableCell>

                                  {/* Customer */}
                                  <TableCell className="py-3">
                                    <p className="font-bold text-xs text-foreground">
                                      {sale.customerName || "Walk-in Customer"}
                                    </p>
                                    {sale.customerPhone && (
                                      <p className="text-[10px] text-muted-foreground font-code">
                                        📞 +91 {sale.customerPhone}
                                      </p>
                                    )}
                                  </TableCell>

                                  {/* Method */}
                                  <TableCell className="py-3 text-center">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "uppercase font-bold text-[9px] tracking-tight px-1.5 py-0.5",
                                        METHOD_STYLE[sale.paymentMethod] || "text-muted-foreground"
                                      )}
                                    >
                                      {sale.paymentMethod}
                                    </Badge>
                                  </TableCell>

                                  {/* Status */}
                                  <TableCell className="py-3 text-center">
                                    <Badge
                                      className={cn(
                                        "text-[9px] font-bold uppercase px-1.5 py-0.5",
                                        STATUS_STYLE[sale.status] || "bg-secondary text-foreground"
                                      )}
                                    >
                                      {sale.status}
                                    </Badge>
                                  </TableCell>

                                  {/* Items Qty */}
                                  <TableCell className="py-3 text-center font-code font-bold text-xs">
                                    <Badge variant="secondary" className="bg-secondary/60 text-xs px-2 py-0.5">
                                      {itemsQty} pcs
                                    </Badge>
                                  </TableCell>

                                  {/* Total Amount */}
                                  <TableCell className="py-3 text-right font-code font-bold text-emerald-400 text-sm">
                                    ₹{(sale.total || 0).toLocaleString()}
                                  </TableCell>

                                  {/* WhatsApp Share Button */}
                                  <TableCell className="py-3 text-center pr-4">
                                    {sale.customerPhone ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg"
                                        onClick={e => {
                                          e.stopPropagation()
                                          handleShareSaleWhatsApp(sale)
                                        }}
                                        title="Share bill on WhatsApp"
                                      >
                                        <Share2 className="w-3.5 h-3.5" />
                                      </Button>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground opacity-30">—</span>
                                    )}
                                  </TableCell>
                                </TableRow>

                                {/* ── EXPANDED ITEM BREAKDOWN ROW ── */}
                                {isSaleExpanded && (
                                  <TableRow className="bg-secondary/5 border-border/30">
                                    <TableCell colSpan={8} className="py-0 px-4 sm:px-8">
                                      <div className="py-3 space-y-2">
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                          <p className="text-[10px] uppercase font-bold tracking-widest text-primary flex items-center gap-1.5">
                                            <Package className="w-3.5 h-3.5" /> Items in Bill #{billNo}
                                          </p>
                                          {sale.discount ? (
                                            <span className="text-[10px] text-destructive font-bold">
                                              Discount: -₹{sale.discount.toLocaleString()}
                                            </span>
                                          ) : null}
                                        </div>

                                        <div className="rounded-xl overflow-hidden border border-border/30 bg-card/60">
                                          <table className="w-full text-xs">
                                            <thead className="bg-secondary/40 border-b border-border/20 text-muted-foreground">
                                              <tr>
                                                <th className="text-left p-2 pl-4 text-[9px] font-bold uppercase">
                                                  Product Name
                                                </th>
                                                <th className="text-center p-2 text-[9px] font-bold uppercase">
                                                  Qty
                                                </th>
                                                <th className="text-right p-2 text-[9px] font-bold uppercase">
                                                  Unit Rate
                                                </th>
                                                <th className="text-right p-2 pr-4 text-[9px] font-bold uppercase">
                                                  Line Total
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {(sale.items || []).map((it, idx) => {
                                                const line =
                                                  (it.quantity || 1) * (it.price || 0) + (it.taxAmount || 0)
                                                return (
                                                  <tr
                                                    key={idx}
                                                    className="border-t border-border/10 hover:bg-secondary/10"
                                                  >
                                                    <td className="p-2 pl-4">
                                                      <span className="font-bold text-foreground">
                                                        {it.productName}
                                                      </span>
                                                      {it.sku && (
                                                        <span className="text-[10px] text-muted-foreground font-code ml-2">
                                                          [{it.sku}]
                                                        </span>
                                                      )}
                                                    </td>
                                                    <td className="p-2 text-center font-bold font-code">
                                                      ×{it.quantity}
                                                    </td>
                                                    <td className="p-2 text-right font-code text-muted-foreground">
                                                      ₹{it.price.toLocaleString()}
                                                    </td>
                                                    <td className="p-2 pr-4 text-right font-bold font-code text-foreground">
                                                      ₹{line.toLocaleString()}
                                                    </td>
                                                  </tr>
                                                )
                                              })}
                                            </tbody>
                                          </table>
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                                          <span>
                                            Time:{" "}
                                            {sale.date
                                              ? new Date(sale.date).toLocaleTimeString("en-IN", {
                                                  hour: "2-digit",
                                                  minute: "2-digit",
                                                })
                                              : "—"}
                                          </span>
                                          {sale.customerPhone && (
                                            <button
                                              type="button"
                                              onClick={e => {
                                                e.stopPropagation()
                                                handleShareSaleWhatsApp(sale)
                                              }}
                                              className="text-emerald-400 hover:underline font-bold flex items-center gap-1"
                                            >
                                              <Share2 className="w-3 h-3" /> Share receipt via WhatsApp
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            )
                          })}

                          {/* ── Day Total Row ── */}
                          <TableRow className="bg-secondary/20 border-t-2 border-border/60 hover:bg-secondary/20 font-bold">
                            <TableCell colSpan={3} className="py-3 pl-5">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Day Total — {group.displayDate}{" "}
                                {group.relativeLabel ? `(${group.relativeLabel})` : ""}
                              </span>
                            </TableCell>
                            <TableCell colSpan={2} />
                            <TableCell className="py-3 text-center">
                              <span className="font-bold font-code text-sm">{group.totalUnits}</span>
                              <span className="text-[10px] text-muted-foreground ml-1">items</span>
                            </TableCell>
                            <TableCell className="py-3 text-right">
                              <span
                                className={`font-bold font-code text-lg ${
                                  isToday ? "text-primary" : "text-emerald-400"
                                }`}
                              >
                                ₹{group.totalAmount.toLocaleString()}
                              </span>
                            </TableCell>
                            <TableCell />
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

      {/* ── 5. EXPORT FORMAT SELECTOR MODAL (PDF / EXCEL / GOOGLE SHEETS) ── */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Download className="w-5 h-5 text-primary" /> Export Sales Data
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Choose the format to export{" "}
              <span className="font-semibold text-foreground">{exportData?.title}</span>:
            </p>
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
                <div className="w-12 h-12 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-foreground">PDF Document</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Download .pdf</span>
              </button>

              {/* Microsoft Excel */}
              <button
                type="button"
                onClick={() => {
                  exportToCSV(exportData.filename, exportData.headers, exportData.rows)
                  setIsExportOpen(false)
                }}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/60 bg-secondary/20 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all text-center group cursor-pointer"
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
                onClick={() => {
                  exportToGoogleSheets(exportData.filename, exportData.headers, exportData.rows)
                  setIsExportOpen(false)
                }}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/60 bg-secondary/20 hover:bg-blue-500/10 hover:border-blue-500/50 transition-all text-center group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-blue-500/15 text-blue-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <ExternalLink className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-foreground">Google Sheets</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Open &amp; Import</span>
              </button>
            </div>
          )}

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
