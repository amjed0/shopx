"use client"

import * as React from "react"
import {
  TrendingUp, Package, IndianRupee,
  Download, FileSpreadsheet, FileText, RefreshCw,
  ChevronDown, ShoppingCart, Percent, Scale,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useUser } from "@/app/auth/use-user"
import { useShop } from "@/hooks/useShop"
import { toast } from "@/hooks/use-toast"

// ── Types ─────────────────────────────────────────────────────────────────────
interface MonthRow {
  month: string; revenue: number; cogs: number
  grossProfit: number; netProfit: number; orders: number
}
interface Summary {
  totalRevenue: number; totalCOGS: number; totalGrossProfit: number
  totalOrders: number; grossMargin: number; stockValue: number
  stockRetailValue: number; totalProducts: number; lowStockCount: number
}
interface ConsolidatedBS {
  // Current Assets
  cash: number
  accountsReceivable: number
  prepaidExpenses: number
  inventory: number
  // Non-Current Assets
  equipment: number
  property: number
  goodwill: number
  // Current Liabilities
  accountsPayable: number
  accruedExpenses: number
  unearnedRevenue: number
  salariesPayable: number
  incomeTaxesPayable: number
  warrantyLiability: number
  // Long-Term Liabilities
  longTermDebt: number
  otherLongTermLiabilities: number
  // Equity
  equityCapital: number
  retainedEarnings: number
}
interface HistoryRow {
  date: string; customerName: string; total: number
  status: string; paymentMethod: string; items: number
}
interface BSData {
  year: number
  summary: Summary
  months: MonthRow[]
  paymentBreakdown: Record<string, number>
  topProducts: { name: string; revenue: number; qty: number }[]
  history: HistoryRow[]
  consolidatedBS?: ConsolidatedBS
}

// ── Formatting helpers ────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

// PDF default fonts cannot draw the ₹ symbol, so exports use "Rs."
const fmtPlain = (n: number) =>
  `Rs. ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)}`

const pct = (n: number) => `${n.toFixed(1)}%`

const fmtDate = (s: string) => {
  const d = new Date(s)
  return isNaN(d.getTime())
    ? String(s ?? '')
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i)

// ── Balance sheet maths (shared by screen, PDF and Excel) ─────────────────────
function calcTotals(d?: ConsolidatedBS) {
  if (!d) return { tca: 0, ta: 0, tcl: 0, tl: 0, se: 0, tlse: 0 }
  const tca  = d.cash + d.accountsReceivable + d.prepaidExpenses + d.inventory
  const ta   = tca + d.equipment + d.property + d.goodwill
  const tcl  = d.accountsPayable + d.accruedExpenses + d.unearnedRevenue +
               d.salariesPayable + d.incomeTaxesPayable + d.warrantyLiability
  const tl   = tcl + d.longTermDebt + d.otherLongTermLiabilities
  const se   = d.equityCapital + d.retainedEarnings
  return { tca, ta, tcl, tl, se, tlse: tl + se }
}

interface BSRow {
  type: 'section' | 'subhead' | 'row' | 'subtotal' | 'total'
  label: string
  a?: number
  b?: number
}


