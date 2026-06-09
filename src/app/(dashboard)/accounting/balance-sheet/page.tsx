"use client"

import * as React from "react"
import {
  TrendingUp, Package, IndianRupee, BarChart3,
  Download, FileSpreadsheet, FileText, RefreshCw,
  ChevronDown, AlertTriangle, ShoppingCart, Percent,
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
interface BSData {
  year: number
  summary: Summary
  months: MonthRow[]
  paymentBreakdown: Record<string, number>
  topProducts: { name: string; revenue: number; qty: number }[]
  history: { date: string; customerName: string; total: number; status: string; paymentMethod: string; items: number }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const pct = (n: number) => `${n.toFixed(1)}%`

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i)

// ── StatCard matching dashboard theme ────────────────────────────────────────
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

async function downloadPDF(data: BSData) {
  // Build a clean printable HTML and use window.print
  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  const monthsRows = data.months.map(m => `
    <tr>
      <td>${m.month}</td>
      <td class="num">${fmt(m.revenue)}</td>
      <td class="num">${fmt(m.cogs)}</td>
      <td class="num ${m.grossProfit >= 0 ? 'pos' : 'neg'}">${fmt(m.grossProfit)}</td>
      <td class="num">${m.orders}</td>
      <td class="num">${m.revenue ? pct((m.grossProfit / m.revenue) * 100) : '—'}</td>
    </tr>
  `).join('')

  const historyRows = data.history.slice(0, 200).map(h => `
    <tr>
      <td>${new Date(h.date).toLocaleDateString('en-IN')}</td>
      <td>${h.customerName}</td>
      <td class="num">${fmt(h.total)}</td>
      <td><span class="badge ${h.status}">${h.status}</span></td>
      <td>${h.paymentMethod.toUpperCase()}</td>
      <td class="num">${h.items}</td>
    </tr>
  `).join('')

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>Balance Sheet ${data.year}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; color: #111; background: #fff; padding: 32px; font-size: 13px; }
        h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 4px; }
        h1 span { color: #7c3aed; }
        .sub { color: #666; font-size: 12px; margin-bottom: 28px; }
        .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 28px; }
        .kpi { background: #f5f3ff; border-radius: 10px; padding: 14px 16px; }
        .kpi-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; }
        .kpi-val { font-size: 20px; font-weight: 800; color: #111; margin-top: 2px; font-family: monospace; }
        h2 { font-size: 15px; font-weight: 700; margin: 20px 0 10px; border-left: 3px solid #7c3aed; padding-left: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
        th { background: #7c3aed; color: #fff; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; text-align: left; }
        td { padding: 7px 10px; border-bottom: 1px solid #f0f0f0; font-size: 12px; }
        tr:nth-child(even) td { background: #faf9ff; }
        .num { text-align: right; font-family: monospace; font-weight: 600; }
        .pos { color: #059669; }
        .neg { color: #dc2626; }
        .badge { padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
        .paid { background: #d1fae5; color: #065f46; }
        .pending { background: #fef3c7; color: #92400e; }
        .returned { background: #fee2e2; color: #991b1b; }
        tfoot td { font-weight: 800; background: #f5f3ff !important; border-top: 2px solid #7c3aed; }
        @media print { body { padding: 16px; } }
      </style>
    </head>
    <body>
      <h1>ShopX <span>Balance Sheet</span></h1>
      <p class="sub">Financial Year ${data.year} &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>

      <div class="kpis">
        <div class="kpi"><div class="kpi-label">Total Revenue</div><div class="kpi-val">${fmt(data.summary.totalRevenue)}</div></div>
        <div class="kpi"><div class="kpi-label">Gross Profit</div><div class="kpi-val">${fmt(data.summary.totalGrossProfit)}</div></div>
        <div class="kpi"><div class="kpi-label">Gross Margin</div><div class="kpi-val">${pct(data.summary.grossMargin)}</div></div>
        <div class="kpi"><div class="kpi-label">Total Orders</div><div class="kpi-val">${data.summary.totalOrders}</div></div>
      </div>

      <h2>Monthly P&amp;L Statement</h2>
      <table>
        <thead><tr><th>Month</th><th>Revenue</th><th>COGS</th><th>Gross Profit</th><th>Orders</th><th>Margin %</th></tr></thead>
        <tbody>${monthsRows}</tbody>
        <tfoot><tr>
          <td>TOTAL</td>
          <td class="num">${fmt(data.summary.totalRevenue)}</td>
          <td class="num">${fmt(data.summary.totalCOGS)}</td>
          <td class="num pos">${fmt(data.summary.totalGrossProfit)}</td>
          <td class="num">${data.summary.totalOrders}</td>
          <td class="num">${pct(data.summary.grossMargin)}</td>
        </tr></tfoot>
      </table>

      <h2>Transaction History</h2>
      <table>
        <thead><tr><th>Date</th><th>Customer</th><th>Amount</th><th>Status</th><th>Payment</th><th>Items</th></tr></thead>
        <tbody>${historyRows}</tbody>
      </table>
    </body>
    </html>
  `)
  printWindow.document.close()
  setTimeout(() => { printWindow.print() }, 400)
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BalanceSheetPage() {
  const [data, setData]       = React.useState<BSData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError]     = React.useState<string | null>(null)
  const [year, setYear]       = React.useState(currentYear)

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

  React.useEffect(() => { fetchData() }, [fetchData])

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
            Full P&L statement and transaction history for FY {year}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Year selector */}
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

          {/* Refresh */}
          <Button variant="outline" onClick={fetchData} disabled={loading}
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
              <DropdownMenuItem onClick={() => data && downloadPDF(data)} className="gap-2 cursor-pointer">
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

      {/* ── Monthly P&L Table ── */}
      <Card className="border-none bg-card shadow-sm">
        <CardHeader className="pb-0">
          <CardTitle className="font-headline flex items-center gap-2 text-lg">
            <BarChart3 className="w-5 h-5 text-primary" />
            Monthly P&amp;L Statement — FY {year}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Month', 'Revenue', 'COGS', 'Gross Profit', 'Orders', 'Margin %'].map(h => (
                  <th key={h} className="text-left pb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.months || Array(12).fill(null)).map((m, i) => (
                <tr key={i} className="border-b border-border/40 hover:bg-secondary/20 transition-colors group">
                  <td className="py-3 px-3 font-semibold">{m?.month ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-3 px-3 font-mono font-semibold">{m ? fmt(m.revenue) : '—'}</td>
                  <td className="py-3 px-3 font-mono text-muted-foreground">{m ? fmt(m.cogs) : '—'}</td>
                  <td className={`py-3 px-3 font-mono font-bold ${m && m.grossProfit >= 0 ? 'text-accent' : 'text-destructive'}`}>
                    {m ? fmt(m.grossProfit) : '—'}
                  </td>
                  <td className="py-3 px-3 font-mono">{m?.orders ?? '—'}</td>
                  <td className="py-3 px-3">
                    {m && m.revenue > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${Math.min((m.grossProfit / m.revenue) * 100, 100)}%` }} />
                        </div>
                        <span className="text-xs font-mono font-semibold w-10 text-right">
                          {pct((m.grossProfit / m.revenue) * 100)}
                        </span>
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            {data && (
              <tfoot>
                <tr className="bg-primary/5 border-t-2 border-primary/20">
                  <td className="py-3 px-3 font-bold text-[11px] uppercase tracking-widest">Total</td>
                  <td className="py-3 px-3 font-mono font-bold text-primary">{fmt(data.summary.totalRevenue)}</td>
                  <td className="py-3 px-3 font-mono font-bold text-muted-foreground">{fmt(data.summary.totalCOGS)}</td>
                  <td className="py-3 px-3 font-mono font-bold text-accent">{fmt(data.summary.totalGrossProfit)}</td>
                  <td className="py-3 px-3 font-mono font-bold">{data.summary.totalOrders}</td>
                  <td className="py-3 px-3 font-mono font-bold text-primary">{pct(data.summary.grossMargin)}</td>
                </tr>
              </tfoot>
            )}
          </table>
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
              const colors = ['text-primary', 'text-accent', 'text-purple-400', 'text-orange-400']
              const bgColors = ['bg-primary/10', 'bg-accent/10', 'bg-purple-500/10', 'bg-orange-500/10']
              const pctVal = data.summary.totalRevenue ? (amount / data.summary.totalRevenue) * 100 : 0
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
                      h.status === 'paid'     ? 'bg-accent/10 text-accent' :
                      h.status === 'pending'  ? 'bg-orange-500/10 text-orange-400' :
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