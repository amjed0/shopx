"use client"

import * as React from "react"
import {
  TrendingUp, Package, IndianRupee, BarChart3,
  Download, FileSpreadsheet, FileText, RefreshCw,
  ChevronDown, ShoppingCart, Percent, Scale,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
interface BSData {
  year: number
  summary: Summary
  months: MonthRow[]
  paymentBreakdown: Record<string, number>
  topProducts: { name: string; revenue: number; qty: number }[]
  history: { date: string; customerName: string; total: number; status: string; paymentMethod: string; items: number }[]
  consolidatedBS?: ConsolidatedBS
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const pct = (n: number) => `${n.toFixed(1)}%`

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i)

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
  const skeleton = '—'

  const v = (val: number | undefined) =>
    val !== undefined ? fmt(val) : skeleton

  // Compute totals
  const totals = (d: ConsolidatedBS | undefined) => {
    if (!d) return { tca: 0, ta: 0, tcl: 0, tl: 0, se: 0, tlse: 0 }
    const tca  = d.cash + d.accountsReceivable + d.prepaidExpenses + d.inventory
    const ta   = tca + d.equipment + d.property + d.goodwill
    const tcl  = d.accountsPayable + d.accruedExpenses + d.unearnedRevenue +
                 d.salariesPayable + d.incomeTaxesPayable + d.warrantyLiability
    const tl   = tcl + d.longTermDebt + d.otherLongTermLiabilities
    const se   = d.equityCapital + d.retainedEarnings
    const tlse = tl + se
    return { tca, ta, tcl, tl, se, tlse }
  }

  const t1 = totals(primary)
  const t2 = totals(compare)

  type RowDef =
    | { type: 'section'; label: string }
    | { type: 'subhead'; label: string }
    | { type: 'row'; label: string; a: number | undefined; b: number | undefined }
    | { type: 'subtotal'; label: string; a: number; b: number }
    | { type: 'total'; label: string; a: number; b: number }

  const rows: RowDef[] = [
    { type: 'section', label: 'ASSETS' },
    { type: 'subhead', label: 'Current Assets' },
    { type: 'row',     label: 'Cash',                  a: primary?.cash,                b: compare?.cash },
    { type: 'row',     label: 'Accounts Receivable',   a: primary?.accountsReceivable,  b: compare?.accountsReceivable },
    { type: 'row',     label: 'Prepaid Expenses',      a: primary?.prepaidExpenses,     b: compare?.prepaidExpenses },
    { type: 'row',     label: 'Inventory',             a: primary?.inventory,           b: compare?.inventory },
    { type: 'subtotal',label: 'Total Current Assets',  a: t1.tca, b: t2.tca },
    { type: 'subhead', label: 'Non-Current Assets' },
    { type: 'row',     label: 'Equipment',             a: primary?.equipment,           b: compare?.equipment },
    { type: 'row',     label: 'Property',              a: primary?.property,            b: compare?.property },
    { type: 'row',     label: 'Goodwill',              a: primary?.goodwill,            b: compare?.goodwill },
    { type: 'total',   label: 'TOTAL ASSETS',          a: t1.ta,  b: t2.ta },
    { type: 'section', label: 'LIABILITIES' },
    { type: 'subhead', label: 'Current Liabilities' },
    { type: 'row',     label: 'Accounts Payable',      a: primary?.accountsPayable,     b: compare?.accountsPayable },
    { type: 'row',     label: 'Accrued Expenses',      a: primary?.accruedExpenses,     b: compare?.accruedExpenses },
    { type: 'row',     label: 'Unearned Revenue',      a: primary?.unearnedRevenue,     b: compare?.unearnedRevenue },
    { type: 'row',     label: 'Salaries Payable',      a: primary?.salariesPayable,     b: compare?.salariesPayable },
    { type: 'row',     label: 'Income Taxes Payable',  a: primary?.incomeTaxesPayable,  b: compare?.incomeTaxesPayable },
    { type: 'row',     label: 'Warranty Liability',    a: primary?.warrantyLiability,   b: compare?.warrantyLiability },
    { type: 'subtotal',label: 'Total Current Liabilities', a: t1.tcl, b: t2.tcl },
    { type: 'subhead', label: 'Long-Term Liabilities' },
    { type: 'row',     label: 'Long-Term Debt',                a: primary?.longTermDebt,            b: compare?.longTermDebt },
    { type: 'row',     label: 'Other Long-Term Liabilities',   a: primary?.otherLongTermLiabilities, b: compare?.otherLongTermLiabilities },
    { type: 'total',   label: 'TOTAL LIABILITIES',     a: t1.tl,  b: t2.tl },
    { type: 'section', label: "SHAREHOLDER'S EQUITY" },
    { type: 'row',     label: 'Equity Capital',        a: primary?.equityCapital,       b: compare?.equityCapital },
    { type: 'row',     label: 'Retained Earnings',     a: primary?.retainedEarnings,    b: compare?.retainedEarnings },
    { type: 'subtotal',label: "Shareholder's Equity",  a: t1.se,  b: t2.se },
    { type: 'total',   label: "TOTAL LIABILITIES & SHAREHOLDER'S EQUITY", a: t1.tlse, b: t2.tlse },
  ]

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
                  {fmt(row.a)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono font-bold text-xs" style={{ color: '#1e3a5f' }}>
                  {fmt(row.b)}
                </td>
              </tr>
            )
            if (row.type === 'total') return (
              <tr key={i} style={{ background: '#1e3a5f' }}>
                <td className="py-3 px-4 font-bold text-xs uppercase tracking-widest text-white">
                  {row.label}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-xs text-white">
                  {fmt(row.a)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-xs text-white">
                  {fmt(row.b)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Download helpers ──────────────────────────────────────────────────────────
function downloadCSV(data: BSData) {
  const headers = ['Date', 'Customer', 'Total (₹)', 'Status', 'Payment Method', 'Items']
  const rows = data.history.map(h => [
    h.date, h.customerName, h.total, h.status, h.paymentMethod, h.items,
  ])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `balance-sheet-${data.year}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

async function downloadPDF(data: BSData, compareData: BSData | null, compareYear: number) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  const bs1 = data.consolidatedBS
  const bs2 = compareData?.consolidatedBS

  const calcTotals = (d?: ConsolidatedBS) => {
    if (!d) return { tca: 0, ta: 0, tcl: 0, tl: 0, se: 0, tlse: 0 }
    const tca  = d.cash + d.accountsReceivable + d.prepaidExpenses + d.inventory
    const ta   = tca + d.equipment + d.property + d.goodwill
    const tcl  = d.accountsPayable + d.accruedExpenses + d.unearnedRevenue +
                 d.salariesPayable + d.incomeTaxesPayable + d.warrantyLiability
    const tl   = tcl + d.longTermDebt + d.otherLongTermLiabilities
    const se   = d.equityCapital + d.retainedEarnings
    return { tca, ta, tcl, tl, se, tlse: tl + se }
  }

  const t1 = calcTotals(bs1)
  const t2 = calcTotals(bs2)

  const fmtPDF = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  const bsRow = (label: string, a: number | undefined, b: number | undefined, cls = '') =>
    `<tr class="${cls}"><td>${label}</td><td class="num">${a !== undefined ? fmtPDF(a) : '—'}</td><td class="num">${b !== undefined ? fmtPDF(b) : '—'}</td></tr>`

  const historyRows = data.history.slice(0, 200).map(h => `
    <tr>
      <td>${new Date(h.date).toLocaleDateString('en-IN')}</td>
      <td>${h.customerName}</td>
      <td class="num">${fmtPDF(h.total)}</td>
      <td><span class="badge ${h.status}">${h.status}</span></td>
      <td>${h.paymentMethod.toUpperCase()}</td>
      <td class="num">${h.items}</td>
    </tr>
  `).join('')

  printWindow.document.write(`
    <!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Consolidated Balance Sheet ${data.year}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Segoe UI',sans-serif; color:#111; background:#fff; padding:32px; font-size:13px; }
      h1 { font-size:26px; font-weight:800; margin-bottom:4px; }
      h1 span { color:#1e3a5f; }
      .sub { color:#666; font-size:12px; margin-bottom:24px; }
      .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }
      .kpi { background:#e8f0fe; border-radius:8px; padding:12px 14px; }
      .kpi-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#555; }
      .kpi-val { font-size:18px; font-weight:800; color:#1e3a5f; margin-top:2px; font-family:monospace; }
      h2 { font-size:14px; font-weight:700; margin:20px 0 10px; border-left:3px solid #1e3a5f; padding-left:10px; }
      table { width:100%; border-collapse:collapse; margin-bottom:24px; }
      th { background:#1e3a5f; color:#fff; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; padding:8px 10px; text-align:left; }
      th.num { text-align:right; }
      td { padding:6px 10px; border-bottom:1px solid #eee; font-size:12px; }
      tr:nth-child(even) td { background:#fafafa; }
      .num { text-align:right; font-family:monospace; font-weight:600; }
      .section td { background:#e8f0fe!important; font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; }
      .subhead td { font-style:italic; color:#555; font-size:11px; }
      .subtotal td { background:#dbeafe!important; font-weight:700; color:#1e3a5f; }
      .rowtotal td { background:#1e3a5f!important; color:#fff!important; font-weight:700; }
      .badge { padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700; text-transform:uppercase; }
      .paid { background:#d1fae5; color:#065f46; }
      .pending { background:#fef3c7; color:#92400e; }
      .returned { background:#fee2e2; color:#991b1b; }
      @media print { body { padding:16px; } }
    </style></head><body>
    <h1>ShopX <span>Consolidated Balance Sheet</span></h1>
    <p class="sub">FY ${data.year} vs FY ${compareYear} &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Total Revenue</div><div class="kpi-val">${fmtPDF(data.summary.totalRevenue)}</div></div>
      <div class="kpi"><div class="kpi-label">Gross Profit</div><div class="kpi-val">${fmtPDF(data.summary.totalGrossProfit)}</div></div>
      <div class="kpi"><div class="kpi-label">Gross Margin</div><div class="kpi-val">${pct(data.summary.grossMargin)}</div></div>
      <div class="kpi"><div class="kpi-label">Total Orders</div><div class="kpi-val">${data.summary.totalOrders}</div></div>
    </div>
    <h2>Consolidated Balance Sheet</h2>
    <table>
      <thead><tr><th>Description</th><th class="num">FY ${data.year}</th><th class="num">FY ${compareYear}</th></tr></thead>
      <tbody>
        <tr class="section"><td colspan="3">ASSETS — Current Assets</td></tr>
        ${bsRow('Cash', bs1?.cash, bs2?.cash)}
        ${bsRow('Accounts Receivable', bs1?.accountsReceivable, bs2?.accountsReceivable)}
        ${bsRow('Prepaid Expenses', bs1?.prepaidExpenses, bs2?.prepaidExpenses)}
        ${bsRow('Inventory', bs1?.inventory, bs2?.inventory)}
        ${bsRow('Total Current Assets', t1.tca, t2.tca, 'subtotal')}
        <tr class="subhead"><td colspan="3">Non-Current Assets</td></tr>
        ${bsRow('Equipment', bs1?.equipment, bs2?.equipment)}
        ${bsRow('Property', bs1?.property, bs2?.property)}
        ${bsRow('Goodwill', bs1?.goodwill, bs2?.goodwill)}
        ${bsRow('TOTAL ASSETS', t1.ta, t2.ta, 'rowtotal')}
        <tr class="section"><td colspan="3">LIABILITIES — Current Liabilities</td></tr>
        ${bsRow('Accounts Payable', bs1?.accountsPayable, bs2?.accountsPayable)}
        ${bsRow('Accrued Expenses', bs1?.accruedExpenses, bs2?.accruedExpenses)}
        ${bsRow('Unearned Revenue', bs1?.unearnedRevenue, bs2?.unearnedRevenue)}
        ${bsRow('Salaries Payable', bs1?.salariesPayable, bs2?.salariesPayable)}
        ${bsRow('Income Taxes Payable', bs1?.incomeTaxesPayable, bs2?.incomeTaxesPayable)}
        ${bsRow('Warranty Liability', bs1?.warrantyLiability, bs2?.warrantyLiability)}
        ${bsRow('Total Current Liabilities', t1.tcl, t2.tcl, 'subtotal')}
        <tr class="subhead"><td colspan="3">Long-Term Liabilities</td></tr>
        ${bsRow('Long-Term Debt', bs1?.longTermDebt, bs2?.longTermDebt)}
        ${bsRow('Other Long-Term Liabilities', bs1?.otherLongTermLiabilities, bs2?.otherLongTermLiabilities)}
        ${bsRow('TOTAL LIABILITIES', t1.tl, t2.tl, 'rowtotal')}
        <tr class="section"><td colspan="3">SHAREHOLDER'S EQUITY</td></tr>
        ${bsRow('Equity Capital', bs1?.equityCapital, bs2?.equityCapital)}
        ${bsRow('Retained Earnings', bs1?.retainedEarnings, bs2?.retainedEarnings)}
        ${bsRow("Shareholder's Equity", t1.se, t2.se, 'subtotal')}
        ${bsRow("TOTAL LIABILITIES & SHAREHOLDER'S EQUITY", t1.tlse, t2.tlse, 'rowtotal')}
      </tbody>
    </table>
    <h2>Transaction History</h2>
    <table>
      <thead><tr><th>Date</th><th>Customer</th><th class="num">Amount</th><th>Status</th><th>Payment</th><th class="num">Items</th></tr></thead>
      <tbody>${historyRows}</tbody>
    </table>
    </body></html>
  `)
  printWindow.document.close()
  setTimeout(() => { printWindow.print() }, 400)
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BalanceSheetPage() {
  const [data, setData]               = React.useState<BSData | null>(null)
  const [compareData, setCompareData] = React.useState<BSData | null>(null)
  const [loading, setLoading]         = React.useState(true)
  const [compareLoading, setCompareLoading] = React.useState(false)
  const [error, setError]             = React.useState<string | null>(null)
  const [year, setYear]               = React.useState(currentYear)
  const [compareYear, setCompareYear] = React.useState(currentYear - 1)

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
      if (!res.ok) return
      setCompareData(await res.json())
    } catch {
      // silently fail — compare column just shows zeros
    } finally {
      setCompareLoading(false)
    }
  }, [compareYear])

  React.useEffect(() => { fetchData() }, [fetchData])
  React.useEffect(() => { fetchCompareData() }, [fetchCompareData])

  const s = data?.summary

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Badge className="bg-primary/10 text-primary border-none mb-2 px-3 py-1 text-[10px] tracking-widest uppercase font-bold">
            ShopX Elite · Financial Report
          </Badge>
          <h1 className="text-4xl font-headline font-bold tracking-tight">
            Balance <span className="text-primary">Sheet</span>
          </h1>
          <p className="text-muted-foreground mt-1">
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

          {/* Download */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={!data}
                className="bg-primary text-primary-foreground font-semibold px-5 rounded-full shadow-lg shadow-primary/20 gap-2">
                <Download className="w-4 h-4" /> Export <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => data && downloadPDF(data, compareData, compareYear)} className="gap-2 cursor-pointer">
                <FileText className="w-4 h-4 text-rose-500" /> Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => data && downloadCSV(data)} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Download Excel / CSV
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
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
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
          <Button variant="ghost" size="sm" onClick={() => data && downloadCSV(data)} disabled={!data}
            className="text-xs gap-1.5 text-muted-foreground hover:text-foreground rounded-full">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Export CSV
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
                        {h.customerName.charAt(0).toUpperCase()}
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