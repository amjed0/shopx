"use client"

import * as React from "react"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Receipt,
  Calendar,
  Download,
  Loader2,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useUser } from "@/app/auth/use-user"
import { useShop } from "@/hooks/useShop"

// ── TYPES ──
interface PLSummary {
  totalRevenue: number
  totalPurchaseOrders: number
  totalExpenses: number
  grossProfit: number
  netProfit: number
  revenueBreakdown: { label: string; amount: number; date: string }[]
  expenseBreakdown: { label: string; amount: number; type: string; date: string }[]
}

// ── DATE / MONEY HELPERS ──
const toInputDate = (d: Date) => d.toISOString().slice(0, 10)

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)

const formatDate = (s: string) =>
  new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })

// PDF default fonts cannot draw the ₹ symbol, so exports use "Rs."
const fmtPlain = (n: number) =>
  `Rs. ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n)}`

const fmtSigned = (n: number) => (n < 0 ? `- ${fmtPlain(Math.abs(n))}` : fmtPlain(n))

const fmtDateSafe = (s: string) => {
  const d = new Date(s)
  return isNaN(d.getTime())
    ? String(s ?? "")
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

// ══════════════════════════════════════════════════════════════════════════════
//  EXPORT ENGINE  (PDF via jsPDF, Excel via SheetJS, with safe fallbacks)
// ══════════════════════════════════════════════════════════════════════════════
const JSPDF_CDN     = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
const AUTOTABLE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"
const XLSX_CDN      = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"

const scriptCache: Record<string, Promise<void>> = {}
function loadScript(src: string): Promise<void> {
  if (!scriptCache[src]) {
    scriptCache[src] = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script")
      s.src = src
      s.async = true
      const timer = setTimeout(() => reject(new Error("Script load timed out")), 10000)
      s.onload = () => { clearTimeout(timer); resolve() }
      s.onerror = () => { clearTimeout(timer); reject(new Error("Script failed to load")) }
      document.head.appendChild(s)
    }).catch(err => {
      delete scriptCache[src]
      throw err
    })
  }
  return scriptCache[src]
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  setTimeout(() => {
    if (document.body.contains(link)) document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, 2000)
}

interface SummaryRow {
  label: string
  amount: number
  type: "row" | "subtotal" | "total"
}

function buildExportModel(
  data: PLSummary,
  fromDate: string,
  toDate: string,
  companyName: string,
  companyContact: string,
) {
  const safeCompany = companyName.replace(/[^a-zA-Z0-9_-]/g, "_")
  const generated = new Date().toLocaleDateString("en-IN", { dateStyle: "long" })
  const margin = data.totalRevenue > 0 ? (data.netProfit / data.totalRevenue) * 100 : 0

  const summaryRows: SummaryRow[] = [
    { label: "Total Revenue",        amount: data.totalRevenue,          type: "row" },
    { label: "Less: Purchase Orders", amount: -data.totalPurchaseOrders, type: "row" },
    { label: "Gross Profit",         amount: data.grossProfit,           type: "subtotal" },
    { label: "Less: Other Expenses", amount: -data.totalExpenses,        type: "row" },
    { label: "Net Profit / Loss",    amount: data.netProfit,             type: "total" },
  ]

  return {
    fromDate,
    toDate,
    title: `${companyName} - Profit & Loss Statement`,
    subtitle: `${fmtDateSafe(fromDate)} to ${fmtDateSafe(toDate)}${companyContact ? ` | ${companyContact}` : ""} | Generated ${generated}`,
    filename: `${safeCompany}_PL_${fromDate}_to_${toDate}`,
    kpis: [
      { label: "Total Revenue",   text: fmtPlain(data.totalRevenue),        value: data.totalRevenue },
      { label: "Purchase Orders", text: fmtPlain(data.totalPurchaseOrders), value: data.totalPurchaseOrders },
      { label: "Gross Profit",    text: fmtSigned(data.grossProfit),        value: data.grossProfit },
      { label: "Other Expenses",  text: fmtPlain(data.totalExpenses),       value: data.totalExpenses },
      { label: "Net Profit",      text: fmtSigned(data.netProfit),          value: data.netProfit },
      { label: "Net Margin",      text: `${margin.toFixed(1)}%`,            value: Number(margin.toFixed(1)) },
    ],
    summaryRows,
    income: data.revenueBreakdown || [],
    expenses: data.expenseBreakdown || [],
    totalIncome: data.totalRevenue,
    totalExpensesAll: data.totalPurchaseOrders + data.totalExpenses,
  }
}
type ExportModel = ReturnType<typeof buildExportModel>

