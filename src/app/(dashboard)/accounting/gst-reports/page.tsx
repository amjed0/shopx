"use client"

import * as React from "react"
import {
  FileText,
  Search,
  Download,
  TrendingUp,
  ReceiptText,
  X,
  FileSpreadsheet,
  Loader2,
  ChevronDown,
  RefreshCw,
  Wallet,
  AlertTriangle,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
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
import { toast } from "@/hooks/use-toast"
import { useUser } from "@/app/auth/use-user"
import { useShop } from "@/hooks/useShop"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts"

// ─── Types ───────────────────────────────────────────────────────────────────

interface SaleItem {
  productName?: string
  quantity?: number
  price?: number
  taxRate?: number
  taxAmount?: number
}

interface Sale {
  id: string
  billNumber?: string
  date: string
  customerName?: string
  customerGstin?: string
  gstin?: string
  total?: number
  taxAmount?: number
  status?: "paid" | "pending" | "returned"
  items?: SaleItem[]
}

interface InvoiceRow {
  id: string
  invoiceNo: string
  date: string // YYYY-MM-DD
  party: string
  gstin: string
  type: "B2B" | "B2C"
  taxable: number
  cgst: number
  sgst: number
  igst: number
  total: number
  status: "paid" | "pending"
  items: SaleItem[]
}

interface PurchaseRow {
  id: string
  invoiceNo: string
  date: string // YYYY-MM-DD
  supplier: string
  gstin: string
  taxable: number
  cgst: number
  sgst: number
  igst: number
  total: number
}

type PeriodMode = "quarter" | "half" | "year"
type TabKey = "overview" | "gstr1" | "gstr3b"

// ─── Number / date helpers ───────────────────────────────────────────────────

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const round2 = (n: number) => Math.round(n * 100) / 100
const dayOf = (s: unknown) => String(s ?? "").split("T")[0]

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)

const fmtShort = (n: number) => {
  const a = Math.abs(n)
  const sign = n < 0 ? "-" : ""
  if (a >= 10000000) return `${sign}₹${(a / 10000000).toFixed(2)}Cr`
  if (a >= 100000) return `${sign}₹${(a / 100000).toFixed(1)}L`
  if (a >= 1000) return `${sign}₹${(a / 1000).toFixed(1)}K`
  return `${sign}₹${Math.round(a)}`
}

// PDF default fonts cannot draw the ₹ symbol, so exports use "Rs."
const fmtPlain = (n: number) =>
  `${n < 0 ? "- " : ""}Rs. ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.abs(n))}`

const fmtDay = (s: string) => {
  const [y, m, d] = s.split("-")
  return y && m && d ? `${d}/${m}/${y}` : s
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

// ─── Financial-year period logic (India: 1 Apr – 31 Mar) ─────────────────────

const now = new Date()
const CURRENT_FY = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
const CURRENT_QUARTER = Math.floor(((now.getMonth() + 9) % 12) / 3) + 1
const FY_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_FY - i)

const fyLabel = (y: number) => `${y}-${String(y + 1).slice(2)}`

const pad = (n: number) => String(n).padStart(2, "0")
const lastDayOf = (year: number, month1to12: number) => new Date(year, month1to12, 0).getDate()

function getRange(fy: number, mode: PeriodMode, sub: number): { from: string; to: string; label: string; detail: string } {
  if (mode === "year") {
    return {
      from: `${fy}-04-01`,
      to: `${fy + 1}-03-31`,
      label: `FY ${fyLabel(fy)} (Full Year)`,
      detail: `Apr ${fy} – Mar ${fy + 1}`,
    }
  }
  if (mode === "half") {
    return sub === 1
      ? { from: `${fy}-04-01`, to: `${fy}-09-30`, label: `FY ${fyLabel(fy)} H1`, detail: `Apr – Sep ${fy}` }
      : { from: `${fy}-10-01`, to: `${fy + 1}-03-31`, label: `FY ${fyLabel(fy)} H2`, detail: `Oct ${fy} – Mar ${fy + 1}` }
  }
  const q = [
    { sm: 4, sy: fy, em: 6, ey: fy },
    { sm: 7, sy: fy, em: 9, ey: fy },
    { sm: 10, sy: fy, em: 12, ey: fy },
    { sm: 1, sy: fy + 1, em: 3, ey: fy + 1 },
  ][Math.min(4, Math.max(1, sub)) - 1]
  return {
    from: `${q.sy}-${pad(q.sm)}-01`,
    to: `${q.ey}-${pad(q.em)}-${pad(lastDayOf(q.ey, q.em))}`,
    label: `FY ${fyLabel(fy)} Q${sub}`,
    detail: `${MONTHS[q.sm - 1]} ${q.sy} – ${MONTHS[q.em - 1]} ${q.ey}`,
  }
}

function monthsBetween(from: string, to: string): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = []
  let [y, m] = from.split("-").map(Number)
  const [ey, em] = to.split("-").map(Number)
  while (y < ey || (y === ey && m <= em)) {
    out.push({ key: `${y}-${pad(m)}`, label: `${MONTHS[m - 1]} ${String(y).slice(2)}` })
    m++
    if (m > 12) { m = 1; y++ }
  }
  return out
}

// ─── Data normalisation ──────────────────────────────────────────────────────

const itemBase = (it: SaleItem) => num(it.quantity ?? 1) * num(it.price)
const itemTax = (it: SaleItem) =>
  it.taxAmount !== undefined && it.taxAmount !== null
    ? num(it.taxAmount)
    : (itemBase(it) * num(it.taxRate)) / 100

function saleToInvoice(s: Sale): InvoiceRow {
  const items = Array.isArray(s.items) ? s.items : []
  const tax = num(s.taxAmount) || items.reduce((a, it) => a + itemTax(it), 0)
  const total = num(s.total)
  const taxable = Math.max(0, round2(total - tax))
  const gstin = (s.customerGstin || s.gstin || "").trim()
  const cgst = round2(tax / 2)
  return {
    id: s.id,
    invoiceNo: s.billNumber || String(s.id || "").slice(-6).toUpperCase(),
    date: dayOf(s.date),
    party: s.customerName?.trim() || "Walk-in Customer",
    gstin,
    type: gstin ? "B2B" : "B2C",
    taxable,
    cgst,
    sgst: round2(tax - cgst),
    igst: 0,
    total,
    status: s.status === "pending" ? "pending" : "paid",
    items,
  }
}

