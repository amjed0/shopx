"use client"

import * as React from "react"
import {
  Truck,
  ArrowLeft,
  Loader2,
  Package,
  ChevronDown,
  ChevronUp,
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

interface DateGroup {
  date: string            // e.g. "2026-11-12"
  displayDate: string     // e.g. "Today" / "Yesterday" / "12 Nov 2026"
  purchases: Purchase[]
  totalQty: number
  totalAmount: number
  productCount: number    // unique product count
  supplierNames: string[] // distinct supplier names on that day
}

function formatDisplayDate(dateStr: string): string {
  const today = new Date().toISOString().split("T")[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
  if (dateStr === today) return "Today"
  if (dateStr === yesterday) return "Yesterday"
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  } catch {
    return dateStr
  }
}

export default function PurchaseHistoryPage() {
  const router = useRouter()
  const { user } = useUser()
  const [purchases, setPurchases] = React.useState<Purchase[]>([])
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([])
  const [loading, setLoading] = React.useState(true)
  const [expandedDates, setExpandedDates] = React.useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = React.useState("")

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

  // Export all purchases
  const handleExportAll = () => {
    const headers = ["Product Name", "Supplier", "Phone", "Billing Date", "Qty", "Cost (₹)", "Subtotal (₹)"]
    const rows = purchases.map(p => {
      const sup = supplierMap.get(p.supplierId)
      const qty = Number(p.quantity) || 1
      const cost = Number(p.purchasePrice) || 0
      return [
        p.productName || "Product",
        sup?.name || "N/A",
        sup?.phone || "N/A",
        p.billingDate || (p.createdAt ? p.createdAt.split("T")[0] : ""),
        qty,
        `₹${cost.toLocaleString()}`,
        `₹${(qty * cost).toLocaleString()}`,
      ]
    })
    setExportData({
      title: "All Purchase History",
      subtitle: `Total ${purchases.length} inward purchases recorded in ShopX`,
      filename: `Purchases_All_${new Date().toISOString().split("T")[0]}`,
      headers,
      rows,
      summary: [
        { label: "Total Purchases", value: String(purchases.length) },
        { label: "Total Units", value: String(totalItems) },
        { label: "Total Spent", value: `₹${totalSpent.toLocaleString()}` },
      ],
    })
    setIsExportOpen(true)
  }

  // Export single date group
  const handleExportGroup = (group: DateGroup) => {
    const headers = ["Product Name", "Supplier", "Phone", "Qty", "Cost (₹)", "Subtotal (₹)"]
    const rows = group.purchases.map(p => {
      const sup = supplierMap.get(p.supplierId)
      const qty = Number(p.quantity) || 1
      const cost = Number(p.purchasePrice) || 0
      return [
        p.productName || "Product",
        sup?.name || "N/A",
        sup?.phone || "N/A",
        qty,
        `₹${cost.toLocaleString()}`,
        `₹${(qty * cost).toLocaleString()}`,
      ]
    })
    setExportData({
      title: `Purchases — ${group.displayDate} (${group.date})`,
      subtitle: `Day Total: ₹${group.totalAmount.toLocaleString()} • ${group.totalQty} units across ${group.purchases.length} items`,
      filename: `Purchases_${group.date}`,
      headers,
      rows,
      summary: [
        { label: "Date", value: group.date },
        { label: "Total Products", value: String(group.purchases.length) },
        { label: "Total Quantity", value: String(group.totalQty) },
        { label: "Day Total", value: `₹${group.totalAmount.toLocaleString()}` },
      ],
    })
    setIsExportOpen(true)
  }

  React.useEffect(() => {
    if (!user?.uid) return
    const fetchAll = async () => {
      try {
        setLoading(true)
        const [purchasesRes, suppliersRes] = await Promise.all([
          fetch("/api/purchases", { headers: { "x-user-id": user.uid } }),
          fetch("/api/suppliers", { headers: { "x-user-id": user.uid } }),
        ])
        if (purchasesRes.ok) {
          const data = await purchasesRes.json()
          setPurchases(Array.isArray(data) ? data : [])
        }
        if (suppliersRes.ok) {
          const data = await suppliersRes.json()
          setSuppliers(Array.isArray(data) ? data : [])
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

  // Auto-expand today's date on first load
  React.useEffect(() => {
    const today = new Date().toISOString().split("T")[0]
    setExpandedDates(new Set([today]))
  }, [])

  const supplierMap = React.useMemo(() => {
    const map = new Map<string, Supplier>()
    suppliers.forEach(s => map.set(s.id, s))
    return map
  }, [suppliers])

  // Group by billing date, latest on top
  const dateGroups = React.useMemo((): DateGroup[] => {
    const map: Record<string, DateGroup> = {}

    purchases.forEach(p => {
      const date = p.billingDate || (p.createdAt ? p.createdAt.split("T")[0] : "Unknown")
      if (!map[date]) {
        map[date] = {
          date,
          displayDate: formatDisplayDate(date),
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
  }, [purchases, supplierMap])

  // Apply search filter across date groups
  const filteredGroups = React.useMemo((): DateGroup[] => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return dateGroups

    return dateGroups
      .map(g => ({
        ...g,
        purchases: g.purchases.filter(p => {
          const sup = supplierMap.get(p.supplierId)
          return (
            p.productName.toLowerCase().includes(q) ||
            (sup && sup.name.toLowerCase().includes(q)) ||
            g.date.includes(q)
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
  }, [dateGroups, searchQuery, supplierMap])

  const toggleDate = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const totalSpent = React.useMemo(() =>
    purchases.reduce((acc, p) => acc + (Number(p.quantity) || 0) * (Number(p.purchasePrice) || 0), 0),
  [purchases])

  const totalItems = React.useMemo(() =>
    purchases.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0),
  [purchases])

  const todayTotal = React.useMemo(() => {
    const today = new Date().toISOString().split("T")[0]
    const todayGroup = dateGroups.find(g => g.date === today)
    return todayGroup?.totalAmount ?? 0
  }, [dateGroups])

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
            <p className="text-muted-foreground text-sm">All inward purchases grouped by billing date — latest first.</p>
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
              <p className="text-xl font-bold font-headline">{purchases.length}</p>
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

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search product, supplier, date..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-secondary/30 border-none rounded-xl text-sm"
          />
        </div>
        <p className="text-xs text-muted-foreground font-code hidden sm:block shrink-0">
          {filteredGroups.length} date{filteredGroups.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Date Groups */}
      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-10 h-10 animate-spin text-accent opacity-50" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <Card className="border-none bg-card shadow-sm">
          <div className="flex flex-col items-center gap-3 py-24 opacity-30">
            <Package className="w-12 h-12" />
            <p className="font-semibold">No purchase history found.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map(group => {
            const isExpanded = expandedDates.has(group.date)
            const isToday = group.date === new Date().toISOString().split("T")[0]

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
                    
                    {/* Left: Date + badge */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2.5 rounded-xl shrink-0 ${isToday ? "bg-accent/20" : "bg-secondary/40"}`}>
                        <Calendar className={`w-4 h-4 ${isToday ? "text-accent" : "text-muted-foreground"}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-bold text-base sm:text-lg ${isToday ? "text-accent" : "text-foreground"}`}>
                            {group.displayDate}
                          </span>
                          {isToday && (
                            <Badge className="text-[9px] bg-accent/20 text-accent hover:bg-accent/30 px-2 py-0.5 h-5">
                              Today
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground font-code hidden sm:inline">
                            {group.date}
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
                      {/* Total Amount — always visible */}
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
                      <Table className="min-w-[640px]">
                        <TableHeader className="bg-secondary/10">
                          <TableRow className="border-border/30 hover:bg-transparent">
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 pl-5">#</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3">Product Name</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3">Supplier / Vendor</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-center w-[80px]">Qty</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-right w-[120px]">Purchase Cost</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-right pr-5 w-[120px]">Subtotal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.purchases.map((p, i) => {
                            const sup = supplierMap.get(p.supplierId)
                            return (
                              <TableRow
                                key={p.id || i}
                                className="border-border/20 hover:bg-secondary/10 transition-colors"
                              >
                                <TableCell className="py-3 pl-5 text-xs text-muted-foreground font-code">
                                  {i + 1}
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
                            <TableCell colSpan={3} className="py-3 pl-5">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Day Total — {group.displayDate}
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

      {/* ── EXPORT FORMAT SELECTOR MODAL (PDF / EXCEL / GOOGLE SHEETS) ── */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Download className="w-5 h-5 text-accent" /> Export Data
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Choose the format to export <span className="font-semibold text-foreground">{exportData?.title}</span>:
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