// ── Minimal built-in PDF (single page) used only if the CDN is unreachable ───
function buildFallbackPdf(
  title: string, subtitle: string,
  headers: string[], rows: string[][],
): Blob {
  const pageWidth = 595.28, pageHeight = 841.89, margin = 36
  const contentWidth = pageWidth - margin * 2
  const esc = (t: any) =>
    String(t ?? "")
      .replace(/[^\x20-\x7E]/g, "?")
      .replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")

  let stream = ""
  stream += `BT /F2 15 Tf 0.05 0.1 0.2 rg ${margin} ${pageHeight - margin - 16} Td (${esc(title)}) Tj ET\n`
  stream += `BT /F1 8 Tf 0.4 0.45 0.5 rg ${margin} ${pageHeight - margin - 30} Td (${esc(subtitle)}) Tj ET\n`

  const colWidth = contentWidth / Math.max(1, headers.length)
  let y = pageHeight - margin - 52
  stream += `0.12 0.23 0.37 rg ${margin} ${y - 4} ${contentWidth} 16 re f\n`
  headers.forEach((h, i) => {
    stream += `BT /F2 8.5 Tf 1 1 1 rg ${margin + i * colWidth + 4} ${y} Td (${esc(h)}) Tj ET\n`
  })
  y -= 16
  rows.forEach((row, ri) => {
    if (y < margin) return
    if (ri % 2 === 1) stream += `0.97 0.97 0.99 rg ${margin} ${y - 3} ${contentWidth} 13 re f\n`
    row.forEach((cell, ci) => {
      stream += `BT /F1 8 Tf 0.15 0.2 0.25 rg ${margin + ci * colWidth + 4} ${y} Td (${esc(cell)}) Tj ET\n`
    })
    y -= 13
  })

  const objects = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n`,
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`,
    `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
    `6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`,
  ]
  const enc = new TextEncoder()
  const header = "%PDF-1.4\n"
  let offset = enc.encode(header).length
  let body = ""
  const xref = ["xref\n0 7\n0000000000 65535 f \n"]
  objects.forEach(o => {
    xref.push(`${String(offset).padStart(10, "0")} 00000 n \n`)
    body += o
    offset += enc.encode(o).length
  })
  const trailer = `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`
  return new Blob([enc.encode(header + body + xref.join("") + trailer)], { type: "application/pdf" })
}

// ── PDF export ────────────────────────────────────────────────────────────────
async function exportPLPDF(m: ExportModel) {
  try {
    await loadScript(JSPDF_CDN)
    await loadScript(AUTOTABLE_CDN)
    const jsPDF = (window as any).jspdf?.jsPDF
    if (!jsPDF) throw new Error("jsPDF not available")

    const doc = new jsPDF()
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()

    doc.setFontSize(16)
    doc.setTextColor(15, 23, 42)
    doc.text(m.title, 14, 16)
    doc.setFontSize(8.5)
    doc.setTextColor(100, 116, 139)
    doc.text(m.subtitle, 14, 22)

    // KPI strip
    ;(doc as any).autoTable({
      startY: 27,
      head: [m.kpis.map(k => k.label)],
      body: [m.kpis.map(k => k.text)],
      theme: "grid",
      headStyles: { fillColor: [232, 240, 254], textColor: [85, 85, 85], fontSize: 7, halign: "center" },
      bodyStyles: { fontSize: 8.5, fontStyle: "bold", textColor: [30, 58, 95], halign: "center" },
      styles: { lineColor: [210, 220, 235], lineWidth: 0.2 },
    })

    // Summary (the P&L statement itself)
    let y = (doc as any).lastAutoTable.finalY + 9
    doc.setFontSize(11)
    doc.setTextColor(30, 58, 95)
    doc.text("Profit & Loss Summary", 14, y)

    const types = m.summaryRows.map(r => r.type)
    ;(doc as any).autoTable({
      startY: y + 3,
      head: [["Description", "Amount"]],
      body: m.summaryRows.map(r => [r.label, fmtSigned(r.amount)]),
      theme: "plain",
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 8.5 },
      styles: { fontSize: 9, cellPadding: 2.4, lineColor: [235, 235, 235], lineWidth: { bottom: 0.2 } },
      columnStyles: { 0: { cellWidth: 120 }, 1: { halign: "right" } },
      didParseCell: (h: any) => {
        if (h.section !== "body") return
        const t = types[h.row.index]
        const st = h.cell.styles
        if (t === "subtotal") {
          st.fillColor = [219, 234, 254]; st.textColor = [30, 58, 95]; st.fontStyle = "bold"
        } else if (t === "total") {
          st.fillColor = [30, 58, 95]; st.textColor = [255, 255, 255]; st.fontStyle = "bold"
        }
      },
    })

    // Income
    y = (doc as any).lastAutoTable.finalY + 9
    if (y > pageH - 40) { doc.addPage(); y = 18 }
    doc.setFontSize(11)
    doc.setTextColor(30, 58, 95)
    doc.text(`Income (${fmtPlain(m.totalIncome)})`, 14, y)
    ;(doc as any).autoTable({
      startY: y + 3,
      head: [["Description", "Date", "Amount"]],
      body: m.income.length
        ? m.income.map(r => [r.label, fmtDateSafe(r.date), fmtPlain(r.amount)])
        : [[{ content: "No income in this period", colSpan: 3, styles: { halign: "center" } }]],
      theme: "striped",
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 8.5 },
      columnStyles: { 2: { halign: "right" } },
    })

    // Expenses
    y = (doc as any).lastAutoTable.finalY + 9
    if (y > pageH - 40) { doc.addPage(); y = 18 }
    doc.setFontSize(11)
    doc.setTextColor(30, 58, 95)
    doc.text(`Expenses (${fmtPlain(m.totalExpensesAll)})`, 14, y)
    ;(doc as any).autoTable({
      startY: y + 3,
      head: [["Description", "Type", "Date", "Amount"]],
      body: m.expenses.length
        ? m.expenses.map(e => [e.label, (e.type || "").toUpperCase(), fmtDateSafe(e.date), fmtPlain(e.amount)])
        : [[{ content: "No expenses in this period", colSpan: 4, styles: { halign: "center" } }]],
      theme: "striped",
      headStyles: { fillColor: [220, 38, 38] },
      styles: { fontSize: 8.5 },
      columnStyles: { 3: { halign: "right" } },
    })

    // Page numbers
    const pages = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(`Page ${i} of ${pages}`, pageW - 14, pageH - 8, { align: "right" })
    }

    doc.save(`${m.filename}.pdf`)
    return
  } catch (err) {
    console.warn("jsPDF unavailable, using built-in PDF fallback:", err)
  }

  // Fallback: simple single-page PDF with the summary only
  const blob = buildFallbackPdf(
    m.title, m.subtitle,
    ["Description", "Amount"],
    m.summaryRows.map(r => [r.label, fmtSigned(r.amount)]),
  )
  downloadBlob(blob, `${m.filename}.pdf`)
}

// ── Excel export (.xlsx with 3 sheets; falls back to CSV) ─────────────────────
async function exportPLExcel(m: ExportModel): Promise<"xlsx" | "csv"> {
  const summaryAoa: (string | number)[][] = [
    [m.title],
    [m.subtitle],
    [],
    ["Description", "Amount (INR)"],
    ...m.summaryRows.map(r => [r.label, r.amount]),
    [],
    ["Key Figures"],
    ...m.kpis.map(k => [k.label, k.value]),
  ]
  const incomeAoa: (string | number)[][] = [
    ["Description", "Date", "Amount (INR)"],
    ...m.income.map(r => [r.label, fmtDateSafe(r.date), r.amount]),
    [],
    ["Total Income", "", m.totalIncome],
  ]
  const expenseAoa: (string | number)[][] = [
    ["Description", "Type", "Date", "Amount (INR)"],
    ...m.expenses.map(e => [e.label, (e.type || "").toUpperCase(), fmtDateSafe(e.date), e.amount]),
    [],
    ["Total Expenses (Purchase Orders + Other)", "", "", m.totalExpensesAll],
  ]

  try {
    await loadScript(XLSX_CDN)
    const XLSX = (window as any).XLSX
    if (!XLSX) throw new Error("SheetJS not available")

    const applyMoney = (ws: any, cols: number[]) => {
      const range = XLSX.utils.decode_range(ws["!ref"])
      for (let r = 0; r <= range.e.r; r++) {
        cols.forEach(c => {
          const cell = ws[XLSX.utils.encode_cell({ r, c })]
          if (cell && cell.t === "n") cell.z = "#,##0"
        })
      }
    }

    const wsSum = XLSX.utils.aoa_to_sheet(summaryAoa)
    wsSum["!cols"] = [{ wch: 36 }, { wch: 20 }]
    applyMoney(wsSum, [1])

    const wsInc = XLSX.utils.aoa_to_sheet(incomeAoa)
    wsInc["!cols"] = [{ wch: 34 }, { wch: 16 }, { wch: 18 }]
    applyMoney(wsInc, [2])

    const wsExp = XLSX.utils.aoa_to_sheet(expenseAoa)
    wsExp["!cols"] = [{ wch: 34 }, { wch: 16 }, { wch: 16 }, { wch: 18 }]
    applyMoney(wsExp, [3])

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsSum, "P&L Summary")
    XLSX.utils.book_append_sheet(wb, wsInc, "Income")
    XLSX.utils.book_append_sheet(wb, wsExp, "Expenses")
    XLSX.writeFile(wb, `${m.filename}.xlsx`)
    return "xlsx"
  } catch (err) {
    console.warn("SheetJS unavailable, falling back to CSV:", err)
  }

  // Fallback: one CSV holding all three sections
  const q = (c: unknown) => `"${String(c ?? "").replace(/"/g, '""')}"`
  const toLines = (aoa: (string | number)[][]) => aoa.map(r => r.map(q).join(","))
  const csv = [
    ...toLines(summaryAoa), "",
    "INCOME", ...toLines(incomeAoa), "",
    "EXPENSES", ...toLines(expenseAoa),
  ].join("\r\n")
  downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }), `${m.filename}.csv`)
  return "csv"
}

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function ProfitLossPage() {
  const { user } = useUser()
  const { data: shopData } = useShop(user?.uid)
  const companyName = shopData?.companyName?.trim() || shopData?.ownerName?.trim() || "ShopX"
  const companyContact = [shopData?.location, shopData?.phone].filter(Boolean).join(" | ")

  // ── DATE RANGE STATE ──
  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  const [fromDate, setFromDate] = React.useState(toInputDate(firstOfMonth))
  const [toDate, setToDate] = React.useState(toInputDate(today))
  const [loading, setLoading] = React.useState(false)
  const [data, setData] = React.useState<PLSummary | null>(null)
  const [exporting, setExporting] = React.useState<null | "pdf" | "excel">(null)

  // ── QUICK RANGE PRESETS ──
  const applyPreset = (preset: string) => {
    const now = new Date()
    let from: Date
    switch (preset) {
      case "today":
        from = new Date(now); break
      case "week":
        from = new Date(now); from.setDate(now.getDate() - 7); break
      case "month":
        from = new Date(now.getFullYear(), now.getMonth(), 1); break
      case "quarter":
        from = new Date(now); from.setMonth(now.getMonth() - 3); break
      case "year": {
        // Indian Financial Year (April 1 to March 31)
        const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
        from = new Date(fyStartYear, 3, 1)
        break
      }
      default:
        from = new Date(now.getFullYear(), now.getMonth(), 1)
    }
    setFromDate(toInputDate(from))
    setToDate(toInputDate(now))
  }

  // ── FETCH P&L DATA ──
  const fetchPL = React.useCallback(async () => {
    if (!user?.uid || !fromDate || !toDate) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate })
      const res = await fetch(`/api/pl-statement?${params}`, {
        headers: { "x-user-id": user.uid },
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to fetch P&L data")
      const json: PLSummary = await res.json()
      setData(json)
    } catch (err) {
      console.error(err)
      toast({ variant: "destructive", title: "Error", description: "Could not load P&L data." })
    } finally {
      setLoading(false)
    }
  }, [user?.uid, fromDate, toDate])

  React.useEffect(() => {
    fetchPL()
  }, [fetchPL])

  // ── EXPORT (PDF / EXCEL) ──
  const handleExport = async (type: "pdf" | "excel") => {
    if (!data || exporting) return
    setExporting(type)
    try {
      const model = buildExportModel(data, fromDate, toDate, companyName, companyContact)
      if (type === "pdf") {
        await exportPLPDF(model)
        toast({ title: "PDF Downloaded ✓", description: `Saved ${model.filename}.pdf` })
      } else {
        const kind = await exportPLExcel(model)
        toast({
          title: kind === "xlsx" ? "Excel Downloaded ✓" : "CSV Downloaded ✓",
          description:
            kind === "xlsx"
              ? `Saved ${model.filename}.xlsx`
              : `Excel library could not load, saved ${model.filename}.csv instead.`,
        })
      }
    } catch (e: any) {
      console.error("Export failed:", e)
      toast({
        variant: "destructive",
        title: "Export failed",
        description: e?.message || "Something went wrong while creating the file.",
      })
    } finally {
      setExporting(null)
    }
  }

  const profitColor = (n: number) =>
    n > 0 ? "text-accent" : n < 0 ? "text-destructive" : "text-muted-foreground"

  const profitBg = (n: number) =>
    n > 0 ? "bg-accent/10" : n < 0 ? "bg-destructive/10" : "bg-muted"

  const totalExpensesAll = data
    ? data.totalPurchaseOrders + data.totalExpenses
    : 0

  const marginPct = data && data.totalRevenue > 0
    ? ((data.netProfit / data.totalRevenue) * 100).toFixed(1)
    : "0.0"

  const exportDisabled = !data || loading || !!exporting

  return (
    <div className="space-y-8">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold text-foreground">P&L Statement</h1>
          <p className="text-muted-foreground">Track revenue, expenses and profitability over time.</p>
        </div>

        {/* Export */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              disabled={exportDisabled}
              className="bg-primary text-primary-foreground font-semibold px-5 rounded-full shadow-lg shadow-primary/20 gap-2"
            >
              {exporting
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <Download className="w-4 h-4" />}
              {exporting ? "Exporting…" : "Export"}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport("pdf")} className="gap-2 cursor-pointer">
              <FileText className="w-4 h-4 text-rose-500" /> Download PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("excel")} className="gap-2 cursor-pointer">
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Download Excel (.xlsx)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── DATE RANGE FILTER ── */}
      <Card className="border-none bg-card shadow-sm">
        <CardContent className="pt-5">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
            {/* Quick presets */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Today", key: "today" },
                { label: "7 Days", key: "week" },
                { label: "This Month", key: "month" },
                { label: "3 Months", key: "quarter" },
                { label: "This FY (Apr–Mar)", key: "year" },
              ].map(p => (
                <Button
                  key={p.key}
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-xs h-8 bg-secondary/30 hover:bg-primary/10 hover:text-primary"
                  onClick={() => applyPreset(p.key)}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            {/* Custom range */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 w-full md:w-auto md:ml-auto">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="flex-1 sm:flex-none min-w-[120px] bg-secondary/30 border-none rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-muted-foreground text-xs">to</span>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="flex-1 sm:flex-none min-w-[120px] bg-secondary/30 border-none rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
        </div>
      ) : data ? (
        <>
          {/* ── SUMMARY CARDS ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Revenue */}
            <Card className="border-none bg-card shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Revenue</p>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(data.totalRevenue)}</p>
              <p className="text-[10px] text-muted-foreground">{data.revenueBreakdown.length} transactions</p>
            </Card>

            {/* Total Expenses */}
            <Card className="border-none bg-card shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Expenses</p>
                <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-destructive" />
                </div>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(totalExpensesAll)}</p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary" className="text-[9px] h-4">PO: {formatCurrency(data.totalPurchaseOrders)}</Badge>
              </div>
            </Card>

            {/* Gross Profit */}
            <Card className={cn("border-none shadow-sm p-5 space-y-3", profitBg(data.grossProfit))}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gross Profit</p>
                <div className="w-8 h-8 rounded-full bg-background/50 flex items-center justify-center">
                  <BarChart3 className={cn("w-4 h-4", profitColor(data.grossProfit))} />
                </div>
              </div>
              <p className={cn("text-2xl font-bold", profitColor(data.grossProfit))}>
                {formatCurrency(data.grossProfit)}
              </p>
              <p className="text-[10px] text-muted-foreground">Revenue − Purchase Orders </p>
            </Card>

            {/* Net Profit */}
            <Card className={cn("border-none shadow-sm p-5 space-y-3", profitBg(data.netProfit))}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Net Profit</p>
                <div className="w-8 h-8 rounded-full bg-background/50 flex items-center justify-center">
                  {data.netProfit > 0 ? (
                    <ArrowUpRight className="w-4 h-4 text-accent" />
                  ) : data.netProfit < 0 ? (
                    <ArrowDownRight className="w-4 h-4 text-destructive" />
                  ) : (
                    <Minus className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              <p className={cn("text-2xl font-bold", profitColor(data.netProfit))}>
                {formatCurrency(data.netProfit)}
              </p>
              <div className="flex items-center gap-1">
                <Badge
                  className={cn(
                    "text-[9px] h-4",
                    data.netProfit > 0
                      ? "bg-accent/20 text-accent hover:bg-accent/20"
                      : data.netProfit < 0
                      ? "bg-destructive/20 text-destructive hover:bg-destructive/20"
                      : ""
                  )}
                >
                  {marginPct}% Margin
                </Badge>
              </div>
            </Card>
          </div>

          {/* ── EXPENSE BREAKDOWN CARDS ── */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Purchase Orders",
                amount: data.totalPurchaseOrders,
                icon: ShoppingCart,
                desc: "Supplier purchase orders",
              },
              {
                label: "Other Expenses",
                amount: data.totalExpenses,
                icon: Receipt,
                desc: "Manual / operational expenses",
              },
            ].map(item => (
              <Card key={item.label} className="border-none bg-card shadow-sm p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                  <p className="text-xl font-bold">{formatCurrency(item.amount)}</p>
                  <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                </div>
              </Card>
            ))}
          </div>

           {/* ── FINAL SUMMARY ROW ── */}
          <Card className="border-none bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="font-headline">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {[
                    { label: "Total Revenue", amount: data.totalRevenue, type: "income", bold: false },
                    { label: "Less: Purchase Orders", amount: -data.totalPurchaseOrders, type: "expense", bold: false },
                    { label: "Gross Profit", amount: data.grossProfit, type: "gross", bold: true },
                    { label: "Less: Other Expenses", amount: -data.totalExpenses, type: "expense", bold: false },
                    { label: "Net Profit / Loss", amount: data.netProfit, type: "net", bold: true },
                  ].map((row, i) => (
                    <TableRow
                      key={i}
                      className={cn(
                        "border-border/30",
                        row.bold && "bg-secondary/20",
                      )}
                    >
                      <TableCell className={cn("font-medium", row.bold && "font-bold text-base")}>
                        {row.label}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          "font-bold",
                          row.bold && "text-lg",
                          row.type === "income" ? "text-foreground" :
                          row.type === "expense" ? "text-destructive" :
                          row.type === "gross" ? profitColor(row.amount) :
                          row.type === "net" ? profitColor(row.amount) : ""
                        )}>
                          {row.amount < 0
                            ? `− ${formatCurrency(Math.abs(row.amount))}`
                            : formatCurrency(row.amount)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* ── P&L TABLE ── */}
          <div className="grid gap-6 lg:grid-cols-2">

            {/* INCOME TABLE */}
            <Card className="border-none bg-card shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-accent" />
                  <CardTitle className="font-headline text-base">Income</CardTitle>
                  <Badge className="ml-auto bg-accent/10 text-accent hover:bg-accent/10 text-[10px]">
                    {formatCurrency(data.totalRevenue)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {data.revenueBreakdown.length === 0 ? (
                  <p className="text-center py-10 text-sm text-muted-foreground opacity-50">No income in this period</p>
                ) : (
                  <div className="overflow-x-auto w-full">
                    <Table className="min-w-[420px] w-full">
                      <TableHeader className="bg-secondary/20">
                        <TableRow className="border-none hover:bg-transparent">
                          <TableHead className="font-bold uppercase text-[10px]">Description</TableHead>
                          <TableHead className="font-bold uppercase text-[10px]">Date</TableHead>
                          <TableHead className="text-right font-bold uppercase text-[10px]">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.revenueBreakdown.map((r, i) => (
                          <TableRow key={i} className="border-border/30 hover:bg-secondary/10">
                            <TableCell className="font-medium text-sm">{r.label}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatDate(r.date)}</TableCell>
                            <TableCell className="text-right font-bold text-accent">{formatCurrency(r.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* EXPENSE TABLE */}
            <Card className="border-none bg-card shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-destructive" />
                  <CardTitle className="font-headline text-base">Expenses</CardTitle>
                  <Badge className="ml-auto bg-destructive/10 text-destructive hover:bg-destructive/10 text-[10px]">
                    {formatCurrency(totalExpensesAll)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {data.expenseBreakdown.length === 0 ? (
                  <p className="text-center py-10 text-sm text-muted-foreground opacity-50">No expenses in this period</p>
                ) : (
                  <div className="overflow-x-auto w-full">
                    <Table className="min-w-[480px] w-full">
                      <TableHeader className="bg-secondary/20">
                        <TableRow className="border-none hover:bg-transparent">
                          <TableHead className="font-bold uppercase text-[10px]">Description</TableHead>
                          <TableHead className="font-bold uppercase text-[10px]">Type</TableHead>
                          <TableHead className="font-bold uppercase text-[10px]">Date</TableHead>
                          <TableHead className="text-right font-bold uppercase text-[10px]">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.expenseBreakdown.map((e, i) => (
                          <TableRow key={i} className="border-border/30 hover:bg-secondary/10">
                            <TableCell className="font-medium text-sm">{e.label}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[9px] h-4 uppercase">{e.type}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatDate(e.date)}</TableCell>
                            <TableCell className="text-right font-bold text-destructive">{formatCurrency(e.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

         
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 opacity-30 gap-3">
          <BarChart3 className="w-12 h-12" />
          <p className="font-medium">Select a date range to view your P&L statement.</p>
        </div>
      )}
    </div>
  )
}