function normPurchase(p: any, idx: number): PurchaseRow {
  const items: any[] = Array.isArray(p?.items) ? p.items : []
  const itemsTax = items.reduce((a, it) => {
    const direct = it?.taxAmount ?? it?.gstAmount
    if (direct !== undefined && direct !== null) return a + num(direct)
    const base = num(it?.quantity ?? it?.qty ?? 1) * num(it?.costPrice ?? it?.purchasePrice ?? it?.price ?? it?.rate ?? it?.unitPrice)
    return a + (base * num(it?.taxRate ?? it?.gstRate ?? it?.gst)) / 100
  }, 0)
  const tax = num(p?.taxAmount ?? p?.gstAmount ?? p?.totalTax) || itemsTax
  const total = num(p?.total ?? p?.totalAmount ?? p?.grandTotal ?? p?.amount)
  const cgst = round2(tax / 2)
  return {
    id: String(p?.id ?? p?._id ?? idx),
    invoiceNo: String(p?.invoiceNumber ?? p?.invoiceNo ?? p?.billNumber ?? p?.poNumber ?? p?.id ?? p?._id ?? idx).slice(-12),
    date: dayOf(p?.date ?? p?.purchaseDate ?? p?.invoiceDate ?? p?.createdAt),
    supplier: String(p?.supplierName ?? p?.supplier?.name ?? p?.party ?? p?.vendorName ?? "Supplier"),
    gstin: String(p?.supplierGstin ?? p?.gstin ?? p?.supplier?.gstin ?? "").trim(),
    taxable: Math.max(0, round2(total - tax)),
    cgst,
    sgst: round2(tax - cgst),
    igst: 0,
    total,
  }
}

const PURCHASE_ENDPOINTS = ["/api/purchases", "/api/purchase-orders", "/api/purchase"]

async function fetchPurchases(uid: string): Promise<{ rows: PurchaseRow[]; found: boolean }> {
  for (const url of PURCHASE_ENDPOINTS) {
    try {
      const res = await fetch(url, { headers: { "x-user-id": uid }, credentials: "include" })
      if (!res.ok) continue
      const json = await res.json()
      const list = Array.isArray(json) ? json : json?.purchases ?? json?.data ?? json?.items
      if (Array.isArray(list)) {
        return { rows: list.map(normPurchase).filter(p => p.date), found: true }
      }
    } catch {
      /* try the next endpoint */
    }
  }
  return { rows: [], found: false }
}

// ─── Report maths ────────────────────────────────────────────────────────────

interface RateRow { rate: number; taxable: number; tax: number }

function buildRateRows(invoices: InvoiceRow[]): RateRow[] {
  const map = new Map<number, RateRow>()
  invoices.forEach(inv => {
    if (inv.items.length === 0) {
      const tax = inv.cgst + inv.sgst + inv.igst
      const rate = inv.taxable > 0 ? Math.round((tax / inv.taxable) * 100) : 0
      const r = map.get(rate) ?? { rate, taxable: 0, tax: 0 }
      r.taxable += inv.taxable
      r.tax += tax
      map.set(rate, r)
      return
    }
    const bases = inv.items.map(itemBase)
    const sumBase = bases.reduce((a, b) => a + b, 0)
    const factor = sumBase > 0 ? inv.taxable / sumBase : 1
    inv.items.forEach((it, i) => {
      const taxable = bases[i] * factor
      const tax = itemTax(it)
      const rate =
        it.taxRate !== undefined && it.taxRate !== null
          ? num(it.taxRate)
          : taxable > 0 ? Math.round((tax / taxable) * 100) : 0
      const r = map.get(rate) ?? { rate, taxable: 0, tax: 0 }
      r.taxable += taxable
      r.tax += tax
      map.set(rate, r)
    })
  })
  return Array.from(map.values()).sort((a, b) => a.rate - b.rate)
}

const sumBy = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((a, x) => a + f(x), 0)

function buildReport(invoices: InvoiceRow[], purchases: PurchaseRow[]) {
  const taxable = sumBy(invoices, i => i.taxable)
  const cgst = sumBy(invoices, i => i.cgst)
  const sgst = sumBy(invoices, i => i.sgst)
  const igst = sumBy(invoices, i => i.igst)
  const outputTax = cgst + sgst + igst

  const itcCgst = sumBy(purchases, p => p.cgst)
  const itcSgst = sumBy(purchases, p => p.sgst)
  const itcIgst = sumBy(purchases, p => p.igst)
  const itcTotal = itcCgst + itcSgst + itcIgst

  const rateRows = buildRateRows(invoices)
  const taxedRows = rateRows.filter(r => r.rate > 0)
  const nilRows = rateRows.filter(r => r.rate === 0)

  const outward = {
    taxableSupplies: {
      taxable: sumBy(taxedRows, r => r.taxable),
      igst: 0,
      cgst: sumBy(taxedRows, r => r.tax) / 2,
      sgst: sumBy(taxedRows, r => r.tax) / 2,
    },
    nilRated: { taxable: sumBy(nilRows, r => r.taxable), igst: 0, cgst: 0, sgst: 0 },
  }

  const payable = [
    { label: "IGST", liability: igst, itc: itcIgst },
    { label: "CGST", liability: cgst, itc: itcCgst },
    { label: "SGST/UTGST", liability: sgst, itc: itcSgst },
  ].map(r => ({ ...r, net: r.liability - r.itc }))

  return {
    taxable, cgst, sgst, igst, outputTax,
    itcCgst, itcSgst, itcIgst, itcTotal,
    netPayable: outputTax - itcTotal,
    rateRows, outward, payable,
    totalSales: sumBy(invoices, i => i.total),
    totalPurchases: sumBy(purchases, p => p.total),
  }
}
type Report = ReturnType<typeof buildReport>

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

interface ExportModel {
  title: string
  subtitle: string
  filename: string
  periodLabel: string
  report: Report
  invoices: InvoiceRow[]
  purchases: PurchaseRow[]
}

function buildExportModel(
  periodLabel: string,
  periodDetail: string,
  report: Report,
  invoices: InvoiceRow[],
  purchases: PurchaseRow[],
  companyName: string,
  companyContact: string,
  gstin: string,
): ExportModel {
  const safeCompany = companyName.replace(/[^a-zA-Z0-9_-]/g, "_")
  const generated = new Date().toLocaleDateString("en-IN", { dateStyle: "long" })
  const parts = [periodDetail, gstin ? `GSTIN: ${gstin}` : "", companyContact, `Generated ${generated}`].filter(Boolean)
  return {
    title: `${companyName} - GST Report (${periodLabel})`,
    subtitle: parts.join(" | "),
    filename: `${safeCompany}_GST_${periodLabel.replace(/[^a-zA-Z0-9]+/g, "_")}`,
    periodLabel,
    report,
    invoices,
    purchases,
  }
}