function buildBSRows(p?: ConsolidatedBS, c?: ConsolidatedBS): BSRow[] {
  const t1 = calcTotals(p)
  const t2 = calcTotals(c)
  return [
    { type: 'section',  label: 'ASSETS' },
    { type: 'subhead',  label: 'Current Assets' },
    { type: 'row',      label: 'Cash',                 a: p?.cash,               b: c?.cash },
    { type: 'row',      label: 'Accounts Receivable',  a: p?.accountsReceivable, b: c?.accountsReceivable },
    { type: 'row',      label: 'Prepaid Expenses',     a: p?.prepaidExpenses,    b: c?.prepaidExpenses },
    { type: 'row',      label: 'Inventory',            a: p?.inventory,          b: c?.inventory },
    { type: 'subtotal', label: 'Total Current Assets', a: t1.tca, b: t2.tca },
    { type: 'subhead',  label: 'Non-Current Assets' },
    { type: 'row',      label: 'Equipment',            a: p?.equipment,          b: c?.equipment },
    { type: 'row',      label: 'Property',             a: p?.property,           b: c?.property },
    { type: 'row',      label: 'Goodwill',             a: p?.goodwill,           b: c?.goodwill },
    { type: 'total',    label: 'TOTAL ASSETS',         a: t1.ta, b: t2.ta },
    { type: 'section',  label: 'LIABILITIES' },
    { type: 'subhead',  label: 'Current Liabilities' },
    { type: 'row',      label: 'Accounts Payable',     a: p?.accountsPayable,    b: c?.accountsPayable },
    { type: 'row',      label: 'Accrued Expenses',     a: p?.accruedExpenses,    b: c?.accruedExpenses },
    { type: 'row',      label: 'Unearned Revenue',     a: p?.unearnedRevenue,    b: c?.unearnedRevenue },
    { type: 'row',      label: 'Salaries Payable',     a: p?.salariesPayable,    b: c?.salariesPayable },
    { type: 'row',      label: 'Income Taxes Payable', a: p?.incomeTaxesPayable, b: c?.incomeTaxesPayable },
    { type: 'row',      label: 'Warranty Liability',   a: p?.warrantyLiability,  b: c?.warrantyLiability },
    { type: 'subtotal', label: 'Total Current Liabilities', a: t1.tcl, b: t2.tcl },
    { type: 'subhead',  label: 'Long-Term Liabilities' },
    { type: 'row',      label: 'Long-Term Debt',              a: p?.longTermDebt,             b: c?.longTermDebt },
    { type: 'row',      label: 'Other Long-Term Liabilities', a: p?.otherLongTermLiabilities, b: c?.otherLongTermLiabilities },
    { type: 'total',    label: 'TOTAL LIABILITIES',    a: t1.tl, b: t2.tl },
    { type: 'section',  label: "SHAREHOLDER'S EQUITY" },
    { type: 'row',      label: 'Equity Capital',       a: p?.equityCapital,      b: c?.equityCapital },
    { type: 'row',      label: 'Retained Earnings',    a: p?.retainedEarnings,   b: c?.retainedEarnings },
    { type: 'subtotal', label: "Shareholder's Equity", a: t1.se, b: t2.se },
    { type: 'total',    label: "TOTAL LIABILITIES & SHAREHOLDER'S EQUITY", a: t1.tlse, b: t2.tlse },
  ]
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ title, value, icon: Icon, colorClass, badge }: {
  title: string; value: string; icon: React.ElementType
  colorClass: string; badge?: { label: string; positive: boolean }
}) {
  return (
    <Card className="border-none bg-card shadow-sm hover:shadow-md transition-all duration-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className={`p-2.5 rounded-xl ${colorClass} bg-opacity-10`}>
            <Icon className="w-5 h-5" />
          </div>
          {badge && (
            <Badge className={`text-[10px] font-bold border-none px-2 ${
              badge.positive ? 'bg-accent/10 text-accent' : 'bg-orange-500/10 text-orange-400'
            }`}>
              {badge.label}
            </Badge>
          )}
        </div>
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold font-mono mt-0.5 tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Consolidated Balance Sheet Table ──────────────────────────────────────────
function ConsolidatedBSTable({
  primary, compare, yearA, yearB, loading,
}: {
  primary: ConsolidatedBS | undefined
  compare: ConsolidatedBS | undefined
  yearA: number
  yearB: number
  loading: boolean
}) {
  const v = (val: number | undefined) => (val !== undefined ? fmt(val) : '—')
  const rows = buildBSRows(primary, compare)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr style={{ background: '#1e3a5f' }}>
            <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-widest text-white w-[55%]">
              Description
            </th>
            <th className="text-right py-3 px-4 text-xs font-bold uppercase tracking-widest text-white">
              FY {yearA}
            </th>
            <th className="text-right py-3 px-4 text-xs font-bold uppercase tracking-widest text-white">
              FY {yearB}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            if (row.type === 'section') return (
              <tr key={i} className="bg-secondary/60">
                <td colSpan={3} className="py-2.5 px-4 text-[11px] font-bold uppercase tracking-widest text-foreground">
                  {row.label}
                </td>
              </tr>
            )
            if (row.type === 'subhead') return (
              <tr key={i} className="bg-secondary/30">
                <td colSpan={3} className="py-2 px-4 text-xs font-semibold italic text-muted-foreground pl-6">
                  {row.label}
                </td>
              </tr>
            )
            if (row.type === 'row') return (
              <tr key={i} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                <td className="py-2.5 px-4 pl-8">{row.label}</td>
                <td className={`py-2.5 px-4 text-right font-mono text-xs font-semibold ${loading ? 'text-muted-foreground' : ''}`}>
                  {v(row.a)}
                </td>
                <td className={`py-2.5 px-4 text-right font-mono text-xs font-semibold ${loading ? 'text-muted-foreground' : ''}`}>
                  {v(row.b)}
                </td>
              </tr>
            )
            if (row.type === 'subtotal') return (
              <tr key={i} style={{ background: '#dbeafe' }}>
                <td className="py-2.5 px-4 font-bold text-xs uppercase tracking-wide" style={{ color: '#1e3a5f' }}>
                  {row.label}
                </td>
                <td className="py-2.5 px-4 text-right font-mono font-bold text-xs" style={{ color: '#1e3a5f' }}>
                  {fmt(row.a as number)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono font-bold text-xs" style={{ color: '#1e3a5f' }}>
                  {fmt(row.b as number)}
                </td>
              </tr>
            )
            return (
              <tr key={i} style={{ background: '#1e3a5f' }}>
                <td className="py-3 px-4 font-bold text-xs uppercase tracking-widest text-white">
                  {row.label}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-xs text-white">
                  {fmt(row.a as number)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-xs text-white">
                  {fmt(row.b as number)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
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

// Everything both exporters need, built once
function buildExportModel(
  data: BSData,
  compareData: BSData | null,
  compareYear: number,
  companyName: string,
  companyContact: string,
) {
  const s = data.summary
  const safeCompany = companyName.replace(/[^a-zA-Z0-9_-]/g, "_")
  const generated = new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })

  return {
    year: data.year,
    compareYear,
    bsRows: buildBSRows(data.consolidatedBS, compareData?.consolidatedBS),
    title: `${companyName} - Consolidated Balance Sheet`,
    subtitle: `FY ${data.year} vs FY ${compareYear}${companyContact ? ` | ${companyContact}` : ''} | Generated ${generated}`,
    filename: `${safeCompany}_BalanceSheet_FY${data.year}_vs_FY${compareYear}`,
    kpis: [
      { label: 'Total Revenue', value: s.totalRevenue, text: fmtPlain(s.totalRevenue) },
      { label: 'Gross Profit',  value: s.totalGrossProfit, text: fmtPlain(s.totalGrossProfit) },
      { label: 'Gross Margin',  value: s.grossMargin, text: pct(s.grossMargin) },
      { label: 'Total Orders',  value: s.totalOrders, text: String(s.totalOrders) },
      { label: 'Stock Value',   value: s.stockValue, text: fmtPlain(s.stockValue) },
    ],
    paymentBreakdown: Object.entries(data.paymentBreakdown || {}),
    topProducts: data.topProducts || [],
    history: data.history || [],
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
async function exportBalanceSheetPDF(m: ExportModel) {
  const bsBody = m.bsRows.map(r =>
    r.type === 'section' || r.type === 'subhead'
      ? [{ content: r.label, colSpan: 3 }]
      : [r.label, r.a !== undefined ? fmtPlain(r.a) : '-', r.b !== undefined ? fmtPlain(r.b) : '-']
  )
  const types = m.bsRows.map(r => r.type)

  try {
    await loadScript(JSPDF_CDN)
    await loadScript(AUTOTABLE_CDN)
    const jsPDF = (window as any).jspdf?.jsPDF
    if (!jsPDF) throw new Error("jsPDF not available")

    const doc = new jsPDF()
    const pageW = doc.internal.pageSize.getWidth()

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
      theme: 'grid',
      headStyles: { fillColor: [232, 240, 254], textColor: [85, 85, 85], fontSize: 7.5, halign: 'center' },
      bodyStyles: { fontSize: 10, fontStyle: 'bold', textColor: [30, 58, 95], halign: 'center' },
      styles: { lineColor: [210, 220, 235], lineWidth: 0.2 },
    })

    // Balance sheet
    let y = (doc as any).lastAutoTable.finalY + 9
    doc.setFontSize(11)
    doc.setTextColor(30, 58, 95)
    doc.text('Consolidated Balance Sheet', 14, y)

    ;(doc as any).autoTable({
      startY: y + 3,
      head: [['Description', `FY ${m.year}`, `FY ${m.compareYear}`]],
      body: bsBody,
      theme: 'plain',
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 8.5 },
      styles: { fontSize: 8, cellPadding: 1.5, lineColor: [235, 235, 235], lineWidth: { bottom: 0.2 } },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { halign: 'right' },
        2: { halign: 'right' },
      },
      didParseCell: (h: any) => {
        if (h.section !== 'body') return
        const t = types[h.row.index]
        const st = h.cell.styles
        if (t === 'section') {
          st.fillColor = [232, 240, 254]; st.textColor = [30, 58, 95]; st.fontStyle = 'bold'
        } else if (t === 'subhead') {
          st.textColor = [100, 100, 100]; st.fontStyle = 'italic'
        } else if (t === 'subtotal') {
          st.fillColor = [219, 234, 254]; st.textColor = [30, 58, 95]; st.fontStyle = 'bold'
        } else if (t === 'total') {
          st.fillColor = [30, 58, 95]; st.textColor = [255, 255, 255]; st.fontStyle = 'bold'
        }
      },
    })

    // Payment breakdown
    if (m.paymentBreakdown.length > 0) {
      y = (doc as any).lastAutoTable.finalY + 9
      if (y > 255) { doc.addPage(); y = 18 }
      doc.setFontSize(11)
      doc.setTextColor(30, 58, 95)
      doc.text('Revenue by Payment Method', 14, y)
      ;(doc as any).autoTable({
        startY: y + 3,
        head: [['Method', 'Amount']],
        body: m.paymentBreakdown.map(([method, amt]) => [method.toUpperCase(), fmtPlain(amt)]),
        theme: 'striped',
        headStyles: { fillColor: [30, 58, 95] },
        styles: { fontSize: 8.5 },
        columnStyles: { 1: { halign: 'right' } },
        tableWidth: 90,
      })
    }

    // Page numbers
    const pages = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(`Page ${i} of ${pages}`, pageW - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' })
    }

    doc.save(`${m.filename}.pdf`)
    return
  } catch (err) {
    console.warn("jsPDF unavailable, using built-in PDF fallback:", err)
  }

  // Fallback: simple single-page PDF with the balance sheet only
  const rows = m.bsRows.map(r =>
    r.type === 'section' || r.type === 'subhead'
      ? [r.label, '', '']
      : [r.label, r.a !== undefined ? fmtPlain(r.a) : '-', r.b !== undefined ? fmtPlain(r.b) : '-']
  )
  const blob = buildFallbackPdf(
    m.title, m.subtitle,
    ['Description', `FY ${m.year}`, `FY ${m.compareYear}`],
    rows,
  )
  downloadBlob(blob, `${m.filename}.pdf`)
}

// ── Excel export (.xlsx with 2 sheets; falls back to CSV) ─────────────────────
async function exportBalanceSheetExcel(m: ExportModel): Promise<'xlsx' | 'csv'> {
  const bsAoa: (string | number)[][] = [
    [m.title],
    [m.subtitle],
    [],
    ['Description', `FY ${m.year}`, `FY ${m.compareYear}`],
    ...m.bsRows.map(r =>
      r.type === 'section' || r.type === 'subhead'
        ? [r.label, '', '']
        : [r.label, r.a ?? '', r.b ?? '']
    ),
  ]

  const summaryAoa: (string | number)[][] = [
    ['Key Figures'],
    ['Metric', 'Value'],
    ...m.kpis.map(k => [k.label, k.value]),
    [],
    ['Revenue by Payment Method'],
    ['Method', 'Amount (INR)'],
    ...m.paymentBreakdown.map(([method, amt]) => [method.toUpperCase(), amt]),
    [],
    ['Top Products by Revenue'],
    ['Product', 'Units', 'Revenue (INR)'],
    ...m.topProducts.map(p => [p.name, p.qty, p.revenue]),
  ]

  try {
    await loadScript(XLSX_CDN)
    const XLSX = (window as any).XLSX
    if (!XLSX) throw new Error("SheetJS not available")

    const applyMoney = (ws: any, cols: number[], fromRow: number) => {
      const range = XLSX.utils.decode_range(ws['!ref'])
      for (let r = fromRow; r <= range.e.r; r++) {
        cols.forEach(c => {
          const cell = ws[XLSX.utils.encode_cell({ r, c })]
          if (cell && cell.t === 'n') cell.z = '#,##0'
        })
      }
    }

    const wsBS = XLSX.utils.aoa_to_sheet(bsAoa)
    wsBS['!cols'] = [{ wch: 44 }, { wch: 18 }, { wch: 18 }]
    applyMoney(wsBS, [1, 2], 4)

    const wsSum = XLSX.utils.aoa_to_sheet(summaryAoa)
    wsSum['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }]
    applyMoney(wsSum, [1, 2], 0)

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsBS, 'Balance Sheet')
    XLSX.utils.book_append_sheet(wb, wsSum, 'Summary')
    XLSX.writeFile(wb, `${m.filename}.xlsx`)
    return 'xlsx'
  } catch (err) {
    console.warn("SheetJS unavailable, falling back to CSV:", err)
  }

  // Fallback: one CSV that holds the balance sheet and the transactions
  const q = (c: unknown) => `"${String(c ?? '').replace(/"/g, '""')}"`
  const csv = bsAoa.map(r => r.map(q).join(',')).join('\r\n')
  downloadBlob(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }), `${m.filename}.csv`)
  return 'csv'
}

// ── Transactions only (.xlsx, falls back to CSV) ──────────────────────────────
async function exportTransactionsExcel(m: ExportModel): Promise<'xlsx' | 'csv'> {
  const headers = ['Date', 'Customer', 'Amount (INR)', 'Status', 'Payment Method', 'Items']
  const aoa: (string | number)[][] = [
    headers,
    ...m.history.map(h => [
      fmtDate(h.date),
      h.customerName || 'Walk-in Customer',
      h.total || 0,
      (h.status || '').toUpperCase(),
      (h.paymentMethod || '').toUpperCase(),
      h.items ?? 0,
    ]),
  ]
  const filename = m.filename.replace('_BalanceSheet_', '_Transactions_')

  try {
    await loadScript(XLSX_CDN)
    const XLSX = (window as any).XLSX
    if (!XLSX) throw new Error("SheetJS not available")
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 8 }]
    const range = XLSX.utils.decode_range(ws['!ref'])
    for (let r = 1; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: 2 })]
      if (cell && cell.t === 'n') cell.z = '#,##0'
    }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions')
    XLSX.writeFile(wb, `${filename}.xlsx`)
    return 'xlsx'
  } catch (err) {
    console.warn("SheetJS unavailable, falling back to CSV:", err)
  }

  const q = (c: unknown) => `"${String(c ?? '').replace(/"/g, '""')}"`
  const csv = aoa.map(r => r.map(q).join(',')).join('\r\n')
  downloadBlob(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`)
  return 'csv'
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BalanceSheetPage() {
  const { user } = useUser()
  const { data: shopData } = useShop(user?.uid)
  const companyName = shopData?.companyName?.trim() || shopData?.ownerName?.trim() || "ShopX"
  const companyContact = [shopData?.location, shopData?.phone].filter(Boolean).join(" | ")

  const [data, setData]               = React.useState<BSData | null>(null)
  const [compareData, setCompareData] = React.useState<BSData | null>(null)
  const [loading, setLoading]         = React.useState(true)
  const [compareLoading, setCompareLoading] = React.useState(false)
  const [error, setError]             = React.useState<string | null>(null)
  const [year, setYear]               = React.useState(currentYear)
  const [compareYear, setCompareYear] = React.useState(currentYear - 1)
  const [exporting, setExporting]     = React.useState<null | 'pdf' | 'excel' | 'transactions'>(null)

  const fetchData = React.useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/balance-sheet?year=${year}`, { credentials: 'include' })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch')
      setData(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [year])

  const fetchCompareData = React.useCallback(async () => {
    setCompareLoading(true)
    try {
      const res = await fetch(`/api/balance-sheet?year=${compareYear}`, { credentials: 'include' })
      if (!res.ok) { setCompareData(null); return }
      setCompareData(await res.json())
    } catch {
      setCompareData(null)
    } finally {
      setCompareLoading(false)
    }
  }, [compareYear])

  React.useEffect(() => { fetchData() }, [fetchData])
  React.useEffect(() => { fetchCompareData() }, [fetchCompareData])

  const handleExport = async (type: 'pdf' | 'excel' | 'transactions') => {
    if (!data || exporting) return
    setExporting(type)
    try {
      const model = buildExportModel(data, compareData, compareYear, companyName, companyContact)
      if (type === 'pdf') {
        await exportBalanceSheetPDF(model)
        toast({ title: "PDF Downloaded ✓", description: `Saved ${model.filename}.pdf` })
      } else if (type === 'transactions') {
        const kind = await exportTransactionsExcel(model)
        toast({
          title: kind === 'xlsx' ? "Transactions Downloaded ✓" : "CSV Downloaded ✓",
          description: kind === 'xlsx'
            ? "Saved transaction history as Excel."
            : "Excel library could not load, saved a CSV instead.",
        })
      } else {
        const kind = await exportBalanceSheetExcel(model)
        toast({
          title: kind === 'xlsx' ? "Excel Downloaded ✓" : "CSV Downloaded ✓",
          description: kind === 'xlsx'
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

  const s = data?.summary
  const exportDisabled = !data || loading || compareLoading || !!exporting

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Badge className="bg-primary/10 text-primary border-none mb-2 px-3 py-1 text-[10px] tracking-widest uppercase font-bold">
            ShopX Elite · Financial Report
          </Badge>
          <h1 className="text-2xl sm:text-4xl font-headline font-bold tracking-tight">
            Balance <span className="text-primary">Sheet</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Consolidated balance sheet and transaction history for FY {year}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Primary year */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-border font-semibold rounded-full gap-2">
                FY {year} <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {YEARS.map(y => (
                <DropdownMenuItem key={y} onClick={() => setYear(y)}
                  className={y === year ? 'text-primary font-bold' : ''}>
                  FY {y}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Compare year */}
          <div className="flex items-center gap-1.5 border border-border rounded-full px-3 py-1.5">
            <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">vs</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-auto p-0 font-semibold gap-1 text-sm">
                  FY {compareYear} <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {YEARS.map(y => (
                  <DropdownMenuItem key={y} onClick={() => setCompareYear(y)}
                    className={y === compareYear ? 'text-primary font-bold' : ''}>
                    FY {y}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Refresh */}
          <Button variant="outline" onClick={() => { fetchData(); fetchCompareData() }} disabled={loading}
            className="border-border font-semibold rounded-full gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading…' : 'Refresh'}
          </Button>

          {/* Export */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={exportDisabled}
                className="bg-primary text-primary-foreground font-semibold px-5 rounded-full shadow-lg shadow-primary/20 gap-2">
                {exporting
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <Download className="w-4 h-4" />}
                {exporting ? 'Exporting…' : 'Export'}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('pdf')} className="gap-2 cursor-pointer">
                <FileText className="w-4 h-4 text-rose-500" /> Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('excel')} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Download Excel (.xlsx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm font-medium">
          ⚠ {error}
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <StatCard icon={IndianRupee} title="Total Revenue"    colorClass="bg-primary/10 text-primary"
          value={s ? fmt(s.totalRevenue) : '—'}
          badge={{ label: 'FY ' + year, positive: true }} />
        <StatCard icon={TrendingUp}  title="Gross Profit"     colorClass="bg-accent/10 text-accent"
          value={s ? fmt(s.totalGrossProfit) : '—'}
          badge={{ label: s ? pct(s.grossMargin) + ' margin' : '—', positive: true }} />
        <StatCard icon={ShoppingCart} title="Total Orders"    colorClass="bg-purple-500/10 text-purple-400"
          value={s ? s.totalOrders.toString() : '—'} />
        <StatCard icon={Package}     title="Stock Value"      colorClass="bg-orange-500/10 text-orange-400"
          value={s ? fmt(s.stockValue) : '—'}
          badge={s && s.lowStockCount > 0 ? { label: `${s.lowStockCount} low`, positive: false } : undefined} />
      </div>

      {/* ── Consolidated Balance Sheet ── */}
      <Card className="border-none bg-card shadow-sm">
        <CardHeader className="pb-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="font-headline flex items-center gap-2 text-lg">
              <Scale className="w-5 h-5 text-primary" />
              Consolidated Balance Sheet
            </CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {compareLoading && (
                <span className="flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Loading FY {compareYear}…
                </span>
              )}
              <Badge className="bg-primary/10 text-primary border-none font-bold">
                FY {year}
              </Badge>
              <span>vs</span>
              <Badge className="bg-secondary text-foreground border-none font-bold">
                FY {compareYear}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <div className="space-y-2">
              {Array(10).fill(null).map((_, i) => (
                <div key={i} className="h-8 rounded bg-secondary/40 animate-pulse" style={{ width: `${70 + Math.random() * 25}%` }} />
              ))}
            </div>
          ) : (
            <ConsolidatedBSTable
              primary={data?.consolidatedBS}
              compare={compareData?.consolidatedBS}
              yearA={year}
              yearB={compareYear}
              loading={compareLoading}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Bottom Row: Top Products + Payment Breakdown ── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Top Products */}
        <Card className="border-none bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent" />
              Top Products by Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.topProducts || Array(5).fill(null)).map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/20 transition-colors">
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{p?.name ?? '—'}</p>
                  {p && (
                    <div className="mt-1 h-1 rounded-full bg-secondary/50 overflow-hidden">
                      <div className="h-full rounded-full bg-accent transition-all duration-700"
                        style={{ width: `${(p.revenue / (data!.topProducts[0]?.revenue || 1)) * 100}%` }} />
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-mono font-bold">{p ? fmt(p.revenue) : '—'}</p>
                  {p && <p className="text-[10px] text-muted-foreground">{p.qty} units</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Payment Breakdown */}
        <Card className="border-none bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <Percent className="w-5 h-5 text-purple-400" />
              Revenue by Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data ? Object.entries(data.paymentBreakdown).map(([method, amount], i) => {
              const colors   = ['text-primary', 'text-accent', 'text-purple-400', 'text-orange-400']
              const bgColors = ['bg-primary/10', 'bg-accent/10', 'bg-purple-500/10', 'bg-orange-500/10']
              const pctVal   = data.summary.totalRevenue ? (amount / data.summary.totalRevenue) * 100 : 0
              return (
                <div key={method} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${bgColors[i % bgColors.length]}`}>
                      <IndianRupee className={`w-3.5 h-3.5 ${colors[i % colors.length]}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold capitalize">{method}</p>
                      <p className="text-[10px] text-muted-foreground">{pct(pctVal)} of revenue</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`font-mono font-bold border-none ${bgColors[i % bgColors.length]} ${colors[i % colors.length]}`}>
                    {fmt(amount)}
                  </Badge>
                </div>
              )
            }) : Array(3).fill(null).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-secondary/30 animate-pulse" />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Transaction History Table ── */}
      <Card className="border-none bg-card shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-0">
          <CardTitle className="font-headline flex items-center gap-2 text-lg">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Transaction History
            {data && (
              <Badge className="bg-primary/10 text-primary border-none text-[10px] font-bold ml-1">
                {data.history.length} records
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => handleExport('transactions')} disabled={exportDisabled}
            className="text-xs gap-1.5 text-muted-foreground hover:text-foreground rounded-full">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
          </Button>
        </CardHeader>
        <CardContent className="pt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Date', 'Customer', 'Amount', 'Status', 'Payment', 'Items'].map(h => (
                  <th key={h} className="text-left pb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.history.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                    No transactions found for FY {year}.
                  </td>
                </tr>
              )}
              {(data?.history || []).map((h, i) => (
                <tr key={i} className="border-b border-border/40 hover:bg-secondary/20 transition-colors group cursor-default">
                  <td className="py-3 px-3 text-muted-foreground font-mono text-xs">
                    {new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center font-bold text-primary text-xs group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                        {(h.customerName || '?').charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{h.customerName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold">{fmt(h.total)}</td>
                  <td className="py-3 px-3">
                    <Badge className={`text-[10px] font-bold border-none px-2 ${
                      h.status === 'paid'    ? 'bg-accent/10 text-accent' :
                      h.status === 'pending' ? 'bg-orange-500/10 text-orange-400' :
                                               'bg-destructive/10 text-destructive'
                    }`}>
                      {h.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-3">
                    <Badge variant="outline" className="text-[10px] font-bold uppercase">
                      {h.paymentMethod}
                    </Badge>
                  </td>
                  <td className="py-3 px-3 text-muted-foreground font-mono text-xs">{h.items}</td>
                </tr>
              ))}
              {!data && Array(6).fill(null).map((_, i) => (
                <tr key={i} className="border-b border-border/40">
                  {Array(6).fill(null).map((_, j) => (
                    <td key={j} className="py-3 px-3">
                      <div className="h-4 rounded bg-secondary/50 animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

    </div>
  )
}