// ── PDF ──────────────────────────────────────────────────────────────────────
async function exportGSTPDF(m: ExportModel) {
  await loadScript(JSPDF_CDN)
  await loadScript(AUTOTABLE_CDN)
  const jsPDF = (window as any).jspdf?.jsPDF
  if (!jsPDF) throw new Error("PDF library not available")

  const r = m.report
  const doc = new jsPDF({ orientation: "landscape" })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const auto = (opts: any) => (doc as any).autoTable(opts)
  const lastY = () => (doc as any).lastAutoTable.finalY as number

  doc.setFontSize(16)
  doc.setTextColor(15, 23, 42)
  doc.text(m.title, 14, 15)
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  doc.text(m.subtitle, 14, 21)

  const heading = (text: string, y: number) => {
    let yy = y
    if (yy > pageH - 35) { doc.addPage(); yy = 16 }
    doc.setFontSize(11)
    doc.setTextColor(30, 58, 95)
    doc.text(text, 14, yy)
    return yy + 3
  }

  // KPI strip
  const kpis = [
    ["Taxable Turnover", fmtPlain(r.taxable)],
    ["Output Tax (GST)", fmtPlain(r.outputTax)],
    ["Input Tax Credit", fmtPlain(r.itcTotal)],
    [r.netPayable >= 0 ? "Net GST Payable" : "Excess ITC (Carry Fwd)", fmtPlain(Math.abs(r.netPayable))],
    ["Invoices", String(m.invoices.length)],
  ]
  auto({
    startY: 26,
    head: [kpis.map(k => k[0])],
    body: [kpis.map(k => k[1])],
    theme: "grid",
    headStyles: { fillColor: [232, 240, 254], textColor: [85, 85, 85], fontSize: 7.5, halign: "center" },
    bodyStyles: { fontSize: 10, fontStyle: "bold", textColor: [30, 58, 95], halign: "center" },
    styles: { lineColor: [210, 220, 235], lineWidth: 0.2 },
  })

  // GSTR-3B: tax payable summary
  let y = heading("GSTR-3B - Tax Payable Summary", lastY() + 9)
  const payBody: any[][] = r.payable.map(p => [p.label, fmtPlain(p.liability), fmtPlain(p.itc), fmtPlain(p.net)])
  payBody.push(["TOTAL", fmtPlain(r.outputTax), fmtPlain(r.itcTotal), fmtPlain(r.netPayable)])
  auto({
    startY: y,
    head: [["Head", "Tax Liability (Output)", "Less: ITC", "Net Payable / (Excess ITC)"]],
    body: payBody,
    theme: "striped",
    headStyles: { fillColor: [30, 58, 95] },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    didParseCell: (h: any) => {
      if (h.section === "body" && h.row.index === payBody.length - 1) {
        h.cell.styles.fillColor = [30, 58, 95]
        h.cell.styles.textColor = [255, 255, 255]
        h.cell.styles.fontStyle = "bold"
      }
    },
  })

  // GSTR-3B: 3.1 outward supplies
  y = heading("GSTR-3B 3.1 - Outward Supplies", lastY() + 9)
  const o = r.outward
  const outRows = [
    ["(a) Outward taxable supplies (rated)", o.taxableSupplies],
    ["(c) Other outward supplies (nil rated / exempt)", o.nilRated],
  ] as const
  const outBody: any[][] = outRows.map(([label, v]) => [label, fmtPlain(v.taxable), fmtPlain(v.igst), fmtPlain(v.cgst), fmtPlain(v.sgst)])
  outBody.push([
    "TOTAL",
    fmtPlain(o.taxableSupplies.taxable + o.nilRated.taxable),
    fmtPlain(0),
    fmtPlain(o.taxableSupplies.cgst),
    fmtPlain(o.taxableSupplies.sgst),
  ])
  auto({
    startY: y,
    head: [["Nature of Supply", "Taxable Value", "IGST", "CGST", "SGST"]],
    body: outBody,
    theme: "striped",
    headStyles: { fillColor: [30, 58, 95] },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    didParseCell: (h: any) => {
      if (h.section === "body" && h.row.index === outBody.length - 1) {
        h.cell.styles.fillColor = [30, 58, 95]
        h.cell.styles.textColor = [255, 255, 255]
        h.cell.styles.fontStyle = "bold"
      }
    },
  })

  // GSTR-3B: ITC
  y = heading("GSTR-3B 4 - Eligible Input Tax Credit (from purchases)", lastY() + 9)
  auto({
    startY: y,
    head: [["Detail", "IGST", "CGST", "SGST"]],
    body: [
      ["(D) All other ITC (domestic purchases)", fmtPlain(r.itcIgst), fmtPlain(r.itcCgst), fmtPlain(r.itcSgst)],
      ["Net ITC Available", fmtPlain(r.itcIgst), fmtPlain(r.itcCgst), fmtPlain(r.itcSgst)],
    ],
    theme: "striped",
    headStyles: { fillColor: [16, 185, 129] },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
  })

  // Rate-wise summary
  y = heading("Rate-wise Outward Summary", lastY() + 9)
  const rateBody: any[][] = r.rateRows.length
    ? r.rateRows.map(x => [`${x.rate}%`, fmtPlain(x.taxable), fmtPlain(x.tax / 2), fmtPlain(x.tax / 2), fmtPlain(0), fmtPlain(x.tax)])
    : [[{ content: "No sales in this period", colSpan: 6, styles: { halign: "center" } }]]
  auto({
    startY: y,
    head: [["GST Rate", "Taxable Value", "CGST", "SGST", "IGST", "Total Tax"]],
    body: rateBody,
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
  })

  // GSTR-1 invoice register
  y = heading(`GSTR-1 - Invoice Register (${m.invoices.length} invoices)`, lastY() + 9)
  const invBody: any[][] = m.invoices.length
    ? m.invoices.map(i => [
        i.invoiceNo, fmtDay(i.date), i.party, i.gstin || "-", i.type,
        fmtPlain(i.taxable), fmtPlain(i.cgst), fmtPlain(i.sgst), fmtPlain(i.igst), fmtPlain(i.total),
        i.status === "paid" ? "PAID" : "PENDING",
      ])
    : [[{ content: "No sales invoices in this period", colSpan: 11, styles: { halign: "center" } }]]
  if (m.invoices.length) {
    invBody.push([
      { content: `TOTAL - ${m.invoices.length} invoices`, colSpan: 5 },
      fmtPlain(r.taxable), fmtPlain(r.cgst), fmtPlain(r.sgst), fmtPlain(r.igst), fmtPlain(r.totalSales), "",
    ])
  }
  auto({
    startY: y,
    head: [["Invoice No", "Date", "Party", "GSTIN", "Type", "Taxable", "CGST", "SGST", "IGST", "Total", "Payment"]],
    body: invBody,
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
    styles: { fontSize: 7.5 },
    columnStyles: { 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" }, 9: { halign: "right" } },
    didParseCell: (h: any) => {
      if (m.invoices.length && h.section === "body" && h.row.index === invBody.length - 1) {
        h.cell.styles.fillColor = [30, 58, 95]
        h.cell.styles.textColor = [255, 255, 255]
        h.cell.styles.fontStyle = "bold"
      }
    },
  })

  // Purchases (ITC source)
  if (m.purchases.length) {
    y = heading(`Purchase Register - ITC Source (${m.purchases.length} bills)`, lastY() + 9)
    auto({
      startY: y,
      head: [["Bill No", "Date", "Supplier", "GSTIN", "Taxable", "CGST", "SGST", "IGST", "Total"]],
      body: m.purchases.map(p => [
        p.invoiceNo, fmtDay(p.date), p.supplier, p.gstin || "-",
        fmtPlain(p.taxable), fmtPlain(p.cgst), fmtPlain(p.sgst), fmtPlain(p.igst), fmtPlain(p.total),
      ]),
      theme: "striped",
      headStyles: { fillColor: [16, 185, 129], fontSize: 8 },
      styles: { fontSize: 7.5 },
      columnStyles: { 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" } },
    })
  }

  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`Page ${i} of ${pages}`, pageW - 14, pageH - 7, { align: "right" })
  }
  doc.save(`${m.filename}.pdf`)
}

// ── Excel ────────────────────────────────────────────────────────────────────
async function exportGSTExcel(m: ExportModel): Promise<"xlsx" | "csv"> {
  const r = m.report
  const summaryAoa: (string | number)[][] = [
    [m.title],
    [m.subtitle],
    [],
    ["GSTR-3B - Tax Payable Summary"],
    ["Head", "Tax Liability (Output)", "Less: ITC", "Net Payable / (Excess ITC)"],
    ...r.payable.map(p => [p.label, round2(p.liability), round2(p.itc), round2(p.net)]),
    ["TOTAL", round2(r.outputTax), round2(r.itcTotal), round2(r.netPayable)],
    [],
    ["GSTR-3B 3.1 - Outward Supplies"],
    ["Nature of Supply", "Taxable Value", "IGST", "CGST", "SGST"],
    ["(a) Outward taxable supplies (rated)", round2(r.outward.taxableSupplies.taxable), 0, round2(r.outward.taxableSupplies.cgst), round2(r.outward.taxableSupplies.sgst)],
    ["(c) Other outward supplies (nil rated / exempt)", round2(r.outward.nilRated.taxable), 0, 0, 0],
    [],
    ["GSTR-3B 4 - Eligible ITC (from purchases)"],
    ["Detail", "IGST", "CGST", "SGST"],
    ["(D) All other ITC (domestic purchases)", round2(r.itcIgst), round2(r.itcCgst), round2(r.itcSgst)],
    [],
    ["Totals"],
    ["Taxable Turnover", round2(r.taxable)],
    ["Total Sales (incl. GST)", round2(r.totalSales)],
    ["Total Purchases (incl. GST)", round2(r.totalPurchases)],
    ["Invoices", m.invoices.length],
    ["Purchase Bills", m.purchases.length],
  ]

  const invAoa: (string | number)[][] = [
    ["Invoice No", "Date", "Party", "GSTIN", "Type", "Taxable (INR)", "CGST (INR)", "SGST (INR)", "IGST (INR)", "Total (INR)", "Payment"],
    ...m.invoices.map(i => [
      i.invoiceNo, fmtDay(i.date), i.party, i.gstin || "", i.type,
      round2(i.taxable), round2(i.cgst), round2(i.sgst), round2(i.igst), round2(i.total),
      i.status === "paid" ? "PAID" : "PENDING",
    ]),
    [],
    ["TOTAL", "", "", "", "", round2(r.taxable), round2(r.cgst), round2(r.sgst), round2(r.igst), round2(r.totalSales), ""],
  ]

  const rateAoa: (string | number)[][] = [
    ["GST Rate (%)", "Taxable Value (INR)", "CGST (INR)", "SGST (INR)", "IGST (INR)", "Total Tax (INR)"],
    ...r.rateRows.map(x => [x.rate, round2(x.taxable), round2(x.tax / 2), round2(x.tax / 2), 0, round2(x.tax)]),
  ]

  const purAoa: (string | number)[][] = [
    ["Bill No", "Date", "Supplier", "GSTIN", "Taxable (INR)", "CGST (INR)", "SGST (INR)", "IGST (INR)", "Total (INR)"],
    ...m.purchases.map(p => [
      p.invoiceNo, fmtDay(p.date), p.supplier, p.gstin || "",
      round2(p.taxable), round2(p.cgst), round2(p.sgst), round2(p.igst), round2(p.total),
    ]),
  ]

  try {
    await loadScript(XLSX_CDN)
    const XLSX = (window as any).XLSX
    if (!XLSX) throw new Error("SheetJS not available")

    const makeSheet = (aoa: (string | number)[][], widths: number[]) => {
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      ws["!cols"] = widths.map(w => ({ wch: w }))
      const range = XLSX.utils.decode_range(ws["!ref"])
      for (let rr = 0; rr <= range.e.r; rr++) {
        for (let c = 0; c <= range.e.c; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r: rr, c })]
          if (cell && cell.t === "n") cell.z = "#,##0.00"
        }
      }
      return ws
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, makeSheet(summaryAoa, [46, 22, 16, 26, 16]), "GSTR-3B Summary")
    XLSX.utils.book_append_sheet(wb, makeSheet(invAoa, [16, 12, 28, 18, 8, 16, 14, 14, 14, 16, 10]), "GSTR-1 Invoices")
    XLSX.utils.book_append_sheet(wb, makeSheet(rateAoa, [14, 20, 14, 14, 14, 16]), "Rate-wise Summary")
    XLSX.utils.book_append_sheet(wb, makeSheet(purAoa, [16, 12, 28, 18, 16, 14, 14, 14, 16]), "Purchases (ITC)")
    XLSX.writeFile(wb, `${m.filename}.xlsx`)
    return "xlsx"
  } catch (err) {
    console.warn("SheetJS unavailable, falling back to CSV:", err)
  }

  const q = (c: unknown) => `"${String(c ?? "").replace(/"/g, '""')}"`
  const lines = (aoa: (string | number)[][]) => aoa.map(row => row.map(q).join(","))
  const csv = [
    ...lines(summaryAoa), "",
    "GSTR-1 INVOICES", ...lines(invAoa), "",
    "RATE-WISE SUMMARY", ...lines(rateAoa), "",
    "PURCHASES (ITC)", ...lines(purAoa),
  ].join("\r\n")
  downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }), `${m.filename}.csv`)
  return "csv"
}

// ─── Small UI helpers ────────────────────────────────────────────────────────

function PayBadge({ status }: { status: InvoiceRow["status"] }) {
  if (status === "paid")
    return <Badge className="bg-accent/20 text-accent border-accent/30 rounded-full text-[8px] px-1 py-0 h-3 leading-none font-bold uppercase">Paid</Badge>
  return <Badge variant="destructive" className="rounded-full text-[8px] px-1 py-0 h-3 leading-none font-bold uppercase">Pending</Badge>
}

function TypeChip({ type }: { type: InvoiceRow["type"] }) {
  const cls =
    type === "B2B"
      ? "bg-primary/10 text-primary border border-primary/20"
      : "bg-accent/10 text-accent border border-accent/20"
  return <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full", cls)}>{type}</span>
}

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4"]

const dash = <span className="opacity-30">—</span>

// ─── Main Component ──────────────────────────────────────────────────────────

export default function GSTReportPage() {
  const { user } = useUser()
  const { data: shopData } = useShop(user?.uid)
  const companyName = shopData?.companyName?.trim() || shopData?.ownerName?.trim() || "ShopX"
  const companyContact = [shopData?.location, shopData?.phone].filter(Boolean).join(" | ")
  const shopGstin = String((shopData as any)?.gstin || (shopData as any)?.gstNumber || "").trim()

  // data
  const [sales, setSales] = React.useState<Sale[]>([])
  const [purchases, setPurchases] = React.useState<PurchaseRow[]>([])
  const [purchasesFound, setPurchasesFound] = React.useState(true)
  const [loading, setLoading] = React.useState(true)
  const [exporting, setExporting] = React.useState<null | "pdf" | "excel">(null)

  // period
  const [fy, setFy] = React.useState(CURRENT_FY)
  const [mode, setMode] = React.useState<PeriodMode>("quarter")
  const [sub, setSub] = React.useState(CURRENT_QUARTER)

  // ui
  const [activeTab, setActiveTab] = React.useState<TabKey>("overview")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState("All")
  const [statusFilter, setStatusFilter] = React.useState("All")

  const loadData = React.useCallback(async () => {
    if (!user?.uid) return
    setLoading(true)
    try {
      const [salesRes, purchaseResult] = await Promise.all([
        fetch("/api/sales", { headers: { "x-user-id": user.uid } })
          .then(r => (r.ok ? r.json() : []))
          .catch(() => []),
        fetchPurchases(user.uid),
      ])
      const list = Array.isArray(salesRes) ? salesRes : salesRes?.sales ?? salesRes?.data ?? []
      setSales(Array.isArray(list) ? list : [])
      setPurchases(purchaseResult.rows)
      setPurchasesFound(purchaseResult.found)
    } catch (e) {
      console.error(e)
      toast({ variant: "destructive", title: "Error", description: "Could not load GST data." })
    } finally {
      setLoading(false)
    }
  }, [user?.uid])

  React.useEffect(() => { loadData() }, [loadData])

  // period handlers
  const changeMode = (next: PeriodMode) => {
    setMode(next)
    if (next === "quarter") setSub(fy === CURRENT_FY ? CURRENT_QUARTER : 1)
    else if (next === "half") setSub(fy === CURRENT_FY && CURRENT_QUARTER >= 3 ? 2 : 1)
    else setSub(1)
  }

  const range = React.useMemo(() => getRange(fy, mode, sub), [fy, mode, sub])

  // period data
  const invoices = React.useMemo(
    () =>
      sales
        .filter(s => s.status !== "returned")
        .map(saleToInvoice)
        .filter(i => i.date >= range.from && i.date <= range.to)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [sales, range]
  )

  const periodPurchases = React.useMemo(
    () => purchases.filter(p => p.date >= range.from && p.date <= range.to).sort((a, b) => b.date.localeCompare(a.date)),
    [purchases, range]
  )

  const report = React.useMemo(() => buildReport(invoices, periodPurchases), [invoices, periodPurchases])

  const monthlyData = React.useMemo(() => {
    return monthsBetween(range.from, range.to).map(({ key, label }) => {
      const inv = invoices.filter(i => i.date.startsWith(key))
      const pur = periodPurchases.filter(p => p.date.startsWith(key))
      return {
        month: label,
        cgst: Math.round(sumBy(inv, i => i.cgst)),
        sgst: Math.round(sumBy(inv, i => i.sgst)),
        igst: Math.round(sumBy(inv, i => i.igst)),
        itc: Math.round(sumBy(pur, p => p.cgst + p.sgst + p.igst)),
        taxable: Math.round(sumBy(inv, i => i.taxable)),
      }
    })
  }, [invoices, periodPurchases, range])

  const pieData = React.useMemo(
    () =>
      report.rateRows
        .filter(r => r.taxable > 0)
        .map((r, i) => ({ name: `GST ${r.rate}%`, value: Math.round(r.taxable), color: PIE_COLORS[i % PIE_COLORS.length] })),
    [report.rateRows]
  )

  const filtered = React.useMemo(() => {
    const q = searchQuery.toLowerCase()
    return invoices.filter(inv => {
      const matchSearch =
        inv.party.toLowerCase().includes(q) ||
        inv.invoiceNo.toLowerCase().includes(q) ||
        inv.gstin.toLowerCase().includes(q)
      const matchType = typeFilter === "All" || inv.type === typeFilter
      const matchStatus = statusFilter === "All" || inv.status === statusFilter.toLowerCase()
      return matchSearch && matchType && matchStatus
    })
  }, [invoices, searchQuery, typeFilter, statusFilter])

  const paidCount = invoices.filter(i => i.status === "paid").length
  const pendingCount = invoices.filter(i => i.status === "pending").length

  // export
  const handleExport = async (type: "pdf" | "excel") => {
    if (exporting || loading) return
    setExporting(type)
    try {
      const model = buildExportModel(
        range.label, range.detail, report, invoices, periodPurchases,
        companyName, companyContact, shopGstin
      )
      if (type === "pdf") {
        await exportGSTPDF(model)
        toast({ title: "PDF Downloaded ✓", description: `Saved ${model.filename}.pdf` })
      } else {
        const kind = await exportGSTExcel(model)
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

  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Dashboard" },
    { key: "gstr1", label: "GSTR-1 (Outward)" },
    { key: "gstr3b", label: "GSTR-3B (Summary)" },
  ]

  const pillBtn = (active: boolean) =>
    cn(
      "px-4 py-1.5 text-xs font-bold rounded-full transition-all whitespace-nowrap",
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
    )

  const exportDisabled = loading || !!exporting

  return (
    <div className="space-y-8">

      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold text-foreground">GST Reports</h1>
          <p className="text-muted-foreground">
            GST from your sales and purchase bills — by financial year, half-year and quarter.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={loadData} disabled={loading} className="rounded-full gap-2 px-5">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            {loading ? "Loading…" : "Refresh"}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                disabled={exportDisabled}
                className="bg-primary text-primary-foreground font-semibold px-5 rounded-full shadow-lg shadow-primary/20 gap-2"
              >
                {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
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
      </div>

      {/* ── Period selector ── */}
      <Card className="border-none bg-card shadow-sm">
        <CardContent className="pt-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
            {/* Financial year */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Financial Year</span>
              <Select
                value={String(fy)}
                onValueChange={v => {
                  const y = Number(v)
                  setFy(y)
                  if (mode === "quarter") setSub(y === CURRENT_FY ? CURRENT_QUARTER : 1)
                }}
              >
                <SelectTrigger className="w-32 h-9 rounded-full bg-secondary/30 border-none text-sm font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FY_OPTIONS.map(y => (
                    <SelectItem key={y} value={String(y)}>FY {fyLabel(y)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mode */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button type="button" onClick={() => changeMode("quarter")} className={pillBtn(mode === "quarter")}>Quarterly</button>
              <button type="button" onClick={() => changeMode("half")} className={pillBtn(mode === "half")}>Half-Yearly</button>
              <button type="button" onClick={() => changeMode("year")} className={pillBtn(mode === "year")}>Financial Year</button>
            </div>

            {/* Sub period */}
            {mode === "quarter" && (
              <div className="flex items-center gap-1.5 md:ml-auto">
                {[1, 2, 3, 4].map(q => (
                  <button key={q} type="button" onClick={() => setSub(q)} className={pillBtn(sub === q)}>Q{q}</button>
                ))}
              </div>
            )}
            {mode === "half" && (
              <div className="flex items-center gap-1.5 md:ml-auto">
                {[1, 2].map(h => (
                  <button key={h} type="button" onClick={() => setSub(h)} className={pillBtn(sub === h)}>H{h}</button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground border-t border-border/40 pt-3">
            <Badge className="bg-primary/10 text-primary border-none font-bold">{range.label}</Badge>
            <span>{range.detail}</span>
            <span className="opacity-50">•</span>
            <span>{fmtDay(range.from)} to {fmtDay(range.to)}</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Notices ── */}
      {!loading && !purchasesFound && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-500">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Purchase bills could not be loaded, so Input Tax Credit shows ₹0. Check that your purchase API
            matches one of: {PURCHASE_ENDPOINTS.join(", ")}.
          </p>
        </div>
      )}
      <div className="flex items-start gap-2 rounded-xl border border-border/50 bg-secondary/20 p-3 text-[11px] text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          All sales are treated as intra-state (GST split equally into CGST and SGST). Bills with a customer GSTIN are
          B2B, others B2C. Returned bills are excluded.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
        </div>
      ) : (
        <>
          {/* ── Summary Cards ── */}
          <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">
            <Card className="p-4 flex items-center gap-4 border-none bg-card shadow-sm">
              <ReceiptText className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Taxable Turnover</p>
                <p className="text-2xl font-bold">{fmtShort(report.taxable)}</p>
                <p className="text-[10px] text-muted-foreground">{invoices.length} invoices</p>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-4 border-none bg-card shadow-sm">
              <TrendingUp className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Output Tax</p>
                <p className="text-2xl font-bold">{fmtShort(report.outputTax)}</p>
                <p className="text-[10px] text-muted-foreground">CGST + SGST + IGST</p>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-4 border-none bg-card shadow-sm">
              <FileText className="text-accent shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Input Tax Credit</p>
                <p className="text-2xl font-bold text-accent">{fmtShort(report.itcTotal)}</p>
                <p className="text-[10px] text-muted-foreground">{periodPurchases.length} purchase bills</p>
              </div>
            </Card>

            <Card
              className={cn(
                "p-4 flex items-center gap-4 border-none shadow-sm",
                report.netPayable > 0 ? "bg-destructive/10 ring-2 ring-destructive" : "bg-accent/10"
              )}
            >
              <Wallet className={cn("shrink-0", report.netPayable > 0 ? "text-destructive" : "text-accent")} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
                  {report.netPayable >= 0 ? "Net GST Payable" : "Excess ITC"}
                </p>
                <p className="text-2xl font-bold">{fmtShort(Math.abs(report.netPayable))}</p>
                <p className="text-[10px] text-muted-foreground">Output tax − ITC</p>
              </div>
            </Card>
          </div>

          {/* ── Tab Bar ── */}
          <div className="flex gap-1 border-b border-border/50 overflow-x-auto">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  "px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap",
                  activeTab === t.key
                    ? "bg-card border border-b-card border-border/50 -mb-px text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ══════════ DASHBOARD TAB ══════════ */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-none bg-card shadow-sm">
                  <CardHeader>
                    <CardTitle className="font-headline">Monthly Tax Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={monthlyData} barSize={14}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <Tooltip
                          formatter={(v: number) => fmt(v)}
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                          labelStyle={{ color: "hsl(var(--foreground))", fontWeight: "bold" }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="cgst" name="CGST" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="sgst" name="SGST" fill="hsl(var(--accent))" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="itc" name="ITC (Purchases)" fill="#22c55e" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-none bg-card shadow-sm">
                  <CardHeader>
                    <CardTitle className="font-headline">Taxable Value by GST Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pieData.length === 0 ? (
                      <p className="text-center py-16 text-sm text-muted-foreground opacity-50">No sales in this period</p>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={160}>
                          <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" outerRadius={65} dataKey="value" nameKey="name">
                              {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                            </Pie>
                            <Tooltip
                              formatter={(v: number) => fmt(v)}
                              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2 mt-3">
                          {pieData.map(d => (
                            <div key={d.name} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-sm" style={{ background: d.color }} />
                                <span className="text-muted-foreground font-medium">{d.name}</span>
                              </div>
                              <span className="font-bold text-foreground">{fmtShort(d.value)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="border-none bg-card shadow-sm">
                <CardHeader>
                  <CardTitle className="font-headline">Taxable Turnover — Monthly</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={190}>
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(v: number) => fmt(v)}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      />
                      <Line type="monotone" dataKey="taxable" name="Taxable Value" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: "hsl(var(--primary))", r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Paid Invoices", count: paidCount, cls: "text-accent" },
                  { label: "Pending (Credit)", count: pendingCount, cls: "text-destructive" },
                  { label: "Purchase Bills", count: periodPurchases.length, cls: "text-primary" },
                ].map(s => (
                  <Card key={s.label} className="border-none bg-card shadow-sm p-4 text-center">
                    <p className={cn("text-3xl font-bold", s.cls)}>{s.count}</p>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mt-1">{s.label}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* ══════════ GSTR-1 TAB ══════════ */}
          {activeTab === "gstr1" && (
            <div className="space-y-6">
              <Card className="border-none bg-card shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
                  <CardTitle className="font-headline">Invoice Register</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search party, invoice, GSTIN…"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-56 pl-9 rounded-full bg-secondary/30 border-none"
                      />
                    </div>

                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-28 h-9 rounded-full bg-secondary/30 border-none text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["All", "B2B", "B2C"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-28 h-9 rounded-full bg-secondary/30 border-none text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["All", "Paid", "Pending"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    {(searchQuery || typeFilter !== "All" || statusFilter !== "All") && (
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => { setSearchQuery(""); setTypeFilter("All"); setStatusFilter("All") }}
                        className="text-xs gap-1 h-8 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20"
                      >
                        <X className="w-3 h-3" /> Clear
                      </Button>
                    )}

                    <Badge variant="secondary" className="rounded-md bg-secondary/50">{filtered.length} Invoices</Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  <div className="overflow-x-auto w-full">
                    <Table className="min-w-[760px] w-full">
                      <TableHeader className="bg-secondary/20">
                        <TableRow className="border-none hover:bg-transparent">
                          <TableHead className="font-bold uppercase text-[10px]">Invoice Info</TableHead>
                          <TableHead className="font-bold uppercase text-[10px]">Party / GSTIN</TableHead>
                          <TableHead className="font-bold uppercase text-[10px]">Type</TableHead>
                          <TableHead className="font-bold uppercase text-[10px] text-right">Taxable</TableHead>
                          <TableHead className="font-bold uppercase text-[10px] text-right">CGST</TableHead>
                          <TableHead className="font-bold uppercase text-[10px] text-right">SGST</TableHead>
                          <TableHead className="font-bold uppercase text-[10px] text-right">IGST</TableHead>
                          <TableHead className="font-bold uppercase text-[10px] text-right">Total</TableHead>
                          <TableHead className="font-bold uppercase text-[10px]">Payment</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map(inv => (
                          <TableRow key={inv.id} className="border-border/30 hover:bg-secondary/10">
                            <TableCell>
                              <p className="font-bold">#{inv.invoiceNo}</p>
                              <p className="text-[10px] uppercase font-code opacity-60">{fmtDay(inv.date)}</p>
                            </TableCell>
                            <TableCell>
                              <p className="font-bold">{inv.party}</p>
                              <p className="text-[10px] font-code opacity-50">{inv.gstin || "—"}</p>
                            </TableCell>
                            <TableCell><TypeChip type={inv.type} /></TableCell>
                            <TableCell className="text-right font-medium">{fmt(inv.taxable)}</TableCell>
                            <TableCell className="text-right text-primary">{inv.cgst ? fmt(inv.cgst) : dash}</TableCell>
                            <TableCell className="text-right text-accent">{inv.sgst ? fmt(inv.sgst) : dash}</TableCell>
                            <TableCell className="text-right text-primary/70">{inv.igst ? fmt(inv.igst) : dash}</TableCell>
                            <TableCell className="text-right font-bold">{fmt(inv.total)}</TableCell>
                            <TableCell><PayBadge status={inv.status} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {filtered.length > 0 && (
                    <div className="bg-secondary/30 border-t border-border/30 px-4 py-3 flex flex-wrap gap-4 justify-between text-sm">
                      <span className="font-bold uppercase text-[10px] text-muted-foreground tracking-wider self-center">
                        TOTAL — {filtered.length} invoices
                      </span>
                      <div className="flex gap-6 flex-wrap">
                        {[
                          { label: "Taxable", val: sumBy(filtered, i => i.taxable), cls: "text-foreground" },
                          { label: "CGST", val: sumBy(filtered, i => i.cgst), cls: "text-primary" },
                          { label: "SGST", val: sumBy(filtered, i => i.sgst), cls: "text-accent" },
                          { label: "IGST", val: sumBy(filtered, i => i.igst), cls: "text-primary/70" },
                          { label: "Total", val: sumBy(filtered, i => i.total), cls: "text-foreground font-bold text-base" },
                        ].map(t => (
                          <div key={t.label} className="text-right">
                            <p className="text-[9px] text-muted-foreground font-bold uppercase">{t.label}</p>
                            <p className={cn("font-bold", t.cls)}>{fmt(t.val)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 opacity-30 gap-3">
                      <FileText className="w-12 h-12" />
                      <p className="font-medium">
                        {invoices.length === 0 ? "No sales invoices in this period." : "No invoices match your filters."}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Rate-wise summary */}
              <Card className="border-none bg-card shadow-sm overflow-hidden">
                <CardHeader className="bg-secondary/20 border-b border-border/30 py-3">
                  <CardTitle className="font-headline text-sm">Rate-wise Outward Summary</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto w-full">
                    <Table className="min-w-[520px] w-full">
                      <TableHeader className="bg-secondary/10">
                        <TableRow className="border-none hover:bg-transparent">
                          <TableHead className="font-bold uppercase text-[10px]">GST Rate</TableHead>
                          <TableHead className="font-bold uppercase text-[10px] text-right">Taxable Value</TableHead>
                          <TableHead className="font-bold uppercase text-[10px] text-right">CGST</TableHead>
                          <TableHead className="font-bold uppercase text-[10px] text-right">SGST</TableHead>
                          <TableHead className="font-bold uppercase text-[10px] text-right">IGST</TableHead>
                          <TableHead className="font-bold uppercase text-[10px] text-right">Total Tax</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.rateRows.length === 0 && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground opacity-60">
                              No sales in this period
                            </TableCell>
                          </TableRow>
                        )}
                        {report.rateRows.map(x => (
                          <TableRow key={x.rate} className="border-border/30 hover:bg-secondary/10">
                            <TableCell className="font-bold">{x.rate}%</TableCell>
                            <TableCell className="text-right font-medium">{fmt(x.taxable)}</TableCell>
                            <TableCell className="text-right text-primary">{x.tax ? fmt(x.tax / 2) : dash}</TableCell>
                            <TableCell className="text-right text-accent">{x.tax ? fmt(x.tax / 2) : dash}</TableCell>
                            <TableCell className="text-right text-primary/70">{dash}</TableCell>
                            <TableCell className="text-right font-bold">{fmt(x.tax)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ══════════ GSTR-3B TAB ══════════ */}
          {activeTab === "gstr3b" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                {/* 3.1 Outward Supplies */}
                <Card className="border-none bg-card shadow-sm overflow-hidden">
                  <CardHeader className="bg-secondary/20 border-b border-border/30 py-3">
                    <CardTitle className="font-headline text-sm">3.1 — Outward Supplies</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto w-full">
                      <Table className="min-w-[480px] w-full">
                        <TableHeader className="bg-secondary/10">
                          <TableRow className="border-none hover:bg-transparent">
                            <TableHead className="font-bold uppercase text-[10px]">Nature</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] text-right">Taxable</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] text-right">IGST</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] text-right">CGST</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] text-right">SGST</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[
                            { label: "(a) Outward taxable supplies", v: report.outward.taxableSupplies },
                            { label: "(c) Nil rated / Exempt", v: report.outward.nilRated },
                          ].map(row => (
                            <TableRow key={row.label} className="border-border/30 hover:bg-secondary/10">
                              <TableCell className="text-xs text-muted-foreground">{row.label}</TableCell>
                              <TableCell className="text-right font-medium text-sm">{fmt(row.v.taxable)}</TableCell>
                              <TableCell className="text-right text-primary/70 text-sm">{row.v.igst ? fmt(row.v.igst) : dash}</TableCell>
                              <TableCell className="text-right text-primary text-sm">{row.v.cgst ? fmt(row.v.cgst) : dash}</TableCell>
                              <TableCell className="text-right text-accent text-sm">{row.v.sgst ? fmt(row.v.sgst) : dash}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-primary text-primary-foreground hover:bg-primary">
                            <TableCell className="font-bold text-xs uppercase tracking-wide">Total</TableCell>
                            <TableCell className="text-right font-bold text-sm">
                              {fmt(report.outward.taxableSupplies.taxable + report.outward.nilRated.taxable)}
                            </TableCell>
                            <TableCell className="text-right font-bold text-sm">{fmt(0)}</TableCell>
                            <TableCell className="text-right font-bold text-sm">{fmt(report.outward.taxableSupplies.cgst)}</TableCell>
                            <TableCell className="text-right font-bold text-sm">{fmt(report.outward.taxableSupplies.sgst)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* 4. ITC */}
                <Card className="border-none bg-card shadow-sm overflow-hidden">
                  <CardHeader className="bg-secondary/20 border-b border-border/30 py-3">
                    <CardTitle className="font-headline text-sm">4 — Eligible Input Tax Credit (ITC)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto w-full">
                      <Table className="min-w-[420px] w-full">
                        <TableHeader className="bg-secondary/10">
                          <TableRow className="border-none hover:bg-transparent">
                            <TableHead className="font-bold uppercase text-[10px]">Detail</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] text-right">IGST</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] text-right">CGST</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] text-right">SGST</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow className="border-border/30 hover:bg-secondary/10">
                            <TableCell className="text-xs text-muted-foreground">(D) All other ITC (purchases)</TableCell>
                            <TableCell className="text-right text-primary/70 text-sm">{report.itcIgst ? fmt(report.itcIgst) : dash}</TableCell>
                            <TableCell className="text-right text-primary text-sm">{report.itcCgst ? fmt(report.itcCgst) : dash}</TableCell>
                            <TableCell className="text-right text-accent text-sm">{report.itcSgst ? fmt(report.itcSgst) : dash}</TableCell>
                          </TableRow>
                          <TableRow className="bg-accent/80 text-accent-foreground hover:bg-accent/80">
                            <TableCell className="font-bold text-xs uppercase tracking-wide">Net ITC Available</TableCell>
                            <TableCell className="text-right font-bold text-sm">{fmt(report.itcIgst)}</TableCell>
                            <TableCell className="text-right font-bold text-sm">{fmt(report.itcCgst)}</TableCell>
                            <TableCell className="text-right font-bold text-sm">{fmt(report.itcSgst)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tax Payable Summary */}
              <Card className="border-none bg-card shadow-sm">
                <CardHeader>
                  <CardTitle className="font-headline">6 — Tax Payable Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {report.payable.map(col => (
                      <div key={col.label} className="border border-border/50 rounded-xl overflow-hidden">
                        <div className="bg-secondary/30 px-4 py-2 text-center border-b border-border/30">
                          <span className="text-sm font-bold text-foreground">{col.label}</span>
                        </div>
                        <div className="px-4 py-3 space-y-2 text-sm">
                          <div className="flex justify-between text-muted-foreground">
                            <span>Tax Liability</span>
                            <span className="font-medium text-foreground">{fmt(col.liability)}</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>(-) ITC</span>
                            <span className="font-medium text-accent">−{fmt(col.itc)}</span>
                          </div>
                          <div
                            className={cn(
                              "border-t border-border/40 pt-2 flex justify-between font-bold",
                              col.net >= 0 ? "text-primary" : "text-accent"
                            )}
                          >
                            <span>{col.net >= 0 ? "Net Payable" : "Excess ITC"}</span>
                            <span className="text-lg">{fmt(Math.abs(col.net))}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-primary rounded-xl px-6 py-4 flex justify-between items-center gap-3">
                    <div>
                      <p className="text-primary-foreground/70 text-xs font-bold uppercase tracking-wider">
                        {report.netPayable >= 0 ? "Total GST Payable after ITC" : "Excess ITC (Carry Forward)"}
                      </p>
                      <p className="text-primary-foreground text-3xl font-bold mt-0.5">{fmt(Math.abs(report.netPayable))}</p>
                    </div>
                    <Badge className="bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30 rounded-full text-xs px-3 py-1">
                      {range.label}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ── Footer ── */}
      <div className="border-t border-border/30 pt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>Generated from your sales and purchase records · {new Date().toLocaleDateString("en-IN")}</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-accent inline-block" />
          Live data
        </span>
      </div>
    </div>
  )
}
